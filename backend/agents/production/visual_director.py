"""VisualDirectorAgent — 视觉导演 Agent

负责节点: N06(plan), N07/N09/N10/N13/N14/N17/N19(shot)
三层实现: plan_episode + execute_shot
职能: 集级视觉策略 + 逐镜头生成。视觉连续性由 QualityInspector 负责。
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import AgentContext, BaseAgent

logger = logging.getLogger(__name__)


class VisualDirectorAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "visual_director"

    # ── Layer 1: plan_episode (N06) ────────────────────────────────────

    def plan_episode(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Episode-level visual strategy via LLM (1x call).

        Defines character designs, color palette, lighting scheme, style anchors.
        Stub: return placeholder visual plan.
        """
        logger.info("visual_director.plan_episode: node=%s (stub)", context.node_id)
        return {
            "visual_plan": {
                "style": "cinematic",
                "color_palette": [],
                "character_designs": [],
                "lighting_scheme": "natural",
            },
            "mode": "stub",
            "_reasoning_text": "Planning episode-level visual strategy and style anchors.",
            "_cost_cny": 0.0,
        }

    # ── Layer 2: execute_shot (N07/N09/N10/N13/N14/N17/N19) ──────────

    def execute_shot(self, context: AgentContext) -> dict[str, Any]:
        """Per-shot visual generation. Zero LLM — ComfyUI workflow dispatch.

        Reads episode visual plan + shot params, constructs ComfyUI workflow.
        Stub: return placeholder (GPU not deployed).
        """
        logger.info("visual_director.execute_shot: node=%s (stub, GPU not deployed)", context.node_id)
        return {
            "visuals": [],
            "workflow_id": None,
            "gpu_status": "not_deployed",
            "mode": "stub",
            "_confidence": 0.85,
            "_cost_cny": 0.0,
        }

    # review_batch: NOT implemented (visual continuity is QualityInspector's job)
