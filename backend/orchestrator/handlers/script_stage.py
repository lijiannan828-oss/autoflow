"""Real LLM handlers for the script-stage chain (N01/N02/N04/N05/N06).

Replaces Round 8 deterministic stubs with actual LLM calls via dmxapi.cn
OpenAI-compatible proxy.  Each handler:

1. Loads upstream node outputs via context helpers.
2. Assembles System + User prompts from node-spec-sheet.md.
3. Calls call_llm() with json_mode=True.
4. Uploads structured output to TOS.
5. Wraps in NodeOutputEnvelope and returns NodeResult.

Model: SCRIPT_STAGE_MODEL ("gemini-3.1-pro-preview") with fallback chain
       managed by llm_client (→ claude-opus-4-6 → gemini-2.5-pro → …).
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


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()


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
        model_provider="llm",
        model_endpoint=model_name or SCRIPT_STAGE_MODEL,
        output_payload=payload,
        output_envelope=envelope,
        quality_score=quality_score,
        error=error,
        error_code=error_code,
    )


# ── N01: Script Structure Parsing ─────────────────────────────────────────

_N01_SYSTEM_PROMPT = """\
你是一个专业的短剧剧本结构化分析师。你的任务是从原始剧本文本中提取以下结构化信息：

1. 世界观设定（时代、地点、基调、视觉风格、色彩基调）
2. 角色档案（外貌精确到五官/发型/肤色/体型、性格、服装方案）
3. 场景档案（地点名称、光照条件、道具、日夜变体）
4. 分集骨架（每集概要含 hook/development/climax/cliffhanger、情感基调、估计时长）
5. 场景骨架（每集内的场景划分、出场角色、场景描述、情感走势）
6. 全局统计（总集数、总场景数、估计总镜头数）

输出必须严格遵循 ParsedScript JSON Schema。

关键规则：
- 角色外貌描述必须具体到五官、发型、肤色、体型，绝对不能含糊
- 每个场景必须关联到具体 location_id
- 分集概要需包含 hook / development / climax / cliffhanger 四段式
- 单集时长按短剧节奏估算（50-90s）
- 本阶段不需要拆到镜头级，镜头拆分由下游 N02 完成
- 如果输入中包含已有分镜参考（existing_storyboard），提取其中的场景/角色/情绪信息作为辅助，但不直接采信镜头划分

