"""Smoke test for graph construction and stub execution.

Run with:  python3 -m backend.orchestrator.graph.test_graph_build
"""

from __future__ import annotations

import sys


def test_topology_sanity():
    from backend.orchestrator.graph.topology import (
        GATE_NODES,
        NODE_AGENT_ROLE,
        NODE_DEPENDS_ON,
        NODE_SUCCESSOR,
        PIPELINE_NODES,
        QC_NODES,
        QC_REJECT_TARGET,
        stage_no_for_node,
    )

    assert len(PIPELINE_NODES) == 28, f"expected 28 nodes, got {len(PIPELINE_NODES)}"
    assert PIPELINE_NODES[0] == "N01"
    assert PIPELINE_NODES[-1] == "N26"

    assert GATE_NODES == {"N08", "N18", "N21", "N24"}
    assert QC_NODES == {"N03", "N11", "N15"}
    assert QC_REJECT_TARGET == {"N03": "N02", "N11": "N10", "N15": "N14"}

    for nid in PIPELINE_NODES:
        assert nid in NODE_AGENT_ROLE, f"missing agent role for {nid}"
        assert nid in NODE_DEPENDS_ON, f"missing depends_on for {nid}"
        stage = stage_no_for_node(nid)
        assert 1 <= stage <= 4, f"bad stage for {nid}: {stage}"

    assert NODE_SUCCESSOR["N25"] == "N26"
    assert NODE_SUCCESSOR["N26"] is None

    print("  topology: OK")


def test_state_creation():
    from backend.orchestrator.graph.state import make_initial_state

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    assert state["run_id"] == "run-001"
    assert state["completed_nodes"] == []
    assert state["should_terminate"] is False
    assert state["total_cost_cny"] == 0.0
    print("  state: OK")


def test_supervisor_first_dispatch():
    from backend.orchestrator.graph.state import make_initial_state
    from backend.orchestrator.graph.supervisor import supervisor_node

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    update = supervisor_node(state)
    assert update["next_node_id"] == "N01"
    assert update["current_node_id"] == "N01"
    assert update["current_stage_no"] == 1
    print("  supervisor first dispatch: OK")


def test_supervisor_advance():
    from backend.orchestrator.graph.state import NodeResult, make_initial_state
    from backend.orchestrator.graph.supervisor import supervisor_node

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    state["last_result"] = NodeResult(
        node_id="N01",
        status="succeeded",
        output_ref="tos://test/N01/out.json",
        artifact_ids=[],
        cost_cny=0.1,
        gpu_seconds=0.0,
        duration_s=5.0,
    )
    state["completed_nodes"] = []

    update = supervisor_node(state)
    assert update["next_node_id"] == "N02", f"expected N02, got {update.get('next_node_id')}"
    assert "N01" in update["completed_nodes"]
    print("  supervisor advance: OK")


def test_supervisor_qc_reject():
    from backend.orchestrator.graph.state import NodeResult, make_initial_state
    from backend.orchestrator.graph.supervisor import supervisor_node

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    state["last_result"] = NodeResult(
        node_id="N03",
        status="auto_rejected",
        quality_score=6.5,
        artifact_ids=[],
        cost_cny=0.0,
        gpu_seconds=0.0,
        duration_s=3.0,
    )
    state["auto_reject_counts"] = {}

    update = supervisor_node(state)
    assert update["next_node_id"] == "N02", f"expected N02, got {update.get('next_node_id')}"
    assert update["auto_reject_counts"]["N02"] == 1
    print("  supervisor QC reject: OK")


def test_supervisor_rerun_skip():
    from backend.orchestrator.graph.state import NodeResult, make_initial_state
    from backend.orchestrator.graph.supervisor import supervisor_node

    state = make_initial_state(
        run_id="run-002",
        episode_id="ep-001",
        episode_version_id="ev-002",
        is_rerun=True,
        rerun_node_ids=["N14", "N15", "N16", "N17"],
    )

    update = supervisor_node(state)
    assert update["next_node_id"] == "N14", f"expected N14 for rerun start, got {update.get('next_node_id')}"
    print("  supervisor rerun skip: OK")


