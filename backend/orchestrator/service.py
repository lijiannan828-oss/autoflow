from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from .models import (
    GateDecisionResult,
    GateSnapshot,
    NodeExecutionPlan,
    NodeRunRecord,
    ReviewTaskRef,
    RunPlan,
    RunRecord,
)
from .statuses import (
    GATE_NODE_BY_STAGE,
    STAGE4_REVIEWER_ROLE_BY_STEP,
    EpisodeVersionStatus,
    NodeRunStatus,
    ReviewDecision,
    ReviewTaskStatus,
    RunStatus,
    gate_approved_status,
)


def utc_now() -> datetime:
    return datetime.now(tz=UTC)


class OrchestratorService:
    """In-memory skeleton that mirrors frozen contracts without committing to a framework."""

    def create_run(
        self,
        *,
        episode_id: str,
        episode_version_id: str,
        plan: RunPlan,
        is_rerun: bool = False,
        rerun_from_ticket_id: str | None = None,
        langgraph_thread_id: str | None = None,
    ) -> RunRecord:
        if is_rerun and not rerun_from_ticket_id:
            raise ValueError("rerun run must provide rerun_from_ticket_id")

        return RunRecord(
            episode_id=episode_id,
            episode_version_id=episode_version_id,
            plan_json=plan.to_plan_json(),
            is_rerun=is_rerun,
            rerun_from_ticket_id=rerun_from_ticket_id,
            langgraph_thread_id=langgraph_thread_id,
        )

    def start_run(self, run: RunRecord) -> EpisodeVersionStatus:
        run.status = RunStatus.RUNNING
        run.started_at = run.started_at or utc_now()
        run.updated_at = utc_now()
        return EpisodeVersionStatus.RUNNING

    def start_node(self, run: RunRecord, node: NodeExecutionPlan) -> NodeRunRecord:
        run.current_node_id = node.node_id
        run.updated_at = utc_now()
        return NodeRunRecord(
            run_id=run.id,
            episode_version_id=run.episode_version_id,
            node_id=node.node_id,
            agent_role=node.agent_role,
            scope_hash=node.scope_hash,
            status=NodeRunStatus.RUNNING,
            started_at=utc_now(),
        )

    def complete_node(
        self,
        node_run: NodeRunRecord,
        *,
        status: NodeRunStatus,
        output_ref: str | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
        quality_score: float | None = None,
    ) -> NodeRunRecord:
        if status not in {
            NodeRunStatus.SUCCEEDED,
            NodeRunStatus.FAILED,
            NodeRunStatus.PARTIAL,
            NodeRunStatus.AUTO_REJECTED,
            NodeRunStatus.SKIPPED,
            NodeRunStatus.CANCELED,
        }:
            raise ValueError(f"unsupported completion status: {status}")

        ended_at = utc_now()
        duration_s = None
        if node_run.started_at is not None:
            duration_s = (ended_at - node_run.started_at).total_seconds()

        node_run.status = status
        node_run.output_ref = output_ref
        node_run.error_code = error_code
        node_run.error_message = error_message
        node_run.quality_score = quality_score
        node_run.ended_at = ended_at
        node_run.duration_s = duration_s
        node_run.updated_at = ended_at
        return node_run

    def enter_gate(
        self,
        *,
        run: RunRecord,
        stage_no: int,
        review_tasks: list[ReviewTaskRef],
    ) -> GateSnapshot:
        run.current_node_id = GATE_NODE_BY_STAGE[stage_no]
        run.updated_at = utc_now()
        return GateSnapshot.from_review_tasks(
            episode_version_id=run.episode_version_id,
            stage_no=stage_no,
            review_tasks=review_tasks,
        )

    def create_stage2_review_tasks(
        self,
        *,
        episode_id: str,
        episode_version_id: str,
        shot_ids: list[str],
    ) -> list[ReviewTaskRef]:
        return [
            ReviewTaskRef(
                episode_id=episode_id,
                episode_version_id=episode_version_id,
                stage_no=2,
                review_step_no=1,
                reviewer_role="qc_inspector",
                review_granularity="shot",
                anchor_type="shot",
                anchor_id=shot_id,
                payload={"shot_id": shot_id},
            )
            for shot_id in shot_ids
        ]

    def create_stage4_initial_task(
        self,
        *,
        episode_id: str,
        episode_version_id: str,
    ) -> ReviewTaskRef:
        return ReviewTaskRef(
            episode_id=episode_id,
            episode_version_id=episode_version_id,
            stage_no=4,
            review_step_no=1,
            reviewer_role=STAGE4_REVIEWER_ROLE_BY_STEP[1],
            review_granularity="episode",
            anchor_type=None,
            anchor_id=None,
            payload={"episode_version_id": episode_version_id},
        )

    def apply_review_decision(
        self,
        *,
        stage_no: int,
        review_tasks: list[ReviewTaskRef],
        review_task_id: str,
        decision: ReviewDecision,
        decision_comment: str,
    ) -> GateDecisionResult:
        task = self._get_task(review_tasks, review_task_id)
        if task.stage_no != stage_no:
            raise ValueError("review task stage does not match gate stage")

        task.status = (
            ReviewTaskStatus.APPROVED
            if decision == ReviewDecision.APPROVE
            else ReviewTaskStatus.RETURNED
        )
        task.decision = decision
        task.decision_comment = decision_comment
        task.finished_at = utc_now()
        task.updated_at = task.finished_at

        next_action = "release_gate_or_create_next_step"
        return_ticket_id = None

        if decision == ReviewDecision.RETURN:
            next_action = "create_return_ticket_and_stop_following_steps"
            return_ticket_id = str(uuid4())
        elif stage_no == 4:
            next_action = self._advance_stage4(review_tasks, task)

        gate_snapshot = GateSnapshot.from_review_tasks(
            episode_version_id=task.episode_version_id,
            stage_no=stage_no,
            review_tasks=review_tasks,
        )
        return GateDecisionResult(
            review_task_id=task.id,
            status=task.status,
            decision=task.decision,
            return_ticket_id=return_ticket_id,
            next_action=next_action,
            gate_snapshot=gate_snapshot,
        )

    def skip_stage4_step(
        self,
        *,
        review_tasks: list[ReviewTaskRef],
        review_task_id: str,
        reason: str,
    ) -> GateDecisionResult:
        task = self._get_task(review_tasks, review_task_id)
        if task.stage_no != 4 or task.review_step_no != 1:
            raise ValueError("only stage4 step1 can be skipped")

        task.status = ReviewTaskStatus.SKIPPED
        task.decision_comment = reason
        task.finished_at = utc_now()
        task.updated_at = task.finished_at
        next_action = self._ensure_stage4_step_exists(review_tasks, step_no=2)
        gate_snapshot = GateSnapshot.from_review_tasks(
            episode_version_id=task.episode_version_id,
            stage_no=4,
            review_tasks=review_tasks,
        )
        return GateDecisionResult(
            review_task_id=task.id,
            status=task.status,
            decision=None,
            return_ticket_id=None,
            next_action=next_action,
            gate_snapshot=gate_snapshot,
        )

    def release_gate_if_ready(
        self,
        *,
        run: RunRecord,
        gate_snapshot: GateSnapshot,
    ) -> EpisodeVersionStatus | None:
        if not gate_snapshot.all_approved:
            return None

        run.current_node_id = None
        run.updated_at = utc_now()
        return gate_approved_status(gate_snapshot.stage_no)

    def _advance_stage4(
        self,
        review_tasks: list[ReviewTaskRef],
        task: ReviewTaskRef,
    ) -> str:
        if task.review_step_no == 1:
            return self._ensure_stage4_step_exists(review_tasks, step_no=2)
        if task.review_step_no == 2:
            return self._ensure_stage4_step_exists(review_tasks, step_no=3)
        return "release_gate_or_create_next_step"

    def _ensure_stage4_step_exists(
        self,
        review_tasks: list[ReviewTaskRef],
        *,
        step_no: int,
    ) -> str:
        if any(task.review_step_no == step_no for task in review_tasks):
            return "create_next_step"

        source = review_tasks[0]
        review_tasks.append(
            ReviewTaskRef(
                episode_id=source.episode_id,
                episode_version_id=source.episode_version_id,
                stage_no=4,
                review_step_no=step_no,
                reviewer_role=STAGE4_REVIEWER_ROLE_BY_STEP[step_no],
                review_granularity="episode",
                anchor_type=None,
                anchor_id=None,
                payload={"episode_version_id": source.episode_version_id},
            )
        )
        return "create_next_step"

    @staticmethod
    def _get_task(review_tasks: list[ReviewTaskRef], review_task_id: str) -> ReviewTaskRef:
        for task in review_tasks:
            if task.id == review_task_id:
                return task
        raise ValueError(f"review task not found: {review_task_id}")
