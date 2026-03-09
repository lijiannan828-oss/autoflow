from __future__ import annotations

from .contracts import (
    EpisodeVersionSnapshot,
    RerunPlan,
    ReturnTicketRecord,
    VersionPatch,
)


class MinimalVersionService:
    """Prepare the minimal v+1 patch payload without touching storage or orchestration."""

    def create_version_patch(
        self,
        ticket: ReturnTicketRecord,
        plan: RerunPlan,
        current_version: EpisodeVersionSnapshot,
        next_version_id: str,
    ) -> VersionPatch:
        return VersionPatch(
            return_ticket_id=ticket.id,
            source_episode_version_id=current_version.id,
            target_episode_version_id=next_version_id,
            target_version_no=current_version.version_no + 1,
            source_status_after_patch="patching",
            target_status_on_create="running",
            rerun_plan_json=plan.to_dict(),
            reused_node_ids=plan.reuse_node_ids(),
            rerun_node_ids=plan.rerun_node_ids(),
        )

    def build_next_version_snapshot(
        self,
        current_version: EpisodeVersionSnapshot,
        next_version_id: str,
    ) -> EpisodeVersionSnapshot:
        return EpisodeVersionSnapshot(
            id=next_version_id,
            episode_id=current_version.episode_id,
            version_no=current_version.version_no + 1,
            status="running",
            node_statuses={},
        )
