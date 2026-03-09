from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from backend.common.contracts.serialization import to_jsonable
from backend.common.db import fetch_all, fetch_one, fetch_value
from backend.orchestrator.dev_seed import ROUND6_NAMESPACE, ROUND7_NAMESPACE, SEED_NAMESPACE
from backend.orchestrator.model_gateway import preview_execution_route
from backend.rerun.db_read_side import get_rerun_status_payload

STAGE_TO_GATE_NODE: dict[int, str] = {
    1: "N08",
    2: "N18",
    3: "N21",
    4: "N24",
}

STAGE_TO_DEFAULT_REVIEWER: dict[int, str] = {
    1: "middle_platform",
    2: "qc_inspector",
    3: "qc_inspector",
    4: "partner",
}

STAGE_TO_GRANULARITY: dict[int, str] = {
    1: "asset",
    2: "shot",
    3: "episode",
    4: "episode",
}

COMPAT_STATUS_TO_REVIEW_STATUS: dict[str, str] = {
    "passed": "approved",
    "approved": "approved",
    "active": "in_progress",
    "in_progress": "in_progress",
    "generating": "in_progress",
    "pending": "pending",
    "failed": "returned",
    "returned": "returned",
    "rejected": "returned",
    "skipped": "skipped",
}

REVIEW_STATUS_TO_NODE_STATUS: dict[str, str] = {
    "approved": "succeeded",
    "in_progress": "running",
    "pending": "pending",
    "returned": "failed",
    "skipped": "skipped",
}


def _core_table_counts() -> dict[str, int]:
    return {
        "runs": int(fetch_value("select count(*) from core_pipeline.runs") or 0),
        "node_runs": int(fetch_value("select count(*) from core_pipeline.node_runs") or 0),
        "review_tasks": int(fetch_value("select count(*) from public.review_tasks") or 0),
        "return_tickets": int(
            fetch_value("select count(*) from core_pipeline.return_tickets") or 0
        ),
        "artifacts": int(fetch_value("select count(*) from core_pipeline.artifacts") or 0),
        "model_jobs": int(fetch_value("select count(*) from model_jobs") or 0),
        "node_registry": int(
            fetch_value("select count(*) from core_pipeline.node_registry") or 0
        ),
        "stage_tasks": int(fetch_value("select count(*) from public.stage_tasks") or 0),
        "episode_versions": int(
            fetch_value("select count(*) from public.episode_versions") or 0
        ),
    }


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def _to_int(value: Any) -> int:
    if value is None:
        return 0
    return int(value)


