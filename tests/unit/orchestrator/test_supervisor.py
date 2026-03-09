"""Unit tests for supervisor node routing logic."""

import pytest

from backend.orchestrator.graph.state import GateState, NodeResult, make_initial_state
from backend.orchestrator.graph.supervisor import supervisor_node
from backend.orchestrator.graph.topology import MAX_AUTO_REJECTS


class TestSupervisorDispatch:
    def test_first_dispatch(self, make_state):
        state = make_state()
        update = supervisor_node(state)
        assert update["next_node_id"] == "N01"
        assert update["current_stage_no"] == 1

    def test_advance_after_success(self, make_state):
        state = make_state()
        state["last_result"] = NodeResult(
            node_id="N01", status="succeeded",
            output_ref="tos://test/N01/out.json",
            artifact_ids=[], cost_cny=0.1, gpu_seconds=0.0, duration_s=5.0,
        )
        state["completed_nodes"] = []
        update = supervisor_node(state)
        assert update["next_node_id"] == "N02"
        assert "N01" in update["completed_nodes"]


class TestSupervisorQCReject:
    def test_qc_reject_routes_back(self, make_state):
        state = make_state()
        state["last_result"] = NodeResult(
            node_id="N03", status="auto_rejected", quality_score=6.5,
            artifact_ids=[], cost_cny=0.0, gpu_seconds=0.0, duration_s=3.0,
        )
        state["auto_reject_counts"] = {}
        update = supervisor_node(state)
        assert update["next_node_id"] == "N02"
        assert update["auto_reject_counts"]["N02"] == 1

    def test_qc_reject_exceed_continues(self, make_state):
        state = make_state()
        state["last_result"] = NodeResult(
            node_id="N03", status="auto_rejected", quality_score=5.0,
            artifact_ids=[], cost_cny=0.0, gpu_seconds=0.0, duration_s=2.0,
        )
        state["auto_reject_counts"] = {"N02": MAX_AUTO_REJECTS}
        update = supervisor_node(state)
        assert not update.get("should_terminate")
        assert update["next_node_id"] == "N04"
        assert len(update.get("warnings", [])) > 0


class TestSupervisorRerun:
    def test_rerun_skip_to_target(self, make_state):
        state = make_state(is_rerun=True, rerun_node_ids=["N14", "N15", "N16", "N17"])
        update = supervisor_node(state)
        assert update["next_node_id"] == "N14"


class TestSupervisorGate:
    def test_partial_approved_repause(self, make_state):
        state = make_state()
        state["last_result"] = NodeResult(
            node_id="N08", status="succeeded",
            artifact_ids=[], cost_cny=0.0, gpu_seconds=0.0, duration_s=0.0,
        )
        state["gate"] = GateState(
            gate_node_id="N08", stage_no=1, scope="asset",
            decision="partial_approved",
        )
        update = supervisor_node(state)
        assert update["next_node_id"] == "gate_resume_N08"
        assert update["current_node_id"] == "N08"
