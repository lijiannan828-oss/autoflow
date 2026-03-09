"""agent_memory.py — Agent 记忆层 CRUD + 过期清理

对 core_pipeline.agent_memory 表的完整操作封装。
BaseAgent 内部调用这些函数，也可被 API 层直接调用。

记忆层级：
  - global:  跨所有项目共享（如通用 lesson）
  - project: 项目级（如"角色太后最佳实践"）
  - episode: 剧集级（如"第5集节奏偏慢"）

置信度衰减：
  每次 cleanup 时，超过 TTL 未访问的记忆 confidence *= decay_factor。
  confidence < min_threshold 的记忆被软删除（is_active=false 或直接删除）。
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


# ── Create / Upsert ──────────────────────────────────────────────────

def upsert_memory(
    agent_name: str,
    content_key: str,
    content_value: dict[str, Any],
    *,
    memory_type: str = "lesson_learned",
    scope: str = "project",
    scope_id: str | None = None,
    confidence: float = 0.5,
) -> dict[str, Any]:
    """Insert or update a memory record (upsert on agent_name + content_key + scope + scope_id).

    Returns the upserted row as a dict.
    """
    row = execute_returning_one(
        """
        INSERT INTO core_pipeline.agent_memory
            (agent_name, memory_type, scope, scope_id, content_key, content_value, confidence)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
        ON CONFLICT ON CONSTRAINT agent_memory_pkey DO NOTHING
        RETURNING *
        """,
        (agent_name, memory_type, scope, scope_id, content_key,
         json.dumps(content_value), confidence),
    )
    if row:
        return row

    # Try update existing by key match
    row = execute_returning_one(
        """
        UPDATE core_pipeline.agent_memory
        SET content_value = %s::jsonb,
            confidence = GREATEST(confidence, %s),
            updated_at = now()
        WHERE agent_name = %s AND content_key = %s
          AND scope = %s AND (scope_id = %s OR (scope_id IS NULL AND %s IS NULL))
        RETURNING *
        """,
        (json.dumps(content_value), confidence,
         agent_name, content_key, scope, scope_id, scope_id),
    )
    if row:
        return row

    # Fallback: simple insert without conflict
    row = execute_returning_one(
        """
        INSERT INTO core_pipeline.agent_memory
            (agent_name, memory_type, scope, scope_id, content_key, content_value, confidence)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
        RETURNING *
        """,
        (agent_name, memory_type, scope, scope_id, content_key,
         json.dumps(content_value), confidence),
    )
    return row or {}


# ── Read ──────────────────────────────────────────────────────────────

def get_memory(memory_id: str) -> dict[str, Any] | None:
    """Get a single memory by ID."""
    return fetch_one(
        "SELECT * FROM core_pipeline.agent_memory WHERE id = %s",
        (memory_id,),
    )


def get_memory_by_key(
    agent_name: str,
    content_key: str,
    scope: str = "project",
    scope_id: str | None = None,
) -> dict[str, Any] | None:
    """Get a memory by agent + key + scope."""
    if scope_id is None:
        return fetch_one(
            """
            SELECT * FROM core_pipeline.agent_memory
            WHERE agent_name = %s AND content_key = %s
              AND scope = %s AND scope_id IS NULL
            """,
            (agent_name, content_key, scope),
        )
    return fetch_one(
        """
        SELECT * FROM core_pipeline.agent_memory
        WHERE agent_name = %s AND content_key = %s
          AND scope = %s AND scope_id = %s
        """,
        (agent_name, content_key, scope, scope_id),
    )


def list_memories(
    agent_name: str,
    *,
    scope: str | None = None,
    scope_id: str | None = None,
    memory_type: str | None = None,
    min_confidence: float = 0.0,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """List memories with filters."""
    conditions = ["agent_name = %s"]
    params: list[Any] = [agent_name]

    if scope is not None:
        conditions.append("scope = %s")
        params.append(scope)
    if scope_id is not None:
        conditions.append("scope_id = %s")
        params.append(scope_id)
    if memory_type is not None:
        conditions.append("memory_type = %s")
        params.append(memory_type)
    if min_confidence > 0:
        conditions.append("confidence >= %s")
        params.append(min_confidence)

    where = " AND ".join(conditions)
    params.extend([limit, offset])

    return fetch_all(
        f"""
        SELECT * FROM core_pipeline.agent_memory
        WHERE {where}
        ORDER BY access_count DESC, confidence DESC
        LIMIT %s OFFSET %s
        """,
        params,
    )


def count_memories(agent_name: str, scope: str | None = None) -> int:
    """Count memories for an agent."""
    if scope:
        return fetch_value(
            "SELECT count(*) FROM core_pipeline.agent_memory WHERE agent_name = %s AND scope = %s",
            (agent_name, scope),
        ) or 0
    return fetch_value(
        "SELECT count(*) FROM core_pipeline.agent_memory WHERE agent_name = %s",
        (agent_name,),
    ) or 0


# ── Update ────────────────────────────────────────────────────────────

def update_memory(
    memory_id: str,
    content_value: dict[str, Any] | None = None,
    confidence: float | None = None,
) -> dict[str, Any] | None:
    """Update a memory's value and/or confidence."""
    sets: list[str] = ["updated_at = now()"]
    params: list[Any] = []

    if content_value is not None:
        sets.append("content_value = %s::jsonb")
        params.append(json.dumps(content_value))
    if confidence is not None:
        sets.append("confidence = %s")
        params.append(confidence)

    params.append(memory_id)
    return execute_returning_one(
        f"UPDATE core_pipeline.agent_memory SET {', '.join(sets)} WHERE id = %s RETURNING *",
        params,
    )


