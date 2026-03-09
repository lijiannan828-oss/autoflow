"""ReviewDispatcherAgent — 自然语言审核批注 → 结构化任务拆分

V1 核心交付：
  审核员写自然语言批注（如"这个角色脸太圆了，重新生成一版瘦脸的"）
  → LLM 解析为结构化 DispatcherTask 列表
  → 每个 task 路由到目标 Agent（regenerate/adjust/replace）

设计决策：
  - 使用 gemini-2.5-flash 作为解析模型（便宜且快，批注解析不需要顶级推理）
  - 解析结果写入 review_tasks.dispatcher_tasks JSONB 字段
  - 支持单条批注 → 多条任务（如"脸太圆+背景太暗"→ 2 个任务）
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from backend.agents.base import AgentContext, AgentResult, BaseAgent

logger = logging.getLogger(__name__)

# ── 解析用 LLM 模型 ────────────────────────────────────────────────
DISPATCHER_MODEL = "gemini-2.5-flash"

# ── Task 类型定义 ────────────────────────────────────────────────────

TaskType = Literal["regenerate", "adjust", "replace", "manual"]

# Agent→节点映射，用于归因
AGENT_NODE_MAP: dict[str, list[str]] = {
    "visual_director": ["N07", "N09", "N10", "N13", "N14", "N17", "N19"],
    "audio_director": ["N07b", "N20", "N22"],
    "shot_designer": ["N02", "N04", "N05", "N16", "N16b"],
    "script_analyst": ["N01"],
    "compositor": ["N23", "N25", "N26"],
    "quality_inspector": ["N03", "N11", "N15"],
}


@dataclass
class DispatcherTask:
    """一个从自然语言批注解析出的结构化执行任务。"""
    task_type: TaskType                    # regenerate/adjust/replace/manual
    target_agent: str                      # 目标 Agent 名称
    target_node_id: str | None = None      # 推断的目标节点
    description: str = ""                  # 任务描述
    params: dict[str, Any] = field(default_factory=dict)  # 传给 Agent 的参数
    priority: int = 1                      # 1=高 2=中 3=低
    confidence: float = 0.0                # LLM 解析置信度 0-1

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── 解析 Prompt ────────────────────────────────────────────────────

_PARSE_SYSTEM_PROMPT = """\
你是 AutoFlow 短剧生产系统的审核批注解析器。

你的任务是将审核员的自然语言批注解析为结构化的执行任务列表。

## 任务类型
- regenerate: 重新生成（完全推翻重来）
- adjust: 调整（在现有基础上微调参数）
- replace: 替换（换一个不同的素材/方案）
- manual: 需要人工手动处理（系统无法自动完成的）

## 可用的目标 Agent
- visual_director: 视觉导演（图像生成、关键帧、视频、超分）→ 节点 N07/N09/N10/N13/N14/N17/N19
- audio_director: 音频导演（音色、TTS、BGM、SFX）→ 节点 N07b/N20/N22
- shot_designer: 镜头设计（分镜、镜头分级、影调）→ 节点 N02/N04/N05/N16/N16b
- script_analyst: 剧本分析（结构化解析）→ 节点 N01
- compositor: 合成编辑（最终合成、字幕、输出）→ 节点 N23/N25/N26
- quality_inspector: 质检员（QC 评分、一致性检查）→ 节点 N03/N11/N15

## 输出格式
JSON 数组，每个元素包含：
{
  "task_type": "regenerate|adjust|replace|manual",
  "target_agent": "agent 名称",
  "target_node_id": "Nxx（推断的目标节点，可选）",
  "description": "具体要做什么",
  "params": {"key": "value"},
  "priority": 1,
  "confidence": 0.9
}

