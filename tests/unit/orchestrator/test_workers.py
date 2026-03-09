"""Unit tests for worker node factory and execution."""

import pytest

from backend.orchestrator.graph.state import NodeOutputRef
from backend.orchestrator.graph.workers import _handlers, make_worker_node


@pytest.fixture(autouse=True)
def _clear_handler_registry():
    """Ensure stub handlers are used — clear any registered real handlers."""
    saved = dict(_handlers)
    _handlers.clear()
    yield
    _handlers.clear()
    _handlers.update(saved)


class TestWorkerStub:
    def test_worker_returns_succeeded(self, make_state):
        state = make_state()
        worker = make_worker_node("N01")
        update = worker(state)
        result = update["last_result"]
        assert result["node_id"] == "N01"
        assert result["status"] == "succeeded"

    def test_worker_outputs_contain_ref(self, make_state):
        state = make_state()
        worker = make_worker_node("N01")
        update = worker(state)
        out = update["node_outputs"]["N01"]
        assert isinstance(out, dict)
        assert "output_ref" in out

    def test_per_shot_scope(self, make_state):
        state = make_state()
        state["node_outputs"]["N06"] = NodeOutputRef(
            output_ref="stub://ev/N06/output.json", scope="episode"
        )
        state["node_outputs"]["N09"] = NodeOutputRef(
            output_ref="stub://ev/N09/output.json", scope="episode"
        )
        worker = make_worker_node("N10")
        update = worker(state)
        assert update["node_outputs"]["N10"]["scope"] == "per_shot"