输出 JSON Schema (ParsedScript):
{
  "project_id": "string",
  "title": "string",
  "genre": "string",
  "style_tags": ["string"],
  "aspect_ratio": "string",
  "primary_language": "string",
  "world_setting": {
    "time_period": "string",
    "location_overview": "string",
    "tone": "string",
    "visual_style_guide": "string",
    "color_palette": ["string (hex)"]
  },
  "character_registry": [{
    "character_id": "string",
    "name": "string",
    "gender": "string",
    "age": number,
    "role_type": "protagonist|antagonist|supporting|extra",
    "appearance": {
      "ethnicity": "string",
      "face_shape": "string",
      "hair": "string",
      "eyes": "string",
      "skin_tone": "string",
      "height": "string",
      "body_type": "string"
    },
    "costumes": [{"costume_id": "string", "name": "string", "description": "string", "color_scheme": "string"}],
    "voice_config": {"tts_engine": "string", "voice_description": "string", "speed_factor": number},
    "reference_assets": {"face_ref_front": "", "face_ref_three_quarter": "", "face_ref_side": "", "full_body_ref_images": []},
    "episode_appearances": [number],
    "first_appearance_episode": number,
    "total_scenes": number
  }],
  "location_registry": [{
    "location_id": "string",
    "name": "string",
    "description": "string",
    "time_of_day_variants": {"day": "string", "night": "string"},
    "lighting_style": "string",
    "props": ["string"],
    "reference_images": [],
    "episode_appearances": [number]
  }],
  "episodes": [{
    "episode_id": "string",
    "episode_number": number,
    "title": "string",
    "synopsis": "string",
    "narrative_arc": {"hook": "string", "development": "string", "climax": "string", "cliffhanger": "string"},
    "scenes": [{
      "scene_id": "string",
      "scene_number": number,
      "location_id": "string",
      "time_of_day": "string",
      "characters_present": ["string (character_id)"],
      "scene_description": "string",
      "emotional_progression": ["string"],
      "estimated_duration_sec": number
    }],
    "target_duration_sec": number,
    "estimated_shot_count": number,
    "dominant_emotion": "string"
  }],
  "total_episodes": number,
  "total_scenes": number,
  "total_estimated_shots": number,
  "prompt_language": "string",
  "parsed_at": "ISO 8601",
  "parser_model": "string",
  "parser_version": "string"
}"""


def _build_n01_user_prompt(raw_input: dict) -> str:
    """Assemble the N01 user prompt from RawScriptInput fields."""
    parts = []
    parts.append("## 剧本正文")
    parts.append(raw_input.get("script_text", "(无剧本正文)"))

    arc = raw_input.get("narrative_arc")
    if arc:
        parts.append("\n## 三幕结构")
        parts.append(json.dumps(arc, ensure_ascii=False, indent=2))

    presets = raw_input.get("character_presets")
    if presets:
        parts.append("\n## 角色预设")
        parts.append(json.dumps(presets, ensure_ascii=False, indent=2))

    storyboard = raw_input.get("existing_storyboard")
    if storyboard:
        parts.append("\n## 已有分镜参考")
        parts.append(json.dumps(storyboard, ensure_ascii=False, indent=2))

    reqs = raw_input.get("production_requirements", {})
    parts.append("\n## 制作要求")
    parts.append(f"- 体裁: {raw_input.get('genre', '短剧')}")
    parts.append(f"- 风格标签: {raw_input.get('style_tags', [])}")
    parts.append(f"- 目标画幅: {raw_input.get('aspect_ratio', '9:16')}")
    parts.append(f"- 总集数: {raw_input.get('total_episodes', 1)}")
    parts.append(f"- 单集时长: {raw_input.get('episode_duration_sec', 75)}s")
    parts.append(f"- 主语言: {raw_input.get('primary_language', 'zh')}")
    if reqs:
        parts.append(f"- 其他制作要求: {json.dumps(reqs, ensure_ascii=False)}")

    parts.append("\n请输出完整的 ParsedScript JSON。")
    return "\n".join(parts)


def _get_raw_script_input(state: PipelineState) -> dict:
    """Build RawScriptInput from state context or DB fallback.

    Tries docx_parser if a file path is available, otherwise constructs
    from episode context or DB source row (matching Round 8 pattern).
    """
    # Try episode context first (may have been pre-loaded)
    ctx = load_episode_context(state)
    if isinstance(ctx, dict) and not ctx.get("_stub"):
        # Context loader returned real data — use it as raw input
        return {
            "script_text": ctx.get("script_text", ""),
            "narrative_arc": ctx.get("narrative_arc"),
            "character_presets": ctx.get("character_presets", []),
            "production_requirements": ctx.get("production_requirements", {}),
            "existing_storyboard": ctx.get("existing_storyboard"),
            "project_meta": ctx.get("project_meta"),
            "genre": ctx.get("genre", "短剧"),
            "style_tags": ctx.get("style_tags", []),
            "aspect_ratio": ctx.get("aspect_ratio", "9:16"),
            "total_episodes": ctx.get("total_episodes", 1),
            "episode_duration_sec": ctx.get("episode_duration_sec", 75),
            "primary_language": ctx.get("primary_language", "zh"),
        }

    # Fallback: try DB source row (same pattern as Round 8 script_handlers)
    try:
        from backend.common.db import fetch_one
        episode_version_id = state.get("episode_version_id")
        if episode_version_id:
            row = fetch_one(
                """
                select
                    ev.id::text as episode_version_id,
                    e.title, e.project_name, p.description,
                    p.meta_json
                from public.episode_versions ev
                left join public.episodes e on e.id = ev.episode_id::text
                left join public.projects p on p.name = e.project_name
                where ev.id::text = %s
                limit 1
                """,
                (str(episode_version_id),),
            )
            if row:
                meta = row.get("meta_json") or {}
                if not isinstance(meta, dict):
                    meta = {}
                return {
                    "script_text": meta.get("script_text", row.get("description", "")),
                    "narrative_arc": meta.get("narrative_arc"),
                    "character_presets": meta.get("character_presets", []),
                    "production_requirements": meta.get("production_requirements", {}),
                    "existing_storyboard": meta.get("existing_storyboard"),
                    "genre": meta.get("genre", "短剧"),
                    "style_tags": meta.get("style_tags", []),
                    "aspect_ratio": meta.get("aspect_ratio", "9:16"),
                    "total_episodes": meta.get("total_episodes", 1),
                    "episode_duration_sec": meta.get("episode_duration_sec", 75),
                    "primary_language": meta.get("primary_language", "zh"),
                }
    except Exception as exc:
        logger.warning("N01 DB fallback failed: %s", exc)

    # Last resort: minimal placeholder (will still call LLM)
    return {
        "script_text": "（未提供剧本，请基于通用短剧框架生成结构化骨架）",
        "genre": "都市情感短剧",
        "style_tags": ["都市", "情感"],
        "aspect_ratio": "9:16",
        "total_episodes": 1,
        "episode_duration_sec": 75,
        "primary_language": "zh",
    }


def handle_n01(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N01 — Script Structure Parsing: docx → LLM → ParsedScript JSON → TOS."""
    t0 = time.monotonic()

    raw_input = _get_raw_script_input(state)
    user_prompt = _build_n01_user_prompt(raw_input)

    try:
        resp = call_llm(
            SCRIPT_STAGE_MODEL,
            _N01_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.3,
            max_tokens=16384,
            json_mode=True,
            timeout=180.0,
            max_retries=3,
        )
    except LLMError as exc:
        duration = time.monotonic() - t0
        logger.error("N01 LLM call failed: %s", exc)
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_CALL_FAILED",
        )

    parsed_script = resp.parsed or {}

    # Enrich with metadata
    parsed_script["parsed_at"] = _iso_now()
    parsed_script["parser_model"] = resp.model
    parsed_script["parser_version"] = "mvp0-real-llm"

    output_ref = _safe_upload(state, node_id, parsed_script)
    duration = time.monotonic() - t0

    logger.info(
        "N01 completed: model=%s cost=%.4f duration=%.1fs characters=%d episodes=%d",
        resp.model, resp.cost_cny, duration,
        len(parsed_script.get("character_registry", [])),
        len(parsed_script.get("episodes", [])),
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=parsed_script,
        llm_resp=resp,
        duration_s=duration,
    )


