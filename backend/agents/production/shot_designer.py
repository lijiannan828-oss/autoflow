"""ShotDesignerAgent — 分镜设计 Agent

负责节点: N02(plan), N04/N05/N16b(shot), N16(review)
三层实现: plan_episode + execute_shot + review_batch (全三层)
职能: 全集分镜→逐镜填参→连续性复盘。最典型的三层 Agent。
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import AgentContext, BaseAgent

logger = logging.getLogger(__name__)


class ShotDesignerAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "shot_designer"

    # ── Layer 1: plan_episode (N02) ────────────────────────────────────

    def plan_episode(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Episode-level shot breakdown via LLM (1x call).

        Produces the "battle plan": shot sequence, camera params, durations.
        Stub: return empty shot list.
        """
        logger.info("shot_designer.plan_episode: node=%s (stub)", context.node_id)
        return {
            "shots": [],
            "total_shots": 0,
            "estimated_duration_sec": 60.0,
            "mode": "stub",
            "_reasoning_text": "Decomposing scenes into shot sequences with camera parameters.",
            "_cost_cny": 0.0,
        }

    # ── Layer 2: execute_shot (N04, N05, N16b) ─────────────────────────

    def execute_shot(self, context: AgentContext) -> dict[str, Any]:
        """Per-shot parameter fill. Zero LLM — rules + memory lookup.

        Reads the episode plan from context and fills shot-level params.
        Stub: return placeholder with high confidence.
        """
        logger.info("shot_designer.execute_shot: node=%s (stub)", context.node_id)
        shot_index = context.shot_index or 0
        return {
            "shot_id": f"shot_{shot_index}",
            "params_filled": True,
            "mode": "stub",
            "_confidence": 0.9,  # high → no LLM fallback
            "_cost_cny": 0.0,
        }

    # ── Layer 3: review_batch (N16) ────────────────────────────────────

    def review_batch(self, context: AgentContext) -> dict[str, Any]:
        """Batch continuity review via multimodal LLM (1x call).

        Checks pacing, shot transitions, and story continuity across episode.
        Stub: return passing review.
        """
        logger.info("shot_designer.review_batch: node=%s (stub)", context.node_id)
        batch_size = len(context.batch_results or [])
        return {
            "continuity_score": 8.5,
            "issues": [],
            "batch_size": batch_size,
            "mode": "stub",
            "_reasoning_text": "Reviewing episode pacing and shot transitions.",
            "_cost_cny": 0.0,
        }
