"""Seed / demo data endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from backend.orchestrator.write_side import (
    seed_round4_demo,
    seed_round6_demo,
    seed_round7_demo,
)

router = APIRouter()


@router.post("/seed/round4")
def seed_round4() -> dict[str, Any]:
    """Seed node registry + runtime fixtures."""
    return seed_round4_demo()


@router.post("/seed/round6")
def seed_round6() -> dict[str, Any]:
    """Seed round 6 (artifacts + auto-QC + model gateway preview)."""
    return seed_round6_demo()


@router.post("/seed/round7")
def seed_round7() -> dict[str, Any]:
    """Seed round 7 (model integration demo)."""
    return seed_round7_demo()
