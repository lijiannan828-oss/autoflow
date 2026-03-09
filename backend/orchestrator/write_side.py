from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4, uuid5

from psycopg.types.json import Jsonb

from backend.common.contracts.model_gateway import ModelCallbackPayload
from backend.common.contracts.serialization import to_jsonable
from backend.common.db import fetch_all, fetch_one, get_connection
from backend.orchestrator.model_gateway import (
    apply_model_callback,
    preview_execution_route,
    submit_node_run_for_model,
)
from backend.orchestrator.statuses import (
    EpisodeVersionStatus,
    STAGE4_REVIEWER_ROLE_BY_STEP,
    gate_approved_status,
    gate_wait_status,
)
from backend.rerun.contracts import EpisodeVersionSnapshot, ReturnTicketRecord
from backend.rerun.planner import MinimalRerunPlanner

from .dev_seed import (
    ROUND6_NAMESPACE,
    ROUND7_NAMESPACE,
    SEED_NAMESPACE,
    STAGE_TO_GATE_NODE,
    STAGE_TO_ROOT_CAUSE_NODE,
    seed_node_registry,
    seed_round6_artifact_fixture,
    seed_runtime_fixture,
)

_RUNTIME_NAMESPACE = UUID("f540b5c5-c432-4ea0-9365-1806e2b9ceaa")

AUTO_QC_STAGE_BY_NODE: dict[str, int] = {
    "N03": 1,
    "N11": 2,
    "N15": 2,
}


def utc_now() -> datetime:
    return datetime.now(tz=UTC)


def _iso_now() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")


def _stage_no_from_node_id(node_id: str | None) -> int | None:
    if not node_id or not node_id.startswith("N"):
        return None
    try:
        node_no = int(node_id[1:])
    except ValueError:
        return None
    if 1 <= node_no <= 8:
        return 1
    if 9 <= node_no <= 18:
        return 2
    if 19 <= node_no <= 21:
        return 3
    if 22 <= node_no <= 26:
        return 4
    return None


def seed_round4_demo() -> dict[str, Any]:
    registry = seed_node_registry()
    runtime = seed_runtime_fixture()
    return to_jsonable({"registry": registry, "runtime": runtime})


def seed_round6_demo() -> dict[str, Any]:
    round4 = seed_round4_demo()
    artifacts = seed_round6_artifact_fixture()
    auto_qc = seed_round6_auto_qc_demo()
    model_gateway_preview = preview_execution_route(["N09", "N14", "N20"])
    return to_jsonable(
        {
            "round4": round4,
            "artifacts": artifacts,
            "auto_qc": auto_qc,
            "model_gateway_preview": model_gateway_preview,
        }
    )


def _ensure_round7_model_node_run() -> str:
    run = fetch_one(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id
        from core_pipeline.runs
        where plan_json ->> 'seed_key' = %s
        limit 1
        """,
        (f"{SEED_NAMESPACE}:rerun_run",),
    )
    if run is None:
        raise RuntimeError("round4 rerun_run seed is required before round7 model gateway demo")

    now = utc_now()
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            insert into core_pipeline.node_runs (
                id,
                run_id,
                episode_version_id,
                node_id,
                status,
                attempt_no,
                retry_count,
                input_ref,
                output_ref,
                model_provider,
                api_calls,
                token_in,
                token_out,
                gpu_seconds,
                cost_cny,
                error_code,
                error_message,
                tags,
                started_at,
                ended_at,
                duration_s,
                created_at,
                updated_at,
                agent_role,
                auto_reject_count,
                scope_hash,
                model_endpoint,
                comfyui_workflow_id,
                rag_query_count,
                quality_score
            ) values (
                %s, %s, %s, 'N14', 'pending', 1, 0, %s, null, null, 0, 0, 0, 0, 0, null, null, %s,
                null, null, null, %s, %s, 'visual_director', 0, %s, null, 'wf-video-generate', 0, null
            )
            on conflict (run_id, node_id, attempt_no) do update set
                status = 'pending',
                input_ref = excluded.input_ref,
                output_ref = null,
                model_provider = null,
                error_code = null,
                error_message = null,
                tags = excluded.tags,
                started_at = null,
                ended_at = null,
                duration_s = null,
                updated_at = excluded.updated_at,
                scope_hash = excluded.scope_hash,
                model_endpoint = null,
                comfyui_workflow_id = excluded.comfyui_workflow_id,
                quality_score = null,
                gpu_seconds = 0,
                cost_cny = 0
            returning id::text as id
            """,
            (
                str(uuid4()),
                run["id"],
                run["episode_version_id"],
                f"tos://autoflow-media/{run['episode_version_id']}/N14/input.json",
                Jsonb([SEED_NAMESPACE, ROUND7_NAMESPACE, "model_gateway"]),
                now,
                now,
                f"{ROUND7_NAMESPACE}:{run['id']}:N14",
            ),
        )
        node_run_id = cursor.fetchone()["id"]
        connection.commit()
    return node_run_id


def seed_round7_demo() -> dict[str, Any]:
    round6 = seed_round6_demo()
    node_run_id = _ensure_round7_model_node_run()
    submit_result = submit_node_run_for_model(
        node_run_id,
        seed_namespace=ROUND7_NAMESPACE,
    )
    callback = ModelCallbackPayload(
        job_id=str(submit_result["job_id"]),
        node_id="N14",
        episode_version_id=str(submit_result["request"]["episode_version_id"]),
        status="succeeded",
        output_ref=f"tos://autoflow-media/{submit_result['request']['episode_version_id']}/N14/generated.mp4",
        metrics={
            "duration_s": 180,
            "gpu_seconds": 32.5,
            "cost_cny": 2.6,
            "quality_score": 0.91,
        },
        callback_topic=str(submit_result["request"]["callback_topic"]),
    )
    callback_result = apply_model_callback(callback)
    return to_jsonable(
        {
            "round6": round6,
            "model_submit": submit_result,
            "model_callback": callback_result,
        }
    )


