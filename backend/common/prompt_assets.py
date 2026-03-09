"""prompt_assets.py — Prompt 资产库 CRUD

三层 Prompt 架构：
  1. Master Template (prompt_assets) — Agent+Stage 唯一活跃版本
  2. Genre Adapter (genre_adapters) — 题材覆写层
  3. Instance Adapter (运行时) — 单次执行的动态注入（不持久化）

用法：
  prompt = get_active_prompt("visual_director", "keyframe_gen")
  adapter = get_genre_adapter_for(prompt["id"], "古装宫斗")
  final = compose_prompt(prompt["master_system_prompt"], adapter, instance_vars)
"""

from __future__ import annotations

import json
import logging
from typing import Any

from backend.common.db import (
    execute,
    execute_returning_one,
    execute_returning_all,
    fetch_all,
    fetch_one,
    fetch_value,
)

logger = logging.getLogger(__name__)


# ── Master Prompt CRUD ────────────────────────────────────────────────

def get_active_prompt(agent_name: str, prompt_stage: str) -> dict[str, Any] | None:
    """Get the active master prompt for an agent + stage."""
    return fetch_one(
        """
        SELECT * FROM core_pipeline.prompt_assets
        WHERE agent_name = %s AND prompt_stage = %s AND is_active = true
        LIMIT 1
        """,
        (agent_name, prompt_stage),
    )


def list_prompts(
    agent_name: str | None = None,
    active_only: bool = True,
) -> list[dict[str, Any]]:
    """List prompt assets, optionally filtered by agent."""
    conditions: list[str] = []
    params: list[Any] = []

    if agent_name:
        conditions.append("agent_name = %s")
        params.append(agent_name)
    if active_only:
        conditions.append("is_active = true")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    return fetch_all(
        f"SELECT * FROM core_pipeline.prompt_assets {where} ORDER BY agent_name, prompt_stage",
        params or None,
    )


