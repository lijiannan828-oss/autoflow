from __future__ import annotations

from dataclasses import replace

from .contracts import (
    EpisodeVersionSnapshot,
    NodePatchDecision,
    ReturnTicketRecord,
    RerunPlan,
)


class MinimalRerunPlanner:
    """Generate the smallest structured `rerun_plan_json` from a return ticket."""

    def build_plan(
        self,
        ticket: ReturnTicketRecord,
        current_version: EpisodeVersionSnapshot,
    ) -> RerunPlan:
        rerun_node_ids = self._resolve_rerun_node_ids(ticket)
        anchor = ticket.anchor_ref()
        decisions: list[NodePatchDecision] = []

        for node_id, status in current_version.node_statuses.items():
            if node_id in rerun_node_ids:
                decisions.append(
                    NodePatchDecision(
                        node_id=node_id,
                        action="rerun",
                        reason="selected_from_return_ticket_root_cause",
                        anchor=anchor,
                    )
                )
                continue

            if status == "succeeded":
                decisions.append(
                    NodePatchDecision(
                        node_id=node_id,
                        action="reuse",
                        reason="preserve_previous_successful_output",
                    )
                )

        notes: list[str] = []
        if not rerun_node_ids:
            notes.append("root_cause_node_missing_requires_runtime_graph_resolution")

        if ticket.suggested_stage_back < ticket.stage_no:
            notes.append("ticket_requests_stage_back_before_current_stage")

        return RerunPlan(
            ticket_id=ticket.id,
            episode_id=ticket.episode_id,
            episode_version_id=ticket.episode_version_id,
            suggested_stage_back=ticket.suggested_stage_back,
            root_cause_node_id=self._resolve_root_cause_node_id(ticket),
            anchors=[anchor],
            node_decisions=decisions,
            notes=notes,
        )

    def attach_plan(
        self,
        ticket: ReturnTicketRecord,
        plan: RerunPlan,
    ) -> ReturnTicketRecord:
        return replace(
            ticket,
            rerun_plan_json=plan.to_dict(),
            status="in_progress",
        )

    def _resolve_rerun_node_ids(self, ticket: ReturnTicketRecord) -> list[str]:
        node_id = self._resolve_root_cause_node_id(ticket)
        return [node_id] if node_id else []

    def _resolve_root_cause_node_id(self, ticket: ReturnTicketRecord) -> str | None:
        if ticket.system_root_cause_node_id:
            return ticket.system_root_cause_node_id
        if ticket.source_type == "auto_qc":
            return ticket.source_node_id
        return None
