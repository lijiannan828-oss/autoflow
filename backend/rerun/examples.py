from __future__ import annotations

import json

from .contracts import EpisodeVersionSnapshot, ReturnTicketRecord
from .planner import MinimalRerunPlanner
from .versioning import MinimalVersionService


def build_sample_flow() -> dict[str, object]:
    current_version = EpisodeVersionSnapshot(
        id="ev_v1",
        episode_id="ep_001",
        version_no=1,
        status="returned",
        node_statuses={
            "N21": "succeeded",
            "N23": "succeeded",
            "N26": "failed",
        },
    )
    ticket = ReturnTicketRecord(
        id="rt_001",
        episode_id="ep_001",
        episode_version_id="ev_v1",
        review_task_id="review_001",
        source_type="human_review",
        source_node_id=None,
        stage_no=4,
        anchor_type="episode",
        anchor_id="ep_001",
        timestamp_ms=1200,
        issue_type="subtitle",
        severity="major",
        comment="Subtitle timing is incorrect and must rerun from the subtitle node.",
        created_by_role="middle_platform",
        suggested_stage_back=4,
        system_root_cause_node_id="N23",
        rerun_plan_json=None,
        status="open",
        resolved_version_id=None,
        created_at="2026-03-08T09:00:00Z",
        updated_at="2026-03-08T09:00:00Z",
    )

    planner = MinimalRerunPlanner()
    version_service = MinimalVersionService()

    plan = planner.build_plan(ticket=ticket, current_version=current_version)
    ticket_with_plan = planner.attach_plan(ticket=ticket, plan=plan)
    version_patch = version_service.create_version_patch(
        ticket=ticket_with_plan,
        plan=plan,
        current_version=current_version,
        next_version_id="ev_v2",
    )
    next_version = version_service.build_next_version_snapshot(
        current_version=current_version,
        next_version_id="ev_v2",
    )

    return {
        "return_ticket": ticket_with_plan.to_dict(),
        "rerun_plan_json": plan.to_dict(),
        "version_patch": version_patch.to_dict(),
        "next_version": next_version.to_dict(),
    }


if __name__ == "__main__":
    print(json.dumps(build_sample_flow(), indent=2, ensure_ascii=False))
