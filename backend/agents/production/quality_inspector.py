"""QualityInspectorAgent — 质检 Agent

负责节点: N03/N11/N12/N15(review)
三层实现: review_batch ONLY
职能: 所有 QC 节点本质都是"批后复盘" — 检查前序产物质量。
QC 分数 < 7.0 触发自动打回。
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import AgentContext, BaseAgent

logger = logging.getLogger(__name__)


class QualityInspectorAgent(BaseAgent):

    @property
    def agent_name(self) -> str:
        return "quality_inspector"

    # ── Layer 3: review_batch (N03, N11, N12, N15) ─────────────────────

    def review_batch(self, context: AgentContext) -> dict[str, Any]:
        """Batch quality review via multimodal LLM (1x call).

        Analyzes upstream artifacts for quality, consistency, blocking issues.
        Stub: return passing score.
        """
        logger.info("quality_inspector.review_batch: node=%s (stub)", context.node_id)
        batch_size = len(context.batch_results or [])
        return {
            "quality_score": 8.5,
            "issues": [],
            "blocking_issues": [],
            "batch_size": batch_size,
            "mode": "stub",
            "_reasoning_text": "Running quality checks on upstream artifacts.",
            "_cost_cny": 0.0,
        }

    # plan_episode / execute_shot: NOT implemented
    # QualityInspector only runs in mode="review" (N03/N11/N12/N15)