def test_worker_stub():
    from backend.orchestrator.graph.state import make_initial_state
    from backend.orchestrator.graph.workers import make_worker_node

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    worker = make_worker_node("N01")
    update = worker(state)
    result = update["last_result"]
    assert result["node_id"] == "N01"
    assert result["status"] == "succeeded"

    out = update["node_outputs"]["N01"]
    assert isinstance(out, dict), "node_outputs should contain NodeOutputRef dicts"
    assert "output_ref" in out
    assert out["scope"] == "episode"
    print("  worker stub: OK")


def test_worker_per_shot_scope():
    from backend.orchestrator.graph.state import NodeOutputRef, make_initial_state
    from backend.orchestrator.graph.workers import make_worker_node

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    state["node_outputs"]["N06"] = NodeOutputRef(output_ref="stub://ev-001/N06/output.json", scope="episode")
    state["node_outputs"]["N09"] = NodeOutputRef(output_ref="stub://ev-001/N09/output.json", scope="episode")
    worker = make_worker_node("N10")
    update = worker(state)

    out = update["node_outputs"]["N10"]
    assert out["scope"] == "per_shot", f"N10 should be per_shot, got {out['scope']}"
    print("  worker per_shot scope: OK")


def test_gate_enter():
    from backend.orchestrator.graph.gates import make_gate_enter_node
    from backend.orchestrator.graph.state import make_initial_state

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    gate_enter = make_gate_enter_node("N08")
    update = gate_enter(state)
    gate = update["gate"]
    assert gate["gate_node_id"] == "N08"
    assert gate["stage_no"] == 1
    assert gate["scope"] == "asset"
    assert gate["decision"] is None
    assert len(gate["scope_items"]) >= 1
    assert len(gate["review_task_ids"]) >= 1
    print("  gate enter N08 (asset scope): OK")


def test_gate_enter_n18():
    from backend.orchestrator.graph.gates import make_gate_enter_node
    from backend.orchestrator.graph.state import make_initial_state

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    gate_enter = make_gate_enter_node("N18")
    update = gate_enter(state)
    gate = update["gate"]
    assert gate["scope"] == "shot"
    assert len(gate["scope_items"]) >= 1
    print("  gate enter N18 (shot scope): OK")


def test_gate_enter_n24_serial():
    """N24 serial multi-step: gate_enter creates only Step 1's task."""
    from backend.orchestrator.graph.gates import make_gate_enter_node
    from backend.orchestrator.graph.state import make_initial_state

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    gate_enter = make_gate_enter_node("N24")
    update = gate_enter(state)
    gate = update["gate"]
    assert gate["gate_node_id"] == "N24"
    assert gate["stage_no"] == 4
    assert gate["total_steps"] == 3
    assert gate["current_step_no"] == 1
    assert gate["steps_completed"] == []
    assert len(gate["review_task_ids"]) == 1, (
        f"N24 gate_enter should create only 1 task (Step 1), got {len(gate['review_task_ids'])}"
    )
    print("  gate enter N24 (serial, Step 1 only): OK")


def test_gate_resume_n24_step_advance():
    """N24 serial: approved Step 1 → advance to Step 2."""
    from backend.orchestrator.graph.gates import make_gate_enter_node, make_gate_resume_node
    from backend.orchestrator.graph.state import make_initial_state

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    gate_enter = make_gate_enter_node("N24")
    enter_update = gate_enter(state)
    state["gate"] = enter_update["gate"]
    state["gate"]["decision"] = "approved"

    gate_resume = make_gate_resume_node("N24")
    resume_update = gate_resume(state)
    gate = resume_update["gate"]

    assert gate["current_step_no"] == 2
    assert 1 in gate["steps_completed"]
    assert gate["decision"] is None, "decision should reset to None for next step"
    assert len(gate["review_task_ids"]) == 2, "should have Step 1 + Step 2 task IDs"
    print("  gate resume N24 step advance: OK")


def test_supervisor_partial_approved_repause():
    """Supervisor routes partial_approved back to gate_resume for re-pause."""
    from backend.orchestrator.graph.state import GateState, NodeResult, make_initial_state
    from backend.orchestrator.graph.supervisor import supervisor_node

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    state["last_result"] = NodeResult(
        node_id="N08",
        status="succeeded",
        artifact_ids=[],
        cost_cny=0.0,
        gpu_seconds=0.0,
        duration_s=0.0,
    )
    state["gate"] = GateState(
        gate_node_id="N08",
        stage_no=1,
        scope="asset",
        decision="partial_approved",
    )

    update = supervisor_node(state)
    assert update["next_node_id"] == "gate_resume_N08", (
        f"should re-route to gate_resume_N08, got {update.get('next_node_id')}"
    )
    assert update["current_node_id"] == "N08"
    assert "should_terminate" not in update or not update.get("should_terminate")
    print("  supervisor partial_approved re-pause: OK")


