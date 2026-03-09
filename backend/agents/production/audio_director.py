"""AudioDirectorAgent — 音频导演 Agent

负责节点: N07b(plan), N20/N22(shot)
三层实现: plan_episode + execute_shot
职能: 音色方案(plan) + BGM/SFX/配音/混音(shot)。音频质检由 QI 负责。
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import AgentContext, BaseAgent

logger = logging.getLogger(__name__)


class AudioDirectorAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "audio_director"

    # ── Layer 1: plan_episode (N07b) ───────────────────────────────────

    def plan_episode(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Episode-level voice scheme via LLM (1x call).

        Selects voice models per character, BGM style, SFX palette.
        Stub: return placeholder audio plan.
        """
        logger.info("audio_director.plan_episode: node=%s (stub)", context.node_id)
        return {
            "audio_plan": {
                "voice_model": "cosyvoice3",
                "character_voices": [],
                "bgm_style": "cinematic",
                "sfx_palette": [],
            },
            "mode": "stub",
            "_reasoning_text": "Planning episode-level audio: voice models, BGM style, SFX.",
            "_cost_cny": 0.0,
        }

    # ── Layer 2: execute_shot (N20, N22) ───────────────────────────────

    def execute_shot(self, context: AgentContext) -> dict[str, Any]:
        """Per-shot audio generation. Zero LLM — CosyVoice/FFmpeg dispatch.

        Reads episode audio plan + shot dialogue, generates TTS/SFX/mix.
        Stub: return placeholder (GPU not deployed).
        """
        logger.info("audio_director.execute_shot: node=%s (stub, GPU not deployed)", context.node_id)
        return {
            "audio_samples": [],
            "voice_model": "cosyvoice3",
            "mode": "stub",
            "_confidence": 0.8,
            "_cost_cny": 0.0,
        }

    # review_batch: NOT implemented (audio QC is QualityInspector's job)
