"""Unit tests for PipelineState creation and manipulation."""

import pytest


class TestStateCreation:
    def test_initial_state_defaults(self, make_state):
        state = make_state()
        assert state["completed_nodes"] == []
        assert state["should_terminate"] is False
        assert state["total_cost_cny"] == 0.0

    def test_initial_state_custom_ids(self, make_state):
        state = make_state(run_id="run-001", episode_id="ep-001")
        assert state["run_id"] == "run-001"
        assert state["episode_id"] == "ep-001"

    def test_rerun_state(self, make_state):
        state = make_state(
            is_rerun=True,
            rerun_node_ids=["N14", "N15"],
        )
        assert state["is_rerun"] is True
        assert state["rerun_node_ids"] == ["N14", "N15"]
