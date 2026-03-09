"""Pipeline state schema for LangGraph orchestration.

This TypedDict is the single source of truth for data flowing through the
LangGraph StateGraph.  It is intentionally *lean*: heavy payloads (images,
videos, full scripts) live in TOS / PostgreSQL and are referenced by URL or
UUID.  The state carries just enough context for the Supervisor to route, for
Workers to assemble inputs, and for Gates to pause/resume.

Key design decisions
--------------------
- One graph instance = one episode_version.
- Per-shot / per-asset fan-out happens *inside* worker handlers; the graph
  state only tracks the latest aggregate output per node via ``NodeOutputRef``.
- ``NodeOutputRef`` carries ``node_run_id`` so downstream nodes can query the
  DB for detailed per-scope breakdowns when needed.
- ``GateState`` is scope-aware: it can track per-asset (N08), per-shot (N18),
  per-episode (N21), and serial multi-step (N24) review flows.
"""

from __future__ import annotations

from typing import Any, TypedDict


class NodeResult(TypedDict, total=False):
    """Outcome of a single node execution."""

    node_id: str
    status: str  # succeeded | failed | auto_rejected | skipped
    output_ref: str | None
    quality_score: float | None
    artifact_ids: list[str]
    cost_cny: float
    gpu_seconds: float
    duration_s: float
    error: str | None
    error_code: str | None
    node_run_id: str | None
    model_provider: str | None
    model_endpoint: str | None
    output_payload: Any
    output_envelope: dict[str, Any] | None


class NodeOutputRef(TypedDict, total=False):
    """Reference to a node's output, stored in TOS/DB.

    For per-shot nodes (N10, N14) the output_ref points to an aggregate
    JSON containing all shot results.  The ``node_run_id`` allows querying
    the DB for fine-grained per-shot breakdowns.
    """

    output_ref: str
    node_run_id: str | None
    scope: str  # "episode" | "per_shot" | "per_asset"


class GateScopeItem(TypedDict, total=False):
    """Per-scope-item review tracking (one per asset / shot / episode)."""

    scope_id: str  # asset_id / shot_id / episode_id
    status: str  # pending | approved | returned
    review_task_id: str | None
    feedback: str | None


class GateState(TypedDict, total=False):
    """Tracks a pending human-review gate.

    Supports three gate patterns:
    - **Scope-aware** (N08 asset-level, N18 shot-level): ``scope_items``
      tracks per-item review status; all items must be approved for the
      gate to pass.  ``partial_approved`` means some items passed but
      others are still pending or returned.
    - **Simple** (N21 episode-level): single scope item.
    - **Serial multi-step** (N24): ``current_step_no`` tracks progress;
      tasks are created one step at a time (not all at once).
    """

    gate_node_id: str
    stage_no: int
    scope: str  # "asset" | "shot" | "episode"

    # Per-scope-item tracking (N08 per-asset, N18 per-shot)
    scope_items: list[GateScopeItem]

    # Serial multi-step tracking (N24)
    current_step_no: int
    total_steps: int
    steps_completed: list[int]

    # Current step's review task(s)
    review_task_ids: list[str]

    # Overall gate decision
    decision: str | None  # approved | returned | partial_approved | None
    return_ticket_id: str | None


class PipelineState(TypedDict, total=False):
    """Root state for the AIGC production pipeline LangGraph."""

    # ── Identity ────────────────────────────────────────────────────────
    run_id: str
    episode_id: str
    episode_version_id: str
    project_id: str
    langgraph_thread_id: str

    # ── Pipeline position ───────────────────────────────────────────────
    current_node_id: str | None
    current_stage_no: int | None
    next_node_id: str | None
    completed_nodes: list[str]

    # ── Last execution result ───────────────────────────────────────────
    last_result: NodeResult | None

    # ── Episode context (frozen after N05, loaded once) ─────────────────
    episode_context_ref: str | None  # artifact / TOS URL

    # ── Node output references (node_id → scope-aware ref) ──────────────
    node_outputs: dict[str, NodeOutputRef]

    # ── Quality tracking ────────────────────────────────────────────────
    qc_scores: dict[str, float]  # qc_node_id → weighted_average
    auto_reject_counts: dict[str, int]  # reject_target_node_id → count

    # ── Gate state ──────────────────────────────────────────────────────
    gate: GateState | None

    # ── Accumulated cost ────────────────────────────────────────────────
    total_cost_cny: float
    total_gpu_seconds: float

    # ── Rerun control ───────────────────────────────────────────────────
    is_rerun: bool
    rerun_node_ids: list[str] | None
    rerun_from_ticket_id: str | None

    # ── Termination control ─────────────────────────────────────────────
    should_terminate: bool
    termination_reason: str | None

    # ── Observability ───────────────────────────────────────────────────
    warnings: list[str]
    errors: list[str]


def make_initial_state(
    *,
    run_id: str,
    episode_id: str,
    episode_version_id: str,
    project_id: str = "",
    langgraph_thread_id: str = "",
    is_rerun: bool = False,
    rerun_node_ids: list[str] | None = None,
    rerun_from_ticket_id: str | None = None,
) -> PipelineState:
    """Construct a fresh PipelineState for a new (or rerun) pipeline execution."""
    return PipelineState(
        run_id=run_id,
        episode_id=episode_id,
        episode_version_id=episode_version_id,
        project_id=project_id,
        langgraph_thread_id=langgraph_thread_id,
        current_node_id=None,
        current_stage_no=None,
        next_node_id=None,
        completed_nodes=[],
        last_result=None,
        episode_context_ref=None,
        node_outputs={},
        qc_scores={},
        auto_reject_counts={},
        gate=None,
        total_cost_cny=0.0,
        total_gpu_seconds=0.0,
        is_rerun=is_rerun,
        rerun_node_ids=rerun_node_ids,
        rerun_from_ticket_id=rerun_from_ticket_id,
        should_terminate=False,
        termination_reason=None,
        warnings=[],
        errors=[],
    )
