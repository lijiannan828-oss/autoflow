"""V10-V12: RAG E2E 测试

V10: 高分 shot → 自动入库 → 检索验证
V11: 人审标记错误 → negative 入库 → counter-example 检索
V12: 打回 → 修复成功 → corrective before/after 入库
"""

from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock

from backend.agents.dispatch.rag_ingestion import (
    generate_chain_id,
    ingest_case,
    ingest_positive_from_qc,
    ingest_negative,
    ingest_corrective,
    search_cases,
    search_counter_examples,
    search_corrective_examples,
    get_rag_statistics,
    IngestionRequest,
    IngestionResult,
    POSITIVE_THRESHOLD,
)
from backend.common.rag import RAGCase, MockRagClient


# ── 辅助 ─────────────────────────────────────────────────────────


def _make_mock_rag_client():
    """创建 MockRagClient（内存存储，不需要 Qdrant）。"""
    return MockRagClient()


# ── V10: Positive Case E2E ───────────────────────────────────────


class TestPositiveIngestion:
    """V10: 高分 QC → 自动入库 → 检索。"""

    def test_generate_chain_id_deterministic(self):
        """同一 shot + case_type 生成相同 chain_id。"""
        id1 = generate_chain_id("proj-1", "ep-1", "shot-1", "positive")
        id2 = generate_chain_id("proj-1", "ep-1", "shot-1", "positive")
        assert id1 == id2
        assert id1 == "proj-1:ep-1:shot-1:positive"

    def test_generate_chain_id_different_types(self):
        """不同 case_type → 不同 chain_id。"""
        id1 = generate_chain_id("p", "e", "s", "positive")
        id2 = generate_chain_id("p", "e", "s", "negative")
        assert id1 != id2

    def test_threshold_gate(self):
        """评分低于阈值 → 拒绝入库。"""
        result = ingest_positive_from_qc(
            shot_id="shot-low",
            quality_score=7.5,
        )
        assert result.success is False
        assert "below threshold" in result.error

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    def test_positive_ingest_full_pipeline(self, mock_pg, mock_get_client):
        """V10 核心: 高分 shot → Qdrant + PG 双写成功。"""
        mock_client = _make_mock_rag_client()
        mock_get_client.return_value = mock_client

        result = ingest_positive_from_qc(
            shot_id="shot-good",
            quality_score=9.5,
            genre="都市",
            scene_type="对话",
            difficulty="S1",
            chain_assets={"keyframe_url": "tos://kf/001.png", "video_url": "tos://vid/001.mp4"},
            project_id="proj-1",
            episode_id="ep-1",
            description="高质量都市对话场景",
        )

        assert result.success is True
        assert result.chain_id == "proj-1:ep-1:shot-good:positive"
        assert result.qdrant_written is True
        assert result.pg_written is True

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=False)
    def test_qdrant_ok_pg_fail_still_success(self, mock_pg, mock_get_client):
        """Qdrant 写入成功 + PG 失败 → 整体仍视为成功。"""
        mock_client = _make_mock_rag_client()
        mock_get_client.return_value = mock_client

        result = ingest_positive_from_qc(
            shot_id="shot-partial",
            quality_score=9.2,
        )

        assert result.success is True
        assert result.qdrant_written is True
        assert result.pg_written is False


# ── V11: Negative Case E2E ───────────────────────────────────────


class TestNegativeIngestion:
    """V11: 人审标记错误 → negative 入库 → counter-example 检索。"""

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    def test_negative_ingest(self, mock_pg, mock_get_client):
        """人审标记的典型错误正确入库。"""
        mock_client = _make_mock_rag_client()
        mock_get_client.return_value = mock_client

        result = ingest_negative(
            shot_id="shot-bad",
            issue_description="角色五官严重变形，嘴巴位置偏移",
            severity="critical",
            genre="古装",
            scene_type="特写",
            project_id="proj-2",
            episode_id="ep-5",
        )

        assert result.success is True
        assert "negative" in result.chain_id
        assert result.qdrant_written is True

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_search_counter_examples(self, mock_get_client):
        """检索 negative 案例作为 counter-examples。"""
        mock_client = _make_mock_rag_client()
        # 预写入一些案例
        mock_client.upsert(RAGCase(
            chain_id="test:neg:1",
            quality_score=0.0,
            case_type="negative",
            genre="古装",
            scene_type="特写",
            payload={"issue_description": "面部变形"},
        ))
        mock_client.upsert(RAGCase(
            chain_id="test:pos:1",
            quality_score=9.5,
            case_type="positive",
            genre="古装",
            scene_type="特写",
            payload={},
        ))
        mock_get_client.return_value = mock_client

        results = search_counter_examples(genre="古装", limit=5)
        # 只返回 negative 类型
        for r in results:
            assert r["case_type"] == "negative"


