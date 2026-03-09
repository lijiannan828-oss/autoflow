"""Unit tests for backend.common.rag — MockRagClient."""

from __future__ import annotations

import pytest

from backend.common.rag import MockRagClient, RAGCase


@pytest.fixture
def client():
    return MockRagClient()


class TestUpsert:
    def test_upsert_returns_chain_id(self, client):
        case = RAGCase(chain_id="c-1", quality_score=0.9, case_type="positive")
        result = client.upsert(case)
        assert result == "c-1"

    def test_upsert_generates_id_when_empty(self, client):
        case = RAGCase(chain_id="", quality_score=0.5, case_type="negative")
        result = client.upsert(case)
        assert result != ""
        assert len(result) > 0

    def test_upsert_overwrites_same_chain_id(self, client):
        c1 = RAGCase(chain_id="c-1", quality_score=0.5, case_type="positive")
        c2 = RAGCase(chain_id="c-1", quality_score=0.9, case_type="corrective")
        client.upsert(c1)
        client.upsert(c2)
        assert client.count() == 1
        results = client.search("agent1")
        assert results[0].quality_score == 0.9


class TestSearch:
    def test_returns_sorted_by_quality(self, client):
        client.upsert(RAGCase(chain_id="low", quality_score=0.3, case_type="positive"))
        client.upsert(RAGCase(chain_id="high", quality_score=0.9, case_type="positive"))
        client.upsert(RAGCase(chain_id="mid", quality_score=0.6, case_type="positive"))

        results = client.search("agent1")
        scores = [r.quality_score for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_limit(self, client):
        for i in range(10):
            client.upsert(RAGCase(chain_id=f"c-{i}", quality_score=float(i), case_type="positive"))
        results = client.search("agent1", limit=3)
        assert len(results) == 3

    def test_filter_by_genre(self, client):
        client.upsert(RAGCase(chain_id="c1", quality_score=0.9, case_type="positive", genre="古装"))
        client.upsert(RAGCase(chain_id="c2", quality_score=0.8, case_type="positive", genre="现代"))
        client.upsert(RAGCase(chain_id="c3", quality_score=0.7, case_type="positive", genre=None))

        results = client.search("agent1", genre="古装")
        # Should match genre="古装" and genre=None (None matches any genre filter)
        chain_ids = {r.chain_id for r in results}
        assert "c1" in chain_ids
        assert "c3" in chain_ids  # None genre matches filter
        assert "c2" not in chain_ids

    def test_filter_by_scene_type(self, client):
        client.upsert(RAGCase(chain_id="c1", quality_score=0.9, case_type="positive", scene_type="对白"))
        client.upsert(RAGCase(chain_id="c2", quality_score=0.8, case_type="positive", scene_type="打斗"))

        results = client.search("agent1", scene_type="对白")
        chain_ids = {r.chain_id for r in results}
        assert "c1" in chain_ids
        assert "c2" not in chain_ids

    def test_empty_store(self, client):
        results = client.search("agent1")
        assert results == []


class TestDelete:
    def test_delete_existing(self, client):
        client.upsert(RAGCase(chain_id="c-1", quality_score=0.5, case_type="positive"))
        assert client.delete("c-1") is True
        assert client.count() == 0

    def test_delete_nonexistent(self, client):
        assert client.delete("no-such") is False


class TestCount:
    def test_count_empty(self, client):
        assert client.count() == 0

    def test_count_after_inserts(self, client):
        client.upsert(RAGCase(chain_id="c1", quality_score=0.5, case_type="positive"))
        client.upsert(RAGCase(chain_id="c2", quality_score=0.6, case_type="negative"))
        assert client.count() == 2


class TestHealth:
    def test_health_status(self, client):
        h = client.health()
        assert h["status"] == "ok"
        assert h["backend"] == "mock"
        assert "count" in h

    def test_health_count_reflects_store(self, client):
        client.upsert(RAGCase(chain_id="c1", quality_score=0.5, case_type="positive"))
        h = client.health()
        assert h["count"] == 1
