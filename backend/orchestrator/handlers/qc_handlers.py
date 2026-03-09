"""Real LLM handlers for the QC voting chain (N03/N11/N15).

N03 — Storyboard QC: 3-model voting on episode-level scripts (6 dimensions)
N11 — Keyframe QC:   qc_tier-based voting on per-shot keyframe candidates (8 dimensions)
N15 — Video QC:      qc_tier-based voting on per-shot video candidates (8 dimensions)

All handlers call call_llm_multi_vote() for parallel multi-model evaluation,
then aggregate scores with drop-extremes or average strategy, and auto-reject
when below threshold.

Model selection follows PLAN.md §2.5:
  QC_VOTE_MODELS = ["gemini-3.1-pro-preview", "claude-opus-4-6", "gpt-5.4"]
  N03: always 3 models (pre-grading, no qc_tier yet)
  N11/N15: 1-3 models based on qc_tier from N05
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
    QC_VOTE_MODELS,
    aggregate_llm_costs,
    call_llm_multi_vote,
)
from backend.common.tos_client import upload_json

from backend.orchestrator.graph.context import (
    build_node_output_envelope,
    load_node_output_payload,
)
from backend.orchestrator.graph.state import NodeResult, PipelineState
from backend.orchestrator.graph.workers import register_handler

logger = logging.getLogger(__name__)

_REGISTERED = False


# ── Dimension definitions ─────────────────────────────────────────────────

N03_DIMENSIONS: dict[str, float] = {
    "narrative_coherence": 0.20,
    "visual_feasibility": 0.20,
    "pacing": 0.15,
    "character_consistency": 0.15,
    "technical_compliance": 0.15,
    "emotional_impact": 0.15,
}

N11_DIMENSIONS: dict[str, float] = {
    "character_consistency": 0.20,
    "body_integrity": 0.15,
    "tone_consistency": 0.15,
    "script_fidelity": 0.15,
    "action_accuracy": 0.10,
    "expression_match": 0.10,
    "composition": 0.10,
    "lighting_consistency": 0.05,
}

N15_DIMENSIONS: dict[str, float] = {
    "character_consistency": 0.20,
    "motion_fluidity": 0.15,
    "physics_plausibility": 0.15,
    "action_accuracy": 0.10,
    "expression_match": 0.10,
    "composition": 0.10,
    "lighting_consistency": 0.10,
    "continuity_score": 0.10,
}


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


def _build_qc_result(
    node_id: str,
    state: PipelineState,
    *,
    status: str = "succeeded",
    output_ref: str,
    payload: Any,
    cost_cny: float = 0.0,
    token_in: int = 0,
    token_out: int = 0,
    duration_s: float = 0.0,
    quality_score: float | None = None,
    model_endpoint: str | None = None,
    error: str | None = None,
    error_code: str | None = None,
) -> NodeResult:
    """Build a NodeResult for QC handlers (multi-model, aggregated costs)."""
    envelope = build_node_output_envelope(
        node_id,
        state,
        status=status,
        payload=payload,
        duration_s=duration_s,
        cost_cny=cost_cny,
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
        cost_cny=cost_cny,
        gpu_seconds=0.0,
        duration_s=duration_s,
        model_provider="llm",
        model_endpoint=model_endpoint or "multi-vote",
        output_payload=payload,
        output_envelope=envelope,
        quality_score=quality_score,
        error=error,
        error_code=error_code,
    )


def _select_models_by_tier(qc_tier: str) -> list[str]:
    """Select voting models based on qc_tier from N05.

    tier_1_full → 3 models (all QC_VOTE_MODELS)
    tier_2_dual → 2 models (first two)
    tier_3_single → 1 model (first only)
    """
    if qc_tier == "tier_1_full":
        return QC_VOTE_MODELS[:3]
    elif qc_tier == "tier_2_dual":
        return QC_VOTE_MODELS[:2]
    else:  # tier_3_single or unknown
        return QC_VOTE_MODELS[:1]


def _parse_model_scores(
    responses: list[LLMResponse],
    dimension_keys: list[str],
) -> list[dict[str, float]]:
    """Extract per-dimension scores from each model's LLM response.

    Each response.parsed should contain a 'dimensions' dict with
    dimension_key → score mappings. Handles missing/malformed gracefully.
    """
    all_scores: list[dict[str, float]] = []
    for resp in responses:
        parsed = resp.parsed or {}
        dims = parsed.get("dimensions", {})
        if not isinstance(dims, dict):
            logger.warning("Model %s returned non-dict dimensions, skipping", resp.model)
            continue
        scores: dict[str, float] = {}
        for key in dimension_keys:
            val = dims.get(key)
            if isinstance(val, (int, float)) and 1.0 <= val <= 10.0:
                scores[key] = float(val)
            else:
                # Default to 5.0 for missing/invalid dimensions
                scores[key] = 5.0
                logger.warning(
                    "Model %s: dimension %s has invalid value %r, defaulting to 5.0",
                    resp.model, key, val,
                )
        all_scores.append(scores)
    return all_scores


def _aggregate_scores_drop_extremes(
    all_scores: list[dict[str, float]],
    weights: dict[str, float],
) -> tuple[dict[str, float], float]:
    """Aggregate multi-model scores: drop extremes + take middle (3 models),
    or average (2 models), or use single value (1 model).

    Returns (aggregated_dimensions, weighted_average).
    """
    if not all_scores:
        # No valid scores — return zeros
        return {k: 0.0 for k in weights}, 0.0

    n = len(all_scores)
    aggregated: dict[str, float] = {}

    for key, weight in weights.items():
        values = [s.get(key, 5.0) for s in all_scores]
        if n >= 3:
            # Drop highest and lowest, take middle value(s)
            values.sort()
            values = values[1:-1]  # drop extremes
        # Average remaining
        aggregated[key] = sum(values) / len(values) if values else 5.0

    # Compute weighted average
    weighted_avg = sum(aggregated[k] * w for k, w in weights.items())
    # Round to 2 decimal places
    weighted_avg = round(weighted_avg, 2)
    aggregated = {k: round(v, 2) for k, v in aggregated.items()}

    return aggregated, weighted_avg


def _extract_issues(responses: list[LLMResponse]) -> list[dict]:
    """Collect issues from all model responses, deduplicating by shot_id + description."""
    seen: set[str] = set()
    merged: list[dict] = []
    for resp in responses:
        parsed = resp.parsed or {}
        issues = parsed.get("issues", [])
        if not isinstance(issues, list):
            continue
        for issue in issues:
            if not isinstance(issue, dict):
                continue
            key = f"{issue.get('shot_id', '')}-{issue.get('description', '')[:50]}"
            if key not in seen:
                seen.add(key)
                issue.setdefault("source_model", resp.model)
                merged.append(issue)
    return merged


# ── Prompts ───────────────────────────────────────────────────────────────

_N03_SYSTEM_PROMPT = """\
你是一个专业的短剧分镜质检专家。你的任务是评审 AI 导演生成的镜头级分镜规格，从以下维度打分（1-10 分）：

