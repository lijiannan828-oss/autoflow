"""Production runtime hooks for LangGraph integration.

Round 9 moves graph runtime from development stubs to real business truth
sources:
- EpisodeContext loading from existing artifacts / DB truth source
- ReviewTask creation backed by ``public.review_tasks``
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid5

from psycopg.types.json import Jsonb

from backend.common.db import fetch_all, fetch_one, get_connection
from backend.orchestrator.statuses import gate_wait_status

from .context import load_episode_context, load_node_output_payload

from backend.common.contracts.payload_schemas import (
    enrich_stage1_payload,
    enrich_stage2_payload,
    enrich_stage3_payload,
    enrich_stage4_payload,
)

_RUNTIME_NAMESPACE = UUID("f540b5c5-c432-4ea0-9365-1806e2b9ceaa")


def production_context_loader(
    *,
    ref: str | None = None,
    episode_version_id: str | None = None,
) -> dict[str, Any]:
    """Load a production-shaped EpisodeContext from DB truth sources."""
    if ref:
        artifact = fetch_one(
            """
            select
                a.id::text as artifact_id,
                a.episode_version_id::text as episode_version_id,
                a.resource_url,
                a.meta_json,
                nr.node_id
            from core_pipeline.artifacts a
            left join core_pipeline.node_runs nr on nr.id = a.node_run_id
            where a.resource_url = %s
            order by a.created_at desc
            limit 1
            """,
            (ref,),
        )
        if artifact:
            return _build_episode_context_from_artifact(artifact)

    if episode_version_id:
        artifact = fetch_one(
            """
            select
                a.id::text as artifact_id,
                a.episode_version_id::text as episode_version_id,
                a.resource_url,
                a.meta_json,
                nr.node_id
            from core_pipeline.artifacts a
            left join core_pipeline.node_runs nr on nr.id = a.node_run_id
            where a.episode_version_id::text = %s
              and a.artifact_type = 'storyboard'
              and nr.node_id in ('N01', 'N04')
            order by a.created_at desc
            limit 1
            """,
            (episode_version_id,),
        )
        if artifact:
            return _build_episode_context_from_artifact(artifact)

    return {
        "episode_version_id": episode_version_id,
        "parsed_script": {},
        "_production_loader": True,
        "_missing": True,
    }


def production_review_task_creator(
    *,
    gate_node_id: str,
    stage_no: int,
    episode_id: str,
    episode_version_id: str,
    step: dict[str, Any],
    scope: str,
    state: dict[str, Any],
) -> list[str]:
    """Create real review task rows for a gate entry."""
    scope_records = _resolve_scope_records(
        gate_node_id=gate_node_id,
        episode_id=episode_id,
        episode_version_id=episode_version_id,
        scope=scope,
        state=state,
        step=step,
    )
    role_to_user = _resolve_assignee_ids()
    task_ids: list[str] = []
    now = datetime.now(UTC)
    wait_status = str(gate_wait_status(stage_no, int(step["step_no"])))

    with get_connection() as connection, connection.cursor() as cursor:
        for index, scope_record in enumerate(scope_records):
            task_id = str(scope_record["task_id"])
            payload = {
                "source": "langgraph-runtime",
                "run_id": state.get("run_id"),
                "thread_id": state.get("langgraph_thread_id"),
                "gate_node_id": gate_node_id,
                "scope": scope,
                "scope_id": scope_record["scope_id"],
                "scope_anchor_type": scope_record["anchor_type"],
                "scope_anchor_id": str(scope_record["anchor_id"]),
                "upstream_node_run_id": scope_record.get("upstream_node_run_id"),
                "scope_meta": scope_record.get("scope_meta") or {},
            }
            # Enrich with content from upstream node outputs
            payload = _enrich_payload_for_gate(
                gate_node_id, payload, state, step,
                scope_meta=scope_record.get("scope_meta"),
            )
            cursor.execute(
                """
                insert into public.review_tasks (
                    id,
                    episode_id,
                    episode_version_id,
                    stage_no,
                    gate_node_id,
                    review_step_no,
                    reviewer_role,
                    review_granularity,
                    anchor_type,
                    anchor_id,
                    status,
                    assignee_id,
                    due_at,
                    priority,
                    openclaw_session_id,
                    payload_json,
                    started_at,
                    finished_at,
                    decision,
                    decision_comment,
                    created_at,
                    updated_at
                ) values (
                    %s, %s::uuid, %s::uuid, %s, %s, %s,
                    %s::public.reviewer_role, %s::public.review_granularity,
                    %s::public.anchor_type, %s::uuid,
                    'pending', %s::uuid, %s, %s, null, %s,
                    null, null, null, null, %s, %s
                )
                on conflict (id) do update set
                    status = 'pending',
                    reviewer_role = excluded.reviewer_role,
                    review_granularity = excluded.review_granularity,
                    anchor_type = excluded.anchor_type,
                    anchor_id = excluded.anchor_id,
                    assignee_id = excluded.assignee_id,
                    due_at = excluded.due_at,
                    priority = excluded.priority,
                    payload_json = excluded.payload_json,
                    started_at = null,
                    finished_at = null,
                    decision = null,
                    decision_comment = null,
                    updated_at = excluded.updated_at
                """,
                (
                    task_id,
                    episode_id,
                    episode_version_id,
                    stage_no,
                    gate_node_id,
                    int(step["step_no"]),
                    str(step["reviewer_role"]),
                    str(step["granularity"]),
                    str(scope_record["anchor_type"]),
                    str(scope_record["anchor_id"]),
                    role_to_user.get(str(step["reviewer_role"])),
                    now + timedelta(hours=4),
                    "P1" if index == 0 else "P2",
                    Jsonb(payload),
                    now,
                    now,
                ),
            )
            task_ids.append(task_id)

        cursor.execute(
            """
            update public.episode_versions
            set status = %s,
                run_id = %s::uuid,
                updated_at = %s
            where id::text = %s
            """,
            (wait_status, state.get("run_id"), now, episode_version_id),
        )
        connection.commit()

    return task_ids


def _enrich_payload_for_gate(
    gate_node_id: str,
    base_payload: dict[str, Any],
    state: dict[str, Any],
    step: dict[str, Any],
    *,
    scope_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Enrich payload_json with content from upstream node outputs.

    This bridges the gap between runtime metadata (always written) and
    content fields that frontend review-adapters.ts expects.
    """
    try:
        episode_ctx = load_episode_context(state) if state.get("episode_version_id") else None
    except Exception:
        episode_ctx = None

    if gate_node_id == "N08":
        upstream = load_node_output_payload("N07", state, default=None)
        # v2.2: N08 also receives voice candidates from N07b (parallel branch)
        voice_upstream = load_node_output_payload("N07b", state, default=None)
        if voice_upstream and isinstance(voice_upstream, dict):
            base_payload["voice_candidates"] = voice_upstream.get("voice_candidates", [])
            base_payload["voice_model"] = voice_upstream.get("model", "cosyvoice3")
        return enrich_stage1_payload(base_payload, upstream_output=upstream, episode_ctx=episode_ctx)

    if gate_node_id == "N18":
        upstream = load_node_output_payload("N17", state, default=None)
        return enrich_stage2_payload(base_payload, upstream_output=upstream, scope_meta=scope_meta)

    if gate_node_id == "N21":
        upstream = load_node_output_payload("N20", state, default=None)
        return enrich_stage3_payload(base_payload, upstream_output=upstream, episode_ctx=episode_ctx)

    if gate_node_id == "N24":
        upstream = load_node_output_payload("N23", state, default=None)
        return enrich_stage4_payload(base_payload, upstream_output=upstream, step=step, episode_ctx=episode_ctx)

    return base_payload


