"""Dispatcher 归因分析器 — V4 交付

将审核打回的原因（decision_comment + review_points）通过 LLM 分析，
归因到具体的 Agent 和节点，增强回炉票据的根因定位能力。

设计原则：
  - 纯增强层：不修改现有 return_review_task 流程
  - 异步后处理：打回完成后异步补充归因信息到 return_tickets
  - 降级安全：LLM 分析失败时保留原有 system_root_cause_node_id
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# 同 review_dispatcher.py 中定义的映射
AGENT_NODE_MAP: dict[str, list[str]] = {
    "visual_director": ["N07", "N09", "N10", "N13", "N14", "N17", "N19"],
    "audio_director": ["N07b", "N20", "N22"],
    "shot_designer": ["N02", "N04", "N05", "N16", "N16b"],
    "script_analyst": ["N01"],
    "compositor": ["N23", "N25", "N26"],
    "quality_inspector": ["N03", "N11", "N15"],
}

# 反向映射: node_id → agent_name
NODE_TO_AGENT: dict[str, str] = {}
for _agent, _nodes in AGENT_NODE_MAP.items():
    for _node in _nodes:
        NODE_TO_AGENT[_node] = _agent

# 阶段 → 常见根因节点（基于流水线结构）
STAGE_ROOT_CAUSE_HINTS: dict[int, list[str]] = {
    1: ["N07", "N07b", "N06", "N09"],          # Stage 1: 美术资产
    2: ["N10", "N13", "N14", "N16", "N16b"],   # Stage 2: 视觉素材
    3: ["N20", "N22", "N19"],                    # Stage 3: 视听整合
    4: ["N23", "N25", "N26"],                    # Stage 4: 成片
}


@dataclass
class AttributionResult:
    """归因分析结果。"""
    attributed_agent: str | None = None       # 归因到的 Agent
    attributed_node_id: str | None = None     # 归因到的节点
    confidence: float = 0.0                   # 归因置信度
    reasoning: str = ""                       # 归因推理过程
    suggested_action: str = "regenerate"      # 建议动作
    cost_cny: float = 0.0


_ATTRIBUTION_SYSTEM_PROMPT = """\
你是 AutoFlow 短剧生产系统的根因归因分析器。

审核员打回了一个审核任务。你需要根据打回原因，判断问题出在哪个 Agent 和哪个节点。

## Agent 与节点对照表
- visual_director: N07(美术图), N09(角色固化), N10(关键帧), N13(关键帧定稿), N14(视频), N17(超分), N19(定稿)
- audio_director: N07b(音色), N20(TTS/BGM/SFX), N22(音频定稿)
- shot_designer: N02(拆集拆镜), N04(分镜定稿), N05(镜头分级), N16(时间线), N16b(影调)
- script_analyst: N01(剧本解析)
- compositor: N23(合成), N25(字幕), N26(最终输出)
- quality_inspector: N03(分镜QC), N11(关键帧QC), N15(视频QC)

## 输出格式（JSON）
{
  "attributed_agent": "agent名称",
  "attributed_node_id": "Nxx",
  "confidence": 0.9,
  "reasoning": "归因推理过程",
  "suggested_action": "regenerate|adjust|replace"
}