# ── N02: Episode Shot Splitting ───────────────────────────────────────────

_N02_SYSTEM_PROMPT = """\
你是一个专业的短剧导演 AI。你的任务是将结构化剧本的一集拆解为可直接用于 AIGC 生产的镜头级规格。

对本集的每个场景，你需要：
1. 将场景拆分为具体镜头（ShotSpec）
2. 为每个镜头指定：
   - shot_type（景别）、camera_movement（运镜）
   - visual_prompt（正向提示词，必须用英文，面向图像/视频生成模型）
   - negative_prompt（负向提示词，英文）
   - 出场角色及其位置、动作、表情
   - 对白（含情感标签和时间窗口估算）
   - 预估时长（0.5s 粒度）
   - 关键帧骨架（keyframe_specs: 关键时间点比例 + 构图描述，不需要填生成参数）
3. 为每个场景指定 BGM 配置（mood + intensity curve）

关键规则：
- 短剧节奏极快，单个镜头 1-3s，平均约 2s
- 单集 50-90s 对应约 30-60 个镜头
- visual_prompt 必须用英文，包含具体画面描述（人物、场景、光线、构图、情绪）
- 对白时间窗口 = 文字长度 / 语速估算（中文 ~4 字/秒，英文 ~2.5 词/秒）
- 每集 target_duration_sec 必须被镜头时长之和覆盖（允许 ±10% 误差）
- camera_movement 必须在支持列表内: static, pan_left, pan_right, tilt_up, tilt_down, dolly_in, dolly_out, tracking, crane_up, handheld, zoom_in, zoom_out, orbital, whip_pan
- 每集需要前置 3-5s 高光镜头闪回再进入正片

输出 JSON Schema: EpisodeScript
{
  "episode_id": "string",
  "episode_number": number,
  "title": "string",
  "synopsis": "string",
  "narrative_arc": {"hook": "string", "development": "string", "climax": "string", "cliffhanger": "string"},
  "scenes": [{
    "scene_id": "string",
    "episode_id": "string",
    "scene_number": number,
    "location_id": "string",
    "time_of_day": "string",
    "characters_present": ["character_id"],
    "scene_description": "string",
    "emotional_progression": ["string"],
    "estimated_duration_sec": number,
    "bgm_config": {"mood": "string", "intensity_curve": [{"position_ratio": number, "intensity": number}], "transition_in": "string", "transition_out": "string"},
    "shots": [{
      "shot_id": "string",
      "scene_id": "string",
      "episode_id": "string",
      "shot_number": number,
      "global_shot_index": number,
      "shot_type": "string",
      "camera_movement": "string",
      "action_description": "string",
      "visual_prompt": "string (English, detailed)",
      "negative_prompt": "string (English)",
      "characters_in_shot": [{
        "character_id": "string",
        "position_in_frame": "string",
        "action": "string",
        "expression": "string",
        "costume_id": "string",
        "is_speaking": boolean,
        "needs_consistency_lock": boolean
      }],
      "dialogue": [{
        "line_id": "string",
        "character_id": "string",
        "text": "string",
        "emotion": "string",
        "timing": {"start_sec": number, "end_sec": number}
      }],
      "duration_sec": number,
      "keyframe_specs": [{
        "keyframe_index": number,
        "timestamp_ratio": number,
        "prompt": "string (English, composition description)",
        "character_positions": [{"character_id": "string", "position": "string", "pose_description": "string", "expression": "string", "face_direction": "string"}],
        "retention_policy": "temp_30d"
      }]
    }]
  }],
  "target_duration_sec": number,
  "estimated_shot_count": number,
  "dominant_emotion": "string"
}"""


