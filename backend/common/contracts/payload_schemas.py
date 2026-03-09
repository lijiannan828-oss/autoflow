"""Payload JSON schemas for review_tasks.payload_json.

Each Stage Gate (N08/N18/N21/N24) writes a payload_json that contains:
  1. Runtime metadata (source, run_id, scope_id, upstream_node_run_id …)
  2. Content fields enriched from upstream node outputs

Frontend adapters (review-adapters.ts) consume the content fields.
This file is the single source of truth for both sides.

Mirrors: frontend/lib/orchestrator-contract-types.ts Stage*PayloadJson
"""

from __future__ import annotations

from typing import Any, TypedDict


# ─── Shared sub-structures ──────────────────────────────────────────

class CandidateItem(TypedDict, total=False):
    id: str
    url: str | None
    prompt: str | None
    model: str | None
    score: float | None
    duration: float | None       # only for video candidates


class VideoClipItem(TypedDict, total=False):
    id: str
    name: str | None
    shot_id: str | None
    start_time: float
    duration: float
    in_point: float
    out_point: float
    url: str | None


class AudioClipItem(TypedDict, total=False):
    id: str
    type: str                    # "voiceover" | "sfx" | "bgm"
    name: str | None
    character: str | None
    dialogue_text: str | None
    start_time: float
    duration: float
    track_index: int | None
    volume: float | None
    fade_in: float | None
    fade_out: float | None
    url: str | None


class SubtitleClipItem(TypedDict, total=False):
    id: str
    text: str
    speaker: str | None
    start_time: float
    duration: float


class CharacterItem(TypedDict, total=False):
    id: str
    name: str
    avatar_color: str | None
    voice_model: str | None
    language: str | None


class HighlightItem(TypedDict, total=False):
    title: str | None
    content: str | None


# ─── Stage 1 / N08 — 美术资产审核 (per-asset) ───────────────────────

class Stage1Payload(TypedDict, total=False):
    # runtime
    source: str
    run_id: str | None
    gate_node_id: str            # "N08"
    scope: str                   # "asset"
    scope_id: str
    upstream_node_run_id: str | None

    # content (from N07 output)
    asset_type: str | None       # "character" | "scene" | "prop"
    name: str | None
    description: str | None
    prompt: str | None
    art_style: str | None
    visual_description: str | None
    project_name: str | None
    script_summary: str | None
    highlights: list[HighlightItem]
    candidates: list[CandidateItem]

    # reviewer edits
    locked_image_id: str | None


# ─── Stage 2 / N18 — 视觉素材审核 (per-shot) ────────────────────────

class Stage2Payload(TypedDict, total=False):
    # runtime
    source: str
    run_id: str | None
    gate_node_id: str            # "N18"
    scope: str                   # "shot"
    scope_id: str
    upstream_node_run_id: str | None

    # content (from N13 frozen keyframes + N14/N17 video)
    shot_id: str | None
    shot_title: str | None
    scene_id: str | None
    scene_number: int | None
    shot_number: int | None
    global_shot_index: int | None
    duration: float | None
    prompt: str | None
    video_prompt: str | None
    camera_movement: str | None
    suggestions: list[str]
    keyframe_candidates: list[CandidateItem]
    video_candidates: list[CandidateItem]

    # reviewer edits
    selected_keyframe_id: str | None
    selected_video_id: str | None


# ─── Stage 3 / N21 — 视听整合审核 (episode-level) ───────────────────

class Stage3Payload(TypedDict, total=False):
    # runtime
    source: str
    run_id: str | None
    gate_node_id: str            # "N21"
    scope: str                   # "episode"
    upstream_node_run_id: str | None

    # content (from N20 av_tracks output)
    episode_title: str | None
    project_name: str | None
    total_shots: int | None
    total_duration: float | None
    video_clips: list[VideoClipItem]
    audio_clips: list[AudioClipItem]
    subtitle_clips: list[SubtitleClipItem]
    characters: list[CharacterItem]

    # reviewer edits
    audio_adjustments: dict[str, Any]
    track_settings: dict[str, Any]


# ─── Stage 4 / N24 — 成片审核 (episode-level, serial 3-step) ────────

class Stage4Payload(TypedDict, total=False):
    # runtime
    source: str
    run_id: str | None
    gate_node_id: str            # "N24"
    scope: str                   # "episode"
    upstream_node_run_id: str | None

    # content (from N23 final composition)
    episode_title: str | None
    duration: float | None
    step_no: int | None
    reviewer_role: str | None
    final_video_url: str | None
    final_video_http_url: str | None
    version_no: int | None
    is_revision: bool
    revision_count: int


# ─── Helper: build content payload from upstream node output ─────────