def test_gate_scope_item_guard():
    """Defense-in-depth: approved with incomplete scope items → demote to partial_approved."""
    from backend.orchestrator.graph.gates import make_gate_resume_node
    from backend.orchestrator.graph.state import GateScopeItem, GateState, make_initial_state

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    state["gate"] = GateState(
        gate_node_id="N08",
        stage_no=1,
        scope="asset",
        scope_items=[
            GateScopeItem(scope_id="char_001", status="approved"),
            GateScopeItem(scope_id="char_002", status="pending"),
        ],
        review_task_ids=["t1", "t2"],
        decision="approved",
        current_step_no=1,
        total_steps=1,
        steps_completed=[],
    )

    gate_resume = make_gate_resume_node("N08")
    update = gate_resume(state)
    assert update["gate"]["decision"] == "partial_approved", (
        "should demote to partial_approved when scope items are incomplete"
    )
    assert len(update.get("warnings", [])) > 0
    print("  gate scope item guard (defense-in-depth): OK")


def test_supervisor_qc_reject_exceed_continues():
    """超过 MAX_AUTO_REJECTS 后不终止，继续往下走并加入预警。"""
    from backend.orchestrator.graph.state import NodeResult, make_initial_state
    from backend.orchestrator.graph.supervisor import supervisor_node
    from backend.orchestrator.graph.topology import MAX_AUTO_REJECTS

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    state["last_result"] = NodeResult(
        node_id="N03",
        status="auto_rejected",
        quality_score=5.0,
        artifact_ids=[],
        cost_cny=0.0,
        gpu_seconds=0.0,
        duration_s=2.0,
    )
    # 已经打回 3 次，再来一次就超限
    state["auto_reject_counts"] = {"N02": MAX_AUTO_REJECTS}

    update = supervisor_node(state)
    # 不应终止
    assert not update.get("should_terminate"), (
        "should NOT terminate when auto-reject limit exceeded"
    )
    # 应继续推进到 N03 之后的下一个节点（N04）
    assert update["next_node_id"] == "N04", (
        f"expected N04, got {update.get('next_node_id')}"
    )
    # 应包含预警信息
    assert len(update.get("warnings", [])) > 0, "should contain a warning"
    assert "exceeded" in update["warnings"][0].lower() or "exceed" in update["warnings"][0].lower()
    print("  supervisor QC reject exceed continues: OK")


def test_envelope_builders():
    from backend.orchestrator.graph.context import (
        build_node_input_envelope,
        build_node_output_envelope,
    )
    from backend.orchestrator.graph.state import NodeOutputRef, make_initial_state

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    state["node_outputs"]["N01"] = NodeOutputRef(output_ref="tos://test/N01/out.json", scope="episode")

    inp = build_node_input_envelope("N02", state, payload={"episode_index": 1})
    assert inp["node_id"] == "N02"
    assert inp["episode_id"] == "ep-001"
    assert inp["run_id"] == "run-001"
    assert inp["payload"] == {"episode_index": 1}
    assert "context_refs" in inp
    assert len(inp["artifact_inputs"]) == 1

    out = build_node_output_envelope(
        "N02", state,
        payload={"episode_script": {}},
        cost_cny=0.5,
        quality_score=8.5,
    )
    assert out["node_id"] == "N02"
    assert out["episode_id"] == "ep-001"
    assert out["status"] == "succeeded"
    assert out["metrics"]["cost_cny"] == 0.5
    assert out["metrics"]["quality_score"] == 8.5
    assert "error" not in out
    print("  envelope builders: OK")


def test_n07b_voice_handler():
    """N07b handler produces voice candidates in stub mode."""
    from backend.orchestrator.handlers.voice_handler import handle_N07b
    from backend.orchestrator.graph.state import make_initial_state

    state = make_initial_state(run_id="r", episode_id="ep", episode_version_id="ev")
    result = handle_N07b("N07b", state, {})
    assert result["node_id"] == "N07b"
    assert result["status"] == "succeeded"
    payload = result.get("output_payload", {})
    assert len(payload.get("voice_candidates", [])) >= 1
    assert payload.get("mode") == "stub"
    print("  N07b voice handler: OK")