def submit_model_job(
    node_run_id: str,
    *,
    overrides: dict[str, Any] | None = None,
    seed_namespace: str | None = None,
) -> dict[str, Any]:
    return to_jsonable(
        submit_node_run_for_model(
            node_run_id,
            overrides=overrides,
            seed_namespace=seed_namespace,
        )
    )


def apply_model_job_callback(
    job_id: str,
    *,
    status: str,
    output_ref: str | None,
    error_code: str | None = None,
    error_message: str | None = None,
    metrics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    job = fetch_one(
        """
        select request_payload
        from model_jobs
        where job_id = %s
        limit 1
        """,
        (job_id,),
    )
    if job is None:
        raise ValueError(f"model job not found: {job_id}")
    request_payload = dict(job.get("request_payload") or {})
    callback = ModelCallbackPayload(
        job_id=job_id,
        node_id=str(request_payload.get("node_id") or "unknown"),
        episode_version_id=str(request_payload.get("episode_version_id") or "unknown"),
        status=status,
        output_ref=output_ref,
        error_code=error_code,
        error_message=error_message,
        metrics=metrics or {},
        callback_topic=str(request_payload.get("callback_topic") or "model_callback"),
    )
    return to_jsonable(apply_model_callback(callback))


def _fetch_review_task(task_id: str) -> dict[str, Any]:
    task = fetch_one(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id,
            stage_no,
            gate_node_id,
            review_step_no,
            reviewer_role::text as reviewer_role,
            review_granularity::text as review_granularity,
            anchor_type::text as anchor_type,
            anchor_id::text as anchor_id,
            status,
            assignee_id::text as assignee_id,
            priority,
            openclaw_session_id,
            payload_json,
            started_at,
            finished_at,
            decision,
            decision_comment,
            created_at,
            updated_at
        from public.review_tasks
        where id::text = %s
        limit 1
        """,
        (task_id,),
    )
    if task is None:
        raise ValueError(f"review task not found: {task_id}")
    return task


def _load_stage_tasks(episode_version_id: str, stage_no: int) -> list[dict[str, Any]]:
    return fetch_all(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id,
            stage_no,
            gate_node_id,
            review_step_no,
            reviewer_role::text as reviewer_role,
            review_granularity::text as review_granularity,
            anchor_type::text as anchor_type,
            anchor_id::text as anchor_id,
            status,
            assignee_id::text as assignee_id,
            priority,
            openclaw_session_id,
            payload_json,
            started_at,
            finished_at,
            decision,
            decision_comment,
            created_at,
            updated_at
        from public.review_tasks
        where episode_version_id::text = %s and stage_no = %s
        order by review_step_no asc, created_at asc
        """,
        (episode_version_id, stage_no),
    )


def _snapshot_from_stage_tasks(episode_version_id: str, stage_no: int) -> dict[str, Any]:
    tasks = _load_stage_tasks(episode_version_id, stage_no)
    if not tasks:
        return {
            "episode_version_id": episode_version_id,
            "gate_node_id": STAGE_TO_GATE_NODE[stage_no],
            "approved_count": 0,
            "returned_count": 0,
            "pending_count": 0,
            "total_count": 0,
            "all_approved": False,
            "steps": [],
            "current_step_no": None,
            "total_steps": None,
        }

    approved_count = sum(task["status"] == "approved" for task in tasks)
    returned_count = sum(task["status"] == "returned" for task in tasks)
    pending_count = sum(task["status"] in {"pending", "in_progress"} for task in tasks)

    if stage_no != 4:
        return {
            "episode_version_id": episode_version_id,
            "gate_node_id": STAGE_TO_GATE_NODE[stage_no],
            "approved_count": approved_count,
            "returned_count": returned_count,
            "pending_count": pending_count,
            "total_count": len(tasks),
            "all_approved": len(tasks) > 0 and approved_count == len(tasks),
            "steps": [],
            "current_step_no": 1,
            "total_steps": 1,
        }

    task_by_step = {int(task["review_step_no"]): task for task in tasks}
    steps: list[dict[str, Any]] = []
    current_step_no = 3
    for step_no in (1, 2, 3):
        task = task_by_step.get(step_no)
        status = task["status"] if task else None
        steps.append(
            {
                "step_no": step_no,
                "reviewer_role": STAGE4_REVIEWER_ROLE_BY_STEP[step_no],
                "status": status,
            }
        )
        if status in {None, "pending", "in_progress"} and current_step_no == 3:
            current_step_no = step_no

    return {
        "episode_version_id": episode_version_id,
        "gate_node_id": "N24",
        "approved_count": approved_count,
        "returned_count": returned_count,
        "pending_count": pending_count,
        "total_count": 3,
        "all_approved": approved_count == 3 and returned_count == 0,
        "steps": steps,
        "current_step_no": current_step_no,
        "total_steps": 3,
    }


def _find_resumable_run(task: dict[str, Any]) -> dict[str, Any] | None:
    payload = dict(task.get("payload_json") or {})
    run_id = payload.get("run_id")
    thread_id = payload.get("thread_id")
    if run_id and thread_id:
        return {"run_id": str(run_id), "thread_id": str(thread_id)}

    return fetch_one(
        """
        select id::text as run_id, langgraph_thread_id as thread_id
        from core_pipeline.runs
        where episode_version_id::text = %s
          and langgraph_thread_id is not null
        order by updated_at desc
        limit 1
        """,
        (task["episode_version_id"],),
    )


def _task_scope_status(task_row: dict[str, Any]) -> str:
    status = str(task_row.get("status") or "pending")
    if status == "approved":
        return "approved"
    if status == "returned":
        return "returned"
    if status == "skipped":
        return "approved"
    return "pending"


def _task_scope_id(task_row: dict[str, Any]) -> str:
    payload = dict(task_row.get("payload_json") or {})
    return str(payload.get("scope_id") or task_row.get("anchor_id") or task_row.get("id"))


def _build_resume_hint(task: dict[str, Any], *, gate_snapshot: dict[str, Any], return_ticket_id: str | None = None) -> dict[str, Any] | None:
    resumable = _find_resumable_run(task)
    if not resumable:
        return None

    stage_no = int(task["stage_no"])
    gate_node_id = str(task["gate_node_id"])
    stage_tasks = _load_stage_tasks(task["episode_version_id"], stage_no)
    review_task_ids = [str(item["id"]) for item in stage_tasks]

    decision = "returned"
    if gate_snapshot.get("all_approved"):
        decision = "approved"
    elif any(str(item.get("status")) == "returned" for item in stage_tasks):
        decision = "returned"
    else:
        decision = "partial_approved"

    if decision == "partial_approved":
        return None

    scope = "episode"
    scope_items: list[dict[str, Any]] = []
    if stage_no == 1:
        scope = "asset"
        scope_items = [
            {
                "scope_id": _task_scope_id(item),
                "status": _task_scope_status(item),
                "review_task_id": str(item["id"]),
            }
            for item in stage_tasks
        ]
    elif stage_no == 2:
        scope = "shot"
        scope_items = [
            {
                "scope_id": _task_scope_id(item),
                "status": _task_scope_status(item),
                "review_task_id": str(item["id"]),
            }
            for item in stage_tasks
        ]
    elif stage_no == 3:
        scope = "episode"
        scope_items = [
            {
                "scope_id": _task_scope_id(item),
                "status": _task_scope_status(item),
                "review_task_id": str(item["id"]),
            }
            for item in stage_tasks
        ]
    elif stage_no == 4:
        scope = "episode"
        scope_items = [
            {
                "scope_id": _task_scope_id(item),
                "status": _task_scope_status(item),
                "review_task_id": str(item["id"]),
            }
            for item in stage_tasks
        ]

    steps_completed = sorted(
        {
            int(item["review_step_no"])
            for item in stage_tasks
            if str(item.get("status")) in {"approved", "skipped"}
        }
    )

    return {
        "run_id": str(resumable["run_id"]),
        "thread_id": str(resumable["thread_id"]),
        "gate_decision": {
            "gate": {
                "gate_node_id": gate_node_id,
                "stage_no": stage_no,
                "scope": scope,
                "scope_items": scope_items,
                "review_task_ids": review_task_ids,
                "decision": decision,
                "return_ticket_id": return_ticket_id,
                "current_step_no": gate_snapshot.get("current_step_no") or int(task["review_step_no"]),
                "total_steps": gate_snapshot.get("total_steps") or int(task["review_step_no"]),
                "steps_completed": steps_completed,
            }
        },
    }


def _update_run_for_stage_result(cursor: Any, *, episode_version_id: str, stage_no: int, result: str) -> None:
    now = utc_now()
    if result == "returned":
        cursor.execute(
            """
            update core_pipeline.runs
            set status = 'failed',
                current_node_id = %s,
                current_stage_no = %s,
                updated_at = %s
            where episode_version_id::text = %s and (plan_json ->> 'seed_namespace' = %s or plan_json ->> 'seed_key' like %s)
            """,
            (STAGE_TO_GATE_NODE[stage_no], stage_no, now, episode_version_id, SEED_NAMESPACE, f"{SEED_NAMESPACE}%"),
        )
        return

    snapshot = _snapshot_from_stage_tasks(episode_version_id, stage_no)
    if snapshot["all_approved"]:
        cursor.execute(
            """
            update core_pipeline.runs
            set current_node_id = null,
                current_stage_no = null,
                status = case when status = 'failed' then 'failed' else 'succeeded' end,
                finished_at = coalesce(finished_at, %s),
                updated_at = %s
            where episode_version_id::text = %s and (plan_json ->> 'seed_namespace' = %s or plan_json ->> 'seed_key' like %s)
            """,
            (now, now, episode_version_id, SEED_NAMESPACE, f"{SEED_NAMESPACE}%"),
        )


def _update_episode_version_gate_status(cursor: Any, *, episode_version_id: str, status: str) -> None:
    cursor.execute(
        """
        update public.episode_versions
        set status = %s,
            updated_at = %s
        where id::text = %s
        """,
        (status, utc_now(), episode_version_id),
    )


def _ensure_next_stage4_step(cursor: Any, task: dict[str, Any], next_step_no: int) -> None:
    existing = fetch_one(
        """
        select id::text as id
        from public.review_tasks
        where episode_version_id::text = %s and stage_no = 4 and review_step_no = %s
        limit 1
        """,
        (task["episode_version_id"], next_step_no),
    )
    if existing:
        return

    role_to_user = _resolve_assignee_ids()
    reviewer_role = STAGE4_REVIEWER_ROLE_BY_STEP[next_step_no]
    now = utc_now()
    ev_id = task["episode_version_id"]
    ep_id = task["episode_id"]
    task_id = str(uuid5(_RUNTIME_NAMESPACE, f"{ev_id}:N24:task:step{next_step_no}"))
    scope_id = f"stage4-episode-step{next_step_no}-{ev_id}"
    scope_meta = {"episode_version_id": ev_id, "episode_id": ep_id, "step_no": next_step_no}
    payload = dict(task["payload_json"] or {})
    payload.update(
        {
            "source": "langgraph-runtime",
            "gate_node_id": "N24",
            "scope": "episode",
            "scope_id": scope_id,
            "scope_meta": scope_meta,
        }
    )
    anchor_id = task.get("anchor_id") or ev_id
    anchor_type = task.get("anchor_type") or "asset"
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
            %s, %s, %s, 4, 'N24', %s, %s::public.reviewer_role, 'episode'::public.review_granularity,
            %s::public.anchor_type, %s::uuid, 'pending', %s, %s, %s, null, %s, null, null, null, null, %s, %s
        )
        """,
        (
            task_id,
            ep_id,
            ev_id,
            next_step_no,
            reviewer_role,
            anchor_type,
            anchor_id,
            role_to_user.get(reviewer_role),
            now + timedelta(hours=4),
            task.get("priority") or "P1",
            Jsonb(payload),
            now,
            now,
        ),
    )


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


def _build_version_snapshot(episode_version_id: str) -> EpisodeVersionSnapshot:
    version = fetch_one(
        """
        select id::text as id, episode_id::text as episode_id, version_no, status
        from public.episode_versions
        where id::text = %s
        limit 1
        """,
        (episode_version_id,),
    )
    if version is None:
        raise ValueError(f"episode version not found: {episode_version_id}")

    node_runs = fetch_all(
        """
        select node_id, status
        from core_pipeline.node_runs
        where episode_version_id::text = %s
        """,
        (episode_version_id,),
    )
    return EpisodeVersionSnapshot(
        id=version["id"],
        episode_id=version["episode_id"],
        version_no=int(version["version_no"]),
        status=version["status"],
        node_statuses={item["node_id"]: item["status"] for item in node_runs},
    )


def _fetch_node_run_context(node_run_id: str) -> dict[str, Any]:
    row = fetch_one(
        """
        select
            nr.id::text as id,
            nr.run_id::text as run_id,
            nr.episode_version_id::text as episode_version_id,
            nr.node_id,
            nr.status,
            nr.attempt_no,
            nr.auto_reject_count,
            nr.scope_hash,
            nr.input_ref,
            nr.output_ref,
            nr.quality_score,
            run.episode_id::text as episode_id,
            registry.reject_target_node_id,
            registry.max_auto_rejects
        from core_pipeline.node_runs nr
        join core_pipeline.runs run on run.id = nr.run_id
        left join core_pipeline.node_registry registry on registry.node_id = nr.node_id
        where nr.id::text = %s
        limit 1
        """,
        (node_run_id,),
    )
    if row is None:
        raise ValueError(f"node run not found: {node_run_id}")
    return row


def _upsert_artifact_record(
    cursor: Any,
    *,
    episode_version_id: str,
    node_run_id: str,
    artifact_type: str,
    resource_url: str,
    preview_url: str | None,
    meta_json: dict[str, Any],
) -> str:
    existing = fetch_one(
        """
        select id::text as id
        from core_pipeline.artifacts
        where episode_version_id::text = %s
          and node_run_id::text = %s
          and artifact_type = %s
          and resource_url = %s
        limit 1
        """,
        (episode_version_id, node_run_id, artifact_type, resource_url),
    )
    if existing:
        cursor.execute(
            """
            update core_pipeline.artifacts
            set preview_url = %s,
                meta_json = %s
            where id = %s
            returning id::text as id
            """,
            (preview_url, Jsonb(meta_json), existing["id"]),
        )
        return cursor.fetchone()["id"]

    cursor.execute(
        """
        insert into core_pipeline.artifacts (
            id,
            episode_version_id,
            node_run_id,
            artifact_type,
            anchor_type,
            anchor_id,
            time_range,
            resource_url,
            preview_url,
            meta_json,
            created_at
        ) values (
            %s, %s, %s, %s, 'asset'::public.anchor_type, null, null, %s, %s, %s, %s
        )
        returning id::text as id
        """,
        (
            str(uuid4()),
            episode_version_id,
            node_run_id,
            artifact_type,
            resource_url,
            preview_url,
            Jsonb(meta_json),
            utc_now(),
        ),
    )
    return cursor.fetchone()["id"]


def record_node_run_artifacts(node_run_id: str, artifacts: list[dict[str, Any]]) -> dict[str, Any]:
    node_run = _fetch_node_run_context(node_run_id)
    created_ids: list[str] = []
    with get_connection() as connection, connection.cursor() as cursor:
        for item in artifacts:
            artifact_id = _upsert_artifact_record(
                cursor,
                episode_version_id=node_run["episode_version_id"],
                node_run_id=node_run_id,
                artifact_type=str(item["artifact_type"]),
                resource_url=str(item["resource_url"]),
                preview_url=str(item.get("preview_url")) if item.get("preview_url") else None,
                meta_json={
                    "seed_namespace": item.get("seed_namespace") or ROUND6_NAMESPACE,
                    "node_id": node_run["node_id"],
                    **dict(item.get("meta_json") or {}),
                },
            )
            created_ids.append(artifact_id)
        connection.commit()
    return to_jsonable(
        {
            "node_run_id": node_run_id,
            "episode_version_id": node_run["episode_version_id"],
            "artifact_count": len(created_ids),
            "artifact_ids": created_ids,
        }
    )


def _ensure_round6_auto_qc_node_run() -> str:
    run = fetch_one(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id
        from core_pipeline.runs
        where plan_json ->> 'seed_key' = %s
        limit 1
        """,
        (f"{SEED_NAMESPACE}:rerun_run",),
    )
    if run is None:
        raise RuntimeError("round4 rerun_run seed is required before round6 auto qc demo")

    now = utc_now()
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            insert into core_pipeline.node_runs (
                id,
                run_id,
                episode_version_id,
                node_id,
                status,
                attempt_no,
                retry_count,
                input_ref,
                output_ref,
                model_provider,
                api_calls,
                token_in,
                token_out,
                gpu_seconds,
                cost_cny,
                error_code,
                error_message,
                tags,
                started_at,
                ended_at,
                duration_s,
                created_at,
                updated_at,
                agent_role,
                auto_reject_count,
                scope_hash,
                model_endpoint,
                comfyui_workflow_id,
                rag_query_count,
                quality_score
            ) values (
                %s, %s, %s, 'N15', 'running', 1, 0, %s, null, 'comfyui', 0, 0, 0, 14, 1.1, null, null, %s,
                %s, null, null, %s, %s, 'quality_guardian', 0, %s, 'wf-video-qc', null, 0, null
            )
            on conflict (run_id, node_id, attempt_no) do update set
                input_ref = excluded.input_ref,
                tags = excluded.tags,
                updated_at = excluded.updated_at,
                started_at = excluded.started_at
            returning id::text as id
            """,
            (
                str(uuid4()),
                run["id"],
                run["episode_version_id"],
                f"tos://autoflow-media/{run['episode_version_id']}/N15/input.json",
                Jsonb([SEED_NAMESPACE, ROUND6_NAMESPACE, "auto_qc"]),
                now,
                now,
                now,
                f"{ROUND6_NAMESPACE}:{run['id']}:N15",
            ),
        )
        node_run_id = cursor.fetchone()["id"]
        connection.commit()
    return node_run_id


def auto_reject_node_run(
    node_run_id: str,
    *,
    issue_type: str,
    comment: str,
    severity: str = "major",
    quality_score: float | None = None,
    error_code: str = "auto_qc_reject",
) -> dict[str, Any]:
    node_run = _fetch_node_run_context(node_run_id)
    max_auto_rejects = int(node_run.get("max_auto_rejects") or 3)
    if int(node_run.get("auto_reject_count") or 0) >= max_auto_rejects:
        raise ValueError(f"max_auto_rejects reached for node run {node_run_id}")

    reject_target_node_id = node_run.get("reject_target_node_id")
    if not reject_target_node_id:
        raise ValueError(f"reject_target_node_id missing for node {node_run['node_id']}")

    stage_no = AUTO_QC_STAGE_BY_NODE.get(str(node_run["node_id"]), 1)
    snapshot = _build_version_snapshot(node_run["episode_version_id"])
    ticket_id = str(uuid4())
    ticket = ReturnTicketRecord(
        id=ticket_id,
        episode_id=node_run["episode_id"],
        episode_version_id=node_run["episode_version_id"],
        review_task_id=None,
        source_type="auto_qc",
        source_node_id=node_run["node_id"],
        stage_no=stage_no,
        anchor_type="asset",
        anchor_id=None,
        timestamp_ms=None,
        issue_type=issue_type,
        severity=severity,
        comment=comment,
        created_by_role="system",
        suggested_stage_back=stage_no,
        system_root_cause_node_id=reject_target_node_id,
        rerun_plan_json=None,
        status="open",
        resolved_version_id=None,
        created_at=_iso_now(),
        updated_at=_iso_now(),
    )
    planner = MinimalRerunPlanner()
    rerun_plan = planner.build_plan(ticket, snapshot)
    planned_ticket = planner.attach_plan(ticket, rerun_plan)
    now = utc_now()

    existing_ticket = fetch_one(
        """
        select id::text as id
        from core_pipeline.return_tickets
        where episode_version_id::text = %s
          and source_type = 'auto_qc'
          and source_node_id = %s
          and issue_type = %s
        limit 1
        """,
        (node_run["episode_version_id"], node_run["node_id"], issue_type),
    )

    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            update core_pipeline.node_runs
            set status = 'auto_rejected',
                auto_reject_count = coalesce(auto_reject_count, 0) + 1,
                quality_score = coalesce(%s, quality_score),
                error_code = %s,
                error_message = %s,
                ended_at = coalesce(ended_at, %s),
                duration_s = coalesce(duration_s, 60),
                updated_at = %s
            where id::text = %s
            """,
            (quality_score, error_code, comment, now, now, node_run_id),
        )
        cursor.execute(
            """
            update core_pipeline.runs
            set status = 'failed',
                current_node_id = %s,
                current_stage_no = %s,
                updated_at = %s
            where id::text = %s
            """,
            (reject_target_node_id, stage_no, now, node_run["run_id"]),
        )
        cursor.execute(
            """
            update public.episode_versions
            set auto_reject_count = coalesce(auto_reject_count, 0) + 1,
                updated_at = %s
            where id::text = %s
            """,
            (now, node_run["episode_version_id"]),
        )

        ticket_id_to_use = existing_ticket["id"] if existing_ticket else ticket_id
        rerun_plan_payload = {
            **(planned_ticket.rerun_plan_json or {}),
            "ticket_id": ticket_id_to_use,
            "seed_namespace": ROUND6_NAMESPACE,
        }
        if existing_ticket:
            cursor.execute(
                """
                update core_pipeline.return_tickets
                set stage_no = %s,
                    anchor_type = %s::public.anchor_type,
                    issue_type = %s,
                    severity = %s::public.severity,
                    comment = %s,
                    created_by_role = %s,
                    suggested_stage_back = %s,
                    system_root_cause_node_id = %s,
                    rerun_plan_json = %s,
                    status = 'in_progress',
                    updated_at = %s,
                    review_task_id = null,
                    source_type = 'auto_qc',
                    source_node_id = %s
                where id = %s
                """,
                (
                    stage_no,
                    "asset",
                    planned_ticket.issue_type,
                    planned_ticket.severity,
                    planned_ticket.comment,
                    planned_ticket.created_by_role,
                    str(planned_ticket.suggested_stage_back),
                    planned_ticket.system_root_cause_node_id,
                    Jsonb(rerun_plan_payload),
                    now,
                    planned_ticket.source_node_id,
                    ticket_id_to_use,
                ),
            )
        else:
            cursor.execute(
                """
                insert into core_pipeline.return_tickets (
                    id,
                    episode_id,
                    episode_version_id,
                    stage_no,
                    anchor_type,
                    anchor_id,
                    timestamp_ms,
                    issue_type,
                    severity,
                    comment,
                    created_by_role,
                    suggested_stage_back,
                    system_root_cause_node_id,
                    rerun_plan_json,
                    status,
                    created_at,
                    updated_at,
                    review_task_id,
                    source_type,
                    source_node_id,
                    resolved_version_id
                ) values (
                    %s, %s, %s, %s, %s::public.anchor_type, null, null, %s, %s::public.severity, %s, %s,
                    %s, %s, %s, 'in_progress', %s, %s, null, 'auto_qc', %s, null
                )
                """,
                (
                    ticket_id_to_use,
                    planned_ticket.episode_id,
                    planned_ticket.episode_version_id,
                    stage_no,
                    "asset",
                    planned_ticket.issue_type,
                    planned_ticket.severity,
                    planned_ticket.comment,
                    planned_ticket.created_by_role,
                    str(planned_ticket.suggested_stage_back),
                    planned_ticket.system_root_cause_node_id,
                    Jsonb(rerun_plan_payload),
                    now,
                    now,
                    planned_ticket.source_node_id,
                ),
            )
        connection.commit()

    return to_jsonable(
        {
            "node_run_id": node_run_id,
            "status": "auto_rejected",
            "return_ticket_id": ticket_id_to_use,
            "source_type": "auto_qc",
            "reject_target_node_id": reject_target_node_id,
            "rerun_plan_json": rerun_plan_payload,
        }
    )


