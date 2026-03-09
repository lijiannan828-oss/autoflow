"""Supervisor node — central routing brain of the pipeline graph.

The Supervisor inspects the latest ``PipelineState``, determines the next
action (advance, reject, gate-wait, terminate), and writes the routing
decision back into state.  All heavy logic (model calls, artifact writes)
lives in Workers and Gates; the Supervisor is pure control flow.
"""

from __future__ import annotations

import logging
from typing import Any

from .state import NodeResult, PipelineState
from .topology import (
    GATE_NODES,
    MAX_AUTO_REJECTS,
    NODE_SUCCESSOR,
    PIPELINE_NODES,
    QC_NODES,
    QC_REJECT_TARGET,
    is_gate,
    should_skip_in_rerun,
    stage_no_for_node,
)

logger = logging.getLogger(__name__)


def supervisor_node(state: PipelineState) -> dict[str, Any]:
    """Evaluate the current pipeline state and decide the next step.

    Returns a *partial* state update consumed by LangGraph's state merge.
    The routing function ``route_after_supervisor`` reads ``next_node_id``
    (or ``should_terminate``) from the merged state to pick the next edge.
    """

    last: NodeResult | None = state.get("last_result")

    # ── First invocation (no previous result) ───────────────────────────
    if last is None:
        first_node = _pick_first_node(state)
        logger.info("supervisor: initial dispatch → %s", first_node)
        return {
            "next_node_id": first_node,
            "current_node_id": first_node,
            "current_stage_no": stage_no_for_node(first_node),
        }

    node_id: str = last["node_id"]
    status: str = last.get("status", "failed")

    # ── Handle failure ──────────────────────────────────────────────────
    if status == "failed":
        logger.error("supervisor: node %s failed — terminating", node_id)
        return _terminate(f"node {node_id} failed: {last.get('error', 'unknown')}")

    # ── Handle QC auto-reject ───────────────────────────────────────────
    if status == "auto_rejected" and node_id in QC_NODES:
        return _handle_auto_reject(state, node_id)

    # ── Gate returned (after resume) ────────────────────────────────────
    gate = state.get("gate")
    if gate and gate.get("decision") == "returned":
        logger.info("supervisor: gate %s returned — terminating (will spawn ReturnTicket)", gate["gate_node_id"])
        return _terminate(
            f"gate {gate['gate_node_id']} returned",
            return_ticket_id=gate.get("return_ticket_id"),
        )

    # ── Gate partial_approved — re-pause for more reviews ────────────
    if gate and gate.get("decision") == "partial_approved":
        gate_nid = gate["gate_node_id"]
        logger.info(
            "supervisor: gate %s partial_approved — routing back to gate_resume for re-pause",
            gate_nid,
        )
        return {
            "next_node_id": f"gate_resume_{gate_nid}",
            "current_node_id": gate_nid,
        }

    # ── Normal advance ──────────────────────────────────────────────────
    completed = set(state.get("completed_nodes", []))
    completed.add(node_id)

    nxt = _advance(node_id, state, completed)
    if nxt is None:
        logger.info("supervisor: pipeline complete after %s", node_id)
        return {
            "should_terminate": True,
            "termination_reason": "pipeline_complete",
            "current_node_id": None,
            "completed_nodes": list(completed),
        }

    logger.info("supervisor: %s → %s", node_id, nxt)
    return {
        "next_node_id": nxt,
        "current_node_id": nxt,
        "current_stage_no": stage_no_for_node(nxt),
        "completed_nodes": list(completed),
        "gate": None,  # clear any stale gate state
    }


# ── Routing function (consumed by add_conditional_edges) ────────────────

def route_after_supervisor(state: PipelineState) -> str:
    """Return the node name (or ``__end__``) for the next graph edge."""
    if state.get("should_terminate"):
        return "__end__"
    nxt = state.get("next_node_id")
    if not nxt:
        return "__end__"
    return nxt


# ── Internal helpers ────────────────────────────────────────────────────

def _pick_first_node(state: PipelineState) -> str:
    """Determine the first node to execute for a new or rerun pipeline."""
    rerun_ids = state.get("rerun_node_ids")
    if state.get("is_rerun") and rerun_ids:
        for nid in PIPELINE_NODES:
            if nid in rerun_ids:
                return nid
        return rerun_ids[0]
    return "N01"


def _advance(
    current_node_id: str,
    state: PipelineState,
    completed: set[str],
) -> str | None:
    """Walk the DAG forward, skipping rerun-excluded nodes."""
    nxt: str | None = NODE_SUCCESSOR.get(current_node_id)
    rerun_ids = state.get("rerun_node_ids")
    while nxt is not None:
        if should_skip_in_rerun(nxt, rerun_ids):
            completed.add(nxt)
            nxt = NODE_SUCCESSOR.get(nxt)
            continue
        return nxt
    return None


def _handle_auto_reject(state: PipelineState, qc_node_id: str) -> dict[str, Any]:
    reject_target = QC_REJECT_TARGET[qc_node_id]
    counters = dict(state.get("auto_reject_counts", {}))
    count = counters.get(reject_target, 0) + 1
    counters[reject_target] = count

    if count > MAX_AUTO_REJECTS:
        # 超过上限不终止流水线，继续往下走并加入预警
        warning_msg = (
            f"QC auto-reject limit ({MAX_AUTO_REJECTS}) exceeded for "
            f"{reject_target} via {qc_node_id} (count={count}) — "
            f"skipping retry, advancing pipeline with warning"
        )
        logger.warning("supervisor: %s", warning_msg)

        completed = set(state.get("completed_nodes", []))
        completed.add(qc_node_id)
        nxt = _advance(qc_node_id, state, completed)

        warnings = list(state.get("warnings", []))
        warnings.append(warning_msg)

        if nxt is None:
            return {
                "should_terminate": True,
                "termination_reason": "pipeline_complete",
                "current_node_id": None,
                "completed_nodes": list(completed),
                "auto_reject_counts": counters,
                "warnings": warnings,
            }

        return {
            "next_node_id": nxt,
            "current_node_id": nxt,
            "current_stage_no": stage_no_for_node(nxt),
            "completed_nodes": list(completed),
            "auto_reject_counts": counters,
            "warnings": warnings,
            "gate": None,
        }

    logger.info(
        "supervisor: QC %s auto-rejected (%d/%d) → re-dispatch to %s",
        qc_node_id, count, MAX_AUTO_REJECTS, reject_target,
    )
    return {
        "next_node_id": reject_target,
        "current_node_id": reject_target,
        "current_stage_no": stage_no_for_node(reject_target),
        "auto_reject_counts": counters,
    }


def _terminate(reason: str, *, return_ticket_id: str | None = None) -> dict[str, Any]:
    update: dict[str, Any] = {
        "should_terminate": True,
        "termination_reason": reason,
        "current_node_id": None,
        "next_node_id": None,
    }
    if return_ticket_id:
        update["gate"] = {"return_ticket_id": return_ticket_id}
    return update