def test_n16b_tone_handler():
    """N16b handler produces pacing adjustments in stub mode."""
    from backend.orchestrator.handlers.tone_handler import handle_N16b
    from backend.orchestrator.graph.state import make_initial_state

    state = make_initial_state(run_id="r", episode_id="ep", episode_version_id="ev")
    result = handle_N16b("N16b", state, {})
    assert result["node_id"] == "N16b"
    assert result["status"] == "succeeded"
    payload = result.get("output_payload", {})
    assert "adjustments" in payload
    assert payload.get("mode") == "stub"
    print("  N16b tone handler: OK")


def test_agent_bridge():
    """Agent bridge delegates to registered agents when no handler exists."""
    from backend.agents.registry import register_all_agents, clear_registry
    from backend.orchestrator.graph.workers import _try_agent_bridge
    from backend.orchestrator.graph.state import make_initial_state

    clear_registry()
    register_all_agents()

    state = make_initial_state(run_id="r", episode_id="ep", episode_version_id="ev")
    config = {"input_envelope": {}, "upstream_outputs": {}, "stage_group": "stage1"}

    # N01 → script_analyst agent
    result = _try_agent_bridge("N01", state, config)
    assert result is not None
    assert result["status"] == "succeeded"
    assert result["model_provider"] == "script_analyst"

    # N07b → audio_director agent
    result2 = _try_agent_bridge("N07b", state, config)
    assert result2 is not None
    assert result2["model_provider"] == "audio_director"

    clear_registry()
    print("  agent bridge: OK")


def test_node_decision_layer():
    """NODE_DECISION_LAYER covers all 28 nodes and routes correctly."""
    from backend.orchestrator.graph.workers import NODE_DECISION_LAYER
    from backend.orchestrator.graph.topology import PIPELINE_NODES

    # All 28 nodes must be mapped
    assert len(NODE_DECISION_LAYER) == 28, f"expected 28, got {len(NODE_DECISION_LAYER)}"
    for node_id in PIPELINE_NODES:
        assert node_id in NODE_DECISION_LAYER, f"{node_id} missing from NODE_DECISION_LAYER"

    # Verify layer counts
    from collections import Counter
    c = Counter(NODE_DECISION_LAYER.values())
    assert c["plan"] == 4, f"expected 4 plan nodes, got {c['plan']}"
    assert c["shot"] == 15, f"expected 15 shot nodes, got {c['shot']}"
    assert c["review"] == 5, f"expected 5 review nodes, got {c['review']}"
    assert c["legacy"] == 4, f"expected 4 legacy nodes, got {c['legacy']}"

    # Gates are always legacy
    for gate in ("N08", "N18", "N21", "N24"):
        assert NODE_DECISION_LAYER[gate] == "legacy"

    print("  NODE_DECISION_LAYER: OK")


def test_three_layer_agent_routing():
    """Agents execute correctly in their designated mode."""
    from backend.agents.registry import register_all_agents, clear_registry, get_agent
    from backend.agents.base import AgentContext

    clear_registry()
    register_all_agents()

    # Plan mode: ScriptAnalyst.plan_episode
    agent = get_agent("script_analyst")
    ctx = AgentContext(run_id="t", episode_version_id="ev", node_id="N01", mode="plan")
    r = agent.execute(ctx)
    assert r.success, f"script_analyst plan failed: {r.error}"

    # Shot mode: Compositor.execute_shot
    agent = get_agent("compositor")
    ctx = AgentContext(run_id="t", episode_version_id="ev", node_id="N23", mode="shot")
    r = agent.execute(ctx)
    assert r.success, f"compositor shot failed: {r.error}"

    # Review mode: QualityInspector.review_batch
    agent = get_agent("quality_inspector")
    ctx = AgentContext(run_id="t", episode_version_id="ev", node_id="N03", mode="review")
    r = agent.execute(ctx)
    assert r.success, f"quality_inspector review failed: {r.error}"

    # Wrong mode → graceful failure (not crash)
    agent = get_agent("compositor")
    ctx = AgentContext(run_id="t", episode_version_id="ev", node_id="N23", mode="plan")
    r = agent.execute(ctx)
    assert not r.success, "compositor should fail in plan mode"
    assert "does not implement" in (r.error or "")

    clear_registry()
    print("  three-layer agent routing: OK")