def seed_round6_auto_qc_demo() -> dict[str, Any]:
    node_run_id = _ensure_round6_auto_qc_node_run()
    result = auto_reject_node_run(
        node_run_id,
        issue_type="round6_auto_qc",
        comment="round6 auto qc demo rejected N15 and redirected rerun target to N14",
        severity="major",
        quality_score=0.62,
        error_code="physics_check_failed",
    )
    return to_jsonable(result)


def _ensure_rerun_version(cursor: Any, task: dict[str, Any], ticket_id: str) -> str:
    existing = fetch_one(
        """
        select id::text as id
        from public.episode_versions
        where created_by_source = %s
        limit 1
        """,
        (f"{SEED_NAMESPACE}:ticket:{ticket_id}",),
    )
    now = utc_now()
    if existing:
        return existing["id"]

    latest = fetch_one(
        """
        select coalesce(max(version_no), 0) as max_version_no
        from public.episode_versions
        where episode_id::text = %s
        """,
        (task["episode_id"],),
    )
    new_version_no = int(latest["max_version_no"] or 0) + 1
    new_version_id = str(uuid4())
    cursor.execute(
        """
        insert into public.episode_versions (
            id,
            episode_id,
            version_no,
            source_stage,
            status,
            summary_text,
            created_by_source,
            created_at,
            run_id,
            total_duration_s,
            total_cost_cny,
            human_minutes,
            ai_minutes,
            return_count_total,
            return_count_by_stage,
            auto_reject_count,
            first_pass_rate,
            stage_wait_time,
            updated_at
        ) values (
            %s, %s, %s, %s, 'patching', %s, %s, %s, null, 0, 0, 0, 0, 1, %s, 0, 0, %s, %s
        )
        """,
        (
            new_version_id,
            task["episode_id"],
            new_version_no,
            task["stage_no"],
            f"{SEED_NAMESPACE}:v+1 from {ticket_id}",
            f"{SEED_NAMESPACE}:ticket:{ticket_id}",
            now,
            Jsonb({str(task["stage_no"]): 1}),
            Jsonb({}),
            now,
        ),
    )
    return new_version_id


