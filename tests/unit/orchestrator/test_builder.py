"""Unit tests for graph compilation — T3: graph compilation upgrade.

Covers:
- Graph compiles with 28 nodes (including N07b, N16b)
- N07/N07b parallel dispatch exists in the graph
- N16/N16b parallel dispatch exists in the graph
- All gate nodes have interrupt_before configured
- Graph node count matches expected (supervisor + workers + gate enter/resume pairs)
- Compiled graph has correct edges for QC reject targets
"""

import pytest

from backend.orchestrator.graph.builder import compile_pipeline, build_pipeline_graph
from backend.orchestrator.graph.gates import make_gate_enter_node
from backend.orchestrator.graph.topology import (
    GATE_NODES,
    PARALLEL_GROUPS,
    PIPELINE_NODES,
    QC_REJECT_TARGET,
)
from backend.orchestrator.graph.workers import _handlers


@pytest.fixture(autouse=True)
def _clear_handler_registry():
    """Ensure stub handlers are used — clear any registered real handlers."""
    saved = dict(_handlers)
    _handlers.clear()
    yield
    _handlers.clear()
    _handlers.update(saved)


class TestCompilePipeline:
    def test_compile_returns_compiled_graph(self):
        compiled = compile_pipeline(checkpointer=None, interrupt_before_gates=True)
        assert type(compiled).__name__ == "CompiledStateGraph"

    def test_compile_with_runtime_hooks(self):
        def loader(*, ref=None, episode_version_id=None):
            return {"loaded_from": ref, "episode_version_id": episode_version_id}

        def review_task_creator(**_):
            return ["rt-hook-001"]

        compiled = compile_pipeline(
            checkpointer=None,
            interrupt_before_gates=True,
            context_loader=loader,
            review_task_creator=review_task_creator,
        )
        assert type(compiled).__name__ == "CompiledStateGraph"

    def test_review_task_creator_injects_into_gate(self, make_state):
        """Compile with custom review_task_creator, verify gate uses it."""

        def review_task_creator(**_):
            return ["rt-hook-test"]

        compile_pipeline(
            checkpointer=None,
            interrupt_before_gates=True,
            review_task_creator=review_task_creator,
        )
        state = make_state()
        gate_enter = make_gate_enter_node("N08")
        update = gate_enter(state)
        assert update["gate"]["review_task_ids"] == ["rt-hook-test"]


class TestGraphTopology28Nodes:
    """Verify the graph contains exactly 28 pipeline nodes (v2.2 with N07b, N16b)."""

    def test_pipeline_nodes_count_is_28(self):
        assert len(PIPELINE_NODES) == 28

    def test_n07b_in_pipeline(self):
        assert "N07b" in PIPELINE_NODES

    def test_n16b_in_pipeline(self):
        assert "N16b" in PIPELINE_NODES

    def test_compiled_graph_node_count(self):
        """Total graph nodes = 1 (supervisor) + non-gate workers + gate pairs (enter+resume).

        Non-gate workers: 28 - 4 gates = 24
        Gate pairs: 4 gates * 2 (enter + resume) = 8
        Total: 1 + 24 + 8 = 33
        """
        graph = build_pipeline_graph()
        compiled = graph.compile()
        node_names = set(compiled.get_graph().nodes.keys())
        # Remove __start__ and __end__ virtual nodes if present
        real_nodes = {n for n in node_names if not n.startswith("__")}

        expected_worker_count = len(PIPELINE_NODES) - len(GATE_NODES)  # 24
        expected_gate_pair_count = len(GATE_NODES) * 2  # 8
        expected_total = 1 + expected_worker_count + expected_gate_pair_count  # 33

        assert len(real_nodes) == expected_total, (
            f"Expected {expected_total} real nodes, got {len(real_nodes)}: {sorted(real_nodes)}"
        )

    def test_supervisor_node_exists(self):
        graph = build_pipeline_graph()
        compiled = graph.compile()
        node_names = set(compiled.get_graph().nodes.keys())
        assert "supervisor" in node_names

    def test_all_worker_nodes_exist(self):
        """Every non-gate pipeline node should have a corresponding graph node."""
        graph = build_pipeline_graph()
        compiled = graph.compile()
        node_names = set(compiled.get_graph().nodes.keys())

        for nid in PIPELINE_NODES:
            if nid in GATE_NODES:
                assert f"gate_enter_{nid}" in node_names, f"Missing gate_enter_{nid}"
                assert f"gate_resume_{nid}" in node_names, f"Missing gate_resume_{nid}"
            else:
                assert nid in node_names, f"Missing worker node {nid}"