# ── V12: Corrective Case E2E ─────────────────────────────────────


class TestCorrectiveIngestion:
    """V12: 打回 → 修复 → before/after 入库。"""

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    def test_corrective_ingest(self, mock_pg, mock_get_client):
        """修正案例入库 — before/after 资产对比。"""
        mock_client = _make_mock_rag_client()
        mock_get_client.return_value = mock_client

        result = ingest_corrective(
            shot_id="shot-fixed",
            before_assets={"keyframe_url": "tos://kf/before.png"},
            after_assets={"keyframe_url": "tos://kf/after.png"},
            quality_before=5.0,
            quality_after=9.2,
            correction_description="修正了角色面部比例，调整了光影效果",
            genre="都市",
            scene_type="全景",
            project_id="proj-1",
            episode_id="ep-3",
        )

        assert result.success is True
        assert "corrective" in result.chain_id
        assert result.qdrant_written is True
        assert result.pg_written is True

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_search_corrective_examples(self, mock_get_client):
        """检索修正案例 — before/after 对比。"""
        mock_client = _make_mock_rag_client()
        mock_client.upsert(RAGCase(
            chain_id="test:corr:1",
            quality_score=9.0,
            case_type="corrective",
            genre="都市",
            scene_type="全景",
            payload={
                "before": {"keyframe_url": "tos://kf/before.png"},
                "after": {"keyframe_url": "tos://kf/after.png"},
                "quality_before": 5.0,
                "quality_after": 9.0,
                "correction": "修正面部比例",
            },
        ))
        mock_get_client.return_value = mock_client

        results = search_corrective_examples(genre="都市", limit=5)
        for r in results:
            assert r["case_type"] == "corrective"


# ── 混合检索 ─────────────────────────────────────────────────────


class TestSearchCases:
    """search_cases 混合检索测试。"""

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_search_by_genre_and_min_score(self, mock_get_client):
        """按 genre 和 min_score 过滤。"""
        mock_client = _make_mock_rag_client()
        mock_client.upsert(RAGCase(chain_id="c1", quality_score=9.5, case_type="positive", genre="都市", payload={}))
        mock_client.upsert(RAGCase(chain_id="c2", quality_score=7.0, case_type="positive", genre="都市", payload={}))
        mock_client.upsert(RAGCase(chain_id="c3", quality_score=9.8, case_type="positive", genre="古装", payload={}))
        mock_get_client.return_value = mock_client

        results = search_cases(genre="都市", min_score=9.0, limit=10)
        assert len(results) >= 1
        for r in results:
            assert r["quality_score"] >= 9.0

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_search_sorted_by_score(self, mock_get_client):
        """结果按 quality_score 降序排列。"""
        mock_client = _make_mock_rag_client()
        mock_client.upsert(RAGCase(chain_id="low", quality_score=8.0, case_type="positive", payload={}))
        mock_client.upsert(RAGCase(chain_id="high", quality_score=9.9, case_type="positive", payload={}))
        mock_client.upsert(RAGCase(chain_id="mid", quality_score=9.0, case_type="positive", payload={}))
        mock_get_client.return_value = mock_client

        results = search_cases(limit=10)
        scores = [r["quality_score"] for r in results]
        assert scores == sorted(scores, reverse=True)

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_search_by_difficulty(self, mock_get_client):
        """按 difficulty 过滤。"""
        mock_client = _make_mock_rag_client()
        mock_client.upsert(RAGCase(chain_id="s0", quality_score=9.0, case_type="positive", payload={"difficulty": "S0"}))
        mock_client.upsert(RAGCase(chain_id="s2", quality_score=9.0, case_type="positive", payload={"difficulty": "S2"}))
        mock_get_client.return_value = mock_client

        results = search_cases(difficulty="S0", limit=10)
        for r in results:
            assert r["difficulty"] == "S0"


# ── RAG 统计 ─────────────────────────────────────────────────────


class TestRagStatistics:
    """get_rag_statistics 测试。"""

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_stats_structure(self, mock_get_client):
        """返回值包含所有预期字段。"""
        mock_client = _make_mock_rag_client()
        mock_get_client.return_value = mock_client

        stats = get_rag_statistics()
        assert "total_cases" in stats
        assert "by_case_type" in stats
        assert "qdrant_health" in stats
        # PG 部分会失败（无真实数据库），应有 pg_error
        assert "pg_error" in stats or "by_genre" in stats
