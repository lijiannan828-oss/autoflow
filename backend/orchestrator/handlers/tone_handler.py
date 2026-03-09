"""Handler for N16b — Tone & pacing adjustment.

N16b is inserted between N16 (video pacing analysis) and N17 (video
compositing). It takes N16's pacing report and applies adjustments:
- Trim/extend suggestions per shot
- Scene transition timing recalculations
- Overall rhythm optimization recommendations

Until FFmpeg compositing is deployed, runs in stub mode producing
adjustment instructions without actually modifying media files.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from backend.orchestrator.graph.context import (
    build_node_output_envelope,
    load_node_output_payload,
)
from backend.orchestrator.graph.state import NodeResult, PipelineState
from backend.orchestrator.graph.workers import register_handler

logger = logging.getLogger(__name__)

_REGISTERED = False

# ── Cost estimates (CNY) ─────────────────────────────────────────────────
_LLM_COST_PER_CALL = 0.05  # pacing decision LLM call
_FFMPEG_COST_PER_SHOT = 0.01  # self-hosted FFmpeg trim (stub)


def _tos_key(state: PipelineState, filename: str = "output.json") -> str:
    ev_id = state.get("episode_version_id") or "unknown"
    return f"{ev_id}/N16b/{filename}"


def _output_ref(state: PipelineState) -> str:
    return f"tos://autoflow-media-2102718571-cn-shanghai/{_tos_key(state)}"


def _build_adjustments(pacing_report: dict[str, Any]) -> list[dict[str, Any]]:
    """Build per-shot adjustment instructions from N16 pacing report."""
    adjustments: list[dict[str, Any]] = []
    shot_pacing = pacing_report.get("shot_pacing", [])

    for shot in shot_pacing:
        shot_id = shot.get("shot_id", "unknown")
        judgment = shot.get("pacing_judgment", "ok")
        actual_dur = shot.get("actual_duration_sec", 0.0)
        planned_dur = shot.get("planned_duration_sec", 0.0)

        adj: dict[str, Any] = {
            "shot_id": shot_id,
            "original_duration_sec": actual_dur,
            "action": "keep",  # keep | trim | extend
            "adjusted_duration_sec": actual_dur,
        }

        if judgment == "too_slow" and actual_dur > 0:
            trim = shot.get("trim_suggestion", {})
            if trim:
                adj["action"] = "trim"
                adj["trim_start_sec"] = trim.get("start_sec", 0.0)
                adj["trim_end_sec"] = trim.get("end_sec", actual_dur)
                adj["adjusted_duration_sec"] = adj["trim_end_sec"] - adj["trim_start_sec"]
            else:
                # Default: trim 20% from the end
                adj["action"] = "trim"
                adj["adjusted_duration_sec"] = round(actual_dur * 0.8, 2)
        elif judgment == "too_fast" and planned_dur > actual_dur:
            adj["action"] = "extend"
            adj["adjusted_duration_sec"] = planned_dur

        adjustments.append(adj)

    return adjustments


def _build_transition_timing(pacing_report: dict[str, Any]) -> list[dict[str, Any]]:
    """Recalculate transition timing based on adjustments."""
    transitions = pacing_report.get("scene_transitions", [])
    timing: list[dict[str, Any]] = []

    for t in transitions:
        timing.append({
            "from_shot_id": t.get("from_shot_id", ""),
            "to_shot_id": t.get("to_shot_id", ""),
            "smoothness_score": t.get("transition_smoothness", 7.0),
            "transition_type": "cut",  # default; will be refined by compositor
            "crossfade_ms": 0 if t.get("transition_smoothness", 7) >= 7 else 200,
        })

    return timing


def handle_N16b(node_id: str, state: PipelineState, config: dict) -> NodeResult:
    """Apply tone & pacing adjustments based on N16 analysis.

    Steps:
    1. Load N16 pacing report
    2. Generate per-shot adjustment instructions (trim/extend/keep)
    3. Recalculate transition timing
    4. Package for N17 (video compositing)

    Currently runs in STUB mode — produces instructions without FFmpeg execution.
    """
    t0 = time.time()

    # Load N16 pacing report
    n16_output = load_node_output_payload("N16", state, default={})
    pacing_report = {}
    if isinstance(n16_output, dict):
        pacing_report = n16_output.get("pacing_report", n16_output)

    # Build adjustments
    adjustments = _build_adjustments(pacing_report)
    transition_timing = _build_transition_timing(pacing_report)

    # Calculate totals
    total_original = sum(a.get("original_duration_sec", 0) for a in adjustments)
    total_adjusted = sum(a.get("adjusted_duration_sec", 0) for a in adjustments)
    trim_count = sum(1 for a in adjustments if a["action"] == "trim")
    extend_count = sum(1 for a in adjustments if a["action"] == "extend")

    total_cost = _LLM_COST_PER_CALL + _FFMPEG_COST_PER_SHOT * len(adjustments)

    payload = {
        "adjustments": adjustments,
        "transition_timing": transition_timing,
        "summary": {
            "total_shots": len(adjustments),
            "trimmed": trim_count,
            "extended": extend_count,
            "kept": len(adjustments) - trim_count - extend_count,
            "original_duration_sec": round(total_original, 2),
            "adjusted_duration_sec": round(total_adjusted, 2),
            "rhythm_score": pacing_report.get("overall_rhythm_score", 7.0),
        },
        "mode": "stub",  # will be "ffmpeg" when compositing is deployed
    }

    duration_s = time.time() - t0
    output_ref = _output_ref(state)

    envelope = build_node_output_envelope(
        "N16b", state,
        payload=payload,
        cost_cny=total_cost,
        duration_s=duration_s,
    )

    logger.info(
        "N16b: %d adjustments (%d trim, %d extend), "
        "%.1fs → %.1fs (stub mode, %.2f CNY)",
        len(adjustments), trim_count, extend_count,
        total_original, total_adjusted, total_cost,
    )

    return NodeResult(
        node_id="N16b",
        status="succeeded",
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=total_cost,
        gpu_seconds=0.0,
        duration_s=duration_s,
        output_payload=payload,
        output_envelope=envelope,
        model_provider="stub",
        model_endpoint="stub",
    )


def register() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    register_handler("N16b", handle_N16b)
    _REGISTERED = True
    logger.info("Registered N16b tone handler (stub mode)")
