"""SupervisorAgent — 成本 + 合规横切守卫

Supervisor 不参与内容生成，只做横切面检查：
  1. 成本守卫：每个节点执行后检查 run 累计成本是否超预算
  2. 合规检查：审核内容是否符合平台合规规则（project_groups.compliance_rules）
  3. 预警广播：超阈值时通过 MQ 广播预警
  4. 审计日志：所有检查结果写入 agent_traces

横切检查点（由 supervisor.py 路由层在以下节点后调用）：
  N02(拆集拆镜后)、N05(分级后)、N09(固化后)、
  N14(视频生成后)、N17(视频固化后)、N23(成片合成后)

调用方式：
  from backend.agents.registry import get_agent
  supervisor = get_agent("supervisor")
  result = supervisor.execute(AgentContext(run_id=..., node_id="N02"))
  if result.output.get("budget_status") == "critical":
      # 触发预算预警
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import BaseAgent, AgentContext, AgentResult, MemoryItem, RAGCase
from backend.common.cost_events import (
    COST_BUDGET_PER_MIN,
    check_budget,
    get_run_cost,
    record_cost_event,
)

logger = logging.getLogger(__name__)

# Nodes after which supervisor performs cross-cutting checks
CHECKPOINT_NODES = {"N02", "N05", "N09", "N14", "N17", "N23"}

# Budget utilization thresholds
WARN_THRESHOLD = 0.70   # 70% → warning
CRITICAL_THRESHOLD = 0.90  # 90% → critical, consider degrading quality


class SupervisorAgent(BaseAgent):
    """Supervisor Agent: cost + compliance cross-cutting guardian."""

    @property
    def agent_name(self) -> str:
        return "supervisor"

    def recall(
        self, context: AgentContext
    ) -> tuple[list[MemoryItem], list[RAGCase]]:
        """Supervisor doesn't need RAG. Only recall compliance rules from memory."""
        memories = self._fetch_memories(context, limit=5)
        return memories, []

    def reason(self, context: AgentContext, recalled: dict[str, Any]) -> dict[str, Any]:
        """Evaluate cost status and compliance for the current checkpoint.

        No LLM call needed — pure rule-based logic.
        """
        results: dict[str, Any] = {"_cost_cny": 0.0}

        # 1. Cost check
        if context.run_id:
            budget_info = check_budget(context.run_id)
            results["budget_status"] = budget_info["status"]
            results["budget_utilization_pct"] = budget_info["utilization_pct"]
            results["total_cost_cny"] = budget_info["total_cny"]
            results["remaining_cny"] = budget_info["remaining_cny"]
        else:
            results["budget_status"] = "unknown"

        # 2. Compliance check
        compliance = self._check_compliance(context)
        results["compliance_status"] = compliance["status"]
        results["compliance_violations"] = compliance.get("violations", [])

        # 3. Determine overall health
        if results["budget_status"] == "critical" or compliance["status"] == "fail":
            results["overall_health"] = "critical"
        elif results["budget_status"] == "warning" or compliance["status"] == "warning":
            results["overall_health"] = "warning"
        else:
            results["overall_health"] = "ok"

        results["_reasoning_text"] = (
            f"Node {context.node_id}: budget={results['budget_status']}, "
            f"compliance={compliance['status']}, health={results['overall_health']}"
        )

        return results

    def act(self, context: AgentContext, reasoning: dict[str, Any]) -> dict[str, Any]:
        """Execute actions based on health assessment.

        - ok: log and continue
        - warning: broadcast MQ alert
        - critical: broadcast + record cost event + flag for human review
        """
        health = reasoning.get("overall_health", "ok")
        output: dict[str, Any] = {
            "node_id": context.node_id,
            "health": health,
            "budget_status": reasoning.get("budget_status"),
            "compliance_status": reasoning.get("compliance_status"),
            "_cost_cny": 0.0,
        }

        if health in ("warning", "critical"):
            # Broadcast alert via MQ
            self._broadcast_alert(context, reasoning)
            output["alert_sent"] = True

        if health == "critical":
            # Record a warning cost event
            if context.run_id:
                record_cost_event(
                    "supervisor_alert",
                    amount_cny=0.0,
                    run_id=context.run_id,
                    node_id=context.node_id,
                    agent_name=self.agent_name,
                    details={
                        "alert_type": "budget_critical",
                        "utilization_pct": reasoning.get("budget_utilization_pct"),
                        "violations": reasoning.get("compliance_violations", []),
                    },
                )
            output["requires_human_review"] = True

        return output

    def reflect(
        self, context: AgentContext, result: AgentResult
    ) -> list[dict[str, Any]] | None:
        """Record checkpoint statistics in memory for trend analysis."""
        if not result.success:
            return None

        health = result.output.get("health", "ok")
        if health == "ok":
            return None

        # Write a lesson about budget trends
        return [{
            "content_key": f"supervisor_checkpoint_{context.node_id}",
            "content_value": {
                "node_id": context.node_id,
                "health": health,
                "budget_status": result.output.get("budget_status"),
                "compliance_status": result.output.get("compliance_status"),
            },
            "memory_type": "statistics",
        }]

    # ── Internal helpers ──────────────────────────────────────────────

    def _check_compliance(self, context: AgentContext) -> dict[str, Any]:
        """Check compliance rules from project_groups."""
        if not context.project_id:
            return {"status": "ok"}

        try:
            from backend.common.db import fetch_one
            row = fetch_one(
                """
                SELECT pg.compliance_rules
                FROM public.projects p
                JOIN public.project_groups pg ON p.group_id = pg.id
                WHERE p.id = %s
                """,
                (context.project_id,),
            )
            if not row or not row.get("compliance_rules"):
                return {"status": "ok"}

            rules = row["compliance_rules"]
            violations: list[str] = []

            # Check max_cost_per_episode if defined
            max_cost = rules.get("max_cost_per_episode")
            if max_cost and context.run_id:
                cost_data = get_run_cost(context.run_id)
                if cost_data["total_cny"] > max_cost:
                    violations.append(
                        f"Episode cost {cost_data['total_cny']:.2f} exceeds limit {max_cost}"
                    )

            if violations:
                return {"status": "fail", "violations": violations}
            return {"status": "ok"}

        except Exception as exc:
            logger.warning("Compliance check failed: %s", exc)
            return {"status": "ok"}

    def _broadcast_alert(self, context: AgentContext, reasoning: dict[str, Any]) -> None:
        """Broadcast alert via MQ."""
        try:
            from backend.common.mq import get_mq_client
            mq = get_mq_client()
            mq.publish(
                "autoflow.supervisor.alert",
                {
                    "run_id": context.run_id,
                    "node_id": context.node_id,
                    "health": reasoning.get("overall_health"),
                    "budget_status": reasoning.get("budget_status"),
                    "utilization_pct": reasoning.get("budget_utilization_pct"),
                    "compliance_violations": reasoning.get("compliance_violations", []),
                },
                tags="budget_alert",
            )
        except Exception as exc:
            logger.warning("Failed to broadcast alert: %s", exc)
