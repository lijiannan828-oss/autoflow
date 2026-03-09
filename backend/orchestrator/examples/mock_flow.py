from __future__ import annotations

from pprint import pprint

from backend.orchestrator.models import NodeExecutionPlan, RunPlan
from backend.orchestrator.service import OrchestratorService
from backend.orchestrator.statuses import NodeRunStatus, ReviewDecision


def run_stage2_demo() -> None:
    service = OrchestratorService()
    plan = RunPlan(
        nodes=[
            NodeExecutionPlan(node_id="N01", agent_role="supervisor", scope_hash="episode"),
            NodeExecutionPlan(node_id="N18", agent_role="gate", scope_hash="stage2"),
        ]
    )
    run = service.create_run(
        episode_id="episode-001",
        episode_version_id="version-001",
        plan=plan,
        langgraph_thread_id="thread-demo-001",
    )
    service.start_run(run)
    first_node = service.start_node(run, plan.nodes[0])
    service.complete_node(
        first_node,
        status=NodeRunStatus.SUCCEEDED,
        output_ref="tos://demo/storyboard.json",
    )

    stage2_tasks = service.create_stage2_review_tasks(
        episode_id=run.episode_id,
        episode_version_id=run.episode_version_id,
        shot_ids=["shot-001", "shot-002"],
    )
    gate_snapshot = service.enter_gate(run=run, stage_no=2, review_tasks=stage2_tasks)
    print("Stage2 enter gate:")
    pprint(
        {
            "run_status": run.status.value,
            "episode_version_status": gate_snapshot.episode_version_status.value,
            "gate_node_id": gate_snapshot.gate_node_id,
            "pending_count": gate_snapshot.pending_count,
            "all_approved": gate_snapshot.all_approved,
        }
    )

    for task in stage2_tasks:
        result = service.apply_review_decision(
            stage_no=2,
            review_tasks=stage2_tasks,
            review_task_id=task.id,
            decision=ReviewDecision.APPROVE,
            decision_comment="shot ok",
        )
        print("Stage2 review decision:")
        pprint(
            {
                "review_task_id": result.review_task_id,
                "status": result.status.value,
                "decision": result.decision.value if result.decision else None,
                "next_action": result.next_action,
                "all_approved": result.gate_snapshot.all_approved,
            }
        )

    released_status = service.release_gate_if_ready(run=run, gate_snapshot=result.gate_snapshot)
    print("Stage2 gate released:")
    pprint(
        {
            "released_episode_version_status": released_status.value if released_status else None,
            "run_current_node_id": run.current_node_id,
        }
    )


def run_stage4_demo() -> None:
    service = OrchestratorService()
    review_tasks = [
        service.create_stage4_initial_task(
            episode_id="episode-001",
            episode_version_id="version-001",
        )
    ]
    gate_snapshot = service.enter_gate(
        run=service.create_run(
            episode_id="episode-001",
            episode_version_id="version-001",
            plan=RunPlan(nodes=[]),
        ),
        stage_no=4,
        review_tasks=review_tasks,
    )
    print("Stage4 initial gate:")
    pprint(
        {
            "episode_version_status": gate_snapshot.episode_version_status.value,
            "current_step_no": gate_snapshot.current_step_no,
            "steps": [(step.step_no, step.reviewer_role, step.status) for step in gate_snapshot.steps],
        }
    )

    skip_result = service.skip_stage4_step(
        review_tasks=review_tasks,
        review_task_id=review_tasks[0].id,
        reason="optional_step_skipped",
    )
    print("Stage4 step1 skipped:")
    pprint(
        {
            "status": skip_result.status.value,
            "next_action": skip_result.next_action,
            "current_step_no": skip_result.gate_snapshot.current_step_no,
        }
    )

    step2 = next(task for task in review_tasks if task.review_step_no == 2)
    approve_step2 = service.apply_review_decision(
        stage_no=4,
        review_tasks=review_tasks,
        review_task_id=step2.id,
        decision=ReviewDecision.APPROVE,
        decision_comment="middle platform ok",
    )
    print("Stage4 step2 approved:")
    pprint(
        {
            "next_action": approve_step2.next_action,
            "steps": [
                (step.step_no, step.reviewer_role, step.status)
                for step in approve_step2.gate_snapshot.steps
            ],
        }
    )


if __name__ == "__main__":
    run_stage2_demo()
    print("-" * 60)
    run_stage4_demo()
