"""CompositorAgent — 合成 Agent

负责节点: N23/N25/N26(shot)
三层实现: execute_shot ONLY
职能: 纯执行 — 按前序节点产物合成视频，不需要集级策划或批后复盘。
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import AgentContext, BaseAgent

logger = logging.getLogger(__name__)


class CompositorAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "compositor"

    # ── Layer 2: execute_shot (N23, N25, N26) ──────────────────────────

    def execute_shot(self, context: AgentContext) -> dict[str, Any]:
        """Per-shot AV compositing. Zero LLM — FFmpeg + cloud render.

        Combines video, audio, subtitles, effects into final output.
        Stub: return placeholder.
        """
        logger.info("compositor.execute_shot: node=%s (stub)", context.node_id)
        return {
            "output_video_url": None,
            "duration_sec": 0.0,
            "mode": "stub",
            "_confidence": 0.95,
            "_cost_cny": 0.0,
        }

    # plan_episode / review_batch: NOT implemented
    # Compositor only runs in mode="shot" (N23/N25/N26)