def _ensure_rerun_run(cursor: Any, *, task: dict[str, Any], ticket_id: str, new_version_id: str, root_cause_node_id: str | None) -> str:
    existing = fetch_one(
        """
        select id::text as id
        from core_pipeline.runs
        where rerun_from_ticket_id::text = %s
        limit 1
        """,
        (ticket_id,),
    )
    now = utc_now()
    if existing:
        return existing["id"]

    run_id = str(uuid4())
    current_node_id = root_cause_node_id or STAGE_TO_ROOT_CAUSE_NODE.get(int(task["stage_no"]), "N23")
    cursor.execute(
        """
        insert into core_pipeline.runs (
            id,
            episode_id,
            episode_version_id,
            status,
            current_node_id,
            current_stage_no,
            plan_json,
            started_at,
            finished_at,
            created_at,
            updated_at,
            is_rerun,
            rerun_from_ticket_id,
            langgraph_thread_id
        ) values (
            %s, %s, %s, 'running', %s, %s, %s, %s, null, %s, %s, true, %s, %s
        )
        """,
        (
            run_id,
            task["episode_id"],
            new_version_id,
            current_node_id,
            _stage_no_from_node_id(current_node_id),
            Jsonb({"seed_namespace": SEED_NAMESPACE, "seed_key": f"{SEED_NAMESPACE}:rerun:{ticket_id}", "patch_type": "minimal_rerun"}),
            now,
            now,
            now,
            ticket_id,
            f"lg-rerun-{ticket_id}",
        ),
    )
    cursor.execute(
        """
        insert into core_pipeline.node_runs (
            id,
            run_id,
            episode_version_id,
            node_id,
            status,
            attempt_no,
            retry_count,
            input_ref,
            output_ref,
            model_provider,
            api_calls,
            token_in,
            token_out,
            gpu_seconds,
            cost_cny,
            error_code,
            error_message,
            tags,
            started_at,
            ended_at,
            duration_s,
            created_at,
            updated_at,
            agent_role,
            auto_reject_count,
            scope_hash,
            model_endpoint,
            comfyui_workflow_id,
            rag_query_count,
            quality_score
        ) values (
            %s, %s, %s, %s, 'running', 1, 0, %s, null, 'comfyui', 0, 0, 0, 10, 1.0, null, null, %s,
            %s, null, null, %s, %s, 'director', 0, %s, 'wf-final-compose', null, 0, null
        )
        on conflict (run_id, node_id, attempt_no) do nothing
        """,
        (
            str(uuid4()),
            run_id,
            new_version_id,
            current_node_id,
            f"tos://autoflow-media/{new_version_id}/{current_node_id}/input.json",
            Jsonb([SEED_NAMESPACE, "rerun"]),
            now,
            now,
            now,
            f"{SEED_NAMESPACE}:{run_id}:{current_node_id}",
        ),
    )
    return run_id


