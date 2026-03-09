"""ScriptAnalystAgent — 剧本分析 Agent

负责节点: N01 (剧本解析与结构化)
三层实现: plan_episode ONLY
职能: 将原始剧本文本解析为结构化数据 — 场景、角色、对白、情绪标记。
剧本解析是一次性集级分析，无逐镜头执行，无批后复盘。
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import AgentContext, BaseAgent

logger = logging.getLogger(__name__)


class ScriptAnalystAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "script_analyst"

    # ── Layer 1: plan_episode (N01) ────────────────────────────────────

    def plan_episode(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Parse script into structured data via LLM (1x call).

        Stub: return placeholder parsed structure.
        Real impl will call LLM to extract scenes, characters, dialogues.
        """
        logger.info("script_analyst.plan_episode: node=%s (stub)", context.node_id)

        memory_count = len(recalled.get("memories", []))
        rag_count = len(recalled.get("rag_cases", []))

        return {
            "parsed_script": {
                "scenes": [],
                "characters": [],
                "total_dialogues": 0,
                "estimated_duration_min": 1.0,
            },
            "mode": "stub",
            "context_used": {"memories": memory_count, "rag_cases": rag_count},
            "_reasoning_text": "Extracting scenes, characters, dialogues from script text.",
            "_cost_cny": 0.0,
        }

    # execute_shot / review_batch: NOT implemented (base raises NotImplementedError)
    # This Agent only runs in mode="plan" (N01)
