"""Unit tests for backend.common.agent_memory."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest


# We patch all DB functions at module level so no real PG is needed.
_DB_MODULE = "backend.common.agent_memory"


class TestUpsertMemory:
    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_insert_new_memory(self, mock_exec):
        from backend.common.agent_memory import upsert_memory

        fake_row = {
            "id": "mem-001",
            "agent_name": "script_writer",
            "content_key": "best_practice_1",
            "content_value": {"tip": "use short sentences"},
            "scope": "project",
            "confidence": 0.7,
        }
        mock_exec.return_value = fake_row

        result = upsert_memory(
            "script_writer", "best_practice_1",
            {"tip": "use short sentences"},
            confidence=0.7,
        )
        assert result["id"] == "mem-001"
        assert result["agent_name"] == "script_writer"
        mock_exec.assert_called_once()

    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_update_existing_on_conflict(self, mock_exec):
        """When INSERT returns None (conflict), it tries UPDATE."""
        from backend.common.agent_memory import upsert_memory

        updated_row = {"id": "mem-001", "confidence": 0.9}
        # First call (INSERT) returns None, second call (UPDATE) returns row
        mock_exec.side_effect = [None, updated_row]

        result = upsert_memory(
            "script_writer", "key1", {"v": 1}, confidence=0.9,
        )
        assert result["confidence"] == 0.9
        assert mock_exec.call_count == 2


class TestGetMemory:
    @patch(f"{_DB_MODULE}.fetch_one")
    def test_get_by_id(self, mock_fetch):
        from backend.common.agent_memory import get_memory

        mock_fetch.return_value = {"id": "mem-001", "content_key": "k1"}
        result = get_memory("mem-001")
        assert result["id"] == "mem-001"

    @patch(f"{_DB_MODULE}.fetch_one")
    def test_get_returns_none(self, mock_fetch):
        from backend.common.agent_memory import get_memory

        mock_fetch.return_value = None
        assert get_memory("nonexistent") is None


class TestGetMemoryByKey:
    @patch(f"{_DB_MODULE}.fetch_one")
    def test_with_scope_id(self, mock_fetch):
        from backend.common.agent_memory import get_memory_by_key

        mock_fetch.return_value = {"content_key": "k1", "scope_id": "ep-1"}
        result = get_memory_by_key("agent1", "k1", scope="episode", scope_id="ep-1")
        assert result is not None

    @patch(f"{_DB_MODULE}.fetch_one")
    def test_without_scope_id(self, mock_fetch):
        from backend.common.agent_memory import get_memory_by_key

        mock_fetch.return_value = {"content_key": "k1", "scope_id": None}
        result = get_memory_by_key("agent1", "k1", scope="project")
        assert result is not None


class TestListMemories:
    @patch(f"{_DB_MODULE}.fetch_all")
    def test_basic_list(self, mock_fetch):
        from backend.common.agent_memory import list_memories

        mock_fetch.return_value = [{"id": "1"}, {"id": "2"}]
        result = list_memories("agent1")
        assert len(result) == 2

    @patch(f"{_DB_MODULE}.fetch_all")
    def test_with_filters(self, mock_fetch):
        from backend.common.agent_memory import list_memories

        mock_fetch.return_value = [{"id": "1"}]
        result = list_memories(
            "agent1", scope="episode", memory_type="lesson_learned", min_confidence=0.5,
        )
        assert len(result) == 1
        # Verify the query includes filter conditions
        query = mock_fetch.call_args[0][0]
        assert "scope = %s" in query
        assert "memory_type = %s" in query
        assert "confidence >= %s" in query


class TestCountMemories:
    @patch(f"{_DB_MODULE}.fetch_value")
    def test_count_all(self, mock_fetch):
        from backend.common.agent_memory import count_memories

        mock_fetch.return_value = 42
        assert count_memories("agent1") == 42

    @patch(f"{_DB_MODULE}.fetch_value")
    def test_count_with_scope(self, mock_fetch):
        from backend.common.agent_memory import count_memories

        mock_fetch.return_value = 10
        assert count_memories("agent1", scope="project") == 10
        query = mock_fetch.call_args[0][0]
        assert "scope = %s" in query

    @patch(f"{_DB_MODULE}.fetch_value")
    def test_count_returns_zero_on_none(self, mock_fetch):
        from backend.common.agent_memory import count_memories

        mock_fetch.return_value = None
        assert count_memories("agent1") == 0


class TestUpdateMemory:
    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_update_value_and_confidence(self, mock_exec):
        from backend.common.agent_memory import update_memory

        mock_exec.return_value = {"id": "mem-1", "confidence": 0.9}
        result = update_memory("mem-1", content_value={"v": 2}, confidence=0.9)
        assert result["confidence"] == 0.9
        query = mock_exec.call_args[0][0]
        assert "content_value" in query
        assert "confidence" in query

    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_update_only_confidence(self, mock_exec):
        from backend.common.agent_memory import update_memory

        mock_exec.return_value = {"id": "mem-1"}
        update_memory("mem-1", confidence=0.3)
        query = mock_exec.call_args[0][0]
        assert "confidence = %s" in query


class TestTouchMemory:
    @patch(f"{_DB_MODULE}.execute")
    def test_increments_access(self, mock_exec):
        from backend.common.agent_memory import touch_memory

        touch_memory("mem-1")
        mock_exec.assert_called_once()
        query = mock_exec.call_args[0][0]
        assert "access_count = access_count + 1" in query


class TestDeleteMemory:
    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_delete_existing(self, mock_exec):
        from backend.common.agent_memory import delete_memory

        mock_exec.return_value = {"id": "mem-1"}
        assert delete_memory("mem-1") is True

    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_delete_nonexistent(self, mock_exec):
        from backend.common.agent_memory import delete_memory

        mock_exec.return_value = None
        assert delete_memory("no-such-id") is False


class TestCleanupStaleMemories:
    @patch(f"{_DB_MODULE}.fetch_value")
    def test_decay_and_delete(self, mock_fetch):
        from backend.common.agent_memory import cleanup_stale_memories

        # First call: decay count, second call: delete count
        mock_fetch.side_effect = [5, 2]
        result = cleanup_stale_memories(stale_days=30, decay_factor=0.8, min_confidence=0.1)
        assert result == {"decayed": 5, "deleted": 2}

    @patch(f"{_DB_MODULE}.fetch_value")
    def test_cleanup_none_results(self, mock_fetch):
        from backend.common.agent_memory import cleanup_stale_memories

        mock_fetch.side_effect = [None, None]
        result = cleanup_stale_memories()
        assert result == {"decayed": 0, "deleted": 0}
