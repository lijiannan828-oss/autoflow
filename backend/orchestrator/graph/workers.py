"""Worker node factory — creates LangGraph-compatible node functions for each
pipeline step.

Each worker follows the same lifecycle:
1. Load node configuration (from topology or DB cache).
2. Assemble input envelope from upstream outputs in state.
3. Invoke the *handler* (model call, ComfyUI job, LLM chain, etc.).
4. Persist artifacts and update DB (node_runs, artifacts tables).
5. Return a ``NodeResult`` that the Supervisor uses for routing.

For MVP-0 the handler implementations are **stubs** that return synthetic
results.  Real handlers are registered via ``register_handler`` and will be
built in Phase 4 (T8.1–T8.6).
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime
from typing import Any, Callable, Protocol
from uuid import UUID, uuid4

try:
    from psycopg.types.json import Jsonb
except ImportError:
    Jsonb = None  # type: ignore[assignment,misc]

try:
    from backend.common.db import execute, execute_returning_one
except ImportError:
    execute = None  # type: ignore[assignment]
    execute_returning_one = None  # type: ignore[assignment]

try:
    from backend.orchestrator.write_side import auto_reject_node_run, record_node_run_artifacts
except ImportError:
    auto_reject_node_run = None  # type: ignore[assignment]
    record_node_run_artifacts = None  # type: ignore[assignment]

from .context import build_node_input_envelope
from .state import NodeOutputRef, NodeResult, PipelineState
from .topology import (
    NODE_AGENT_ROLE,
    QC_NODES,
    STAGE_GROUP,
    output_scope,
    stage_no_for_node,
)

logger = logging.getLogger(__name__)

# ── Three-layer decision routing (v2.2 §2.5) ────────────────────────
# Maps each node to the decision layer its Agent should run in.
# This is the SOLE authority for setting context.mode.

try:
    from backend.agents.base import DecisionMode
except ImportError:
    DecisionMode = str  # type: ignore[assignment,misc]

NODE_DECISION_LAYER: dict[str, "DecisionMode"] = {
    # ── Layer 1: Episode-level planning (plan_episode) ──
    "N01": "plan",     # ScriptAnalyst: script parsing
    "N02": "plan",     # ShotDesigner: episode shot breakdown
    "N06": "plan",     # VisualDirector: episode visual strategy
    "N07b": "plan",    # AudioDirector: voice scheme

    # ── Layer 2: Shot-level execution (execute_shot) ──
    "N04": "shot",     # ShotDesigner: per-shot params
    "N05": "shot",     # ShotDesigner: shot refinement
    "N07": "shot",     # VisualDirector: art generation
    "N09": "shot",     # VisualDirector: keyframe optimization
    "N10": "shot",     # VisualDirector: keyframe generation
    "N13": "shot",     # VisualDirector: video preprocessing
    "N14": "shot",     # VisualDirector: video generation
    "N16b": "shot",    # ShotDesigner: tone/pacing adjustment
    "N17": "shot",     # VisualDirector: video postprocessing
    "N19": "shot",     # VisualDirector: subtitle compositing
    "N20": "shot",     # AudioDirector: BGM/SFX generation
    "N22": "shot",     # AudioDirector: audio mixing
    "N23": "shot",     # Compositor: AV compositing
    "N25": "shot",     # Compositor: intro/outro
    "N26": "shot",     # Compositor: final output

    # ── Layer 3: Batch review (review_batch) ──
    "N03": "review",   # QualityInspector: storyboard QC
    "N11": "review",   # QualityInspector: keyframe QC
    "N12": "review",   # QualityInspector: visual continuity
    "N15": "review",   # QualityInspector: video QC
    "N16": "review",   # ShotDesigner: continuity review

    # ── Legacy (Gates — not three-layer) ──
    "N08": "legacy",   # ReviewDispatcher: Gate
    "N18": "legacy",   # ReviewDispatcher: Gate
    "N21": "legacy",   # ReviewDispatcher: Gate
    "N24": "legacy",   # ReviewDispatcher: Gate
}

# ── Agent bridge (v2.2) ──────────────────────────────────────────────
# When no handler is registered for a node but the Agent registry has an
# agent matching NODE_AGENT_ROLE[node_id], the worker delegates to the
# agent's execute() method and converts AgentResult → NodeResult.

_AGENT_BRIDGE_ENABLED = True  # set False to disable agent delegation


def _try_agent_bridge(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult | None:
    """Attempt to execute via the v2.2 Agent registry.

    Returns NodeResult on success, None if no suitable agent is registered
    or if the bridge is disabled.
    """
    if not _AGENT_BRIDGE_ENABLED:
        return None

    agent_role = NODE_AGENT_ROLE.get(node_id)
    if not agent_role:
        return None

    try:
        from backend.agents.registry import get_agent, is_registered
        from backend.agents.base import AgentContext
    except ImportError:
        return None

    if not is_registered(agent_role):
        return None

    try:
        agent = get_agent(agent_role)
    except KeyError:
        return None

    # Build AgentContext from PipelineState
    decision_mode = NODE_DECISION_LAYER.get(node_id, "legacy")
    context = AgentContext(
        run_id=state.get("run_id", ""),
        episode_version_id=state.get("episode_version_id", ""),
        node_id=node_id,
        project_id=state.get("project_id", ""),
        genre=None,
        mode=decision_mode,
        cost_budget_remaining=None,
        extra={
            "input_envelope": config.get("input_envelope", {}),
            "upstream_outputs": config.get("upstream_outputs", {}),
            "stage_group": config.get("stage_group", ""),
            "total_cost_cny": state.get("total_cost_cny", 0.0),
            "total_gpu_seconds": state.get("total_gpu_seconds", 0.0),
        },
    )

    t0 = time.monotonic()
    try:
        agent_result = agent.execute(context)
    except Exception as exc:
        logger.warning("agent bridge %s/%s failed: %s", node_id, agent_role, exc)
        return None

    duration_s = time.monotonic() - t0

    # Convert AgentResult → NodeResult
    ev_id = state.get("episode_version_id") or "unknown"
    output_ref = f"agent://{ev_id}/{node_id}/output.json"

    # Merge agent traces into state
    agent_traces = list(state.get("agent_traces", []))
    agent_traces.extend(agent_result.traces)

    return NodeResult(
        node_id=node_id,
        status="succeeded" if agent_result.success else "failed",
        output_ref=output_ref,
        artifact_ids=[],
        cost_cny=agent_result.cost_cny,
        gpu_seconds=0.0,
        duration_s=duration_s,
        error=agent_result.error,
        error_code="AGENT_ERROR" if agent_result.error else None,
        model_provider=agent_role,
        model_endpoint=f"agent:{agent_role}",
        output_payload=agent_result.output,
        _agent_traces=agent_traces,
    )


class NodeHandler(Protocol):
    """Interface every real node implementation must satisfy."""

    def __call__(
        self,
        node_id: str,
        state: PipelineState,
        config: dict[str, Any],
    ) -> NodeResult: ...


# ── Handler registry ────────────────────────────────────────────────────

_handlers: dict[str, NodeHandler] = {}
_output_payload_cache: dict[str, Any] = {}


def register_handler(node_id: str, handler: NodeHandler) -> None:
    """Register a concrete handler for a pipeline node."""
    _handlers[node_id] = handler


def get_handler(node_id: str) -> NodeHandler | None:
    return _handlers.get(node_id)


def get_cached_output_payload(output_ref: str) -> Any | None:
    return _output_payload_cache.get(output_ref)


# ── Stub handler (MVP-0 default) ───────────────────────────────────────

def _stub_handler(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """Synthetic handler that simulates success with zero cost."""
    logger.info("stub handler executing for %s", node_id)
    return NodeResult(
        node_id=node_id,
        status="succeeded",
        output_ref=f"stub://{state.get('episode_version_id', 'unknown')}/{node_id}/output.json",
        quality_score=9.0 if node_id in QC_NODES else None,
        artifact_ids=[],
        cost_cny=0.0,
        gpu_seconds=0.0,
        duration_s=0.0,
        error=None,
        error_code=None,
        node_run_id=None,
        model_provider=None,
        model_endpoint=None,
    )


# ── QC stub: simulates pass/fail with configurable threshold ───────────

def _qc_stub_handler(node_id: str, state: PipelineState, config: dict[str, Any]) -> NodeResult:
    """QC stub that always passes.  Override via ``register_handler``."""
    score = 9.0
    return NodeResult(
        node_id=node_id,
        status="succeeded",
        output_ref=f"stub://{state.get('episode_version_id', 'unknown')}/{node_id}/qc.json",
        quality_score=score,
        artifact_ids=[],
        cost_cny=0.0,
        gpu_seconds=0.0,
        duration_s=0.0,
        error=None,
    )


# ── Worker node factory ────────────────────────────────────────────────

def make_worker_node(node_id: str) -> Callable[[PipelineState], dict[str, Any]]:
    """Return a LangGraph node function bound to *node_id*.

    The returned callable:
    - Picks the registered handler or falls back to the stub.
    - Executes it and wraps the result into a state update.
    - Writes ``NodeOutputRef`` (with scope metadata) into ``node_outputs``.
    """

    def _node(state: PipelineState) -> dict[str, Any]:
        config: dict[str, Any] = {
            "node_id": node_id,
            "agent_role": NODE_AGENT_ROLE.get(node_id, "unknown"),
            "stage_group": STAGE_GROUP.get(node_id, "unknown"),
            "upstream_outputs": _collect_upstream_outputs(node_id, state),
            "input_envelope": build_node_input_envelope(node_id, state),
        }

        # Resolution order: registered handler → agent bridge → stub
        handler = _handlers.get(node_id)
        if handler is None:
            agent_result = _try_agent_bridge(node_id, state, config)
            if agent_result is not None:
                # Propagate agent traces to state update
                result = agent_result
                _cache_output_payload(result)
                result = _persist_execution_result(node_id, state, config, result)

                cost = result.get("cost_cny", 0.0)
                gpu = result.get("gpu_seconds", 0.0)
                output_ref = result.get("output_ref")

                node_outputs = dict(state.get("node_outputs", {}))
                if output_ref:
                    node_outputs[node_id] = NodeOutputRef(
                        output_ref=output_ref,
                        node_run_id=result.get("node_run_id"),
                        scope=output_scope(node_id),
                    )

                update: dict[str, Any] = {
                    "last_result": result,
                    "current_node_id": node_id,
                    "node_outputs": node_outputs,
                    "total_cost_cny": state.get("total_cost_cny", 0.0) + cost,
                    "total_gpu_seconds": state.get("total_gpu_seconds", 0.0) + gpu,
                }
                # Propagate agent traces
                traces = result.get("_agent_traces")
                if traces:
                    update["agent_traces"] = traces

                if node_id == "N01" and output_ref:
                    update["episode_context_ref"] = output_ref

                score = result.get("quality_score")
                if score is not None and node_id in QC_NODES:
                    qc_scores = dict(state.get("qc_scores", {}))
                    qc_scores[node_id] = score
                    update["qc_scores"] = qc_scores

                return update

            # No handler, no agent — use stub
            handler = _qc_stub_handler if node_id in QC_NODES else _stub_handler

        t0 = time.monotonic()
        try:
            result = handler(node_id, state, config)
        except Exception as exc:
            logger.exception("worker %s raised", node_id)
            result = NodeResult(
                node_id=node_id,
                status="failed",
                error=str(exc),
                error_code="HANDLER_EXCEPTION",
                artifact_ids=[],
                cost_cny=0.0,
                gpu_seconds=0.0,
                duration_s=time.monotonic() - t0,
            )

        result.setdefault("duration_s", time.monotonic() - t0)
        result.setdefault("node_id", node_id)
        _cache_output_payload(result)
        result = _persist_execution_result(node_id, state, config, result)

        cost = result.get("cost_cny", 0.0)
        gpu = result.get("gpu_seconds", 0.0)
        output_ref = result.get("output_ref")

        node_outputs = dict(state.get("node_outputs", {}))
        if output_ref:
            node_outputs[node_id] = NodeOutputRef(
                output_ref=output_ref,
                node_run_id=result.get("node_run_id"),
                scope=output_scope(node_id),
            )

        update: dict[str, Any] = {
            "last_result": result,
            "current_node_id": node_id,
            "node_outputs": node_outputs,
            "total_cost_cny": state.get("total_cost_cny", 0.0) + cost,
            "total_gpu_seconds": state.get("total_gpu_seconds", 0.0) + gpu,
        }
        if node_id == "N01" and output_ref:
            update["episode_context_ref"] = output_ref

        score = result.get("quality_score")
        if score is not None and node_id in QC_NODES:
            qc_scores = dict(state.get("qc_scores", {}))
            qc_scores[node_id] = score
            update["qc_scores"] = qc_scores

        return update

    _node.__name__ = f"worker_{node_id}"
    _node.__qualname__ = f"make_worker_node.<locals>.worker_{node_id}"
    return _node


def _collect_upstream_outputs(node_id: str, state: PipelineState) -> dict[str, str]:
    """Gather output references from upstream nodes.

    Returns ``{dep_node_id: output_ref_url}`` — extracts the URL string
    from the ``NodeOutputRef`` wrapper.
    """
    from .topology import NODE_DEPENDS_ON

    deps = NODE_DEPENDS_ON.get(node_id, [])
    outputs = state.get("node_outputs", {})
    result: dict[str, str] = {}
    for dep in deps:
        ref = outputs.get(dep)
        if ref is not None:
            result[dep] = ref.get("output_ref", "") if isinstance(ref, dict) else str(ref)
    return result


def _persist_execution_result(
    node_id: str,
    state: PipelineState,
    config: dict[str, Any],
    result: NodeResult,
) -> NodeResult:
    """Persist a minimal node_run/artifact footprint when DB context exists."""
    run_id = state.get("run_id")
    episode_version_id = state.get("episode_version_id")
    if not run_id or not episode_version_id:
        return result
    if not _is_uuid_like(run_id) or not _is_uuid_like(episode_version_id):
        return result

    status = str(result.get("status") or "failed")
    node_run_id = result.get("node_run_id")
    input_ref = _default_input_ref(episode_version_id, node_id)
    output_ref = result.get("output_ref")

    try:
        if not node_run_id:
            node_run_id = _upsert_node_run_record(
                run_id=run_id,
                episode_version_id=episode_version_id,
                node_id=node_id,
                agent_role=str(config.get("agent_role") or NODE_AGENT_ROLE.get(node_id, "unknown")),
                status=status,
                input_ref=input_ref,
                output_ref=output_ref,
                quality_score=result.get("quality_score"),
                model_provider=result.get("model_provider"),
                model_endpoint=result.get("model_endpoint"),
                gpu_seconds=float(result.get("gpu_seconds") or 0.0),
                cost_cny=float(result.get("cost_cny") or 0.0),
                duration_s=float(result.get("duration_s") or 0.0),
                error_code=result.get("error_code"),
                error_message=result.get("error"),
            )
            result["node_run_id"] = node_run_id

        _update_run_cursor(run_id=run_id, node_id=node_id)

        if output_ref and node_run_id:
            artifact_result = record_node_run_artifacts(
                node_run_id,
                [
                    {
                        "artifact_type": _artifact_type_for_node(node_id),
                        "resource_url": output_ref,
                        "preview_url": output_ref,
                        "seed_namespace": "langgraph-runtime",
                        "meta_json": {
                            "source": "langgraph_worker",
                            "node_id": node_id,
                            "stage_group": config.get("stage_group"),
                            **(
                                {"output_payload": result.get("output_payload")}
                                if result.get("output_payload") is not None
                                else {}
                            ),
                            **(
                                {"output_envelope": result.get("output_envelope")}
                                if result.get("output_envelope") is not None
                                else {}
                            ),
                        },
                    }
                ],
            )
            artifact_ids = list(result.get("artifact_ids") or [])
            artifact_ids.extend(list(artifact_result.get("artifact_ids") or []))
            result["artifact_ids"] = artifact_ids

        if status == "auto_rejected" and node_run_id:
            auto_reject_node_run(
                node_run_id,
                issue_type="storyboard",
                comment=str(result.get("error") or f"{node_id} auto rejected"),
                severity="major",
                quality_score=float(result.get("quality_score") or 0.0) or None,
                error_code=str(result.get("error_code") or "AUTO_REJECTED"),
            )
    except Exception as exc:
        logger.warning("worker %s persistence skipped: %s", node_id, exc)

    return result


def _upsert_node_run_record(
    *,
    run_id: str,
    episode_version_id: str,
    node_id: str,
    agent_role: str,
    status: str,
    input_ref: str | None,
    output_ref: str | None,
    quality_score: float | None,
    model_provider: str | None,
    model_endpoint: str | None,
    gpu_seconds: float,
    cost_cny: float,
    duration_s: float,
    error_code: str | None,
    error_message: str | None,
) -> str:
    now = datetime.now(UTC)
    ended_at = None if status in {"running", "pending"} else now

    row = execute_returning_one(
        """
        insert into core_pipeline.node_runs (
            id,
            run_id,
            episode_version_id,
            node_id,
            status,
            attempt_no,
            retry_count,
            input_ref,
            output_ref,
            model_provider,
            api_calls,
            token_in,
            token_out,
            gpu_seconds,
            cost_cny,
            error_code,
            error_message,
            tags,
            started_at,
            ended_at,
            duration_s,
            created_at,
            updated_at,
            agent_role,
            auto_reject_count,
            scope_hash,
            model_endpoint,
            comfyui_workflow_id,
            rag_query_count,
            quality_score
        ) values (
            %s, %s, %s, %s, %s, 1, 0, %s, %s, %s, 0, 0, 0, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, 0, %s, %s, null, 0, %s
        )
        on conflict (run_id, node_id, attempt_no) do update set
            status = excluded.status,
            input_ref = excluded.input_ref,
            output_ref = excluded.output_ref,
            model_provider = excluded.model_provider,
            gpu_seconds = excluded.gpu_seconds,
            cost_cny = excluded.cost_cny,
            error_code = excluded.error_code,
            error_message = excluded.error_message,
            tags = excluded.tags,
            started_at = excluded.started_at,
            ended_at = excluded.ended_at,
            duration_s = excluded.duration_s,
            updated_at = excluded.updated_at,
            agent_role = excluded.agent_role,
            scope_hash = excluded.scope_hash,
            model_endpoint = excluded.model_endpoint,
            quality_score = excluded.quality_score
        returning id::text as id
        """,
        (
            str(uuid4()),
            run_id,
            episode_version_id,
            node_id,
            status,
            input_ref,
            output_ref,
            model_provider,
            gpu_seconds,
            cost_cny,
            error_code,
            error_message,
            Jsonb(["langgraph-runtime"]),
            now,
            ended_at,
            duration_s,
            now,
            now,
            agent_role,
            f"langgraph-runtime:{run_id}:{node_id}",
            model_endpoint,
            quality_score,
        ),
    )
    if not row:
        raise RuntimeError(f"failed to upsert node_run for {node_id}")
    return str(row["id"])


def _update_run_cursor(*, run_id: str, node_id: str) -> None:
    execute(
        """
        update core_pipeline.runs
        set current_node_id = %s,
            current_stage_no = %s,
            updated_at = now()
        where id::text = %s
        """,
        (node_id, stage_no_for_node(node_id), run_id),
    )


def _default_input_ref(episode_version_id: str, node_id: str) -> str:
    return f"tos://autoflow-media/{episode_version_id}/{node_id}/input.json"


def _artifact_type_for_node(node_id: str) -> str:
    if node_id in {"N01", "N02"}:
        return "storyboard"
    if node_id == "N03":
        return "storyboard"
    if node_id in QC_NODES:
        return "qc_report"
    return "prompt_json"


def _is_uuid_like(value: str) -> bool:
    try:
        UUID(str(value))
        return True
    except (ValueError, TypeError):
        return False


def _cache_output_payload(result: NodeResult) -> None:
    output_ref = result.get("output_ref")
    output_payload = result.get("output_payload")
    if output_ref and output_payload is not None:
        _output_payload_cache[str(output_ref)] = output_payload