def _insert_review_points(cursor: Any, *, task: dict[str, Any], review_points: list[dict[str, Any]], created_by: str | None) -> None:
    if not review_points or not created_by:
        return

    now = utc_now()
    for point in review_points:
        scope = point.get("scope")
        if not scope:
            if task["review_granularity"] == "episode":
                scope = "composite"
            elif task["review_granularity"] == "shot":
                scope = "video"
            else:
                scope = "keyframe"
        anchor_type = point.get("anchor_type") or ("timestamp" if point.get("timestamp_ms") is not None else task["anchor_type"] or "asset")
        anchor_id = point.get("anchor_id") or task["anchor_id"]
        cursor.execute(
            """
            insert into public.review_points (
                id,
                episode_id,
                episode_version_id,
                stage_no,
                timecode_sec,
                scope,
                severity,
                attribution_stage,
                anchor_type,
                anchor_id,
                note,
                created_by,
                created_at,
                review_task_id,
                timestamp_ms,
                issue_type,
                comment,
                screenshot_url,
                updated_at
            ) values (
                %s, %s, %s, %s, %s, %s::public.feedback_scope, %s::public.severity, %s, %s::public.anchor_type, %s,
                %s, %s, %s, %s, %s, %s, %s, null, %s
            )
            """,
            (
                str(uuid4()),
                task["episode_id"],
                task["episode_version_id"],
                task["stage_no"],
                None if point.get("timestamp_ms") is None else point["timestamp_ms"] / 1000,
                scope,
                point.get("severity", "major"),
                str(task["stage_no"]),
                anchor_type,
                anchor_id,
                point.get("comment") or point.get("issue_type") or "review point",
                created_by,
                now,
                task["id"],
                point.get("timestamp_ms"),
                point.get("issue_type"),
                point.get("comment"),
                now,
            ),
        )


