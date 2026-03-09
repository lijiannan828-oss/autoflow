"""Celery tasks for pipeline execution.

These tasks run the LangGraph pipeline inside Celery workers.
The graph pauses at Gate nodes (interrupt_before); the API resumes
by calling ``resume_pipeline`` with gate decisions.
"""

from __future__ import annotations

from contextlib import contextmanager
import logging
from typing import Any
from uuid import uuid4

from backend.celery_app import app
from backend.common.db import execute, fetch_one, get_connection

logger = logging.getLogger(__name__)


@contextmanager
def compiled_graph_session(*, use_checkpointer: bool = True) -> Any:
    """Yield a compiled graph with an optional live PostgreSQL checkpointer."""
    from backend.orchestrator.graph.builder import compile_pipeline
    from backend.orchestrator.graph.runtime_hooks import (
        production_context_loader,
        production_review_task_creator,
    )

    if use_checkpointer:
        try:
            from langgraph.checkpoint.postgres import PostgresSaver
            from backend.common.db import get_database_config

            config = get_database_config()
            conn_string = (
                f"postgresql://{config.user}:{config.password}"
                f"@{config.host}:{config.port}/{config.dbname}"
                f"?sslmode={config.sslmode}"
            )
            saver_cm = PostgresSaver.from_conn_string(conn_string)
        except Exception as exc:
            logger.warning("Failed to initialize PostgresSaver, using in-memory: %s", exc)
        else:
            with saver_cm as checkpointer:
                checkpointer.setup()
                logger.info("Using PostgresSaver checkpointer")
                yield compile_pipeline(
                    checkpointer=checkpointer,
                    interrupt_before_gates=True,
                    context_loader=production_context_loader,
                    review_task_creator=production_review_task_creator,
                )
                return

    yield compile_pipeline(
        checkpointer=None,
        interrupt_before_gates=True,
        context_loader=production_context_loader,
        review_task_creator=production_review_task_creator,
    )


def _get_compiled_graph(*, use_checkpointer: bool = True) -> Any:
    """Backward-compatible helper for non-checkpointed graph access."""
    if use_checkpointer:
        raise RuntimeError("use compiled_graph_session() for checkpointed graph access")
    from backend.orchestrator.graph.builder import compile_pipeline
    from backend.orchestrator.graph.runtime_hooks import (
        production_context_loader,
        production_review_task_creator,
    )

    return compile_pipeline(
        checkpointer=None,
        interrupt_before_gates=True,
        context_loader=production_context_loader,
        review_task_creator=production_review_task_creator,
    )


def _create_run_record(
    *,
    episode_id: str,
    episode_version_id: str,
    thread_id: str,
    is_rerun: bool = False,
    rerun_node_ids: list[str] | None = None,
    rerun_from_ticket_id: str | None = None,
) -> str:
    """Insert a run record into core_pipeline.runs and return the run_id."""
    from psycopg.types.json import Jsonb
    from backend.common.db import execute_returning_one

    run_id = str(uuid4())
    plan_json = {
        "thread_id": thread_id,
        "is_rerun": is_rerun,
        "rerun_node_ids": rerun_node_ids or [],
        "rerun_from_ticket_id": rerun_from_ticket_id,
    }

    execute_returning_one(
        """
        INSERT INTO core_pipeline.runs (
            id, episode_id, episode_version_id, status,
            plan_json, langgraph_thread_id,
            created_at, updated_at
        ) VALUES (
            %s::uuid, %s::uuid, %s::uuid, 'running',
            %s, %s,
            now(), now()
        )
        RETURNING id::text
        """,
        (run_id, episode_id, episode_version_id, Jsonb(plan_json), thread_id),
    )
    return run_id


