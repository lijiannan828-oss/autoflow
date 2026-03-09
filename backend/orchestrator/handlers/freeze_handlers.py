"""Freeze & distribution handlers (N09, N13, N17, N19, N22, N25, N26).

Each freeze node reads upstream outputs, applies freeze-specific logic
(ComfyUI variant generation, FFmpeg trim, or pure state marking), persists
frozen artifacts to TOS, and returns a NodeResult.

MVP-0 降级策略:
- N09: 角色变体 ComfyUI 调用走 stub（GPU 未到时直接固化选定候选）
- N13: FireRed Edit 走 stub（无 issue 直接固化，有 issue 标记）
- N17: 跳过超分辨率，直接固化；支持 FFmpeg trim
- N26: 分发 stub，记录 DistributionRecord 但不真实推送
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import tempfile
import time
from datetime import UTC, datetime
from typing import Any

from backend.common.tos_client import (
    download_bytes,
    download_json,
    upload_bytes,
    upload_json,
)
from backend.orchestrator.graph.context import (
    build_node_output_envelope,
    load_node_output_payload,
)
from backend.orchestrator.graph.state import NodeResult, PipelineState
from backend.orchestrator.graph.workers import register_handler

logger = logging.getLogger(__name__)

_REGISTERED = False

# ── Constants ─────────────────────────────────────────────────────────────

VALID_ASSET_TYPES = frozenset({"character", "location", "prop"})

# ── Helpers ───────────────────────────────────────────────────────────────


def _tos_key(state: PipelineState, node_id: str, filename: str = "output.json") -> str:
    ev_id = state.get("episode_version_id") or "unknown"
    return f"{ev_id}/{node_id}/{filename}"


def _output_ref(state: PipelineState, node_id: str) -> str:
    return f"tos://autoflow-media-2102718571-cn-shanghai/{_tos_key(state, node_id)}"


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


def _safe_upload_json(state: PipelineState, node_id: str, payload: dict, filename: str = "output.json") -> str:
    """Upload payload JSON to TOS; return output_ref even if TOS fails."""
    try:
        return upload_json(_tos_key(state, node_id, filename), payload)
    except Exception as exc:
        logger.warning("TOS upload failed for %s: %s", node_id, exc)
        return _output_ref(state, node_id)


def _safe_upload_bytes(
    state: PipelineState,
    node_id: str,
    content: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload binary to TOS; return ref even if TOS fails."""
    try:
        return upload_bytes(_tos_key(state, node_id, filename), content, content_type)
    except Exception as exc:
        logger.warning("TOS binary upload failed for %s/%s: %s", node_id, filename, exc)
        return f"tos://autoflow-media-2102718571-cn-shanghai/{_tos_key(state, node_id, filename)}"


def _build_result(
    node_id: str,
    state: PipelineState,
    *,
    status: str = "succeeded",
    output_ref: str,
    payload: Any,
    duration_s: float = 0.0,
    cost_cny: float = 0.0,
    gpu_seconds: float = 0.0,
    error: str | None = None,
    error_code: str | None = None,
    model_provider: str | None = None,
    model_endpoint: str | None = None,
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
        model_endpoint=model_endpoint,
        output_payload=payload,
        output_envelope=envelope,
        error=error,
        error_code=error_code,
    )


def _verify_gate_approved(
    gate_node_id: str,
    state: PipelineState,
) -> tuple[bool, str | None]:
    """Verify that an upstream Gate node has approved before allowing freeze.

    Returns (approved, error_reason). Checks both:
    1. The Gate node exists in completed_nodes
    2. The last gate decision is 'approved' (not 'returned' or 'partial_approved')
    """
    completed = state.get("completed_nodes") or []
    if gate_node_id not in completed:
        return False, f"Gate {gate_node_id} not in completed_nodes — freeze blocked"

    # Check gate state if it was the most recent gate
    gate = state.get("gate")
    if gate and isinstance(gate, dict) and gate.get("gate_node_id") == gate_node_id:
        decision = gate.get("decision")
        if decision not in ("approved", None):
            # None is acceptable: gate may have been cleared after approval
            return False, f"Gate {gate_node_id} decision is '{decision}', not 'approved'"

    # Also check node_outputs — gate must have produced output
    node_outputs = state.get("node_outputs") or {}
    if gate_node_id not in node_outputs:
        return False, f"Gate {gate_node_id} has no output in node_outputs"

    return True, None


