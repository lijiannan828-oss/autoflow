"""Handler for N07b — Core character voice sample generation.

N07b runs in parallel with N07 (both depend on N06). It generates voice
sample candidates for each main character using CosyVoice (self-hosted GPU)
or ElevenLabs API (fallback).

GPU dependency: CosyVoice on A800. Until ComfyUI is deployed, runs in
stub mode producing synthetic voice candidates.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from backend.orchestrator.graph.context import (
    build_node_output_envelope,
    load_episode_context,
    load_node_output_payload,
)
from backend.orchestrator.graph.state import NodeResult, PipelineState
from backend.orchestrator.graph.workers import register_handler

logger = logging.getLogger(__name__)

_REGISTERED = False

# ── Cost estimates (CNY) ─────────────────────────────────────────────────
_COSYVOICE_COST_PER_SAMPLE = 0.02   # self-hosted GPU, ~2s inference
_ELEVENLABS_COST_PER_SAMPLE = 0.08  # API fallback

# ── Config ────────────────────────────────────────────────────────────────
_SAMPLES_PER_CHARACTER = 3  # generate 3 voice candidates per character


def _tos_key(state: PipelineState, filename: str = "output.json") -> str:
    ev_id = state.get("episode_version_id") or "unknown"
    return f"{ev_id}/N07b/{filename}"


def _output_ref(state: PipelineState) -> str:
    return f"tos://autoflow-media-2102718571-cn-shanghai/{_tos_key(state)}"


def _extract_characters(episode_ctx: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract character list from episode context (parsed script)."""
    parsed = episode_ctx.get("parsed_script", episode_ctx)
    characters = parsed.get("characters", [])
    if not characters:
        # Fallback: try character_registry
        characters = episode_ctx.get("character_registry", [])
    return characters if isinstance(characters, list) else []


def handle_N07b(node_id: str, state: PipelineState, config: dict) -> NodeResult:
    """Generate voice sample candidates for core characters.

    Steps:
    1. Load episode context to get character list
    2. For each character, generate N voice candidates via CosyVoice/ElevenLabs
    3. Package as VoiceSampleItem[] for N08 Gate review

    Currently runs in STUB mode until CosyVoice GPU is deployed.
    """
    t0 = time.time()
    episode_ctx = load_episode_context(state)
    characters = _extract_characters(episode_ctx)

    # Build voice candidates (stub mode for now)
    voice_candidates: list[dict[str, Any]] = []
    total_cost = 0.0

    for char in characters:
        char_id = char.get("id", char.get("character_id", f"char_{len(voice_candidates)}"))
        char_name = char.get("name", char.get("character_name", "Unknown"))

        for sample_idx in range(_SAMPLES_PER_CHARACTER):
            sample_id = f"voice_{char_id}_{sample_idx}"
            voice_candidates.append({
                "id": sample_id,
                "character_id": char_id,
                "character_name": char_name,
                "voice_model": "cosyvoice3",  # or "elevenlabs"
                "sample_url": f"stub://voice-samples/{sample_id}.wav",
                "duration_seconds": 5.0,
                "sample_index": sample_idx,
                "is_stub": True,
            })
            total_cost += _COSYVOICE_COST_PER_SAMPLE

    # If no characters found, generate a minimal placeholder
    if not voice_candidates:
        voice_candidates.append({
            "id": "voice_default_0",
            "character_id": "default",
            "character_name": "旁白",
            "voice_model": "cosyvoice3",
            "sample_url": "stub://voice-samples/default_0.wav",
            "duration_seconds": 5.0,
            "sample_index": 0,
            "is_stub": True,
        })

    payload = {
        "voice_candidates": voice_candidates,
        "total_characters": len(characters) or 1,
        "samples_per_character": _SAMPLES_PER_CHARACTER,
        "model": "cosyvoice3",
        "mode": "stub",  # will be "gpu" when CosyVoice deployed
    }

    duration_s = time.time() - t0

    # Upload to TOS (stub: skip actual upload)
    output_ref = _output_ref(state)

    envelope = build_node_output_envelope(
        "N07b", state,
        payload=payload,
        cost_cny=total_cost,
        duration_s=duration_s,
    )

    logger.info(
        "N07b: generated %d voice candidates for %d characters (stub mode, %.2f CNY)",
        len(voice_candidates), len(characters) or 1, total_cost,
    )

    return NodeResult(
        node_id="N07b",
        status="succeeded",
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=total_cost,
        gpu_seconds=0.0,
        duration_s=duration_s,
        output_payload=payload,
        output_envelope=envelope,
        model_provider="cosyvoice",
        model_endpoint="stub",
    )


def register() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    register_handler("N07b", handle_N07b)
    _REGISTERED = True
    logger.info("Registered N07b voice handler (stub mode)")