@app.task(bind=True, name="backend.pipeline_tasks.run_pipeline", max_retries=0)
def run_pipeline(
    self: Any,
    *,
    episode_id: str,
    episode_version_id: str,
    is_rerun: bool = False,
    rerun_node_ids: list[str] | None = None,
    rerun_from_ticket_id: str | None = None,
) -> dict[str, Any]:
    """Start a full pipeline execution for an episode version.

    The graph runs until it hits a Gate interrupt or completes.
    Returns the final state snapshot.
    """
    thread_id = str(uuid4())
    run_id = _create_run_record(
        episode_id=episode_id,
        episode_version_id=episode_version_id,
        thread_id=thread_id,
        is_rerun=is_rerun,
        rerun_node_ids=rerun_node_ids,
        rerun_from_ticket_id=rerun_from_ticket_id,
    )

    logger.info(
        "Starting pipeline run=%s thread=%s episode_version=%s rerun=%s",
        run_id, thread_id, episode_version_id, is_rerun,
    )

    from backend.orchestrator.graph.state import make_initial_state

    initial_state = make_initial_state(
        run_id=run_id,
        episode_id=episode_id,
        episode_version_id=episode_version_id,
        langgraph_thread_id=thread_id,
        is_rerun=is_rerun,
        rerun_node_ids=rerun_node_ids,
        rerun_from_ticket_id=rerun_from_ticket_id,
    )

    try:
        with compiled_graph_session(use_checkpointer=True) as compiled:
            config = {"configurable": {"thread_id": thread_id}}

            # Run graph until it hits an interrupt (gate) or completes
            for event in compiled.stream(initial_state, config=config):
                logger.info("Pipeline event: %s", _summarize_event(event))

            # Check if pipeline is interrupted (gate) or completed
            graph_state = compiled.get_state(config)
            interrupted = bool(graph_state.next)

            if interrupted:
                gate_node = graph_state.next[0] if graph_state.next else None
                logger.info("Pipeline paused at gate: %s (thread=%s)", gate_node, thread_id)
                _update_run_status(run_id, "waiting_gate", gate_node)
            else:
                logger.info("Pipeline completed (thread=%s)", thread_id)
                _update_run_status(run_id, "succeeded", None)

            return {
                "run_id": run_id,
                "thread_id": thread_id,
                "status": "waiting_gate" if interrupted else "succeeded",
                "paused_at": _normalize_graph_node_name(graph_state.next[0]) if interrupted else None,
            }

    except Exception as exc:
        logger.exception("Pipeline run failed: %s", exc)
        _update_run_status(run_id, "failed", None)
        return {
            "run_id": run_id,
            "thread_id": thread_id,
            "status": "failed",
            "error": str(exc),
        }


@app.task(bind=True, name="backend.pipeline_tasks.resume_pipeline", max_retries=0)
def resume_pipeline(
    self: Any,
    *,
    thread_id: str,
    run_id: str,
    gate_decision: dict[str, Any],
) -> dict[str, Any]:
    """Resume a pipeline after a gate decision.

    ``gate_decision`` should contain the gate state update, e.g.::

        {"gate": {"decision": "approved"}}
    """
    logger.info("Resuming pipeline thread=%s with decision=%s", thread_id, gate_decision)

    try:
        with compiled_graph_session(use_checkpointer=True) as compiled:
            config = {"configurable": {"thread_id": thread_id}}

            # Inject the gate decision into the graph state
            compiled.update_state(config, gate_decision)

            # Continue execution
            for event in compiled.stream(None, config=config):
                logger.info("Pipeline event: %s", _summarize_event(event))

            # Check if hit another gate or completed
            graph_state = compiled.get_state(config)
            interrupted = bool(graph_state.next)

            if interrupted:
                gate_node = graph_state.next[0] if graph_state.next else None
                logger.info("Pipeline paused at next gate: %s", gate_node)
                _update_run_status(run_id, "waiting_gate", gate_node)
            else:
                logger.info("Pipeline completed after resume (thread=%s)", thread_id)
                _update_run_status(run_id, "succeeded", None)

            return {
                "run_id": run_id,
                "thread_id": thread_id,
                "status": "waiting_gate" if interrupted else "succeeded",
                "paused_at": _normalize_graph_node_name(graph_state.next[0]) if interrupted else None,
            }

    except Exception as exc:
        logger.exception("Pipeline resume failed: %s", exc)
        _update_run_status(run_id, "failed", None)
        return {
            "run_id": run_id,
            "thread_id": thread_id,
            "status": "failed",
            "error": str(exc),
        }


def _update_run_status(run_id: str, status: str, current_node_id: str | None) -> None:
    """Update run status in the database."""
    try:
        normalized_node_id = _normalize_graph_node_name(current_node_id)
        stage_no = None
        if normalized_node_id:
            from backend.orchestrator.graph.topology import stage_no_for_node

            stage_no = stage_no_for_node(normalized_node_id)
        db_status = "running" if status == "waiting_gate" else status
        execute(
            """
            UPDATE core_pipeline.runs
            SET status = %s,
                current_node_id = %s,
                current_stage_no = %s,
                updated_at = now()
            WHERE id::text = %s
            """,
            (db_status, normalized_node_id, stage_no, run_id),
        )
    except Exception as exc:
        logger.warning("Failed to update run status: %s", exc)


def _summarize_event(event: Any) -> str:
    """Create a concise summary of a graph stream event."""
    if isinstance(event, dict):
        keys = list(event.keys())
        if len(keys) == 1:
            node_name = keys[0]
            inner = event[node_name]
            if isinstance(inner, dict):
                node_id = inner.get("current_node_id") or inner.get("next_node_id", "")
                status = ""
                if "last_result" in inner and inner["last_result"]:
                    status = f" status={inner['last_result'].get('status', '?')}"
                return f"{node_name}: node={node_id}{status}"
        return f"keys={keys}"
    return str(type(event).__name__)


def _normalize_graph_node_name(node_name: str | None) -> str | None:
    if not node_name:
        return None
    if node_name.startswith("gate_enter_"):
        return node_name.removeprefix("gate_enter_")
    if node_name.startswith("gate_resume_"):
        return node_name.removeprefix("gate_resume_")
    return node_name