评分维度：
1. 叙事连贯性（narrative_coherence）— 镜头之间的故事逻辑是否顺畅，是否有跳跃或断裂
2. 视觉可行性（visual_feasibility）— visual_prompt 是否能被 AIGC 生图/生视频模型有效执行
3. 节奏感（pacing）— 镜头时长分配是否符合短剧快节奏（1-3s/镜头），整体是否有张弛
4. 角色一致性（character_consistency）— 角色出场、对白、表情是否与人设和剧情匹配
5. 技术规范性（technical_compliance）— camera_movement 是否可实现、时长是否合理、编号是否连续
6. 情感表达力（emotional_impact）— 关键场景的戏剧张力是否足够，开头钩子和结尾悬念是否到位

对每个发现的问题，标注：
- severity: "critical"（必须修改，打回）/ "major"（强烈建议修改）/ "minor"（可选优化）
- 关联的 shot_id
- 具体描述和修改建议

输出 JSON:
{
  "dimensions": { "narrative_coherence": n, "visual_feasibility": n, "pacing": n, "character_consistency": n, "technical_compliance": n, "emotional_impact": n },
  "weighted_average": number,
  "issues": [{ "dimension": "...", "severity": "critical|major|minor", "shot_id": "...", "description": "...", "suggestion": "..." }],
  "overall_comment": "..."
}"""


_N11_SYSTEM_PROMPT = """\
你是一个专业的 AIGC 关键帧质检专家。你的任务是评审 AI 生成的关键帧图像候选，从以下 8 个维度打分（1-10 分）：

