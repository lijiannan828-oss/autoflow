from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from .statuses import (
    EpisodeVersionStatus,
    GATE_NODE_BY_STAGE,
    NodeRunStatus,
    ReviewDecision,
    ReviewTaskStatus,
    RunStatus,
    gate_approved_status,
    gate_wait_status,
)


def utc_now() -> datetime:
    return datetime.now(tz=UTC)


@dataclass(slots=True)
class NodeExecutionPlan:
    node_id: str
    agent_role: str
    scope_hash: str
    depends_on: list[str] = field(default_factory=list)


@dataclass(slots=True)
class RunPlan:
    nodes: list[NodeExecutionPlan]

    def to_plan_json(self) -> dict[str, Any]:
        return {"nodes": [asdict(node) for node in self.nodes]}


@dataclass(slots=True)
class RunRecord:
    episode_id: str
    episode_version_id: str
    plan_json: dict[str, Any]
    is_rerun: bool = False
    rerun_from_ticket_id: str | None = None
    langgraph_thread_id: str | None = None
    id: str = field(default_factory=lambda: str(uuid4()))
    status: RunStatus = RunStatus.PENDING
    current_node_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(slots=True)
class NodeRunRecord:
    run_id: str
    episode_version_id: str
    node_id: str
    agent_role: str
    scope_hash: str
    attempt_no: int = 1
    retry_count: int = 0
    auto_reject_count: int = 0
    input_ref: str | None = None
    output_ref: str | None = None
    model_provider: str | None = None
    model_endpoint: str | None = None
    comfyui_workflow_id: str | None = None
    api_calls: int = 0
    token_in: int = 0
    token_out: int = 0
    gpu_seconds: float = 0.0
    cost_cny: float = 0.0
    rag_query_count: int = 0
    quality_score: float | None = None
    error_code: str | None = None
    error_message: str | None = None
    tags: list[str] = field(default_factory=list)
    id: str = field(default_factory=lambda: str(uuid4()))
    status: NodeRunStatus = NodeRunStatus.PENDING
    started_at: datetime | None = None
    ended_at: datetime | None = None
    duration_s: float | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)


@dataclass(slots=True)
class ReviewTaskRef:
    episode_id: str
    episode_version_id: str
    stage_no: int
    review_step_no: int
    reviewer_role: str
    review_granularity: str
    anchor_type: str | None
    anchor_id: str | None
    payload: dict[str, Any]
    gate_node_id: str | None = None
    assignee_id: str | None = None
    priority: str = "normal"
    openclaw_session_id: str | None = None
    id: str = field(default_factory=lambda: str(uuid4()))
    status: ReviewTaskStatus = ReviewTaskStatus.PENDING
    started_at: datetime | None = None
    finished_at: datetime | None = None
    decision: ReviewDecision | None = None
    decision_comment: str | None = None
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        self.gate_node_id = self.gate_node_id or GATE_NODE_BY_STAGE[self.stage_no]


@dataclass(slots=True)
class GateStepProgress:
    step_no: int
    reviewer_role: str
    status: str | None


@dataclass(slots=True)
class GateSnapshot:
    episode_version_id: str
    stage_no: int
    gate_node_id: str
    review_tasks: list[ReviewTaskRef]
    approved_count: int
    returned_count: int
    pending_count: int
    total_count: int
    all_approved: bool
    current_step_no: int | None
    total_steps: int | None
    steps: list[GateStepProgress]
    episode_version_status: EpisodeVersionStatus

    @classmethod
    def from_review_tasks(
        cls,
        episode_version_id: str,
        stage_no: int,
        review_tasks: list[ReviewTaskRef],
    ) -> "GateSnapshot":
        gate_node_id = GATE_NODE_BY_STAGE[stage_no]
        approved_count = sum(
            task.status == ReviewTaskStatus.APPROVED for task in review_tasks
        )
        returned_count = sum(
            task.status == ReviewTaskStatus.RETURNED for task in review_tasks
        )
        pending_like = {ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS}
        pending_count = sum(task.status in pending_like for task in review_tasks)

        if stage_no == 4:
            return cls._build_stage4(
                episode_version_id=episode_version_id,
                review_tasks=review_tasks,
                gate_node_id=gate_node_id,
                approved_count=approved_count,
                returned_count=returned_count,
                pending_count=pending_count,
            )

        return cls(
            episode_version_id=episode_version_id,
            stage_no=stage_no,
            gate_node_id=gate_node_id,
            review_tasks=review_tasks,
            approved_count=approved_count,
            returned_count=returned_count,
            pending_count=pending_count,
            total_count=len(review_tasks),
            all_approved=bool(review_tasks) and approved_count == len(review_tasks),
            current_step_no=1 if review_tasks else None,
            total_steps=1 if review_tasks else None,
            steps=[],
            episode_version_status=(
                EpisodeVersionStatus.RETURNED
                if returned_count
                else gate_approved_status(stage_no)
                if review_tasks and approved_count == len(review_tasks)
                else gate_wait_status(stage_no=stage_no)
            ),
        )

    @classmethod
    def _build_stage4(
        cls,
        episode_version_id: str,
        review_tasks: list[ReviewTaskRef],
        gate_node_id: str,
        approved_count: int,
        returned_count: int,
        pending_count: int,
    ) -> "GateSnapshot":
        tasks_by_step = {task.review_step_no: task for task in review_tasks}
        steps = [
            GateStepProgress(
                step_no=1,
                reviewer_role="qc_inspector",
                status=tasks_by_step.get(1).status.value if tasks_by_step.get(1) else None,
            ),
            GateStepProgress(
                step_no=2,
                reviewer_role="middle_platform",
                status=tasks_by_step.get(2).status.value if tasks_by_step.get(2) else None,
            ),
            GateStepProgress(
                step_no=3,
                reviewer_role="partner",
                status=tasks_by_step.get(3).status.value if tasks_by_step.get(3) else None,
            ),
        ]

        current_step_no = None
        for step in steps:
            if step.status in (None, ReviewTaskStatus.PENDING.value, ReviewTaskStatus.IN_PROGRESS.value):
                current_step_no = step.step_no
                break

        all_approved = approved_count == 3 and returned_count == 0
        wait_step = current_step_no or 3
        return cls(
            episode_version_id=episode_version_id,
            stage_no=4,
            gate_node_id=gate_node_id,
            review_tasks=review_tasks,
            approved_count=approved_count,
            returned_count=returned_count,
            pending_count=pending_count,
            total_count=3,
            all_approved=all_approved,
            current_step_no=current_step_no,
            total_steps=3,
            steps=steps,
            episode_version_status=(
                EpisodeVersionStatus.RETURNED
                if returned_count
                else gate_approved_status(4)
                if all_approved
                else gate_wait_status(stage_no=4, review_step_no=wait_step)
            ),
        )


@dataclass(slots=True)
class GateDecisionResult:
    review_task_id: str
    status: ReviewTaskStatus
    decision: ReviewDecision | None
    return_ticket_id: str | None
    next_action: str
    gate_snapshot: GateSnapshot
