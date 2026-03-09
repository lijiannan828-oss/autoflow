"""Review task endpoints — wraps write_side and db_read_side functions."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.orchestrator.db_read_side import (
    get_review_task_detail,
    list_review_tasks,
)
from backend.orchestrator.write_side import (
    approve_review_task,
    return_review_task,
    skip_review_task,
)

router = APIRouter()


def _maybe_resume_pipeline(result: dict[str, Any]) -> dict[str, Any]:
    resume_hint = result.get("resume_hint")
    if not isinstance(resume_hint, dict):
        return result

    from backend.pipeline_tasks import resume_pipeline

    resume_result = resume_pipeline.run(
        thread_id=str(resume_hint["thread_id"]),
        run_id=str(resume_hint["run_id"]),
        gate_decision=dict(resume_hint["gate_decision"]),
    )
    merged = dict(result)
    merged["resume_result"] = resume_result
    return merged


# ── Request models ────────────────────────────────────────────────────


class ApproveRequest(BaseModel):
    decision_comment: str = ""
    review_points: list[dict[str, Any]] | None = None


class ReturnRequest(BaseModel):
    decision_comment: str = ""
    review_points: list[dict[str, Any]] | None = None


class SkipRequest(BaseModel):
    reason: str = "optional_step_skipped"


# ── Endpoints ─────────────────────────────────────────────────────────


@router.get("/review-tasks")
def list_tasks(limit: int = Query(default=20, ge=1, le=100)) -> dict[str, Any]:
    """List active review tasks."""
    return list_review_tasks(limit=limit)


@router.get("/review-tasks/{task_id}")
def task_detail(task_id: str) -> dict[str, Any]:
    """Fetch single review task detail."""
    result = get_review_task_detail(task_id)
    if result is None:
        raise HTTPException(status_code=404, detail="review task not found")
    return result


@router.post("/review-tasks/{task_id}/approve")
def approve(task_id: str, body: ApproveRequest | None = None) -> dict[str, Any]:
    """Approve a review task."""
    body = body or ApproveRequest()
    try:
        result = approve_review_task(
            task_id,
            body.decision_comment,
            body.review_points,
        )
        return _maybe_resume_pipeline(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/review-tasks/{task_id}/return")
def return_task(task_id: str, body: ReturnRequest | None = None) -> dict[str, Any]:
    """Return (reject) a review task — creates a ReturnTicket."""
    body = body or ReturnRequest()
    try:
        result = return_review_task(
            task_id,
            body.decision_comment,
            body.review_points,
        )
        return _maybe_resume_pipeline(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/review-tasks/{task_id}/skip")
def skip(task_id: str, body: SkipRequest | None = None) -> dict[str, Any]:
    """Skip a review task (Stage4 Step1 only)."""
    body = body or SkipRequest()
    try:
        return skip_review_task(task_id, body.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