评分维度：
1. 角色一致性（character_consistency, 权重 0.20）— 角色外貌与基线美术资产的匹配度
2. 人体完整性（body_integrity, 权重 0.15）— 无肢体残缺、多余手指、断肢、面部扭曲等 AI 生图缺陷
3. 影调一致性（tone_consistency, 权重 0.15）— 色调/影调与冻结的美术资产基调一致
4. 脚本忠实度（script_fidelity, 权重 0.15）— 画面是否忠实表达了 visual_prompt 的意图
5. 动作准确性（action_accuracy, 权重 0.10）— 角色动作是否匹配描述
6. 表情匹配（expression_match, 权重 0.10）— 表情是否匹配角色情绪要求
7. 构图（composition, 权重 0.10）— 人物位置、前后景关系是否合理
8. 光照一致性（lighting_consistency, 权重 0.05）— 光照是否匹配场景设定

如果有多个候选，为每个候选独立评分，然后选出最佳候选。

对每个发现的问题，标注 severity (critical/major/minor)、关联的 shot_id 和具体描述。

输出 JSON:
{
  "dimensions": { "character_consistency": n, "body_integrity": n, "tone_consistency": n, "script_fidelity": n, "action_accuracy": n, "expression_match": n, "composition": n, "lighting_consistency": n },
  "weighted_average": number,
  "candidate_scores": [{ "candidate_id": "...", "dimensions": {...}, "weighted_average": number }],
  "selected_candidate_id": "...",
  "issues": [{ "dimension": "...", "severity": "critical|major|minor", "shot_id": "...", "description": "...", "suggestion": "..." }],
  "overall_comment": "..."
}"""


_N15_SYSTEM_PROMPT = """\
你是一个专业的 AIGC 视频素材质检专家。你的任务是评审 AI 生成的视频片段候选，从以下 8 个维度打分（1-10 分）：

评分维度：
1. 角色一致性（character_consistency, 权重 0.20）— 视频中角色外貌是否保持一致
2. 运动流畅度（motion_fluidity, 权重 0.15）— 无抖动/卡帧/变形/不自然的帧间跳变
3. 物理合理性（physics_plausibility, 权重 0.15）— 重力、碰撞、物体穿模是否合理
4. 动作准确性（action_accuracy, 权重 0.10）— 人物动作是否匹配描述
5. 表情匹配（expression_match, 权重 0.10）— 面部表情是否自然且符合剧情
6. 构图稳定性（composition, 权重 0.10）— 运镜过程中构图保持合理
7. 光照一致性（lighting_consistency, 权重 0.10）— 视频内光照无突变
8. 关键帧连贯度（continuity_score, 权重 0.10）— 视频与起始关键帧的视觉连贯性

重要阈值规则（打分时请特别注意这些硬性条件）：
- 任何单维度 < 5.0 → critical → 必须打回
- character_consistency < 7.0 → 必须打回
- physics_plausibility < 6.0 → 必须打回
- weighted_average < 7.5 → 打回

如果有多个候选，为每个候选独立评分，然后选出最佳候选。