def _build_episode_context_from_artifact(artifact: dict[str, Any]) -> dict[str, Any]:
    meta = artifact.get("meta_json") or {}
    payload = {}
    if isinstance(meta, dict):
        payload = dict(meta.get("output_payload") or {})
        if not payload and isinstance(meta.get("output_envelope"), dict):
            payload = dict(meta["output_envelope"].get("payload") or {})

    version = fetch_one(
        """
        select
            ev.id::text as episode_version_id,
            ev.episode_id::text as episode_id,
            ev.version_no,
            e.title as episode_title,
            e.project_name,
            p.id::text as project_id,
            p.name as project_name_real,
            p.meta_json as project_meta_json,
            p.description as project_description
        from public.episode_versions ev
        left join public.episodes e on e.id = ev.episode_id::text
        left join public.projects p on p.name = e.project_name
        where ev.id::text = %s
        limit 1
        """,
        (artifact["episode_version_id"],),
    ) or {}

    return {
        "episode_version_id": artifact.get("episode_version_id"),
        "episode_id": version.get("episode_id"),
        "project_id": version.get("project_id"),
        "project_name": version.get("project_name_real") or version.get("project_name"),
        "episode_title": version.get("episode_title"),
        "project_meta_json": version.get("project_meta_json") or {},
        "project_description": version.get("project_description"),
        "source_artifact_id": artifact.get("artifact_id"),
        "source_ref": artifact.get("resource_url"),
        "source_node_id": artifact.get("node_id"),
        "parsed_script": payload,
        "_production_loader": True,
    }


