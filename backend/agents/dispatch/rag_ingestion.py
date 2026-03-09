"""RAG 入库与检索模块 — V5/V6/V7 交付

链路级案例生命周期：
  1. QC 评分 ≥ 阈值 → 触发入库候选
  2. 收集全链路资产（shot spec → 关键帧 → 视频 → 音频 → 最终合成）
  3. 生成文本摘要 → embedding
  4. 写入 Qdrant（向量+payload）+ PG rag_chain_cases（索引+元信息）
  5. 检索：标签预筛 → 向量语义（若有 embedding）→ 评分排序 → TOP-K

三类案例：
  - positive: QC ≥ 9.0 或人审标记为优秀
  - negative: 人审标记为典型错误
  - corrective: 打回 → 修改成功 → before/after 对比
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from backend.common.rag import RAGCase, get_rag_client

logger = logging.getLogger(__name__)

# ── 入库阈值 ──────────────────────────────────────────────────────
POSITIVE_THRESHOLD = 9.0      # QC 评分 ≥ 此值自动入库为 positive
NEGATIVE_MIN_SEVERITY = "major"  # 人审标记 severity ≥ 此级别才入 negative


# ── 入库请求结构 ──────────────────────────────────────────────────

@dataclass
class IngestionRequest:
    """RAG 入库请求。"""
    case_type: str                            # positive / negative / corrective
    quality_score: float                      # QC 评分
    genre: str | None = None                  # 题材标签
    scene_type: str | None = None             # 场景类型
    difficulty: str | None = None             # S0/S1/S2
    source_project_id: str | None = None
    source_episode_id: str | None = None
    source_shot_id: str | None = None
    # 链路资产引用
    chain_assets: dict[str, Any] = field(default_factory=dict)
    # 可选：已生成的 embedding
    embedding: list[float] | None = None
    # 可选：描述文本（用于生成 embedding）
    description_text: str | None = None


@dataclass
class IngestionResult:
    """入库结果。"""
    success: bool
    chain_id: str = ""
    qdrant_written: bool = False
    pg_written: bool = False
    error: str | None = None


# ── V5: Qdrant 集成增强 ──────────────────────────────────────────

def generate_chain_id(
    source_project_id: str | None,
    source_episode_id: str | None,
    source_shot_id: str | None,
    case_type: str,
) -> str:
    """生成确定性 chain_id。同一 shot + case_type 只会产生一条记录。"""
    parts = [
        source_project_id or "global",
        source_episode_id or "unknown",
        source_shot_id or "unknown",
        case_type,
    ]
    return ":".join(parts)


def generate_embedding(text: str) -> list[float] | None:
    """调用 LLM API 生成文本 embedding。

    当前使用零向量占位。真实 embedding 需要接入 embedding 模型
    （如 text-embedding-3-small）。
    """
    # TODO: 接入真实 embedding API（text-embedding-3-small 或 bge-m3）
    # 当前返回 None，由 rag.py upsert 用零向量填充
    logger.debug("Embedding generation skipped (using zero vector placeholder)")
    return None


# ── V6: 入库流程 ──────────────────────────────────────────────────

def ingest_case(request: IngestionRequest) -> IngestionResult:
    """完整入库流程：生成 chain_id → embedding → Qdrant → PG 索引。"""
    chain_id = generate_chain_id(
        request.source_project_id,
        request.source_episode_id,
        request.source_shot_id,
        request.case_type,
    )

    # 1. 构造 RAGCase
    case = RAGCase(
        chain_id=chain_id,
        quality_score=request.quality_score,
        case_type=request.case_type,
        genre=request.genre,
        scene_type=request.scene_type,
        payload={
            "chain_assets": request.chain_assets,
            "difficulty": request.difficulty,
            "source_project_id": request.source_project_id,
            "source_episode_id": request.source_episode_id,
            "source_shot_id": request.source_shot_id,
            "description": request.description_text or "",
        },
    )

    # 2. 生成 embedding
    embedding = request.embedding
    if embedding is None and request.description_text:
        embedding = generate_embedding(request.description_text)

    # 3. 写入 Qdrant
    qdrant_ok = False
    try:
        client = get_rag_client()
        client.upsert(case, embedding=embedding)
        qdrant_ok = True
    except Exception as exc:
        logger.warning("Qdrant upsert failed for %s: %s", chain_id, exc)

    # 4. 写入 PG 索引（rag_chain_cases 表）
    pg_ok = _upsert_pg_index(chain_id, request, case)

    return IngestionResult(
        success=qdrant_ok or pg_ok,
        chain_id=chain_id,
        qdrant_written=qdrant_ok,
        pg_written=pg_ok,
    )


def ingest_positive_from_qc(
    shot_id: str,
    quality_score: float,
    genre: str | None = None,
    scene_type: str | None = None,
    difficulty: str | None = None,
    chain_assets: dict[str, Any] | None = None,
    project_id: str | None = None,
    episode_id: str | None = None,
    description: str | None = None,
) -> IngestionResult:
    """QC 高分自动入库（≥ POSITIVE_THRESHOLD）。

    由 QualityInspectorAgent 在 N03/N11/N15 QC 通过后调用。
    """
    if quality_score < POSITIVE_THRESHOLD:
        return IngestionResult(
            success=False, error=f"Score {quality_score} below threshold {POSITIVE_THRESHOLD}"
        )

    return ingest_case(IngestionRequest(
        case_type="positive",
        quality_score=quality_score,
        genre=genre,
        scene_type=scene_type,
        difficulty=difficulty,
        source_project_id=project_id,
        source_episode_id=episode_id,
        source_shot_id=shot_id,
        chain_assets=chain_assets or {},
        description_text=description,
    ))


def ingest_negative(
    shot_id: str,
    issue_description: str,
    severity: str = "major",
    genre: str | None = None,
    scene_type: str | None = None,
    chain_assets: dict[str, Any] | None = None,
    project_id: str | None = None,
    episode_id: str | None = None,
) -> IngestionResult:
    """人审标记的典型错误入库。"""
    return ingest_case(IngestionRequest(
        case_type="negative",
        quality_score=0.0,
        genre=genre,
        scene_type=scene_type,
        source_project_id=project_id,
        source_episode_id=episode_id,
        source_shot_id=shot_id,
        chain_assets={
            **(chain_assets or {}),
            "issue_description": issue_description,
            "severity": severity,
        },
        description_text=f"典型错误: {issue_description}",
    ))


def ingest_corrective(
    shot_id: str,
    before_assets: dict[str, Any],
    after_assets: dict[str, Any],
    quality_before: float,
    quality_after: float,
    correction_description: str = "",
    genre: str | None = None,
    scene_type: str | None = None,
    project_id: str | None = None,
    episode_id: str | None = None,
) -> IngestionResult:
    """打回 → 修改成功 → before/after 对比入库。"""
    return ingest_case(IngestionRequest(
        case_type="corrective",
        quality_score=quality_after,
        genre=genre,
        scene_type=scene_type,
        source_project_id=project_id,
        source_episode_id=episode_id,
        source_shot_id=shot_id,
        chain_assets={
            "before": before_assets,
            "after": after_assets,
            "quality_before": quality_before,
            "quality_after": quality_after,
            "correction": correction_description,
        },
        description_text=f"修正案例: {correction_description} (score {quality_before} → {quality_after})",
    ))


# ── V7: 增强检索 ──────────────────────────────────────────────────

def search_cases(
    genre: str | None = None,
    scene_type: str | None = None,
    case_type: str | None = None,
    difficulty: str | None = None,
    min_score: float = 0.0,
    query_text: str | None = None,
    limit: int = 3,
) -> list[dict[str, Any]]:
    """混合检索策略：标签预筛 + 评分排序 → TOP-K。

    策略：
      1. 通过 Qdrant payload 过滤（genre/scene_type）
      2. 客户端按 quality_score 降序排序
      3. 应用 min_score 和 case_type 过滤
      4. 返回 TOP-K

    未来升级点：
      - 接入 embedding 后改用向量检索
      - 结合 PG rag_chain_cases 表做复合查询
    """
    try:
        client = get_rag_client()
        # 基础检索（genre + scene_type 过滤）
        raw_cases = client.search(
            agent_name="",  # 搜索不限 agent
            genre=genre,
            scene_type=scene_type,
            query_text=query_text,
            limit=limit * 5,  # over-fetch for post-filtering
        )

        # 后过滤
        results = []
        for case in raw_cases:
            if case.quality_score < min_score:
                continue
            if case_type and case.case_type != case_type:
                continue
            if difficulty and case.payload.get("difficulty") != difficulty:
                continue
            results.append({
                "chain_id": case.chain_id,
                "quality_score": case.quality_score,
                "case_type": case.case_type,
                "genre": case.genre,
                "scene_type": case.scene_type,
                "difficulty": case.payload.get("difficulty"),
                "payload": case.payload,
            })

        # 按 quality_score 降序
        results.sort(key=lambda r: r["quality_score"], reverse=True)
        return results[:limit]

    except Exception as exc:
        logger.warning("RAG search failed: %s", exc)
        return []


def search_counter_examples(
    genre: str | None = None,
    scene_type: str | None = None,
    limit: int = 2,
) -> list[dict[str, Any]]:
    """检索负向案例（counter-examples），用于 Agent 避免重复错误。"""
    return search_cases(
        genre=genre,
        scene_type=scene_type,
        case_type="negative",
        limit=limit,
    )


def search_corrective_examples(
    genre: str | None = None,
    scene_type: str | None = None,
    limit: int = 2,
) -> list[dict[str, Any]]:
    """检索修正案例，展示 before/after 对比。"""
    return search_cases(
        genre=genre,
        scene_type=scene_type,
        case_type="corrective",
        limit=limit,
    )


# ── V8: 统计 ──────────────────────────────────────────────────────

def get_rag_statistics() -> dict[str, Any]:
    """获取 RAG 库的全维度统计。

    从 Qdrant（总数）+ PG rag_chain_cases（分维度聚合）两处汇总。
    """
    stats: dict[str, Any] = {
        "total_cases": 0,
        "by_case_type": {},
        "by_genre": [],
        "by_difficulty": [],
        "score_distribution": {},
        "recent_ingestions": [],
        "qdrant_health": {},
    }

    # Qdrant 健康和总数
    try:
        client = get_rag_client()
        stats["qdrant_health"] = client.health()
        stats["total_cases"] = client.count()
    except Exception as exc:
        stats["qdrant_health"] = {"status": "error", "error": str(exc)}

    # PG 聚合
    try:
        from backend.common.db import fetch_all, fetch_value

        # 总数（from PG）
        pg_total = fetch_value("SELECT count(*) FROM core_pipeline.rag_chain_cases") or 0

        # 按 case_type
        by_type = fetch_all(
            "SELECT case_type, count(*) as count, avg(quality_score) as avg_score "
            "FROM core_pipeline.rag_chain_cases GROUP BY case_type ORDER BY count DESC"
        )
        stats["by_case_type"] = {
            r["case_type"]: {"count": r["count"], "avg_score": round(float(r["avg_score"] or 0), 2)}
            for r in by_type
        }

        # 按 genre
        stats["by_genre"] = fetch_all(
            "SELECT genre, count(*) as count, avg(quality_score) as avg_score, "
            "avg(retrieval_count) as avg_retrieval "
            "FROM core_pipeline.rag_chain_cases "
            "WHERE genre IS NOT NULL GROUP BY genre ORDER BY count DESC LIMIT 20"
        )

        # 按 difficulty
        stats["by_difficulty"] = fetch_all(
            "SELECT difficulty, count(*) as count, avg(quality_score) as avg_score "
            "FROM core_pipeline.rag_chain_cases "
            "WHERE difficulty IS NOT NULL GROUP BY difficulty ORDER BY difficulty"
        )

        # 评分分布
        score_dist = fetch_all(
            "SELECT "
            "  CASE "
            "    WHEN quality_score >= 9.5 THEN '9.5+' "
            "    WHEN quality_score >= 9.0 THEN '9.0-9.5' "
            "    WHEN quality_score >= 8.0 THEN '8.0-9.0' "
            "    WHEN quality_score >= 5.0 THEN '5.0-8.0' "
            "    ELSE '<5.0' "
            "  END as bucket, count(*) as count "
            "FROM core_pipeline.rag_chain_cases GROUP BY bucket ORDER BY bucket DESC"
        )
        stats["score_distribution"] = {r["bucket"]: r["count"] for r in score_dist}

        # 最近入库
        stats["recent_ingestions"] = fetch_all(
            "SELECT chain_id, case_type, genre, quality_score, created_at "
            "FROM core_pipeline.rag_chain_cases ORDER BY created_at DESC LIMIT 10"
        )

        # 检索热度 TOP-10
        stats["retrieval_hotspot"] = fetch_all(
            "SELECT chain_id, genre, scene_type, retrieval_count, quality_score "
            "FROM core_pipeline.rag_chain_cases WHERE retrieval_count > 0 "
            "ORDER BY retrieval_count DESC LIMIT 10"
        )

    except Exception as exc:
        logger.warning("PG stats query failed: %s", exc)
        stats["pg_error"] = str(exc)

    return stats


# ── PG 索引同步 ───────────────────────────────────────────────────

def _upsert_pg_index(chain_id: str, request: IngestionRequest, case: RAGCase) -> bool:
    """写入或更新 PG rag_chain_cases 索引表。"""
    try:
        from backend.common.db import execute_returning_one
        row = execute_returning_one(
            """
            INSERT INTO core_pipeline.rag_chain_cases (
                chain_id, quality_score, case_type,
                source_project_id, source_episode_id, source_shot_id,
                genre, scene_type, difficulty
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (chain_id) DO UPDATE SET
                quality_score = EXCLUDED.quality_score,
                case_type = EXCLUDED.case_type,
                genre = EXCLUDED.genre,
                scene_type = EXCLUDED.scene_type,
                difficulty = EXCLUDED.difficulty
            RETURNING id
            """,
            (
                chain_id,
                request.quality_score,
                request.case_type,
                request.source_project_id,
                request.source_episode_id,
                request.source_shot_id,
                request.genre,
                request.scene_type,
                request.difficulty,
            ),
        )
        return row is not None
    except Exception as exc:
        logger.warning("PG index upsert failed for %s: %s", chain_id, exc)
        return False


def increment_retrieval_count(chain_id: str) -> None:
    """记录检索次数（供统计用）。"""
    try:
        from backend.common.db import execute
        execute(
            "UPDATE core_pipeline.rag_chain_cases "
            "SET retrieval_count = retrieval_count + 1 "
            "WHERE chain_id = %s",
            (chain_id,),
        )
    except Exception:
        pass  # 统计失败不阻塞主流程