输出 JSON:
{
  "dimensions": { "character_consistency": n, "motion_fluidity": n, "physics_plausibility": n, "action_accuracy": n, "expression_match": n, "composition": n, "lighting_consistency": n, "continuity_score": n },
  "weighted_average": number,
  "candidate_scores": [{ "candidate_id": "...", "dimensions": {...}, "weighted_average": number }],
  "selected_candidate_id": "...",
  "issues": [{ "dimension": "...", "severity": "critical|major|minor", "shot_id": "...", "description": "...", "suggestion": "..." }],
  "overall_comment": "...",
  "critical_flags": []
}"""


# ── N03: Storyboard QC (3-model voting, episode level) ───────────────────

def handle_n03(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N03 — Storyboard QC: 3-model parallel voting on EpisodeScript.

    Always uses all 3 QC_VOTE_MODELS (N03 is before qc_tier grading).
    Threshold: weighted_average < 8.0 → auto_rejected.
    """
    t0 = time.monotonic()

    # Load N02 output (EpisodeScript)
    episode_script = load_node_output_payload("N02", state)
    if not episode_script:
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error="N02 output (EpisodeScript) not found",
            error_code="MISSING_UPSTREAM_OUTPUT",
        )

    # Build user prompt with the full episode script
    user_prompt = (
        "## 待质检的分镜规格（EpisodeScript）\n\n"
        + json.dumps(episode_script, ensure_ascii=False, indent=2)
        + "\n\n请从 6 个维度评分（1-10）并列出所有质量问题，输出 JSON。"
    )

    # 3-model parallel voting
    try:
        responses = call_llm_multi_vote(
            QC_VOTE_MODELS,
            _N03_SYSTEM_PROMPT,
            user_prompt,
            json_mode=True,
            temperature=0.3,
            max_tokens=8192,
            timeout=180.0,
        )
    except LLMError as exc:
        duration = time.monotonic() - t0
        logger.error("N03 multi-vote call failed: %s", exc)
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_MULTI_VOTE_FAILED",
        )

    # Parse scores from each model
    dimension_keys = list(N03_DIMENSIONS.keys())
    all_scores = _parse_model_scores(responses, dimension_keys)

    if not all_scores:
        duration = time.monotonic() - t0
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error="All models returned unparseable scores",
            error_code="SCORE_PARSE_FAILED",
        )

    # Aggregate: drop extremes + take middle
    aggregated_dims, weighted_avg = _aggregate_scores_drop_extremes(all_scores, N03_DIMENSIONS)

    # Collect issues from all models
    issues = _extract_issues(responses)

    # Decision
    threshold = 8.0
    decision = "pass" if weighted_avg >= threshold else "reject"
    qc_status = "succeeded" if decision == "pass" else "auto_rejected"

    # Aggregate costs
    costs = aggregate_llm_costs(responses)

    # Build model reviews for audit trail
    model_reviews = []
    for resp, scores in zip(responses, all_scores):
        parsed = resp.parsed or {}
        model_reviews.append({
            "model_name": resp.model,
            "scores": scores,
            "reasoning": parsed.get("overall_comment", ""),
            "latency_ms": int(resp.duration_s * 1000),
        })

    # Compose QC output payload
    payload = {
        "node_id": node_id,
        "check_type": "auto",
        "qc_tier": "tier_1_full",  # N03 always uses full 3-model vote
        "scale": "1_10",
        "dimensions": aggregated_dims,
        "dimension_weights": N03_DIMENSIONS,
        "weighted_average": weighted_avg,
        "pass_threshold": threshold,
        "is_passed": decision == "pass",
        "decision": decision,
        "aggregation_method": "drop_extremes_average" if len(all_scores) >= 3 else "average",
        "model_reviews": model_reviews,
        "issues": issues,
        "models_used": [r.model for r in responses],
        "models_requested": len(QC_VOTE_MODELS),
        "models_succeeded": len(responses),
        "evaluated_at": _iso_now(),
    }

    output_ref = _safe_upload(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info(
        "N03 completed: decision=%s weighted_avg=%.2f threshold=%.1f "
        "models=%d/%d issues=%d cost=%.4f duration=%.1fs",
        decision, weighted_avg, threshold,
        len(responses), len(QC_VOTE_MODELS),
        len(issues), costs["cost_cny"], duration,
    )

    return _build_qc_result(
        node_id, state,
        status=qc_status,
        output_ref=output_ref,
        payload=payload,
        cost_cny=costs["cost_cny"],
        token_in=costs["token_in"],
        token_out=costs["token_out"],
        duration_s=duration,
        quality_score=weighted_avg,
        model_endpoint=",".join(r.model for r in responses),
    )


# ── N11: Keyframe QC (qc_tier-based voting, per-shot) ────────────────────

def _get_qc_tier_from_shot(shot_spec: dict) -> str:
    """Extract qc_tier from a shot spec, defaulting to tier_2_dual."""
    tier = shot_spec.get("qc_tier", "tier_2_dual")
    if tier not in ("tier_1_full", "tier_2_dual", "tier_3_single"):
        return "tier_2_dual"
    return tier


def handle_n11(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N11 — Keyframe QC: evaluate candidate keyframes per shot.

    Uses qc_tier from N05 to select 1-3 voting models.
    Auto-selects best candidate. Threshold: weighted_average < 7.5 → auto_rejected.
    """
    t0 = time.monotonic()

    # Load N10 output (keyframe candidates)
    n10_output = load_node_output_payload("N10", state)
    if not n10_output:
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error="N10 output (keyframe candidates) not found",
            error_code="MISSING_UPSTREAM_OUTPUT",
        )

    # Extract shot_spec and candidates from N10 output
    shot_spec = n10_output.get("shot_spec", {})
    candidates = n10_output.get("candidates", [])
    frozen_assets = n10_output.get("frozen_assets", [])
    shot_id = shot_spec.get("shot_id", state.get("episode_id", "unknown"))

    # Select models based on qc_tier
    qc_tier = _get_qc_tier_from_shot(shot_spec)
    models = _select_models_by_tier(qc_tier)

    # Build user prompt
    user_prompt_parts = [
        "## 镜头规格（ShotSpec）",
        json.dumps(shot_spec, ensure_ascii=False, indent=2),
        f"\n## 候选关键帧 ({len(candidates)} 个)",
    ]
    for i, cand in enumerate(candidates):
        cand_id = cand.get("candidate_id", f"candidate_{i}")
        user_prompt_parts.append(f"\n### 候选 {cand_id}")
        # Include candidate metadata (prompt, seed, etc.)
        cand_info = {k: v for k, v in cand.items() if k != "image_data"}
        user_prompt_parts.append(json.dumps(cand_info, ensure_ascii=False, indent=2))

    if frozen_assets:
        user_prompt_parts.append("\n## 基线美术资产参考（FrozenArtAsset）")
        user_prompt_parts.append(json.dumps(frozen_assets, ensure_ascii=False, indent=2))

    user_prompt_parts.append(
        "\n请从 8 个维度为每个候选评分（1-10），选出最佳候选，并列出质量问题，输出 JSON。"
    )
    user_prompt = "\n".join(user_prompt_parts)

    # Collect image URLs for multimodal evaluation (if available)
    image_urls: list[str] = []
    for cand in candidates:
        url = cand.get("image_url") or cand.get("presigned_url")
        if url and isinstance(url, str):
            image_urls.append(url)
    # Include frozen asset baselines for comparison
    for asset in frozen_assets:
        url = asset.get("image_url") or asset.get("presigned_url")
        if url and isinstance(url, str):
            image_urls.append(url)

    # Multi-model voting
    try:
        responses = call_llm_multi_vote(
            models,
            _N11_SYSTEM_PROMPT,
            user_prompt,
            json_mode=True,
            temperature=0.3,
            max_tokens=8192,
            timeout=180.0,
            images=image_urls if image_urls else None,
        )
    except LLMError as exc:
        duration = time.monotonic() - t0
        logger.error("N11 multi-vote call failed for shot %s: %s", shot_id, exc)
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_MULTI_VOTE_FAILED",
        )

    # Parse and aggregate scores
    dimension_keys = list(N11_DIMENSIONS.keys())
    all_scores = _parse_model_scores(responses, dimension_keys)

    if not all_scores:
        duration = time.monotonic() - t0
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error="All models returned unparseable scores",
            error_code="SCORE_PARSE_FAILED",
        )

    aggregated_dims, weighted_avg = _aggregate_scores_drop_extremes(all_scores, N11_DIMENSIONS)
    issues = _extract_issues(responses)

    # Auto-select best candidate from model responses
    selected_candidate_id = None
    candidate_scores: list[dict] = []
    for resp in responses:
        parsed = resp.parsed or {}
        cs = parsed.get("candidate_scores", [])
        if isinstance(cs, list):
            candidate_scores = cs  # use last valid model's candidate breakdown
        sel = parsed.get("selected_candidate_id")
        if sel and isinstance(sel, str):
            selected_candidate_id = sel

    # Fallback: if no model selected a candidate, pick first candidate
    if not selected_candidate_id and candidates:
        selected_candidate_id = candidates[0].get("candidate_id", "candidate_0")

    # Decision
    threshold = 7.5
    decision = "pass" if weighted_avg >= threshold else "reject"
    qc_status = "succeeded" if decision == "pass" else "auto_rejected"

    costs = aggregate_llm_costs(responses)

    model_reviews = []
    for resp, scores in zip(responses, all_scores):
        parsed = resp.parsed or {}
        model_reviews.append({
            "model_name": resp.model,
            "scores": scores,
            "reasoning": parsed.get("overall_comment", ""),
            "latency_ms": int(resp.duration_s * 1000),
        })

    payload = {
        "node_id": node_id,
        "shot_id": shot_id,
        "check_type": "auto",
        "qc_tier": qc_tier,
        "scale": "1_10",
        "dimensions": aggregated_dims,
        "dimension_weights": N11_DIMENSIONS,
        "weighted_average": weighted_avg,
        "pass_threshold": threshold,
        "is_passed": decision == "pass",
        "decision": decision,
        "selected_candidate_id": selected_candidate_id,
        "candidate_scores": candidate_scores,
        "aggregation_method": "drop_extremes_average" if len(all_scores) >= 3 else "average",
        "model_reviews": model_reviews,
        "issues": issues,
        "models_used": [r.model for r in responses],
        "models_requested": len(models),
        "models_succeeded": len(responses),
        "evaluated_at": _iso_now(),
    }

    output_ref = _safe_upload(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info(
        "N11 completed: shot=%s decision=%s weighted_avg=%.2f qc_tier=%s "
        "models=%d/%d selected=%s cost=%.4f duration=%.1fs",
        shot_id, decision, weighted_avg, qc_tier,
        len(responses), len(models),
        selected_candidate_id, costs["cost_cny"], duration,
    )

    return _build_qc_result(
        node_id, state,
        status=qc_status,
        output_ref=output_ref,
        payload=payload,
        cost_cny=costs["cost_cny"],
        token_in=costs["token_in"],
        token_out=costs["token_out"],
        duration_s=duration,
        quality_score=weighted_avg,
        model_endpoint=",".join(r.model for r in responses),
    )


# ── N15: Video QC (qc_tier-based voting, per-shot, multi-threshold) ──────

def _check_n15_critical_thresholds(
    aggregated_dims: dict[str, float],
) -> tuple[bool, str | None]:
    """Apply N15's multi-level rejection thresholds.

    Returns (should_reject, reason).
    Priority order (short-circuit):
    1. Any dimension < 5.0 → critical floor
    2. character_consistency < 7.0 → unacceptable
    3. physics_plausibility < 6.0 → unacceptable
    """
    # Priority 1: hard floor on any dimension
    for dim_key, score in aggregated_dims.items():
        if score < 5.0:
            return True, f"{dim_key} = {score} < 5.0 (floor)"

    # Priority 2: character consistency critical threshold
    cc = aggregated_dims.get("character_consistency", 5.0)
    if cc < 7.0:
        return True, f"character_consistency = {cc} < 7.0"

    # Priority 3: physics plausibility critical threshold
    pp = aggregated_dims.get("physics_plausibility", 5.0)
    if pp < 6.0:
        return True, f"physics_plausibility = {pp} < 6.0"

    return False, None


def handle_n15(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """N15 — Video QC: evaluate candidate videos per shot.

    Uses qc_tier from N05 to select 1-3 voting models.
    Multi-level rejection:
      1. Any dimension < 5.0 → critical reject
      2. character_consistency < 7.0 → reject
      3. physics_plausibility < 6.0 → reject
      4. weighted_average < 7.5 → reject
    Auto-selects best candidate.
    """
    t0 = time.monotonic()

    # Load N14 output (video candidates)
    n14_output = load_node_output_payload("N14", state)
    if not n14_output:
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=time.monotonic() - t0,
            error="N14 output (video candidates) not found",
            error_code="MISSING_UPSTREAM_OUTPUT",
        )

    shot_spec = n14_output.get("shot_spec", {})
    candidates = n14_output.get("candidates", [])
    frozen_assets = n14_output.get("frozen_assets", [])
    frozen_keyframe = n14_output.get("frozen_keyframe", {})
    shot_id = shot_spec.get("shot_id", state.get("episode_id", "unknown"))

    # Select models based on qc_tier
    qc_tier = _get_qc_tier_from_shot(shot_spec)
    models = _select_models_by_tier(qc_tier)

    # Build user prompt
    user_prompt_parts = [
        "## 镜头规格（ShotSpec）",
        json.dumps(shot_spec, ensure_ascii=False, indent=2),
        f"\n## 候选视频 ({len(candidates)} 个)",
    ]
    for i, cand in enumerate(candidates):
        cand_id = cand.get("candidate_id", f"candidate_{i}")
        user_prompt_parts.append(f"\n### 候选 {cand_id}")
        cand_info = {k: v for k, v in cand.items() if k != "video_data"}
        user_prompt_parts.append(json.dumps(cand_info, ensure_ascii=False, indent=2))

    if frozen_keyframe:
        user_prompt_parts.append("\n## 起始关键帧参考（FrozenKeyframe）")
        user_prompt_parts.append(json.dumps(frozen_keyframe, ensure_ascii=False, indent=2))

    if frozen_assets:
        user_prompt_parts.append("\n## 基线美术资产参考（FrozenArtAsset）")
        user_prompt_parts.append(json.dumps(frozen_assets, ensure_ascii=False, indent=2))

    user_prompt_parts.append(
        "\n请从 8 个维度为每个候选评分（1-10），特别注意物理合理性和角色一致性的硬性阈值。"
        "\n选出最佳候选，并列出质量问题，输出 JSON。"
    )
    user_prompt = "\n".join(user_prompt_parts)

    # Collect video frame URLs for multimodal evaluation
    image_urls: list[str] = []
    for cand in candidates:
        # Video candidates may provide thumbnail/frame URLs
        frames = cand.get("frame_urls", [])
        if isinstance(frames, list):
            image_urls.extend(f for f in frames if isinstance(f, str))
        thumb = cand.get("thumbnail_url") or cand.get("presigned_url")
        if thumb and isinstance(thumb, str) and thumb not in image_urls:
            image_urls.append(thumb)
    # Include frozen keyframe for continuity comparison
    kf_url = frozen_keyframe.get("image_url") or frozen_keyframe.get("presigned_url")
    if kf_url and isinstance(kf_url, str):
        image_urls.append(kf_url)

    # Multi-model voting
    try:
        responses = call_llm_multi_vote(
            models,
            _N15_SYSTEM_PROMPT,
            user_prompt,
            json_mode=True,
            temperature=0.3,
            max_tokens=8192,
            timeout=240.0,  # video analysis is slower
            images=image_urls if image_urls else None,
        )
    except LLMError as exc:
        duration = time.monotonic() - t0
        logger.error("N15 multi-vote call failed for shot %s: %s", shot_id, exc)
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error=str(exc),
            error_code="LLM_MULTI_VOTE_FAILED",
        )

    # Parse and aggregate scores
    dimension_keys = list(N15_DIMENSIONS.keys())
    all_scores = _parse_model_scores(responses, dimension_keys)

    if not all_scores:
        duration = time.monotonic() - t0
        return _build_qc_result(
            node_id, state,
            status="failed",
            output_ref=_output_ref(state, node_id),
            payload=None,
            duration_s=duration,
            error="All models returned unparseable scores",
            error_code="SCORE_PARSE_FAILED",
        )

    aggregated_dims, weighted_avg = _aggregate_scores_drop_extremes(all_scores, N15_DIMENSIONS)
    issues = _extract_issues(responses)

    # Auto-select best candidate
    selected_candidate_id = None
    candidate_scores: list[dict] = []
    for resp in responses:
        parsed = resp.parsed or {}
        cs = parsed.get("candidate_scores", [])
        if isinstance(cs, list):
            candidate_scores = cs
        sel = parsed.get("selected_candidate_id")
        if sel and isinstance(sel, str):
            selected_candidate_id = sel

    if not selected_candidate_id and candidates:
        selected_candidate_id = candidates[0].get("candidate_id", "candidate_0")

    # Multi-level rejection (short-circuit evaluation per quality-standards.md)
    critical_reject, critical_reason = _check_n15_critical_thresholds(aggregated_dims)
    critical_flags: list[str] = []

    threshold = 7.5
    if critical_reject:
        decision = "reject"
        critical_flags.append(critical_reason or "critical threshold breach")
        # Add as critical issue
        issues.insert(0, {
            "dimension": "critical_threshold",
            "severity": "critical",
            "shot_id": shot_id,
            "description": critical_reason or "Critical threshold breach",
            "suggestion": "Regenerate video with focus on flagged dimension",
        })
    elif weighted_avg < threshold:
        decision = "reject"
    else:
        decision = "pass"

    qc_status = "succeeded" if decision == "pass" else "auto_rejected"
    costs = aggregate_llm_costs(responses)

    model_reviews = []
    for resp, scores in zip(responses, all_scores):
        parsed = resp.parsed or {}
        model_reviews.append({
            "model_name": resp.model,
            "scores": scores,
            "reasoning": parsed.get("overall_comment", ""),
            "latency_ms": int(resp.duration_s * 1000),
        })

    payload = {
        "node_id": node_id,
        "shot_id": shot_id,
        "check_type": "auto",
        "qc_tier": qc_tier,
        "scale": "1_10",
        "dimensions": aggregated_dims,
        "dimension_weights": N15_DIMENSIONS,
        "weighted_average": weighted_avg,
        "pass_threshold": threshold,
        "is_passed": decision == "pass",
        "decision": decision,
        "selected_candidate_id": selected_candidate_id,
        "candidate_scores": candidate_scores,
        "aggregation_method": "drop_extremes_average" if len(all_scores) >= 3 else "average",
        "model_reviews": model_reviews,
        "issues": issues,
        "critical_flags": critical_flags,
        "models_used": [r.model for r in responses],
        "models_requested": len(models),
        "models_succeeded": len(responses),
        "evaluated_at": _iso_now(),
    }

    output_ref = _safe_upload(state, node_id, payload)
    duration = time.monotonic() - t0

    logger.info(
        "N15 completed: shot=%s decision=%s weighted_avg=%.2f qc_tier=%s "
        "critical_flags=%s models=%d/%d selected=%s cost=%.4f duration=%.1fs",
        shot_id, decision, weighted_avg, qc_tier,
        critical_flags or "none",
        len(responses), len(models),
        selected_candidate_id, costs["cost_cny"], duration,
    )

    return _build_qc_result(
        node_id, state,
        status=qc_status,
        output_ref=output_ref,
        payload=payload,
        cost_cny=costs["cost_cny"],
        token_in=costs["token_in"],
        token_out=costs["token_out"],
        duration_s=duration,
        quality_score=weighted_avg,
        model_endpoint=",".join(r.model for r in responses),
    )


# ── Registration ──────────────────────────────────────────────────────────

def register() -> None:
    """Register all QC handlers. Called by handlers/__init__.py."""
    global _REGISTERED
    if _REGISTERED:
        return

    register_handler("N03", handle_n03)
    register_handler("N11", handle_n11)
    register_handler("N15", handle_n15)
    _REGISTERED = True
    logger.info("QC handlers registered: N03, N11, N15")
