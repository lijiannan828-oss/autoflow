from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.common.contracts.serialization import to_jsonable

from .models import GateSnapshot, NodeExecutionPlan, NodeRunRecord, ReviewTaskRef, RunPlan, RunRecord
from .service import OrchestratorService
from .statuses import NodeRunStatus, ReviewDecision, ReviewTaskStatus, RunStatus


@dataclass(slots=True)
class AcceptanceScenario:
    id: str
    label: str
    description: str
    focus_run_id: str
    runs: list[RunRecord]
    node_runs: list[NodeRunRecord]
    review_tasks: list[ReviewTaskRef]
    return_tickets: list[dict[str, Any]]
    gate_list: dict[str, Any] | None
    gate_detail: dict[str, Any] | None
    stage2_summary: dict[str, Any] | None
    stage4_summary: dict[str, Any] | None

    def to_dict(self) -> dict[str, Any]:
        return to_jsonable(self)


def _gate_list_response(review_tasks: list[ReviewTaskRef]) -> dict[str, Any]:
    items = []
    for task in review_tasks:
        if task.status not in {ReviewTaskStatus.PENDING, ReviewTaskStatus.IN_PROGRESS}:
            continue
        items.append(
            {
                "review_task_id": task.id,
                "episode_id": task.episode_id,
                "episode_version_id": task.episode_version_id,
                "stage_no": task.stage_no,
                "gate_node_id": task.gate_node_id,
                "review_step_no": task.review_step_no,
                "reviewer_role": task.reviewer_role,
                "review_granularity": task.review_granularity,
                "anchor_type": task.anchor_type,
                "anchor_id": task.anchor_id,
                "status": task.status,
                "priority": task.priority,
                "openclaw_session_id": task.openclaw_session_id,
                "due_at": None,
                "payload": task.payload,
            }
        )
    return {"items": to_jsonable(items), "total": len(items)}


def _gate_detail_response(task: ReviewTaskRef, gate_snapshot: GateSnapshot) -> dict[str, Any]:
    detail: dict[str, Any] = {
        "review_task_id": task.id,
        "episode_id": task.episode_id,
        "episode_version_id": task.episode_version_id,
        "stage_no": task.stage_no,
        "gate_node_id": task.gate_node_id,
        "review_step_no": task.review_step_no,
        "reviewer_role": task.reviewer_role,
        "review_granularity": task.review_granularity,
        "anchor_type": task.anchor_type,
        "anchor_id": task.anchor_id,
        "status": task.status,
        "priority": task.priority,
        "openclaw_session_id": task.openclaw_session_id,
        "payload": task.payload,
        "review_points": [],
    }
    if gate_snapshot.stage_no == 4:
        previous_steps = [
            {"step_no": step.step_no, "status": step.status}
            for step in gate_snapshot.steps
            if step.step_no < (gate_snapshot.current_step_no or 1) and step.status is not None
        ]
        detail["stage4_progress"] = {
            "current_step_no": gate_snapshot.current_step_no or 1,
            "total_steps": gate_snapshot.total_steps or 3,
            "previous_steps": previous_steps,
        }
    return to_jsonable(detail)


def _stage2_summary(snapshot: GateSnapshot) -> dict[str, Any]:
    return {
        "episode_version_id": snapshot.episode_version_id,
        "gate_node_id": snapshot.gate_node_id,
        "approved_count": snapshot.approved_count,
        "returned_count": snapshot.returned_count,
        "pending_count": snapshot.pending_count,
        "total_count": snapshot.total_count,
        "all_approved": snapshot.all_approved,
    }


def _stage4_summary(snapshot: GateSnapshot) -> dict[str, Any]:
    return {
        "episode_version_id": snapshot.episode_version_id,
        "gate_node_id": snapshot.gate_node_id,
        "current_step_no": snapshot.current_step_no or 1,
        "total_steps": snapshot.total_steps or 3,
        "steps": [
            {
                "step_no": step.step_no,
                "reviewer_role": step.reviewer_role,
                "status": step.status,
            }
            for step in snapshot.steps
        ],
    }


