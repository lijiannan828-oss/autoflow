"""Context assembly helpers — bridge between DB/TOS and PipelineState.

These utilities load and hydrate the three-layer context model defined in
``schema-contracts.md`` (Appendix B):

- ``EpisodeContext`` — frozen after N05, contains parsed script, character
  registry, global quality policy, etc.
- ``RunContext`` — per-run dynamic data (node statuses, costs, model jobs).
- ``ShotContext`` — per-shot working state (candidates, quality scores).

Envelope builders conform to ``schema-contracts.md`` §A.6–A.7:
``NodeInputEnvelope<TPayload>`` and ``NodeOutputEnvelope<TPayload>``.
"""

from __future__ import annotations

import logging
from typing import Any

try:
    from backend.common.db import fetch_one
except ImportError:
    fetch_one = None  # type: ignore[assignment]

from .state import PipelineState
from .topology import NODE_DEPENDS_ON, STAGE_GROUP

logger = logging.getLogger(__name__)


def load_episode_context(state: PipelineState) -> dict[str, Any]:
    """Load the full EpisodeContext for the current episode_version.

    In production this reads from DB + TOS.  Returns a dict matching
    the ``EpisodeContext`` interface from schema-contracts.md §B.2.
    """
    ref = state.get("episode_context_ref")
    if ref:
        return _load_from_ref(ref)

    episode_version_id = state.get("episode_version_id")
    if not episode_version_id:
        logger.warning("load_episode_context: no episode_version_id in state")
        return {}

    return _load_episode_context_from_db(episode_version_id)


