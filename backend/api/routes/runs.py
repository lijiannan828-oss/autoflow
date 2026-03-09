"""Run & pipeline read endpoints — wraps db_read_side functions."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from backend.orchestrator.db_read_side import (
    build_dynamic_task_tabs,
    get_node_trace_payload,
    get_north_star_summary,
    get_registry_validation_payload,
    get_stage_summary,
)

router = APIRouter()


@router.get("/acceptance")
def acceptance() -> dict[str, Any]:
    """Task tabs + north-star summary (main dashboard)."""
    return {
        "taskTabs": build_dynamic_task_tabs(),
        "north_star_summary": get_north_star_summary(),
    }


@router.get("/north-star")
def north_star() -> dict[str, Any]:
    """North-star KPIs."""
    return get_north_star_summary()


@router.get("/node-trace")
def node_trace() -> dict[str, Any]:
    """Full node execution trace across all runs."""
    return get_node_trace_payload()


@router.get("/registry-validation")
def registry_validation() -> dict[str, Any]:
    """Validate node_registry integrity."""
    return get_registry_validation_payload()


@router.get("/stage-summary/{stage_no}/{episode_id}")
def stage_summary(stage_no: int, episode_id: str) -> dict[str, Any]:
    """Stage-level summary for an episode (Stage 2 or 4)."""
    result = get_stage_summary(stage_no, episode_id)
    if result is None:
        raise HTTPException(status_code=404, detail="not_found")
    return result