def approve_review_task(task_id: str, decision_comment: str, review_points: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    task = _fetch_review_task(task_id)
    role_to_user = _resolve_assignee_ids()
    now = utc_now()
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            update public.review_tasks
            set status = 'approved',
                started_at = coalesce(started_at, %s),
                finished_at = %s,
                decision = 'approve',
                decision_comment = %s,
                updated_at = %s
            where id::text = %s
            """,
            (now, now, decision_comment, now, task_id),
        )
        _insert_review_points(cursor, task=task, review_points=review_points or [], created_by=role_to_user.get(task["reviewer_role"]))
        if int(task["stage_no"]) == 4 and int(task["review_step_no"]) < 3:
            _ensure_next_stage4_step(cursor, task, int(task["review_step_no"]) + 1)
        else:
            _update_run_for_stage_result(cursor, episode_version_id=task["episode_version_id"], stage_no=int(task["stage_no"]), result="approved")
        snapshot = _snapshot_from_stage_tasks(task["episode_version_id"], int(task["stage_no"]))
        if snapshot["all_approved"]:
            _update_episode_version_gate_status(
                cursor,
                episode_version_id=task["episode_version_id"],
                status=str(gate_approved_status(int(task["stage_no"]))),
            )
        connection.commit()

    snapshot = _snapshot_from_stage_tasks(task["episode_version_id"], int(task["stage_no"]))
    resume_hint = _build_resume_hint(task, gate_snapshot=snapshot)
    return to_jsonable(
        {
            "review_task_id": task_id,
            "status": "approved",
            "decision": "approve",
            "return_ticket_id": None,
            "next_action": "release_gate_or_create_next_step",
            "gate_snapshot": snapshot,
            "resume_hint": resume_hint,
        }
    )


def skip_review_task(task_id: str, reason: str) -> dict[str, Any]:
    task = _fetch_review_task(task_id)
    if int(task["stage_no"]) != 4 or int(task["review_step_no"]) != 1:
        raise ValueError("only stage4 step1 can be skipped")

    now = utc_now()
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            update public.review_tasks
            set status = 'skipped',
                started_at = coalesce(started_at, %s),
                finished_at = %s,
                decision_comment = %s,
                updated_at = %s
            where id::text = %s
            """,
            (now, now, reason, now, task_id),
        )
        _ensure_next_stage4_step(cursor, task, 2)
        connection.commit()

    snapshot = _snapshot_from_stage_tasks(task["episode_version_id"], 4)
    return to_jsonable(
        {
            "review_task_id": task_id,
            "status": "skipped",
            "next_action": "create_next_step",
            "gate_snapshot": snapshot,
            "resume_hint": None,
        }
    )


