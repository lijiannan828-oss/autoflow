from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb

from backend.common.contracts.model_gateway import (
    ModelCallbackPayload,
    ModelExecutionRequest,
    ModelExecutionResult,
    utc_now_iso,
)
from backend.common.db import fetch_one, get_connection
from backend.orchestrator.statuses import QUEUE_MODEL_CALLBACKS

STAGE_NO_BY_GROUP: dict[str, int] = {
    "script": 1,
    "art": 1,
    "keyframe": 2,
    "video": 2,
    "audio": 3,
    "final": 4,
}

MODEL_JOB_TO_NODE_RUN_STATUS: dict[str, str] = {
    "queued": "running",
    "running": "running",
    "succeeded": "succeeded",
    "failed": "failed",
    "cancelled": "canceled",
}


def _load_node_registry(node_id: str) -> dict[str, Any]:
    row = fetch_one(
        """
        select
            node_id,
            stage_group,
            model_config,
            comfyui_workflow_id,
            quality_threshold,
            reject_target_node_id,
            max_auto_rejects
        from core_pipeline.node_registry
        where node_id = %s
        limit 1
        """,
        (node_id,),
    )
    if row is None:
        raise ValueError(f"node_registry not found: {node_id}")
    return row


def _load_node_run_context(node_run_id: str) -> dict[str, Any]:
    row = fetch_one(
        """
        select
            nr.id::text as id,
            nr.run_id::text as run_id,
            nr.episode_version_id::text as episode_version_id,
            nr.node_id,
            nr.status,
            nr.input_ref,
            nr.output_ref,
            nr.scope_hash,
            nr.model_provider,
            nr.model_endpoint,
            nr.comfyui_workflow_id,
            run.episode_id::text as episode_id,
            registry.stage_group,
            registry.model_config,
            registry.comfyui_workflow_id as registry_workflow_id
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


def _job_type(provider: str, stage_group: str | None) -> str:
    if provider == "comfyui":
        return "comfyui_workflow"
    if provider == "llm":
        return "llm_completion"
    if provider == "audio-stack":
        return "audio_pipeline"
    return f"{stage_group or 'generic'}_model_job"


def build_execution_request(
    *,
    node_id: str,
    episode_version_id: str,
    input_ref: str | None,
    scope_hash: str,
    overrides: dict[str, Any] | None = None,
) -> ModelExecutionRequest:
    row = _load_node_registry(node_id)
    overrides = overrides or {}
    model_config = dict(row.get("model_config") or {})
    provider = str(overrides.get("provider") or model_config.get("provider") or "internal")
    workflow_id = overrides.get("workflow_id") or row.get("comfyui_workflow_id") or model_config.get("workflow_id")
    model_profile = overrides.get("model_profile") or model_config.get("profile")

    if provider == "comfyui":
        endpoint = str(workflow_id or f"wf-{node_id.lower()}")
    elif provider == "llm":
        endpoint = str(model_config.get("endpoint") or "openai-compatible")
    elif provider == "audio-stack":
        endpoint = str(model_config.get("endpoint") or "audio-stack")
    elif provider == "human_gate":
        endpoint = "human-gate"
    else:
        endpoint = str(model_config.get("endpoint") or provider)

    return ModelExecutionRequest(
        node_id=node_id,
        episode_version_id=episode_version_id,
        input_ref=input_ref,
        scope_hash=scope_hash,
        provider=provider,
        endpoint=endpoint,
        model_profile=str(model_profile) if model_profile else None,
        workflow_id=str(workflow_id) if workflow_id else None,
        idempotency_key=f"{episode_version_id}:{node_id}:{scope_hash}",
        callback_queue=QUEUE_MODEL_CALLBACKS,
        callback_topic=f"model_callback:{node_id}",
        metadata={
            "stage_group": row.get("stage_group"),
            "quality_threshold": row.get("quality_threshold") or {},
            "reject_target_node_id": row.get("reject_target_node_id"),
            "max_auto_rejects": row.get("max_auto_rejects"),
        },
    )


def submit_execution_request(request: ModelExecutionRequest) -> ModelExecutionResult:
    job_id = f"job:{request.node_id}:{request.episode_version_id}:{request.scope_hash}"
    return ModelExecutionResult(
        job_id=job_id,
        status="submitted",
        provider=request.provider,
        endpoint=request.endpoint,
        submitted_at=utc_now_iso(),
        request=request.to_dict(),
    )


def submit_node_run_for_model(
    node_run_id: str,
    *,
    overrides: dict[str, Any] | None = None,
    seed_namespace: str | None = None,
) -> dict[str, Any]:
    node_run = _load_node_run_context(node_run_id)
    request = build_execution_request(
        node_id=str(node_run["node_id"]),
        episode_version_id=str(node_run["episode_version_id"]),
        input_ref=node_run.get("input_ref"),
        scope_hash=str(node_run.get("scope_hash") or f"scope:{node_run_id}"),
        overrides=overrides,
    )
    result = submit_execution_request(request)
    stage_group = str(node_run.get("stage_group") or request.metadata.get("stage_group") or "")
    stage_no = STAGE_NO_BY_GROUP.get(stage_group)
    request_payload = {
        **request.to_dict(),
        "node_run_id": node_run_id,
        "run_id": node_run["run_id"],
        "episode_id": node_run["episode_id"],
        "seed_namespace": seed_namespace,
    }
    now = utc_now_iso()

    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            insert into model_jobs (
                id,
                job_id,
                request_id,
                job_type,
                episode_id,
                episode_version_id,
                node_run_id,
                node_id,
                stage_no,
                status,
                provider,
                callback_url,
                request_payload,
                result_payload,
                error_payload,
                queued_at,
                started_at,
                finished_at,
                created_at,
                updated_at
            ) values (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, 'queued', %s, %s, %s, null, null, %s, null, null, %s, %s
            )
            on conflict (job_id) do update set
                request_id = excluded.request_id,
                job_type = excluded.job_type,
                episode_id = excluded.episode_id,
                episode_version_id = excluded.episode_version_id,
                node_run_id = excluded.node_run_id,
                node_id = excluded.node_id,
                stage_no = excluded.stage_no,
                status = 'queued',
                provider = excluded.provider,
                callback_url = excluded.callback_url,
                request_payload = excluded.request_payload,
                updated_at = excluded.updated_at
            """,
            (
                result.job_id,
                request.idempotency_key,
                _job_type(result.provider, stage_group),
                node_run["episode_id"],
                node_run["episode_version_id"],
                node_run_id,
                node_run["node_id"],
                stage_no,
                result.provider,
                request.callback_topic,
                Jsonb(request_payload),
                now,
                now,
                now,
            ),
        )
        cursor.execute(
            """
            update core_pipeline.runs
            set current_node_id = %s,
                current_stage_no = %s,
                updated_at = %s
            where id::text = %s
            """,
            (
                node_run["node_id"],
                stage_no,
                now,
                node_run["run_id"],
            ),
        )
        cursor.execute(
            """
            update core_pipeline.node_runs
            set status = 'running',
                model_provider = %s,
                model_endpoint = %s,
                comfyui_workflow_id = %s,
                started_at = coalesce(started_at, %s),
                updated_at = %s
            where id::text = %s
            """,
            (
                request.provider,
                request.endpoint,
                request.workflow_id,
                now,
                now,
                node_run_id,
            ),
        )
        connection.commit()

    return {
        "job_id": result.job_id,
        "status": "queued",
        "provider": result.provider,
        "endpoint": result.endpoint,
        "request": request_payload,
    }


