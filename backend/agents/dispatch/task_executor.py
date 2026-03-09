"""TaskExecutor — Dispatcher 任务路由执行器

V2 核心交付：
  接收 DispatcherTask 列表 → 按 task_type 路由到目标 Agent → 收集执行结果

三种任务类型的执行策略：
  - regenerate: 调用目标 Agent.execute() 触发完整重新生成
  - adjust:     构造调整参数传给目标 Agent（如修改 prompt 参数后重新生成）
  - replace:    替换资产引用（如从候选列表中选择另一个）
  - manual:     标记为需人工处理，不自动执行
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

from backend.agents.base import AgentContext, AgentResult

logger = logging.getLogger(__name__)


@dataclass
class TaskResult:
    """单个 DispatcherTask 的执行结果。"""
    task_index: int
    task_type: str
    target_agent: str
    success: bool
    output: dict[str, Any] = field(default_factory=dict)
    cost_cny: float = 0.0
    duration_ms: int = 0
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "task_index": self.task_index,
            "task_type": self.task_type,
            "target_agent": self.target_agent,
            "success": self.success,
            "output": self.output,
            "cost_cny": self.cost_cny,
            "duration_ms": self.duration_ms,
            "error": self.error,
        }


class TaskExecutor:
    """将 DispatcherTask 列表按类型路由到目标 Agent 执行。

    用法：
        executor = TaskExecutor()
        results = executor.execute_tasks(tasks, base_context)
    """

    def execute_tasks(
        self,
        tasks: list[dict[str, Any]],
        base_context: AgentContext,
    ) -> list[TaskResult]:
        """依次执行任务列表，收集结果。

        当前为顺序执行。未来可扩展为并行执行（MQ 异步模式）。
        """
        results: list[TaskResult] = []

        for i, task in enumerate(tasks):
            task_type = task.get("task_type", "manual")
            target_agent_name = task.get("target_agent", "review_dispatcher")

            t0 = time.monotonic()

            if task_type == "manual":
                results.append(TaskResult(
                    task_index=i,
                    task_type=task_type,
                    target_agent=target_agent_name,
                    success=True,
                    output={"status": "manual_review_required", "description": task.get("description", "")},
                ))
                continue

            try:
                agent = self._get_agent(target_agent_name)
                if agent is None:
                    results.append(TaskResult(
                        task_index=i,
                        task_type=task_type,
                        target_agent=target_agent_name,
                        success=False,
                        error=f"Agent '{target_agent_name}' not found in registry",
                        duration_ms=int((time.monotonic() - t0) * 1000),
                    ))
                    continue

                # 构造 Agent 执行上下文
                agent_ctx = AgentContext(
                    run_id=base_context.run_id,
                    episode_version_id=base_context.episode_version_id,
                    node_id=task.get("target_node_id") or base_context.node_id,
                    project_id=base_context.project_id,
                    genre=base_context.genre,
                    cost_budget_remaining=base_context.cost_budget_remaining,
                    extra={
                        "dispatcher_task_type": task_type,
                        "dispatcher_params": task.get("params", {}),
                        "dispatcher_description": task.get("description", ""),
                        "source_annotation": base_context.extra.get("annotation", ""),
                    },
                )

                if task_type == "regenerate":
                    result = self._execute_regenerate(agent, agent_ctx, task)
                elif task_type == "adjust":
                    result = self._execute_adjust(agent, agent_ctx, task)
                elif task_type == "replace":
                    result = self._execute_replace(agent, agent_ctx, task)
                else:
                    result = AgentResult(success=False, error=f"Unknown task_type: {task_type}")

                duration_ms = int((time.monotonic() - t0) * 1000)
                results.append(TaskResult(
                    task_index=i,
                    task_type=task_type,
                    target_agent=target_agent_name,
                    success=result.success,
                    output=result.output,
                    cost_cny=result.cost_cny,
                    duration_ms=duration_ms,
                    error=result.error,
                ))

            except Exception as exc:
                duration_ms = int((time.monotonic() - t0) * 1000)
                logger.exception("Task %d execution failed: %s", i, exc)
                results.append(TaskResult(
                    task_index=i,
                    task_type=task_type,
                    target_agent=target_agent_name,
                    success=False,
                    error=str(exc),
                    duration_ms=duration_ms,
                ))

        return results

    # ── 各任务类型的执行方法 ──────────────────────────────────────

    def _execute_regenerate(
        self, agent: Any, ctx: AgentContext, task: dict[str, Any]
    ) -> AgentResult:
        """regenerate: 完整重新生成。直接调用 Agent.execute()。"""
        ctx.extra["regenerate"] = True
        ctx.extra.update(task.get("params", {}))
        return agent.execute(ctx)

    def _execute_adjust(
        self, agent: Any, ctx: AgentContext, task: dict[str, Any]
    ) -> AgentResult:
        """adjust: 在现有结果基础上微调。传递 adjustment params。"""
        ctx.extra["adjust"] = True
        ctx.extra["adjustment_params"] = task.get("params", {})
        ctx.extra["adjustment_description"] = task.get("description", "")
        return agent.execute(ctx)

    def _execute_replace(
        self, agent: Any, ctx: AgentContext, task: dict[str, Any]
    ) -> AgentResult:
        """replace: 替换资产。传递 replacement target。"""
        ctx.extra["replace"] = True
        ctx.extra["replacement_params"] = task.get("params", {})
        return agent.execute(ctx)

    # ── 辅助方法 ──────────────────────────────────────────────────

    @staticmethod
    def _get_agent(agent_name: str) -> Any | None:
        """从 Registry 获取 Agent 实例。"""
        try:
            from backend.agents.registry import get_agent, is_registered
            if not is_registered(agent_name):
                return None
            return get_agent(agent_name)
        except (KeyError, ImportError):
            return None

    @staticmethod
    def summarize_results(results: list[TaskResult]) -> dict[str, Any]:
        """汇总执行结果。"""
        total = len(results)
        succeeded = sum(1 for r in results if r.success)
        total_cost = sum(r.cost_cny for r in results)
        total_duration = sum(r.duration_ms for r in results)

        return {
            "total_tasks": total,
            "succeeded": succeeded,
            "failed": total - succeeded,
            "total_cost_cny": round(total_cost, 4),
            "total_duration_ms": total_duration,
            "results": [r.to_dict() for r in results],
        }
