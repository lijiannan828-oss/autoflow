"""Test fixtures — sample data factories for AutoFlow tests."""

from __future__ import annotations

import uuid
from typing import Any


def make_shot_spec(
    shot_id: str | None = None,
    shot_type: str = "close_up",
    camera_movement: str = "static",
    difficulty: str = "S0",
    emotion: str = "neutral",
    duration_sec: float = 3.0,
    **extra: Any,
) -> dict:
    """Create a minimal ShotSpec dict for testing."""
    return {
        "shot_id": shot_id or f"shot-{uuid.uuid4().hex[:6]}",
        "shot_type": shot_type,
        "camera_movement": camera_movement,
        "difficulty": difficulty,
        "emotion": emotion,
        "duration_sec": duration_sec,
        "visual_prompt": "A beautiful palace scene with warm lighting",
        "negative_prompt": "blurry, deformed",
        **extra,
    }


def make_character_profile(
    character_id: str | None = None,
    name: str = "太后",
    **extra: Any,
) -> dict:
    """Create a minimal CharacterProfile dict for testing."""
    return {
        "character_id": character_id or f"char-{uuid.uuid4().hex[:6]}",
        "name": name,
        "appearance": "regal elderly woman in golden robes",
        "voice_config": {"language": "zh", "style": "authoritative"},
        **extra,
    }


def make_episode_script(
    episode_id: str | None = None,
    num_shots: int = 5,
    **extra: Any,
) -> dict:
    """Create a minimal EpisodeScript dict for testing."""
    return {
        "episode_id": episode_id or f"ep-{uuid.uuid4().hex[:6]}",
        "scenes": [
            {
                "scene_id": f"scene-{i}",
                "shots": [make_shot_spec() for _ in range(max(1, num_shots // 2))],
            }
            for i in range(2)
        ],
        **extra,
    }


def make_review_task(
    task_id: str | None = None,
    gate_node_id: str = "N08",
    stage_no: int = 1,
    status: str = "pending",
    **extra: Any,
) -> dict:
    """Create a minimal review task dict for testing."""
    return {
        "review_task_id": task_id or f"rt-{uuid.uuid4().hex[:8]}",
        "gate_node_id": gate_node_id,
        "stage_no": stage_no,
        "status": status,
        "role": "qc_inspector",
        "granularity": "asset",
        **extra,
    }


def make_rag_chain_case(
    quality_score: float = 9.2,
    case_type: str = "positive",
    genre: str = "古装宫斗",
    **extra: Any,
) -> dict:
    """Create a minimal RAGChainCase dict for testing."""
    return {
        "chain_id": f"chain-{uuid.uuid4().hex[:8]}",
        "quality_score": quality_score,
        "case_type": case_type,
        "genre": genre,
        "scene_type": "多人对话",
        "difficulty": "S1",
        "chain_assets": {
            "script_fragment": "太后怒摔茶杯",
            "visual_prompt": "An angry empress throwing a teacup",
            "shot_spec": make_shot_spec(),
        },
        **extra,
    }