def _safe_download_bytes(tos_url: str) -> bytes | None:
    """Download binary from TOS; return None on failure."""
    try:
        return download_bytes(tos_url)
    except Exception as exc:
        logger.warning("TOS download failed for %s: %s", tos_url, exc)
        return None


def _ffmpeg_available() -> bool:
    """Check if ffmpeg is available on PATH."""
    return shutil.which("ffmpeg") is not None


def _ffmpeg_trim(video_bytes: bytes, start_sec: float, end_sec: float) -> bytes | None:
    """Trim video using FFmpeg. Returns trimmed bytes or None on failure."""
    if not _ffmpeg_available():
        logger.warning("ffmpeg not found on PATH, skipping trim")
        return None

    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = os.path.join(tmpdir, "input.mp4")
        out_path = os.path.join(tmpdir, "output.mp4")

        with open(in_path, "wb") as f:
            f.write(video_bytes)

        duration = end_sec - start_sec
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{start_sec:.3f}",
            "-i", in_path,
            "-t", f"{duration:.3f}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            out_path,
        ]

        try:
            subprocess.run(
                cmd,
                capture_output=True,
                timeout=120,
                check=True,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            logger.error("FFmpeg trim failed: %s", exc)
            return None

        if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
            logger.error("FFmpeg trim produced empty or missing output")
            return None

        # #3 Fix: Post-validate with ffprobe — check duration & codec integrity
        if shutil.which("ffprobe"):
            try:
                probe = subprocess.run(
                    [
                        "ffprobe", "-v", "error",
                        "-show_entries", "format=duration",
                        "-of", "csv=p=0",
                        out_path,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if probe.returncode != 0:
                    logger.error("ffprobe validation failed: %s", probe.stderr[:200])
                    return None
                probe_duration = float(probe.stdout.strip()) if probe.stdout.strip() else 0.0
                expected_duration = end_sec - start_sec
                if probe_duration < 0.1:
                    logger.error("FFmpeg trim produced near-zero duration: %.3fs", probe_duration)
                    return None
                if expected_duration > 0 and abs(probe_duration - expected_duration) > max(1.0, expected_duration * 0.3):
                    logger.warning(
                        "FFmpeg trim duration mismatch: expected ~%.1fs, got %.1fs",
                        expected_duration, probe_duration,
                    )
            except Exception as exc:
                logger.warning("ffprobe validation skipped: %s", exc)

        with open(out_path, "rb") as f:
            return f.read()
    return None


# ── N09: Art Asset Freeze ─────────────────────────────────────────────────


def handle_n09(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N09 — 美术产品定稿: Gate 通过后固化美术资产。

    核心动作:
    1. 读取 N08 Gate 审核选定的候选资产
    2. 角色: MVP 阶段直接固化选定候选 (ComfyUI FireRed 变体生成需 GPU)
    3. 场景/道具: 选定候选直接固化
    4. 所有固化产物上传 TOS，标记 frozen=true
    """
    t0 = time.monotonic()

    # Load N08 gate output (selected assets)
    n08_output = load_node_output_payload("N08", state, default={})

    # Also load N06 art plan for asset metadata
    n06_output = load_node_output_payload("N06", state, default={})

    # Gate decision contains selected assets
    gate_state = state.get("gate")
    selected_assets_raw: list[dict] = []

    # Try to extract selected assets from gate decision or N08 output
    if isinstance(n08_output, dict):
        selected_assets_raw = n08_output.get("selected_assets", [])
        if not selected_assets_raw:
            # Gate may have placed decisions in scope_items
            selected_assets_raw = n08_output.get("approved_assets", [])

    # If no explicit selection, treat all N07 outputs as auto-selected
    if not selected_assets_raw:
        n07_output = load_node_output_payload("N07", state, default={})
        if isinstance(n07_output, dict):
            candidates = n07_output.get("candidates", [])
            # Auto-select first candidate for each asset
            for candidate in candidates:
                selected_assets_raw.append({
                    "asset_id": candidate.get("asset_id", candidate.get("target_id", "")),
                    "selected_candidate_id": candidate.get("candidate_id", "auto_0"),
                    "asset_type": candidate.get("asset_type", "character"),
                    "image_ref": candidate.get("image_ref", candidate.get("preview_url", "")),
                })

    # Build frozen assets
    frozen_assets: list[dict] = []
    artifact_refs: list[dict] = []
    frozen_at = _iso_now()

    for asset in selected_assets_raw:
        asset_id = asset.get("asset_id", "unknown")
        asset_type = asset.get("asset_type", "character")
        image_ref = asset.get("image_ref", asset.get("preview_url", ""))

        # #1 Fix: Validate asset_type against allowed enum
        if asset_type not in VALID_ASSET_TYPES:
            logger.warning(
                "N09: Invalid asset_type '%s' for %s, defaulting to 'prop'",
                asset_type, asset_id,
            )
            asset_type = "prop"

        frozen_asset = {
            "asset_type": asset_type,
            "target_id": asset_id,
            "base_image": {
                "uri": image_ref,
                "provider": "tos",
            },
            "variants": [
                {
                    "variant_tag": f"{asset_type}_base_front",
                    "image": {"uri": image_ref, "provider": "tos"},
                    "generated_from": "direct_selection",
                }
            ],
            "frozen_at": frozen_at,
            "selected_candidate_id": asset.get("selected_candidate_id", "auto_0"),
        }

        # MVP: characters would get FireRed variants when GPU is ready
        # For now, log that we'd generate variants
        if asset_type == "character":
            logger.info(
                "N09: Character %s frozen with direct selection (FireRed variants deferred to GPU)",
                asset_id,
            )
        else:
            logger.info("N09: %s %s frozen (direct selection)", asset_type, asset_id)

        frozen_assets.append(frozen_asset)
        artifact_refs.append({
            "artifact_type": "art_asset",
            "anchor_type": "asset",
            "anchor_id": asset_id,
            "frozen": True,
        })

    payload = {
        "frozen_assets": frozen_assets,
        "total_frozen": len(frozen_assets),
        "frozen_at": frozen_at,
        "mvp_note": "Direct selection freeze; FireRed MultiRef variant generation deferred pending GPU",
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info("N09 completed: %d assets frozen in %.1fs", len(frozen_assets), duration)

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
    )


# ── N13: Keyframe Freeze ─────────────────────────────────────────────────


def handle_n13(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N13 — 关键帧定稿: 根据 N12 连续性报告决定固化策略。

    核心动作:
    1. 读 N11 选定关键帧 + N12 连续性报告
    2. 无 critical issue → 直接固化 (skip ComfyUI)
    3. Minor issue → 标记需 FireRed Edit (MVP: 直接固化 + 记录 issue)
    4. Critical issue → 标记待 Supervisor 决策
    5. 固化产物上传 TOS，标记 frozen=true
    """
    t0 = time.monotonic()

    # Load N12 continuity report (our direct dependency)
    n12_output = load_node_output_payload("N12", state, default={})
    continuity_report: dict = {}
    if isinstance(n12_output, dict):
        continuity_report = n12_output.get("continuity_report", n12_output)

    # Load N11 selected keyframes (N12 depends on N11, so N11 output is available)
    n11_output = load_node_output_payload("N11", state, default={})

    selected_keyframes: list[dict] = []
    if isinstance(n11_output, dict):
        selected_keyframes = n11_output.get("selected_keyframes", [])
        if not selected_keyframes:
            # Try alternate keys
            selected_keyframes = n11_output.get("candidates", [])
            if not selected_keyframes:
                # Flatten from shot-level results
                for shot_id, shot_data in n11_output.items():
                    if isinstance(shot_data, dict) and "keyframe" in shot_data:
                        selected_keyframes.append({
                            "shot_id": shot_id,
                            "candidate_id": shot_data.get("candidate_id", "auto_0"),
                            "keyframe": shot_data.get("keyframe", {}),
                        })

    # #2 Fix: Validate continuity report structure instead of assuming shape
    if not isinstance(continuity_report, dict):
        logger.warning("N13: continuity_report is not a dict (got %s), treating as empty", type(continuity_report).__name__)
        continuity_report = {}

    blocking_issues_raw = continuity_report.get("blocking_issues", [])
    shot_issues_raw = continuity_report.get("shot_issues", [])

    # Normalize: ensure all items are dicts with required 'shot_id' field
    blocking_issues: list[str] = []
    for item in (blocking_issues_raw if isinstance(blocking_issues_raw, list) else []):
        if isinstance(item, str):
            blocking_issues.append(item)
        elif isinstance(item, dict):
            blocking_issues.append(item.get("description", str(item)))

    shot_issues: list[dict] = []
    for item in (shot_issues_raw if isinstance(shot_issues_raw, list) else []):
        if isinstance(item, dict) and "shot_id" in item:
            shot_issues.append(item)
        elif isinstance(item, dict):
            # Missing shot_id — log warning, skip (can't match to keyframe)
            logger.warning("N13: shot_issue missing 'shot_id' field, skipping: %s", item)
        else:
            logger.warning("N13: shot_issue is not a dict, skipping: %s", type(item).__name__)
    has_critical = len(blocking_issues) > 0
    has_minor = len(shot_issues) > 0 and not has_critical

    frozen_keyframes: list[dict] = []
    frozen_at = _iso_now()

    for kf in selected_keyframes:
        shot_id = kf.get("shot_id", "unknown")
        image_ref = ""
        if isinstance(kf.get("keyframe"), dict):
            image_ref = kf["keyframe"].get("uri", kf["keyframe"].get("image", ""))
        elif isinstance(kf.get("keyframe"), str):
            image_ref = kf["keyframe"]
        elif kf.get("image_ref"):
            image_ref = kf["image_ref"]

        # Check if this specific shot has issues
        shot_has_issue = False
        for issue in shot_issues:
            if isinstance(issue, dict) and issue.get("shot_id") == shot_id:
                shot_has_issue = True
                break

        frozen_kf = {
            "shot_id": shot_id,
            "keyframe_index": kf.get("keyframe_index", 0),
            "image": {"uri": image_ref, "provider": "tos"},
            "seed": kf.get("seed", 0),
            "generation_model": kf.get("generation_model", "flux-dev"),
            "frozen_at": frozen_at,
            "continuity_adjusted": False,
        }

        if has_critical and shot_has_issue:
            # Critical issue: mark but still freeze in MVP
            # (Production would route back to N10 or do FireRed fix)
            frozen_kf["continuity_adjusted"] = False
            frozen_kf["_issue_note"] = "critical_issue_detected_mvp_direct_freeze"
            logger.warning("N13: Shot %s has critical continuity issue, frozen as-is (MVP)", shot_id)
        elif has_minor and shot_has_issue:
            # Minor issue: would use FireRed Edit in production
            frozen_kf["continuity_adjusted"] = False
            frozen_kf["_issue_note"] = "minor_issue_detected_firered_edit_deferred"
            logger.info("N13: Shot %s has minor issue, frozen as-is (FireRed deferred)", shot_id)
        else:
            logger.info("N13: Shot %s no issues, direct freeze", shot_id)

        frozen_keyframes.append(frozen_kf)

    payload = {
        "frozen_keyframes": frozen_keyframes,
        "total_frozen": len(frozen_keyframes),
        "continuity_summary": {
            "has_critical_issues": has_critical,
            "has_minor_issues": has_minor,
            "blocking_issues": blocking_issues,
            "total_shot_issues": len(shot_issues),
        },
        "frozen_at": frozen_at,
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info(
        "N13 completed: %d keyframes frozen (critical=%s, minor=%s) in %.1fs",
        len(frozen_keyframes), has_critical, has_minor, duration,
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
    )


# ── N17: Video Freeze + FFmpeg Trim ───────────────────────────────────────


def handle_n17(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N17 — 视频素材定稿: 按 PacingReport 建议裁剪 + 固化视频。

    核心动作:
    1. 读 N16 PacingReport + N15 选定视频
    2. 对有 trim_suggestion 的 shot 执行 FFmpeg trim
    3. MVP 跳过超分辨率 (RealESRGAN 接口保留)
    4. 控制单集文件大小 ≤ 500MB
    5. 上传 TOS，标记 frozen=true
    """
    t0 = time.monotonic()

    # Load N16 pacing report (our direct dependency)
    n16_output = load_node_output_payload("N16", state, default={})
    pacing_report: dict = {}
    if isinstance(n16_output, dict):
        pacing_report = n16_output.get("pacing_report", n16_output)

    # Load N15 selected videos (via N16's dependency chain)
    n15_output = load_node_output_payload("N15", state, default={})

    selected_videos: list[dict] = []
    if isinstance(n15_output, dict):
        selected_videos = n15_output.get("selected_videos", [])
        if not selected_videos:
            # Try shot-level extraction
            for shot_id, shot_data in n15_output.items():
                if isinstance(shot_data, dict) and ("video_ref" in shot_data or "selected_video" in shot_data):
                    selected_videos.append({
                        "shot_id": shot_id,
                        "video_ref": shot_data.get("video_ref", shot_data.get("selected_video", "")),
                    })

    # Build pacing lookup: shot_id → trim_suggestion
    shot_pacing: dict[str, dict] = {}
    for sp in pacing_report.get("shot_pacing", []):
        if isinstance(sp, dict):
            shot_pacing[sp.get("shot_id", "")] = sp

    frozen_videos: list[dict] = []
    total_bytes = 0
    trim_count = 0
    frozen_at = _iso_now()

    for video in selected_videos:
        shot_id = video.get("shot_id", "unknown")
        video_ref = video.get("video_ref", "")

        pacing_info = shot_pacing.get(shot_id, {})
        trim_suggestion = pacing_info.get("trim_suggestion")

        trimmed = False
        final_video_ref = video_ref

        # Attempt FFmpeg trim if suggestion exists and video is downloadable
        if trim_suggestion and isinstance(trim_suggestion, dict):
            start_sec = trim_suggestion.get("start_sec", 0)
            end_sec = trim_suggestion.get("end_sec", 0)

            if end_sec > start_sec and video_ref:
                video_bytes = _safe_download_bytes(video_ref)
                if video_bytes:
                    trimmed_bytes = _ffmpeg_trim(video_bytes, start_sec, end_sec)
                    if trimmed_bytes:
                        # Upload trimmed video
                        trim_filename = f"shot_{shot_id}_trimmed.mp4"
                        final_video_ref = _safe_upload_bytes(
                            state, node_id, trimmed_bytes,
                            trim_filename, "video/mp4",
                        )
                        total_bytes += len(trimmed_bytes)
                        trimmed = True
                        trim_count += 1
                        logger.info(
                            "N17: Shot %s trimmed %.1fs-%.1fs (%d bytes)",
                            shot_id, start_sec, end_sec, len(trimmed_bytes),
                        )
                    else:
                        logger.warning("N17: FFmpeg trim failed for shot %s, using original", shot_id)

        frozen_video = {
            "shot_id": shot_id,
            "video_ref": final_video_ref,
            "frozen_at": frozen_at,
            "trimmed": trimmed,
            "trim_suggestion": trim_suggestion if trimmed else None,
            "pacing_judgment": pacing_info.get("pacing_judgment", "ok"),
            "actual_duration_sec": pacing_info.get("actual_duration_sec"),
            "upscaled": False,  # MVP: skip upscaling
        }

        frozen_videos.append(frozen_video)

    # File size check (≤ 500MB per episode)
    max_episode_bytes = 500 * 1024 * 1024  # 500MB
    size_warning = None
    if total_bytes > max_episode_bytes:
        size_warning = f"Total frozen video size {total_bytes / (1024*1024):.1f}MB exceeds 500MB limit"
        logger.warning("N17: %s", size_warning)

    payload = {
        "frozen_videos": frozen_videos,
        "total_frozen": len(frozen_videos),
        "total_trimmed": trim_count,
        "total_bytes": total_bytes,
        "size_within_limit": total_bytes <= max_episode_bytes,
        "pacing_summary": {
            "overall_rhythm_score": pacing_report.get("overall_rhythm_score"),
            "total_duration_sec": pacing_report.get("total_duration_sec"),
            "target_duration_sec": pacing_report.get("target_duration_sec"),
        },
        "frozen_at": frozen_at,
        "size_warning": size_warning,
        "upscale_note": "MVP: upscaling deferred (RealESRGAN interface reserved)",
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info(
        "N17 completed: %d videos frozen (%d trimmed, %d bytes) in %.1fs",
        len(frozen_videos), trim_count, total_bytes, duration,
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
    )


# ── N19: Visual Freeze (Pure State Marking) ───────────────────────────────


def handle_n19(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N19 — 视觉素材定稿: N18 Gate 通过后标记所有视频 frozen。

    纯固化节点: 不调模型、不调 ComfyUI。
    Gate 通过后将 N17 已固化的所有视频标记为最终视觉定稿。
    """
    t0 = time.monotonic()

    # #4 Fix: Verify N18 Gate approval before proceeding
    gate_ok, gate_error = _verify_gate_approved("N18", state)
    if not gate_ok:
        logger.error("N19 blocked: %s", gate_error)
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error=gate_error,
            error_code="GATE_NOT_APPROVED",
        )

    # Load N18 gate output (approval confirmation)
    n18_output = load_node_output_payload("N18", state, default={})

    # Load N17 frozen videos (already frozen by N17)
    n17_output = load_node_output_payload("N17", state, default={})

    frozen_videos: list[dict] = []
    if isinstance(n17_output, dict):
        frozen_videos = n17_output.get("frozen_videos", [])

    frozen_at = _iso_now()

    # Mark all videos as visually frozen (post-gate confirmation)
    visual_frozen_items: list[dict] = []
    for video in frozen_videos:
        visual_frozen_items.append({
            "shot_id": video.get("shot_id", "unknown"),
            "video_ref": video.get("video_ref", ""),
            "visual_frozen": True,
            "gate_approved": True,
            "frozen_at": frozen_at,
        })

    payload = {
        "visual_frozen_items": visual_frozen_items,
        "total_frozen": len(visual_frozen_items),
        "gate_node": "N18",
        "frozen_at": frozen_at,
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info("N19 completed: %d visual items frozen (post-gate) in %.1fs", len(visual_frozen_items), duration)

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
    )


# ── N22: AV Freeze (Pure State Marking) ──────────────────────────────────


def handle_n22(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N22 — 视听定稿: N21 Gate 通过后固化所有视听产物。

    纯固化节点: 不调外部模型。
    固化内容: 视频 + TTS 音频 + BGM + SFX + 字幕
    可选: STT 校验字幕准确性 (MVP 跳过)
    """
    t0 = time.monotonic()

    # #5 Fix: Verify N21 Gate approval before proceeding
    gate_ok, gate_error = _verify_gate_approved("N21", state)
    if not gate_ok:
        logger.error("N22 blocked: %s", gate_error)
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error=gate_error,
            error_code="GATE_NOT_APPROVED",
        )

    # Load N21 gate output (approval confirmation)
    n21_output = load_node_output_payload("N21", state, default={})

    # Load N20 AV integration output (all audio-visual products)
    n20_output = load_node_output_payload("N20", state, default={})

    frozen_at = _iso_now()

    # Collect all AV tracks from N20
    av_tracks: dict[str, Any] = {}
    if isinstance(n20_output, dict):
        av_tracks = {
            "tts_tracks": n20_output.get("tts_tracks", []),
            "bgm_tracks": n20_output.get("bgm_tracks", []),
            "sfx_tracks": n20_output.get("sfx_tracks", []),
            "subtitle_tracks": n20_output.get("subtitle_tracks", []),
            "mixed_audio_ref": n20_output.get("mixed_audio_ref"),
            "lip_sync_applied": n20_output.get("lip_sync_applied", False),
        }

    # Also gather frozen videos from N19
    n19_output = load_node_output_payload("N19", state, default={})
    frozen_videos: list[dict] = []
    if isinstance(n19_output, dict):
        frozen_videos = n19_output.get("visual_frozen_items", [])

    # Build frozen AV artifact list
    frozen_av_items: list[dict] = []

    # Freeze video tracks
    for video in frozen_videos:
        frozen_av_items.append({
            "track_type": "video",
            "shot_id": video.get("shot_id"),
            "ref": video.get("video_ref", ""),
            "frozen": True,
            "frozen_at": frozen_at,
        })

    # Freeze TTS tracks
    for tts in av_tracks.get("tts_tracks", []):
        frozen_av_items.append({
            "track_type": "tts",
            "shot_id": tts.get("shot_id") if isinstance(tts, dict) else None,
            "ref": tts.get("audio_ref", "") if isinstance(tts, dict) else str(tts),
            "frozen": True,
            "frozen_at": frozen_at,
        })

    # Freeze BGM tracks
    for bgm in av_tracks.get("bgm_tracks", []):
        frozen_av_items.append({
            "track_type": "bgm",
            "ref": bgm.get("audio_ref", "") if isinstance(bgm, dict) else str(bgm),
            "frozen": True,
            "frozen_at": frozen_at,
        })

    # Freeze SFX tracks
    for sfx in av_tracks.get("sfx_tracks", []):
        frozen_av_items.append({
            "track_type": "sfx",
            "ref": sfx.get("audio_ref", "") if isinstance(sfx, dict) else str(sfx),
            "frozen": True,
            "frozen_at": frozen_at,
        })

    # Freeze subtitle tracks
    for sub in av_tracks.get("subtitle_tracks", []):
        frozen_av_items.append({
            "track_type": "subtitle",
            "ref": sub.get("subtitle_ref", "") if isinstance(sub, dict) else str(sub),
            "frozen": True,
            "frozen_at": frozen_at,
        })

    # Freeze mixed audio
    if av_tracks.get("mixed_audio_ref"):
        frozen_av_items.append({
            "track_type": "mixed_audio",
            "ref": av_tracks["mixed_audio_ref"],
            "frozen": True,
            "frozen_at": frozen_at,
        })

    payload = {
        "frozen_av_items": frozen_av_items,
        "total_frozen": len(frozen_av_items),
        "track_summary": {
            "video": len(frozen_videos),
            "tts": len(av_tracks.get("tts_tracks", [])),
            "bgm": len(av_tracks.get("bgm_tracks", [])),
            "sfx": len(av_tracks.get("sfx_tracks", [])),
            "subtitle": len(av_tracks.get("subtitle_tracks", [])),
            "mixed_audio": 1 if av_tracks.get("mixed_audio_ref") else 0,
        },
        "stt_validation": None,  # MVP: STT validation deferred
        "gate_node": "N21",
        "frozen_at": frozen_at,
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info("N22 completed: %d AV items frozen (post-gate) in %.1fs", len(frozen_av_items), duration)

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
    )


# ── N25: Final Freeze + Archive ───────────────────────────────────────────


def handle_n25(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N25 — 成片定稿: N24 三步 Gate 全通过后标记成片 delivered。

    核心动作:
    1. 标记成片为 delivered
    2. 写入最终 artifacts (type=final_cut)
    3. 更新 episode_versions.status = delivered
    4. 设置归档保留策略 (temp_30d / permanent)
    """
    t0 = time.monotonic()

    # Load N24 gate output (three-step approval confirmation)
    n24_output = load_node_output_payload("N24", state, default={})

    # Load N23 final composite (the actual video)
    n23_output = load_node_output_payload("N23", state, default={})

    frozen_at = _iso_now()

    final_video_ref = ""
    final_video_meta: dict = {}
    if isinstance(n23_output, dict):
        final_video_ref = n23_output.get("final_video_ref", n23_output.get("output_ref", ""))
        final_video_meta = {
            "duration_sec": n23_output.get("duration_sec"),
            "resolution": n23_output.get("resolution"),
            "file_size_bytes": n23_output.get("file_size_bytes"),
            "format": n23_output.get("format", "mp4"),
        }

    episode_id = state.get("episode_id", "")
    episode_version_id = state.get("episode_version_id", "")
    run_id = state.get("run_id", "")

    # Build archive retention policy
    archive_policy: list[dict] = [
        {
            "artifact_type": "final_cut",
            "retention": "permanent",
            "ref": final_video_ref,
        },
        {
            "artifact_type": "frozen_keyframes",
            "retention": "permanent",
            "note": "Character/scene reference for future episodes",
        },
        {
            "artifact_type": "frozen_art_assets",
            "retention": "permanent",
            "note": "Character consistency baseline",
        },
        {
            "artifact_type": "intermediate_candidates",
            "retention": "temp_30d",
            "note": "Non-selected candidates, delete after 30 days",
        },
        {
            "artifact_type": "comfyui_workflows",
            "retention": "temp_30d",
            "note": "Workflow JSON logs",
        },
        {
            "artifact_type": "llm_prompt_logs",
            "retention": "temp_30d",
            "note": "LLM call logs",
        },
    ]

    # Update episode_versions.status = delivered via DB
    _update_episode_version_status(episode_version_id, "delivered")

    payload = {
        "delivered": True,
        "final_video_ref": final_video_ref,
        "final_video_meta": final_video_meta,
        "episode_id": episode_id,
        "episode_version_id": episode_version_id,
        "frozen_at": frozen_at,
        "archive_policy": archive_policy,
        "gate_node": "N24",
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info("N25 completed: episode %s delivered, final_cut frozen in %.1fs", episode_id, duration)

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
    )


def _update_episode_version_status(episode_version_id: str, status: str) -> None:
    """Update episode_versions.status in DB. Silently skip if DB unavailable."""
    if not episode_version_id:
        return
    try:
        from backend.common.db import execute
        execute(
            """
            UPDATE public.episode_versions
            SET status = %s, updated_at = now()
            WHERE id::text = %s
            """,
            (status, episode_version_id),
        )
        logger.info("Updated episode_version %s status to %s", episode_version_id, status)
    except ImportError:
        logger.debug("DB not available, skipping episode_version status update")
    except Exception as exc:
        logger.warning("Failed to update episode_version status: %s", exc)


# ── N26: Distribution (Stub) ─────────────────────────────────────────────


def handle_n26(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N26 — 分发与推送: 记录 DistributionRecord，MVP 不真实推送。

    核心动作:
    1. 读取 N25 成片信息 + 分发配置
    2. 为每个目标平台创建 DistributionRecord
    3. MVP: auto_publish=false, 只记录 draft 状态
    4. 真实 API 推送 (TikTok/飞书/YouTube) 在 MVP-1 接入
    """
    t0 = time.monotonic()

    # Load N25 final episode info
    n25_output = load_node_output_payload("N25", state, default={})

    final_video_ref = ""
    if isinstance(n25_output, dict):
        final_video_ref = n25_output.get("final_video_ref", "")

    # Try to load distribution config from episode context or N25
    dist_config: dict = {}
    if isinstance(n25_output, dict):
        dist_config = n25_output.get("distribution_config", {})

    # Default platforms if no config
    platforms: list[str] = dist_config.get("platforms", ["tiktok", "feishu"])
    auto_publish: bool = dist_config.get("auto_publish", False)

    # Create distribution records (all stubs in MVP)
    distribution_records: list[dict] = []
    distributed_at = _iso_now()

    for platform in platforms:
        record = {
            "platform": platform,
            "status": "draft",  # MVP: never auto-publish
            "external_url": None,
            "external_id": None,
            "published_at": None,
            "draft_created_at": distributed_at,
            "auto_publish": auto_publish,
            "video_ref": final_video_ref,
            "error": None,
        }

        # Platform-specific stub metadata
        if platform == "tiktok":
            tiktok_config = dist_config.get("tiktok_config", {})
            record["platform_config"] = {
                "account_id": tiktok_config.get("account_id", "stub_account"),
                "hashtags": tiktok_config.get("hashtags", []),
                "publish_time": tiktok_config.get("publish_time"),
            }
        elif platform == "feishu":
            feishu_config = dist_config.get("feishu_config", {})
            record["platform_config"] = {
                "group_id": feishu_config.get("group_id", "stub_group"),
                "mention_users": feishu_config.get("mention_users", []),
            }
        elif platform == "youtube":
            youtube_config = dist_config.get("youtube_config", {})
            record["platform_config"] = {
                "channel_id": youtube_config.get("channel_id", "stub_channel"),
                "visibility": youtube_config.get("visibility", "private"),
            }
        else:
            record["platform_config"] = {}

        distribution_records.append(record)
        logger.info("N26: Distribution record created for %s (draft, MVP stub)", platform)

    payload = {
        "distribution_records": distribution_records,
        "total_platforms": len(distribution_records),
        "all_draft": True,
        "distributed_at": distributed_at,
        "mvp_note": "All records are draft stubs. Real platform API integration in MVP-1.",
    }

    output_ref = _safe_upload_json(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info("N26 completed: %d distribution records created (all draft) in %.1fs", len(distribution_records), duration)

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=payload,
        duration_s=duration,
    )


# ── Registration ──────────────────────────────────────────────────────────


def register() -> None:
    """Register all freeze/distribution handlers. Called by handlers/__init__.py."""
    global _REGISTERED
    if _REGISTERED:
        return

    register_handler("N09", handle_n09)
    register_handler("N13", handle_n13)
    register_handler("N17", handle_n17)
    register_handler("N19", handle_n19)
    register_handler("N22", handle_n22)
    register_handler("N25", handle_n25)
    register_handler("N26", handle_n26)
    _REGISTERED = True
    logger.info("Freeze handlers registered: N09, N13, N17, N19, N22, N25, N26")
