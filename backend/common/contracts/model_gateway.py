from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")


@dataclass(slots=True)
class ModelExecutionRequest:
    node_id: str
    episode_version_id: str
    input_ref: str | None
    scope_hash: str
    provider: str
    endpoint: str
    model_profile: str | None
    workflow_id: str | None
    idempotency_key: str
    callback_queue: str
    callback_topic: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ModelExecutionResult:
    job_id: str
    status: str
    provider: str
    endpoint: str
    submitted_at: str
    request: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class ModelCallbackPayload:
    job_id: str
    node_id: str
    episode_version_id: str
    status: str
    output_ref: str | None
    error_code: str | None = None
    error_message: str | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    callback_topic: str = "model_callback"
    callback_at: str = field(default_factory=utc_now_iso)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