def handle_n02(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N02 — Episode Shot Splitting: ParsedScript → LLM → EpisodeScript → TOS."""
    t0 = time.monotonic()

    # Load N01 output (ParsedScript)
    parsed_script = load_node_output_payload("N01", state)
    if not parsed_script:
        ctx = load_episode_context(state)
        parsed_script = ctx.get("parsed_script") if isinstance(ctx, dict) else None
    if not parsed_script:
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error="N01 output (ParsedScript) not found",
            error_code="MISSING_UPSTREAM_OUTPUT",
        )

    # Build user prompt with full context
    episode_id = state.get("episode_id") or "ep-001"
    episodes = parsed_script.get("episodes", [])
    # Find current episode or use first
    current_episode = None
    for ep in episodes:
        if ep.get("episode_id") == episode_id:
            current_episode = ep
            break
    if not current_episode and episodes:
        current_episode = episodes[0]

    user_prompt_parts = [
        "## 结构化剧本（全局上下文）",
        "### 世界观设定",
        json.dumps(parsed_script.get("world_setting", {}), ensure_ascii=False, indent=2),
        "\n### 角色档案",
        json.dumps(parsed_script.get("character_registry", []), ensure_ascii=False, indent=2),
        "\n### 场景档案",
        json.dumps(parsed_script.get("location_registry", []), ensure_ascii=False, indent=2),
        "\n## 本集信息",
        json.dumps(current_episode or {"episode_id": episode_id}, ensure_ascii=False, indent=2),
    ]

    # Include existing storyboard if available
    existing_storyboard = parsed_script.get("existing_storyboard")
    if existing_storyboard:
        user_prompt_parts.append("\n## 已有分镜参考")
        user_prompt_parts.append(json.dumps(existing_storyboard, ensure_ascii=False, indent=2))

    user_prompt_parts.append("\n请将本集拆分为场景→镜头级规格，输出完整的 EpisodeScript JSON。")
    user_prompt = "\n".join(user_prompt_parts)

    try:
        resp = call_llm(
            SCRIPT_STAGE_MODEL,
            _N02_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.5,
            max_tokens=32768,
            json_mode=True,
            timeout=360.0,
            max_retries=3,
        )
    except LLMError as exc:
        duration = time.monotonic() - t0
        logger.error("N02 LLM call failed: %s", exc)
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_CALL_FAILED",
        )

    episode_script = resp.parsed or {}
    episode_script.setdefault("episode_id", episode_id)

    output_ref = _safe_upload(state, node_id, episode_script)
    duration = time.monotonic() - t0

    shot_count = sum(
        len(scene.get("shots", []))
        for scene in episode_script.get("scenes", [])
    )
    logger.info(
        "N02 completed: model=%s cost=%.4f duration=%.1fs scenes=%d shots=%d",
        resp.model, resp.cost_cny, duration,
        len(episode_script.get("scenes", [])),
        shot_count,
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=episode_script,
        llm_resp=resp,
        duration_s=duration,
    )


# ── N04: Storyboard Finalization ──────────────────────────────────────────

_N04_SYSTEM_PROMPT = """\
你是短剧导演 AI 的定稿模块。你将收到：
1. 完整的分镜规格（EpisodeScript）
2. 质检评审结果中的 minor issues

你的任务：
- 对 severity=minor 的问题：直接修正相应字段
- 对已通过的部分：保持原样，不过度修改
- 确保所有 visual_prompt 语法正确、可被生成模型执行
- 确保对白时间窗口与镜头时长一致
- 确保角色出场与 character_registry 一致
- 修改处填写 _diff_notes 说明改动理由

输出与输入格式完全相同的 EpisodeScript JSON，增加顶层字段 "_frozen": true 和 "_freeze_timestamp"。"""


def handle_n04(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N04 — Storyboard Finalization: if no issues → stamp frozen; else LLM fix."""
    t0 = time.monotonic()

    # Load N02 episode script (the original, pre-QC version)
    episode_script = load_node_output_payload("N02", state)
    # Load N03 QC result
    qc_result = load_node_output_payload("N03", state)

    if not episode_script:
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error="N02 output (EpisodeScript) not found",
            error_code="MISSING_UPSTREAM_OUTPUT",
        )

    # Check if there are issues to fix
    issues = []
    if isinstance(qc_result, dict):
        issues = qc_result.get("issues", [])

    minor_issues = [i for i in issues if i.get("severity") == "minor"]

    llm_resp = None

    if not minor_issues:
        # No issues → skip LLM, directly stamp frozen
        logger.info("N04: no minor issues from N03, stamping frozen without LLM call")
        frozen_script = dict(episode_script)
        frozen_script["_frozen"] = True
        frozen_script["_freeze_timestamp"] = _iso_now()
        frozen_script["_freeze_method"] = "auto_stamp_no_issues"
    else:
        # Has minor issues → call LLM to fix
        logger.info("N04: %d minor issues found, calling LLM to fix", len(minor_issues))

        user_prompt_parts = [
            "## 分镜规格（EpisodeScript）",
            json.dumps(episode_script, ensure_ascii=False, indent=2),
            "\n## 质检 Minor Issues",
            json.dumps(minor_issues, ensure_ascii=False, indent=2),
            "\n请修正以上 minor issues 并输出定稿版 EpisodeScript JSON（添加 _frozen: true）。",
        ]
        user_prompt = "\n".join(user_prompt_parts)

        try:
            resp = call_llm(
                SCRIPT_STAGE_MODEL,
                _N04_SYSTEM_PROMPT,
                user_prompt,
                temperature=0.2,
                max_tokens=32768,
                json_mode=True,
                timeout=240.0,
                max_retries=2,
            )
            llm_resp = resp
        except LLMError as exc:
            duration = time.monotonic() - t0
            logger.error("N04 LLM call failed: %s", exc)
            return _build_result(
                node_id, state,
                status="failed",
                output_ref=_output_ref(state, node_id),
                payload=None,
                duration_s=duration,
                error=str(exc),
                error_code="LLM_CALL_FAILED",
            )

        frozen_script = resp.parsed or dict(episode_script)
        frozen_script["_frozen"] = True
        frozen_script["_freeze_timestamp"] = _iso_now()
        frozen_script["_freeze_method"] = "llm_minor_fix"

    output_ref = _safe_upload(state, node_id, frozen_script)
    duration = time.monotonic() - t0

    logger.info(
        "N04 completed: method=%s duration=%.1fs issues_fixed=%d",
        frozen_script.get("_freeze_method"),
        duration,
        len(minor_issues),
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=frozen_script,
        llm_resp=llm_resp,
        duration_s=duration,
    )


