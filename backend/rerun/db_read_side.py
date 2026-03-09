from __future__ import annotations

from typing import Any

from backend.common.contracts.serialization import to_jsonable
from backend.common.db import fetch_all, fetch_value


def get_rerun_counts() -> dict[str, int]:
    return {
        "return_tickets": int(
            fetch_value("select count(*) from core_pipeline.return_tickets") or 0
        ),
        "review_points": int(
            fetch_value("select count(*) from public.review_points") or 0
        ),
    }


def get_latest_return_tickets(limit: int = 5) -> list[dict[str, Any]]:
    rows = fetch_all(
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
            severity::text as severity,
            comment,
            created_by_role,
            suggested_stage_back,
            system_root_cause_node_id,
            rerun_plan_json,
            status,
            resolved_version_id::text as resolved_version_id,
            created_at,
            updated_at
        from core_pipeline.return_tickets
        order by updated_at desc
        limit %s
        """,
        (limit,),
    )
    return to_jsonable(rows)


def get_rerun_status_payload() -> dict[str, Any]:
    return {
        "counts": get_rerun_counts(),
        "latest_return_tickets": get_latest_return_tickets(limit=3),
    }