def enrich_stage1_payload(
    base: dict[str, Any],
    *,
    upstream_output: dict[str, Any] | None,
    episode_ctx: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge N07 art-asset output into Stage 1 payload."""
    if not upstream_output:
        return base

    out = dict(base)
    # N07 output typically has: candidates[], asset_type, prompt, name
    for key in ("asset_type", "name", "description", "prompt", "art_style",
                "visual_description"):
        if key in upstream_output and key not in out:
            out[key] = upstream_output[key]

    if "candidates" in upstream_output:
        out["candidates"] = upstream_output["candidates"]
    elif "asset_candidates" in upstream_output:
        out["candidates"] = upstream_output["asset_candidates"]

    if episode_ctx:
        for key in ("project_name", "script_summary", "highlights"):
            if key in episode_ctx and key not in out:
                out[key] = episode_ctx[key]

    return out


def enrich_stage2_payload(
    base: dict[str, Any],
    *,
    upstream_output: dict[str, Any] | None,
    scope_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge N13/N14/N17 output into Stage 2 payload."""
    out = dict(base)

    if scope_meta:
        for key in ("shot_id", "scene_id", "scene_number", "shot_number",
                     "global_shot_index"):
            if key in scope_meta:
                out[key] = scope_meta[key]

    if not upstream_output:
        return out

    for key in ("duration", "prompt", "video_prompt", "camera_movement",
                "suggestions", "shot_title"):
        if key in upstream_output and key not in out:
            out[key] = upstream_output[key]

    if "keyframe_candidates" in upstream_output:
        out["keyframe_candidates"] = upstream_output["keyframe_candidates"]
    if "video_candidates" in upstream_output:
        out["video_candidates"] = upstream_output["video_candidates"]

    return out


def enrich_stage3_payload(
    base: dict[str, Any],
    *,
    upstream_output: dict[str, Any] | None,
    episode_ctx: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge N20 av_tracks output into Stage 3 payload."""
    out = dict(base)

    if episode_ctx:
        for key in ("episode_title", "project_name"):
            if key in episode_ctx and key not in out:
                out[key] = episode_ctx[key]

    if not upstream_output:
        return out

    av_tracks = upstream_output.get("av_tracks") or upstream_output

    # Extract video clips from video_track
    video_track = av_tracks.get("video_track") or {}
    if isinstance(video_track, dict) and "clips" in video_track:
        out["video_clips"] = video_track["clips"]
    elif isinstance(video_track, list):
        out["video_clips"] = video_track

    # Extract audio clips from tts/bgm/sfx tracks
    audio_clips: list[dict[str, Any]] = []
    for tts in (av_tracks.get("tts_tracks") or []):
        if isinstance(tts, dict):
            tts.setdefault("type", "voiceover")
            audio_clips.append(tts)
    bgm = av_tracks.get("bgm_track")
    if isinstance(bgm, dict):
        bgm.setdefault("type", "bgm")
        audio_clips.append(bgm)
    elif isinstance(bgm, list):
        for b in bgm:
            if isinstance(b, dict):
                b.setdefault("type", "bgm")
                audio_clips.append(b)
    for sfx in (av_tracks.get("sfx_tracks") or []):
        if isinstance(sfx, dict):
            sfx.setdefault("type", "sfx")
            audio_clips.append(sfx)
    if audio_clips:
        out["audio_clips"] = audio_clips

    # Extract subtitles
    subtitle_json = av_tracks.get("subtitle_json")
    if isinstance(subtitle_json, list):
        out["subtitle_clips"] = subtitle_json
    elif isinstance(subtitle_json, dict) and "clips" in subtitle_json:
        out["subtitle_clips"] = subtitle_json["clips"]

    # Extract characters from episode context
    if episode_ctx and "characters" in episode_ctx:
        out["characters"] = episode_ctx["characters"]

    out["total_shots"] = len(out.get("video_clips") or [])
    vclips = out.get("video_clips") or []
    if vclips:
        out["total_duration"] = max(
            (c.get("start_time", 0) + c.get("duration", 0)) for c in vclips
        )

    return out


def enrich_stage4_payload(
    base: dict[str, Any],
    *,
    upstream_output: dict[str, Any] | None,
    step: dict[str, Any] | None = None,
    episode_ctx: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Merge N23 final composition output into Stage 4 payload."""
    out = dict(base)

    if step:
        out["step_no"] = step.get("step_no")
        out["reviewer_role"] = step.get("reviewer_role")

    if episode_ctx:
        for key in ("episode_title", "version_no"):
            if key in episode_ctx and key not in out:
                out[key] = episode_ctx[key]

    if not upstream_output:
        return out

    for key in ("final_video_url", "duration", "is_revision", "revision_count"):
        if key in upstream_output and key not in out:
            out[key] = upstream_output[key]

    # Also check nested final_episode structure
    final_ep = upstream_output.get("final_episode") or {}
    if isinstance(final_ep, dict):
        if "resource_url" in final_ep and "final_video_url" not in out:
            out["final_video_url"] = final_ep["resource_url"]
        if "duration_seconds" in final_ep and "duration" not in out:
            out["duration"] = final_ep["duration_seconds"]

    return out
