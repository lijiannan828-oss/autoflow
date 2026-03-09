"""Review Dispatcher module — V1-V4 deliverables.

ReviewDispatcherAgent: 自然语言审核批注 → LLM 解析 → 结构化任务拆分
TaskExecutor: 任务类型路由 → 调度到目标 Agent 执行
attribution: 打回归因分析（根因定位到具体 Agent/节点）
"""

from backend.agents.dispatch.review_dispatcher import ReviewDispatcherAgent
from backend.agents.dispatch.task_executor import TaskExecutor
from backend.agents.dispatch.attribution import (
    attribute_return_reason,
    enrich_return_ticket_with_attribution,
)

__all__ = [
    "ReviewDispatcherAgent",
    "TaskExecutor",
    "attribute_return_reason",
    "enrich_return_ticket_with_attribution",
]