def touch_memory(memory_id: str) -> None:
    """Increment access_count and update last_accessed_at."""
    execute(
        """
        UPDATE core_pipeline.agent_memory
        SET access_count = access_count + 1, last_accessed_at = now()
        WHERE id = %s
        """,
        (memory_id,),
    )


# ── Delete ────────────────────────────────────────────────────────────

def delete_memory(memory_id: str) -> bool:
    """Hard delete a memory by ID."""
    row = execute_returning_one(
        "DELETE FROM core_pipeline.agent_memory WHERE id = %s RETURNING id",
        (memory_id,),
    )
    return row is not None


# ── Cleanup / Expiry ──────────────────────────────────────────────────

def cleanup_stale_memories(
    *,
    stale_days: int = 30,
    decay_factor: float = 0.8,
    min_confidence: float = 0.1,
) -> dict[str, int]:
    """Clean up stale memories.

    1. Decay confidence for memories not accessed in stale_days.
    2. Delete memories with confidence below min_confidence.

    Returns {"decayed": N, "deleted": M}.
    """
    # Step 1: Decay
    decayed = fetch_value(
        """
        WITH updated AS (
            UPDATE core_pipeline.agent_memory
            SET confidence = confidence * %s, updated_at = now()
            WHERE last_accessed_at < now() - interval '%s days'
              AND confidence > %s
            RETURNING id
        )
        SELECT count(*) FROM updated
        """,
        (decay_factor, stale_days, min_confidence),
    ) or 0

    # Step 2: Delete below threshold
    deleted = fetch_value(
        """
        WITH removed AS (
            DELETE FROM core_pipeline.agent_memory
            WHERE confidence < %s
            RETURNING id
        )
        SELECT count(*) FROM removed
        """,
        (min_confidence,),
    ) or 0

    logger.info("Memory cleanup: decayed=%d, deleted=%d", decayed, deleted)
    return {"decayed": int(decayed), "deleted": int(deleted)}


# ── Statistics ────────────────────────────────────────────────────────

def get_memory_stats() -> dict[str, Any]:
    """Get aggregate memory statistics across all agents."""
    rows = fetch_all(
        """
        SELECT agent_name,
               count(*) as count,
               avg(confidence) as avg_confidence,
               sum(access_count) as total_accesses
        FROM core_pipeline.agent_memory
        GROUP BY agent_name
        ORDER BY count DESC
        """,
    )
    return {
        "agents": rows,
        "total": sum(r["count"] for r in rows),
    }