def return_review_task(task_id: str, decision_comment: str, review_points: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    task = _fetch_review_task(task_id)
    role_to_user = _resolve_assignee_ids()
    now = utc_now()
    snapshot = _build_version_snapshot(task["episode_version_id"])
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            update public.review_tasks
            set status = 'returned',
                started_at = coalesce(started_at, %s),
                finished_at = %s,
                decision = 'return',
                decision_comment = %s,
                updated_at = %s
            where id::text = %s
            """,
            (now, now, decision_comment, now, task_id),
        )
        _insert_review_points(cursor, task=task, review_points=review_points or [], created_by=role_to_user.get(task["reviewer_role"]))

        ticket_id = str(uuid4())
        ticket = ReturnTicketRecord(
            id=ticket_id,
            episode_id=task["episode_id"],
            episode_version_id=task["episode_version_id"],
            review_task_id=task_id,
            source_type="human_review",
            source_node_id=task["gate_node_id"],
            stage_no=int(task["stage_no"]),
            anchor_type=task["anchor_type"],
            anchor_id=task["anchor_id"],
            timestamp_ms=(review_points or [{}])[0].get("timestamp_ms") if review_points else None,
            issue_type=(review_points or [{}])[0].get("issue_type") if review_points else "human_review_return",
            severity=(review_points or [{}])[0].get("severity") if review_points else "major",
            comment=decision_comment,
            created_by_role=task["reviewer_role"],
            suggested_stage_back=int(task["stage_no"]),
            system_root_cause_node_id=STAGE_TO_ROOT_CAUSE_NODE.get(int(task["stage_no"])),
            rerun_plan_json=None,
            status="open",
            resolved_version_id=None,
            created_at=_iso_now(),
            updated_at=_iso_now(),
        )
        planner = MinimalRerunPlanner()
        rerun_plan = planner.build_plan(ticket, snapshot)
        planned_ticket = planner.attach_plan(ticket, rerun_plan)

        cursor.execute(
            """
            insert into core_pipeline.return_tickets (
                id,
                episode_id,
                episode_version_id,
                stage_no,
                anchor_type,
                anchor_id,
                timestamp_ms,
                issue_type,
                severity,
                comment,
                created_by_role,
                suggested_stage_back,
                system_root_cause_node_id,
                rerun_plan_json,
                status,
                created_at,
                updated_at,
                review_task_id,
                source_type,
                source_node_id,
                resolved_version_id
            ) values (
                %s, %s, %s, %s, %s::public.anchor_type, %s, %s, %s, %s::public.severity, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, null
            )
            on conflict (id) do nothing
            """,
            (
                ticket_id,
                task["episode_id"],
                task["episode_version_id"],
                task["stage_no"],
                task["anchor_type"],
                task["anchor_id"],
                planned_ticket.timestamp_ms,
                planned_ticket.issue_type,
                planned_ticket.severity,
                planned_ticket.comment,
                planned_ticket.created_by_role,
                str(planned_ticket.suggested_stage_back),
                planned_ticket.system_root_cause_node_id,
                Jsonb(planned_ticket.rerun_plan_json or {}),
                "in_progress",
                now,
                now,
                task_id,
                planned_ticket.source_type,
                planned_ticket.source_node_id,
            ),
        )
        new_version_id = _ensure_rerun_version(cursor, task=task, ticket_id=ticket_id)
        rerun_run_id = _ensure_rerun_run(
            cursor,
            task=task,
            ticket_id=ticket_id,
            new_version_id=new_version_id,
            root_cause_node_id=rerun_plan.root_cause_node_id,
        )
        cursor.execute(
            """
            update public.episode_versions
            set run_id = %s,
                updated_at = %s
            where id::text = %s
            """,
            (UUID(rerun_run_id), now, new_version_id),
        )
        cursor.execute(
            """
            update core_pipeline.return_tickets
            set resolved_version_id = %s,
                updated_at = %s
            where id = %s
            """,
            (
                UUID(new_version_id),
                now,
                ticket_id,
            ),
        )
        _update_run_for_stage_result(cursor, episode_version_id=task["episode_version_id"], stage_no=int(task["stage_no"]), result="returned")
        _update_episode_version_gate_status(
            cursor,
            episode_version_id=task["episode_version_id"],
            status=str(EpisodeVersionStatus.RETURNED),
        )
        connection.commit()

    gate_snapshot = _snapshot_from_stage_tasks(task["episode_version_id"], int(task["stage_no"]))
    resume_hint = _build_resume_hint(task, gate_snapshot=gate_snapshot, return_ticket_id=ticket_id)
    return to_jsonable(
        {
            "review_task_id": task_id,
            "status": "returned",
            "decision": "return",
            "return_ticket_id": ticket_id,
            "next_action": "create_return_ticket_and_stop_following_steps",
            "gate_snapshot": gate_snapshot,
            "resolved_version_id": new_version_id,
            "resume_hint": resume_hint,
        }
    )


# ─── Payload Update (lock, select, prompt, track settings) ────────────


def update_review_task_payload(
    task_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    """Merge ``updates`` into the review_task's payload_json.

    Supports any key in payload_json — the frontend uses this for:
    - lock asset:       {"locked_image_id": "img-123"}
    - apply gacha:      {"selected_keyframe_id": "kf-1", "selected_video_id": "vid-2"}
    - update prompt:    {"prompt": "new prompt text"}
    - track settings:   {"track_settings": {"video": {"muted": true}}}
    - volume/fade:      {"audio_adjustments": [{"clip_id": "ac-1", "volume": 0.8}]}
    """
    task = _fetch_review_task(task_id)
    existing_payload = dict(task.get("payload_json") or {})
    existing_payload.update(updates)

    now = utc_now()
    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            update public.review_tasks
            set payload_json = %s,
                updated_at = %s
            where id = %s
            """,
            (Jsonb(existing_payload), now, task_id),
        )
        connection.commit()

    return to_jsonable({
        "review_task_id": task_id,
        "action": "payload_updated",
        "updated_keys": list(updates.keys()),
        "payload_json": existing_payload,
    })


