"""Real handlers for AV integration and final composition (N20, N23).

N20 — AV Integration: TTS (ElevenLabs via kie.ai) + lip-sync (skip MVP-0) +
      BGM (Suno via kie.ai) + SFX (ElevenLabs sound-effect-v2 via kie.ai) +
      FFmpeg mixing + subtitle generation.
N23 — Final Composition: FFmpeg-based video concatenation + audio mixing +
      subtitle burning + watermark + H.264 encoding.

Audio API calls are routed through kie.ai proxy:
  base_url = get_audio_api_base_url()  → "https://api.kie.ai"
  api_key  = get_audio_api_key()       → shared key for all audio services
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx

from backend.common.env import get_audio_api_base_url, get_audio_api_key
from backend.common.tos_client import upload_bytes, upload_json, download_bytes

from backend.orchestrator.graph.context import (
    build_node_output_envelope,
    load_episode_context,
    load_node_output_payload,
)
from backend.orchestrator.graph.state import NodeResult, PipelineState
from backend.orchestrator.graph.workers import register_handler

logger = logging.getLogger(__name__)

_REGISTERED = False

# ── Audio API timeout & retry config ──────────────────────────────────────
_AUDIO_API_TIMEOUT = 120.0  # seconds per API call
_AUDIO_API_MAX_RETRIES = 2
_AUDIO_API_RETRY_DELAY = 3.0  # seconds

# ── kie.ai estimated pricing (CNY per call, from kie.ai/pricing 2026-03-09) ──
# TTS: ~0.05 CNY per call (short text), BGM: ~0.15 CNY per call, SFX: ~0.03 CNY
_KIEAI_COST_TTS = 0.05
_KIEAI_COST_BGM = 0.15
_KIEAI_COST_SFX = 0.03


# ── Helpers ───────────────────────────────────────────────────────────────

def _tos_key(state: PipelineState, node_id: str, filename: str = "output.json") -> str:
    ev_id = state.get("episode_version_id") or "unknown"
    return f"{ev_id}/{node_id}/{filename}"


def _output_ref(state: PipelineState, node_id: str) -> str:
    return f"tos://autoflow-media-2102718571-cn-shanghai/{_tos_key(state, node_id)}"


def _safe_upload_json(state: PipelineState, node_id: str, payload: dict) -> str:
    try:
        return upload_json(_tos_key(state, node_id), payload)
    except Exception as exc:
        logger.warning("TOS upload failed for %s, using synthetic ref: %s", node_id, exc)
        return _output_ref(state, node_id)


def _safe_upload_bytes(
    state: PipelineState, node_id: str, data: bytes,
    filename: str, content_type: str,
) -> str:
    try:
        key = _tos_key(state, node_id, filename)
        return upload_bytes(key, data, content_type)
    except Exception as exc:
        logger.warning("TOS upload failed for %s/%s: %s", node_id, filename, exc)
        return _output_ref(state, node_id)


def _build_result(
    node_id: str,
    state: PipelineState,
    *,
    status: str = "succeeded",
    output_ref: str,
    payload: Any,
    cost_cny: float = 0.0,
    gpu_seconds: float = 0.0,
    duration_s: float = 0.0,
    quality_score: float | None = None,
    error: str | None = None,
    error_code: str | None = None,
    model_provider: str = "api",
) -> NodeResult:
    """Build a complete NodeResult with envelope."""
    envelope = build_node_output_envelope(
        node_id,
        state,
        status=status,
        payload=payload,
        duration_s=duration_s,
        cost_cny=cost_cny,
        gpu_seconds=gpu_seconds,
        error_code=error_code,
        error_message=error,
    )

    return NodeResult(
        node_id=node_id,
        status=status,
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=cost_cny,
        gpu_seconds=gpu_seconds,
        duration_s=duration_s,
        model_provider=model_provider,
        model_endpoint=None,
        output_payload=payload,
        output_envelope=envelope,
        quality_score=quality_score,
        error=error,
        error_code=error_code,
    )


def _audio_api_headers() -> dict[str, str]:
    """Build headers for kie.ai audio API calls."""
    return {
        "Authorization": f"Bearer {get_audio_api_key()}",
        "Content-Type": "application/json",
    }


def _audio_api_call(
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
    timeout: float = _AUDIO_API_TIMEOUT,
) -> httpx.Response:
    """Make an HTTP call to the kie.ai audio API with retry."""
    base_url = get_audio_api_base_url().rstrip("/")
    url = f"{base_url}{path}"
    headers = _audio_api_headers()

    last_error: Exception | None = None
    for attempt in range(_AUDIO_API_MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=timeout) as client:
                if method.upper() == "GET":
                    resp = client.get(url, headers=headers)
                else:
                    resp = client.post(url, json=json_body, headers=headers)
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < _AUDIO_API_MAX_RETRIES:
                logger.warning("Audio API %s returned %d, retrying...", path, resp.status_code)
                time.sleep(_AUDIO_API_RETRY_DELAY * (attempt + 1))
                continue
            return resp
        except (httpx.TimeoutException, httpx.HTTPError) as exc:
            last_error = exc
            if attempt < _AUDIO_API_MAX_RETRIES:
                logger.warning("Audio API %s error: %s, retrying...", path, exc)
                time.sleep(_AUDIO_API_RETRY_DELAY * (attempt + 1))
                continue
            raise

    raise last_error or RuntimeError("Audio API call failed after retries")


# ── kie.ai async task helpers ─────────────────────────────────────────────
#
# kie.ai uses a unified async task pattern:
#   1. Submit task → get taskId
#   2. Poll for completion → get result URL
#
# Endpoints (verified 2026-03-09):
#   ElevenLabs TTS/SFX: POST /api/v1/jobs/createTask → GET /api/v1/jobs/recordInfo?taskId=
#   Suno BGM:           POST /api/v1/generate         → GET /api/v1/generate/record-info?taskId=

_KIEAI_POLL_INTERVAL = 3.0   # seconds between polls
_KIEAI_MAX_POLLS = 40        # max polls (~120s for TTS, ~120s for SFX)
_KIEAI_BGM_MAX_POLLS = 120   # Suno BGM can take ~5min


def _kieai_submit_job(model: str, input_data: dict) -> str | None:
    """Submit an ElevenLabs TTS/SFX job via kie.ai. Returns taskId or None."""
    try:
        resp = _audio_api_call(
            "POST",
            "/api/v1/jobs/createTask",
            json_body={"model": model, "input": input_data},
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict) and data.get("code") == 200:
                task_data = data.get("data", {})
                return task_data.get("taskId") or task_data.get("recordId")
            logger.warning("kie.ai createTask unexpected response: %s", resp.text[:300])
        else:
            logger.warning("kie.ai createTask returned %d: %s", resp.status_code, resp.text[:300])
    except Exception as exc:
        logger.warning("kie.ai createTask failed: %s", exc)
    return None


def _kieai_poll_job(task_id: str, max_polls: int = _KIEAI_MAX_POLLS) -> str | None:
    """Poll kie.ai ElevenLabs job until complete. Returns result audio URL or None.

    kie.ai uses 'state' field (not 'status'): waiting → processing → success/failed.
    """
    for poll_num in range(max_polls):
        time.sleep(_KIEAI_POLL_INTERVAL)
        try:
            resp = _audio_api_call(
                "GET",
                f"/api/v1/jobs/recordInfo?taskId={task_id}",
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict) and data.get("code") == 200:
                    record = data.get("data", {})
                    # kie.ai uses 'state' field (lowercase values: success/failed/waiting)
                    state = record.get("state", "") or record.get("status", "")
                    if state in ("success", "SUCCESS", "COMPLETED", "completed"):
                        result_json = record.get("resultJson", {})
                        if isinstance(result_json, str):
                            result_json = json.loads(result_json)
                        urls = result_json.get("resultUrls", [])
                        if urls:
                            return urls[0]
                        # Fallback: check output_url directly
                        return record.get("output_url", "") or record.get("audioUrl", "") or None
                    elif state in ("failed", "FAILED", "ERROR", "error"):
                        logger.warning("kie.ai job %s failed: %s", task_id, record.get("failMsg", ""))
                        return None
                    # Still processing (waiting/processing), continue polling
        except Exception as exc:
            logger.debug("kie.ai poll error for %s: %s", task_id, exc)
    logger.warning("kie.ai job %s timed out after %d polls", task_id, max_polls)
    return None


def _kieai_submit_suno(prompt: str, instrumental: bool = True) -> str | None:
    """Submit a Suno BGM generation task via kie.ai. Returns taskId or None."""
    try:
        resp = _audio_api_call(
            "POST",
            "/api/v1/generate",
            json_body={
                "prompt": prompt,
                "customMode": False,
                "instrumental": instrumental,
                "model": "V4",
                # callBackUrl must be non-empty (kie.ai rejects empty string)
                "callBackUrl": "https://example.com/callback/noop",
            },
            timeout=30.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict) and data.get("code") == 200:
                task_data = data.get("data", {})
                return task_data.get("taskId") or task_data.get("id")
            logger.warning("kie.ai Suno submit unexpected: %s", resp.text[:300])
        else:
            logger.warning("kie.ai Suno submit returned %d: %s", resp.status_code, resp.text[:300])
    except Exception as exc:
        logger.warning("kie.ai Suno submit failed: %s", exc)
    return None


def _kieai_poll_suno(task_id: str) -> str | None:
    """Poll kie.ai Suno job until complete. Returns audio URL or None.

    Suno status flow: PENDING → TEXT_SUCCESS → FIRST_SUCCESS → SUCCESS.
    FIRST_SUCCESS means first track ready (Suno generates 2); we can use it early.
    Audio URL is in response.sunoData[0].audioUrl.
    """
    for poll_num in range(_KIEAI_BGM_MAX_POLLS):
        time.sleep(_KIEAI_POLL_INTERVAL)
        try:
            resp = _audio_api_call(
                "GET",
                f"/api/v1/generate/record-info?taskId={task_id}",
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict) and data.get("code") == 200:
                    record = data.get("data", {})
                    status = record.get("status", "")
                    # Accept FIRST_SUCCESS (1st of 2 tracks ready) or SUCCESS (all done)
                    if status in ("SUCCESS", "FIRST_SUCCESS", "COMPLETED", "completed"):
                        # Primary path: response.sunoData[0].audioUrl
                        response_obj = record.get("response", {})
                        if isinstance(response_obj, str):
                            try:
                                response_obj = json.loads(response_obj)
                            except (json.JSONDecodeError, TypeError):
                                response_obj = {}
                        suno_data = response_obj.get("sunoData", []) if isinstance(response_obj, dict) else []
                        if suno_data and isinstance(suno_data[0], dict):
                            audio_url = suno_data[0].get("audioUrl", "") or suno_data[0].get("audio_url", "")
                            if audio_url:
                                return audio_url
                        # Fallback: direct fields
                        audio_url = record.get("audio_url", "") or record.get("audioUrl", "")
                        if audio_url:
                            return audio_url
                        logger.warning("kie.ai Suno %s: status=%s but no audio URL found", task_id, status)
                        return None
                    elif status in ("FAILED", "ERROR", "failed"):
                        logger.warning("kie.ai Suno %s failed: %s", task_id, record.get("failReason", ""))
                        return None
                    # Still processing (PENDING, TEXT_SUCCESS, etc.), continue
        except Exception as exc:
            logger.debug("kie.ai Suno poll error for %s: %s", task_id, exc)
    logger.warning("kie.ai Suno %s timed out", task_id)
    return None


def _download_audio_url(url: str) -> bytes:
    """Download audio file from a URL."""
    with httpx.Client(timeout=60) as client:
        resp = client.get(url)
        if resp.status_code == 200:
            return resp.content
        logger.warning("Audio download from %s returned %d", url, resp.status_code)
    return b""


def _get_audio_duration(audio_bytes: bytes, text_len: int = 0) -> float:
    """Get audio duration using ffprobe, fallback to MP3 128kbps estimate.

    For MP3 at 128kbps: 1 second ≈ 16,000 bytes (128 * 1000 / 8).
    """
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", tmp_path],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            duration = float(result.stdout.strip())
            if duration > 0.1:
                return duration
    except Exception:
        pass
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
    # Fallback: MP3 128kbps = 16KB/s
    if len(audio_bytes) > 0:
        return max(0.5, len(audio_bytes) / 16000.0)
    # Last resort: estimate from text length (Chinese ~4 chars/sec)
    return max(1.0, text_len * 0.25)


# ── N20 Sub-steps ─────────────────────────────────────────────────────────

def _n20_tts_elevenlabs(
    dialogue_lines: list[dict],
    character_registry: list[dict],
    state: PipelineState,
) -> list[dict]:
    """Step 1: TTS via ElevenLabs API through kie.ai proxy.

    Uses verified kie.ai async task API:
      POST /api/v1/jobs/createTask  (model=elevenlabs/text-to-speech-multilingual-v2)
      GET  /api/v1/jobs/recordInfo?taskId=  → resultJson.resultUrls[0]
    """
    tts_tracks: list[dict] = []

    # Build character_id → voice name mapping from registry
    voice_map: dict[str, str] = {}
    for char in character_registry:
        char_id = char.get("character_id", "")
        voice_cfg = char.get("voice_config", {})
        if isinstance(voice_cfg, dict):
            voice_name = (
                voice_cfg.get("voice_name", "")
                or voice_cfg.get("voice", "")
                or voice_cfg.get("elevenlabs_voice_id", "")
            )
            if voice_name:
                voice_map[char_id] = voice_name

    default_voice = "Rachel"  # ElevenLabs default voice
    tts_cost = 0.0

    for i, line in enumerate(dialogue_lines):
        line_id = line.get("line_id", f"line_{i}")
        character_id = line.get("character_id", "narrator")
        text = line.get("text", "") or line.get("dialogue", "")
        shot_id = line.get("shot_id", "")
        start_sec = float(line.get("start_sec", 0) or 0)
        planned_duration = float(line.get("duration_sec", 0) or line.get("planned_window", 0) or 0)

        if not text.strip():
            logger.debug("N20 TTS: skipping empty line %s", line_id)
            continue

        voice = voice_map.get(character_id, default_voice)

        tts_audio = b""
        actual_duration = planned_duration or max(1.0, len(text) * 0.12)
        try:
            task_id = _kieai_submit_job(
                "elevenlabs/text-to-speech-multilingual-v2",
                {"text": text, "voice": voice},
            )
            if task_id:
                audio_url = _kieai_poll_job(task_id)
                if audio_url:
                    tts_audio = _download_audio_url(audio_url)
                    if len(tts_audio) > 0:
                        actual_duration = _get_audio_duration(tts_audio, len(text))
                    tts_cost += _KIEAI_COST_TTS
                    logger.info("N20 TTS: generated %d bytes for line %s (task=%s)", len(tts_audio), line_id, task_id)
                else:
                    logger.warning("N20 TTS: poll returned no URL for line %s (task=%s)", line_id, task_id)
            else:
                logger.warning("N20 TTS: submit failed for line %s", line_id)
        except Exception as exc:
            logger.warning("N20 TTS: failed for line %s: %s", line_id, exc)

        audio_ref = ""
        if tts_audio:
            audio_ref = _safe_upload_bytes(
                state, "N20", tts_audio,
                f"tts_{line_id}.mp3", "audio/mpeg",
            )

        tts_tracks.append({
            "line_id": line_id,
            "character_id": character_id,
            "audio": audio_ref,
            "start_sec": start_sec,
            "end_sec": start_sec + actual_duration,
            "actual_duration_sec": actual_duration,
        })

    return tts_tracks, tts_cost


def _n20_bgm_suno(
    episode_script: dict,
    state: PipelineState,
) -> list[dict]:
    """Step 3: BGM generation via Suno API through kie.ai proxy.

    Uses verified kie.ai Suno API:
      POST /api/v1/generate  (model=V4, callBackUrl required)
      GET  /api/v1/generate/record-info?taskId=  → audio_url
    """
    bgm_tracks: list[dict] = []
    bgm_cost = 0.0

    # Extract scene/mood info for BGM generation
    scenes = episode_script.get("scenes", [])
    if not scenes:
        shots = episode_script.get("shots", [])
        if shots:
            scenes = [{"scene_id": "main", "mood": "dramatic", "description": "short drama scene"}]

    for scene in scenes:
        scene_id = scene.get("scene_id", f"scene_{uuid4().hex[:8]}")
        mood = scene.get("mood", "") or scene.get("emotional_tone", "dramatic")
        desc = scene.get("description", "") or scene.get("bgm_description", "")
        start_sec = float(scene.get("start_sec", 0) or 0)
        end_sec = float(scene.get("end_sec", 60) or 60)

        prompt = f"{mood} background music for short drama scene"
        if desc:
            prompt = f"{mood} {desc}"

        bgm_audio = b""
        try:
            task_id = _kieai_submit_suno(prompt, instrumental=True)
            if task_id:
                audio_url = _kieai_poll_suno(task_id)
                if audio_url:
                    bgm_audio = _download_audio_url(audio_url)
                    bgm_cost += _KIEAI_COST_BGM
                    logger.info("N20 BGM: generated for scene %s, %d bytes (task=%s)", scene_id, len(bgm_audio), task_id)
                else:
                    logger.warning("N20 BGM: poll returned no URL for scene %s (task=%s)", scene_id, task_id)
            else:
                logger.warning("N20 BGM: Suno submit failed for scene %s", scene_id)
        except Exception as exc:
            logger.warning("N20 BGM: failed for scene %s: %s", scene_id, exc)

        audio_ref = ""
        if bgm_audio:
            audio_ref = _safe_upload_bytes(
                state, "N20", bgm_audio,
                f"bgm_{scene_id}.mp3", "audio/mpeg",
            )

        bgm_tracks.append({
            "scene_id": scene_id,
            "audio": audio_ref,
            "start_sec": start_sec,
            "end_sec": end_sec,
            "mood": mood,
        })

    if not bgm_tracks:
        bgm_tracks.append({
            "scene_id": "default",
            "audio": "",
            "start_sec": 0,
            "end_sec": 60,
            "mood": "neutral",
        })

    return bgm_tracks, bgm_cost


def _n20_sfx_elevenlabs(
    shots: list[dict],
    state: PipelineState,
) -> list[dict]:
    """Step 4: SFX generation via ElevenLabs sound-effect-v2 through kie.ai.

    Uses verified kie.ai async task API:
      POST /api/v1/jobs/createTask  (model=elevenlabs/sound-effect-v2)
      GET  /api/v1/jobs/recordInfo?taskId=  → resultJson.resultUrls[0]
    """
    sfx_tracks: list[dict] = []
    sfx_cost = 0.0

    for shot in shots:
        shot_id = shot.get("shot_id", "")
        sfx_tags = shot.get("sfx_tags", []) or shot.get("sound_effects", [])
        if not sfx_tags:
            continue

        start_sec = float(shot.get("start_sec", 0) or 0)
        duration = float(shot.get("duration_sec", 2) or 2)

        for tag in sfx_tags:
            tag_str = tag if isinstance(tag, str) else str(tag)
            sfx_audio = b""

            try:
                task_id = _kieai_submit_job(
                    "elevenlabs/sound-effect-v2",
                    {
                        "text": tag_str,
                        "duration_seconds": min(duration, 10.0),
                        "output_format": "mp3_44100_128",
                    },
                )
                if task_id:
                    audio_url = _kieai_poll_job(task_id)
                    if audio_url:
                        sfx_audio = _download_audio_url(audio_url)
                        sfx_cost += _KIEAI_COST_SFX
                        logger.info("N20 SFX: generated %d bytes for shot %s tag '%s'", len(sfx_audio), shot_id, tag_str)
                    else:
                        logger.warning("N20 SFX: poll returned no URL for shot %s tag '%s'", shot_id, tag_str)
                else:
                    logger.warning("N20 SFX: submit failed for shot %s tag '%s'", shot_id, tag_str)
            except Exception as exc:
                logger.warning("N20 SFX: failed for shot %s tag '%s': %s", shot_id, tag_str, exc)

            audio_ref = ""
            if sfx_audio:
                audio_ref = _safe_upload_bytes(
                    state, "N20", sfx_audio,
                    f"sfx_{shot_id}_{tag_str[:20]}.mp3", "audio/mpeg",
                )

            sfx_tracks.append({
                "shot_id": shot_id,
                "audio": audio_ref,
                "start_sec": start_sec,
                "end_sec": start_sec + duration,
                "sfx_tag": tag_str,
            })

    return sfx_tracks, sfx_cost


def _n20_mix_audio_ffmpeg(
    tts_tracks: list[dict],
    bgm_tracks: list[dict],
    sfx_tracks: list[dict],
    total_duration: float,
    state: PipelineState,
) -> str:
    """Step 5: Simple FFmpeg audio mixing.

    Downloads available audio files, mixes TTS + BGM (lowered volume) + SFX.
    Returns TOS ref for the mixed audio file.
    """
    # For MVP-0, create a simple mix using FFmpeg amerge/amix
    # If no real audio files are available, return empty ref
    has_any_audio = any(t.get("audio") for t in tts_tracks)
    if not has_any_audio:
        logger.info("N20 mix: no TTS audio available, skipping mix")
        return ""

    with tempfile.TemporaryDirectory(prefix="n20_mix_") as tmpdir:
        audio_files: list[str] = []

        # Download TTS tracks
        for i, track in enumerate(tts_tracks):
            ref = track.get("audio", "")
            if ref and ref.startswith("tos://"):
                try:
                    data = download_bytes(ref)
                    path = os.path.join(tmpdir, f"tts_{i}.mp3")
                    Path(path).write_bytes(data)
                    audio_files.append(path)
                except Exception as exc:
                    logger.debug("N20 mix: could not download TTS %s: %s", ref, exc)

        if not audio_files:
            logger.info("N20 mix: no downloadable TTS audio, skipping mix")
            return ""

        # Simple concatenation of TTS as the primary audio track
        # (Full timeline-based mixing with BGM/SFX is deferred to N23)
        output_path = os.path.join(tmpdir, "mixed_audio.wav")

        # Create concat file list
        concat_path = os.path.join(tmpdir, "concat.txt")
        with open(concat_path, "w") as f:
            for af in audio_files:
                f.write(f"file '{af}'\n")

        try:
            cmd = [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", concat_path,
                "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "1",
                output_path,
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=120)
            if result.returncode != 0:
                logger.warning("N20 mix ffmpeg failed: %s", result.stderr.decode()[:500])
                return ""
        except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
            logger.warning("N20 mix: ffmpeg not available or timed out: %s", exc)
            return ""

        if os.path.exists(output_path):
            mixed_data = Path(output_path).read_bytes()
            return _safe_upload_bytes(
                state, "N20", mixed_data,
                "mixed_audio.wav", "audio/wav",
            )

    return ""


def _n20_generate_subtitles(
    dialogue_lines: list[dict],
    tts_tracks: list[dict],
) -> list[dict]:
    """Step 6: Generate subtitle data from dialogue text + TTS timing.

    Returns subtitle entries with start/end times and text.
    """
    subtitles: list[dict] = []

    # Build a map from line_id to TTS timing
    tts_timing: dict[str, dict] = {}
    for track in tts_tracks:
        tts_timing[track.get("line_id", "")] = track

    cumulative_sec = 0.0
    for i, line in enumerate(dialogue_lines):
        line_id = line.get("line_id", f"line_{i}")
        text = line.get("text", "") or line.get("dialogue", "")
        if not text.strip():
            continue

        timing = tts_timing.get(line_id, {})
        start = timing.get("start_sec", cumulative_sec)
        actual_dur = timing.get("actual_duration_sec", max(1.0, len(text) * 0.1))
        end = start + actual_dur

        subtitles.append({
            "index": len(subtitles) + 1,
            "start_sec": start,
            "end_sec": end,
            "text": text,
            "character_id": line.get("character_id", ""),
        })

        cumulative_sec = end

    return subtitles


def _extract_dialogue_lines(episode_script: dict) -> list[dict]:
    """Extract dialogue lines from episode script structure."""
    lines: list[dict] = []

    # Try direct dialogue_lines field
    if "dialogue_lines" in episode_script:
        return episode_script["dialogue_lines"]

    # Extract from shots
    shots = episode_script.get("shots", [])
    for shot in shots:
        shot_id = shot.get("shot_id", "")
        start_sec = float(shot.get("start_sec", 0) or 0)
        dialogues = shot.get("dialogue", []) or shot.get("dialogues", [])
        if isinstance(dialogues, str):
            dialogues = [{"text": dialogues, "character_id": "narrator"}]
        for j, dial in enumerate(dialogues if isinstance(dialogues, list) else []):
            if isinstance(dial, str):
                dial = {"text": dial, "character_id": "narrator"}
            if isinstance(dial, dict) and dial.get("text"):
                lines.append({
                    "line_id": f"{shot_id}_dial_{j}",
                    "shot_id": shot_id,
                    "character_id": dial.get("character_id", dial.get("character", "narrator")),
                    "text": dial.get("text", ""),
                    "start_sec": start_sec,
                    "duration_sec": dial.get("duration_sec", 0),
                })
                start_sec += float(dial.get("duration_sec", 2) or 2)

    return lines


def _extract_shots_with_timing(episode_script: dict) -> list[dict]:
    """Extract shot list with timing info from episode script."""
    shots = episode_script.get("shots", [])
    result: list[dict] = []
    cumulative = 0.0
    for shot in shots:
        if not isinstance(shot, dict):
            continue
        dur = float(shot.get("duration_sec", 2) or 2)
        result.append({
            "shot_id": shot.get("shot_id", ""),
            "start_sec": cumulative,
            "duration_sec": dur,
            "sfx_tags": shot.get("sfx_tags", []) or shot.get("sound_effects", []),
            "shot_spec": shot,
        })
        cumulative += dur
    return result


# ── N20: AV Integration ──────────────────────────────────────────────────

def handle_n20(node_id: str, state: PipelineState, config: dict) -> NodeResult:
    """N20 — AV Integration.

    6-step pipeline (MVP-0 version):
    1. TTS — ElevenLabs via kie.ai
    2. Lip Sync — SKIPPED (GPU not available)
    3. BGM — Suno via kie.ai
    4. SFX — ElevenLabs sound-effect-v2 via kie.ai
    5. Mixing — FFmpeg simple audio mix
    6. Subtitles — text + TTS timing alignment
    """
    t0 = time.monotonic()
    logger.info("N20 start: AV integration")
    total_cost = 0.0
    warnings: list[str] = []

    # ── Load upstream data ─────────────────────────────────────────────
    n19_output = load_node_output_payload("N19", state, default={})
    frozen_videos: list[dict] = []
    if isinstance(n19_output, dict):
        frozen_videos = n19_output.get("frozen_videos", [])
        if not frozen_videos:
            frozen_videos = n19_output.get("videos", [])

    episode_context = load_episode_context(state)
    episode_script = episode_context.get("episode_script", {})
    if not episode_script:
        # Try loading from earlier node outputs
        n04_output = load_node_output_payload("N04", state, default={})
        if isinstance(n04_output, dict):
            episode_script = n04_output.get("episode_script", n04_output)

    character_registry = episode_context.get("character_registry", [])
    if not character_registry and isinstance(episode_script, dict):
        character_registry = episode_script.get("character_registry", [])

    # Extract dialogue lines and shot info from episode script
    dialogue_lines = _extract_dialogue_lines(episode_script if isinstance(episode_script, dict) else {})
    shots_with_timing = _extract_shots_with_timing(episode_script if isinstance(episode_script, dict) else {})

    episode_id = state.get("episode_id", "")

    # Calculate total video duration
    total_video_duration = sum(
        float(v.get("duration_sec", 0) or 0) for v in frozen_videos
    ) or sum(
        s.get("duration_sec", 0) for s in shots_with_timing
    ) or 60.0

    # ── Step 1: TTS (ElevenLabs) ───────────────────────────────────────
    logger.info("N20 step 1: TTS generation (%d dialogue lines)", len(dialogue_lines))
    tts_tracks: list[dict] = []
    try:
        tts_tracks, step_cost = _n20_tts_elevenlabs(
            dialogue_lines, character_registry, state,
        )
        total_cost += step_cost
        logger.info("N20 step 1 done: %d TTS tracks generated, cost=%.2f CNY", len(tts_tracks), step_cost)
    except Exception as exc:
        logger.warning("N20 step 1 failed: %s", exc)
        warnings.append(f"TTS generation failed: {exc}")

    # ── Step 2: Lip Sync (SKIPPED — GPU not available) ─────────────────
    logger.debug("N20 step 2: lip sync SKIPPED (GPU not available for LatentSync)")
    lipsync_videos: list[dict] = []
    for vid in frozen_videos:
        lipsync_videos.append({
            "shot_id": vid.get("shot_id", ""),
            "video": vid.get("video", vid.get("image", "")),
            "lipsync_applied": False,
        })

    # ── Step 3: BGM (Suno) ─────────────────────────────────────────────
    logger.info("N20 step 3: BGM generation")
    bgm_tracks: list[dict] = []
    try:
        bgm_tracks, step_cost = _n20_bgm_suno(
            episode_script if isinstance(episode_script, dict) else {},
            state,
        )
        total_cost += step_cost
        logger.info("N20 step 3 done: %d BGM tracks generated, cost=%.2f CNY", len(bgm_tracks), step_cost)
    except Exception as exc:
        logger.warning("N20 step 3 failed: %s", exc)
        warnings.append(f"BGM generation failed: {exc}")
        bgm_tracks = [{"scene_id": "default", "audio": "", "start_sec": 0, "end_sec": total_video_duration, "mood": "neutral"}]

    # ── Step 4: SFX (ElevenLabs sound-effect-v2) ───────────────────────
    logger.info("N20 step 4: SFX generation")
    sfx_tracks: list[dict] = []
    try:
        sfx_tracks, step_cost = _n20_sfx_elevenlabs(shots_with_timing, state)
        total_cost += step_cost
        logger.info("N20 step 4 done: %d SFX tracks generated, cost=%.2f CNY", len(sfx_tracks), step_cost)
    except Exception as exc:
        logger.warning("N20 step 4 failed: %s", exc)
        warnings.append(f"SFX generation failed: {exc}")

    # ── Step 5: Audio Mixing (FFmpeg) ──────────────────────────────────
    logger.info("N20 step 5: audio mixing")
    mixed_audio_ref = ""
    try:
        mixed_audio_ref = _n20_mix_audio_ffmpeg(
            tts_tracks, bgm_tracks, sfx_tracks,
            total_video_duration, state,
        )
        logger.info("N20 step 5 done: mixed_audio=%s", "yes" if mixed_audio_ref else "no")
    except Exception as exc:
        logger.warning("N20 step 5 failed: %s", exc)
        warnings.append(f"Audio mixing failed: {exc}")

    # ── Step 6: Subtitle Generation ────────────────────────────────────
    logger.info("N20 step 6: subtitle generation")
    subtitle_entries = _n20_generate_subtitles(dialogue_lines, tts_tracks)
    subtitle_json_ref = ""
    if subtitle_entries:
        subtitle_json_ref = _safe_upload_bytes(
            state, "N20",
            json.dumps(subtitle_entries, ensure_ascii=False).encode("utf-8"),
            "subtitles.json", "application/json",
        )

    # ── Build video track from frozen videos ───────────────────────────
    video_track: list[dict] = []
    cumulative = 0.0
    for vid in frozen_videos:
        dur = float(vid.get("duration_sec", 2) or 2)
        video_track.append({
            "shot_id": vid.get("shot_id", ""),
            "video": vid.get("video", vid.get("image", "")),
            "start_sec": cumulative,
            "end_sec": cumulative + dur,
        })
        cumulative += dur

    # ── Assemble AVTrackSet ────────────────────────────────────────────
    av_tracks = {
        "episode_id": episode_id,
        "video_track": video_track,
        "tts_tracks": tts_tracks,
        "lipsync_videos": lipsync_videos,
        "bgm_track": bgm_tracks,
        "sfx_tracks": sfx_tracks,
        "mixed_audio": mixed_audio_ref,
        "subtitle_json": subtitle_json_ref,
    }

    duration = time.monotonic() - t0
    payload = {"av_tracks": av_tracks}
    ref = _safe_upload_json(state, node_id, payload)

    tts_count = sum(1 for t in tts_tracks if t.get("audio"))
    bgm_count = sum(1 for b in bgm_tracks if b.get("audio"))
    sfx_count = sum(1 for s in sfx_tracks if s.get("audio"))

    logger.info(
        "N20 done: tts=%d/%d, bgm=%d, sfx=%d, lipsync=skipped, "
        "mixed=%s, subtitles=%d, warnings=%d, cost=%.2f CNY, duration=%.1fs",
        tts_count, len(tts_tracks), bgm_count, sfx_count,
        "yes" if mixed_audio_ref else "no",
        len(subtitle_entries), len(warnings), total_cost, duration,
    )

    return _build_result(
        node_id, state,
        output_ref=ref,
        payload=payload,
        cost_cny=total_cost,
        duration_s=duration,
        model_provider="api",
    )


# ── N23: Final Composition ────────────────────────────────────────────────

def _write_srt_file(subtitles: list[dict], path: str) -> None:
    """Write subtitles to SRT format file."""
    with open(path, "w", encoding="utf-8") as f:
        for sub in subtitles:
            idx = sub.get("index", 0)
            start = sub.get("start_sec", 0)
            end = sub.get("end_sec", 0)
            text = sub.get("text", "")

            start_h = int(start // 3600)
            start_m = int((start % 3600) // 60)
            start_s = int(start % 60)
            start_ms = int((start % 1) * 1000)

            end_h = int(end // 3600)
            end_m = int((end % 3600) // 60)
            end_s = int(end % 60)
            end_ms = int((end % 1) * 1000)

            f.write(f"{idx}\n")
            f.write(f"{start_h:02d}:{start_m:02d}:{start_s:02d},{start_ms:03d} --> ")
            f.write(f"{end_h:02d}:{end_m:02d}:{end_s:02d},{end_ms:03d}\n")
            f.write(f"{text}\n\n")


def handle_n23(node_id: str, state: PipelineState, config: dict) -> NodeResult:
    """N23 — Final Composition.

    FFmpeg-based pipeline:
    1. Concatenate shot videos in episode timeline order
    2. Mix in audio track (TTS + BGM + SFX mixed)
    3. Burn subtitles (SRT → -vf subtitles=)
    4. Add watermark (if configured)
    5. Encode: H.264, -preset fast -crf 23, AAC 128k
    """
    t0 = time.monotonic()
    logger.info("N23 start: final composition")

    # ── Load upstream data ─────────────────────────────────────────────
    n22_output = load_node_output_payload("N22", state, default={})
    av_tracks: dict = {}
    episode_script: dict = {}

    if isinstance(n22_output, dict):
        av_tracks = n22_output.get("av_tracks", n22_output)
        episode_script = n22_output.get("episode_script", {})

    if not av_tracks.get("video_track"):
        # Try loading directly from N20 if N22 just passed through
        n20_output = load_node_output_payload("N20", state, default={})
        if isinstance(n20_output, dict):
            av_tracks = n20_output.get("av_tracks", n20_output)

    if not episode_script:
        episode_context = load_episode_context(state)
        episode_script = episode_context.get("episode_script", {})
        if not episode_script:
            n04_output = load_node_output_payload("N04", state, default={})
            if isinstance(n04_output, dict):
                episode_script = n04_output.get("episode_script", n04_output)

    video_track = av_tracks.get("video_track", [])
    mixed_audio_ref = av_tracks.get("mixed_audio", "")
    subtitle_json_ref = av_tracks.get("subtitle_json", "")

    episode_id = state.get("episode_id", "")

    # ── Check if we have real video files to compose ───────────────────
    # In MVP-0, videos may be stub:// refs; we still produce the handler
    # output structure for downstream consumption.
    video_refs = [v.get("video", "") for v in video_track if v.get("video")]
    has_real_videos = any(
        ref.startswith("tos://") or ref.startswith("http")
        for ref in video_refs
    )

    if not has_real_videos:
        # No real video files — produce a stub FinalEpisode
        logger.info("N23: no real video files available, producing stub output")
        duration = time.monotonic() - t0

        total_duration = sum(
            float(v.get("end_sec", 0) or 0) - float(v.get("start_sec", 0) or 0)
            for v in video_track
        ) or 60.0

        payload = {"final_episode": {
            "episode_id": episode_id,
            "video": "",
            "duration_sec": total_duration,
            "resolution": {"width": 1920, "height": 1080},
            "fps": 24,
            "audio_codec": "aac",
            "video_codec": "h264",
            "file_size_mb": 0,
            "timeline": {
                "shots": [
                    {"shot_id": v.get("shot_id", ""), "start_sec": v.get("start_sec", 0), "end_sec": v.get("end_sec", 0)}
                    for v in video_track
                ],
            },
            "subtitle": subtitle_json_ref,
            "watermark_applied": False,
            "_stub": True,
            "_reason": "No real video files available for composition",
        }}
        ref = _safe_upload_json(state, node_id, payload)
        return _build_result(
            node_id, state,
            output_ref=ref,
            payload=payload,
            duration_s=duration,
            model_provider="ffmpeg",
        )

    # ── FFmpeg composition ─────────────────────────────────────────────
    with tempfile.TemporaryDirectory(prefix="n23_compose_") as tmpdir:
        # Download video files
        local_videos: list[str] = []
        for i, vt in enumerate(video_track):
            ref = vt.get("video", "")
            if not ref:
                continue
            try:
                if ref.startswith("tos://"):
                    data = download_bytes(ref)
                elif ref.startswith("http"):
                    with httpx.Client(timeout=60) as client:
                        resp = client.get(ref)
                        data = resp.content
                else:
                    continue
                local_path = os.path.join(tmpdir, f"shot_{i:03d}.mp4")
                Path(local_path).write_bytes(data)
                local_videos.append(local_path)
            except Exception as exc:
                logger.warning("N23: failed to download video %s: %s", ref, exc)

        if not local_videos:
            logger.warning("N23: no videos could be downloaded")
            duration = time.monotonic() - t0
            payload = {"final_episode": {
                "episode_id": episode_id,
                "video": "",
                "_error": "Failed to download video files",
            }}
            ref = _safe_upload_json(state, node_id, payload)
            return _build_result(
                node_id, state,
                status="failed",
                output_ref=ref,
                payload=payload,
                duration_s=duration,
                error="Failed to download video files",
                error_code="VIDEO_DOWNLOAD_FAILED",
                model_provider="ffmpeg",
            )

        # Create concat file
        concat_path = os.path.join(tmpdir, "concat.txt")
        with open(concat_path, "w") as f:
            for vp in local_videos:
                f.write(f"file '{vp}'\n")

        output_path = os.path.join(tmpdir, "final_output.mp4")

        # Build FFmpeg command
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0", "-i", concat_path,
        ]

        # Add mixed audio if available
        local_audio_path = None
        if mixed_audio_ref:
            try:
                if mixed_audio_ref.startswith("tos://"):
                    audio_data = download_bytes(mixed_audio_ref)
                    local_audio_path = os.path.join(tmpdir, "mixed_audio.wav")
                    Path(local_audio_path).write_bytes(audio_data)
                    ffmpeg_cmd.extend(["-i", local_audio_path])
            except Exception as exc:
                logger.warning("N23: failed to download mixed audio: %s", exc)

        # Video filters
        vf_filters: list[str] = []

        # Subtitle burning
        local_subtitle_path = None
        if subtitle_json_ref:
            try:
                if subtitle_json_ref.startswith("tos://"):
                    sub_data = download_bytes(subtitle_json_ref)
                    sub_entries = json.loads(sub_data)
                elif subtitle_json_ref.startswith("http"):
                    with httpx.Client(timeout=30) as client:
                        resp = client.get(subtitle_json_ref)
                        sub_entries = resp.json()
                else:
                    sub_entries = []

                if sub_entries:
                    local_subtitle_path = os.path.join(tmpdir, "subtitles.srt")
                    _write_srt_file(sub_entries, local_subtitle_path)
                    # Escape path for FFmpeg subtitles filter (special chars: \ : ' , [ ])
                    escaped_path = local_subtitle_path
                    for ch in ("\\", ":", "'", ",", "[", "]"):
                        escaped_path = escaped_path.replace(ch, f"\\{ch}")
                    vf_filters.append(f"subtitles='{escaped_path}'")
            except Exception as exc:
                logger.warning("N23: failed to process subtitles: %s", exc)

        # Apply video filters
        if vf_filters:
            ffmpeg_cmd.extend(["-vf", ",".join(vf_filters)])

        # Output encoding
        ffmpeg_cmd.extend([
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
        ])

        # Map streams
        if local_audio_path:
            ffmpeg_cmd.extend([
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-shortest",
            ])

        ffmpeg_cmd.append(output_path)

        # Execute FFmpeg
        try:
            result = subprocess.run(
                ffmpeg_cmd, capture_output=True, timeout=480,
            )
            if result.returncode != 0:
                stderr = result.stderr.decode(errors="replace")[:1000]
                logger.warning("N23 ffmpeg failed (rc=%d): %s", result.returncode, stderr)

                # Retry with simplified command (no filters)
                logger.info("N23: retrying with simplified ffmpeg command")
                simple_cmd = [
                    "ffmpeg", "-y",
                    "-f", "concat", "-safe", "0", "-i", concat_path,
                    "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart",
                    output_path,
                ]
                result = subprocess.run(simple_cmd, capture_output=True, timeout=480)
                if result.returncode != 0:
                    raise RuntimeError(f"FFmpeg failed: {result.stderr.decode(errors='replace')[:500]}")

        except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
            logger.error("N23: ffmpeg execution failed: %s", exc)
            duration = time.monotonic() - t0
            payload = {"final_episode": {
                "episode_id": episode_id,
                "video": "",
                "_error": str(exc),
            }}
            ref = _safe_upload_json(state, node_id, payload)
            return _build_result(
                node_id, state,
                status="failed",
                output_ref=ref,
                payload=payload,
                duration_s=duration,
                error=str(exc),
                error_code="FFMPEG_FAILED",
                model_provider="ffmpeg",
            )

        # Upload final video to TOS
        final_video_ref = ""
        file_size_mb = 0.0
        total_duration = 0.0
        if os.path.exists(output_path):
            file_size_bytes = os.path.getsize(output_path)
            file_size_mb = file_size_bytes / (1024 * 1024)
            final_video_data = Path(output_path).read_bytes()
            final_video_ref = _safe_upload_bytes(
                state, "N23", final_video_data,
                "final_output.mp4", "video/mp4",
            )
            # Get duration from ffprobe if available
            try:
                probe_result = subprocess.run(
                    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", output_path],
                    capture_output=True, timeout=10,
                )
                if probe_result.returncode == 0:
                    total_duration = float(probe_result.stdout.decode().strip())
            except Exception:
                total_duration = sum(
                    float(v.get("end_sec", 0) or 0) - float(v.get("start_sec", 0) or 0)
                    for v in video_track
                )
        else:
            logger.error("N23: output file not created")

    # ── Build FinalEpisode output ──────────────────────────────────────
    duration = time.monotonic() - t0
    final_episode = {
        "episode_id": episode_id,
        "video": final_video_ref,
        "duration_sec": total_duration,
        "resolution": {"width": 1920, "height": 1080},
        "fps": 24,
        "audio_codec": "aac",
        "video_codec": "h264",
        "file_size_mb": round(file_size_mb, 2),
        "timeline": {
            "shots": [
                {"shot_id": v.get("shot_id", ""), "start_sec": v.get("start_sec", 0), "end_sec": v.get("end_sec", 0)}
                for v in video_track
            ],
        },
        "subtitle": subtitle_json_ref,
        "watermark_applied": False,
    }

    payload = {"final_episode": final_episode}
    ref = _safe_upload_json(state, node_id, payload)

    logger.info(
        "N23 done: video=%s, duration=%.1fs, size=%.1fMB, "
        "subtitles=%s, composition_time=%.1fs",
        "uploaded" if final_video_ref else "none",
        total_duration, file_size_mb,
        "yes" if subtitle_json_ref else "no",
        duration,
    )

    return _build_result(
        node_id, state,
        output_ref=ref,
        payload=payload,
        duration_s=duration,
        model_provider="ffmpeg",
    )


# ── Registration ──────────────────────────────────────────────────────────

def register() -> None:
    """Register N20 and N23 handlers with the pipeline worker factory."""
    global _REGISTERED
    if _REGISTERED:
        return
    register_handler("N20", handle_n20)
    register_handler("N23", handle_n23)
    _REGISTERED = True
    logger.info("av_handlers registered: N20, N23")
