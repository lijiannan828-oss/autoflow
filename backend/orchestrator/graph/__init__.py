"""LangGraph-based pipeline orchestration for the AIGC production line.

Modules
-------
state
    ``PipelineState`` TypedDict — the graph's state schema.
topology
    DAG constants — node ordering, dependencies, stages, agent roles.
supervisor
    Supervisor node — central routing logic.
workers
    Worker node factory — pluggable handler stubs for each pipeline step.
gates
    Gate node logic — human-in-the-loop review gates (N08/N18/N21/N24).
context
    Context assembly helpers — EpisodeContext / RunContext hydration.
builder
    Graph construction — ``build_pipeline_graph()`` and ``compile_pipeline()``.
"""

from .builder import build_pipeline_graph, compile_pipeline

try:
    from .builder import configure_graph_runtime
except ImportError:
    configure_graph_runtime = None  # type: ignore[assignment]

try:
    from .context import load_node_output_payload
except (ImportError, AttributeError):
    load_node_output_payload = None  # type: ignore[assignment]

try:
    from .runtime_hooks import production_context_loader, production_review_task_creator
except ImportError:
    production_context_loader = None  # type: ignore[assignment]
    production_review_task_creator = None  # type: ignore[assignment]

try:
    from .script_handlers import register_script_stage_handlers
except ImportError:
    register_script_stage_handlers = None  # type: ignore[assignment]

try:
    from backend.orchestrator.handlers import register_all_handlers
except ImportError:
    register_all_handlers = None  # type: ignore[assignment]
from .state import (
    GateScopeItem,
    GateState,
    NodeOutputRef,
    NodeResult,
    PipelineState,
    make_initial_state,
)
from .topology import (
    GATE_NODES,
    NODE_AGENT_ROLE,
    NODE_DEPENDS_ON,
    NODE_SUCCESSOR,
    PIPELINE_NODES,
    QC_NODES,
    QC_REJECT_TARGET,
    is_gate,
    is_qc,
    stage_no_for_node,
)
from .workers import register_handler

__all__ = [
    "GATE_NODES",
    "GateScopeItem",
    "GateState",
    "NODE_AGENT_ROLE",
    "NODE_DEPENDS_ON",
    "NODE_SUCCESSOR",
    "NodeOutputRef",
    "NodeResult",
    "PIPELINE_NODES",
    "PipelineState",
    "QC_NODES",
    "QC_REJECT_TARGET",
    "build_pipeline_graph",
    "compile_pipeline",
    "configure_graph_runtime",
    "load_node_output_payload",
    "is_gate",
    "is_qc",
    "make_initial_state",
    "production_context_loader",
    "production_review_task_creator",
    "register_handler",
    "register_all_handlers",
    "register_script_stage_handlers",
    "stage_no_for_node",
]
