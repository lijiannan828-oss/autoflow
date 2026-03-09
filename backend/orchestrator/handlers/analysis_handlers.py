"""Real handlers for continuity & pacing analysis nodes (N12, N16).

N12 — Keyframe Continuity Check: multi-modal LLM analysis of all episode
      keyframes in sequence to detect scene/character/lighting inconsistencies.
N16 — Video Pacing & Continuity: multi-modal LLM analysis of all episode
      videos (via frame extraction) for rhythm, pacing, and story continuity.

Both nodes use SCRIPT_STAGE_MODEL (gemini-3.1-pro-preview) with fallback chain.
Day-1 implementation: pure text mode when image URLs are not available;
multi-modal mode (images= parameter) when keyframe/frame URLs are accessible.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import UTC, datetime
from typing import Any

from backend.common.llm_client import (
    LLMError,
    LLMResponse,
    SCRIPT_STAGE_MODEL,
    call_llm,
)
from backend.common.tos_client import upload_json

from backend.orchestrator.graph.context import (
    build_node_output_envelope,
    load_episode_context,
    load_node_output_payload,
)
from backend.orchestrator.graph.state import NodeResult, PipelineState
from backend.orchestrator.graph.workers import register_handler

logger = logging.getLogger(__name__)

_REGISTERED = False


# ── Helpers ───────────────────────────────────────────────────────────────

def _tos_key(state: PipelineState, node_id: str, filename: str = "output.json") -> str:
    ev_id = state.get("episode_version_id") or "unknown"
    return f"{ev_id}/{node_id}/{filename}"


def _output_ref(state: PipelineState, node_id: str) -> str:
    return f"tos://autoflow-media-2102718571-cn-shanghai/{_tos_key(state, node_id)}"


def _safe_upload(state: PipelineState, node_id: str, payload: dict) -> str:
    """Upload payload JSON to TOS; return output_ref even if TOS fails."""
    try:
        return upload_json(_tos_key(state, node_id), payload)
    except Exception as exc:
        logger.warning("TOS upload failed for %s, using synthetic ref: %s", node_id, exc)
        return _output_ref(state, node_id)


def _build_result(
    node_id: str,
    state: PipelineState,
    *,
    status: str = "succeeded",
    output_ref: str,
    payload: Any,
    llm_resp: LLMResponse | None = None,
    duration_s: float = 0.0,
    quality_score: float | None = None,
    error: str | None = None,
    error_code: str | None = None,
    model_provider: str = "llm",
) -> NodeResult:
    """Build a complete NodeResult with envelope."""
    cost = llm_resp.cost_cny if llm_resp else 0.0
    token_in = llm_resp.usage.get("prompt_tokens", 0) if llm_resp else 0
    token_out = llm_resp.usage.get("completion_tokens", 0) if llm_resp else 0
    model_name = llm_resp.model if llm_resp else None

    envelope = build_node_output_envelope(
        node_id,
        state,
        status=status,
        payload=payload,
        duration_s=duration_s,
        cost_cny=cost,
        token_in=token_in,
        token_out=token_out,
        quality_score=quality_score,
        error_code=error_code,
        error_message=error,
    )

    return NodeResult(
        node_id=node_id,
        status=status,
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=cost,
        gpu_seconds=0.0,
        duration_s=duration_s,
        model_provider=model_provider,
        model_endpoint=model_name or SCRIPT_STAGE_MODEL,
        output_payload=payload,
        output_envelope=envelope,
        quality_score=quality_score,
        error=error,
        error_code=error_code,
    )


def _extract_image_urls(items: list[dict], ref_key: str) -> list[str]:
    """Extract accessible HTTP(S) image URLs from upstream data.

    Returns a list of image URLs suitable for the LLM images= parameter.
    Filters out non-HTTP refs (tos://, stub://, etc.) since the LLM API
    needs direct HTTP access.  In production, tos:// URLs would be converted
    to pre-signed HTTP URLs before this point.
    """
    urls: list[str] = []
    for item in items:
        ref = item.get(ref_key, "")
        if isinstance(ref, str) and (ref.startswith("http://") or ref.startswith("https://")):
            urls.append(ref)
        elif isinstance(ref, dict):
            uri = ref.get("uri", "") or ref.get("url", "")
            if isinstance(uri, str) and (uri.startswith("http://") or uri.startswith("https://")):
                urls.append(uri)
    return urls


def _build_text_description(items: list[dict], item_type: str) -> str:
    """Build a text fallback description when image URLs are not available."""
    lines: list[str] = []
    for i, item in enumerate(items, 1):
        shot_id = item.get("shot_id", f"shot_{i}")
        spec = item.get("shot_spec", {})
        if isinstance(spec, dict):
            desc = spec.get("visual_prompt", "") or spec.get("description", "")
            shot_type = spec.get("shot_type", "")
            camera = spec.get("camera_movement", "")
            duration = spec.get("duration_sec", "")
            chars = spec.get("characters", [])
            char_names = ", ".join(
                c.get("name", c) if isinstance(c, dict) else str(c)
                for c in (chars if isinstance(chars, list) else [])
            )
            lines.append(
                f"[{item_type} {i}] shot_id={shot_id}, "
                f"type={shot_type}, camera={camera}, duration={duration}s, "
                f"characters=[{char_names}], description={desc}"
            )
        else:
            lines.append(f"[{item_type} {i}] shot_id={shot_id}, spec={spec}")
    return "\n".join(lines)


# ── N12: Keyframe Continuity Check ────────────────────────────────────────

_N12_SYSTEM_PROMPT = """\
你是一个专业的短剧视觉连续性分析师。你的任务是分析一集短剧中所有关键帧的序列，检查跨镜头的视觉连续性。

你需要评估以下方面：
1. **场景切换连续性**：相邻镜头之间的光照、时间、环境是否自然衔接
2. **角色外貌一致性**：同一角色在不同镜头中的外貌（服装、发型、肤色、体型）是否一致
3. **节奏分析**：镜头序列的视觉节奏是否合理
4. **阻塞性问题**：识别必须修复的严重视觉不一致

问题类型分类：
- character_appearance_change: 角色外貌在镜头间发生不合理变化
- scene_mismatch: 场景元素（道具、布景）不匹配
- lighting_jump: 光照在相邻镜头间突变
- prop_inconsistency: 道具位置/状态不连续
- temporal_gap: 时间线跳跃不合理

严重程度：
- critical: 观众一定会注意到，必须修复
- major: 仔细看会发现，建议修复
- minor: 微小瑕疵，可接受

输出严格遵循以下 JSON Schema:
{
  "overall_score": number (1-10),
  "scene_transitions": [{
    "from_shot_id": string,
    "to_shot_id": string,
    "transition_type": string,
    "continuity_score": number (1-10),
    "issues": [string] (可选)
  }],
  "character_continuity": [{
    "character_id": string,
    "consistency_across_shots": number (1-10),
    "problematic_shots": [string] (可选)
  }],
  "pacing_analysis": {
    "rhythm_score": number (1-10),
    "suggestions": [string] (可选)
  },
  "blocking_issues": [{
    "shot_id": string,
    "type": "character_appearance_change" | "scene_mismatch" | "lighting_jump" | "prop_inconsistency" | "temporal_gap",
    "severity": "critical" | "major" | "minor",
    "description": string,
    "suggestion": string
  }]
}"""


def handle_n12(node_id: str, state: PipelineState, config: dict) -> NodeResult:
    """N12 — Keyframe Continuity Check.

    Analyzes all selected keyframes in episode order to detect cross-shot
    visual continuity issues.
    """
    t0 = time.monotonic()
    logger.info("N12 start: keyframe continuity check")

    # ── Load upstream data ─────────────────────────────────────────────
    n11_output = load_node_output_payload("N11", state, default={})
    episode_keyframes: list[dict] = []

    if isinstance(n11_output, dict):
        # N11 output may contain per-shot selected keyframes
        episode_keyframes = n11_output.get("episode_keyframes", [])
        if not episode_keyframes:
            # Try alternative structures from QC output
            selected = n11_output.get("selected_keyframes", [])
            if selected:
                episode_keyframes = selected
            else:
                # Build from per-shot results
                per_shot = n11_output.get("per_shot_results", [])
                for shot_result in per_shot:
                    if isinstance(shot_result, dict):
                        episode_keyframes.append({
                            "shot_id": shot_result.get("shot_id", ""),
                            "selected_keyframe": shot_result.get("selected_candidate", {}).get("keyframe", ""),
                            "shot_spec": shot_result.get("shot_spec", {}),
                        })
    elif isinstance(n11_output, list):
        episode_keyframes = n11_output

    # ── Build prompt ───────────────────────────────────────────────────
    image_urls = _extract_image_urls(episode_keyframes, "selected_keyframe")
    use_multimodal = len(image_urls) >= 2

    if use_multimodal:
        user_prompt = (
            f"以下是本集短剧的 {len(image_urls)} 个关键帧（按镜头顺序排列）。\n"
            "请分析这些关键帧的跨镜头视觉连续性，输出 JSON 格式的 ContinuityReport。\n\n"
            "镜头信息：\n" + _build_text_description(episode_keyframes, "Keyframe")
        )
        logger.info("N12: multimodal mode with %d images", len(image_urls))
    else:
        text_desc = _build_text_description(episode_keyframes, "Keyframe")
        if not text_desc:
            text_desc = "（无上游关键帧数据，请基于通用短剧连续性标准生成一份默认报告）"
        user_prompt = (
            f"以下是本集短剧的 {len(episode_keyframes)} 个关键帧的文字描述（按镜头顺序）。\n"
            "由于图片暂不可用，请基于文字描述分析跨镜头连续性，输出 JSON 格式的 ContinuityReport。\n\n"
            f"{text_desc}"
        )
        image_urls = None  # type: ignore[assignment]
        logger.info("N12: text-only mode with %d keyframe descriptions", len(episode_keyframes))

    # ── LLM call ───────────────────────────────────────────────────────
    try:
        llm_resp = call_llm(
            SCRIPT_STAGE_MODEL,
            _N12_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.3,
            max_tokens=8192,
            json_mode=True,
            images=image_urls,
            timeout=240.0,
            max_retries=2,
            fallback=True,
        )

        continuity_report = llm_resp.parsed or {}
        # Ensure required top-level keys exist
        continuity_report.setdefault("overall_score", 7.0)
        continuity_report.setdefault("scene_transitions", [])
        continuity_report.setdefault("character_continuity", [])
        continuity_report.setdefault("pacing_analysis", {"rhythm_score": 7.0})
        continuity_report.setdefault("blocking_issues", [])

    except LLMError as exc:
        logger.error("N12 LLM call failed: %s", exc)
        duration = time.monotonic() - t0
        error_payload = {"continuity_report": {
            "overall_score": 0,
            "scene_transitions": [],
            "character_continuity": [],
            "pacing_analysis": {"rhythm_score": 0},
            "blocking_issues": [],
            "_error": str(exc),
        }}
        ref = _safe_upload(state, node_id, error_payload)
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=ref,
            payload=error_payload,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_CALL_FAILED",
        )

    # ── Upload & return ────────────────────────────────────────────────
    duration = time.monotonic() - t0
    payload = {"continuity_report": continuity_report}
    ref = _safe_upload(state, node_id, payload)

    overall_score = continuity_report.get("overall_score", 7.0)
    blocking = continuity_report.get("blocking_issues", [])
    critical_count = sum(1 for b in blocking if b.get("severity") == "critical")

    logger.info(
        "N12 done: overall_score=%.1f, blocking_issues=%d (critical=%d), cost=%.4f CNY, duration=%.1fs",
        overall_score, len(blocking), critical_count, llm_resp.cost_cny, duration,
    )

    return _build_result(
        node_id, state,
        output_ref=ref,
        payload=payload,
        llm_resp=llm_resp,
        duration_s=duration,
        quality_score=overall_score,
    )


# ── N16: Video Pacing & Continuity ────────────────────────────────────────

_N16_SYSTEM_PROMPT = """\
你是一个专业的短剧节奏与连续性分析师。你的任务是分析一集短剧中所有视频片段的节奏、时长和连续性。

你需要评估以下方面：
1. **整体节奏评分** (1-10)：全集的视觉节奏是否符合短剧快节奏要求
2. **时长分析**：总时长 vs 目标时长（短剧单集通常 50-90s），偏差百分比
3. **逐镜头节奏判断**：每个镜头是节奏过快(too_fast)、合适(ok)、还是过慢(too_slow)
4. **裁剪建议**：如果镜头偏长，给出建议的 trim 时间点
5. **场景过渡平滑度**：相邻镜头之间的过渡是否自然
6. **阻塞性问题**：必须修复才能进入下一阶段的节奏/连续性问题

输出严格遵循以下 JSON Schema:
{
  "overall_rhythm_score": number (1-10),
  "total_duration_sec": number,
  "target_duration_sec": number,
  "duration_deviation_pct": number,
  "shot_pacing": [{
    "shot_id": string,
    "actual_duration_sec": number,
    "planned_duration_sec": number,
    "pacing_judgment": "too_fast" | "ok" | "too_slow",
    "trim_suggestion": { "start_sec": number, "end_sec": number } (可选)
  }],
  "scene_transitions": [{
    "from_shot_id": string,
    "to_shot_id": string,
    "transition_smoothness": number (1-10),
    "suggestion": string (可选)
  }],
  "blocking_issues": [string]
}"""


def handle_n16(node_id: str, state: PipelineState, config: dict) -> NodeResult:
    """N16 — Video Pacing & Story Continuity.

    Analyzes all selected videos in episode order for rhythm, pacing, and
    story continuity. Uses frame extraction when videos are accessible.
    """
    t0 = time.monotonic()
    logger.info("N16 start: video pacing & continuity analysis")

    # ── Load upstream data ─────────────────────────────────────────────
    n15_output = load_node_output_payload("N15", state, default={})
    episode_videos: list[dict] = []

    if isinstance(n15_output, dict):
        episode_videos = n15_output.get("episode_videos", [])
        if not episode_videos:
            selected = n15_output.get("selected_videos", [])
            if selected:
                episode_videos = selected
            else:
                per_shot = n15_output.get("per_shot_results", [])
                for shot_result in per_shot:
                    if isinstance(shot_result, dict):
                        episode_videos.append({
                            "shot_id": shot_result.get("shot_id", ""),
                            "selected_video": shot_result.get("selected_candidate", {}).get("video", ""),
                            "shot_spec": shot_result.get("shot_spec", {}),
                        })
    elif isinstance(n15_output, list):
        episode_videos = n15_output

    # ── Build prompt ───────────────────────────────────────────────────
    # For video analysis, we attempt to extract frame URLs if available.
    # In practice, video frames would be extracted and uploaded as images
    # before reaching this handler. For MVP-0 we use text descriptions.
    image_urls = _extract_image_urls(episode_videos, "selected_video")
    use_multimodal = len(image_urls) >= 2

    # Calculate duration info from shot specs
    total_planned = 0.0
    shot_info_lines: list[str] = []
    for i, item in enumerate(episode_videos, 1):
        shot_id = item.get("shot_id", f"shot_{i}")
        spec = item.get("shot_spec", {})
        planned_dur = 0.0
        if isinstance(spec, dict):
            planned_dur = float(spec.get("duration_sec", 0) or 0)
            total_planned += planned_dur
            desc = spec.get("visual_prompt", "") or spec.get("description", "")
            shot_type = spec.get("shot_type", "")
            camera = spec.get("camera_movement", "")
            transition_in = spec.get("transition_in", "cut")
            transition_out = spec.get("transition_out", "cut")
            shot_info_lines.append(
                f"[Shot {i}] shot_id={shot_id}, type={shot_type}, "
                f"camera={camera}, planned_duration={planned_dur}s, "
                f"transition_in={transition_in}, transition_out={transition_out}, "
                f"description={desc}"
            )
        else:
            shot_info_lines.append(f"[Shot {i}] shot_id={shot_id}, spec={spec}")

    target_duration = total_planned if total_planned > 0 else 60.0  # default 60s for short drama

    if use_multimodal:
        user_prompt = (
            f"以下是本集短剧的 {len(image_urls)} 个视频片段（以关键帧代表，按镜头顺序排列）。\n"
            f"目标总时长约 {target_duration:.1f}s。\n"
            "请分析节奏和连续性，输出 JSON 格式的 PacingReport。\n\n"
            "镜头信息：\n" + "\n".join(shot_info_lines)
        )
        logger.info("N16: multimodal mode with %d frames", len(image_urls))
    else:
        text_desc = "\n".join(shot_info_lines)
        if not text_desc:
            text_desc = "（无上游视频数据，请基于通用短剧节奏标准生成一份默认报告）"
        user_prompt = (
            f"以下是本集短剧的 {len(episode_videos)} 个视频片段的文字描述（按镜头顺序）。\n"
            f"目标总时长约 {target_duration:.1f}s。\n"
            "由于视频暂不可用，请基于文字描述分析节奏和连续性，输出 JSON 格式的 PacingReport。\n\n"
            f"{text_desc}"
        )
        image_urls = None  # type: ignore[assignment]
        logger.info("N16: text-only mode with %d video descriptions", len(episode_videos))

    # ── LLM call ───────────────────────────────────────────────────────
    try:
        llm_resp = call_llm(
            SCRIPT_STAGE_MODEL,
            _N16_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.3,
            max_tokens=8192,
            json_mode=True,
            images=image_urls,
            timeout=300.0,
            max_retries=2,
            fallback=True,
        )

        pacing_report = llm_resp.parsed or {}
        pacing_report.setdefault("overall_rhythm_score", 7.0)
        pacing_report.setdefault("total_duration_sec", total_planned)
        pacing_report.setdefault("target_duration_sec", target_duration)
        pacing_report.setdefault("duration_deviation_pct", 0.0)
        pacing_report.setdefault("shot_pacing", [])
        pacing_report.setdefault("scene_transitions", [])
        pacing_report.setdefault("blocking_issues", [])

    except LLMError as exc:
        logger.error("N16 LLM call failed: %s", exc)
        duration = time.monotonic() - t0
        error_payload = {"pacing_report": {
            "overall_rhythm_score": 0,
            "total_duration_sec": 0,
            "target_duration_sec": target_duration,
            "duration_deviation_pct": 0,
            "shot_pacing": [],
            "scene_transitions": [],
            "blocking_issues": [f"LLM analysis failed: {exc}"],
            "_error": str(exc),
        }}
        ref = _safe_upload(state, node_id, error_payload)
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=ref,
            payload=error_payload,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_CALL_FAILED",
        )

    # ── Upload & return ────────────────────────────────────────────────
    duration = time.monotonic() - t0
    payload = {"pacing_report": pacing_report}
    ref = _safe_upload(state, node_id, payload)

    rhythm_score = pacing_report.get("overall_rhythm_score", 7.0)
    blocking = pacing_report.get("blocking_issues", [])

    logger.info(
        "N16 done: rhythm_score=%.1f, blocking_issues=%d, cost=%.4f CNY, duration=%.1fs",
        rhythm_score, len(blocking), llm_resp.cost_cny, duration,
    )

    return _build_result(
        node_id, state,
        output_ref=ref,
        payload=payload,
        llm_resp=llm_resp,
        duration_s=duration,
        quality_score=rhythm_score,
    )


# ── Registration ──────────────────────────────────────────────────────────

def register() -> None:
    """Register N12 and N16 handlers with the pipeline worker factory."""
    global _REGISTERED
    if _REGISTERED:
        return
    register_handler("N12", handle_n12)
    register_handler("N16", handle_n16)
    _REGISTERED = True
    logger.info("analysis_handlers registered: N12, N16")