def _resolve_scope_records(
    *,
    gate_node_id: str,
    episode_id: str,
    episode_version_id: str,
    scope: str,
    state: dict[str, Any],
    step: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if gate_node_id == "N08":
        anchor_id = _coerce_or_derive_uuid(
            state.get("episode_context_ref"),
            seed=f"{episode_version_id}:{gate_node_id}:asset:1",
        )
        upstream_node_run_id = ((state.get("node_outputs") or {}).get("N07") or {}).get("node_run_id")
        # v2.2: include N07b (voice samples) upstream reference
        voice_node_run_id = ((state.get("node_outputs") or {}).get("N07b") or {}).get("node_run_id")
        scope_meta: dict[str, Any] = {}
        if voice_node_run_id:
            scope_meta["voice_node_run_id"] = voice_node_run_id
        return [
            {
                "task_id": uuid5(_RUNTIME_NAMESPACE, f"{episode_version_id}:{gate_node_id}:task:1"),
                "scope_id": f"stage1-asset-{anchor_id}",
                "anchor_type": "asset",
                "anchor_id": anchor_id,
                "upstream_node_run_id": upstream_node_run_id,
                "scope_meta": scope_meta,
            }
        ]

    if gate_node_id == "N18":
        upstream_node_run_id = ((state.get("node_outputs") or {}).get("N17") or {}).get("node_run_id")
        shot_records = _resolve_stage2_shot_records(
            episode_version_id=episode_version_id,
            state=state,
        )
        if shot_records:
            return [
                {
                    "task_id": uuid5(
                        _RUNTIME_NAMESPACE,
                        f"{episode_version_id}:{gate_node_id}:task:{shot['scope_id']}",
                    ),
                    "scope_id": shot["scope_id"],
                    "anchor_type": "shot",
                    "anchor_id": shot["anchor_id"],
                    "upstream_node_run_id": upstream_node_run_id,
                    "scope_meta": shot["scope_meta"],
                }
                for shot in shot_records
            ]

        anchor_id = _coerce_or_derive_uuid(
            state.get("episode_id") or episode_id,
            seed=f"{episode_version_id}:{gate_node_id}:shot:fallback",
        )
        return [
            {
                "task_id": uuid5(_RUNTIME_NAMESPACE, f"{episode_version_id}:{gate_node_id}:task:fallback"),
                "scope_id": f"stage2-shot-{anchor_id}",
                "anchor_type": "shot",
                "anchor_id": anchor_id,
                "upstream_node_run_id": upstream_node_run_id,
                "scope_meta": {"fallback": True},
            }
        ]

    if gate_node_id == "N21":
        upstream_node_run_id = ((state.get("node_outputs") or {}).get("N20") or {}).get("node_run_id")
        anchor_id = _coerce_or_derive_uuid(
            episode_version_id,
            seed=f"{episode_version_id}:{gate_node_id}:episode",
        )
        return [
            {
                "task_id": uuid5(_RUNTIME_NAMESPACE, f"{episode_version_id}:{gate_node_id}:task:episode"),
                "scope_id": f"stage3-episode-{episode_version_id}",
                "anchor_type": "asset",
                "anchor_id": anchor_id,
                "upstream_node_run_id": upstream_node_run_id,
                "scope_meta": {
                    "episode_version_id": episode_version_id,
                    "episode_id": episode_id,
                },
            }
        ]

    if gate_node_id == "N24":
        step_no = int((step or {}).get("step_no", 1))
        upstream_node_run_id = ((state.get("node_outputs") or {}).get("N23") or {}).get("node_run_id")
        anchor_id = _coerce_or_derive_uuid(
            episode_version_id,
            seed=f"{episode_version_id}:{gate_node_id}:episode",
        )
        return [
            {
                "task_id": uuid5(
                    _RUNTIME_NAMESPACE,
                    f"{episode_version_id}:{gate_node_id}:task:step{step_no}",
                ),
                "scope_id": f"stage4-episode-step{step_no}-{episode_version_id}",
                "anchor_type": "asset",
                "anchor_id": anchor_id,
                "upstream_node_run_id": upstream_node_run_id,
                "scope_meta": {
                    "episode_version_id": episode_version_id,
                    "episode_id": episode_id,
                    "step_no": step_no,
                },
            }
        ]

    anchor_id = _coerce_or_derive_uuid(episode_id, seed=f"{episode_version_id}:{gate_node_id}:episode")
    return [
        {
            "task_id": uuid5(_RUNTIME_NAMESPACE, f"{episode_version_id}:{gate_node_id}:task:episode"),
            "scope_id": f"{scope}-{anchor_id}",
            "anchor_type": "asset",
            "anchor_id": anchor_id,
            "upstream_node_run_id": None,
        }
    ]


def _resolve_assignee_ids() -> dict[str, str]:
    users = fetch_all("select id::text as id, role from public.users order by created_at asc")
    mapping: dict[str, str] = {}
    for user in users:
        if user["role"] == "qc" and "qc_inspector" not in mapping:
            mapping["qc_inspector"] = user["id"]
        if user["role"] in {"platform_editor", "admin"} and "middle_platform" not in mapping:
            mapping["middle_platform"] = user["id"]
        if user["role"] == "partner_reviewer" and "partner" not in mapping:
            mapping["partner"] = user["id"]
    return mapping


def _resolve_stage2_shot_records(*, episode_version_id: str, state: dict[str, Any]) -> list[dict[str, Any]]:
    episode_script = load_node_output_payload("N02", state, default=None)
    if not isinstance(episode_script, dict):
        return []

    records: list[dict[str, Any]] = []
    for scene in episode_script.get("scenes") or []:
        if not isinstance(scene, dict):
            continue
        scene_id = str(scene.get("scene_id") or "")
        scene_number = scene.get("scene_number")
        for shot in scene.get("shots") or []:
            if not isinstance(shot, dict):
                continue
            shot_id = str(shot.get("shot_id") or "").strip()
            if not shot_id:
                continue
            records.append(
                {
                    "scope_id": shot_id,
                    "anchor_id": _coerce_or_derive_uuid(
                        shot_id,
                        seed=f"{episode_version_id}:shot:{shot_id}",
                    ),
                    "scope_meta": {
                        "shot_id": shot_id,
                        "scene_id": scene_id,
                        "scene_number": scene_number,
                        "shot_number": shot.get("shot_number"),
                        "global_shot_index": shot.get("global_shot_index"),
                    },
                }
            )
    return records


def _coerce_or_derive_uuid(value: Any, *, seed: str) -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError):
        return uuid5(_RUNTIME_NAMESPACE, seed)