def create_prompt(
    agent_name: str,
    prompt_stage: str,
    system_prompt: str,
    *,
    version: str = "v1.0",
    output_schema_ref: str | None = None,
) -> dict[str, Any]:
    """Create a new prompt asset (deactivates existing for same agent+stage)."""
    # Deactivate existing
    execute(
        """
        UPDATE core_pipeline.prompt_assets
        SET is_active = false, updated_at = now()
        WHERE agent_name = %s AND prompt_stage = %s AND is_active = true
        """,
        (agent_name, prompt_stage),
    )
    row = execute_returning_one(
        """
        INSERT INTO core_pipeline.prompt_assets
            (agent_name, prompt_stage, master_version, master_system_prompt,
             master_output_schema_ref)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (agent_name, prompt_stage, version, system_prompt, output_schema_ref),
    )
    return row or {}


def update_prompt(
    prompt_id: str,
    system_prompt: str,
    *,
    new_version: str | None = None,
    change_reason: str | None = None,
    changed_by: str | None = None,
) -> dict[str, Any] | None:
    """Update a prompt's system_prompt and record version history."""
    # Get current for history
    current = fetch_one(
        "SELECT * FROM core_pipeline.prompt_assets WHERE id = %s",
        (prompt_id,),
    )
    if not current:
        return None

    # Record version history
    execute(
        """
        INSERT INTO core_pipeline.prompt_versions
            (prompt_asset_id, version, system_prompt, change_reason, changed_by)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (prompt_id, current["master_version"], current["master_system_prompt"],
         change_reason, changed_by),
    )

    # Update master
    version = new_version or _bump_version(current["master_version"])
    return execute_returning_one(
        """
        UPDATE core_pipeline.prompt_assets
        SET master_system_prompt = %s, master_version = %s, updated_at = now()
        WHERE id = %s
        RETURNING *
        """,
        (system_prompt, version, prompt_id),
    )


def lock_prompt(prompt_id: str, locked_by: str) -> bool:
    """Lock a prompt to prevent automated changes."""
    row = execute_returning_one(
        """
        UPDATE core_pipeline.prompt_assets
        SET locked_by = %s, locked_at = now(), updated_at = now()
        WHERE id = %s AND locked_by IS NULL
        RETURNING id
        """,
        (locked_by, prompt_id),
    )
    return row is not None


def unlock_prompt(prompt_id: str) -> bool:
    """Unlock a prompt."""
    row = execute_returning_one(
        """
        UPDATE core_pipeline.prompt_assets
        SET locked_by = NULL, locked_at = NULL, updated_at = now()
        WHERE id = %s
        RETURNING id
        """,
        (prompt_id,),
    )
    return row is not None


# ── Genre Adapter CRUD ────────────────────────────────────────────────

def get_genre_adapter(prompt_asset_id: str, genre_tag: str) -> dict[str, Any] | None:
    """Get active genre adapter for a prompt + genre."""
    return fetch_one(
        """
        SELECT * FROM core_pipeline.genre_adapters
        WHERE prompt_asset_id = %s AND genre_tag = %s AND is_active = true
        LIMIT 1
        """,
        (prompt_asset_id, genre_tag),
    )


def list_genre_adapters(prompt_asset_id: str) -> list[dict[str, Any]]:
    """List all active genre adapters for a prompt."""
    return fetch_all(
        """
        SELECT * FROM core_pipeline.genre_adapters
        WHERE prompt_asset_id = %s AND is_active = true
        ORDER BY genre_tag
        """,
        (prompt_asset_id,),
    )


def create_genre_adapter(
    prompt_asset_id: str,
    genre_tag: str,
    adapter_prompt: str,
    *,
    style_keywords: list[str] | None = None,
    few_shot_case_ids: list[str] | None = None,
    created_by: str = "human",
) -> dict[str, Any]:
    """Create a new genre adapter."""
    row = execute_returning_one(
        """
        INSERT INTO core_pipeline.genre_adapters
            (prompt_asset_id, genre_tag, adapter_prompt, style_keywords,
             few_shot_case_ids, created_by)
        VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s)
        RETURNING *
        """,
        (prompt_asset_id, genre_tag, adapter_prompt,
         json.dumps(style_keywords or []),
         json.dumps(few_shot_case_ids or []),
         created_by),
    )
    return row or {}


def update_genre_adapter_stats(
    adapter_id: str,
    qc_score: float | None = None,
    human_approved: bool | None = None,
) -> None:
    """Update usage stats for a genre adapter after use."""
    sets: list[str] = ["total_uses = total_uses + 1", "updated_at = now()"]
    params: list[Any] = []

    if qc_score is not None:
        # Running average: new_avg = (old_avg * (n-1) + score) / n
        sets.append(
            "avg_qc_score = CASE WHEN avg_qc_score IS NULL THEN %s "
            "ELSE (avg_qc_score * (total_uses - 1) + %s) / total_uses END"
        )
        params.extend([qc_score, qc_score])

    if human_approved is not None:
        approval_val = 1.0 if human_approved else 0.0
        sets.append(
            "human_approval_rate = CASE WHEN human_approval_rate IS NULL THEN %s "
            "ELSE (human_approval_rate * (total_uses - 1) + %s) / total_uses END"
        )
        params.extend([approval_val, approval_val])

    params.append(adapter_id)
    execute(
        f"UPDATE core_pipeline.genre_adapters SET {', '.join(sets)} WHERE id = %s",
        params,
    )


# ── Prompt Composition ────────────────────────────────────────────────

def compose_prompt(
    master_prompt: str,
    genre_adapter: str | None = None,
    instance_vars: dict[str, str] | None = None,
) -> str:
    """Compose final prompt from three layers.

    1. Start with master_prompt
    2. Append genre_adapter section if provided
    3. Replace {{var}} placeholders with instance_vars
    """
    parts = [master_prompt]

    if genre_adapter:
        parts.append(f"\n\n## 题材适配\n{genre_adapter}")

    result = "\n".join(parts)

    if instance_vars:
        for key, value in instance_vars.items():
            result = result.replace(f"{{{{{key}}}}}", value)

    return result


# ── Version History ───────────────────────────────────────────────────

def get_version_history(prompt_asset_id: str) -> list[dict[str, Any]]:
    """Get version history for a prompt asset."""
    return fetch_all(
        """
        SELECT * FROM core_pipeline.prompt_versions
        WHERE prompt_asset_id = %s
        ORDER BY created_at DESC
        """,
        (prompt_asset_id,),
    )


def record_performance(
    prompt_asset_id: str,
    version: str,
    performance: dict[str, Any],
    is_before: bool = True,
) -> None:
    """Record performance metrics for a prompt version (before/after change)."""
    col = "performance_before" if is_before else "performance_after"
    execute(
        f"""
        UPDATE core_pipeline.prompt_versions
        SET {col} = %s::jsonb
        WHERE prompt_asset_id = %s AND version = %s
        """,
        (json.dumps(performance), prompt_asset_id, version),
    )


# ── Statistics ────────────────────────────────────────────────────────

def get_prompt_stats() -> dict[str, Any]:
    """Get aggregate prompt asset statistics."""
    total = fetch_value("SELECT count(*) FROM core_pipeline.prompt_assets WHERE is_active = true") or 0
    by_agent = fetch_all(
        """
        SELECT agent_name, count(*) as count
        FROM core_pipeline.prompt_assets WHERE is_active = true
        GROUP BY agent_name ORDER BY count DESC
        """,
    )
    adapter_count = fetch_value(
        "SELECT count(*) FROM core_pipeline.genre_adapters WHERE is_active = true"
    ) or 0
    version_count = fetch_value("SELECT count(*) FROM core_pipeline.prompt_versions") or 0

    return {
        "total_prompts": total,
        "by_agent": by_agent,
        "total_adapters": adapter_count,
        "total_versions": version_count,
    }


# ── Helpers ───────────────────────────────────────────────────────────

def _bump_version(version: str) -> str:
    """Bump version string: v1.0 → v1.1, v2.3 → v2.4."""
    if not version.startswith("v"):
        return "v1.0"
    parts = version[1:].split(".")
    if len(parts) == 2:
        major, minor = parts
        return f"v{major}.{int(minor) + 1}"
    return f"v{version[1:]}.1"