def test_compile_pipeline_with_runtime_hooks():
    from backend.orchestrator.graph.builder import compile_pipeline
    from backend.orchestrator.graph.context import load_episode_context
    from backend.orchestrator.graph.gates import make_gate_enter_node
    from backend.orchestrator.graph.state import make_initial_state

    def loader(*, ref: str | None = None, episode_version_id: str | None = None) -> dict[str, object]:
        return {
            "loaded_from": ref or "episode_version_id",
            "episode_version_id": episode_version_id,
        }

    def review_task_creator(**_: object) -> list[str]:
        return ["rt-hook-001"]

    compiled = compile_pipeline(
        checkpointer=None,
        interrupt_before_gates=True,
        context_loader=loader,
        review_task_creator=review_task_creator,
    )
    assert type(compiled).__name__ == "CompiledStateGraph"

    state = make_initial_state(
        run_id="run-001",
        episode_id="ep-001",
        episode_version_id="ev-001",
    )
    loaded = load_episode_context(state)
    assert loaded["episode_version_id"] == "ev-001"

    gate_enter = make_gate_enter_node("N08")
    update = gate_enter(state)
    assert update["gate"]["review_task_ids"] == ["rt-hook-001"]
    print("  compile pipeline with runtime hooks: OK")


def test_script_stage_handler_chain():
    from backend.orchestrator.graph.context import load_node_output_payload
    from backend.orchestrator.graph.script_handlers import register_script_stage_handlers
    from backend.orchestrator.graph.state import make_initial_state
    from backend.orchestrator.graph.workers import make_worker_node

    register_script_stage_handlers()
    state = make_initial_state(
        run_id="run-local-script",
        episode_id="ep-local-script",
        episode_version_id="ev-local-script",
    )

    for node_id in ("N01", "N02", "N03"):
        worker = make_worker_node(node_id)
        update = worker(state)
        state = {**state, **update}

    parsed_script = load_node_output_payload("N01", state)
    episode_script = load_node_output_payload("N02", state)
    qc_result = load_node_output_payload("N03", state)

    assert parsed_script["episodes"][0]["episode_id"] == "ep-local-script"
    assert len(episode_script["scenes"]) == 2
    assert qc_result["decision"] == "pass"
    assert state["last_result"]["node_id"] == "N03"
    assert state["last_result"]["status"] == "succeeded"
    assert state["qc_scores"]["N03"] >= 8.0
    print("  script stage handler chain: OK")


def test_compiled_graph_interrupts_at_first_gate():
    from backend.orchestrator.graph.builder import compile_pipeline
    from backend.orchestrator.graph.state import make_initial_state
    from langgraph.checkpoint.memory import InMemorySaver

    compiled = compile_pipeline(checkpointer=InMemorySaver(), interrupt_before_gates=True)
    config = {"configurable": {"thread_id": "round8-first-gate-thread"}}
    initial_state = make_initial_state(
        run_id="run-local-gate",
        episode_id="ep-local-gate",
        episode_version_id="ev-local-gate",
        langgraph_thread_id="round8-first-gate-thread",
    )

    for _event in compiled.stream(initial_state, config=config):
        pass

    graph_state = compiled.get_state(config)
    assert list(graph_state.next) == ["gate_resume_N08"], (
        f"expected first interrupt at gate_resume_N08, got {list(graph_state.next)}"
    )
    assert graph_state.values.get("current_node_id") == "N08"
    print("  compiled graph interrupts at first gate: OK")


def main():
    print("=== Graph build smoke tests ===")
    test_topology_sanity()
    test_state_creation()
    test_supervisor_first_dispatch()
    test_supervisor_advance()
    test_supervisor_qc_reject()
    test_supervisor_rerun_skip()
    test_worker_stub()
    test_worker_per_shot_scope()
    test_gate_enter()
    test_gate_enter_n18()
    test_gate_enter_n24_serial()
    test_gate_resume_n24_step_advance()
    test_supervisor_partial_approved_repause()
    test_gate_scope_item_guard()
    test_supervisor_qc_reject_exceed_continues()
    test_envelope_builders()
    test_n07b_voice_handler()
    test_n16b_tone_handler()
    test_agent_bridge()
    test_node_decision_layer()
    test_three_layer_agent_routing()
    test_compile_pipeline_with_runtime_hooks()
    test_script_stage_handler_chain()
    test_compiled_graph_interrupts_at_first_gate()
    print("=== All tests passed ===")


if __name__ == "__main__":
    main()
