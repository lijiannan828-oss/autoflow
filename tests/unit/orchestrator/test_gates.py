"""Unit tests for gate enter/resume nodes."""

import pytest

from backend.orchestrator.graph.gates import make_gate_enter_node, make_gate_resume_node
from backend.orchestrator.graph.state import GateScopeItem, GateState, make_initial_state


class TestGateEnter:
    def test_n08_asset_scope(self, make_state):
        state = make_state()
        gate_enter = make_gate_enter_node("N08")
        update = gate_enter(state)
        gate = update["gate"]
        assert gate["gate_node_id"] == "N08"
        assert gate["stage_no"] == 1
        assert gate["scope"] == "asset"
        assert gate["decision"] is None

    def test_n18_shot_scope(self, make_state):
        state = make_state()
        gate_enter = make_gate_enter_node("N18")
        update = gate_enter(state)
        assert update["gate"]["scope"] == "shot"

    def test_n24_serial_creates_step1_only(self, make_state):
        state = make_state()
        gate_enter = make_gate_enter_node("N24")
        update = gate_enter(state)
        gate = update["gate"]
        assert gate["total_steps"] == 3
        assert gate["current_step_no"] == 1
        assert len(gate["review_task_ids"]) == 1


class TestGateResume:
    def test_n24_step_advance(self, make_state):
        state = make_state()
        gate_enter = make_gate_enter_node("N24")
        enter_update = gate_enter(state)
        state["gate"] = enter_update["gate"]
        state["gate"]["decision"] = "approved"

        gate_resume = make_gate_resume_node("N24")
        resume_update = gate_resume(state)
        gate = resume_update["gate"]
        assert gate["current_step_no"] == 2
        assert 1 in gate["steps_completed"]
        assert gate["decision"] is None

    def test_scope_item_guard_demotes(self, make_state):
        state = make_state()
        state["gate"] = GateState(
            gate_node_id="N08", stage_no=1, scope="asset",
            scope_items=[
                GateScopeItem(scope_id="char_001", status="approved"),
                GateScopeItem(scope_id="char_002", status="pending"),
            ],
            review_task_ids=["t1", "t2"],
            decision="approved",
            current_step_no=1, total_steps=1, steps_completed=[],
        )
        gate_resume = make_gate_resume_node("N08")
        update = gate_resume(state)
        assert update["gate"]["decision"] == "partial_approved"