class TestParallelGroups:
    """Verify parallel node groups (N07/N07b) are present in the graph."""

    def test_parallel_group_n07_n07b_defined(self):
        assert "N07_N07b" in PARALLEL_GROUPS
        group = PARALLEL_GROUPS["N07_N07b"]
        assert set(group["nodes"]) == {"N07", "N07b"}
        assert group["trigger_after"] == "N06"
        assert group["join_at"] == "N08"

    def test_n07_and_n07b_both_in_graph(self):
        graph = build_pipeline_graph()
        compiled = graph.compile()
        node_names = set(compiled.get_graph().nodes.keys())
        assert "N07" in node_names
        assert "N07b" in node_names

    def test_n16_and_n16b_both_in_graph(self):
        graph = build_pipeline_graph()
        compiled = graph.compile()
        node_names = set(compiled.get_graph().nodes.keys())
        assert "N16" in node_names
        assert "N16b" in node_names


class TestGateInterrupts:
    """Verify all gate nodes have interrupt_before configured."""

    def test_all_gates_have_interrupt_before(self):
        compiled = compile_pipeline(
            checkpointer=None,
            interrupt_before_gates=True,
        )
        # LangGraph stores interrupt_before as a list on the compiled graph
        interrupt_nodes = set()
        if hasattr(compiled, "interrupt_before_nodes"):
            interrupt_nodes = set(compiled.interrupt_before_nodes)
        elif hasattr(compiled, "_interrupt_before_nodes"):
            interrupt_nodes = set(compiled._interrupt_before_nodes)

        for gate_nid in GATE_NODES:
            resume_name = f"gate_resume_{gate_nid}"
            assert resume_name in interrupt_nodes, (
                f"gate_resume_{gate_nid} not in interrupt_before list"
            )

    def test_gate_count_matches(self):
        assert len(GATE_NODES) == 4
        assert GATE_NODES == frozenset({"N08", "N18", "N21", "N24"})

    @pytest.mark.timeout(60)
    def test_interrupts_at_first_gate(self, make_state):
        from langgraph.checkpoint.memory import InMemorySaver

        compiled = compile_pipeline(
            checkpointer=InMemorySaver(),
            interrupt_before_gates=True,
        )
        config = {"configurable": {"thread_id": "pytest-gate-test"}}
        state = make_state(langgraph_thread_id="pytest-gate-test")

        for _event in compiled.stream(state, config=config):
            pass

        graph_state = compiled.get_state(config)
        assert list(graph_state.next) == ["gate_resume_N08"]


class TestQCRejectEdges:
    """Verify QC reject targets are correctly wired in the routing map."""

    def test_qc_reject_targets_defined(self):
        assert QC_REJECT_TARGET == {
            "N03": "N02",
            "N11": "N10",
            "N15": "N14",
        }

    def test_reject_targets_are_valid_pipeline_nodes(self):
        for qc_node, target_node in QC_REJECT_TARGET.items():
            assert qc_node in PIPELINE_NODES, f"QC node {qc_node} not in pipeline"
            assert target_node in PIPELINE_NODES, f"Reject target {target_node} not in pipeline"

    def test_routing_map_includes_reject_targets(self):
        """The compiled graph's routing from supervisor should include reject target nodes."""
        graph = build_pipeline_graph()
        compiled = graph.compile()
        node_names = set(compiled.get_graph().nodes.keys())

        # All reject target nodes must exist as worker nodes in the graph
        for target_node in QC_REJECT_TARGET.values():
            assert target_node in node_names, (
                f"Reject target {target_node} not found in compiled graph nodes"
            )

    def test_supervisor_routes_to_reject_targets(self, make_state):
        """Verify supervisor correctly routes to reject targets on auto_rejected status."""
        from backend.orchestrator.graph.supervisor import supervisor_node
        from backend.orchestrator.graph.state import NodeResult

        for qc_node, target_node in QC_REJECT_TARGET.items():
            state = make_state()
            state["last_result"] = NodeResult(
                node_id=qc_node,
                status="auto_rejected",
                quality_score=5.0,
                artifact_ids=[],
                cost_cny=0.0,
                gpu_seconds=0.0,
                duration_s=0.1,
            )
            state["auto_reject_counts"] = {}

            update = supervisor_node(state)
            assert update["next_node_id"] == target_node, (
                f"Expected supervisor to route {qc_node} reject to {target_node}, "
                f"got {update.get('next_node_id')}"
            )
