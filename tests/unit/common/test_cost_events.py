"""Unit tests for backend.common.cost_events."""

from __future__ import annotations

from unittest.mock import patch

import pytest

_DB_MODULE = "backend.common.cost_events"


class TestRecordCostEvent:
    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_creates_event(self, mock_exec):
        from backend.common.cost_events import record_cost_event, COST_LLM

        fake_row = {
            "id": "evt-1",
            "cost_type": "llm_call",
            "amount_cny": 0.05,
            "run_id": "run-1",
            "node_id": "N01",
        }
        mock_exec.return_value = fake_row

        result = record_cost_event(
            COST_LLM, 0.05, run_id="run-1", node_id="N01",
            agent_name="script_writer",
            details={"model": "gpt-4o", "tokens": 1000},
        )
        assert result["cost_type"] == "llm_call"
        assert result["amount_cny"] == 0.05
        mock_exec.assert_called_once()

    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_returns_empty_on_none(self, mock_exec):
        from backend.common.cost_events import record_cost_event

        mock_exec.return_value = None
        result = record_cost_event("llm_call", 0.01)
        assert result == {}

    @patch(f"{_DB_MODULE}.execute_returning_one")
    def test_optional_fields(self, mock_exec):
        from backend.common.cost_events import record_cost_event

        mock_exec.return_value = {"id": "evt-2"}
        result = record_cost_event("gpu_render", 1.5)
        assert result["id"] == "evt-2"


class TestGetRunCost:
    @patch(f"{_DB_MODULE}.fetch_all")
    def test_aggregates_by_type(self, mock_fetch):
        from backend.common.cost_events import get_run_cost

        mock_fetch.return_value = [
            {"cost_type": "llm_call", "total": 2.5, "event_count": 10},
            {"cost_type": "gpu_render", "total": 5.0, "event_count": 3},
        ]
        result = get_run_cost("run-1")
        assert result["run_id"] == "run-1"
        assert result["total_cny"] == 7.5
        assert len(result["breakdown"]) == 2

    @patch(f"{_DB_MODULE}.fetch_all")
    def test_empty_run(self, mock_fetch):
        from backend.common.cost_events import get_run_cost

        mock_fetch.return_value = []
        result = get_run_cost("empty-run")
        assert result["total_cny"] == 0
        assert result["breakdown"] == []


class TestCheckBudget:
    @patch(f"{_DB_MODULE}.fetch_all")
    def test_ok_status(self, mock_fetch):
        from backend.common.cost_events import check_budget, COST_BUDGET_PER_MIN

        # 50% utilization
        mock_fetch.return_value = [
            {"cost_type": "llm_call", "total": COST_BUDGET_PER_MIN * 0.5, "event_count": 5},
        ]
        result = check_budget("run-1", estimated_duration_min=1.0)
        assert result["status"] == "ok"
        assert result["utilization_pct"] == 50.0

    @patch(f"{_DB_MODULE}.fetch_all")
    def test_warning_at_70_pct(self, mock_fetch):
        from backend.common.cost_events import check_budget, COST_BUDGET_PER_MIN

        mock_fetch.return_value = [
            {"cost_type": "llm_call", "total": COST_BUDGET_PER_MIN * 0.75, "event_count": 5},
        ]
        result = check_budget("run-1", estimated_duration_min=1.0)
        assert result["status"] == "warning"

    @patch(f"{_DB_MODULE}.fetch_all")
    def test_critical_at_90_pct(self, mock_fetch):
        from backend.common.cost_events import check_budget, COST_BUDGET_PER_MIN

        mock_fetch.return_value = [
            {"cost_type": "llm_call", "total": COST_BUDGET_PER_MIN * 0.95, "event_count": 5},
        ]
        result = check_budget("run-1", estimated_duration_min=1.0)
        assert result["status"] == "critical"

    @patch(f"{_DB_MODULE}.fetch_all")
    def test_multi_minute_budget(self, mock_fetch):
        from backend.common.cost_events import check_budget, COST_BUDGET_PER_MIN

        # 2 minutes -> budget = 60 CNY, spending 45 = 75% -> warning
        mock_fetch.return_value = [
            {"cost_type": "llm_call", "total": 45.0, "event_count": 20},
        ]
        result = check_budget("run-1", estimated_duration_min=2.0)
        assert result["budget_cny"] == COST_BUDGET_PER_MIN * 2
        assert result["status"] == "warning"

    @patch(f"{_DB_MODULE}.fetch_all")
    def test_remaining_calculation(self, mock_fetch):
        from backend.common.cost_events import check_budget, COST_BUDGET_PER_MIN

        spent = 10.0
        mock_fetch.return_value = [
            {"cost_type": "llm_call", "total": spent, "event_count": 5},
        ]
        result = check_budget("run-1", estimated_duration_min=1.0)
        assert abs(result["remaining_cny"] - (COST_BUDGET_PER_MIN - spent)) < 0.01


class TestCostTypeConstants:
    def test_constants_defined(self):
        from backend.common.cost_events import (
            COST_LLM, COST_GPU, COST_AUDIO, COST_STORAGE, COST_EMBEDDING,
        )
        assert COST_LLM == "llm_call"
        assert COST_GPU == "gpu_render"
        assert COST_AUDIO == "audio_gen"
        assert COST_STORAGE == "storage"
        assert COST_EMBEDDING == "embedding"
