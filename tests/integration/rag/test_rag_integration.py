"""T7: Integration tests for RAG ingestion and retrieval system.

Tests cover:
  - Positive case ingestion (high QC score)
  - Negative case ingestion (human-flagged errors)
  - Corrective case ingestion (before/after pair)
  - Search returns relevant cases sorted by score
  - Search with genre/scene_type filters
  - Pipeline: ingest → search → verify retrieved
  - Score threshold enforcement
  - MockRagClient CRUD operations
"""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import patch

import pytest

from backend.common.rag import MockRagClient, RAGCase, reset_rag_client


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _reset_rag_singleton():
    """Ensure each test starts with a fresh RAG client."""
    reset_rag_client()
    yield
    reset_rag_client()


@pytest.fixture
def rag_client():
    """Provide a fresh MockRagClient for each test."""
    return MockRagClient()


# ── T7-1: MockRagClient basic CRUD ──────────────────────────────────

class TestMockRagClientCRUD:

    def test_upsert_and_count(self, rag_client):
        case = RAGCase(
            chain_id="test-1", quality_score=9.5,
            case_type="positive", genre="romance",
        )
        chain_id = rag_client.upsert(case)
        assert chain_id == "test-1"
        assert rag_client.count() == 1

    def test_upsert_generates_chain_id_if_empty(self, rag_client):
        case = RAGCase(
            chain_id="", quality_score=8.0,
            case_type="positive",
        )
        chain_id = rag_client.upsert(case)
        assert len(chain_id) > 0
        assert rag_client.count() == 1

    def test_delete(self, rag_client):
        case = RAGCase(chain_id="del-1", quality_score=9.0, case_type="positive")
        rag_client.upsert(case)
        assert rag_client.count() == 1

        deleted = rag_client.delete("del-1")
        assert deleted is True
        assert rag_client.count() == 0

    def test_delete_nonexistent_returns_false(self, rag_client):
        assert rag_client.delete("nope") is False

    def test_health_returns_ok(self, rag_client):
        h = rag_client.health()
        assert h["status"] == "ok"
        assert h["backend"] == "mock"


# ── T7-2: Search sorted by quality score ─────────────────────────────

class TestSearchSorting:

    def test_search_returns_highest_score_first(self, rag_client):
        for score in [7.0, 9.5, 8.0, 9.8]:
            case = RAGCase(
                chain_id=f"case-{score}",
                quality_score=score,
                case_type="positive",
            )
            rag_client.upsert(case)

        results = rag_client.search(agent_name="", limit=4)
        scores = [r.quality_score for r in results]
        assert scores == sorted(scores, reverse=True)
        assert scores[0] == 9.8

    def test_search_respects_limit(self, rag_client):
        for i in range(10):
            rag_client.upsert(RAGCase(
                chain_id=f"c-{i}", quality_score=float(i), case_type="positive",
            ))

        results = rag_client.search(agent_name="", limit=3)
        assert len(results) == 3


# ── T7-3: Search with filters ───────────────────────────────────────

class TestSearchFilters:

    def test_genre_filter(self, rag_client):
        rag_client.upsert(RAGCase(
            chain_id="rom-1", quality_score=9.0,
            case_type="positive", genre="romance",
        ))
        rag_client.upsert(RAGCase(
            chain_id="act-1", quality_score=9.5,
            case_type="positive", genre="action",
        ))

        results = rag_client.search(agent_name="", genre="romance")
        assert len(results) == 1
        assert results[0].chain_id == "rom-1"

    def test_scene_type_filter(self, rag_client):
        rag_client.upsert(RAGCase(
            chain_id="dia-1", quality_score=9.0,
            case_type="positive", scene_type="dialogue",
        ))
        rag_client.upsert(RAGCase(
            chain_id="act-1", quality_score=9.5,
            case_type="positive", scene_type="action_scene",
        ))

        results = rag_client.search(agent_name="", scene_type="dialogue")
        assert len(results) == 1
        assert results[0].chain_id == "dia-1"

    def test_none_genre_case_matches_any_genre_filter(self, rag_client):
        """Cases with genre=None should appear in filtered results."""
        rag_client.upsert(RAGCase(
            chain_id="generic-1", quality_score=9.0,
            case_type="positive", genre=None,
        ))

        results = rag_client.search(agent_name="", genre="romance")
        assert len(results) == 1


