"""cost_events.py — 成本事件记录 + 汇总

对 core_pipeline.cost_events 表的操作封装。
Supervisor 通过此模块实现实时成本追踪和预算守卫。

成本类型：
  - llm_call:    LLM API 调用费用
  - gpu_render:  ComfyUI GPU 渲染费用
  - audio_gen:   TTS/BGM/SFX 生成费用
  - storage:     TOS 存储费用
  - embedding:   向量嵌入费用

预算硬约束：≤ 30 CNY/分钟成片
"""

from __future__ import annotations

import json
import logging
from typing import Any

from backend.common.db import (
    execute,
    execute_returning_one,
    fetch_all,
    fetch_one,
    fetch_value,
)

logger = logging.getLogger(__name__)

# Cost budget per minute of final video (CNY)
COST_BUDGET_PER_MIN = 30.0

# Cost type constants
COST_LLM = "llm_call"
COST_GPU = "gpu_render"
COST_AUDIO = "audio_gen"
COST_STORAGE = "storage"
COST_EMBEDDING = "embedding"


# ── Record ────────────────────────────────────────────────────────────

def record_cost_event(
    cost_type: str,
    amount_cny: float,
    *,
    run_id: str | None = None,
    episode_version_id: str | None = None,
    node_id: str | None = None,
    agent_name: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Record a single cost event."""
    row = execute_returning_one(
        """
        INSERT INTO core_pipeline.cost_events
            (run_id, episode_version_id, node_id, agent_name, cost_type, amount_cny, details)
        VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
        RETURNING *
        """,
        (run_id, episode_version_id, node_id, agent_name, cost_type, amount_cny,
         json.dumps(details) if details else None),
    )
    logger.debug(
        "Cost event: type=%s amount=%.4f node=%s agent=%s",
        cost_type, amount_cny, node_id, agent_name,
    )
    return row or {}


# ── Query ─────────────────────────────────────────────────────────────

def get_run_cost(run_id: str) -> dict[str, Any]:
    """Get total cost breakdown for a pipeline run."""
    rows = fetch_all(
        """
        SELECT cost_type, sum(amount_cny) as total, count(*) as event_count
        FROM core_pipeline.cost_events
        WHERE run_id = %s
        GROUP BY cost_type
        ORDER BY total DESC
        """,
        (run_id,),
    )
    total = sum(r["total"] for r in rows)
    return {
        "run_id": run_id,
        "total_cny": total,
        "breakdown": rows,
    }


def get_episode_cost(episode_version_id: str) -> dict[str, Any]:
    """Get total cost for an episode version."""
    rows = fetch_all(
        """
        SELECT cost_type, sum(amount_cny) as total, count(*) as event_count
        FROM core_pipeline.cost_events
        WHERE episode_version_id = %s
        GROUP BY cost_type
        ORDER BY total DESC
        """,
        (episode_version_id,),
    )
    total = sum(r["total"] for r in rows)
    return {
        "episode_version_id": episode_version_id,
        "total_cny": total,
        "breakdown": rows,
    }


def get_node_cost(run_id: str, node_id: str) -> float:
    """Get cost for a specific node in a run."""
    return fetch_value(
        """
        SELECT COALESCE(sum(amount_cny), 0)
        FROM core_pipeline.cost_events
        WHERE run_id = %s AND node_id = %s
        """,
        (run_id, node_id),
    ) or 0.0


def get_agent_cost_summary(
    agent_name: str,
    days: int = 7,
) -> dict[str, Any]:
    """Get cost summary for an agent over recent days."""
    rows = fetch_all(
        """
        SELECT date_trunc('day', created_at) as day,
               sum(amount_cny) as daily_total,
               count(*) as event_count
        FROM core_pipeline.cost_events
        WHERE agent_name = %s AND created_at > now() - interval '%s days'
        GROUP BY day
        ORDER BY day DESC
        """,
        (agent_name, days),
    )
    total = sum(r["daily_total"] for r in rows)
    return {
        "agent_name": agent_name,
        "period_days": days,
        "total_cny": total,
        "daily": rows,
    }


def list_cost_events(
    *,
    run_id: str | None = None,
    episode_version_id: str | None = None,
    agent_name: str | None = None,
    cost_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """List cost events with filters."""
    conditions: list[str] = []
    params: list[Any] = []

    if run_id:
        conditions.append("run_id = %s")
        params.append(run_id)
    if episode_version_id:
        conditions.append("episode_version_id = %s")
        params.append(episode_version_id)
    if agent_name:
        conditions.append("agent_name = %s")
        params.append(agent_name)
    if cost_type:
        conditions.append("cost_type = %s")
        params.append(cost_type)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.extend([limit, offset])

    return fetch_all(
        f"""
        SELECT * FROM core_pipeline.cost_events
        {where}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """,
        params,
    )


# ── Budget Check ──────────────────────────────────────────────────────

def check_budget(
    run_id: str,
    estimated_duration_min: float = 1.0,
) -> dict[str, Any]:
    """Check if a run is within budget.

    Returns budget status and remaining allowance.
    """
    cost_data = get_run_cost(run_id)
    total = cost_data["total_cny"]
    budget = COST_BUDGET_PER_MIN * estimated_duration_min
    remaining = budget - total
    utilization = (total / budget * 100) if budget > 0 else 0

    status = "ok"
    if utilization > 90:
        status = "critical"
    elif utilization > 70:
        status = "warning"

    return {
        "run_id": run_id,
        "total_cny": total,
        "budget_cny": budget,
        "remaining_cny": remaining,
        "utilization_pct": round(utilization, 1),
        "status": status,
        "estimated_duration_min": estimated_duration_min,
    }


# ── Aggregation ───────────────────────────────────────────────────────

def get_cost_dashboard(days: int = 7) -> dict[str, Any]:
    """Get cost dashboard data for the admin panel."""
    # Total by type
    by_type = fetch_all(
        """
        SELECT cost_type, sum(amount_cny) as total, count(*) as count
        FROM core_pipeline.cost_events
        WHERE created_at > now() - interval '%s days'
        GROUP BY cost_type ORDER BY total DESC
        """,
        (days,),
    )

    # Total by agent
    by_agent = fetch_all(
        """
        SELECT agent_name, sum(amount_cny) as total, count(*) as count
        FROM core_pipeline.cost_events
        WHERE created_at > now() - interval '%s days' AND agent_name IS NOT NULL
        GROUP BY agent_name ORDER BY total DESC
        """,
        (days,),
    )

    # Daily trend
    daily_trend = fetch_all(
        """
        SELECT date_trunc('day', created_at) as day, sum(amount_cny) as total
        FROM core_pipeline.cost_events
        WHERE created_at > now() - interval '%s days'
        GROUP BY day ORDER BY day
        """,
        (days,),
    )

    grand_total = sum(r["total"] for r in by_type)

    return {
        "period_days": days,
        "grand_total_cny": grand_total,
        "by_type": by_type,
        "by_agent": by_agent,
        "daily_trend": daily_trend,
    }
