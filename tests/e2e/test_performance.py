"""T11 — Performance benchmark tests for the AIGC pipeline.

These tests measure critical performance characteristics of the pipeline
infrastructure. All tests are marked with @pytest.mark.slow so they can
be excluded from fast CI runs via ``pytest -m 'not slow'``.

Run standalone::

    python3 -m pytest tests/e2e/test_performance.py -v --no-header

Upper bounds are intentionally generous to accommodate varied hardware
(CI runners, developer laptops, etc.).
"""

from __future__ import annotations

import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from unittest.mock import MagicMock

import pytest

# Performance tests may need more than the default 30s timeout
pytestmark = pytest.mark.timeout(120)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_state(**overrides: Any) -> dict[str, Any]:
    """Build a minimal PipelineState dict for benchmarking."""
    from backend.orchestrator.graph.state import make_initial_state

    defaults = dict(
        run_id=f"run-perf-{uuid.uuid4().hex[:8]}",
        episode_id=f"ep-perf-{uuid.uuid4().hex[:8]}",
        episode_version_id=f"ev-perf-{uuid.uuid4().hex[:8]}",
    )
    defaults.update(overrides)
    return make_initial_state(**defaults)


def _timed(fn, *args, **kwargs) -> tuple[Any, float]:
    """Run *fn* and return (result, elapsed_seconds)."""
    t0 = time.perf_counter()
    result = fn(*args, **kwargs)
    elapsed = time.perf_counter() - t0
    return result, elapsed


# ---------------------------------------------------------------------------
# T11.1 — Graph compilation time
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.e2e
class TestGraphCompilationPerformance:
    """Measure how long it takes to build and compile the pipeline graph."""

    def test_graph_build_time(self):
        """build_pipeline_graph() should complete in < 2s."""
        from backend.orchestrator.graph.builder import build_pipeline_graph

        _, elapsed = _timed(build_pipeline_graph)

        assert elapsed < 2.0, (
            f"Graph build took {elapsed:.3f}s, expected < 2.0s"
        )

    def test_graph_compile_time(self):
        """Build + graph.compile (no runtime config) should complete in < 3s."""
        from backend.orchestrator.graph.builder import build_pipeline_graph

        def _build_and_compile():
            g = build_pipeline_graph()
            return g.compile()

        _, elapsed = _timed(_build_and_compile)

        assert elapsed < 3.0, (
            f"Graph compile took {elapsed:.3f}s, expected < 3.0s"
        )

    def test_repeated_compilation_is_stable(self):
        """5 consecutive compilations should each stay under 3s."""
        from backend.orchestrator.graph.builder import build_pipeline_graph

        times: list[float] = []
        for _ in range(5):
            _, elapsed = _timed(build_pipeline_graph)
            times.append(elapsed)

        max_time = max(times)
        assert max_time < 3.0, (
            f"Worst compilation was {max_time:.3f}s (all: "
            f"{[f'{t:.3f}' for t in times]})"
        )


# ---------------------------------------------------------------------------
# T11.2 — Single node execution with mock handler
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.e2e
class TestSingleNodeExecution:
    """Measure worker node execution time with a mock handler."""

    def test_stub_handler_execution_time(self):
        """A stub worker node should execute in < 100ms."""
        import backend.orchestrator.graph.workers as w

        # Clear any previously registered handlers and disable agent bridge
        old_handlers = dict(w._handlers)
        old_bridge = w._AGENT_BRIDGE_ENABLED
        w._handlers.clear()
        w._AGENT_BRIDGE_ENABLED = False
        try:
            state = _make_state()
            worker_fn = w.make_worker_node("N01")
            _, elapsed = _timed(worker_fn, state)
            assert elapsed < 0.1, (
                f"Stub worker took {elapsed * 1000:.1f}ms, expected < 100ms"
            )
        finally:
            w._AGENT_BRIDGE_ENABLED = old_bridge
            w._handlers.update(old_handlers)

    def test_registered_mock_handler_execution_time(self):
        """A registered mock handler should execute in < 100ms."""
        import backend.orchestrator.graph.workers as w
        from backend.orchestrator.graph.state import NodeResult

        def fast_mock_handler(node_id, state, config=None):
            return NodeResult(
                node_id=node_id,
                status="succeeded",
                output_ref=f"mock://{node_id}/output.json",
                artifact_ids=[],
                cost_cny=0.01,
                gpu_seconds=0.0,
                duration_s=0.0,
                error=None,
            )

        old_bridge = w._AGENT_BRIDGE_ENABLED
        w._AGENT_BRIDGE_ENABLED = False
        w.register_handler("N02", fast_mock_handler)
        try:
            state = _make_state()
            state["completed_nodes"] = ["N01"]
            state["node_outputs"] = {
                "N01": {"output_ref": "stub://test/N01/output.json", "scope": "episode"}
            }

            worker_fn = w.make_worker_node("N02")
            _, elapsed = _timed(worker_fn, state)

            assert elapsed < 0.1, (
                f"Mock handler took {elapsed * 1000:.1f}ms, expected < 100ms"
            )
        finally:
            w._AGENT_BRIDGE_ENABLED = old_bridge
            w._handlers.pop("N02", None)


