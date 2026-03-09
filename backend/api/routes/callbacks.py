"""Model callback and job submission endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.orchestrator.write_side import (
    apply_model_job_callback,
    auto_reject_node_run,
    submit_model_job,
)

router = APIRouter()


# ── Request models ────────────────────────────────────────────────────


class ModelSubmitRequest(BaseModel):
    overrides: dict[str, Any] | None = None
    seed_namespace: str | None = None


class ModelCallbackRequest(BaseModel):
    status: str = "succeeded"
    output_ref: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    metrics: dict[str, Any] | None = None


class AutoQCRejectRequest(BaseModel):
    issue_type: str = "auto_qc_reject"
    comment: str = "auto qc reject"
    severity: str = "major"
    quality_score: float | None = None
    error_code: str = "auto_qc_reject"


# ── Endpoints ─────────────────────────────────────────────────────────


@router.post("/model-jobs/{node_run_id}/submit")
def submit_job(node_run_id: str, body: ModelSubmitRequest | None = None) -> dict[str, Any]:
    """Submit a node run for model execution."""
    body = body or ModelSubmitRequest()
    try:
        return submit_model_job(
            node_run_id,
            overrides=body.overrides,
            seed_namespace=body.seed_namespace,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/model-callbacks/{job_id}")
def model_callback(job_id: str, body: ModelCallbackRequest | None = None) -> dict[str, Any]:
    """Receive model job completion callback."""
    body = body or ModelCallbackRequest()
    try:
        return apply_model_job_callback(
            job_id,
            status=body.status,
            output_ref=body.output_ref,
            error_code=body.error_code,
            error_message=body.error_message,
            metrics=body.metrics,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/node-runs/{node_run_id}/auto-qc-reject")
def auto_qc_reject(node_run_id: str, body: AutoQCRejectRequest | None = None) -> dict[str, Any]:
    """Auto-reject a node run due to QC failure."""
    body = body or AutoQCRejectRequest()
    try:
        return auto_reject_node_run(
            node_run_id,
            issue_type=body.issue_type,
            comment=body.comment,
            severity=body.severity,
            quality_score=body.quality_score,
            error_code=body.error_code,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