## 规则
1. 一条批注可能包含多个问题，拆分为多个任务
2. 优先使用 adjust（微调），regenerate 用于质量完全不达标的情况
3. 如果批注含糊或无法判断目标 Agent，使用 manual 类型
4. confidence 反映你对解析结果的确信程度（0-1）
5. params 中包含具体的调整参数（如 {"face_shape": "瘦脸", "intensity": 0.7}）
"""

_PARSE_USER_TEMPLATE = """\
## 当前审核上下文
- Gate 节点: {gate_node_id}
- 审核阶段: Stage {stage_no}
{context_info}

## 审核员批注
{annotation}

请将以上批注解析为结构化的执行任务列表（JSON 数组）。
"""


class ReviewDispatcherAgent(BaseAgent):
    """审核批注 → 结构化任务拆分 → Agent 调度。

    决策循环：
      recall: 加载该项目/题材的历史批注解析经验
      reason: LLM 解析批注 → DispatcherTask 列表
      act:    将解析结果写入 review_tasks.dispatcher_tasks
      reflect: 高置信解析写入记忆供未来参考
    """

    @property
    def agent_name(self) -> str:
        return "review_dispatcher"

    def reason(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """LLM 解析自然语言批注为结构化任务。"""
        annotation = context.extra.get("annotation", "")
        if not annotation:
            return {
                "tasks": [],
                "_reasoning_text": "No annotation provided, nothing to dispatch.",
                "_cost_cny": 0.0,
            }

        gate_node_id = context.node_id or "unknown"
        stage_no = context.extra.get("stage_no", 0)
        context_info = ""
        if context.genre:
            context_info += f"- 题材: {context.genre}\n"
        if context.extra.get("shot_ids"):
            context_info += f"- 相关镜头: {', '.join(context.extra['shot_ids'])}\n"

        user_prompt = _PARSE_USER_TEMPLATE.format(
            gate_node_id=gate_node_id,
            stage_no=stage_no,
            context_info=context_info or "（无额外上下文）",
            annotation=annotation,
        )

        # 注入历史经验（如有）
        if recalled.get("memories"):
            examples_text = "\n## 历史解析参考\n"
            for mem in recalled["memories"][:3]:
                examples_text += f"- {mem['key']}: {json.dumps(mem['value'], ensure_ascii=False)}\n"
            user_prompt += examples_text

        try:
            from backend.common.llm_client import call_llm
            resp = call_llm(
                model=DISPATCHER_MODEL,
                system_prompt=_PARSE_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                json_mode=True,
                temperature=0.1,
                max_tokens=4096,
            )
            raw_tasks = json.loads(resp.content)
            if isinstance(raw_tasks, dict) and "tasks" in raw_tasks:
                raw_tasks = raw_tasks["tasks"]
            if not isinstance(raw_tasks, list):
                raw_tasks = [raw_tasks]

            tasks = [self._normalize_task(t) for t in raw_tasks]
            return {
                "tasks": [t.to_dict() for t in tasks],
                "raw_annotation": annotation,
                "task_count": len(tasks),
                "_reasoning_text": f"Parsed {len(tasks)} tasks from annotation.",
                "_cost_cny": resp.cost_cny,
            }
        except Exception as exc:
            logger.warning("LLM parse failed, falling back to manual task: %s", exc)
            fallback_task = DispatcherTask(
                task_type="manual",
                target_agent="review_dispatcher",
                description=f"LLM 解析失败，原始批注: {annotation}",
                confidence=0.0,
            )
            return {
                "tasks": [fallback_task.to_dict()],
                "raw_annotation": annotation,
                "task_count": 1,
                "parse_error": str(exc),
                "_reasoning_text": f"LLM parse failed: {exc}. Created manual fallback task.",
                "_cost_cny": 0.0,
            }

    def act(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        """将解析结果写入 review_tasks.dispatcher_tasks。"""
        tasks = reasoning.get("tasks", [])
        task_id = context.extra.get("review_task_id")

        if not task_id:
            logger.info("No review_task_id in context, returning parsed tasks only.")
            return {
                "dispatcher_tasks": tasks,
                "task_count": len(tasks),
                "persisted": False,
                "_cost_cny": 0.0,
            }

        dispatcher_payload = {
            "raw_annotation": reasoning.get("raw_annotation", ""),
            "tasks": tasks,
            "status": "parsed",
            "task_count": len(tasks),
        }

        try:
            from backend.common.db import execute_returning_one
            row = execute_returning_one(
                """
                UPDATE public.review_tasks
                SET dispatcher_tasks = %s::jsonb, updated_at = now()
                WHERE id = %s
                RETURNING id
                """,
                (json.dumps(dispatcher_payload, ensure_ascii=False), task_id),
            )
            persisted = row is not None
        except Exception as exc:
            logger.warning("Failed to persist dispatcher_tasks: %s", exc)
            persisted = False

        return {
            "dispatcher_tasks": tasks,
            "task_count": len(tasks),
            "persisted": persisted,
            "review_task_id": task_id,
            "_cost_cny": 0.0,
        }

    def reflect(
        self, context: AgentContext, result: AgentResult
    ) -> list[dict[str, Any]] | None:
        """高置信解析结果存入记忆，供未来批注解析参考。"""
        if not result.success:
            return None

        tasks = result.output.get("dispatcher_tasks", [])
        high_conf_tasks = [t for t in tasks if t.get("confidence", 0) >= 0.8]
        if not high_conf_tasks:
            return None

        annotation = context.extra.get("annotation", "")[:200]
        memory_writes = []
        for task in high_conf_tasks[:3]:
            memory_writes.append({
                "content_key": f"dispatch_pattern:{task.get('task_type')}:{task.get('target_agent')}",
                "content_value": {
                    "annotation_sample": annotation,
                    "task_type": task.get("task_type"),
                    "target_agent": task.get("target_agent"),
                    "target_node_id": task.get("target_node_id"),
                },
                "memory_type": "lesson_learned",
            })
        return memory_writes

    # ── 内部方法 ─────────────────────────────────────────────────

    @staticmethod
    def _normalize_task(raw: dict[str, Any]) -> DispatcherTask:
        """将 LLM 输出的 raw dict 规范化为 DispatcherTask。"""
        task_type = raw.get("task_type", "manual")
        if task_type not in ("regenerate", "adjust", "replace", "manual"):
            task_type = "manual"

        target_agent = raw.get("target_agent", "review_dispatcher")
        # 验证 agent 名称合法性
        valid_agents = {
            "visual_director", "audio_director", "shot_designer",
            "script_analyst", "compositor", "quality_inspector",
            "review_dispatcher",
        }
        if target_agent not in valid_agents:
            target_agent = "review_dispatcher"

        target_node_id = raw.get("target_node_id")
        if target_node_id and target_agent in AGENT_NODE_MAP:
            if target_node_id not in AGENT_NODE_MAP[target_agent]:
                target_node_id = None

        return DispatcherTask(
            task_type=task_type,
            target_agent=target_agent,
            target_node_id=target_node_id,
            description=str(raw.get("description", "")),
            params=dict(raw.get("params") or {}),
            priority=int(raw.get("priority", 2)),
            confidence=float(raw.get("confidence", 0.5)),
        )

    # ── 便捷静态方法（供 API 层直接调用）─────────────────────────

    @staticmethod
    def parse_annotation(
        annotation: str,
        review_task_id: str | None = None,
        gate_node_id: str | None = None,
        stage_no: int = 0,
        genre: str | None = None,
        shot_ids: list[str] | None = None,
        project_id: str | None = None,
    ) -> AgentResult:
        """一步调用：解析批注 → 返回结构化任务列表。

        供 write_api dispatch-annotation 命令直接调用。
        """
        agent = ReviewDispatcherAgent()
        ctx = AgentContext(
            node_id=gate_node_id,
            project_id=project_id,
            genre=genre,
            extra={
                "annotation": annotation,
                "review_task_id": review_task_id,
                "stage_no": stage_no,
                "shot_ids": shot_ids or [],
            },
        )
        return agent.execute(ctx)
