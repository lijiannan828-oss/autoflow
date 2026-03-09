"""Unit tests for context envelope builders."""

from backend.orchestrator.graph.context import (
    build_node_input_envelope,
    build_node_output_envelope,
)
from backend.orchestrator.graph.state import NodeOutputRef


class TestEnvelopeBuilders:
    def test_input_envelope(self, make_state):
        state = make_state(run_id="run-001", episode_id="ep-001")
        state["node_outputs"]["N01"] = NodeOutputRef(
            output_ref="tos://test/N01/out.json", scope="episode"
        )
        inp = build_node_input_envelope("N02", state, payload={"episode_index": 1})
        assert inp["node_id"] == "N02"
        assert inp["episode_id"] == "ep-001"
        assert inp["payload"] == {"episode_index": 1}
        assert len(inp["artifact_inputs"]) == 1

    def test_output_envelope(self, make_state):
        state = make_state(run_id="run-001", episode_id="ep-001")
        out = build_node_output_envelope(
            "N02", state,
            payload={"episode_script": {}},
            cost_cny=0.5, quality_score=8.5,
        )
        assert out["node_id"] == "N02"
        assert out["status"] == "succeeded"
        assert out["metrics"]["cost_cny"] == 0.5
        assert out["metrics"]["quality_score"] == 8.5