# ── N05: Shot Leveling & Classification ───────────────────────────────────

_N05_SYSTEM_PROMPT = """\
你是 AIGC 生产管线的镜头难度分级专家。你的任务是为每个镜头分配生产难度和质检等级。

1. difficulty（生产难度）:
   - S0: 静态镜头、单角色近景对话、无运镜、简单场景、空镜/道具插入
   - S1: 多角色中景、简单运镜（pan/tilt/zoom）、标准场景
   - S2: 群戏远景、复杂运镜（tracking/crane/orbital/whip_pan）、动作/追逐场面

2. qc_tier（质检等级）:
   - tier_1_full: S2 镜头，或虽非 S2 但属于剧情关键节点（开场钩子、高潮、结尾悬念对应镜头）
   - tier_2_dual: S1 镜头（非关键节点）
   - tier_3_single: S0 镜头（非关键节点）

判断依据：
- 角色数量和互动复杂度
- camera_movement 类型和实现难度
- 场景复杂度（多道具、光照变化、室内外切换）
- 是否有对白和唇形同步需求
- 是否处于叙事关键位置（开场、转折、高潮、结尾）

输出 JSON：完整的 EpisodeScript（与输入结构相同），但每个 shot 新增/更新以下字段：
- difficulty: "S0" | "S1" | "S2"
- difficulty_reason: "string (简要说明)"
- qc_tier: "tier_1_full" | "tier_2_dual" | "tier_3_single"
- qc_tier_reason: "string (简要说明)"
- keyframe_count: number (S0=2, S1/S2=4)
- candidate_generation_config: {"num_candidates": number (S0=1-2, S1=2-3, S2=3-4)}"""


