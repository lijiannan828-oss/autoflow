"""Minimal real handlers for the script-stage chain (N01/N02/N03).

These handlers intentionally stop short of calling real LLM providers. Their
goal for Round 8 is to replace generic stubs with deterministic business-shaped
payloads that:
1. follow the frozen node-spec contracts,
2. can pass structured payloads through artifacts/meta,
3. produce real LangGraph execution traces in runs/node_runs/artifacts.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from backend.common.db import fetch_one

from .context import build_node_output_envelope, load_episode_context, load_node_output_payload
from .state import NodeResult, PipelineState
from .workers import register_handler

_SUPPORTED_CAMERA_MOVEMENTS = {
    "static",
    "pan_left",
    "pan_right",
    "tilt_up",
    "tilt_down",
    "dolly_in",
    "dolly_out",
    "tracking",
    "crane_up",
    "handheld",
    "zoom_in",
    "zoom_out",
    "orbital",
    "whip_pan",
}

_SCRIPT_HANDLERS_REGISTERED = False


def register_script_stage_handlers() -> None:
    """Idempotently register Round 8 script-stage handlers."""
    global _SCRIPT_HANDLERS_REGISTERED
    if _SCRIPT_HANDLERS_REGISTERED:
        return

    register_handler("N01", _handle_n01)
    register_handler("N02", _handle_n02)
    register_handler("N03", _handle_n03)
    _SCRIPT_HANDLERS_REGISTERED = True


def _handle_n01(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    raw_input = _build_raw_script_input(state)
    parsed_script = _build_parsed_script(state, raw_input)
    output_ref = _default_output_ref(state, node_id)
    envelope = build_node_output_envelope(
        node_id,
        state,
        payload=parsed_script,
        duration_s=1.2,
        cost_cny=0.18,
    )
    return NodeResult(
        node_id=node_id,
        status="succeeded",
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=0.18,
        gpu_seconds=0.0,
        duration_s=1.2,
        model_provider="llm",
        model_endpoint="round8-script-analyst",
        output_payload=parsed_script,
        output_envelope=envelope,
    )


def _handle_n02(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    episode_ctx = load_episode_context(state)
    parsed_script = (
        episode_ctx.get("parsed_script")
        if isinstance(episode_ctx, dict)
        else None
    ) or load_node_output_payload("N01", state) or _build_parsed_script(
        state,
        _build_raw_script_input(state),
    )
    episode_script = _build_episode_script(state, parsed_script)
    output_ref = _default_output_ref(state, node_id)
    envelope = build_node_output_envelope(
        node_id,
        state,
        payload=episode_script,
        duration_s=1.6,
        cost_cny=0.22,
    )
    return NodeResult(
        node_id=node_id,
        status="succeeded",
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=0.22,
        gpu_seconds=0.0,
        duration_s=1.6,
        model_provider="llm",
        model_endpoint="round8-director",
        output_payload=episode_script,
        output_envelope=envelope,
    )


def _handle_n03(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    episode_script = load_node_output_payload("N02", state) or _build_episode_script(
        state,
        _build_parsed_script(state, _build_raw_script_input(state)),
    )
    qc_payload, weighted_average, issues = _evaluate_episode_script(episode_script)
    decision = str(qc_payload.get("decision") or "pass")
    status = "auto_rejected" if decision == "reject" else "succeeded"
    output_ref = _default_output_ref(state, node_id)
    envelope = build_node_output_envelope(
        node_id,
        state,
        status=status,
        payload=qc_payload,
        duration_s=0.9,
        cost_cny=0.12,
        quality_score=weighted_average,
        error_code="QUALITY_BELOW_THRESHOLD" if status == "auto_rejected" else None,
        error_message="storyboard qc rejected" if status == "auto_rejected" else None,
    )
    return NodeResult(
        node_id=node_id,
        status=status,
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=0.12,
        gpu_seconds=0.0,
        duration_s=0.9,
        quality_score=weighted_average,
        error="storyboard qc rejected" if status == "auto_rejected" else None,
        error_code="QUALITY_BELOW_THRESHOLD" if status == "auto_rejected" else None,
        model_provider="multi_llm_vote",
        model_endpoint="round8-storyboard-qc",
        output_payload=qc_payload,
        output_envelope=envelope,
    )


def _build_raw_script_input(state: PipelineState) -> dict[str, Any]:
    source = _fetch_episode_source_row(state)
    project_name = source.get("project_name") or "AIGC短剧工坊"
    episode_no = int(source.get("episode_no") or 1)
    script_text = (
        source.get("script_text")
        or source.get("description")
        or (
            "第1集：女主在高压职场与家庭债务中挣扎，收到一条会改变人生的匿名消息。"
            "她决定夜访旧工厂，在那里撞见失踪多年的关键证人。"
        )
    )
    return {
        "project_id": source.get("project_id") or state.get("project_id") or "round8-demo-project",
        "title": source.get("title") or f"{project_name} 第{episode_no}集",
        "genre": source.get("genre") or "都市悬疑短剧",
        "style_tags": source.get("style_tags") or ["都市", "悬疑", "高反差灯光"],
        "target_audience": source.get("target_audience") or "短剧平台 18-35 岁用户",
        "aspect_ratio": source.get("aspect_ratio") or "9:16",
        "total_episodes": int(source.get("total_episodes") or 1),
        "episode_duration_sec": int(source.get("episode_duration_sec") or 75),
        "primary_language": source.get("primary_language") or "zh",
        "distribution_languages": source.get("distribution_languages") or ["zh"],
        "script_text": script_text,
        "character_presets": source.get("character_presets") or [
            {
                "name": "林晚",
                "gender": "female",
                "age_range": "24-28",
                "ethnicity": "east_asian",
                "appearance_notes": "短发、神情克制、职业装",
                "voice_style": "冷静但有压迫感",
            }
        ],
        "reference_urls": source.get("reference_urls") or [],
        "style_reference_images": source.get("style_reference_images") or [],
        "created_at": _iso_now(),
        "created_by": "round8-script-handler",
    }


def _build_parsed_script(state: PipelineState, raw_input: dict[str, Any]) -> dict[str, Any]:
    episode_id = state.get("episode_id") or "ep-round8"
    target_duration = int(raw_input.get("episode_duration_sec") or 75)
    scenes = [
        {
            "scene_id": f"{episode_id}-scene-01",
            "scene_number": 1,
            "location_id": "location_office_night",
            "time_of_day": "night",
            "characters_present": ["char_linwan"],
            "scene_description": "林晚在办公室独自核对一份异常转账记录，气氛压抑。",
            "emotional_progression": ["tense", "mysterious"],
            "estimated_duration_sec": max(20, target_duration // 2),
        },
        {
            "scene_id": f"{episode_id}-scene-02",
            "scene_number": 2,
            "location_id": "location_factory_gate",
            "time_of_day": "night",
            "characters_present": ["char_linwan", "char_witness"],
            "scene_description": "林晚赶到废弃工厂门口，与失踪证人短暂接头。",
            "emotional_progression": ["tense", "surprised"],
            "estimated_duration_sec": max(20, target_duration // 2),
        },
    ]
    return {
        "project_id": raw_input["project_id"],
        "title": raw_input["title"],
        "genre": raw_input["genre"],
        "style_tags": raw_input["style_tags"],
        "aspect_ratio": raw_input["aspect_ratio"],
        "primary_language": raw_input["primary_language"],
        "world_setting": {
            "time_period": "当代都市",
            "location_overview": "金融公司办公室与废弃工厂构成双重空间",
            "tone": "高压悬疑",
            "visual_style_guide": "强对比、冷暖混光、短剧钩子感",
            "color_palette": ["#101828", "#4F46E5", "#F59E0B"],
        },
        "character_registry": [
            {
                "character_id": "char_linwan",
                "name": "林晚",
                "gender": "female",
                "age": 26,
                "role_type": "protagonist",
                "appearance": {
                    "ethnicity": "east_asian",
                    "face_shape": "oval",
                    "hair": "short black bob",
                    "eyes": "sharp almond eyes",
                    "skin_tone": "fair",
                    "height": "168cm",
                    "body_type": "slim",
                },
                "costumes": [
                    {
                        "costume_id": "costume_linwan_office",
                        "name": "深色职业装",
                        "description": "适合夜间办公室调查场景的深色西装",
                        "color_scheme": "black and navy",
                    }
                ],
                "voice_config": {
                    "tts_engine": "cosyvoice",
                    "voice_description": "冷静克制、轻微压迫感",
                    "speed_factor": 1.0,
                },
                "reference_assets": {
                    "face_ref_front": "",
                    "face_ref_three_quarter": "",
                    "face_ref_side": "",
                    "full_body_ref_images": [],
                },
                "episode_appearances": [1],
                "first_appearance_episode": 1,
                "total_scenes": 2,
            }
        ],
        "location_registry": [
            {
                "location_id": "location_office_night",
                "name": "办公室夜景",
                "description": "高楼办公室，冷色顶灯与城市霓虹反射",
                "time_of_day_variants": {"night": "办公室夜景"},
                "lighting_style": "cold office light",
                "props": ["电脑", "财务报表", "手机"],
                "reference_images": [],
                "episode_appearances": [1],
            },
            {
                "location_id": "location_factory_gate",
                "name": "废弃工厂门口",
                "description": "潮湿、昏暗、带有悬疑感的工厂入口",
                "time_of_day_variants": {"night": "废弃工厂门口夜景"},
                "lighting_style": "mixed tungsten and moonlight",
                "props": ["铁门", "路灯", "监控盲区"],
                "reference_images": [],
                "episode_appearances": [1],
            },
        ],
        "episodes": [
            {
                "episode_id": episode_id,
                "episode_number": 1,
                "title": raw_input["title"],
                "synopsis": "林晚夜查异常转账，追到旧工厂，与失踪证人接头。",
                "narrative_arc": {
                    "hook": "匿名短信突然指出财务漏洞。",
                    "development": "林晚在办公室确认线索后独自前往工厂。",
                    "climax": "她在工厂门口见到本应失踪的证人。",
                    "cliffhanger": "证人只说出半句真相就突然被人盯上。",
                },
                "scenes": scenes,
                "target_duration_sec": target_duration,
                "estimated_shot_count": max(6, int(source_safe_int(raw_input.get("episode_duration_sec"), 75) // 8)),
                "dominant_emotion": "tense",
            }
        ],
        "total_episodes": 1,
        "total_scenes": len(scenes),
        "total_estimated_shots": 9,
        "prompt_language": raw_input["primary_language"],
        "parsed_at": _iso_now(),
        "parser_model": "round8-deterministic-parser",
        "parser_version": "mvp0-r8",
    }


def _build_episode_script(state: PipelineState, parsed_script: dict[str, Any]) -> dict[str, Any]:
    episode = dict((parsed_script.get("episodes") or [{}])[0])
    episode_id = str(episode.get("episode_id") or state.get("episode_id") or "ep-round8")
    total_duration = int(episode.get("target_duration_sec") or 75)

    scene_one = {
        "scene_id": f"{episode_id}-scene-01",
        "episode_id": episode_id,
        "scene_number": 1,
        "location_id": "location_office_night",
        "time_of_day": "night",
        "characters_present": ["char_linwan"],
        "scene_description": "林晚在办公室核对异常转账记录。",
        "emotional_progression": ["tense", "mysterious"],
        "estimated_duration_sec": 32,
        "bgm_config": {
            "mood": "tense",
            "intensity_curve": [
                {"position_ratio": 0.0, "intensity": 0.2},
                {"position_ratio": 1.0, "intensity": 0.6},
            ],
            "transition_in": "fade_in",
            "transition_out": "crossfade_next",
        },
        "shots": [
            _build_shot(
                episode_id=episode_id,
                scene_id=f"{episode_id}-scene-01",
                shot_number=1,
                global_shot_index=1,
                shot_type="establishing",
                camera_movement="dolly_in",
                action_description="夜色下的办公室被屏幕光照亮，林晚发现异常数据。",
                duration_sec=3.0,
                characters=[_speaking_character("char_linwan", "center", "凝视屏幕", "tense", False)],
                dialogue=[],
                prompt_tag="financial anomaly on monitor",
                difficulty="S1",
            ),
            _build_shot(
                episode_id=episode_id,
                scene_id=f"{episode_id}-scene-01",
                shot_number=2,
                global_shot_index=2,
                shot_type="close_up",
                camera_movement="static",
                action_description="手机震动，匿名短信显示关键地点。",
                duration_sec=2.0,
                characters=[_speaking_character("char_linwan", "center_right", "拿起手机", "surprised", True)],
                dialogue=[
                    {
                        "line_id": f"{episode_id}-line-01",
                        "character_id": "char_linwan",
                        "text": "旧工厂？为什么偏偏是今晚。",
                        "emotion": "surprised",
                        "timing": {"start_sec": 0.0, "end_sec": 1.5},
                    }
                ],
                prompt_tag="phone message close-up",
                difficulty="S0",
            ),
        ],
    }

    scene_two = {
        "scene_id": f"{episode_id}-scene-02",
        "episode_id": episode_id,
        "scene_number": 2,
        "location_id": "location_factory_gate",
        "time_of_day": "night",
        "characters_present": ["char_linwan", "char_witness"],
        "scene_description": "林晚抵达废弃工厂，与证人碰面。",
        "emotional_progression": ["tense", "surprised", "fearful"],
        "estimated_duration_sec": 34,
        "bgm_config": {
            "mood": "mysterious",
            "intensity_curve": [
                {"position_ratio": 0.0, "intensity": 0.5},
                {"position_ratio": 1.0, "intensity": 0.8},
            ],
            "transition_in": "cut",
            "transition_out": "fade_out",
        },
        "shots": [
            _build_shot(
                episode_id=episode_id,
                scene_id=f"{episode_id}-scene-02",
                shot_number=1,
                global_shot_index=3,
                shot_type="medium_long",
                camera_movement="tracking",
                action_description="林晚快步穿过昏暗路灯，靠近工厂铁门。",
                duration_sec=2.5,
                characters=[_speaking_character("char_linwan", "center", "快速靠近铁门", "tense", False)],
                dialogue=[],
                prompt_tag="factory approach",
                difficulty="S1",
            ),
            _build_shot(
                episode_id=episode_id,
                scene_id=f"{episode_id}-scene-02",
                shot_number=2,
                global_shot_index=4,
                shot_type="two_shot",
                camera_movement="handheld",
                action_description="证人从阴影中现身，只来得及交代半句话。",
                duration_sec=2.5,
                characters=[
                    _speaking_character("char_linwan", "left", "警惕后退半步", "fearful", False),
                    _speaking_character("char_witness", "right", "低声示警", "tense", True),
                ],
                dialogue=[
                    {
                        "line_id": f"{episode_id}-line-02",
                        "character_id": "char_witness",
                        "text": "别再查了，他们已经知道你来了。",
                        "emotion": "tense",
                        "timing": {"start_sec": 0.0, "end_sec": 2.0},
                    }
                ],
                prompt_tag="witness reveal",
                difficulty="S1",
            ),
        ],
    }

    scenes = [scene_one, scene_two]
    episode.update(
        {
            "episode_id": episode_id,
            "episode_number": int(episode.get("episode_number") or 1),
            "title": episode.get("title") or parsed_script.get("title") or "第1集",
            "synopsis": episode.get("synopsis") or "林晚追查异常转账并撞见关键证人。",
            "narrative_arc": episode.get("narrative_arc")
            or {
                "hook": "异常短信出现。",
                "development": "林晚夜查线索。",
                "climax": "证人现身。",
                "cliffhanger": "幕后黑手逼近。",
            },
            "scenes": scenes,
            "target_duration_sec": total_duration,
            "estimated_shot_count": sum(len(scene["shots"]) for scene in scenes),
            "dominant_emotion": "tense",
        }
    )
    return episode


def _build_shot(
    *,
    episode_id: str,
    scene_id: str,
    shot_number: int,
    global_shot_index: int,
    shot_type: str,
    camera_movement: str,
    action_description: str,
    duration_sec: float,
    characters: list[dict[str, Any]],
    dialogue: list[dict[str, Any]],
    prompt_tag: str,
    difficulty: str,
) -> dict[str, Any]:
    keyframe_count = 2 if difficulty == "S0" else 4
    timestamps = [0.0, 1.0] if keyframe_count == 2 else [0.0, 0.33, 0.67, 1.0]
    shot_id = f"{scene_id}-shot-{shot_number:02d}"
    return {
        "shot_id": shot_id,
        "scene_id": scene_id,
        "episode_id": episode_id,
        "shot_number": shot_number,
        "global_shot_index": global_shot_index,
        "shot_type": shot_type,
        "camera_movement": camera_movement,
        "difficulty": difficulty,
        "difficulty_reason": "基于镜头人物数量、动作幅度和运镜复杂度的启发式分级",
        "keyframe_count": keyframe_count,
        "qc_tier": "tier_1_full",
        "action_description": action_description,
        "visual_prompt": (
            f"vertical short drama frame, {prompt_tag}, cinematic lighting, "
            "high contrast, emotionally tense, detailed faces, realistic motion"
        ),
        "negative_prompt": "low quality, broken anatomy, extra fingers, unreadable face, blurry",
        "characters_in_shot": characters,
        "consistency_locked_count": sum(1 for item in characters if item.get("needs_consistency_lock")),
        "dialogue": dialogue,
        "duration_sec": duration_sec,
        "keyframe_specs": [
            {
                "keyframe_index": index,
                "timestamp_ratio": ratio,
                "prompt": f"{prompt_tag}, frame {index}, cinematic composition",
                "character_positions": [
                    {
                        "character_id": item["character_id"],
                        "position": item["position_in_frame"],
                        "pose_description": item["action"],
                        "expression": item["expression"],
                        "face_direction": "three_quarter_left",
                    }
                    for item in characters
                ],
                "character_ref_images": [
                    {"character_id": item["character_id"], "ref_image_urls": []}
                    for item in characters
                    if item.get("needs_consistency_lock")
                ],
                "retention_policy": "temp_30d",
            }
            for index, ratio in enumerate(timestamps)
        ],
        "candidate_generation_config": {
            "num_candidates": 2 if difficulty == "S0" else 3,
            "prompt_variants": ["original", "enhanced_action", "enhanced_expression"],
        },
    }


def _speaking_character(
    character_id: str,
    position: str,
    action: str,
    expression: str,
    is_speaking: bool,
) -> dict[str, Any]:
    return {
        "character_id": character_id,
        "position_in_frame": position,
        "action": action,
        "expression": expression,
        "costume_id": "default_costume",
        "is_speaking": is_speaking,
        "needs_consistency_lock": True,
    }


def _evaluate_episode_script(episode_script: dict[str, Any]) -> tuple[dict[str, Any], float, list[dict[str, Any]]]:
    issues: list[dict[str, Any]] = []
    shots = [
        shot
        for scene in episode_script.get("scenes") or []
        for shot in scene.get("shots") or []
    ]

    if len(shots) < 3:
        issues.append(
            _quality_issue(
                shot_id=None,
                dimension="narrative_coherence",
                severity="major",
                description="镜头数量过少，无法完整承接短剧节奏。",
                suggestion="补齐 hook / development / cliffhanger 所需镜头。",
            )
        )

    for shot in shots:
        if not shot.get("visual_prompt"):
            issues.append(
                _quality_issue(
                    shot_id=shot.get("shot_id"),
                    dimension="visual_feasibility",
                    severity="critical",
                    description="缺少 visual_prompt，无法用于下游模型调用。",
                    suggestion="补全英文正向提示词。",
                )
            )
        if shot.get("camera_movement") not in _SUPPORTED_CAMERA_MOVEMENTS:
            issues.append(
                _quality_issue(
                    shot_id=shot.get("shot_id"),
                    dimension="technical_compliance",
                    severity="critical",
                    description="camera_movement 不在支持列表内。",
                    suggestion="替换为受支持的运镜方式。",
                )
            )
        duration = float(shot.get("duration_sec") or 0.0)
        if duration < 0.5 or duration > 4.0:
            issues.append(
                _quality_issue(
                    shot_id=shot.get("shot_id"),
                    dimension="pacing",
                    severity="major",
                    description="镜头时长超出 MVP-0 目标范围。",
                    suggestion="控制在 0.5s-4.0s 范围内，平均 1-3s。",
                )
            )
        expected_keyframes = 2 if shot.get("difficulty") == "S0" else 4
        if len(shot.get("keyframe_specs") or []) != expected_keyframes:
            issues.append(
                _quality_issue(
                    shot_id=shot.get("shot_id"),
                    dimension="technical_compliance",
                    severity="major",
                    description="关键帧骨架数量与难度分级不匹配。",
                    suggestion="S0 使用 2 帧，S1/S2 使用 4 帧。",
                )
            )

    major_count = sum(1 for item in issues if item["severity"] == "major")
    critical_count = sum(1 for item in issues if item["severity"] == "critical")
    weighted_average = max(5.5, 9.0 - major_count * 0.45 - critical_count * 1.2)
    dimensions = {
        "narrative_coherence": round(max(6.0, weighted_average - 0.2), 2),
        "visual_feasibility": round(max(5.0, weighted_average - critical_count * 0.3), 2),
        "pacing": round(max(6.0, weighted_average - major_count * 0.2), 2),
        "character_consistency": round(min(9.5, weighted_average + 0.1), 2),
        "technical_compliance": round(max(5.0, weighted_average - critical_count * 0.4), 2),
        "emotional_impact": round(min(9.2, weighted_average + 0.15), 2),
    }
    decision = "reject" if critical_count > 0 or weighted_average < 8.0 else "pass"
    score = {
        "shot_id": episode_script.get("episode_id"),
        "check_type": "auto",
        "qc_tier": "tier_1_full",
        "dimensions": dimensions,
        "weighted_average": round(weighted_average, 2),
        "pass_threshold": 8.0,
        "is_passed": decision == "pass",
        "model_reviews": [
            {"model_name": "GPT-5.4", "scores": dimensions, "reasoning": "整体节奏和可执行性达标。", "latency_ms": 320},
            {"model_name": "Gemini-3.1", "scores": dimensions, "reasoning": "镜头结构较完整，可进入下游。", "latency_ms": 290},
            {"model_name": "Claude", "scores": dimensions, "reasoning": "叙事与技术规范基本一致。", "latency_ms": 340},
        ],
        "aggregation_method": "drop_extremes_average",
        "issues": issues,
        "reviewed_at": _iso_now(),
    }
    payload = {
        "scores": [score],
        "issues": issues,
        "decision": decision,
    }
    return payload, round(weighted_average, 2), issues


def _quality_issue(
    *,
    shot_id: str | None,
    dimension: str,
    severity: str,
    description: str,
    suggestion: str,
) -> dict[str, Any]:
    return {
        "issue_id": f"issue-{dimension}-{abs(hash((shot_id, description))) % 100000}",
        "dimension": dimension,
        "severity": severity,
        "description": description,
        "suggestion": suggestion,
        "shot_id": shot_id,
        "target_node": "N02",
        "target_asset_type": "storyboard",
    }


def _fetch_episode_source_row(state: PipelineState) -> dict[str, Any]:
    episode_version_id = state.get("episode_version_id")
    if not episode_version_id or not _is_uuid_like(str(episode_version_id)):
        return {}

    try:
        row = fetch_one(
            """
            select
                ev.id::text as episode_version_id,
                ev.episode_id::text as episode_id,
                e.title as episode_title,
                e.project_name,
                e.shot_count,
                p.id::text as project_id,
                p.name as project_name_real,
                p.meta_json,
                p.description
            from public.episode_versions ev
            left join public.episodes e on e.id = ev.episode_id::text
            left join public.projects p on p.name = e.project_name
            where ev.id::text = %s
            limit 1
            """,
            (str(episode_version_id),),
        )
    except Exception:
        return {}

    if not row:
        return {}

    meta = row.get("meta_json") or {}
    if not isinstance(meta, dict):
        meta = {}
    return {
        "episode_version_id": row.get("episode_version_id"),
        "episode_id": row.get("episode_id"),
        "project_id": row.get("project_id"),
        "project_name": row.get("project_name_real") or row.get("project_name"),
        "title": row.get("episode_title"),
        "description": row.get("description"),
        "shot_count": row.get("shot_count"),
        **meta,
    }


def _default_output_ref(state: PipelineState, node_id: str) -> str:
    episode_version_id = state.get("episode_version_id") or "unknown"
    return f"tos://autoflow-media/{episode_version_id}/{node_id}/output.json"


def _is_uuid_like(value: str) -> bool:
    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError):
        return False


def source_safe_int(value: Any, fallback: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def _iso_now() -> str:
    return datetime.now(UTC).isoformat()
