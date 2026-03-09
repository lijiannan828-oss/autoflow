"""BaseAgent — v2.2 Agent 基类（三层决策模型）

所有 10 个 Agent（7 生产 + Supervisor + EvolutionEngine + Orchestrator）
继承此基类，获得统一的决策入口、记忆读写、RAG 检索、trace 记录能力。

三层记忆架构：
  - Working Memory: PipelineState（LangGraph state dict，节点间传递）
  - Project Memory: core_pipeline.agent_memory（PG，跨 run 持久化）
  - Long-term Memory: Qdrant RAG 案例库（跨项目检索）

三层决策模型（§2.4）：
  第一层 — 集级策划：plan_episode()  → N02/N06，1 次 LLM 覆盖全集
  第二层 — 镜头级执行：execute_shot() → N10/N14，零 LLM（规则+记忆快查）
  第三层 — 批后复盘：review_batch()  → N12/N16，1 次多模态 LLM

兼容旧接口（Supervisor/EvolutionEngine 等非生产 Agent）：
  recall() → reason() → act() → reflect()

每步自动记录 agent_trace，供 Supervisor 审计和前端展示。
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal

from backend.common.db import execute_returning_one, fetch_all

logger = logging.getLogger(__name__)


# ── Agent Names (mirrors agent_name_enum) ─────────────────────────────

AGENT_NAMES = (
    "script_analyst",
    "shot_designer",
    "visual_director",
    "audio_director",
    "compositor",
    "quality_inspector",
    "review_dispatcher",
    "supervisor",
    "evolution_engine",
    "orchestrator",
)

# Decision mode type
DecisionMode = Literal["plan", "shot", "review", "legacy"]

# Confidence threshold — below this, execute_shot falls back to LLM
SHOT_CONFIDENCE_THRESHOLD = 0.6


# ── Data classes ──────────────────────────────────────────────────────

@dataclass
class AgentContext:
    """Runtime context passed into every agent execute() call."""
    run_id: str | None = None
    episode_version_id: str | None = None
    node_id: str | None = None
    project_id: str | None = None
    genre: str | None = None
    # Three-layer decision mode (set by workers.py based on node_id)
    mode: DecisionMode = "legacy"
    # Cost budget remaining (CNY). None = no limit.
    cost_budget_remaining: float | None = None
    # Episode plan (populated by _run_plan, consumed by _run_shot)
    episode_plan: dict[str, Any] | None = None
    # Shot index within episode (for _run_shot mode)
    shot_index: int | None = None
    # Batch results (populated by upstream, consumed by _run_review)
    batch_results: list[dict[str, Any]] | None = None
    # Extra kwargs from the pipeline state
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """Standardized output from every agent execute() call."""
    success: bool
    output: dict[str, Any] = field(default_factory=dict)
    cost_cny: float = 0.0
    duration_ms: int = 0
    traces: list[dict[str, Any]] = field(default_factory=list)
    memory_writes: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


@dataclass
class MemoryItem:
    """A single memory record from agent_memory."""
    id: str
    content_key: str
    content_value: dict[str, Any]
    memory_type: str
    confidence: float
    access_count: int


@dataclass
class RAGCase:
    """A retrieved RAG case for few-shot injection."""
    chain_id: str
    quality_score: float
    case_type: str
    genre: str | None
    scene_type: str | None
    payload: dict[str, Any] = field(default_factory=dict)


# ── BaseAgent ─────────────────────────────────────────────────────────

class BaseAgent(ABC):
    """Abstract base class for all v2.2 Agents.

    Three-layer decision model (production Agents):
      - mode="plan":   recall → plan_episode (1x LLM) → reflect
      - mode="shot":   execute_shot (0x LLM, rule-based); fallback to LLM if confidence < threshold
      - mode="review": review_batch (1x multimodal LLM) → reflect

    Legacy decision loop (Supervisor, EvolutionEngine, etc.):
      - mode="legacy":  recall → reason → act → reflect

    Subclasses MUST implement:
      - agent_name (property): one of AGENT_NAMES

    Production Agent subclasses SHOULD implement:
      - plan_episode(context, recalled) -> dict: episode-level planning (1x LLM)
      - execute_shot(context) -> dict: shot-level execution (0x LLM)
      - review_batch(context) -> dict: batch review (1x LLM)

    Legacy subclasses MUST implement:
      - reason(context, recalled) -> dict: core LLM reasoning
      - act(context, reasoning) -> dict: execute actions

    All subclasses MAY override:
      - recall(context) -> tuple[memories, rag_cases]: custom retrieval
      - reflect(context, result) -> list | None: post-action self-check
    """

    # ── Lifecycle ─────────────────────────────────────────────────────

    @property
    @abstractmethod
    def agent_name(self) -> str:
        """Must return one of AGENT_NAMES."""
        ...

    def execute(self, context: AgentContext) -> AgentResult:
        """Unified entry point. Routes to the appropriate decision path based on context.mode.

        Do not override — override the individual layer methods instead.
        """
        t0 = time.monotonic()
        traces: list[dict[str, Any]] = []
        total_cost = 0.0

        try:
            if context.mode == "plan":
                result = self._run_plan(context, t0, traces)
            elif context.mode == "shot":
                result = self._run_shot(context, t0, traces)
            elif context.mode == "review":
                result = self._run_review(context, t0, traces)
            else:
                result = self._run_legacy(context, t0, traces)

            self._persist_traces(result.traces)
            return result

        except Exception as exc:
            duration_ms = int((time.monotonic() - t0) * 1000)
            logger.exception("Agent %s failed in mode=%s: %s", self.agent_name, context.mode, exc)
            error_trace = self._make_trace(
                context, "error",
                output_summary={"error": str(exc), "mode": context.mode},
                duration_ms=duration_ms,
            )
            traces.append(error_trace)
            self._persist_traces(traces)
            return AgentResult(
                success=False,
                cost_cny=total_cost,
                duration_ms=duration_ms,
                traces=traces,
                error=str(exc),
            )

    # ── Layer 1: Episode-level Planning ────────────────────────────────

    def _run_plan(
        self, context: AgentContext, t0: float, traces: list[dict]
    ) -> AgentResult:
        """Layer 1: recall → plan_episode (1x LLM) → reflect."""
        total_cost = 0.0
        memory_writes: list[dict] = []

        # 1. Recall
        recall_t0 = time.monotonic()
        memories, rag_cases = self.recall(context)
        recall_ms = int((time.monotonic() - recall_t0) * 1000)
        traces.append(self._make_trace(
            context, "recall",
            input_summary={"project_id": context.project_id, "genre": context.genre},
            output_summary={"memory_count": len(memories), "rag_count": len(rag_cases)},
            duration_ms=recall_ms,
        ))

        # 2. Plan episode (1x LLM)
        plan_t0 = time.monotonic()
        recalled = self._format_recalled(memories, rag_cases)
        plan_output = self.plan_episode(context, recalled)
        plan_ms = int((time.monotonic() - plan_t0) * 1000)
        plan_cost = plan_output.pop("_cost_cny", 0.0)
        total_cost += plan_cost
        traces.append(self._make_trace(
            context, "plan",
            input_summary={"recalled_keys": [m.content_key for m in memories[:5]]},
            reasoning=plan_output.get("_reasoning_text"),
            output_summary={k: v for k, v in plan_output.items() if not k.startswith("_")},
            duration_ms=plan_ms,
            cost_cny=plan_cost,
        ))

        # 3. Reflect
        result = AgentResult(
            success=True,
            output=plan_output,
            cost_cny=total_cost,
            duration_ms=int((time.monotonic() - t0) * 1000),
            traces=traces,
        )
        reflect_writes = self._do_reflect(context, result, traces)
        if reflect_writes:
            memory_writes.extend(reflect_writes)

        result.duration_ms = int((time.monotonic() - t0) * 1000)
        result.traces = traces
        result.memory_writes = memory_writes
        return result

    # ── Layer 2: Shot-level Execution ──────────────────────────────────

    def _run_shot(
        self, context: AgentContext, t0: float, traces: list[dict]
    ) -> AgentResult:
        """Layer 2: execute_shot (0x LLM); fallback to LLM if confidence < threshold."""
        total_cost = 0.0

        exec_t0 = time.monotonic()
        shot_output = self.execute_shot(context)
        exec_ms = int((time.monotonic() - exec_t0) * 1000)

        confidence = shot_output.get("_confidence", 1.0)
        trace_type = "execute"

        # Confidence escape hatch
        if confidence < SHOT_CONFIDENCE_THRESHOLD:
            logger.info(
                "Agent %s shot confidence %.2f < %.2f, falling back to LLM",
                self.agent_name, confidence, SHOT_CONFIDENCE_THRESHOLD,
            )
            traces.append(self._make_trace(
                context, "execute",
                input_summary={"shot_index": context.shot_index, "confidence": confidence},
                output_summary={"fallback_triggered": True},
                duration_ms=exec_ms,
            ))

            # Fallback: single LLM call
            fallback_t0 = time.monotonic()
            shot_output = self.execute_shot_fallback(context, shot_output)
            fallback_ms = int((time.monotonic() - fallback_t0) * 1000)
            fallback_cost = shot_output.pop("_cost_cny", 0.0)
            total_cost += fallback_cost
            trace_type = "execute_fallback"
            exec_ms = fallback_ms

        exec_cost = shot_output.pop("_cost_cny", 0.0)
        total_cost += exec_cost

        traces.append(self._make_trace(
            context, trace_type,
            input_summary={"shot_index": context.shot_index, "confidence": confidence},
            output_summary={k: v for k, v in shot_output.items() if not k.startswith("_")},
            duration_ms=exec_ms,
            cost_cny=total_cost,
        ))

        return AgentResult(
            success=True,
            output=shot_output,
            cost_cny=total_cost,
            duration_ms=int((time.monotonic() - t0) * 1000),
            traces=traces,
        )

    # ── Layer 3: Batch Review ──────────────────────────────────────────

    def _run_review(
        self, context: AgentContext, t0: float, traces: list[dict]
    ) -> AgentResult:
        """Layer 3: review_batch (1x multimodal LLM) → reflect."""
        total_cost = 0.0
        memory_writes: list[dict] = []

        review_t0 = time.monotonic()
        review_output = self.review_batch(context)
        review_ms = int((time.monotonic() - review_t0) * 1000)
        review_cost = review_output.pop("_cost_cny", 0.0)
        total_cost += review_cost
        traces.append(self._make_trace(
            context, "review",
            input_summary={"batch_size": len(context.batch_results or [])},
            reasoning=review_output.get("_reasoning_text"),
            output_summary={k: v for k, v in review_output.items() if not k.startswith("_")},
            duration_ms=review_ms,
            cost_cny=review_cost,
        ))

        # Reflect — sedimentation of lessons learned
        result = AgentResult(
            success=True,
            output=review_output,
            cost_cny=total_cost,
            duration_ms=int((time.monotonic() - t0) * 1000),
            traces=traces,
        )
        reflect_writes = self._do_reflect(context, result, traces)
        if reflect_writes:
            memory_writes.extend(reflect_writes)

        result.duration_ms = int((time.monotonic() - t0) * 1000)
        result.traces = traces
        result.memory_writes = memory_writes
        return result

    # ── Legacy: recall → reason → act → reflect ───────────────────────

    def _run_legacy(
        self, context: AgentContext, t0: float, traces: list[dict]
    ) -> AgentResult:
        """Legacy 4-step decision loop for Supervisor, EvolutionEngine, etc."""
        total_cost = 0.0
        memory_writes: list[dict] = []

        # 1. Recall
        recall_t0 = time.monotonic()
        memories, rag_cases = self.recall(context)
        recall_ms = int((time.monotonic() - recall_t0) * 1000)
        traces.append(self._make_trace(
            context, "recall",
            input_summary={"project_id": context.project_id, "genre": context.genre},
            output_summary={"memory_count": len(memories), "rag_count": len(rag_cases)},
            duration_ms=recall_ms,
        ))

        # 2. Reason
        reason_t0 = time.monotonic()
        recalled = self._format_recalled(memories, rag_cases)
        reasoning = self.reason(context, recalled)
        reason_ms = int((time.monotonic() - reason_t0) * 1000)
        reason_cost = reasoning.pop("_cost_cny", 0.0)
        total_cost += reason_cost
        traces.append(self._make_trace(
            context, "reason",
            input_summary={"recalled_keys": [m.content_key for m in memories[:5]]},
            reasoning=reasoning.get("_reasoning_text"),
            output_summary={k: v for k, v in reasoning.items() if not k.startswith("_")},
            duration_ms=reason_ms,
            cost_cny=reason_cost,
        ))

        # 3. Act
        act_t0 = time.monotonic()
        action_output = self.act(context, reasoning)
        act_ms = int((time.monotonic() - act_t0) * 1000)
        act_cost = action_output.pop("_cost_cny", 0.0)
        total_cost += act_cost
        traces.append(self._make_trace(
            context, "act",
            input_summary={"reasoning_keys": list(reasoning.keys())[:5]},
            output_summary={k: v for k, v in action_output.items() if not k.startswith("_")},
            duration_ms=act_ms,
            cost_cny=act_cost,
        ))

        # 4. Reflect
        result = AgentResult(
            success=True,
            output=action_output,
            cost_cny=total_cost,
            duration_ms=int((time.monotonic() - t0) * 1000),
            traces=traces,
        )
        reflect_writes = self._do_reflect(context, result, traces)
        if reflect_writes:
            memory_writes.extend(reflect_writes)

        result.duration_ms = int((time.monotonic() - t0) * 1000)
        result.traces = traces
        result.memory_writes = memory_writes
        return result

    # ── Three-layer abstract methods (production Agents) ───────────────

    def plan_episode(
        self, context: AgentContext, recalled: dict[str, Any]
    ) -> dict[str, Any]:
        """Layer 1: Episode-level planning. 1x LLM call covering all shots.

        Override in production Agents that handle planning nodes (N02/N06).
        Convention: include "_cost_cny" and optionally "_reasoning_text".
        Default: raises NotImplementedError.
        """
        raise NotImplementedError(
            f"{self.agent_name} does not implement plan_episode(). "
            "Set context.mode='legacy' or implement this method."
        )

    def execute_shot(self, context: AgentContext) -> dict[str, Any]:
        """Layer 2: Shot-level execution. Zero LLM — pure rules + memory lookup.

        Override in production Agents that handle execution nodes (N10/N14/N20/N23).
        Convention: include "_confidence" (0.0-1.0) for escape hatch evaluation.
        If _confidence < SHOT_CONFIDENCE_THRESHOLD, execute_shot_fallback() is called.
        Default: raises NotImplementedError.
        """
        raise NotImplementedError(
            f"{self.agent_name} does not implement execute_shot(). "
            "Set context.mode='legacy' or implement this method."
        )

    def execute_shot_fallback(
        self, context: AgentContext, partial_output: dict[str, Any]
    ) -> dict[str, Any]:
        """Layer 2 escape hatch: single LLM call when confidence is too low.

        Called automatically when execute_shot returns _confidence < threshold.
        Default: calls reason() + act() as fallback (legacy path).
        Override for custom fallback logic.
        """
        memories, rag_cases = self.recall(context)
        recalled = self._format_recalled(memories, rag_cases)
        recalled["partial_output"] = partial_output
        reasoning = self.reason(context, recalled)
        return self.act(context, reasoning)

    def review_batch(self, context: AgentContext) -> dict[str, Any]:
        """Layer 3: Batch review. 1x multimodal LLM analyzing episode continuity.

        Override in production Agents that handle review nodes (N12/N16).
        Convention: include "_cost_cny" and optionally "_reasoning_text".
        Default: raises NotImplementedError.
        """
        raise NotImplementedError(
            f"{self.agent_name} does not implement review_batch(). "
            "Set context.mode='legacy' or implement this method."
        )

    # ── Legacy abstract methods (Supervisor, EvolutionEngine, etc.) ────

    def reason(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Legacy: Core LLM reasoning step.

        Convention: include "_cost_cny" key for LLM cost tracking.
        Optional: include "_reasoning_text" for trace logging.
        Default: raises NotImplementedError.
        """
        raise NotImplementedError(
            f"{self.agent_name} does not implement reason(). "
            "Set context.mode to plan/shot/review or implement this method."
        )

    def act(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        """Legacy: Execute actions based on reasoning output.

        Convention: include "_cost_cny" key if additional LLM/API calls are made.
        Default: raises NotImplementedError.
        """
        raise NotImplementedError(
            f"{self.agent_name} does not implement act(). "
            "Set context.mode to plan/shot/review or implement this method."
        )

    # ── Shared optional methods ────────────────────────────────────────

    def recall(
        self, context: AgentContext
    ) -> tuple[list[MemoryItem], list[RAGCase]]:
        """Load relevant memories from PG and RAG cases from Qdrant.

        Default: fetch top-10 project-scoped memories by access_count.
        RAG retrieval requires rag.py client (returns empty if unavailable).
        """
        memories = self._fetch_memories(context)
        rag_cases = self._fetch_rag_cases(context)
        return memories, rag_cases

    def reflect(
        self, context: AgentContext, result: AgentResult
    ) -> list[dict[str, Any]] | None:
        """Post-action self-check and memory write-back.

        Default: no-op. Override to write lessons learned, update statistics, etc.
        Return a list of memory write dicts: [{"content_key": ..., "content_value": ..., "memory_type": ...}]
        """
        return None

    # ── Internal helpers ───────────────────────────────────────────────

    def _format_recalled(
        self, memories: list[MemoryItem], rag_cases: list[RAGCase]
    ) -> dict[str, Any]:
        """Format recalled memories and RAG cases into a dict for plan/reason methods."""
        return {
            "memories": [
                {"key": m.content_key, "value": m.content_value, "type": m.memory_type}
                for m in memories
            ],
            "rag_cases": [
                {"chain_id": r.chain_id, "score": r.quality_score, "payload": r.payload}
                for r in rag_cases
            ],
        }

    def _do_reflect(
        self, context: AgentContext, result: AgentResult, traces: list[dict]
    ) -> list[dict[str, Any]] | None:
        """Run reflect() and append trace."""
        reflect_t0 = time.monotonic()
        writes = self.reflect(context, result)
        reflect_ms = int((time.monotonic() - reflect_t0) * 1000)
        traces.append(self._make_trace(
            context, "reflect",
            output_summary={"memory_writes": len(writes) if writes else 0},
            duration_ms=reflect_ms,
        ))
        return writes

    # ── Memory helpers ────────────────────────────────────────────────

    def _fetch_memories(self, context: AgentContext, limit: int = 10) -> list[MemoryItem]:
        """Fetch project-scoped memories from agent_memory table."""
        try:
            scope_id = context.project_id or context.episode_version_id
            rows = fetch_all(
                """
                SELECT id, content_key, content_value, memory_type, confidence, access_count
                FROM core_pipeline.agent_memory
                WHERE agent_name = %s
                  AND (scope = 'global' OR (scope = 'project' AND scope_id = %s))
                ORDER BY access_count DESC, confidence DESC
                LIMIT %s
                """,
                (self.agent_name, scope_id, limit),
            )
            # Update access counts
            if rows:
                ids = [r["id"] for r in rows]
                from backend.common.db import execute
                execute(
                    """
                    UPDATE core_pipeline.agent_memory
                    SET access_count = access_count + 1, last_accessed_at = now()
                    WHERE id = ANY(%s::uuid[])
                    """,
                    (ids,),
                )
            return [
                MemoryItem(
                    id=str(r["id"]),
                    content_key=r["content_key"],
                    content_value=r["content_value"],
                    memory_type=r["memory_type"],
                    confidence=r["confidence"],
                    access_count=r["access_count"],
                )
                for r in rows
            ]
        except Exception as exc:
            logger.warning("Memory fetch failed for %s: %s", self.agent_name, exc)
            return []

    def _fetch_rag_cases(self, context: AgentContext, limit: int = 3) -> list[RAGCase]:
        """Fetch relevant RAG cases. Uses rag.py client if available."""
        try:
            from backend.common.rag import get_rag_client
            client = get_rag_client()
            return client.search(
                agent_name=self.agent_name,
                genre=context.genre,
                limit=limit,
            )
        except ImportError:
            logger.debug("rag.py not available, skipping RAG retrieval")
            return []
        except Exception as exc:
            logger.warning("RAG fetch failed for %s: %s", self.agent_name, exc)
            return []

    def write_memory(
        self,
        context: AgentContext,
        content_key: str,
        content_value: dict[str, Any],
        memory_type: str = "lesson_learned",
        scope: str = "project",
        confidence: float = 0.5,
    ) -> str | None:
        """Write or upsert a memory record. Returns the memory ID."""
        try:
            scope_id = context.project_id or context.episode_version_id
            row = execute_returning_one(
                """
                INSERT INTO core_pipeline.agent_memory
                    (agent_name, memory_type, scope, scope_id, content_key, content_value, confidence)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                RETURNING id
                """,
                (self.agent_name, memory_type, scope, scope_id, content_key,
                 json.dumps(content_value), confidence),
            )
            return str(row["id"]) if row else None
        except Exception as exc:
            logger.warning("Memory write failed for %s: %s", self.agent_name, exc)
            return None

    # ── Trace helpers ─────────────────────────────────────────────────

    def _make_trace(
        self,
        context: AgentContext,
        trace_type: str,
        *,
        input_summary: dict | None = None,
        reasoning: str | None = None,
        output_summary: dict | None = None,
        duration_ms: int = 0,
        cost_cny: float = 0.0,
    ) -> dict[str, Any]:
        """Build a trace dict for agent_traces table."""
        return {
            "id": str(uuid.uuid4()),
            "agent_name": self.agent_name,
            "node_id": context.node_id,
            "run_id": context.run_id,
            "episode_version_id": context.episode_version_id,
            "trace_type": trace_type,
            "input_summary": input_summary,
            "reasoning": reasoning,
            "output_summary": output_summary,
            "duration_ms": duration_ms,
            "cost_cny": cost_cny,
        }

    def _persist_traces(self, traces: list[dict[str, Any]]) -> None:
        """Batch insert traces into agent_traces table."""
        if not traces:
            return
        try:
            from backend.common.db import get_connection
            with get_connection() as conn, conn.cursor() as cur:
                for t in traces:
                    cur.execute(
                        """
                        INSERT INTO core_pipeline.agent_traces
                            (id, agent_name, node_id, run_id, episode_version_id,
                             trace_type, input_summary, reasoning, output_summary,
                             duration_ms, cost_cny)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            t["id"], t["agent_name"], t["node_id"],
                            t["run_id"], t["episode_version_id"],
                            t["trace_type"],
                            json.dumps(t["input_summary"]) if t["input_summary"] else None,
                            t["reasoning"],
                            json.dumps(t["output_summary"]) if t["output_summary"] else None,
                            t["duration_ms"], t["cost_cny"],
                        ),
                    )
                conn.commit()
        except Exception as exc:
            logger.warning("Trace persist failed: %s", exc)

    # ── Prompt helpers ────────────────────────────────────────────────

    def get_prompt_asset(self, prompt_stage: str) -> str | None:
        """Load the active master prompt for this agent + stage from prompt_assets."""
        try:
            from backend.common.db import fetch_one
            row = fetch_one(
                """
                SELECT master_system_prompt
                FROM core_pipeline.prompt_assets
                WHERE agent_name = %s AND prompt_stage = %s AND is_active = true
                LIMIT 1
                """,
                (self.agent_name, prompt_stage),
            )
            return row["master_system_prompt"] if row else None
        except Exception as exc:
            logger.warning("Prompt asset load failed: %s", exc)
            return None

    def get_genre_adapter(self, prompt_asset_id: str, genre_tag: str) -> str | None:
        """Load genre-specific adapter prompt overlay."""
        try:
            from backend.common.db import fetch_one
            row = fetch_one(
                """
                SELECT adapter_prompt
                FROM core_pipeline.genre_adapters
                WHERE prompt_asset_id = %s AND genre_tag = %s AND is_active = true
                LIMIT 1
                """,
                (prompt_asset_id, genre_tag),
            )
            return row["adapter_prompt"] if row else None
        except Exception as exc:
            logger.warning("Genre adapter load failed: %s", exc)
            return None

    # ── Cost guard ────────────────────────────────────────────────────

    def check_cost_budget(self, context: AgentContext, estimated_cost: float) -> bool:
        """Check if estimated cost fits within remaining budget.

        Returns True if OK to proceed, False if would exceed budget.
        """
        if context.cost_budget_remaining is None:
            return True
        return estimated_cost <= context.cost_budget_remaining

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} agent_name={self.agent_name}>"
