"""Pipeline execution endpoints — create runs, start/resume pipelines."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


# ── Request models ────────────────────────────────────────────────────


class CreateRunRequest(BaseModel):
    episode_id: str
    episode_version_id: str
    is_rerun: bool = False
    rerun_node_ids: list[str] | None = None
    rerun_from_ticket_id: str | None = None


class ResumeRequest(BaseModel):
    thread_id: str
    run_id: str
    gate_decision: dict[str, Any]


class RunPipelineSyncRequest(BaseModel):
    """Run pipeline synchronously (for testing without Celery)."""
    episode_id: str
    episode_version_id: str
    is_rerun: bool = False
    rerun_node_ids: list[str] | None = None
    rerun_from_ticket_id: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post("/runs")
def create_run(body: CreateRunRequest) -> dict[str, Any]:
    """Create and start a pipeline run via Celery task."""
    from backend.pipeline_tasks import run_pipeline

    result = run_pipeline.delay(
        episode_id=body.episode_id,
        episode_version_id=body.episode_version_id,
        is_rerun=body.is_rerun,
        rerun_node_ids=body.rerun_node_ids,
        rerun_from_ticket_id=body.rerun_from_ticket_id,
    )

    return {
        "celery_task_id": result.id,
        "status": "submitted",
        "message": "Pipeline run submitted to Celery worker",
    }


@router.post("/runs/sync")
def create_run_sync(body: RunPipelineSyncRequest) -> dict[str, Any]:
    """Run pipeline synchronously (bypass Celery, for testing)."""
    from backend.pipeline_tasks import run_pipeline

    result = run_pipeline(
        episode_id=body.episode_id,
        episode_version_id=body.episode_version_id,
        is_rerun=body.is_rerun,
        rerun_node_ids=body.rerun_node_ids,
        rerun_from_ticket_id=body.rerun_from_ticket_id,
    )
    return result


@router.post("/runs/resume")
def resume_run(body: ResumeRequest) -> dict[str, Any]:
    """Resume pipeline after gate decision via Celery task."""
    from backend.pipeline_tasks import resume_pipeline

    result = resume_pipeline.delay(
        thread_id=body.thread_id,
        run_id=body.run_id,
        gate_decision=body.gate_decision,
    )

    return {
        "celery_task_id": result.id,
        "status": "submitted",
        "message": "Pipeline resume submitted to Celery worker",
    }


@router.post("/runs/resume/sync")
def resume_run_sync(body: ResumeRequest) -> dict[str, Any]:
    """Resume pipeline synchronously (bypass Celery, for testing)."""
    from backend.pipeline_tasks import resume_pipeline

    return resume_pipeline(
        thread_id=body.thread_id,
        run_id=body.run_id,
        gate_decision=body.gate_decision,
    )


@router.get("/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    """Get run status."""
    from backend.common.db import fetch_one

    row = fetch_one(
        """
        SELECT
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id,
            status,
            current_node_id,
            current_stage_no,
            plan_json,
            langgraph_thread_id,
            created_at::text as created_at,
            updated_at::text as updated_at,
            started_at::text as started_at,
            finished_at::text as finished_at
        FROM core_pipeline.runs
        WHERE id::text = %s
        LIMIT 1
        """,
        (run_id,),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="run not found")
    return dict(row)


@router.get("/runs/{run_id}/state")
def get_run_state(run_id: str) -> dict[str, Any]:
    """Get the LangGraph state for a run (if checkpointed)."""
    from backend.common.db import fetch_one

    row = fetch_one(
        """
        SELECT langgraph_thread_id, plan_json
        FROM core_pipeline.runs
        WHERE id::text = %s
        LIMIT 1
        """,
        (run_id,),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="run not found")

    thread_id = row.get("langgraph_thread_id")
    if not thread_id:
        return {"error": "no thread_id", "run_id": run_id}

    try:
        from backend.pipeline_tasks import compiled_graph_session

        with compiled_graph_session(use_checkpointer=True) as compiled:
            config = {"configurable": {"thread_id": thread_id}}
            state = compiled.get_state(config)
            return {
                "run_id": run_id,
                "thread_id": thread_id,
                "next": list(state.next) if state.next else [],
                "values": _safe_serialize(state.values),
            }
    except Exception as exc:
        return {"error": str(exc), "run_id": run_id}


def _safe_serialize(obj: Any) -> Any:
    """Make state JSON-serializable."""
    if isinstance(obj, dict):
        return {k: _safe_serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_safe_serialize(item) for item in obj]
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    return str(obj)
