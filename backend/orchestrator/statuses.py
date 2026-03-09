from __future__ import annotations

from enum import Enum


class StrValueEnum(str, Enum):
    def __str__(self) -> str:
        return self.value


class EpisodeVersionStatus(StrValueEnum):
    CREATED = "created"
    RUNNING = "running"
    WAIT_REVIEW_STAGE_1 = "wait_review_stage_1"
    WAIT_REVIEW_STAGE_2 = "wait_review_stage_2"
    WAIT_REVIEW_STAGE_3 = "wait_review_stage_3"
    WAIT_REVIEW_STAGE_4 = "wait_review_stage_4"
    WAIT_REVIEW_STAGE_4_STEP_1 = "wait_review_stage_4_step_1"
    WAIT_REVIEW_STAGE_4_STEP_2 = "wait_review_stage_4_step_2"
    WAIT_REVIEW_STAGE_4_STEP_3 = "wait_review_stage_4_step_3"
    APPROVED_STAGE_1 = "approved_stage_1"
    APPROVED_STAGE_2 = "approved_stage_2"
    APPROVED_STAGE_3 = "approved_stage_3"
    APPROVED_STAGE_4 = "approved_stage_4"
    RETURNED = "returned"
    PATCHING = "patching"
    DELIVERED = "delivered"
    DISTRIBUTED = "distributed"


class RunStatus(StrValueEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"


class NodeRunStatus(StrValueEnum):
    PENDING = "pending"
    RUNNING = "running"
    RETRYING = "retrying"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"
    SKIPPED = "skipped"
    PARTIAL = "partial"
    AUTO_REJECTED = "auto_rejected"


class ReviewTaskStatus(StrValueEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPROVED = "approved"
    RETURNED = "returned"
    SKIPPED = "skipped"


class ReviewDecision(StrValueEnum):
    APPROVE = "approve"
    RETURN = "return"


GATE_NODE_BY_STAGE: dict[int, str] = {
    1: "N08",
    2: "N18",
    3: "N21",
    4: "N24",
}

STAGE4_REVIEWER_ROLE_BY_STEP: dict[int, str] = {
    1: "qc_inspector",
    2: "middle_platform",
    3: "partner",
}

QUEUE_NODE_RUN_EVENTS = "node-run-events"
QUEUE_MODEL_CALLBACKS = "model-callbacks"
QUEUE_RETURN_TICKETS = "return-tickets"


def gate_wait_status(stage_no: int, review_step_no: int | None = None) -> EpisodeVersionStatus:
    if stage_no == 4 and review_step_no is not None:
        mapping = {
            1: EpisodeVersionStatus.WAIT_REVIEW_STAGE_4_STEP_1,
            2: EpisodeVersionStatus.WAIT_REVIEW_STAGE_4_STEP_2,
            3: EpisodeVersionStatus.WAIT_REVIEW_STAGE_4_STEP_3,
        }
        try:
            return mapping[review_step_no]
        except KeyError as exc:
            raise ValueError(f"unsupported stage 4 review step: {review_step_no}") from exc

    mapping = {
        1: EpisodeVersionStatus.WAIT_REVIEW_STAGE_1,
        2: EpisodeVersionStatus.WAIT_REVIEW_STAGE_2,
        3: EpisodeVersionStatus.WAIT_REVIEW_STAGE_3,
        4: EpisodeVersionStatus.WAIT_REVIEW_STAGE_4,
    }
    try:
        return mapping[stage_no]
    except KeyError as exc:
        raise ValueError(f"unsupported stage: {stage_no}") from exc


def gate_approved_status(stage_no: int) -> EpisodeVersionStatus:
    mapping = {
        1: EpisodeVersionStatus.APPROVED_STAGE_1,
        2: EpisodeVersionStatus.APPROVED_STAGE_2,
        3: EpisodeVersionStatus.APPROVED_STAGE_3,
        4: EpisodeVersionStatus.APPROVED_STAGE_4,
    }
    try:
        return mapping[stage_no]
    except KeyError as exc:
        raise ValueError(f"unsupported stage: {stage_no}") from exc