def build_callback_payload(
    *,
    result: ModelExecutionResult,
    status: str,
    output_ref: str | None,
    error_code: str | None = None,
    error_message: str | None = None,
    metrics: dict[str, Any] | None = None,
) -> ModelCallbackPayload:
    request = result.request
    return ModelCallbackPayload(
        job_id=result.job_id,
        node_id=str(request["node_id"]),
        episode_version_id=str(request["episode_version_id"]),
        status=status,
        output_ref=output_ref,
        error_code=error_code,
        error_message=error_message,
        metrics=metrics or {},
        callback_topic=str(request["callback_topic"]),
    )


def apply_model_callback(payload: ModelCallbackPayload) -> dict[str, Any]:
    job = fetch_one(
        """
        select
            job_id,
            status,
            provider,
            request_payload,
            result_payload,
            error_payload
        from model_jobs
        where job_id = %s
        limit 1
        """,
        (payload.job_id,),
    )
    if job is None:
        raise ValueError(f"model job not found: {payload.job_id}")

    request_payload = dict(job.get("request_payload") or {})
    node_run_id = request_payload.get("node_run_id")
    if not node_run_id:
        raise ValueError(f"model job missing node_run_id: {payload.job_id}")

    terminal = payload.status in {"succeeded", "failed", "cancelled"}
    model_job_status = payload.status
    node_run_status = MODEL_JOB_TO_NODE_RUN_STATUS.get(payload.status, "running")
    now = utc_now_iso()
    result_payload = Jsonb(payload.to_dict()) if payload.status == "succeeded" else None
    error_payload = Jsonb(payload.to_dict()) if payload.status in {"failed", "cancelled"} else None

    with get_connection() as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            update model_jobs
            set status = %s,
                result_payload = %s,
                error_payload = %s,
                started_at = coalesce(started_at, %s),
                finished_at = case when %s then %s else finished_at end,
                updated_at = %s
            where job_id = %s
            """,
            (
                model_job_status,
                result_payload,
                error_payload,
                now,
                terminal,
                now,
                now,
                payload.job_id,
            ),
        )
        cursor.execute(
            """
            update core_pipeline.runs
            set current_stage_no = coalesce(current_stage_no, (select stage_no from model_jobs where job_id = %s limit 1)),
                updated_at = %s
            where id::text = (select run_id::text from core_pipeline.node_runs where id::text = %s limit 1)
            """,
            (
                payload.job_id,
                now,
                node_run_id,
            ),
        )
        cursor.execute(
            """
            update core_pipeline.node_runs
            set status = %s,
                output_ref = coalesce(%s, output_ref),
                error_code = %s,
                error_message = %s,
                quality_score = coalesce(%s, quality_score),
                gpu_seconds = coalesce(%s, gpu_seconds),
                cost_cny = coalesce(%s, cost_cny),
                duration_s = coalesce(%s, duration_s),
                ended_at = case when %s then coalesce(ended_at, %s) else ended_at end,
                updated_at = %s
            where id::text = %s
            """,
            (
                node_run_status,
                payload.output_ref,
                payload.error_code,
                payload.error_message,
                payload.metrics.get("quality_score"),
                payload.metrics.get("gpu_seconds"),
                payload.metrics.get("cost_cny"),
                payload.metrics.get("duration_s"),
                terminal,
                now,
                now,
                node_run_id,
            ),
        )
        connection.commit()

    return {
        "job_id": payload.job_id,
        "node_run_id": node_run_id,
        "model_job_status": model_job_status,
        "node_run_status": node_run_status,
        "output_ref": payload.output_ref,
    }


def preview_execution_route(node_ids: list[str]) -> list[dict[str, Any]]:
    previews: list[dict[str, Any]] = []
    for index, node_id in enumerate(node_ids, start=1):
        request = build_execution_request(
            node_id=node_id,
            episode_version_id=f"preview-episode-version-{index}",
            input_ref=f"tos://autoflow-media/preview/{node_id}/input.json",
            scope_hash=f"preview-scope-{node_id}",
        )
        previews.append(request.to_dict())
    return previews