# ── T7-4: Positive case ingestion ───────────────────────────────────

class TestPositiveIngestion:

    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_high_score_ingested(self, mock_get_client, mock_pg):
        from backend.agents.dispatch.rag_ingestion import ingest_positive_from_qc

        client = MockRagClient()
        mock_get_client.return_value = client

        result = ingest_positive_from_qc(
            shot_id="shot-001",
            quality_score=9.5,
            genre="romance",
            scene_type="dialogue",
            project_id="proj-1",
            episode_id="ep-1",
        )

        assert result.success is True
        assert result.qdrant_written is True
        assert client.count() == 1

    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_low_score_rejected(self, mock_get_client, mock_pg):
        from backend.agents.dispatch.rag_ingestion import ingest_positive_from_qc

        client = MockRagClient()
        mock_get_client.return_value = client

        result = ingest_positive_from_qc(
            shot_id="shot-002",
            quality_score=7.0,  # below 9.0 threshold
        )

        assert result.success is False
        assert "below threshold" in (result.error or "")
        assert client.count() == 0


# ── T7-5: Negative case ingestion ───────────────────────────────────

class TestNegativeIngestion:

    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_negative_case_stored(self, mock_get_client, mock_pg):
        from backend.agents.dispatch.rag_ingestion import ingest_negative

        client = MockRagClient()
        mock_get_client.return_value = client

        result = ingest_negative(
            shot_id="shot-bad-001",
            issue_description="Face deformation artifact",
            severity="major",
            genre="action",
        )

        assert result.success is True
        assert client.count() == 1

        # Verify stored case metadata
        cases = client.search(agent_name="")
        assert cases[0].case_type == "negative"
        assert cases[0].quality_score == 0.0


# ── T7-6: Corrective case ingestion ─────────────────────────────────

class TestCorrectiveIngestion:

    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_corrective_case_stores_before_after(self, mock_get_client, mock_pg):
        from backend.agents.dispatch.rag_ingestion import ingest_corrective

        client = MockRagClient()
        mock_get_client.return_value = client

        result = ingest_corrective(
            shot_id="shot-fixed-001",
            before_assets={"image_url": "before.png", "score": 5.0},
            after_assets={"image_url": "after.png", "score": 9.2},
            quality_before=5.0,
            quality_after=9.2,
            correction_description="Fixed face deformation",
            genre="romance",
        )

        assert result.success is True
        cases = client.search(agent_name="")
        assert len(cases) == 1
        assert cases[0].case_type == "corrective"
        assert cases[0].quality_score == 9.2
        payload = cases[0].payload
        assert "before" in payload.get("chain_assets", payload)
        assert "after" in payload.get("chain_assets", payload)


# ── T7-7: search_cases with post-filtering ───────────────────────────

