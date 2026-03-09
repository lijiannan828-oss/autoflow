"""Graph builder — constructs and compiles the AIGC pipeline StateGraph.

Usage::

    from backend.orchestrator.graph.builder import build_pipeline_graph

    graph = build_pipeline_graph()

    # For production with PostgreSQL checkpointer:
    from langgraph.checkpoint.postgres import PostgresSaver
    checkpointer = PostgresSaver(conn_string=...)
    app = graph.compile(checkpointer=checkpointer)

    # For testing (in-memory):
    app = graph.compile()

The compiled graph exposes the standard LangGraph interface:
- ``app.invoke(initial_state)`` — run to completion (or next interrupt)
- ``app.stream(initial_state)`` — stream state updates
- ``app.get_state(thread_id)`` — inspect checkpointed state
- ``app.update_state(thread_id, updates)`` — inject external updates (gate decisions)
"""

from __future__ import annotations

import logging
from typing import Any

from .context import set_context_loader
from .gates import make_gate_enter_node, make_gate_resume_node
from .gates import set_review_task_creator

try:
    from .script_handlers import register_script_stage_handlers
except ImportError:
    register_script_stage_handlers = None  # type: ignore[assignment]

try:
    from backend.orchestrator.handlers import register_all_handlers
except ImportError:
    register_all_handlers = None  # type: ignore[assignment]
from .state import PipelineState
from .supervisor import route_after_supervisor, supervisor_node
from .topology import GATE_NODES, PIPELINE_NODES
from .workers import make_worker_node

logger = logging.getLogger(__name__)

try:
    from langgraph.graph import END, StateGraph
except ImportError:
    StateGraph = None  # type: ignore[assignment,misc]
    END = "__end__"
    logger.warning(
        "langgraph is not installed — graph construction will raise at runtime. "
        "Install with: pip install langgraph"
    )


def build_pipeline_graph() -> Any:
    """Construct the full 26-node pipeline as a LangGraph StateGraph.

    Architecture:

    .. code-block:: text

       ┌──────────┐
       │ START    │
       └────┬─────┘
            ▼
       ┌──────────┐
       │supervisor│◄───────────────────────┐
       └────┬─────┘                        │
            │ (conditional edge)            │
            ▼                               │
       ┌──────────┐    ┌──────────┐        │
       │  N01     │───►│  N02     │───►... │
       │  (worker)│    │  (worker)│        │
       └──────────┘    └──────────┘        │
            │               │               │
            └───────────────┴───────────────┘
                    (all workers → supervisor)

    Gate nodes (N08, N18, N21, N24) have two sub-nodes: ``gate_enter_*``
    creates ReviewTasks, then the graph pauses at ``gate_resume_*`` via
    ``interrupt_before`` for human review.  After the external system
    injects the review decision and resumes, ``gate_resume_*`` processes
    the decision.  If ``partial_approved``, the Supervisor re-routes to
    ``gate_resume_*`` (re-pausing for additional reviews).
    """
    if StateGraph is None:
        raise RuntimeError(
            "langgraph is not installed. Run: pip install langgraph"
        )

    graph = StateGraph(PipelineState)

    # ── Supervisor ──────────────────────────────────────────────────────
    graph.add_node("supervisor", supervisor_node)

    # ── Worker & Gate nodes ─────────────────────────────────────────────
    gate_resume_names: list[str] = []
    routing_map: dict[str, str] = {}

    for node_id in PIPELINE_NODES:
        if node_id in GATE_NODES:
            enter_name = f"gate_enter_{node_id}"
            resume_name = f"gate_resume_{node_id}"

            graph.add_node(enter_name, make_gate_enter_node(node_id))
            graph.add_node(resume_name, make_gate_resume_node(node_id))

            # gate_enter → gate_resume (graph pauses here via interrupt_before)
            graph.add_edge(enter_name, resume_name)
            # gate_resume → supervisor
            graph.add_edge(resume_name, "supervisor")

            gate_resume_names.append(resume_name)
            routing_map[node_id] = enter_name
            # partial_approved re-pause: supervisor can route directly to gate_resume
            routing_map[resume_name] = resume_name
        else:
            graph.add_node(node_id, make_worker_node(node_id))
            graph.add_edge(node_id, "supervisor")
            routing_map[node_id] = node_id

    # ── Entry point ─────────────────────────────────────────────────────
    graph.set_entry_point("supervisor")

    # ── Conditional routing from supervisor ─────────────────────────────
    routing_map["__end__"] = END

    def _route(state: PipelineState) -> str:
        return route_after_supervisor(state)

    graph.add_conditional_edges("supervisor", _route, routing_map)

    logger.info(
        "pipeline graph built: %d nodes, %d gate interrupts",
        len(PIPELINE_NODES),
        len(gate_resume_names),
    )
    return graph


def configure_graph_runtime(
    *,
    context_loader: Any | None = None,
    review_task_creator: Any | None = None,
) -> None:
    """Install runtime hooks used by graph nodes.

    These hooks are optional at compile time:
    - ``context_loader`` lets `graph.context` hydrate Episode/Run/Shot context
      from real DB/TOS-backed sources.
    - ``review_task_creator`` lets `graph.gates` create real review tasks
      instead of synthetic stub IDs.
    """
    if register_script_stage_handlers is not None:
        register_script_stage_handlers()

    if register_all_handlers is not None:
        register_all_handlers()

    if context_loader is not None:
        set_context_loader(context_loader)
        logger.info("graph runtime configured: context_loader=%s", type(context_loader).__name__)

    if review_task_creator is not None:
        set_review_task_creator(review_task_creator)
        logger.info(
            "graph runtime configured: review_task_creator=%s",
            type(review_task_creator).__name__,
        )


def compile_pipeline(
    *,
    checkpointer: Any | None = None,
    interrupt_before_gates: bool = True,
    context_loader: Any | None = None,
    review_task_creator: Any | None = None,
) -> Any:
    """Build and compile the pipeline graph, ready for execution.

    Parameters
    ----------
    checkpointer
        A LangGraph-compatible checkpointer (e.g. ``PostgresSaver``).
        Pass ``None`` for in-memory testing.
    interrupt_before_gates
        If True (default), the graph pauses at gate_enter nodes so the
        external review system can process human decisions before resume.
    context_loader
        Optional runtime hook for loading Episode/Run/Shot context from
        real storage before worker execution.
    review_task_creator
        Optional runtime hook for creating real ``public.review_tasks``
        rows when Gate nodes pause for human review.
    """
    configure_graph_runtime(
        context_loader=context_loader,
        review_task_creator=review_task_creator,
    )

    graph = build_pipeline_graph()

    compile_kwargs: dict[str, Any] = {}
    if checkpointer is not None:
        compile_kwargs["checkpointer"] = checkpointer
    if interrupt_before_gates:
        gate_resume_nodes = [f"gate_resume_{nid}" for nid in GATE_NODES]
        compile_kwargs["interrupt_before"] = gate_resume_nodes

    compiled = graph.compile(**compile_kwargs)
    logger.info("pipeline graph compiled (checkpointer=%s)", type(checkpointer).__name__)
    return compiled