def handle_n05(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N05 — Shot Leveling: assign difficulty + qc_tier to each shot."""
    t0 = time.monotonic()

    # Load N04 frozen storyboard
    frozen_script = load_node_output_payload("N04", state)
    if not frozen_script:
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error="N04 output (frozen EpisodeScript) not found",
            error_code="MISSING_UPSTREAM_OUTPUT",
        )

    user_prompt_parts = [
        "## 定稿分镜（EpisodeScript, frozen）",
        json.dumps(frozen_script, ensure_ascii=False, indent=2),
        "\n请为每个 shot 分配 difficulty (S0/S1/S2) 和 qc_tier，输出完整的 EpisodeScript JSON。",
    ]
    user_prompt = "\n".join(user_prompt_parts)

    try:
        resp = call_llm(
            SCRIPT_STAGE_MODEL,
            _N05_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.2,
            max_tokens=16384,
            json_mode=True,
            timeout=120.0,
            max_retries=2,
        )
    except LLMError as exc:
        duration = time.monotonic() - t0
        logger.error("N05 LLM call failed: %s", exc)
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_CALL_FAILED",
        )

    graded_script = resp.parsed or {}
    # Preserve frozen markers
    graded_script["_frozen"] = True
    graded_script["_graded"] = True
    graded_script["_graded_at"] = _iso_now()

    output_ref = _safe_upload(state, node_id, graded_script)
    duration = time.monotonic() - t0

    # Count grading stats
    shots = [
        shot
        for scene in graded_script.get("scenes", [])
        for shot in scene.get("shots", [])
    ]
    s0 = sum(1 for s in shots if s.get("difficulty") == "S0")
    s1 = sum(1 for s in shots if s.get("difficulty") == "S1")
    s2 = sum(1 for s in shots if s.get("difficulty") == "S2")

    logger.info(
        "N05 completed: model=%s cost=%.4f duration=%.1fs shots=%d S0=%d S1=%d S2=%d",
        resp.model, resp.cost_cny, duration, len(shots), s0, s1, s2,
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=graded_script,
        llm_resp=resp,
        duration_s=duration,
    )


# ── N06: Visual Element Prompt Generation ─────────────────────────────────

_N06_SYSTEM_PROMPT = """\
你是一个 AIGC 视觉总监。你的任务是为每个角色、场景、道具设计精确的图像生成方案。

你将收到：
1. 定稿分镜（含角色出场统计、场景使用频率）
2. 角色档案（CharacterProfile: 外貌、服装、参考图）
3. 场景档案（LocationProfile: 描述、光照、道具）

对于每个角色，你需要输出：
- base_prompt: 英文正向 prompt，格式为 "Film still, ultra photorealistic, Medium shot, Half-body portrait, [角色具体外貌], [服装], grey background, studio lighting"
- negative_prompt: 排除不需要的元素
- costume_prompts: 每套服装一个变体 prompt
- expression_variants: 需要哪些表情变体
- reference_strategy: 角色一致性策略（firered_multiref / ip_adapter）
- candidate_count: 候选数量（主角 4-6，配角 2-3，群演 1-2）
- resolution: 输出分辨率

对于每个道具，你需要输出：
- 独立的 prompt + negative_prompt
- candidate_count: 1-2

对于每个场景，你需要输出：
- 多时段变体（日/夜/黄昏）的 prompt
- 场景道具和光照细节

关键规则：
- 所有 prompt 必须英文
- 角色外貌描述必须与 CharacterProfile 完全一致（五官、发色、肤色、体型）
- 人物形象风格: 真人写实，超写实风格
- 避免亚洲面孔（除非剧本明确要求），目标受众为欧美市场
- 反派角色五官可以更立体、有棱角
- reference_strategy 默认使用 firered_multiref（角色一致性最佳）

输出 JSON Schema: ArtGenerationPlan
{
  "characters": [{
    "character_id": "string",
    "base_prompt": "string (English)",
    "negative_prompt": "string (English)",
    "costume_prompts": [{"costume_id": "string", "prompt": "string (English)"}],
    "expression_variants": ["string (emotion tag)"],
    "reference_strategy": "firered_multiref" | "ip_adapter" | "none",
    "reference_images": [],
    "comfyui_workflow_id": "wf-art-assets",
    "candidate_count": number,
    "resolution": {"width": number, "height": number}
  }],
  "locations": [{
    "location_id": "string",
    "time_variants": [{"time_of_day": "string", "prompt": "string (English)"}],
    "negative_prompt": "string (English)",
    "comfyui_workflow_id": "wf-art-assets",
    "candidate_count": number,
    "resolution": {"width": number, "height": number}
  }],
  "props": [{
    "prop_id": "string",
    "prompt": "string (English)",
    "negative_prompt": "string (English)",
    "comfyui_workflow_id": "wf-art-assets",
    "candidate_count": number
  }]
}"""


def handle_n06(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N06 — Visual Element Prompt Generation: frozen+graded script → ArtGenerationPlan."""
    t0 = time.monotonic()

    # N06 depends on N04 (frozen script) + N05 (graded script)
    # The graded script from N05 is the most complete — use it as primary
    graded_script = load_node_output_payload("N05", state)
    if not graded_script:
        # Fall back to N04
        graded_script = load_node_output_payload("N04", state)
    if not graded_script:
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error="N04/N05 output not found",
            error_code="MISSING_UPSTREAM_OUTPUT",
        )

    # Load character and location registries from N01 / episode context
    parsed_script = load_node_output_payload("N01", state)
    if not parsed_script:
        ctx = load_episode_context(state)
        parsed_script = ctx if isinstance(ctx, dict) and not ctx.get("_stub") else {}

    character_registry = parsed_script.get("character_registry", [])
    location_registry = parsed_script.get("location_registry", [])

    # Extract props from scenes (props are mentioned in location_registry and shots)
    props_mentioned = set()
    for loc in location_registry:
        for p in loc.get("props", []):
            props_mentioned.add(p)

    user_prompt_parts = [
        "## 定稿分镜（含 difficulty 和 qc_tier 分级）",
        json.dumps(graded_script, ensure_ascii=False, indent=2),
        "\n## 角色档案 (CharacterProfile[])",
        json.dumps(character_registry, ensure_ascii=False, indent=2),
        "\n## 场景档案 (LocationProfile[])",
        json.dumps(location_registry, ensure_ascii=False, indent=2),
    ]

    if props_mentioned:
        user_prompt_parts.append(f"\n## 已知道具列表\n{json.dumps(list(props_mentioned), ensure_ascii=False)}")

    user_prompt_parts.append(
        "\n请为所有角色、场景、道具设计图像生成方案，输出完整的 ArtGenerationPlan JSON。"
        "\n角色分辨率: 1024×1536（3:4竖版半身），场景分辨率: 1920×1080（16:9），道具按需。"
    )
    user_prompt = "\n".join(user_prompt_parts)

    try:
        resp = call_llm(
            SCRIPT_STAGE_MODEL,
            _N06_SYSTEM_PROMPT,
            user_prompt,
            temperature=0.6,
            max_tokens=16384,
            json_mode=True,
            timeout=180.0,
            max_retries=3,
        )
    except LLMError as exc:
        duration = time.monotonic() - t0
        logger.error("N06 LLM call failed: %s", exc)
        return _build_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_CALL_FAILED",
        )

    art_plan = resp.parsed or {}

    # Wrap in the expected output envelope payload format
    output_payload = {"art_generation_plan": art_plan}

    output_ref = _safe_upload(state, node_id, output_payload)
    duration = time.monotonic() - t0

    logger.info(
        "N06 completed: model=%s cost=%.4f duration=%.1fs characters=%d locations=%d props=%d",
        resp.model, resp.cost_cny, duration,
        len(art_plan.get("characters", [])),
        len(art_plan.get("locations", [])),
        len(art_plan.get("props", [])),
    )

    return _build_result(
        node_id, state,
        output_ref=output_ref,
        payload=output_payload,
        llm_resp=resp,
        duration_s=duration,
    )


# ── Registration ──────────────────────────────────────────────────────────

def register() -> None:
    """Register all script-stage handlers. Called by handlers/__init__.py."""
    global _REGISTERED
    if _REGISTERED:
        return

    register_handler("N01", handle_n01)
    register_handler("N02", handle_n02)
    register_handler("N04", handle_n04)
    register_handler("N05", handle_n05)
    register_handler("N06", handle_n06)
    _REGISTERED = True
    logger.info("Script-stage handlers registered: N01, N02, N04, N05, N06")