class TestSearchCases:

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_search_by_case_type(self, mock_get_client):
        from backend.agents.dispatch.rag_ingestion import search_cases

        client = MockRagClient()
        mock_get_client.return_value = client

        client.upsert(RAGCase(
            chain_id="pos-1", quality_score=9.5,
            case_type="positive", genre="romance",
        ))
        client.upsert(RAGCase(
            chain_id="neg-1", quality_score=0.0,
            case_type="negative", genre="romance",
        ))

        results = search_cases(genre="romance", case_type="positive")
        assert len(results) == 1
        assert results[0]["case_type"] == "positive"

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_search_with_min_score(self, mock_get_client):
        from backend.agents.dispatch.rag_ingestion import search_cases

        client = MockRagClient()
        mock_get_client.return_value = client

        client.upsert(RAGCase(chain_id="low", quality_score=5.0, case_type="positive"))
        client.upsert(RAGCase(chain_id="high", quality_score=9.8, case_type="positive"))

        results = search_cases(min_score=9.0)
        assert len(results) == 1
        assert results[0]["chain_id"] == "high"

    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_search_counter_examples(self, mock_get_client):
        from backend.agents.dispatch.rag_ingestion import search_counter_examples

        client = MockRagClient()
        mock_get_client.return_value = client

        client.upsert(RAGCase(
            chain_id="neg-1", quality_score=0.0,
            case_type="negative", genre="romance",
        ))
        client.upsert(RAGCase(
            chain_id="pos-1", quality_score=9.5,
            case_type="positive", genre="romance",
        ))

        results = search_counter_examples(genre="romance")
        assert len(results) == 1
        assert results[0]["case_type"] == "negative"


# ── T7-8: Full pipeline: ingest → search → verify ───────────────────

class TestIngestSearchPipeline:

    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_full_pipeline_positive(self, mock_get_client, mock_pg):
        from backend.agents.dispatch.rag_ingestion import (
            ingest_positive_from_qc,
            search_cases,
        )

        client = MockRagClient()
        mock_get_client.return_value = client

        # 1. Ingest a high-quality case
        ingest_result = ingest_positive_from_qc(
            shot_id="shot-pipeline-001",
            quality_score=9.7,
            genre="suspense",
            scene_type="chase",
            description="High quality chase scene with smooth motion",
        )
        assert ingest_result.success

        # 2. Search and verify it's retrievable
        found = search_cases(genre="suspense", scene_type="chase", case_type="positive")
        assert len(found) == 1
        assert found[0]["quality_score"] == 9.7
        assert found[0]["genre"] == "suspense"

    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_full_pipeline_mixed_cases(self, mock_get_client, mock_pg):
        from backend.agents.dispatch.rag_ingestion import (
            ingest_corrective,
            ingest_negative,
            ingest_positive_from_qc,
            search_cases,
            search_corrective_examples,
            search_counter_examples,
        )

        client = MockRagClient()
        mock_get_client.return_value = client

        # Ingest one of each type
        r1 = ingest_positive_from_qc(
            shot_id="s1", quality_score=9.5, genre="romance",
        )
        r2 = ingest_negative(
            shot_id="s2", issue_description="bad face", genre="romance",
        )
        r3 = ingest_corrective(
            shot_id="s3",
            before_assets={"v": "bad.mp4"},
            after_assets={"v": "good.mp4"},
            quality_before=4.0, quality_after=9.0,
            genre="romance",
        )
        assert r1.success and r2.success and r3.success
        assert client.count() == 3

        # Search by case_type
        positives = search_cases(case_type="positive", genre="romance")
        assert len(positives) == 1

        negatives = search_counter_examples(genre="romance")
        assert len(negatives) == 1

        correctives = search_corrective_examples(genre="romance")
        assert len(correctives) == 1

    @patch("backend.agents.dispatch.rag_ingestion._upsert_pg_index", return_value=True)
    @patch("backend.agents.dispatch.rag_ingestion.get_rag_client")
    def test_chain_id_deterministic(self, mock_get_client, mock_pg):
        """Same shot + case_type should produce same chain_id (idempotent upsert)."""
        from backend.agents.dispatch.rag_ingestion import generate_chain_id

        cid1 = generate_chain_id("proj-1", "ep-1", "shot-1", "positive")
        cid2 = generate_chain_id("proj-1", "ep-1", "shot-1", "positive")
        cid3 = generate_chain_id("proj-1", "ep-1", "shot-1", "negative")

        assert cid1 == cid2
        assert cid1 != cid3