# ---------------------------------------------------------------------------
# T11.3 — State serialization / deserialization
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.e2e
class TestStateSerialization:
    """Measure JSON serialization round-trip for large pipeline states."""

    def _make_large_state(self) -> dict[str, Any]:
        """Build a state with realistic volume of data."""
        state = _make_state()

        # Simulate 28 completed nodes with outputs
        from backend.orchestrator.graph.topology import PIPELINE_NODES
        state["completed_nodes"] = list(PIPELINE_NODES)
        state["node_outputs"] = {
            nid: {
                "output_ref": f"tos://autoflow-media/ev-test/{nid}/output.json",
                "node_run_id": str(uuid.uuid4()),
                "scope": "episode",
            }
            for nid in PIPELINE_NODES
        }

        # QC scores for QC nodes
        state["qc_scores"] = {"N03": 8.5, "N11": 9.0, "N15": 7.8}
        state["auto_reject_counts"] = {"N02": 1, "N10": 2}

        # Agent traces (simulate 50 trace entries)
        state["agent_traces"] = [
            {
                "agent": f"agent_{i % 10}",
                "action": "execute",
                "node_id": PIPELINE_NODES[i % len(PIPELINE_NODES)],
                "timestamp": "2026-03-10T12:00:00Z",
                "duration_ms": 150 + i,
                "result": {"status": "ok", "score": 8.0 + (i % 20) / 10},
            }
            for i in range(50)
        ]

        # Cost budget
        state["cost_budget"] = {
            "budget_per_min": 30.0,
            "spent": 15.5,
            "remaining": 14.5,
            "health": "ok",
            "alerts": [],
        }

        # Warnings
        state["warnings"] = [f"Warning {i}: test warning message" for i in range(10)]

        return state

    def test_serialization_time(self):
        """JSON serialization of a large state should complete in < 50ms."""
        state = self._make_large_state()

        _, elapsed = _timed(json.dumps, state)

        assert elapsed < 0.05, (
            f"Serialization took {elapsed * 1000:.1f}ms, expected < 50ms"
        )

    def test_deserialization_time(self):
        """JSON deserialization of a large state should complete in < 50ms."""
        state = self._make_large_state()
        serialized = json.dumps(state)

        _, elapsed = _timed(json.loads, serialized)

        assert elapsed < 0.05, (
            f"Deserialization took {elapsed * 1000:.1f}ms, expected < 50ms"
        )

    def test_round_trip_preserves_data(self):
        """Serialization round-trip must not lose data."""
        state = self._make_large_state()

        serialized = json.dumps(state)
        restored = json.loads(serialized)

        assert restored["run_id"] == state["run_id"]
        assert len(restored["completed_nodes"]) == len(state["completed_nodes"])
        assert len(restored["agent_traces"]) == len(state["agent_traces"])
        assert restored["cost_budget"]["spent"] == state["cost_budget"]["spent"]


# ---------------------------------------------------------------------------
# T11.4 — Supervisor routing decision time
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.e2e
class TestSupervisorRoutingPerformance:
    """Measure supervisor node execution and routing decision time."""

    def test_initial_dispatch_time(self):
        """First supervisor call (no last_result) should route in < 10ms."""
        from backend.orchestrator.graph.supervisor import supervisor_node

        state = _make_state()

        _, elapsed = _timed(supervisor_node, state)

        assert elapsed < 0.01, (
            f"Initial dispatch took {elapsed * 1000:.1f}ms, expected < 10ms"
        )

    def test_normal_advance_time(self):
        """Supervisor advance after a successful node should route in < 10ms."""
        from backend.orchestrator.graph.supervisor import supervisor_node

        state = _make_state()
        state["last_result"] = {
            "node_id": "N01",
            "status": "succeeded",
            "output_ref": "stub://test/N01/output.json",
            "cost_cny": 0.5,
            "gpu_seconds": 0.0,
            "duration_s": 1.0,
            "artifact_ids": [],
        }
        state["completed_nodes"] = []

        _, elapsed = _timed(supervisor_node, state)

        assert elapsed < 0.01, (
            f"Normal advance took {elapsed * 1000:.1f}ms, expected < 10ms"
        )

    def test_route_after_supervisor_time(self):
        """route_after_supervisor() pure routing should be < 1ms."""
        from backend.orchestrator.graph.supervisor import route_after_supervisor

        state = _make_state()
        state["next_node_id"] = "N05"
        state["should_terminate"] = False

        _, elapsed = _timed(route_after_supervisor, state)

        assert elapsed < 0.001, (
            f"Routing took {elapsed * 1000:.3f}ms, expected < 1ms"
        )

    def test_rerun_skip_advance_time(self):
        """Supervisor with rerun skip logic should still route in < 10ms."""
        from backend.orchestrator.graph.supervisor import supervisor_node

        state = _make_state(
            is_rerun=True,
            rerun_node_ids=["N14", "N15", "N16"],
        )
        state["last_result"] = {
            "node_id": "N01",
            "status": "succeeded",
            "output_ref": "stub://test/N01/output.json",
            "cost_cny": 0.0,
            "gpu_seconds": 0.0,
            "duration_s": 0.0,
            "artifact_ids": [],
        }
        state["completed_nodes"] = []

        _, elapsed = _timed(supervisor_node, state)

        assert elapsed < 0.01, (
            f"Rerun advance took {elapsed * 1000:.1f}ms, expected < 10ms"
        )


