from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

EpisodeVersionStatus = Literal[
    "created",
    "running",
    "wait_review_stage_1",
    "wait_review_stage_2",
    "wait_review_stage_3",
    "wait_review_stage_4",
    "wait_review_stage_4_step_1",
    "wait_review_stage_4_step_2",
    "wait_review_stage_4_step_3",
    "approved_stage_1",
    "approved_stage_2",
    "approved_stage_3",
    "approved_stage_4",
    "returned",
    "patching",
    "delivered",
    "distributed",
]

NodeRunStatus = Literal[
    "pending",
    "running",
    "retrying",
    "succeeded",
    "failed",
    "canceled",
    "skipped",
    "partial",
    "auto_rejected",
]

ReturnTicketStatus = Literal["open", "in_progress", "resolved", "wontfix"]
ReturnSourceType = Literal["human_review", "auto_qc"]
PatchAction = Literal["rerun", "reuse"]


@dataclass(slots=True)
class AnchorRef:
    anchor_type: str | None
    anchor_id: str | None
    timestamp_ms: int | None = None


@dataclass(slots=True)
class EpisodeVersionSnapshot:
    id: str
    episode_id: str
    version_no: int
    status: EpisodeVersionStatus
    node_statuses: dict[str, NodeRunStatus] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ReturnTicketRecord:
    id: str
    episode_id: str
    episode_version_id: str
    review_task_id: str | None
    source_type: ReturnSourceType
    source_node_id: str | None
    stage_no: int
    anchor_type: str | None
    anchor_id: str | None
    timestamp_ms: int | None
    issue_type: str
    severity: str
    comment: str
    created_by_role: str
    suggested_stage_back: int
    system_root_cause_node_id: str | None
    rerun_plan_json: dict[str, Any] | None
    status: ReturnTicketStatus
    resolved_version_id: str | None
    created_at: str
    updated_at: str

    def anchor_ref(self) -> AnchorRef:
        return AnchorRef(
            anchor_type=self.anchor_type,
            anchor_id=self.anchor_id,
            timestamp_ms=self.timestamp_ms,
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class NodePatchDecision:
    node_id: str
    action: PatchAction
    reason: str
    anchor: AnchorRef | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class RerunPlan:
    ticket_id: str
    episode_id: str
    episode_version_id: str
    suggested_stage_back: int
    root_cause_node_id: str | None
    anchors: list[AnchorRef] = field(default_factory=list)
    node_decisions: list[NodePatchDecision] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def rerun_node_ids(self) -> list[str]:
        return [item.node_id for item in self.node_decisions if item.action == "rerun"]

    def reuse_node_ids(self) -> list[str]:
        return [item.node_id for item in self.node_decisions if item.action == "reuse"]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class VersionPatch:
    return_ticket_id: str
    source_episode_version_id: str
    target_episode_version_id: str
    target_version_no: int
    source_status_after_patch: EpisodeVersionStatus
    target_status_on_create: EpisodeVersionStatus
    rerun_plan_json: dict[str, Any]
    reused_node_ids: list[str] = field(default_factory=list)
    rerun_node_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