# ─── Regeneration Request (asset, shot, voice, sfx, export) ──────────


def request_regeneration(
    task_id: str,
    regen_type: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Create a model_job for regeneration tied to a review task.

    regen_type: asset | shot | voice | sfx | music_feedback | export
    params: type-specific parameters (prompt, model, character_id, etc.)
    """
    task = _fetch_review_task(task_id)
    params = params or {}
    now = utc_now()
    job_id = str(uuid4())

    request_payload = {
        "regen_type": regen_type,
        "review_task_id": task_id,
        "episode_id": task["episode_id"],
        "episode_version_id": task["episode_version_id"],
        "stage_no": task["stage_no"],
        "gate_node_id": task["gate_node_id"],
        "anchor_type": task.get("anchor_type"),
        "anchor_id": task.get("anchor_id"),
        **params,
    }

    # Map regen_type to job_type for model_jobs table
    job_type_map = {
        "asset": "image_generation",
        "shot": "shot_generation",
        "voice": "tts_generation",
        "sfx": "sfx_replacement",
        "music_feedback": "music_feedback",
        "export": "rough_cut_export",
        "revert": "version_revert",
    }
    job_type = job_type_map.get(regen_type, f"regen_{regen_type}")

    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            insert into model_jobs (
                job_id, job_type, episode_id, stage_no,
                status, request_payload, queued_at, created_at, updated_at
            ) values (
                %s, %s, %s, %s,
                'queued', %s, %s, %s, %s
            )
            """,
            (
                job_id, job_type, task["episode_id"], task["stage_no"],
                Jsonb(request_payload), now, now, now,
            ),
        )
        connection.commit()

    return to_jsonable({
        "review_task_id": task_id,
        "action": "regeneration_requested",
        "regen_type": regen_type,
        "job_id": job_id,
        "job_type": job_type,
        "status": "queued",
        "params": params,
    })