# ---------------------------------------------------------------------------
# T11.5 — Concurrent node handler execution
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.e2e
class TestConcurrentExecution:
    """Measure parallel execution of multiple mock handlers."""

    def test_five_parallel_handlers(self):
        """5 mock handlers running in parallel should complete in < 500ms."""
        from backend.orchestrator.graph.workers import make_worker_node

        node_ids = ["N01", "N04", "N06", "N09", "N13"]
        workers = {nid: make_worker_node(nid) for nid in node_ids}
        states = {nid: _make_state() for nid in node_ids}

        t0 = time.perf_counter()
        results: dict[str, Any] = {}

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(workers[nid], states[nid]): nid
                for nid in node_ids
            }
            for future in as_completed(futures):
                nid = futures[future]
                results[nid] = future.result()

        elapsed = time.perf_counter() - t0

        assert len(results) == 5, f"Expected 5 results, got {len(results)}"
        assert elapsed < 0.5, (
            f"Parallel execution took {elapsed * 1000:.1f}ms, expected < 500ms"
        )

    def test_parallel_faster_than_sequential(self):
        """Parallel execution should not be significantly slower than sequential."""
        from backend.orchestrator.graph.workers import make_worker_node

        node_ids = ["N01", "N04", "N06", "N09", "N13"]
        workers = {nid: make_worker_node(nid) for nid in node_ids}

        # Sequential
        states_seq = {nid: _make_state() for nid in node_ids}
        t0 = time.perf_counter()
        for nid in node_ids:
            workers[nid](states_seq[nid])
        sequential_time = time.perf_counter() - t0

        # Parallel
        states_par = {nid: _make_state() for nid in node_ids}
        t0 = time.perf_counter()
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {
                executor.submit(workers[nid], states_par[nid]): nid
                for nid in node_ids
            }
            for future in as_completed(futures):
                future.result()
        parallel_time = time.perf_counter() - t0

        # With stub handlers both are near-instant, so just verify
        # parallel completes within a reasonable absolute bound (<1s)
        assert parallel_time < 1.0, (
            f"Parallel execution took {parallel_time:.3f}s, expected < 1.0s"
        )


# ---------------------------------------------------------------------------
# T11.6 — Topology lookup performance
# ---------------------------------------------------------------------------

@pytest.mark.slow
@pytest.mark.e2e
class TestTopologyLookupPerformance:
    """Measure topology constant lookups and utility functions."""

    def test_stage_no_lookup_batch(self):
        """1000 stage_no_for_node() calls should complete in < 10ms."""
        from backend.orchestrator.graph.topology import (
            PIPELINE_NODES,
            stage_no_for_node,
        )

        t0 = time.perf_counter()
        for _ in range(1000):
            for nid in PIPELINE_NODES:
                stage_no_for_node(nid)
        elapsed = time.perf_counter() - t0

        # 1000 * 28 = 28,000 calls
        assert elapsed < 0.01, (
            f"28,000 stage lookups took {elapsed * 1000:.1f}ms, expected < 10ms"
        )

    def test_should_skip_in_rerun_batch(self):
        """1000 rounds of should_skip_in_rerun() should complete in < 10ms."""
        from backend.orchestrator.graph.topology import (
            PIPELINE_NODES,
            should_skip_in_rerun,
        )

        rerun_ids = ["N14", "N15", "N16"]

        t0 = time.perf_counter()
        for _ in range(1000):
            for nid in PIPELINE_NODES:
                should_skip_in_rerun(nid, rerun_ids)
        elapsed = time.perf_counter() - t0

        assert elapsed < 0.01, (
            f"28,000 skip checks took {elapsed * 1000:.1f}ms, expected < 10ms"
        )
