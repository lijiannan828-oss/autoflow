"""EvolutionEngineAgent — 4 模式自进化引擎

自进化模式：
  1. reflection    — 每日反思：汇总当天 traces，提取 lesson_learned，写入 agent_memory
  2. prompt_ab_test — Prompt A/B 测试：生成变体 prompt，对比 QC 分数，择优更新 master
  3. lora_train     — LoRA 微调触发：收集高分/低分 shot pair，提交训练任务（预留）
  4. rag_cleanup    — RAG 库清理：淘汰低检索、低分案例，合并重复案例

触发方式：
  - reflection: 每日 cron 或手动触发
  - prompt_ab_test: Supervisor 发现 QC 分数下降时触发
  - lora_train: 高分 shot 累积达阈值时触发
  - rag_cleanup: 周期性（每周）或 RAG 库超限时触发

依赖：M3(BaseAgent) + M5(agent_memory) + M6b(real Qdrant for rag_cleanup)
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import BaseAgent, AgentContext, AgentResult, MemoryItem, RAGCase

logger = logging.getLogger(__name__)

EVOLUTION_MODES = ("reflection", "prompt_ab_test", "lora_train", "rag_cleanup")


class EvolutionEngineAgent(BaseAgent):
    """Evolution Engine: 4-mode self-improvement system."""

    @property
    def agent_name(self) -> str:
        return "evolution_engine"

    def recall(
        self, context: AgentContext
    ) -> tuple[list[MemoryItem], list[RAGCase]]:
        """Load recent memories + evolution run history."""
        memories = self._fetch_memories(context, limit=20)
        return memories, []

    def reason(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Determine evolution actions based on mode.

        context.extra["evolution_mode"] selects the mode.
        """
        mode = context.extra.get("evolution_mode", "reflection")
        if mode not in EVOLUTION_MODES:
            return {"_cost_cny": 0.0, "error": f"Unknown mode: {mode}"}

        handler = {
            "reflection": self._reason_reflection,
            "prompt_ab_test": self._reason_ab_test,
            "lora_train": self._reason_lora_train,
            "rag_cleanup": self._reason_rag_cleanup,
        }[mode]

        return handler(context, recalled)

    def act(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        """Execute evolution actions."""
        mode = context.extra.get("evolution_mode", "reflection")
        if "error" in reasoning:
            return {"_cost_cny": 0.0, "error": reasoning["error"]}

        handler = {
            "reflection": self._act_reflection,
            "prompt_ab_test": self._act_ab_test,
            "lora_train": self._act_lora_train,
            "rag_cleanup": self._act_rag_cleanup,
        }.get(mode, self._act_noop)

        result = handler(context, reasoning)

        # Record evolution run
        self._record_evolution_run(context, mode, reasoning, result)

        return result

    def reflect(
        self, context: AgentContext, result: AgentResult
    ) -> list[dict[str, Any]] | None:
        """Record evolution results as memory."""
        if not result.success:
            return None

        mode = context.extra.get("evolution_mode", "reflection")
        return [{
            "content_key": f"evolution_{mode}_latest",
            "content_value": {
                "mode": mode,
                "summary": result.output.get("summary", ""),
                "improvements": result.output.get("improvements", 0),
            },
            "memory_type": "statistics",
        }]

    # ── Mode 1: Reflection (每日反思) ─────────────────────────────────

    def _reason_reflection(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Analyze today's traces to extract lessons."""
        from backend.common.db import fetch_all

        traces = fetch_all(
            """
            SELECT agent_name, trace_type, output_summary, cost_cny, duration_ms
            FROM core_pipeline.agent_traces
            WHERE created_at > now() - interval '1 day'
            ORDER BY created_at DESC
            LIMIT 100
            """,
        )

        # Aggregate by agent
        agent_stats: dict[str, dict] = {}
        for t in traces:
            name = t["agent_name"]
            if name not in agent_stats:
                agent_stats[name] = {"count": 0, "cost": 0.0, "errors": 0}
            agent_stats[name]["count"] += 1
            agent_stats[name]["cost"] += t.get("cost_cny") or 0.0
            if t.get("trace_type") == "error":
                agent_stats[name]["errors"] += 1

        # Use LLM to generate reflection summary
        try:
            from backend.common.llm_client import call_llm
            import json

            summary_prompt = (
                "分析以下 Agent 运行统计，提取关键发现和改进建议。\n\n"
                f"Agent 统计:\n{json.dumps(agent_stats, indent=2, ensure_ascii=False)}\n\n"
                f"已有记忆:\n{json.dumps(recalled.get('memories', [])[:5], indent=2, ensure_ascii=False)}\n\n"
                "输出 JSON: {\"lessons\": [{\"agent\": str, \"finding\": str, \"suggestion\": str}], "
                "\"overall_health\": str, \"top_priority\": str}"
            )

            resp = call_llm(
                "gemini-2.5-flash",
                "你是 AutoFlow 进化引擎，负责每日反思和持续改进。",
                summary_prompt,
                json_mode=True,
                max_tokens=2048,
            )

            return {
                "_cost_cny": resp.cost_cny,
                "_reasoning_text": resp.content[:200],
                "reflection": resp.parsed or {},
                "agent_stats": agent_stats,
                "trace_count": len(traces),
            }
        except Exception as exc:
            logger.warning("Reflection LLM call failed: %s", exc)
            return {
                "_cost_cny": 0.0,
                "agent_stats": agent_stats,
                "trace_count": len(traces),
                "reflection": {"lessons": [], "overall_health": "unknown"},
            }

    def _act_reflection(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        """Write reflection lessons to agent memory."""
        reflection = reasoning.get("reflection", {})
        lessons = reflection.get("lessons", [])
        written = 0

        for lesson in lessons:
            agent = lesson.get("agent", "unknown")
            self.write_memory(
                context,
                content_key=f"daily_reflection_{agent}",
                content_value=lesson,
                memory_type="lesson_learned",
                scope="global",
                confidence=0.6,
            )
            written += 1

        return {
            "_cost_cny": 0.0,
            "summary": f"Wrote {written} lessons from {reasoning.get('trace_count', 0)} traces",
            "improvements": written,
            "lessons": lessons,
        }

    # ── Mode 2: Prompt A/B Test ───────────────────────────────────────

    def _reason_ab_test(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Generate a prompt variant for A/B testing."""
        target_agent = context.extra.get("target_agent")
        target_stage = context.extra.get("target_stage")
        if not target_agent or not target_stage:
            return {"_cost_cny": 0.0, "error": "target_agent and target_stage required"}

        from backend.common.prompt_assets import get_active_prompt
        current = get_active_prompt(target_agent, target_stage)
        if not current:
            return {"_cost_cny": 0.0, "error": f"No active prompt for {target_agent}/{target_stage}"}

        if current.get("locked_by"):
            return {"_cost_cny": 0.0, "error": f"Prompt is locked by {current['locked_by']}"}

        # Use LLM to generate variant
        try:
            from backend.common.llm_client import call_llm

            resp = call_llm(
                "gemini-2.5-flash",
                "你是 Prompt 优化专家。基于当前 prompt 生成一个改进变体。保持核心意图不变，优化表达清晰度和输出质量。",
                f"当前 prompt:\n{current['master_system_prompt'][:2000]}\n\n"
                "输出 JSON: {\"variant_prompt\": str, \"changes\": [str], \"rationale\": str}",
                json_mode=True,
                max_tokens=4096,
            )

            return {
                "_cost_cny": resp.cost_cny,
                "current_prompt_id": str(current["id"]),
                "current_version": current["master_version"],
                "variant": resp.parsed or {},
            }
        except Exception as exc:
            return {"_cost_cny": 0.0, "error": str(exc)}

    def _act_ab_test(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        """Record A/B test variant (actual test execution is async)."""
        variant = reasoning.get("variant", {})
        if not variant.get("variant_prompt"):
            return {"_cost_cny": 0.0, "error": "No variant generated"}

        # Record in evolution_runs for tracking
        return {
            "_cost_cny": 0.0,
            "summary": f"Generated prompt variant with {len(variant.get('changes', []))} changes",
            "improvements": 1,
            "variant": variant,
            "prompt_id": reasoning.get("current_prompt_id"),
        }

    # ── Mode 3: LoRA Train (预留) ────────────────────────────────────

    def _reason_lora_train(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Evaluate if LoRA training should be triggered."""
        # TODO: Implement when GPU training pipeline is ready
        return {
            "_cost_cny": 0.0,
            "_reasoning_text": "LoRA training not yet implemented",
            "ready": False,
        }

    def _act_lora_train(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        """Submit LoRA training job."""
        return {
            "_cost_cny": 0.0,
            "summary": "LoRA training mode reserved for future implementation",
            "improvements": 0,
        }

    # ── Mode 4: RAG Cleanup ───────────────────────────────────────────

    def _reason_rag_cleanup(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Analyze RAG store for cleanup candidates."""
        from backend.common.db import fetch_all

        # Find low-retrieval, low-score cases
        stale_cases = fetch_all(
            """
            SELECT id, chain_id, quality_score, retrieval_count
            FROM core_pipeline.rag_chain_cases
            WHERE retrieval_count < 2 AND quality_score < 7.0
              AND created_at < now() - interval '7 days'
            ORDER BY quality_score ASC
            LIMIT 50
            """,
        )

        total_count = 0
        try:
            from backend.common.rag import get_rag_client
            total_count = get_rag_client().count()
        except Exception:
            pass

        return {
            "_cost_cny": 0.0,
            "stale_count": len(stale_cases),
            "stale_cases": stale_cases,
            "total_rag_count": total_count,
        }

    def _act_rag_cleanup(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        """Remove stale RAG cases."""
        stale = reasoning.get("stale_cases", [])
        removed = 0

        for case in stale:
            try:
                from backend.common.rag import get_rag_client
                get_rag_client().delete(case["chain_id"])

                from backend.common.db import execute
                execute(
                    "DELETE FROM core_pipeline.rag_chain_cases WHERE id = %s",
                    (case["id"],),
                )
                removed += 1
            except Exception as exc:
                logger.warning("Failed to remove RAG case %s: %s", case["chain_id"], exc)

        return {
            "_cost_cny": 0.0,
            "summary": f"Removed {removed}/{len(stale)} stale RAG cases",
            "improvements": removed,
        }

    # ── Helpers ───────────────────────────────────────────────────────

    def _act_noop(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        return {"_cost_cny": 0.0, "summary": "No action", "improvements": 0}

    def _record_evolution_run(
        self,
        context: AgentContext,
        mode: str,
        reasoning: dict[str, Any],
        result: dict[str, Any],
    ) -> None:
        """Record evolution run in evolution_runs table."""
        try:
            import json
            from backend.common.db import execute
            execute(
                """
                INSERT INTO core_pipeline.evolution_runs
                    (evolution_type, agent_name, status, input_params, output_summary, finished_at)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, now())
                """,
                (
                    mode,
                    self.agent_name,
                    "completed" if not result.get("error") else "failed",
                    json.dumps({"mode": mode, "extra": context.extra}),
                    json.dumps({
                        "summary": result.get("summary", ""),
                        "improvements": result.get("improvements", 0),
                    }),
                ),
            )
        except Exception as exc:
            logger.warning("Failed to record evolution run: %s", exc)