def build_stage2_gate_scenario() -> AcceptanceScenario:
    service = OrchestratorService()
    plan = RunPlan(
        nodes=[
            NodeExecutionPlan(node_id="N01", agent_role="script_analyst", scope_hash="episode"),
            NodeExecutionPlan(node_id="N03", agent_role="quality_guardian", scope_hash="script-qc"),
            NodeExecutionPlan(node_id="N11", agent_role="quality_guardian", scope_hash="keyframe-qc"),
            NodeExecutionPlan(node_id="N15", agent_role="quality_guardian", scope_hash="video-qc"),
            NodeExecutionPlan(node_id="N18", agent_role="human_review_entry", scope_hash="stage2-gate"),
        ]
    )
    run = service.create_run(
        episode_id="episode-real-201",
        episode_version_id="episode-real-201-v1",
        plan=plan,
        langgraph_thread_id="lg-real-stage2-201-v1",
    )
    service.start_run(run)

    completed_nodes: list[NodeRunRecord] = []
    for node in plan.nodes[:-1]:
        node_run = service.start_node(run, node)
        service.complete_node(
            node_run,
            status=NodeRunStatus.SUCCEEDED,
            output_ref=f"tos://autoflow-media/{run.episode_version_id}/{node.node_id}/output.json",
            quality_score=0.92 if node.node_id != "N11" else 0.87,
        )
        completed_nodes.append(node_run)

    gate_node = service.start_node(run, plan.nodes[-1])
    completed_nodes.append(gate_node)

    review_tasks = service.create_stage2_review_tasks(
        episode_id=run.episode_id,
        episode_version_id=run.episode_version_id,
        shot_ids=["shot-real-001", "shot-real-002", "shot-real-003"],
    )
    review_tasks[0].status = ReviewTaskStatus.APPROVED
    review_tasks[0].decision = ReviewDecision.APPROVE
    review_tasks[0].decision_comment = "首个镜头通过"
    review_tasks[0].openclaw_session_id = "oc-real-stage2-shot-001"

    review_tasks[1].status = ReviewTaskStatus.IN_PROGRESS
    review_tasks[1].assignee_id = "qc_real_operator"
    review_tasks[1].openclaw_session_id = "oc-real-stage2-shot-002"

    review_tasks[2].status = ReviewTaskStatus.PENDING

    gate_snapshot = service.enter_gate(run=run, stage_no=2, review_tasks=review_tasks)

    gate_node.status = NodeRunStatus.PENDING
    gate_node.tags.append("gate_waiting_review")
    gate_node.updated_at = review_tasks[1].updated_at

    return AcceptanceScenario(
        id="round2_stage2_real_gate",
        label="第二轮 · Stage2 真实读取",
        description="通过 backend/orchestrator 真实骨架生成 Stage2 gate 读取数据，展示 shot 级审核挂起状态。",
        focus_run_id=run.id,
        runs=[run],
        node_runs=completed_nodes,
        review_tasks=review_tasks,
        return_tickets=[],
        gate_list=_gate_list_response(review_tasks),
        gate_detail=_gate_detail_response(review_tasks[1], gate_snapshot),
        stage2_summary=_stage2_summary(gate_snapshot),
        stage4_summary=None,
    )


def build_stage4_returned_scenario() -> AcceptanceScenario:
    service = OrchestratorService()
    plan = RunPlan(
        nodes=[
            NodeExecutionPlan(node_id="N21", agent_role="audio_director", scope_hash="stage3"),
            NodeExecutionPlan(node_id="N24", agent_role="human_review_entry", scope_hash="stage4-gate"),
        ]
    )
    run = service.create_run(
        episode_id="episode-real-204",
        episode_version_id="episode-real-204-v1",
        plan=plan,
        langgraph_thread_id="lg-real-stage4-204-v1",
    )
    service.start_run(run)

    stage3_node = service.start_node(run, plan.nodes[0])
    service.complete_node(
        stage3_node,
        status=NodeRunStatus.SUCCEEDED,
        output_ref=f"tos://autoflow-media/{run.episode_version_id}/N21/output.json",
        quality_score=0.96,
    )
    gate_node = service.start_node(run, plan.nodes[1])

    review_tasks = [service.create_stage4_initial_task(episode_id=run.episode_id, episode_version_id=run.episode_version_id)]
    gate_snapshot = service.enter_gate(run=run, stage_no=4, review_tasks=review_tasks)

    service.skip_stage4_step(
        review_tasks=review_tasks,
        review_task_id=review_tasks[0].id,
        reason="optional_step_skipped",
    )
    step2 = next(task for task in review_tasks if task.review_step_no == 2)
    result = service.apply_review_decision(
        stage_no=4,
        review_tasks=review_tasks,
        review_task_id=step2.id,
        decision=ReviewDecision.RETURN,
        decision_comment="字幕时间轴仍需回炉",
    )

    run.status = RunStatus.FAILED
    gate_node.status = NodeRunStatus.FAILED
    gate_node.error_code = "GATE_RETURNED"
    gate_node.error_message = "Stage4 step2 returned the episode"
    gate_node.updated_at = step2.updated_at

    return_ticket = {
        "id": result.return_ticket_id,
        "episode_id": run.episode_id,
        "episode_version_id": run.episode_version_id,
        "review_task_id": step2.id,
        "source_type": "human_review",
        "source_node_id": None,
        "stage_no": 4,
        "anchor_type": "episode",
        "anchor_id": run.episode_id,
        "timestamp_ms": 2400,
        "issue_type": "subtitle",
        "severity": "major",
        "comment": "Stage4 returned after timeline review.",
        "created_by_role": "middle_platform",
        "suggested_stage_back": 4,
        "system_root_cause_node_id": "N23",
        "rerun_plan_json": {},
        "status": "open",
        "resolved_version_id": None,
        "created_at": "2026-03-07T12:20:00Z",
        "updated_at": "2026-03-07T12:20:00Z",
    }

    return AcceptanceScenario(
        id="round2_stage4_real_returned",
        label="第二轮 · Stage4 真实读取",
        description="通过 backend/orchestrator 真实骨架生成 Stage4 returned 场景，展示串行步骤与打回结果。",
        focus_run_id=run.id,
        runs=[run],
        node_runs=[stage3_node, gate_node],
        review_tasks=review_tasks,
        return_tickets=[return_ticket],
        gate_list=_gate_list_response(review_tasks),
        gate_detail=_gate_detail_response(step2, result.gate_snapshot),
        stage2_summary=None,
        stage4_summary=_stage4_summary(result.gate_snapshot),
    )


def build_acceptance_scenarios() -> list[dict[str, Any]]:
    return [
        build_stage2_gate_scenario().to_dict(),
        build_stage4_returned_scenario().to_dict(),
    ]
