"""Gate node logic — human-in-the-loop review gates.

Each of the 4 Gate nodes (N08, N18, N21, N24) shares a two-phase lifecycle:

1. **Enter** (``gate_enter_node``):  Create the *first batch* of ReviewTasks,
   write ``GateState`` into ``PipelineState``, and pause the graph
   (``interrupt_before``).  For serial multi-step gates (N24), only Step 1's
   task is created; subsequent steps are activated by ``gate_resume``.

2. **Resume** (``gate_resume_node``):  Called after the external API injects
   review decisions.  Evaluates scope-item statuses (N08 per-asset, N18
   per-shot) or serial step progression (N24) and either advances the
   pipeline, continues waiting, or terminates with a ReturnTicket.

Gate patterns
-------------
- **N08** (asset-level): One ReviewTask per asset. Partial approve supported.
  All assets approved → gate approved.  Single asset returned → ReturnTicket
  for that asset only.
- **N18** (shot-level): One ReviewTask per shot.  All shots approved →
  episode-level gate approved.  Single shot returned → only that shot re-enters
  N14.
- **N21** (episode-level): Single ReviewTask.  Simple approve / return.
- **N24** (serial 3-step): Steps activated one at a time.  Step N must pass
  before Step N+1's task is created.  Any step returned → terminate.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

try:
    from backend.common.db import fetch_all
except ImportError:
    fetch_all = None  # type: ignore[assignment]

from .state import GateScopeItem, GateState, NodeResult, PipelineState
from .topology import (
    GATE_STAGE_BY_NODE,
)

logger = logging.getLogger(__name__)

GATE_REVIEW_CONFIG: dict[str, list[dict[str, Any]]] = {
    "N08": [
        {"step_no": 1, "reviewer_role": "middle_platform", "granularity": "asset", "skippable": False},
    ],
    "N18": [
        {"step_no": 1, "reviewer_role": "qc_inspector", "granularity": "shot", "skippable": False},
    ],
    "N21": [
        {"step_no": 1, "reviewer_role": "qc_inspector", "granularity": "episode", "skippable": False},
    ],
    "N24": [
        {"step_no": 1, "reviewer_role": "qc_inspector", "granularity": "episode", "skippable": True},
        {"step_no": 2, "reviewer_role": "middle_platform", "granularity": "episode", "skippable": False},
        {"step_no": 3, "reviewer_role": "partner", "granularity": "episode", "skippable": False},
    ],
}

_GATE_SCOPE: dict[str, str] = {
    "N08": "asset",
    "N18": "shot",
    "N21": "episode",
    "N24": "episode",
}


def make_gate_enter_node(gate_node_id: str):
    """Create a LangGraph node function that enters a Gate.

    For single-step gates (N08, N18, N21), creates all scope-item tasks.
    For serial multi-step gates (N24), creates only Step 1's task.
    """

    stage_no = GATE_STAGE_BY_NODE[gate_node_id]
    steps = GATE_REVIEW_CONFIG[gate_node_id]
    scope = _GATE_SCOPE[gate_node_id]
    is_serial = len(steps) > 1

    def _gate_enter(state: PipelineState) -> dict[str, Any]:
        logger.info("gate_enter: %s (stage %d, scope=%s)", gate_node_id, stage_no, scope)

        if is_serial:
            first_step = steps[0]
            task_ids = _create_review_tasks(
                gate_node_id=gate_node_id,
                stage_no=stage_no,
                episode_id=state.get("episode_id", ""),
                episode_version_id=state.get("episode_version_id", ""),
                step=first_step,
                scope=scope,
                state=state,
            )
            scope_items: list[GateScopeItem] = []
        else:
            task_ids = _create_review_tasks(
                gate_node_id=gate_node_id,
                stage_no=stage_no,
                episode_id=state.get("episode_id", ""),
                episode_version_id=state.get("episode_version_id", ""),
                step=steps[0],
                scope=scope,
                state=state,
            )
            scope_items = _build_scope_items(task_ids, scope, state)

        gate = GateState(
            gate_node_id=gate_node_id,
            stage_no=stage_no,
            scope=scope,
            scope_items=scope_items,
            review_task_ids=task_ids,
            decision=None,
            return_ticket_id=None,
            current_step_no=1,
            total_steps=len(steps),
            steps_completed=[],
        )

        return {
            "gate": gate,
            "current_node_id": gate_node_id,
            "last_result": NodeResult(
                node_id=gate_node_id,
                status="succeeded",
                artifact_ids=[],
                cost_cny=0.0,
                gpu_seconds=0.0,
                duration_s=0.0,
            ),
        }

    _gate_enter.__name__ = f"gate_enter_{gate_node_id}"
    return _gate_enter


def make_gate_resume_node(gate_node_id: str):
    """Create a LangGraph node function that processes a Gate resume.

    Handles three patterns:
    - scope-item aggregation (N08/N18): check if all items approved
    - serial step progression (N24): advance to next step or finish
    - simple episode gate (N21): direct approve/return
    """

    stage_no = GATE_STAGE_BY_NODE[gate_node_id]
    steps = GATE_REVIEW_CONFIG[gate_node_id]
    is_serial = len(steps) > 1

    def _gate_resume(state: PipelineState) -> dict[str, Any]:
        gate = state.get("gate")
        if not gate:
            logger.error("gate_resume: no gate state for %s", gate_node_id)
            return {
                "should_terminate": True,
                "termination_reason": f"gate_resume called without gate state for {gate_node_id}",
            }

        decision = gate.get("decision")
        logger.info("gate_resume: %s decision=%s step=%s", gate_node_id, decision, gate.get("current_step_no"))

        if decision == "returned":
            return {
                "last_result": NodeResult(
                    node_id=gate_node_id,
                    status="succeeded",
                    artifact_ids=[],
                    cost_cny=0.0,
                    gpu_seconds=0.0,
                    duration_s=0.0,
                ),
            }

        if decision == "approved":
            if is_serial:
                return _handle_serial_step_approved(gate, state, steps, stage_no, gate_node_id)

            incomplete = _check_scope_items_complete(gate)
            if incomplete:
                logger.warning(
                    "gate_resume: %s decision=approved but %d scope items not approved — "
                    "demoting to partial_approved (defense-in-depth)",
                    gate_node_id, len(incomplete),
                )
                updated_gate = dict(gate)
                updated_gate["decision"] = "partial_approved"
                return {
                    "gate": updated_gate,
                    "warnings": list(state.get("warnings", [])) + [
                        f"{gate_node_id}: approved with {len(incomplete)} incomplete scope items: {incomplete}"
                    ],
                }

            return {
                "gate": GateState(
                    gate_node_id=gate_node_id,
                    stage_no=stage_no,
                    scope=gate.get("scope", "episode"),
                    scope_items=gate.get("scope_items", []),
                    review_task_ids=gate.get("review_task_ids", []),
                    decision="approved",
                    steps_completed=gate.get("steps_completed", []),
                    current_step_no=gate.get("current_step_no", 1),
                    total_steps=gate.get("total_steps", 1),
                ),
                "last_result": NodeResult(
                    node_id=gate_node_id,
                    status="succeeded",
                    artifact_ids=[],
                    cost_cny=0.0,
                    gpu_seconds=0.0,
                    duration_s=0.0,
                ),
            }

        if decision == "partial_approved":
            updated_gate = dict(gate)
            updated_gate["decision"] = "partial_approved"
            return {"gate": updated_gate}

        logger.warning("gate_resume: unexpected decision %s for %s", decision, gate_node_id)
        return {}

    _gate_resume.__name__ = f"gate_resume_{gate_node_id}"
    return _gate_resume


def _check_scope_items_complete(gate: GateState) -> list[str]:
    """Return scope_ids of items that are NOT approved.

    If scope_items is empty (stub / episode-level gate), returns [] —
    meaning "nothing to block".  This is the defense-in-depth guard:
    the external review API is responsible for aggregation, but if it
    incorrectly injects approved while items are still pending/returned,
    we catch it here.
    """
    items = gate.get("scope_items", [])
    if not items:
        return []
    return [
        item.get("scope_id", "?")
        for item in items
        if item.get("status") != "approved"
    ]


def _handle_serial_step_approved(
    gate: GateState,
    state: PipelineState,
    steps: list[dict[str, Any]],
    stage_no: int,
    gate_node_id: str,
) -> dict[str, Any]:
    """Advance to the next serial step or finalize the gate."""
    current = gate.get("current_step_no", 1)
    completed = list(gate.get("steps_completed", []))
    completed.append(current)

    if current >= len(steps):
        return {
            "gate": GateState(
                gate_node_id=gate_node_id,
                stage_no=stage_no,
                scope="episode",
                scope_items=[],
                review_task_ids=gate.get("review_task_ids", []),
                decision="approved",
                current_step_no=current,
                total_steps=len(steps),
                steps_completed=completed,
            ),
            "last_result": NodeResult(
                node_id=gate_node_id,
                status="succeeded",
                artifact_ids=[],
                cost_cny=0.0,
                gpu_seconds=0.0,
                duration_s=0.0,
            ),
        }

    next_step_no = current + 1
    next_step = steps[next_step_no - 1]
    new_task_ids = _create_review_tasks(
        gate_node_id=gate_node_id,
        stage_no=stage_no,
        episode_id=state.get("episode_id", ""),
        episode_version_id=state.get("episode_version_id", ""),
        step=next_step,
        scope="episode",
        state=state,
    )

    all_task_ids = list(gate.get("review_task_ids", [])) + new_task_ids

    return {
        "gate": GateState(
            gate_node_id=gate_node_id,
            stage_no=stage_no,
            scope="episode",
            scope_items=[],
            review_task_ids=all_task_ids,
            decision=None,
            current_step_no=next_step_no,
            total_steps=len(steps),
            steps_completed=completed,
        ),
    }


def _build_scope_items(
    task_ids: list[str],
    scope: str,
    state: PipelineState,
) -> list[GateScopeItem]:
    """Build initial scope items for non-serial gates.

    In production, the scope_ids come from the upstream node's output
    (e.g., N07's asset list for N08, N17's shot list for N18).
    The stub creates one item per task.
    """
    if task_ids and fetch_all is not None:
        rows = fetch_all(
            """
            select
                id::text as id,
                anchor_id::text as anchor_id,
                payload_json
            from public.review_tasks
            where id::text = any(%s)
            """,
            (task_ids,),
        )
        row_by_id = {row["id"]: row for row in rows}
        if row_by_id:
            items: list[GateScopeItem] = []
            for task_id in task_ids:
                row = row_by_id.get(task_id) or {}
                payload = row.get("payload_json") or {}
                scope_id = (
                    payload.get("scope_id")
                    if isinstance(payload, dict)
                    else None
                ) or row.get("anchor_id") or task_id
                items.append(
                    GateScopeItem(
                        scope_id=str(scope_id),
                        status="pending",
                        review_task_id=task_id,
                    )
                )
            return items

    return [
        GateScopeItem(
            scope_id=f"stub_{scope}_{i}",
            status="pending",
            review_task_id=tid,
        )
        for i, tid in enumerate(task_ids)
    ]


# ── Review-task creation ────────────────────────────────────────────────

_review_task_creator: Any = None


def set_review_task_creator(fn: Any) -> None:
    """Inject the production review-task creator (DB writes)."""
    global _review_task_creator
    _review_task_creator = fn


def _create_review_tasks(
    *,
    gate_node_id: str,
    stage_no: int,
    episode_id: str,
    episode_version_id: str,
    step: dict[str, Any],
    scope: str,
    state: PipelineState,
) -> list[str]:
    """Create review tasks for a single step.

    For scope-aware gates (N08 asset, N18 shot), production creates one
    task per scope item.  The stub creates a single synthetic task.
    """
    if _review_task_creator is not None:
        return _review_task_creator(
            gate_node_id=gate_node_id,
            stage_no=stage_no,
            episode_id=episode_id,
            episode_version_id=episode_version_id,
            step=step,
            scope=scope,
            state=state,
        )

    task_ids = [str(uuid4())]
    logger.info(
        "gate stub: created %d review task(s) for %s step %d (scope=%s)",
        len(task_ids), gate_node_id, step["step_no"], scope,
    )
    return task_ids