def _ratio(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return round((numerator / denominator) * 100, 1)


def get_truth_source_status() -> dict[str, Any]:
    counts = _core_table_counts()
    preferred_review_task_source = (
        "public.review_tasks"
        if counts["review_tasks"] > 0
        else "compat:public.stage_tasks"
    )
    return {
        "preferred_review_task_source": preferred_review_task_source,
        "core_truth_ready": counts["review_tasks"] > 0 and counts["runs"] > 0,
        "compat_projection_active": counts["stage_tasks"] > 0,
        "core_counts": counts,
        "summary": (
            "Review Gateway 与验收页已可优先使用 public.review_tasks/core_pipeline 作为真相源。"
            if preferred_review_task_source == "public.review_tasks"
            else "当前仍需通过 public.stage_tasks 兼容投影兜底，真相源收口尚未完全完成。"
        ),
    }


def get_north_star_summary() -> dict[str, Any]:
    truth_source = get_truth_source_status()
    node_metrics = fetch_one(
        """
        select
            count(*) as total_node_runs,
            count(*) filter (where coalesce(cost_cny, 0) > 0) as costed_node_runs,
            coalesce(sum(cost_cny), 0) as total_cost_cny,
            coalesce(sum(gpu_seconds), 0) as total_gpu_seconds,
            avg(duration_s) as avg_node_duration_seconds,
            count(*) filter (where quality_score is not null) as scored_node_runs,
            avg(quality_score) as avg_quality_score,
            count(*) filter (where quality_score is not null and quality_score < 0.8) as low_quality_node_runs,
            count(*) filter (where status in ('failed', 'auto_rejected')) as unstable_node_runs
        from core_pipeline.node_runs
        """
    ) or {}
    artifact_metrics = fetch_one(
        """
        select
            count(*) as total_artifacts,
            count(*) filter (where artifact_type = 'comfyui_workflow') as workflow_artifacts,
            count(*) filter (where artifact_type = 'prompt_json') as prompt_artifacts
        from core_pipeline.artifacts
        """
    ) or {}
    model_job_metrics = fetch_one(
        """
        select
            count(*) as total_model_jobs,
            count(*) filter (where status in ('queued', 'running')) as active_model_jobs,
            count(*) filter (where status = 'succeeded') as succeeded_model_jobs
        from model_jobs
        """
    ) or {}
    run_metrics = fetch_one(
        """
        select
            count(*) as total_runs,
            count(*) filter (where is_rerun is true) as rerun_runs,
            count(*) filter (where status in ('pending', 'running')) as active_runs,
            count(distinct episode_version_id) as version_count
        from core_pipeline.runs
        """
    ) or {}
    review_metrics = fetch_one(
        """
        select
            count(*) as total_review_tasks,
            count(*) filter (where status = 'pending') as pending_review_tasks,
            count(*) filter (where status = 'in_progress') as in_progress_review_tasks,
            count(*) filter (where status = 'approved') as approved_review_tasks,
            count(*) filter (where status = 'returned') as returned_review_tasks,
            avg(extract(epoch from (coalesce(started_at, finished_at, updated_at) - created_at))) as avg_review_queue_seconds,
            avg(extract(epoch from (finished_at - created_at))) filter (where finished_at is not null) as avg_review_cycle_seconds
        from public.review_tasks
        """
    ) or {}
    ticket_metrics = fetch_one(
        """
        select
            count(*) as total_return_tickets,
            count(*) filter (where source_type = 'auto_qc') as auto_qc_return_tickets,
            count(*) filter (where status = 'open') as open_return_tickets,
            count(*) filter (where status = 'resolved') as resolved_return_tickets
        from core_pipeline.return_tickets
        """
    ) or {}
    review_points_count = _to_int(
        fetch_value("select count(*) from public.review_points")
    )

    total_node_runs = _to_int(node_metrics.get("total_node_runs"))
    scored_node_runs = _to_int(node_metrics.get("scored_node_runs"))
    total_review_tasks = _to_int(review_metrics.get("total_review_tasks"))
    approved_review_tasks = _to_int(review_metrics.get("approved_review_tasks"))
    total_return_tickets = _to_int(ticket_metrics.get("total_return_tickets"))

    return {
        "generated_at": _utc_now_iso(),
        "truth_source": truth_source,
        "cost": {
            "signal": "measured" if total_node_runs > 0 else "missing",
            "cost_redline_per_minute_cny": 30,
            "total_cost_cny": _to_float(node_metrics.get("total_cost_cny")) or 0.0,
            "total_gpu_seconds": _to_float(node_metrics.get("total_gpu_seconds")) or 0.0,
            "costed_node_runs": _to_int(node_metrics.get("costed_node_runs")),
            "avg_cost_per_node_run": (
                round(
                    (_to_float(node_metrics.get("total_cost_cny")) or 0.0) / total_node_runs,
                    3,
                )
                if total_node_runs > 0
                else None
            ),
            "note": "当前尚未沉淀真实成片分钟数，暂不能给出严格的单分钟成本，只能先追踪 NodeRun 级成本。",
        },
        "quality": {
            "signal": "measured" if scored_node_runs > 0 else "missing",
            "avg_quality_score": _to_float(node_metrics.get("avg_quality_score")),
            "scored_node_runs": scored_node_runs,
            "low_quality_node_runs": _to_int(node_metrics.get("low_quality_node_runs")),
            "quality_coverage_rate": _ratio(scored_node_runs, total_node_runs),
            "unstable_node_runs": _to_int(node_metrics.get("unstable_node_runs")),
        },
        "throughput": {
            "signal": "measured" if _to_int(run_metrics.get("total_runs")) > 0 else "missing",
            "total_runs": _to_int(run_metrics.get("total_runs")),
            "rerun_runs": _to_int(run_metrics.get("rerun_runs")),
            "active_runs": _to_int(run_metrics.get("active_runs")),
            "version_count": _to_int(run_metrics.get("version_count")),
            "artifact_count": _to_int(artifact_metrics.get("total_artifacts")),
            "model_job_count": _to_int(model_job_metrics.get("total_model_jobs")),
            "active_model_jobs": _to_int(model_job_metrics.get("active_model_jobs")),
            "avg_node_duration_seconds": _to_float(node_metrics.get("avg_node_duration_seconds")),
            "avg_review_queue_seconds": _to_float(review_metrics.get("avg_review_queue_seconds")),
            "avg_review_cycle_seconds": _to_float(review_metrics.get("avg_review_cycle_seconds")),
            "pending_review_tasks": _to_int(review_metrics.get("pending_review_tasks")),
            "in_progress_review_tasks": _to_int(review_metrics.get("in_progress_review_tasks")),
        },
        "feedback": {
            "signal": "measured" if total_return_tickets > 0 or review_points_count > 0 else "missing",
            "total_review_tasks": total_review_tasks,
            "approved_review_tasks": approved_review_tasks,
            "returned_review_tasks": _to_int(review_metrics.get("returned_review_tasks")),
            "approval_rate": _ratio(approved_review_tasks, total_review_tasks),
            "total_return_tickets": total_return_tickets,
            "auto_qc_return_tickets": _to_int(ticket_metrics.get("auto_qc_return_tickets")),
            "open_return_tickets": _to_int(ticket_metrics.get("open_return_tickets")),
            "resolved_return_tickets": _to_int(ticket_metrics.get("resolved_return_tickets")),
            "review_points": review_points_count,
            "workflow_artifacts": _to_int(artifact_metrics.get("workflow_artifacts")),
            "prompt_artifacts": _to_int(artifact_metrics.get("prompt_artifacts")),
        },
    }


def get_registry_validation_payload() -> dict[str, Any]:
    counts = _core_table_counts()
    return {
        "expected_node_count": 26,
        "actual_node_count": counts["node_registry"],
        "is_seeded": counts["node_registry"] > 0,
        "blocking_issues": (
            ["node_registry 未写入种子数据，DAG 无法按数据库真相源校验"]
            if counts["node_registry"] == 0
            else []
        ),
    }


def _fetch_latest_episode_ids(limit: int = 6) -> list[str]:
    rows = fetch_all(
        """
        select episode_id::text as episode_id, max(updated_at) as last_updated
        from public.stage_tasks
        group by episode_id
        order by last_updated desc
        limit %s
        """,
        (limit,),
    )
    return [row["episode_id"] for row in rows]


def _fetch_latest_episode_version(episode_id: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            version_no,
            status,
            created_at,
            updated_at
        from public.episode_versions
        where episode_id::text = %s
        order by created_at desc
        limit 1
        """,
        (episode_id,),
    )


def _fetch_stage_tasks_for_episode(episode_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        select
            st.id::text as id,
            st.episode_id::text as episode_id,
            st.stage_no,
            st.status,
            st.priority_group::text as priority_group,
            st.priority_score,
            st.deadline_at,
            st.source_reason,
            st.assigned_user_id::text as assigned_user_id,
            st.locked_by::text as locked_by,
            st.locked_at,
            st.lock_expire_at,
            st.started_at,
            st.completed_at,
            st.reject_count,
            st.payload_json,
            st.created_at,
            st.updated_at,
            st.source_review_task_id::text as source_review_task_id,
            st.reviewer_role,
            st.review_step_no,
            st.anchor_type::text as anchor_type,
            st.anchor_id::text as anchor_id,
            st.openclaw_session_id,
            ev.id::text as episode_version_id,
            ev.version_no,
            ev.status as episode_version_status
        from public.stage_tasks st
        left join lateral (
            select id, version_no, status
            from public.episode_versions
            where episode_id = st.episode_id
            order by created_at desc
            limit 1
        ) ev on true
        where st.episode_id::text = %s
        order by st.stage_no asc, st.created_at asc
        """,
        (episode_id,),
    )
    return rows


def _fetch_core_runs(limit: int = 5) -> list[dict[str, Any]]:
    return fetch_all(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id,
            status,
            current_node_id,
            plan_json,
            is_rerun,
            rerun_from_ticket_id::text as rerun_from_ticket_id,
            langgraph_thread_id,
            started_at,
            finished_at,
            created_at,
            updated_at
        from core_pipeline.runs
        order by updated_at desc
        limit %s
        """,
        (limit,),
    )


def _fetch_core_node_runs(limit: int = 10) -> list[dict[str, Any]]:
    return fetch_all(
        """
        select
            id::text as id,
            run_id::text as run_id,
            episode_version_id::text as episode_version_id,
            node_id,
            agent_role,
            status,
            attempt_no,
            retry_count,
            auto_reject_count,
            scope_hash,
            input_ref,
            output_ref,
            model_provider,
            model_endpoint,
            comfyui_workflow_id,
            api_calls,
            token_in,
            token_out,
            gpu_seconds,
            cost_cny,
            rag_query_count,
            quality_score,
            error_code,
            error_message,
            tags,
            started_at,
            ended_at,
            duration_s,
            created_at,
            updated_at
        from core_pipeline.node_runs
        order by updated_at desc
        limit %s
        """,
        (limit,),
    )


def _fetch_round4_seed_runs() -> list[dict[str, Any]]:
    return fetch_all(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id,
            status,
            current_node_id,
            plan_json,
            is_rerun,
            rerun_from_ticket_id::text as rerun_from_ticket_id,
            langgraph_thread_id,
            started_at,
            finished_at,
            created_at,
            updated_at
        from core_pipeline.runs
        where plan_json ->> 'seed_namespace' = %s
        order by updated_at desc
        """,
        (SEED_NAMESPACE,),
    )


def _fetch_round4_seed_node_runs(run_ids: list[str]) -> list[dict[str, Any]]:
    if not run_ids:
        return []
    return fetch_all(
        """
        select
            id::text as id,
            run_id::text as run_id,
            episode_version_id::text as episode_version_id,
            node_id,
            agent_role,
            status,
            attempt_no,
            retry_count,
            auto_reject_count,
            scope_hash,
            input_ref,
            output_ref,
            model_provider,
            model_endpoint,
            comfyui_workflow_id,
            api_calls,
            token_in,
            token_out,
            gpu_seconds,
            cost_cny,
            rag_query_count,
            quality_score,
            error_code,
            error_message,
            tags,
            started_at,
            ended_at,
            duration_s,
            created_at,
            updated_at
        from core_pipeline.node_runs
        where run_id::text = any(%s)
        order by updated_at desc
        """,
        (run_ids,),
    )


def _fetch_round4_seed_review_tasks() -> list[dict[str, Any]]:
    rows = fetch_all(
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
        where payload_json ->> 'seed_namespace' = %s
        order by updated_at desc
        """,
        (SEED_NAMESPACE,),
    )
    return [
        {
            **row,
            "payload": row["payload_json"] or {},
        }
        for row in rows
    ]


def _fetch_round4_seed_return_tickets() -> list[dict[str, Any]]:
    return fetch_all(
        """
        select
            rt.id::text as id,
            rt.episode_id::text as episode_id,
            rt.episode_version_id::text as episode_version_id,
            rt.review_task_id::text as review_task_id,
            rt.source_type,
            rt.source_node_id,
            rt.stage_no,
            rt.anchor_type::text as anchor_type,
            rt.anchor_id::text as anchor_id,
            rt.timestamp_ms,
            rt.issue_type,
            rt.severity,
            rt.comment,
            rt.created_by_role::text as created_by_role,
            rt.suggested_stage_back,
            rt.system_root_cause_node_id,
            rt.rerun_plan_json,
            rt.status,
            rt.resolved_version_id::text as resolved_version_id,
            rt.created_at,
            rt.updated_at
        from core_pipeline.return_tickets rt
        left join public.review_tasks task on task.id = rt.review_task_id
        where task.payload_json ->> 'seed_namespace' = %s
        order by rt.updated_at desc
        """,
        (SEED_NAMESPACE,),
    )


def _fetch_round6_seed_artifacts() -> list[dict[str, Any]]:
    return fetch_all(
        """
        select
            id::text as id,
            episode_version_id::text as episode_version_id,
            node_run_id::text as node_run_id,
            artifact_type,
            anchor_type::text as anchor_type,
            anchor_id::text as anchor_id,
            time_range,
            resource_url,
            preview_url,
            meta_json,
            created_at
        from core_pipeline.artifacts
        where meta_json ->> 'seed_namespace' = %s
        order by created_at desc
        """,
        (ROUND6_NAMESPACE,),
    )


def _fetch_round6_auto_qc_tickets() -> list[dict[str, Any]]:
    return fetch_all(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id,
            review_task_id::text as review_task_id,
            source_type,
            source_node_id,
            stage_no,
            anchor_type::text as anchor_type,
            anchor_id::text as anchor_id,
            timestamp_ms,
            issue_type,
            severity,
            comment,
            created_by_role::text as created_by_role,
            suggested_stage_back,
            system_root_cause_node_id,
            rerun_plan_json,
            status,
            resolved_version_id::text as resolved_version_id,
            created_at,
            updated_at
        from core_pipeline.return_tickets
        where source_type = 'auto_qc'
          and issue_type = 'round6_auto_qc'
        order by updated_at desc
        """
    )


def _fetch_round7_model_jobs() -> list[dict[str, Any]]:
    return fetch_all(
        """
        select
            id::text as id,
            job_id,
            request_id,
            job_type,
            episode_id::text as episode_id,
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
        from model_jobs
        where request_payload ->> 'seed_namespace' = %s
        order by updated_at desc, created_at desc
        """,
        (ROUND7_NAMESPACE,),
    )


def _map_compat_status(status: str | None) -> str:
    if not status:
        return "pending"
    return COMPAT_STATUS_TO_REVIEW_STATUS.get(status, "pending")


def _map_stage_task_to_review_task(
    row: dict[str, Any],
    episode_version_id: str,
) -> dict[str, Any]:
    stage_no = int(row["stage_no"])
    mapped_status = _map_compat_status(row.get("status"))
    review_step_no = int(row["review_step_no"] or (1 if stage_no != 4 else 1))
    reviewer_role = row.get("reviewer_role") or STAGE_TO_DEFAULT_REVIEWER[stage_no]

    return {
        "id": row["id"],
        "episode_id": row["episode_id"],
        "episode_version_id": episode_version_id,
        "stage_no": stage_no,
        "gate_node_id": STAGE_TO_GATE_NODE[stage_no],
        "review_step_no": review_step_no,
        "reviewer_role": reviewer_role,
        "review_granularity": STAGE_TO_GRANULARITY[stage_no],
        "anchor_type": row.get("anchor_type"),
        "anchor_id": row.get("anchor_id"),
        "status": mapped_status,
        "assignee_id": row.get("assigned_user_id"),
        "priority": row.get("priority_group") or "normal",
        "openclaw_session_id": row.get("openclaw_session_id"),
        "payload": row.get("payload_json") or {},
        "payload_json": row.get("payload_json") or {},
        "started_at": row.get("started_at"),
        "finished_at": row.get("completed_at"),
        "decision": "approve" if mapped_status == "approved" else "return" if mapped_status == "returned" else None,
        "decision_comment": row.get("source_reason"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _map_stage_task_to_node_run(
    row: dict[str, Any],
    run_id: str,
    episode_version_id: str,
) -> dict[str, Any]:
    stage_no = int(row["stage_no"])
    review_status = _map_compat_status(row.get("status"))
    return {
        "id": f"compat-node-{row['id']}",
        "run_id": run_id,
        "episode_version_id": episode_version_id,
        "node_id": STAGE_TO_GATE_NODE[stage_no],
        "agent_role": "human_review_entry",
        "status": REVIEW_STATUS_TO_NODE_STATUS.get(review_status, "pending"),
        "attempt_no": 1,
        "retry_count": 0,
        "auto_reject_count": int(row.get("reject_count") or 0),
        "scope_hash": f"compat:{row['episode_id']}:{stage_no}",
        "input_ref": None,
        "output_ref": None,
        "model_provider": None,
        "model_endpoint": None,
        "comfyui_workflow_id": None,
        "api_calls": 0,
        "token_in": 0,
        "token_out": 0,
        "gpu_seconds": 0,
        "cost_cny": 0,
        "rag_query_count": 0,
        "quality_score": None,
        "error_code": None if review_status != "returned" else "COMPAT_STAGE_RETURNED",
        "error_message": None if review_status != "returned" else "Projected from public.stage_tasks",
        "tags": ["compat_stage_task_projection"],
        "started_at": row.get("started_at") or row.get("created_at"),
        "ended_at": row.get("completed_at"),
        "duration_s": None,
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _derive_current_stage_row(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    pending_like = {"pending", "active", "in_progress", "generating"}
    for row in sorted(rows, key=lambda item: int(item["stage_no"])):
        if (row.get("status") or "").lower() in pending_like:
            return row
    return rows[-1] if rows else None


def _derive_run_status(rows: list[dict[str, Any]]) -> str:
    statuses = {(row.get("status") or "").lower() for row in rows}
    if statuses & {"failed", "rejected", "returned"}:
        return "failed"
    if statuses & {"pending", "active", "in_progress", "generating"}:
        return "running"
    if rows:
        return "succeeded"
    return "pending"


def _build_gate_list(review_tasks: list[dict[str, Any]]) -> dict[str, Any]:
    items = [
        {
            "review_task_id": task["id"],
            "episode_id": task["episode_id"],
            "episode_version_id": task["episode_version_id"],
            "stage_no": task["stage_no"],
            "gate_node_id": task["gate_node_id"],
            "review_step_no": task["review_step_no"],
            "reviewer_role": task["reviewer_role"],
            "review_granularity": task["review_granularity"],
            "anchor_type": task["anchor_type"],
            "anchor_id": task["anchor_id"],
            "status": task["status"],
            "priority": task["priority"],
            "openclaw_session_id": task["openclaw_session_id"],
            "due_at": None,
            "payload": task["payload"],
        }
        for task in review_tasks
        if task["status"] in {"pending", "in_progress"}
    ]
    return {"items": items, "total": len(items)}


def _build_gate_detail(review_tasks: list[dict[str, Any]]) -> dict[str, Any] | None:
    detail = next((task for task in review_tasks if task["status"] in {"pending", "in_progress"}), None)
    if detail is None and review_tasks:
        detail = review_tasks[-1]
    if detail is None:
        return None

    payload = {
        "review_task_id": detail["id"],
        "episode_id": detail["episode_id"],
        "episode_version_id": detail["episode_version_id"],
        "stage_no": detail["stage_no"],
        "gate_node_id": detail["gate_node_id"],
        "review_step_no": detail["review_step_no"],
        "reviewer_role": detail["reviewer_role"],
        "review_granularity": detail["review_granularity"],
        "anchor_type": detail["anchor_type"],
        "anchor_id": detail["anchor_id"],
        "status": detail["status"],
        "priority": detail["priority"],
        "openclaw_session_id": detail["openclaw_session_id"],
        "payload": detail["payload"],
        "review_points": [],
    }

    if int(detail["stage_no"]) == 4:
        payload["stage4_progress"] = {
            "current_step_no": int(detail["review_step_no"]),
            "total_steps": 3,
            "previous_steps": [],
        }
    return payload


def _build_stage2_summary(review_tasks: list[dict[str, Any]]) -> dict[str, Any] | None:
    stage2_tasks = [task for task in review_tasks if int(task["stage_no"]) == 2]
    if not stage2_tasks:
        return None
    approved_count = sum(task["status"] == "approved" for task in stage2_tasks)
    returned_count = sum(task["status"] == "returned" for task in stage2_tasks)
    pending_count = sum(task["status"] in {"pending", "in_progress"} for task in stage2_tasks)
    return {
        "episode_version_id": stage2_tasks[0]["episode_version_id"],
        "gate_node_id": "N18",
        "approved_count": approved_count,
        "returned_count": returned_count,
        "pending_count": pending_count,
        "total_count": len(stage2_tasks),
        "all_approved": len(stage2_tasks) > 0 and approved_count == len(stage2_tasks),
    }


def _build_stage3_summary(review_tasks: list[dict[str, Any]]) -> dict[str, Any] | None:
    stage3_tasks = [task for task in review_tasks if int(task["stage_no"]) == 3]
    if not stage3_tasks:
        return None
    approved_count = sum(task["status"] == "approved" for task in stage3_tasks)
    returned_count = sum(task["status"] == "returned" for task in stage3_tasks)
    pending_count = sum(task["status"] in {"pending", "in_progress"} for task in stage3_tasks)
    return {
        "episode_version_id": stage3_tasks[0]["episode_version_id"],
        "gate_node_id": "N21",
        "approved_count": approved_count,
        "returned_count": returned_count,
        "pending_count": pending_count,
        "total_count": len(stage3_tasks),
        "all_approved": len(stage3_tasks) > 0 and approved_count == len(stage3_tasks),
    }


def _build_stage4_summary(review_tasks: list[dict[str, Any]]) -> dict[str, Any] | None:
    stage4_tasks = [task for task in review_tasks if int(task["stage_no"]) == 4]
    if not stage4_tasks:
        return None

    task_by_step = {
        int(task["review_step_no"]): task
        for task in stage4_tasks
    }
    steps = []
    for step_no, reviewer_role in ((1, "qc_inspector"), (2, "middle_platform"), (3, "partner")):
        task = task_by_step.get(step_no)
        steps.append(
            {
                "step_no": step_no,
                "reviewer_role": reviewer_role,
                "status": task["status"] if task else None,
            }
        )

    current_step_no = 3
    for step in steps:
        if step["status"] in {None, "pending", "in_progress"}:
            current_step_no = int(step["step_no"])
            break

    return {
        "episode_version_id": stage4_tasks[0]["episode_version_id"],
        "gate_node_id": "N24",
        "current_step_no": current_step_no,
        "total_steps": 3,
        "steps": steps,
    }


def _build_compat_scenario(
    episode_id: str,
    rows: list[dict[str, Any]],
    label: str,
    description: str,
    extra_version_patch: dict[str, Any] | None = None,
) -> dict[str, Any]:
    episode_version = _fetch_latest_episode_version(episode_id)
    episode_version_id = (
        episode_version["id"] if episode_version else f"compat-episode-version-{episode_id}"
    )
    focus_run_id = f"compat-run-{episode_id}"
    review_tasks = [
        _map_stage_task_to_review_task(row, episode_version_id)
        for row in rows
    ]
    node_runs = [
        _map_stage_task_to_node_run(row, focus_run_id, episode_version_id)
        for row in rows
    ]
    current_stage_row = _derive_current_stage_row(rows)
    created_at = min((row["created_at"] for row in rows), default=None)
    updated_at = max((row["updated_at"] for row in rows), default=None)
    run = {
        "id": focus_run_id,
        "episode_id": episode_id,
        "episode_version_id": episode_version_id,
        "status": _derive_run_status(rows),
        "current_node_id": (
            STAGE_TO_GATE_NODE[int(current_stage_row["stage_no"])]
            if current_stage_row
            else None
        ),
        "plan_json": {
            "source": "public.stage_tasks",
            "compat_mode": True,
            "version_no": episode_version["version_no"] if episode_version else None,
            "stage_statuses": [
                {
                    "stage_no": int(row["stage_no"]),
                    "status": row["status"],
                }
                for row in rows
            ],
        },
        "is_rerun": False,
        "rerun_from_ticket_id": None,
        "langgraph_thread_id": None,
        "started_at": created_at,
        "finished_at": updated_at if _derive_run_status(rows) == "succeeded" else None,
        "created_at": created_at,
        "updated_at": updated_at,
    }
    return {
        "id": f"compat-scenario-{episode_id}",
        "label": label,
        "description": description,
        "focus_run_id": focus_run_id,
        "runs": [run],
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": [],
        "gate_list": _build_gate_list(review_tasks),
        "gate_detail": _build_gate_detail(review_tasks),
        "stage2_summary": _build_stage2_summary(review_tasks),
        "stage4_summary": _build_stage4_summary(review_tasks),
        "version_patch": extra_version_patch,
    }


def _describe_episode(rows: list[dict[str, Any]]) -> tuple[str, str]:
    current = _derive_current_stage_row(rows)
    episode_short = rows[0]["episode_id"][:8] if rows else "unknown"
    if current is None:
        return (
            f"Episode {episode_short} · 无审核数据",
            "当前 episode 没有可映射的 stage_tasks 数据。",
        )

    stage_no = int(current["stage_no"])
    status = (current.get("status") or "").lower()
    if stage_no == 4:
        return (
            f"Episode {episode_short} · Stage4 兼容真读库",
            "通过 public.stage_tasks 兼容映射出的真实数据库审核状态，展示最终审核阶段的真实库数据。",
        )
    if stage_no == 3:
        return (
            f"Episode {episode_short} · Stage3 兼容真读库",
            "通过 public.stage_tasks 兼容映射出的真实数据库审核状态，展示 episode 级审核阶段的真实库数据。",
        )
    if stage_no == 2:
        return (
            f"Episode {episode_short} · Stage2 兼容真读库",
            "通过 public.stage_tasks 兼容映射出的真实数据库审核状态，展示 shot 级审核阶段的真实库数据。",
        )
    if status == "passed":
        return (
            f"Episode {episode_short} · Stage1 已通过",
            "通过 public.stage_tasks 兼容映射出的真实数据库审核状态，当前 Stage1 已通过。",
        )
    return (
        f"Episode {episode_short} · Stage{stage_no} 真读库",
        "通过 public.stage_tasks 兼容映射出的真实数据库审核状态。",
    )


def _build_second_round_task_tab() -> dict[str, Any]:
    scenarios: list[dict[str, Any]] = []
    for episode_id in _fetch_latest_episode_ids(limit=2):
        rows = _fetch_stage_tasks_for_episode(episode_id)
        if not rows:
            continue
        label, description = _describe_episode(rows)
        scenarios.append(
            _build_compat_scenario(
                episode_id=episode_id,
                rows=rows,
                label=f"第二轮 · {label}",
                description=description,
            )
        )

    return {
        "id": "round-2026-03-07-second",
        "label": "2026-03-07 第二轮任务",
        "description": "第二轮任务现已切到真实数据库兼容读侧，优先读取真实表数据；当新表仍为空时，通过 stage_tasks 兼容映射展示真实库状态。",
        "source": "real-db-compat",
        "technical_outcomes": [
            "验收页从纯 mock 升级为真实读取优先，并保留回退机制。",
            "第二轮任务 Tab 可展示 Stage2、Stage4 与回炉三类最小真实读取场景。",
            "总体进度页与独立任务验收页开始共存，不再混用同一视图表达。 ",
        ],
        "business_outcomes": [
            "团队第一次不靠口头描述就能直接看到“最小编排结果”，减少对齐成本。",
            "为后续 4 个关键人审节点建立了可视化验收入口，开始逼近“少数关键节点人工介入”的业务形态。",
            "把“合同先冻结、页面先可看”落成资产，为后续持续并行开发提供了共同观察面。",
        ],
        "remaining_gaps": [
            "当时仍不是数据库真相源，无法证明线上真实状态能被持续承接。",
            "还不能说明局部打回、v+1 和 rerun 是否真的可用。",
            "仍无法支撑成本、产能、鲁棒性等业务指标判断。",
        ],
        "scenarios": scenarios,
    }


def _build_core_status_scenario() -> dict[str, Any]:
    counts = _core_table_counts()
    return {
        "id": "third-round-core-db-status",
        "label": "第三轮 · core_pipeline 真读库状态",
        "description": "直接读取 core_pipeline / review_tasks / return_tickets / node_registry 的真实数据库状态，用于判断第三轮主线接库是否具备数据承载条件。",
        "focus_run_id": "",
        "runs": _fetch_core_runs(limit=3),
        "node_runs": _fetch_core_node_runs(limit=6),
        "review_tasks": [],
        "return_tickets": get_rerun_status_payload()["latest_return_tickets"],
        "gate_list": None,
        "gate_detail": None,
        "stage2_summary": None,
        "stage4_summary": None,
        "version_patch": {
            "database_counts": counts,
            "registry_validation": get_registry_validation_payload(),
            "rerun_status": get_rerun_status_payload(),
        },
    }


def _build_review_gateway_live_scenario() -> dict[str, Any]:
    episode_ids = _fetch_latest_episode_ids(limit=1)
    if not episode_ids:
        return {
            "id": "third-round-review-gateway-empty",
            "label": "第三轮 · Review Gateway 真读库",
            "description": "真实数据库当前没有可用于映射的审核任务数据。",
            "focus_run_id": "",
            "runs": [],
            "node_runs": [],
            "review_tasks": [],
            "return_tickets": [],
            "gate_list": {"items": [], "total": 0},
            "gate_detail": None,
            "stage2_summary": None,
            "stage4_summary": None,
            "version_patch": {
                "gateway_mode": "empty",
                "review_tasks_source": "public.review_tasks -> compat public.stage_tasks",
            },
        }

    rows = _fetch_stage_tasks_for_episode(episode_ids[0])
    return _build_compat_scenario(
        episode_id=episode_ids[0],
        rows=rows,
        label="第三轮 · Review Gateway 真读库",
        description="以 public.review_tasks 为主、public.stage_tasks 为兼容回退的真实数据库读侧，输出任务列表、详情和 Stage 聚合摘要。",
        extra_version_patch={
            "gateway_mode": "compat-stage-tasks",
            "review_tasks_source": "public.review_tasks -> compat public.stage_tasks",
        },
    )


def build_dynamic_task_tabs() -> list[dict[str, Any]]:
    return to_jsonable(
        [
            _build_second_round_task_tab(),
            {
                "id": "round-2026-03-07-third",
                "label": "2026-03-07 第三轮任务",
                "description": "第三轮聚焦真实数据库读侧、Review Gateway 最小 API 和节点调试页承接。",
                "source": "real-db",
                "technical_outcomes": [
                    "真实 PostgreSQL 读侧接入完成，acceptance / Review Gateway / Node Trace 都能读库。",
                    "新增 review task 列表、详情、Stage2 聚合、Stage4 串行步骤等最小 API。",
                    "Node Registry 校验与 Node Trace 真实读侧进入页面，可看到 core_pipeline 真空态。",
                ],
                "business_outcomes": [
                    "系统第一次能基于真实数据库回答“现在卡在哪一关、还有没有真运行数据”。",
                    "让外包前端和主控研发有了统一真相源接口，降低后续联调摩擦。",
                    "为后续“精准局部打回”提供了业务可观察基础，不再只停留在文档设计。",
                ],
                "remaining_gaps": [
                    "核心运行表当时仍为空，业务闭环还只能靠兼容映射观察。",
                    "还没有任何真实写回动作，无法证明审核意见能驱动局部返工。",
                    "还不能支撑产线级的真实吞吐和成本统计。",
                ],
                "scenarios": [
                    _build_core_status_scenario(),
                    _build_review_gateway_live_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-fourth",
                "label": "2026-03-08 第四轮任务",
                "description": "第四轮聚焦最小真实写侧闭环，展示真实 runs/node_runs/review_tasks/return_tickets 与 v+1 联动。",
                "source": "real-write",
                "technical_outcomes": [
                    "已写入 26 个 node_registry 种子，并补齐 runs/node_runs/review_tasks/return_tickets 开发态样本。",
                    "Review Gateway 最小写侧动作 approve / return / skip 已真实落库。",
                    "return -> rerun_plan_json -> v+1 -> rerun run/node_run 最小链路已打通。",
                ],
                "business_outcomes": [
                    "第一次证明“人审意见不是终点，而是能驱动局部回炉”的关键业务闭环可落地。",
                    "开始逼近“20+节点仅保留 4 个关键人工审核节点”的核心生产形态。",
                    "后续已经可以据此继续量化单次打回成本、返工范围和审核效率，而不是只看静态设计图。",
                ],
                "remaining_gaps": [
                    "当前仍是开发态样本，不是完整生产执行链和真实模型调度。",
                    "成本红线、产能目标、RAG 反思进化和质量指标还未进入真实闭环统计。",
                    "前台 Review Gateway 还没有完整操作页与审计能力，离生产可用仍有距离。",
                ],
                "scenarios": [
                    _build_round4_write_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-fifth",
                "label": "2026-03-08 第五轮任务",
                "description": "第五轮聚焦真相源统一与北极星指标骨架，让 acceptance / Node Trace / Review Gateway 优先围绕 core truth objects 说话。",
                "source": "real-db",
                "technical_outcomes": [
                    "新增统一 truth source 状态与 north star 指标摘要，不再由各页面各自拼装。",
                    "Review Gateway / acceptance / Node Trace 共享同一组 public.review_tasks/core_pipeline 读侧摘要。",
                    "补出 Data Center 最小摘要 API，为后续管理页和运营页提供统一入口。",
                ],
                "business_outcomes": [
                    "开始把“已经做了哪些接口”转成“离成本、质量、吞吐目标还有多远”的可见结果。",
                    "减少 core truth objects 与 compat 映射并存带来的协作摩擦，避免越做越乱。",
                    "为后续质量评测、审核团队运营、成本与吞吐控制提前铺设统一事实层。",
                ],
                "remaining_gaps": [
                    "当前仍是第五轮的最小指标骨架，还不是完整 Data Center 或生产级运营大盘。",
                    "单分钟成本仍缺真实成片分钟数，现阶段只能先看 NodeRun 级成本与耗时。",
                    "质量指标已可汇总，但还没有形成驱动自动路由与自动打回的完整策略闭环。",
                ],
                "scenarios": [
                    _build_round5_foundation_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-sixth",
                "label": "2026-03-08 第六轮任务",
                "description": "第六轮聚焦 artifact、auto_qc 与 model gateway 最小执行底座，继续为 T8.x 真执行主链铺路。",
                "source": "real-write",
                "technical_outcomes": [
                    "已为 core_pipeline.artifacts 补齐最小真实样本与读侧承接，不再只是表结构占位。",
                    "已打通 source_type=auto_qc 的最小自动质检打回票据与 rerun_plan_json。",
                    "已补出 Model Gateway 的共享合同与 provider/workflow/idempotency 预览骨架。",
                ],
                "business_outcomes": [
                    "系统开始具备“失败不是黑盒，而是可沉淀成 ticket、产物与重跑计划”的执行语义。",
                    "为后续接 ComfyUI/LLM/音频真调用前，先把统一执行合同和产物表达固定下来。",
                    "这会直接降低后续打开 T8.x 时的返工风险和多 Agent 协作成本。",
                ],
                "remaining_gaps": [
                    "当前仍是最小骨架，还没有打开全量模型执行与 callback worker。",
                    "artifact 已可写入，但还没有形成完整复用/继承策略。",
                    "auto_qc 已有最小闭环，但还未接多维 QC 结果和正式阈值策略引擎。",
                ],
                "scenarios": [
                    _build_round6_execution_foundation_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-seventh",
                "label": "2026-03-08 第七轮任务",
                "description": "第七轮把 model gateway 从静态预览推进到最小真实模型任务链，展示 model_jobs 提交与 callback 回写结果。",
                "source": "real-write",
                "technical_outcomes": [
                    "已打通 node_run -> model_jobs 的最小 submit 写侧，不再只有 route preview。",
                    "已打通按 job_id 幂等回写 model_jobs 与 node_runs 的最小 callback 链。",
                    "第七轮结果可在统一验收页直接看到 model_jobs 样本与 node_run 回写结果。",
                ],
                "business_outcomes": [
                    "后续打开 T8.x 时，Worker Agent 可复用统一 job 链，而不必各自实现提交/回调逻辑。",
                    "系统首次具备“模型任务台账”这一层，可追踪 provider、状态、结果和错误。",
                    "这让主控 Agent 对外部模型调用开始具备最小可审计性和可追踪性。",
                ],
                "remaining_gaps": [
                    "当前仍是最小真实链路，尚未接多 provider SDK 与回调 worker 进程化。",
                    "result_payload 还未分发到 variants / revision_logs 等更下游产物表。",
                    "超时补偿、重试控制和取消控制仍待后续补齐。",
                ],
                "scenarios": [
                    _build_round7_model_job_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-eighth",
                "label": "2026-03-08 第八轮任务",
                "description": "第八轮聚焦真实 LangGraph 接线与 N01/N02/N03 最小真实链，先让编排图真正开始运转起来。",
                "source": "real-db",
                "technical_outcomes": [
                    "已确认项目 venv 中 `langgraph` 可编译出真实 `CompiledStateGraph`，并把 `context_loader/review_task_creator` 注入收口到 `compile_pipeline()`。",
                    "已为 `N01/N02/N03` 注册最小真实 script handlers，通过 artifacts/meta 传递结构化 payload，而不是继续沿用通用 stub。",
                    "已实测在真实数据库 run 上跑通 `N01 -> N02 -> N03`，并通过 `pipeline_tasks` 真实入口完成 `run -> pause@N08 -> resume -> pause@N18`。",
                ],
                "business_outcomes": [
                    "这一步把前七轮沉淀的状态机、节点规格和执行表真正接进了可运行主链，不再只是文档与静态样本。",
                    "后续 `T8.x` Worker Agent 可以直接复用同一条 graph 运行时、暂停恢复语义与落库方式，而不是各自发明脚本阶段执行流。",
                    "对验收和管理视角来说，系统已经从“设计成熟”进入“真实入口已可暂停/恢复”的状态。",
                ],
                "remaining_gaps": [
                    "第八轮范围内已验收通过；这里保留的是后续轮次事项，而非本轮阻塞项。",
                    "生产级 hook、真实 LLM/TOS 写入与正式 EpisodeContext 来源仍待下一轮补齐。",
                    "Stage1~Stage4 其余节点仍待沿这条运行时主链继续展开。",
                ],
                "scenarios": [
                    _build_round8_graph_activation_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-ninth",
                "label": "2026-03-08 第九轮任务",
                "description": "第九轮已完成生产化依赖注入与 Stage1 真 Gate 闭环，把第八轮的最小真实 graph 推进成真实审核任务可落库、可放行、可继续执行的主链。",
                "source": "real-db",
                "technical_outcomes": [
                    "已新增 production `context_loader / review_task_creator`，并默认由 `pipeline_tasks` 在 compile graph 时注入。",
                    "已让 `N01` 回填 `episode_context_ref`，`N02` 优先读取真实 `EpisodeContext`，不再只依赖开发态 fallback。",
                    "已打通 `N08 -> review_tasks -> approve -> resume -> N09 -> N18` 的最小真实 Stage1 闭环。",
                ],
                "business_outcomes": [
                    "系统已从“可以暂停/恢复”推进到“Stage1 真审核闭环已经成立”，后续扩 Stage2~Stage4 时可沿同一条主链继续推进。",
                    "真实 `public.review_tasks`、`core_pipeline.runs/node_runs` 与验收页展示已围绕同一条生产语义主链收敛。",
                    "对管理与验收视角来说，第九轮把“可运行”进一步推进到“真实审核动作可以驱动图继续执行”。",
                ],
                "remaining_gaps": [
                    "Stage2~Stage4 仍待按同一路径继续生产化。",
                    "`EpisodeContext` 中仍有部分项目级字段待继续映射到正式真相源。",
                    "`N10~N26` 的真实模型 SDK / TOS 正式写入仍待后续轮次展开。",
                ],
                "scenarios": [
                    _build_round9_stage1_production_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-tenth",
                "label": "2026-03-08 第十轮任务",
                "description": "第十轮已完成 Stage2 shot 级真 Gate 闭环，让 `N18` 进入真实多任务审核、部分通过继续等待、全部通过后自动放行到下游。",
                "source": "real-db",
                "technical_outcomes": [
                    "已将 `N18` 的任务创建从单条占位升级为按真实 shot 列表批量创建 `public.review_tasks`。",
                    "已为 Stage2 `review_tasks` 写入 `scope_meta`，包含 `shot_id / scene_id / shot_number / global_shot_index`。",
                    "已打通 `N18 -> approve all -> resume -> N19 -> N21` 的最小真实 Stage2 闭环。",
                ],
                "business_outcomes": [
                    "系统已从 Stage1 真闭环推进到 Stage2 shot 级真闭环，首次具备真正的多 scope 聚合放行语义。",
                    "这让后续 Stage3/Stage4 可以继续沿同一套 production hook / review truth source 模式推进，而不用再造新流程。",
                    "对验收与管理视角来说，Stage2 的审核动作、运行推进与面板展示已经围绕同一条真实主链收敛。",
                ],
                "remaining_gaps": [
                    "Stage2 打回后的局部回炉仍待后续轮次继续收口。",
                    "`N21` 与 `N24` 仍待按相同方式继续生产化。",
                    "`N14~N20` 的真实模型执行与正式产物固化仍待后续轮次展开。",
                ],
                "scenarios": [
                    _build_round10_stage2_gate_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-eleventh",
                "label": "2026-03-08 第十一轮任务",
                "description": "第十一轮已完成 Stage3 episode 级真 Gate 闭环，让 `N21` 进入真实 episode 级审核任务、approve 后自动放行到下游。",
                "source": "real-db",
                "technical_outcomes": [
                    "已将 `N21` 的 scope 解析从通用 fallback 升级为显式 episode 级任务，并写入 `scope_meta`。",
                    "已打通 `N21 -> approve -> resume -> N22` 的最小真实 Stage3 闭环。",
                    "已为 `_build_resume_hint` 增加 stage 3 的 scope_items 处理，与 stage 1/2 保持一致。",
                ],
                "business_outcomes": [
                    "系统已从 Stage2 shot 级真闭环推进到 Stage3 episode 级真闭环，主链具备 `N08 -> N18 -> N21` 三阶段 Gate 真闭环。",
                    "为 Stage4 `N24` 串行三步打好基础，可沿同一套 production hook 继续推进。",
                    "对验收与管理视角来说，Stage3 的审核动作、运行推进与面板展示已围绕同一条真实主链收敛。",
                ],
                "remaining_gaps": [
                    "Stage3 打回后的回炉仍待后续轮次继续收口。",
                    "`N24` 仍待按相同方式继续生产化。",
                    "`N14~N20` 的真实模型执行与正式产物固化仍待后续轮次展开。",
                ],
                "scenarios": [
                    _build_round11_stage3_gate_scenario(),
                ],
            },
            {
                "id": "round-2026-03-08-twelfth",
                "label": "2026-03-08 第十二轮任务",
                "description": "第十二轮已完成 Stage4 episode 级串行 3 步真 Gate 闭环，让 `N24` 进入真实串行审核任务、三步 approve 后自动放行到 N25，4 Gate 全生产化收口。",
                "source": "real-db",
                "technical_outcomes": [
                    "已将 `N24` 的 scope 解析从通用 fallback 升级为显式 episode 级串行 3 步，并写入 `scope_meta`。",
                    "已升级 `_ensure_next_stage4_step`：uuid5 确定性 task_id、scope_id、scope_meta、due_at。",
                    "已打通 `N24 -> Step1/2/3 approve -> resume -> N25` 的最小真实 Stage4 闭环。",
                ],
                "business_outcomes": [
                    "4 Gate（N08/N18/N21/N24）全部生产化，主链 Gate 体系收口完成。",
                    "可专注 PLAN Phase 0 与 Phase 1，推进真实 handler 与执行链。",
                    "对验收与管理视角来说，Stage4 的串行 3 步审核、运行推进与面板展示已围绕同一条真实主链收敛。",
                ],
                "remaining_gaps": [
                    "Stage2/Stage3/Stage4 打回后的局部回炉仍待后续轮次继续收口。",
                    "`N14~N23` 的真实模型执行与正式产物固化仍待后续轮次展开。",
                ],
                "scenarios": [
                    _build_round12_stage4_gate_scenario(),
                ],
            },
        ]
    )


def _build_round4_write_scenario() -> dict[str, Any]:
    runs = _fetch_round4_seed_runs()
    run_ids = [run["id"] for run in runs]
    node_runs = _fetch_round4_seed_node_runs(run_ids)
    review_tasks = _fetch_round4_seed_review_tasks()
    return_tickets = _fetch_round4_seed_return_tickets()

    focus_run = next((run for run in runs if not run["is_rerun"]), runs[0] if runs else None)
    stage2_summary = _build_stage2_summary(review_tasks)
    stage4_summary = _build_stage4_summary(review_tasks)

    return {
        "id": "round4-real-write-closure",
        "label": "第四轮 · 最小真实写侧闭环",
        "description": "以 round4 开发态真实种子为真相源，验证 Gate 写回、ReturnTicket、rerun_plan_json 和 v+1 是否都可见。",
        "focus_run_id": focus_run["id"] if focus_run else "round4-empty",
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": return_tickets,
        "gate_list": _build_gate_list(review_tasks),
        "gate_detail": _build_gate_detail(review_tasks),
        "stage2_summary": stage2_summary,
        "stage4_summary": stage4_summary,
        "version_patch": {
            "seed_namespace": SEED_NAMESPACE,
            "runs": len(runs),
            "node_runs": len(node_runs),
            "review_tasks": len(review_tasks),
            "return_tickets": len(return_tickets),
            "focus_run_id": focus_run["id"] if focus_run else None,
        },
    }


def _build_round5_foundation_scenario() -> dict[str, Any]:
    runs = _fetch_round4_seed_runs() or _fetch_core_runs(limit=3)
    run_ids = [run["id"] for run in runs]
    node_runs = _fetch_round4_seed_node_runs(run_ids) if run_ids else _fetch_core_node_runs(limit=8)
    review_tasks = _fetch_round4_seed_review_tasks()
    return_tickets = _fetch_round4_seed_return_tickets()
    focus_run = next((run for run in runs if not run["is_rerun"]), runs[0] if runs else None)

    return {
        "id": "round5-truth-source-and-metrics",
        "label": "第五轮 · 真相源统一与指标骨架",
        "description": "以 public.review_tasks/core_pipeline 为主真相源，展示第五轮新增的 truth source 状态、北极星摘要和当前真实样本承接结果。",
        "focus_run_id": focus_run["id"] if focus_run else "round5-empty",
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": return_tickets,
        "gate_list": _build_gate_list(review_tasks),
        "gate_detail": _build_gate_detail(review_tasks),
        "stage2_summary": _build_stage2_summary(review_tasks),
        "stage4_summary": _build_stage4_summary(review_tasks),
        "version_patch": {
            "truth_source": get_truth_source_status(),
            "north_star_summary": get_north_star_summary(),
        },
    }


def _build_round6_execution_foundation_scenario() -> dict[str, Any]:
    runs = _fetch_round4_seed_runs() or _fetch_core_runs(limit=4)
    run_ids = [run["id"] for run in runs]
    node_runs = _fetch_round4_seed_node_runs(run_ids)
    review_tasks = _fetch_round4_seed_review_tasks()
    return_tickets = _fetch_round4_seed_return_tickets()
    auto_qc_tickets = _fetch_round6_auto_qc_tickets()
    artifacts = _fetch_round6_seed_artifacts()
    focus_run = next((run for run in runs if run["is_rerun"]), runs[0] if runs else None)

    return {
        "id": "round6-execution-foundation",
        "label": "第六轮 · Artifact / Auto QC / Model Gateway",
        "description": "展示第六轮新增的 artifact 固化、auto_qc ReturnTicket 和 model gateway route preview，证明主链执行底座开始成形。",
        "focus_run_id": focus_run["id"] if focus_run else "round6-empty",
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": [*auto_qc_tickets, *return_tickets],
        "artifacts": artifacts,
        "gate_list": _build_gate_list(review_tasks),
        "gate_detail": _build_gate_detail(review_tasks),
        "stage2_summary": _build_stage2_summary(review_tasks),
        "stage4_summary": _build_stage4_summary(review_tasks),
        "version_patch": {
            "artifact_count": len(artifacts),
            "auto_qc_ticket_count": len(auto_qc_tickets),
            "model_gateway_preview": preview_execution_route(["N09", "N14", "N20"]),
        },
    }


def _build_round7_model_job_scenario() -> dict[str, Any]:
    runs = _fetch_round4_seed_runs() or _fetch_core_runs(limit=4)
    run_ids = [run["id"] for run in runs]
    node_runs = _fetch_round4_seed_node_runs(run_ids)
    review_tasks = _fetch_round4_seed_review_tasks()
    return_tickets = _fetch_round4_seed_return_tickets()
    model_jobs = _fetch_round7_model_jobs()
    focus_run = next((run for run in runs if run["is_rerun"]), runs[0] if runs else None)

    return {
        "id": "round7-model-job-chain",
        "label": "第七轮 · Model Jobs / Callback",
        "description": "展示第七轮新增的 model_jobs 真实样本、job_id 回写链和 node_run 同步结果。",
        "focus_run_id": focus_run["id"] if focus_run else "round7-empty",
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": return_tickets,
        "model_jobs": model_jobs,
        "gate_list": _build_gate_list(review_tasks),
        "gate_detail": _build_gate_detail(review_tasks),
        "stage2_summary": _build_stage2_summary(review_tasks),
        "stage4_summary": _build_stage4_summary(review_tasks),
        "version_patch": {
            "model_job_count": len(model_jobs),
            "latest_model_job": model_jobs[0] if model_jobs else None,
        },
    }


def _build_round8_graph_activation_scenario() -> dict[str, Any]:
    runs = _fetch_core_runs(limit=4)
    node_runs = _fetch_core_node_runs(limit=8)
    focus_run = runs[0] if runs else None
    return {
        "id": "round8-graph-activation",
        "label": "第八轮 · LangGraph 真接线启动",
        "description": "展示第八轮从 graph compile 进入脚本阶段最小真实链后的运行态，用于持续观察 runs/node_runs/artifacts 的真实变化。",
        "focus_run_id": focus_run["id"] if focus_run else "",
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": [],
        "return_tickets": [],
        "gate_list": None,
        "gate_detail": None,
        "stage2_summary": None,
        "stage4_summary": None,
        "version_patch": {
            "round_status": "pass",
            "goal": "langgraph_runtime_wiring_and_minimal_script_chain",
            "target_tasks": ["T1", "T2", "T3", "T4", "T8.1", "T20"],
            "truth_source": get_truth_source_status(),
            "north_star_summary": get_north_star_summary(),
        },
    }


def _build_round9_stage1_production_scenario() -> dict[str, Any]:
    runs = _fetch_core_runs(limit=8)
    focus_run = next(
        (run for run in runs if run.get("current_node_id") == "N18"),
        runs[0] if runs else None,
    )
    focus_run_id = focus_run["id"] if focus_run else ""
    focus_episode_version_id = focus_run["episode_version_id"] if focus_run else ""
    node_runs = (
        fetch_all(
            """
            select
                id::text as id,
                run_id::text as run_id,
                episode_version_id::text as episode_version_id,
                node_id,
                agent_role,
                status,
                attempt_no,
                retry_count,
                auto_reject_count,
                scope_hash,
                input_ref,
                output_ref,
                model_provider,
                model_endpoint,
                comfyui_workflow_id,
                api_calls,
                token_in,
                token_out,
                gpu_seconds,
                cost_cny,
                rag_query_count,
                quality_score,
                error_code,
                error_message,
                tags,
                started_at,
                ended_at,
                duration_s,
                created_at,
                updated_at
            from core_pipeline.node_runs
            where run_id::text = %s
            order by updated_at desc
            limit 12
            """,
            (focus_run_id,),
        )
        if focus_run_id
        else []
    )
    review_tasks = (
        [
            {
                **row,
                "payload": row["payload_json"] or {},
            }
            for row in fetch_all(
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
                where episode_version_id::text = %s
                order by stage_no asc, review_step_no asc, created_at asc
                """,
                (focus_episode_version_id,),
            )
        ]
        if focus_episode_version_id
        else []
    )
    return {
        "id": "round9-stage1-production-plan",
        "label": "第九轮 · 生产化依赖注入与 Stage1 真闭环",
        "description": "展示第九轮把 production hooks、真实 review_tasks 和 Stage1 放行恢复动作接到同一条 graph 主链后的真实运行态。",
        "focus_run_id": focus_run_id,
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": [],
        "gate_list": _build_gate_list(review_tasks) if review_tasks else None,
        "gate_detail": _build_gate_detail(review_tasks) if review_tasks else None,
        "stage2_summary": _build_stage2_summary(review_tasks) if review_tasks else None,
        "stage4_summary": None,
        "version_patch": {
            "round_status": "pass",
            "goal": "production_hooks_and_stage1_real_gate_closure",
            "target_tasks": ["T1", "T3", "T4", "T8.1", "T20", "T21"],
            "focus_episode_version_id": focus_episode_version_id,
            "focus_run_id": focus_run_id,
            "truth_source": get_truth_source_status(),
            "north_star_summary": get_north_star_summary(),
        },
    }


def _build_round10_stage2_gate_scenario() -> dict[str, Any]:
    runs = _fetch_core_runs(limit=10)
    focus_run = next(
        (run for run in runs if run.get("current_node_id") == "N21"),
        runs[0] if runs else None,
    )
    focus_run_id = focus_run["id"] if focus_run else ""
    focus_episode_version_id = focus_run["episode_version_id"] if focus_run else ""
    node_runs = (
        fetch_all(
            """
            select
                id::text as id,
                run_id::text as run_id,
                episode_version_id::text as episode_version_id,
                node_id,
                agent_role,
                status,
                attempt_no,
                retry_count,
                auto_reject_count,
                scope_hash,
                input_ref,
                output_ref,
                model_provider,
                model_endpoint,
                comfyui_workflow_id,
                api_calls,
                token_in,
                token_out,
                gpu_seconds,
                cost_cny,
                rag_query_count,
                quality_score,
                error_code,
                error_message,
                tags,
                started_at,
                ended_at,
                duration_s,
                created_at,
                updated_at
            from core_pipeline.node_runs
            where run_id::text = %s
            order by updated_at desc
            limit 16
            """,
            (focus_run_id,),
        )
        if focus_run_id
        else []
    )
    review_tasks = (
        [
            {
                **row,
                "payload": row["payload_json"] or {},
            }
            for row in fetch_all(
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
                where episode_version_id::text = %s
                order by stage_no asc, review_step_no asc, created_at asc
                """,
                (focus_episode_version_id,),
            )
        ]
        if focus_episode_version_id
        else []
    )
    return {
        "id": "round10-stage2-gate-closure",
        "label": "第十轮 · Stage2 shot 级真闭环",
        "description": "展示第十轮将 `N18` 升级为真实多 shot 审核任务，并在全部 shot approve 后自动放行到下游后的真实运行态。",
        "focus_run_id": focus_run_id,
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": [],
        "gate_list": _build_gate_list(review_tasks) if review_tasks else None,
        "gate_detail": _build_gate_detail(review_tasks) if review_tasks else None,
        "stage2_summary": _build_stage2_summary(review_tasks) if review_tasks else None,
        "stage4_summary": _build_stage4_summary(review_tasks) if review_tasks else None,
        "version_patch": {
            "round_status": "pass",
            "goal": "stage2_real_shot_gate_closure",
            "target_tasks": ["T4", "T5", "T8.4", "T20", "T21"],
            "focus_episode_version_id": focus_episode_version_id,
            "focus_run_id": focus_run_id,
            "truth_source": get_truth_source_status(),
            "north_star_summary": get_north_star_summary(),
        },
    }


def _build_round11_stage3_gate_scenario() -> dict[str, Any]:
    runs = _fetch_core_runs(limit=10)
    focus_run = next(
        (run for run in runs if run.get("current_node_id") in ("N21", "N24")),
        runs[0] if runs else None,
    )
    focus_run_id = focus_run["id"] if focus_run else ""
    focus_episode_version_id = focus_run["episode_version_id"] if focus_run else ""
    node_runs = (
        fetch_all(
            """
            select
                id::text as id,
                run_id::text as run_id,
                episode_version_id::text as episode_version_id,
                node_id,
                agent_role,
                status,
                attempt_no,
                retry_count,
                auto_reject_count,
                scope_hash,
                input_ref,
                output_ref,
                model_provider,
                model_endpoint,
                comfyui_workflow_id,
                api_calls,
                token_in,
                token_out,
                gpu_seconds,
                cost_cny,
                rag_query_count,
                quality_score,
                error_code,
                error_message,
                tags,
                started_at,
                ended_at,
                duration_s,
                created_at,
                updated_at
            from core_pipeline.node_runs
            where run_id::text = %s
            order by updated_at desc
            limit 16
            """,
            (focus_run_id,),
        )
        if focus_run_id
        else []
    )
    review_tasks = (
        [
            {
                **row,
                "payload": row["payload_json"] or {},
            }
            for row in fetch_all(
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
                where episode_version_id::text = %s
                order by stage_no asc, review_step_no asc, created_at asc
                """,
                (focus_episode_version_id,),
            )
        ]
        if focus_episode_version_id
        else []
    )
    return {
        "id": "round11-stage3-gate-closure",
        "label": "第十一轮 · Stage3 episode 级真闭环",
        "description": "展示第十一轮将 `N21` 升级为真实 episode 级审核任务，并在 approve 后自动放行到下游后的真实运行态。",
        "focus_run_id": focus_run_id,
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": [],
        "gate_list": _build_gate_list(review_tasks) if review_tasks else None,
        "gate_detail": _build_gate_detail(review_tasks) if review_tasks else None,
        "stage2_summary": _build_stage2_summary(review_tasks) if review_tasks else None,
        "stage4_summary": _build_stage4_summary(review_tasks) if review_tasks else None,
        "version_patch": {
            "round_status": "pass",
            "goal": "stage3_real_episode_gate_closure",
            "target_tasks": ["T4", "T5", "T8.4", "T20", "T21"],
            "focus_episode_version_id": focus_episode_version_id,
            "focus_run_id": focus_run_id,
            "truth_source": get_truth_source_status(),
            "north_star_summary": get_north_star_summary(),
        },
    }


def _build_round12_stage4_gate_scenario() -> dict[str, Any]:
    runs = _fetch_core_runs(limit=10)
    focus_run = next(
        (run for run in runs if run.get("current_node_id") in ("N24", "N25")),
        runs[0] if runs else None,
    )
    focus_run_id = focus_run["id"] if focus_run else ""
    focus_episode_version_id = focus_run["episode_version_id"] if focus_run else ""
    node_runs = (
        fetch_all(
            """
            select
                id::text as id,
                run_id::text as run_id,
                episode_version_id::text as episode_version_id,
                node_id,
                agent_role,
                status,
                attempt_no,
                retry_count,
                auto_reject_count,
                scope_hash,
                input_ref,
                output_ref,
                model_provider,
                model_endpoint,
                comfyui_workflow_id,
                api_calls,
                token_in,
                token_out,
                gpu_seconds,
                cost_cny,
                rag_query_count,
                quality_score,
                error_code,
                error_message,
                tags,
                started_at,
                ended_at,
                duration_s,
                created_at,
                updated_at
            from core_pipeline.node_runs
            where run_id::text = %s
            order by updated_at desc
            limit 16
            """,
            (focus_run_id,),
        )
        if focus_run_id
        else []
    )
    review_tasks = (
        [
            {
                **row,
                "payload": row["payload_json"] or {},
            }
            for row in fetch_all(
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
                where episode_version_id::text = %s
                order by stage_no asc, review_step_no asc, created_at asc
                """,
                (focus_episode_version_id,),
            )
        ]
        if focus_episode_version_id
        else []
    )
    return {
        "id": "round12-stage4-gate-closure",
        "label": "第十二轮 · Stage4 串行 3 步真闭环",
        "description": "展示第十二轮将 `N24` 升级为真实 episode 级串行 3 步审核任务，并在三步 approve 后自动放行到 N25 后的真实运行态，4 Gate 全生产化收口。",
        "focus_run_id": focus_run_id,
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": review_tasks,
        "return_tickets": [],
        "gate_list": _build_gate_list(review_tasks) if review_tasks else None,
        "gate_detail": _build_gate_detail(review_tasks) if review_tasks else None,
        "stage2_summary": _build_stage2_summary(review_tasks) if review_tasks else None,
        "stage4_summary": _build_stage4_summary(review_tasks) if review_tasks else None,
        "version_patch": {
            "round_status": "pass",
            "goal": "stage4_real_serial_gate_closure",
            "target_tasks": ["T4", "T5", "T8.4", "T20", "T21"],
            "focus_episode_version_id": focus_episode_version_id,
            "focus_run_id": focus_run_id,
            "truth_source": get_truth_source_status(),
            "north_star_summary": get_north_star_summary(),
        },
    }


def list_review_tasks(limit: int = 20) -> dict[str, Any]:
    real_review_tasks = fetch_all(
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
        order by updated_at desc
        limit %s
        """,
        (limit,),
    )

    if real_review_tasks:
        items = [
            {
                "review_task_id": row["id"],
                "episode_id": row["episode_id"],
                "episode_version_id": row["episode_version_id"],
                "stage_no": row["stage_no"],
                "gate_node_id": row["gate_node_id"],
                "review_step_no": row["review_step_no"],
                "reviewer_role": row["reviewer_role"],
                "review_granularity": row["review_granularity"],
                "anchor_type": row["anchor_type"],
                "anchor_id": row["anchor_id"],
                "status": row["status"],
                "priority": row["priority"],
                "openclaw_session_id": row["openclaw_session_id"],
                "due_at": None,
                "payload": row["payload_json"] or {},
            }
            for row in real_review_tasks
        ]
        return {"source": "public.review_tasks", "items": to_jsonable(items), "total": len(items)}

    compat_items = []
    for episode_id in _fetch_latest_episode_ids(limit=limit):
        for task in [
            _map_stage_task_to_review_task(row, row["episode_version_id"] or f"compat-episode-version-{episode_id}")
            for row in _fetch_stage_tasks_for_episode(episode_id)
        ]:
            compat_items.append(
                {
                    "review_task_id": task["id"],
                    "episode_id": task["episode_id"],
                    "episode_version_id": task["episode_version_id"],
                    "stage_no": task["stage_no"],
                    "gate_node_id": task["gate_node_id"],
                    "review_step_no": task["review_step_no"],
                    "reviewer_role": task["reviewer_role"],
                    "review_granularity": task["review_granularity"],
                    "anchor_type": task["anchor_type"],
                    "anchor_id": task["anchor_id"],
                    "status": task["status"],
                    "priority": task["priority"],
                    "openclaw_session_id": task["openclaw_session_id"],
                    "due_at": None,
                    "payload": task["payload"],
                }
            )
    compat_items = compat_items[:limit]
    return {
        "source": "compat:public.stage_tasks",
        "items": to_jsonable(compat_items),
        "total": len(compat_items),
    }


def get_review_task_detail(task_id: str) -> dict[str, Any] | None:
    row = fetch_one(
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
            priority,
            openclaw_session_id,
            payload_json,
            created_at,
            updated_at
        from public.review_tasks
        where id::text = %s
        limit 1
        """,
        (task_id,),
    )
    if row:
        review_points = fetch_all(
            """
            select
                timestamp_ms,
                issue_type,
                severity,
                comment
            from public.review_points
            where review_task_id::text = %s
            order by created_at asc
            """,
            (task_id,),
        )
        return to_jsonable(
            {
                "source": "public.review_tasks",
                "detail": {
                    "review_task_id": row["id"],
                    "episode_id": row["episode_id"],
                    "episode_version_id": row["episode_version_id"],
                    "stage_no": row["stage_no"],
                    "gate_node_id": row["gate_node_id"],
                    "review_step_no": row["review_step_no"],
                    "reviewer_role": row["reviewer_role"],
                    "review_granularity": row["review_granularity"],
                    "anchor_type": row["anchor_type"],
                    "anchor_id": row["anchor_id"],
                    "status": row["status"],
                    "priority": row["priority"],
                    "openclaw_session_id": row["openclaw_session_id"],
                    "payload": row["payload_json"] or {},
                    "review_points": review_points,
                },
            }
        )

    compat_row = fetch_one(
        """
        select
            st.id::text as id,
            st.episode_id::text as episode_id,
            st.stage_no,
            st.status,
            st.priority_group::text as priority_group,
            st.assigned_user_id::text as assigned_user_id,
            st.payload_json,
            st.created_at,
            st.updated_at,
            st.reviewer_role,
            st.review_step_no,
            st.anchor_type::text as anchor_type,
            st.anchor_id::text as anchor_id,
            st.openclaw_session_id,
            ev.id::text as episode_version_id
        from public.stage_tasks st
        left join lateral (
            select id
            from public.episode_versions
            where episode_id = st.episode_id
            order by created_at desc
            limit 1
        ) ev on true
        where st.id::text = %s
        limit 1
        """,
        (task_id,),
    )
    if compat_row is None:
        return None

    task = _map_stage_task_to_review_task(
        compat_row,
        compat_row["episode_version_id"] or f"compat-episode-version-{compat_row['episode_id']}",
    )
    return to_jsonable(
        {
            "source": "compat:public.stage_tasks",
            "detail": {
                "review_task_id": task["id"],
                "episode_id": task["episode_id"],
                "episode_version_id": task["episode_version_id"],
                "stage_no": task["stage_no"],
                "gate_node_id": task["gate_node_id"],
                "review_step_no": task["review_step_no"],
                "reviewer_role": task["reviewer_role"],
                "review_granularity": task["review_granularity"],
                "anchor_type": task["anchor_type"],
                "anchor_id": task["anchor_id"],
                "status": task["status"],
                "priority": task["priority"],
                "openclaw_session_id": task["openclaw_session_id"],
                "payload": task["payload"],
                "review_points": [],
            },
        }
    )


def get_stage_summary(stage_no: int, episode_id: str) -> dict[str, Any] | None:
    real_review_tasks = fetch_all(
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
        where episode_id::text = %s
        order by created_at asc
        """,
        (episode_id,),
    )
    if real_review_tasks:
        review_tasks = [
            {
                **row,
                "payload": row["payload_json"] or {},
            }
            for row in real_review_tasks
        ]
        if stage_no == 2:
            return to_jsonable(_build_stage2_summary(review_tasks))
        if stage_no == 3:
            return to_jsonable(_build_stage3_summary(review_tasks))
        if stage_no == 4:
            return to_jsonable(_build_stage4_summary(review_tasks))
        return None

    rows = _fetch_stage_tasks_for_episode(episode_id)
    if not rows:
        return None
    episode_version = _fetch_latest_episode_version(episode_id)
    review_tasks = [
        _map_stage_task_to_review_task(row, episode_version["id"] if episode_version else f"compat-episode-version-{episode_id}")
        for row in rows
    ]
    if stage_no == 2:
        return to_jsonable(_build_stage2_summary(review_tasks))
    if stage_no == 3:
        return to_jsonable(_build_stage3_summary(review_tasks))
    if stage_no == 4:
        return to_jsonable(_build_stage4_summary(review_tasks))
    return None


def list_dramas(limit: int = 50) -> dict[str, Any]:
    """List dramas (episodes) with aggregated run/cost/status info."""
    rows = fetch_all(
        """
        select
            e.id::text as episode_id,
            coalesce(ev.version_no, 1) as version_no,
            ev.status as version_status,
            ev.id::text as episode_version_id,
            ev.created_at as version_created_at,
            ev.updated_at as version_updated_at,
            (select count(*) from core_pipeline.runs r where r.episode_id = e.id) as run_count,
            (select count(*) from core_pipeline.node_runs nr
             join core_pipeline.runs r on r.id = nr.run_id
             where r.episode_id = e.id) as node_run_count,
            (select coalesce(sum(nr.cost_cny), 0) from core_pipeline.node_runs nr
             join core_pipeline.runs r on r.id = nr.run_id
             where r.episode_id = e.id) as total_cost_cny,
            (select r.current_node_id from core_pipeline.runs r
             where r.episode_id = e.id order by r.updated_at desc limit 1) as current_node_id,
            (select r.status from core_pipeline.runs r
             where r.episode_id = e.id order by r.updated_at desc limit 1) as latest_run_status,
            (select count(*) from public.review_tasks rt
             where rt.episode_id = e.id and rt.status = 'pending') as pending_review_count
        from public.episodes e
        left join lateral (
            select id, version_no, status, created_at, updated_at
            from public.episode_versions
            where episode_id = e.id
            order by created_at desc
            limit 1
        ) ev on true
        order by coalesce(ev.updated_at, e.created_at) desc
        limit %s
        """,
        (limit,),
    )
    return to_jsonable({
        "source": "real-db",
        "items": rows,
        "total": len(rows),
    })


def list_episodes_for_drama(episode_id: str) -> dict[str, Any]:
    """List episode versions and their run/node status for a specific episode."""
    versions = fetch_all(
        """
        select
            ev.id::text as episode_version_id,
            ev.episode_id::text as episode_id,
            ev.version_no,
            ev.status,
            ev.created_at,
            ev.updated_at
        from public.episode_versions ev
        where ev.episode_id::text = %s
        order by ev.version_no desc
        """,
        (episode_id,),
    )

    # For the latest version, fetch node_runs
    node_runs: list[dict[str, Any]] = []
    if versions:
        latest_version_id = versions[0]["episode_version_id"]
        node_runs = fetch_all(
            """
            select
                nr.id::text as id,
                nr.run_id::text as run_id,
                nr.node_id,
                nr.agent_role,
                nr.status,
                nr.attempt_no,
                nr.retry_count,
                nr.auto_reject_count,
                nr.input_ref,
                nr.output_ref,
                nr.model_provider,
                nr.model_endpoint,
                nr.api_calls,
                nr.token_in,
                nr.token_out,
                nr.gpu_seconds,
                nr.cost_cny,
                nr.quality_score,
                nr.error_code,
                nr.error_message,
                nr.started_at,
                nr.ended_at,
                nr.duration_s,
                nr.created_at,
                nr.updated_at
            from core_pipeline.node_runs nr
            where nr.episode_version_id::text = %s
            order by nr.created_at asc
            """,
            (latest_version_id,),
        )

    # Fetch runs for this episode
    runs = fetch_all(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id,
            status,
            current_node_id,
            is_rerun,
            rerun_from_ticket_id::text as rerun_from_ticket_id,
            started_at,
            finished_at,
            created_at,
            updated_at
        from core_pipeline.runs
        where episode_id::text = %s
        order by updated_at desc
        """,
        (episode_id,),
    )

    return to_jsonable({
        "source": "real-db",
        "episode_id": episode_id,
        "versions": versions,
        "runs": runs,
        "node_runs": node_runs,
    })


def list_artifacts_by_node_run(node_run_id: str) -> dict[str, Any]:
    """List artifacts produced by a specific node_run."""
    rows = fetch_all(
        """
        select
            id::text as id,
            episode_version_id::text as episode_version_id,
            node_run_id::text as node_run_id,
            artifact_type,
            anchor_type::text as anchor_type,
            anchor_id::text as anchor_id,
            time_range,
            resource_url,
            preview_url,
            meta_json,
            created_at
        from core_pipeline.artifacts
        where node_run_id::text = %s
        order by created_at asc
        """,
        (node_run_id,),
    )
    return to_jsonable({
        "source": "real-db",
        "items": rows,
        "total": len(rows),
    })


def get_tos_presigned_url(tos_url: str) -> dict[str, Any]:
    """Generate a presigned HTTP URL from a tos:// reference."""
    try:
        from backend.common.tos_client import generate_presigned_url, _parse_key
        key = _parse_key(tos_url)
        http_url = generate_presigned_url(key, expires_in=3600)
        return {"tos_url": tos_url, "http_url": http_url, "expires_in": 3600}
    except Exception as e:
        return {"tos_url": tos_url, "http_url": None, "error": str(e)}


def list_return_tickets(
    episode_id: str | None = None,
    status: str | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """List return tickets, optionally filtered by episode_id and status."""
    conditions = []
    params: list[Any] = []

    if episode_id:
        conditions.append("rt.episode_id::text = %s")
        params.append(episode_id)
    if status:
        conditions.append("rt.status = %s")
        params.append(status)

    where_clause = ""
    if conditions:
        where_clause = "where " + " and ".join(conditions)

    params.append(limit)
    rows = fetch_all(
        f"""
        select
            rt.id::text as id,
            rt.episode_id::text as episode_id,
            rt.episode_version_id::text as episode_version_id,
            rt.review_task_id::text as review_task_id,
            rt.source_type,
            rt.source_node_id,
            rt.stage_no,
            rt.anchor_type::text as anchor_type,
            rt.anchor_id::text as anchor_id,
            rt.timestamp_ms,
            rt.issue_type,
            rt.severity,
            rt.comment,
            rt.created_by_role::text as created_by_role,
            rt.suggested_stage_back,
            rt.system_root_cause_node_id,
            rt.rerun_plan_json,
            rt.status,
            rt.resolved_version_id::text as resolved_version_id,
            rt.created_at,
            rt.updated_at
        from core_pipeline.return_tickets rt
        {where_clause}
        order by rt.updated_at desc
        limit %s
        """,
        tuple(params),
    )

    return to_jsonable({
        "source": "real-db",
        "items": rows,
        "total": len(rows),
    })


def get_node_trace_payload() -> dict[str, Any]:
    counts = _core_table_counts()
    north_star_summary = get_north_star_summary()
    real_runs = _fetch_round4_seed_runs()
    focus_run = real_runs[0] if real_runs else None
    real_node_runs = _fetch_round4_seed_node_runs([focus_run["id"]]) if focus_run else []
    real_return_tickets = _fetch_round4_seed_return_tickets()
    episode_ids = _fetch_latest_episode_ids(limit=1)
    if not episode_ids:
        return {
            "source": "real-db",
            "core_counts": counts,
            "focus_run_id": focus_run["id"] if focus_run else None,
            "real_runs": real_runs[:3],
            "real_node_runs": real_node_runs,
            "real_return_tickets": real_return_tickets[:3],
            "compat_projection": None,
            "registry_validation": get_registry_validation_payload(),
            "north_star_summary": north_star_summary,
        }

    rows = _fetch_stage_tasks_for_episode(episode_ids[0])
    current = _derive_current_stage_row(rows)
    compat_projection = {
        "episode_id": episode_ids[0],
        "current_stage_no": int(current["stage_no"]) if current else None,
        "current_gate_node_id": (
            STAGE_TO_GATE_NODE[int(current["stage_no"])] if current else None
        ),
        "current_status": current["status"] if current else None,
        "timeline": [
            {
                "stage_no": int(row["stage_no"]),
                "gate_node_id": STAGE_TO_GATE_NODE[int(row["stage_no"])],
                "status": row["status"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        ],
    }
    return to_jsonable(
        {
            "source": "real-db",
            "core_counts": counts,
            "focus_run_id": focus_run["id"] if focus_run else None,
            "real_runs": real_runs[:3],
            "real_node_runs": real_node_runs,
            "real_return_tickets": real_return_tickets[:3],
            "compat_projection": compat_projection,
            "registry_validation": get_registry_validation_payload(),
            "north_star_summary": north_star_summary,
        }
    )