def build_node_input_envelope(
    node_id: str,
    state: PipelineState,
    *,
    payload: Any = None,
    shot_id: str | None = None,
    artifact_inputs: list[dict[str, Any]] | None = None,
    episode_ctx: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Assemble a ``NodeInputEnvelope<TPayload>`` per schema-contracts.md §A.6.

    All fields align with the canonical interface::

        interface NodeInputEnvelope<TPayload> extends SchemaMeta {
            node_id, episode_id, episode_version_id, run_id,
            shot_id?, payload, context_refs, artifact_inputs?
        }
    """
    upstream_refs = _resolve_upstream_artifacts(node_id, state)

    return {
        "schema_meta": {"version": "1.0", "type": "NodeInputEnvelope"},
        "node_id": node_id,
        "episode_id": state.get("episode_id", ""),
        "episode_version_id": state.get("episode_version_id", ""),
        "run_id": state.get("run_id", ""),
        "shot_id": shot_id,
        "payload": payload,
        "context_refs": {
            "episode_context_id": state.get("episode_context_ref"),
            "run_context_id": state.get("run_id"),
            "shot_context_id": shot_id,
        },
        "artifact_inputs": artifact_inputs or upstream_refs,
    }


def build_node_output_envelope(
    node_id: str,
    state: PipelineState,
    *,
    status: str = "succeeded",
    payload: Any = None,
    shot_id: str | None = None,
    artifact_outputs: list[dict[str, Any]] | None = None,
    duration_s: float = 0.0,
    cost_cny: float = 0.0,
    gpu_seconds: float = 0.0,
    token_in: int = 0,
    token_out: int = 0,
    quality_score: float | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> dict[str, Any]:
    """Build a ``NodeOutputEnvelope<TPayload>`` per schema-contracts.md §A.7.

    All fields align with the canonical interface::

        interface NodeOutputEnvelope<TPayload> extends SchemaMeta {
            node_id, episode_id, episode_version_id, run_id,
            shot_id?, status, payload, artifact_outputs?,
            metrics?, error?
        }
    """
    envelope: dict[str, Any] = {
        "schema_meta": {"version": "1.0", "type": "NodeOutputEnvelope"},
        "node_id": node_id,
        "episode_id": state.get("episode_id", ""),
        "episode_version_id": state.get("episode_version_id", ""),
        "run_id": state.get("run_id", ""),
        "shot_id": shot_id,
        "status": status,
        "payload": payload,
        "artifact_outputs": artifact_outputs or [],
        "metrics": {
            "duration_s": duration_s,
            "cost_cny": cost_cny,
            "gpu_seconds": gpu_seconds,
            "token_in": token_in,
            "token_out": token_out,
            "quality_score": quality_score,
        },
    }

    if error_code or error_message:
        envelope["error"] = {
            "code": error_code or "UNKNOWN",
            "message": error_message or "",
        }

    return envelope


def _resolve_upstream_artifacts(node_id: str, state: PipelineState) -> list[dict[str, Any]]:
    """Build ArtifactRef list from upstream node outputs.

    Shape conforms to schema-contracts.md ``ArtifactRef``::

        { artifact_id?, business_asset_type?, artifact_type, storage,
          anchor_type?, anchor_id?, time_range?, score?, meta_json? }

    In production, real artifact IDs and anchor metadata come from DB
    lookups.  The stub populates the correct shape with placeholder values.
    """
    deps = NODE_DEPENDS_ON.get(node_id, [])
    outputs = state.get("node_outputs", {})
    refs: list[dict[str, Any]] = []
    for dep in deps:
        ref = outputs.get(dep)
        if ref is not None:
            output_url = ref.get("output_ref", "") if isinstance(ref, dict) else str(ref)
            scope = ref.get("scope", "episode") if isinstance(ref, dict) else "episode"
            anchor = "episode_version" if scope == "episode" else (
                "shot" if scope == "per_shot" else "asset"
            )
            object_key = output_url
            uri = output_url
            if "://" in output_url:
                provider = output_url.split("://", 1)[0]
                object_key = output_url.split("://", 1)[1]
            else:
                provider = "tos"
                uri = f"tos://{output_url.lstrip('/')}"
            refs.append({
                "artifact_id": None,
                "business_asset_type": None,
                "artifact_type": "node_output",
                "storage": {
                    "uri": uri,
                    "provider": provider,
                    "bucket": "autoflow-media",
                    "object_key": object_key,
                },
                "anchor_type": anchor,
                "anchor_id": state.get("episode_version_id"),
                "time_range": None,
                "score": None,
                "meta_json": {"source_node_id": dep},
            })
    return refs


# ── DB / TOS loading stubs (replaced in production) ────────────────────
#
# 注入方式：在应用启动时调用 set_context_loader(real_loader)
#
# real_loader 签名：
#     def loader(*, ref: str | None = None,
#                episode_version_id: str | None = None) -> dict[str, Any]
#
# 职责：根据 TOS ref URL 或 episode_version_id 从数据库 / TOS
#       加载完整的 EpisodeContext（剧本结构、角色表、质量策略等）。
#       返回值需符合 schema-contracts.md §B.2 的 EpisodeContext 接口。
#
# 推荐注入时机：
#     - compile_pipeline() 之前（或 FastAPI/Celery 启动时）
#     - 同时注入 gates.set_review_task_creator() 用于真实审核任务创建

_context_loader: Any = None


def set_context_loader(fn: Any) -> None:
    """Inject a production context loader (DB + TOS reads)."""
    global _context_loader
    _context_loader = fn


def _load_from_ref(ref: str) -> dict[str, Any]:
    if _context_loader is not None:
        return _context_loader(ref=ref)
    logger.debug("stub: loading episode context from ref=%s", ref)
    return {"_ref": ref, "_stub": True}


def _load_episode_context_from_db(episode_version_id: str) -> dict[str, Any]:
    if _context_loader is not None:
        return _context_loader(episode_version_id=episode_version_id)
    logger.debug("stub: loading episode context for ev=%s", episode_version_id)
    return {"episode_version_id": episode_version_id, "_stub": True}


def load_node_output_payload(
    source_node_id: str,
    state: PipelineState,
    *,
    default: Any = None,
) -> Any:
    """Resolve a prior node's structured payload from cache or artifacts meta."""
    ref = (state.get("node_outputs") or {}).get(source_node_id)
    if not ref:
        return default

    output_ref = ref.get("output_ref") if isinstance(ref, dict) else None
    node_run_id = ref.get("node_run_id") if isinstance(ref, dict) else None

    if output_ref:
        from .workers import get_cached_output_payload

        cached = get_cached_output_payload(str(output_ref))
        if cached is not None:
            return cached

    if not node_run_id:
        return default

    try:
        row = fetch_one(
            """
            select meta_json
            from core_pipeline.artifacts
            where node_run_id::text = %s
            order by created_at desc
            limit 1
            """,
            (str(node_run_id),),
        )
    except Exception as exc:
        logger.debug("load_node_output_payload db lookup skipped for %s: %s", source_node_id, exc)
        return default

    if not row:
        return default

    meta = row.get("meta_json") or {}
    if isinstance(meta, dict):
        if meta.get("output_payload") is not None:
            return meta["output_payload"]
        envelope = meta.get("output_envelope")
        if isinstance(envelope, dict) and "payload" in envelope:
            return envelope["payload"]
    return default