## 归因规则
1. 根据问题描述判断是哪个环节出了问题
2. 图像质量问题 → visual_director (N07/N10)
3. 角色不一致 → visual_director (N09/N13)
4. 视频问题 → visual_director (N14)
5. 音频/音色问题 → audio_director (N07b/N20)
6. 节奏/构图问题 → shot_designer (N02/N04/N16)
7. 合成/字幕问题 → compositor (N23/N25)
8. 如果无法确定，归因到当前 stage 的最可能节点
"""


def attribute_return_reason(
    decision_comment: str,
    review_points: list[dict[str, Any]] | None = None,
    stage_no: int = 0,
    gate_node_id: str | None = None,
    system_root_cause_node_id: str | None = None,
) -> AttributionResult:
    """分析打回原因，归因到具体 Agent 和节点。

    优先使用 LLM 分析，失败时降级到规则引擎。
    """
    # 先尝试规则引擎（快速、免费）
    rule_result = _rule_based_attribution(
        decision_comment, review_points, stage_no, system_root_cause_node_id
    )

    # 如果规则引擎置信度足够高，直接返回
    if rule_result.confidence >= 0.8:
        return rule_result

    # 否则尝试 LLM 分析
    try:
        llm_result = _llm_attribution(decision_comment, review_points, stage_no)
        if llm_result.confidence > rule_result.confidence:
            return llm_result
        return rule_result
    except Exception as exc:
        logger.warning("LLM attribution failed, using rule-based: %s", exc)
        return rule_result


def _rule_based_attribution(
    decision_comment: str,
    review_points: list[dict[str, Any]] | None,
    stage_no: int,
    system_root_cause_node_id: str | None,
) -> AttributionResult:
    """基于关键词和规则的快速归因。"""
    comment = (decision_comment or "").lower()
    points_text = " ".join(
        str(p.get("comment", "") or p.get("issue_type", "")) for p in (review_points or [])
    ).lower()
    full_text = f"{comment} {points_text}"

    # 关键词 → (agent, node, confidence) 映射
    keyword_rules: list[tuple[list[str], str, str, float]] = [
        # 图像质量
        (["脸", "五官", "面部", "人脸", "face"], "visual_director", "N07", 0.85),
        (["画质", "模糊", "清晰度", "分辨率"], "visual_director", "N17", 0.8),
        (["角色一致", "不像", "换脸", "长相"], "visual_director", "N09", 0.85),
        (["关键帧", "构图", "画面"], "visual_director", "N10", 0.8),
        (["视频", "动作", "运动", "抖动", "artifact"], "visual_director", "N14", 0.85),
        # 音频
        (["音色", "声音", "配音", "语调"], "audio_director", "N07b", 0.85),
        (["背景音乐", "bgm", "音乐"], "audio_director", "N20", 0.85),
        (["音效", "sfx", "环境音"], "audio_director", "N20", 0.8),
        (["口型", "唇形", "对嘴"], "audio_director", "N20", 0.8),
        # 分镜/节奏
        (["节奏", "太快", "太慢", "pacing"], "shot_designer", "N16", 0.8),
        (["分镜", "镜头", "运镜"], "shot_designer", "N04", 0.8),
        (["影调", "色调", "滤镜"], "shot_designer", "N16b", 0.8),
        # 合成
        (["字幕", "文字", "subtitle"], "compositor", "N25", 0.85),
        (["合成", "拼接", "转场"], "compositor", "N23", 0.8),
    ]

    best_match: AttributionResult | None = None
    for keywords, agent, node, conf in keyword_rules:
        if any(kw in full_text for kw in keywords):
            if best_match is None or conf > best_match.confidence:
                best_match = AttributionResult(
                    attributed_agent=agent,
                    attributed_node_id=node,
                    confidence=conf,
                    reasoning=f"关键词匹配: {[kw for kw in keywords if kw in full_text]}",
                    suggested_action="adjust" if "调" in full_text or "改" in full_text else "regenerate",
                )

    if best_match:
        return best_match

    # 降级：使用系统推断的 root cause 或 stage hint
    if system_root_cause_node_id:
        agent = NODE_TO_AGENT.get(system_root_cause_node_id, "review_dispatcher")
        return AttributionResult(
            attributed_agent=agent,
            attributed_node_id=system_root_cause_node_id,
            confidence=0.5,
            reasoning=f"使用系统推断的 root cause: {system_root_cause_node_id}",
        )

    if stage_no in STAGE_ROOT_CAUSE_HINTS:
        hint_node = STAGE_ROOT_CAUSE_HINTS[stage_no][0]
        agent = NODE_TO_AGENT.get(hint_node, "review_dispatcher")
        return AttributionResult(
            attributed_agent=agent,
            attributed_node_id=hint_node,
            confidence=0.3,
            reasoning=f"Stage {stage_no} 默认归因到 {hint_node}",
        )

    return AttributionResult(
        confidence=0.1,
        reasoning="无法归因，需人工判断",
    )


def _llm_attribution(
    decision_comment: str,
    review_points: list[dict[str, Any]] | None,
    stage_no: int,
) -> AttributionResult:
    """使用 LLM 进行归因分析。"""
    from backend.common.llm_client import call_llm

    points_text = ""
    if review_points:
        for p in review_points:
            points_text += f"\n- 问题类型: {p.get('issue_type', 'N/A')}, 严重度: {p.get('severity', 'N/A')}, 描述: {p.get('comment', '')}"

    user_prompt = f"""\
## 打回信息
- 审核阶段: Stage {stage_no}
- 打回理由: {decision_comment}
{f'- 审核要点:{points_text}' if points_text else ''}

请分析根因并归因到具体 Agent 和节点。
"""

    resp = call_llm(
        model="gemini-2.5-flash",
        system_prompt=_ATTRIBUTION_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        json_mode=True,
        temperature=0.1,
        max_tokens=1024,
    )

    data = json.loads(resp.content)
    agent_name = data.get("attributed_agent")
    node_id = data.get("attributed_node_id")

    # 验证 agent/node 合法性
    if agent_name and agent_name not in AGENT_NODE_MAP and agent_name != "quality_inspector":
        agent_name = None
    if node_id and node_id not in NODE_TO_AGENT:
        node_id = None

    return AttributionResult(
        attributed_agent=agent_name,
        attributed_node_id=node_id,
        confidence=float(data.get("confidence", 0.5)),
        reasoning=str(data.get("reasoning", "")),
        suggested_action=str(data.get("suggested_action", "regenerate")),
        cost_cny=resp.cost_cny,
    )


def enrich_return_ticket_with_attribution(
    ticket_id: str,
    decision_comment: str,
    review_points: list[dict[str, Any]] | None = None,
    stage_no: int = 0,
    system_root_cause_node_id: str | None = None,
) -> dict[str, Any]:
    """分析打回原因并将归因信息补充到 return_ticket 中。

    在 return_review_task 完成后调用，异步丰富回炉票据信息。
    返回归因结果 dict。
    """
    result = attribute_return_reason(
        decision_comment=decision_comment,
        review_points=review_points,
        stage_no=stage_no,
        system_root_cause_node_id=system_root_cause_node_id,
    )

    attribution_data = {
        "attributed_agent": result.attributed_agent,
        "attributed_node_id": result.attributed_node_id,
        "confidence": result.confidence,
        "reasoning": result.reasoning,
        "suggested_action": result.suggested_action,
    }

    # 写入 return_ticket 的 rerun_plan_json 中
    try:
        from backend.common.db import execute_returning_one
        row = execute_returning_one(
            """
            UPDATE core_pipeline.return_tickets
            SET rerun_plan_json = rerun_plan_json || %s::jsonb,
                updated_at = now()
            WHERE id = %s
            RETURNING id
            """,
            (json.dumps({"dispatcher_attribution": attribution_data}), ticket_id),
        )
        attribution_data["persisted"] = row is not None
    except Exception as exc:
        logger.warning("Failed to persist attribution to ticket %s: %s", ticket_id, exc)
        attribution_data["persisted"] = False

    return attribution_data
