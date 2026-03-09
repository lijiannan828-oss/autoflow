"""T9 — Full pipeline E2E smoke tests (N01 -> N26).

Compile the full graph with InMemorySaver, run through all nodes,
verify interrupt behavior at gates, and check state accumulation.

Uses raw graph build (no handler registration) so workers use fast stubs.

Run with:
    python3 -m pytest tests/e2e/test_pipeline_smoke.py -v --tb=short
"""

from __future__ import annotations

import pytest

from langgraph.checkpoint.memory import MemorySaver

import backend.orchestrator.graph.workers as _workers_mod
from backend.orchestrator.graph.builder import build_pipeline_graph
from backend.orchestrator.graph.state import GateState, make_initial_state
from backend.orchestrator.graph.topology import (
    GATE_NODES,
    PIPELINE_NODES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_state(thread_id: str = "smoke-thread", **overrides):
    defaults = dict(
        run_id="run-smoke-001",
        episode_id="ep-smoke-001",
        episode_version_id="ev-smoke-001",
        langgraph_thread_id=thread_id,
    )
    defaults.update(overrides)
    return make_initial_state(**defaults)


def _compile_raw():
    """Build the graph directly (no configure_graph_runtime) so workers use
    fast stubs.  Disable agent bridge to avoid external calls."""
    _workers_mod._AGENT_BRIDGE_ENABLED = False
    try:
        graph = build_pipeline_graph()
        gate_resume_nodes = [f"gate_resume_{nid}" for nid in GATE_NODES]
        return graph.compile(
            checkpointer=MemorySaver(),
            interrupt_before=gate_resume_nodes,
        )
    finally:
        _workers_mod._AGENT_BRIDGE_ENABLED = True


def _run_until_interrupt(app, state, config):
    """Stream the graph until it pauses (interrupt or end). Return events."""
    events = []
    for event in app.stream(state, config=config):
        events.append(event)
    return events


def _inject_gate_approval(app, config, gate_node_id: str):
    """Inject an 'approved' decision for a gate."""
    gs = app.get_state(config)
    current_gate = gs.values.get("gate")
    if current_gate:
        updated_gate = dict(current_gate)
        updated_gate["decision"] = "approved"
        if updated_gate.get("scope_items"):
            updated_gate["scope_items"] = [
                {**item, "status": "approved"}
                for item in updated_gate["scope_items"]
            ]
        app.update_state(config, {"gate": updated_gate}, as_node=f"gate_resume_{gate_node_id}")
    else:
        app.update_state(config, {
            "gate": GateState(
                gate_node_id=gate_node_id,
                stage_no=1,
                scope="episode",
                scope_items=[],
                review_task_ids=[],
                decision="approved",
                current_step_no=1,
                total_steps=1,
                steps_completed=[1],
            ),
        }, as_node=f"gate_resume_{gate_node_id}")


def _inject_n24_serial_approval(app, config):
    """Inject approvals for all 3 steps of N24 serial gate."""
    for step in range(3):
        gs = app.get_state(config)
        if not gs.next:
            break
        current_gate = gs.values.get("gate")
        if current_gate:
            updated_gate = dict(current_gate)
            updated_gate["decision"] = "approved"
            app.update_state(config, {"gate": updated_gate}, as_node="gate_resume_N24")
        _run_until_interrupt(app, None, config)
        gs = app.get_state(config)
        if not gs.next:
            break


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestPipelineSmokeCompilation:
    """Verify graph compilation and basic structure."""

    def test_compile_succeeds(self):
        """Graph compiles without errors."""
        app = _compile_raw()
        assert app is not None

    @pytest.mark.timeout(20)
    def test_interrupt_before_all_gates(self):
        """Pipeline interrupts at gate_resume_N08 on first run."""
        app = _compile_raw()
        config = {"configurable": {"thread_id": "compile-check"}}
        state = _make_state("compile-check")
        _run_until_interrupt(app, state, config)
        gs = app.get_state(config)
        assert "gate_resume_N08" in list(gs.next), (
            f"expected interrupt at gate_resume_N08, got {list(gs.next)}"
        )


class TestPipelineFirstSegment:
    """N01 through N08 gate — the first segment of the pipeline."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.app = _compile_raw()
        self.config = {"configurable": {"thread_id": "smoke-seg1"}}
        self.state = _make_state("smoke-seg1")

    @pytest.mark.timeout(20)
    def test_runs_to_first_gate(self):
        """Pipeline executes N01-N07b and pauses at gate_resume_N08."""
        _run_until_interrupt(self.app, self.state, self.config)
        gs = self.app.get_state(self.config)
        assert list(gs.next) == ["gate_resume_N08"]

    @pytest.mark.timeout(20)
    def test_all_pre_gate_nodes_executed(self):
        """Nodes N01 through N07b should all have output refs."""
        _run_until_interrupt(self.app, self.state, self.config)
        gs = self.app.get_state(self.config)
        values = gs.values
        node_outputs = values.get("node_outputs", {})
        pre_gate_nodes = ["N01", "N02", "N03", "N04", "N05", "N06", "N07", "N07b"]
        for nid in pre_gate_nodes:
            assert nid in node_outputs, f"missing output for {nid}"
            assert node_outputs[nid].get("output_ref"), f"empty output_ref for {nid}"

    @pytest.mark.timeout(20)
    def test_current_node_is_n08(self):
        """After entering the gate, current_node_id should be N08."""
        _run_until_interrupt(self.app, self.state, self.config)
        gs = self.app.get_state(self.config)
        assert gs.values.get("current_node_id") == "N08"

    @pytest.mark.timeout(20)
    def test_gate_state_created(self):
        """GateState should be populated for N08."""
        _run_until_interrupt(self.app, self.state, self.config)
        gs = self.app.get_state(self.config)
        gate = gs.values.get("gate")
        assert gate is not None
        assert gate["gate_node_id"] == "N08"
        assert gate["stage_no"] == 1
        assert gate["scope"] == "asset"
        assert gate["decision"] is None

    @pytest.mark.timeout(20)
    def test_n07b_parallel_branch_executed(self):
        """N07b (voice samples) should execute alongside N07."""
        _run_until_interrupt(self.app, self.state, self.config)
        gs = self.app.get_state(self.config)
        node_outputs = gs.values.get("node_outputs", {})
        assert "N07b" in node_outputs, "N07b parallel branch should have executed"
        assert "N07" in node_outputs, "N07 should have executed"

    @pytest.mark.timeout(20)
    def test_execution_order_before_gate(self):
        """Events should follow the expected supervisor -> worker alternation."""
        events = _run_until_interrupt(self.app, self.state, self.config)
        # First event is supervisor, second is N01, etc.
        event_keys = [list(e.keys())[0] for e in events if "__interrupt__" not in e]
        # supervisor, N01, supervisor, N02, ... supervisor, gate_enter_N08
        worker_events = [k for k in event_keys if k != "supervisor"]
        expected_workers = ["N01", "N02", "N03", "N04", "N05", "N06", "N07", "N07b", "gate_enter_N08"]
        assert worker_events == expected_workers, (
            f"expected {expected_workers}, got {worker_events}"
        )


class TestPipelineGateContinuation:
    """After approving N08, pipeline should continue to N18."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.app = _compile_raw()
        self.config = {"configurable": {"thread_id": "smoke-gate-cont"}}
        self.state = _make_state("smoke-gate-cont")

    @pytest.mark.timeout(20)
    def test_continues_after_n08_approval(self):
        """After N08 approval, pipeline continues and pauses at N18."""
        _run_until_interrupt(self.app, self.state, self.config)
        gs = self.app.get_state(self.config)
        assert list(gs.next) == ["gate_resume_N08"]

        _inject_gate_approval(self.app, self.config, "N08")
        _run_until_interrupt(self.app, None, self.config)

        gs = self.app.get_state(self.config)
        assert list(gs.next) == ["gate_resume_N18"], (
            f"expected interrupt at gate_resume_N18, got {list(gs.next)}"
        )

    @pytest.mark.timeout(20)
    def test_n16b_serial_branch_executed(self):
        """N16b (tone/pacing) should execute between N16 and N17."""
        _run_until_interrupt(self.app, self.state, self.config)
        _inject_gate_approval(self.app, self.config, "N08")
        _run_until_interrupt(self.app, None, self.config)

        gs = self.app.get_state(self.config)
        node_outputs = gs.values.get("node_outputs", {})
        assert "N16b" in node_outputs, "N16b should have executed between N16 and N17"
        assert "N16" in node_outputs
        assert "N17" in node_outputs


class TestPipelineFullRun:
    """Full N01 -> N26 run with all gates approved."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.app = _compile_raw()
        self.config = {"configurable": {"thread_id": "smoke-full"}}
        self.state = _make_state("smoke-full")

    @pytest.mark.timeout(60)
    def test_full_pipeline_completes(self):
        """Pipeline runs to completion when all gates are approved."""
        # N01 -> N08 interrupt
        _run_until_interrupt(self.app, self.state, self.config)
        gs = self.app.get_state(self.config)
        assert list(gs.next) == ["gate_resume_N08"]
        _inject_gate_approval(self.app, self.config, "N08")

        # N09 -> N18 interrupt
        _run_until_interrupt(self.app, None, self.config)
        gs = self.app.get_state(self.config)
        assert list(gs.next) == ["gate_resume_N18"]
        _inject_gate_approval(self.app, self.config, "N18")

        # N19 -> N21 interrupt
        _run_until_interrupt(self.app, None, self.config)
        gs = self.app.get_state(self.config)
        assert list(gs.next) == ["gate_resume_N21"]
        _inject_gate_approval(self.app, self.config, "N21")

        # N22 -> N24 interrupt (serial 3-step)
        _run_until_interrupt(self.app, None, self.config)
        gs = self.app.get_state(self.config)
        assert list(gs.next) == ["gate_resume_N24"]

        # N24 serial: approve all 3 steps
        _inject_n24_serial_approval(self.app, self.config)

        # Pipeline should be complete
        gs = self.app.get_state(self.config)
        values = gs.values
        assert values.get("should_terminate") is True or not gs.next, (
            f"pipeline should be complete, next={list(gs.next)}"
        )

    @pytest.mark.timeout(60)
    def test_all_nodes_have_outputs(self):
        """Every non-gate node should have an output ref after full run."""
        _run_until_interrupt(self.app, self.state, self.config)
        _inject_gate_approval(self.app, self.config, "N08")
        _run_until_interrupt(self.app, None, self.config)
        _inject_gate_approval(self.app, self.config, "N18")
        _run_until_interrupt(self.app, None, self.config)
        _inject_gate_approval(self.app, self.config, "N21")
        _run_until_interrupt(self.app, None, self.config)
        _inject_n24_serial_approval(self.app, self.config)

        gs = self.app.get_state(self.config)
        node_outputs = gs.values.get("node_outputs", {})
        non_gate_nodes = [n for n in PIPELINE_NODES if n not in GATE_NODES]
        for nid in non_gate_nodes:
            assert nid in node_outputs, f"missing output for non-gate node {nid}"

    @pytest.mark.timeout(20)
    def test_cost_accumulates_non_negative(self):
        """total_cost_cny should be >= 0 after running the first segment."""
        _run_until_interrupt(self.app, self.state, self.config)
        gs = self.app.get_state(self.config)
        assert gs.values.get("total_cost_cny", -1) >= 0.0


class TestPipelineRerun:
    """Rerun mode: only specified nodes execute, others are skipped."""

    @pytest.mark.timeout(20)
    def test_rerun_skips_early_nodes(self):
        """Rerun with rerun_node_ids=[N14..N17] skips N01-N13."""
        app = _compile_raw()
        config = {"configurable": {"thread_id": "smoke-rerun"}}
        state = _make_state(
            thread_id="smoke-rerun",
            is_rerun=True,
            rerun_node_ids=["N14", "N15", "N16", "N16b", "N17"],
        )

        _run_until_interrupt(app, state, config)
        gs = app.get_state(config)
        values = gs.values

        node_outputs = values.get("node_outputs", {})
        # N14 should be in outputs (it was in the rerun set)
        assert "N14" in node_outputs, "N14 should have executed in rerun"
        # N01 should NOT be in outputs (it was skipped)
        assert "N01" not in node_outputs, "N01 should have been skipped in rerun"
