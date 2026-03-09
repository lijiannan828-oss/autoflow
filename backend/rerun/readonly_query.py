from __future__ import annotations

from typing import Any

from backend.common.contracts.serialization import to_jsonable

from .examples import build_sample_flow


def build_rerun_active_scenario() -> dict[str, Any]:
    sample = build_sample_flow()
    ticket = sample["return_ticket"]
    version_patch = sample["version_patch"]
    next_version = sample["next_version"]

    runs = [
        {
            "id": "run-real-rerun-source",
            "episode_id": ticket["episode_id"],
            "episode_version_id": ticket["episode_version_id"],
            "status": "failed",
            "current_node_id": "N24",
            "plan_json": {"source": "previous_version"},
            "is_rerun": False,
            "rerun_from_ticket_id": None,
            "langgraph_thread_id": "lg-real-rerun-source",
            "started_at": ticket["created_at"],
            "finished_at": ticket["updated_at"],
            "created_at": ticket["created_at"],
            "updated_at": ticket["updated_at"],
        },
        {
            "id": "run-real-rerun-v2",
            "episode_id": ticket["episode_id"],
            "episode_version_id": next_version["id"],
            "status": "running",
            "current_node_id": "N23",
            "plan_json": {"patch_type": "minimal_rerun", "ticket_id": ticket["id"]},
            "is_rerun": True,
            "rerun_from_ticket_id": ticket["id"],
            "langgraph_thread_id": "lg-real-rerun-v2",
            "started_at": "2026-03-08T09:10:00Z",
            "finished_at": None,
            "created_at": "2026-03-08T09:10:00Z",
            "updated_at": "2026-03-08T09:12:00Z",
        },
    ]

    node_runs = [
        {
            "id": "nr-real-rerun-N21",
            "run_id": "run-real-rerun-v2",
            "episode_version_id": next_version["id"],
            "node_id": "N21",
            "agent_role": "audio_director",
            "status": "skipped",
            "attempt_no": 1,
            "retry_count": 0,
            "auto_reject_count": 0,
            "scope_hash": "ev_v2:N21",
            "input_ref": None,
            "output_ref": "tos://autoflow-media/ev_v1/N21/output.json",
            "model_provider": None,
            "model_endpoint": None,
            "comfyui_workflow_id": None,
            "api_calls": 0,
            "token_in": 0,
            "token_out": 0,
            "gpu_seconds": 0,
            "cost_cny": 0,
            "rag_query_count": 0,
            "quality_score": None,
            "error_code": None,
            "error_message": None,
            "tags": ["reused_previous_version"],
            "started_at": "2026-03-08T09:10:02Z",
            "ended_at": "2026-03-08T09:10:02Z",
            "duration_s": 0,
            "created_at": "2026-03-08T09:10:02Z",
            "updated_at": "2026-03-08T09:10:02Z",
        },
        {
            "id": "nr-real-rerun-N23",
            "run_id": "run-real-rerun-v2",
            "episode_version_id": next_version["id"],
            "node_id": "N23",
            "agent_role": "director",
            "status": "running",
            "attempt_no": 1,
            "retry_count": 0,
            "auto_reject_count": 0,
            "scope_hash": "ev_v2:N23",
            "input_ref": "tos://autoflow-media/ev_v2/N23/input.json",
            "output_ref": None,
            "model_provider": "comfyui",
            "model_endpoint": "workflow-vhs-combine",
            "comfyui_workflow_id": "wf-real-rerun-N23",
            "api_calls": 1,
            "token_in": 0,
            "token_out": 0,
            "gpu_seconds": 8.5,
            "cost_cny": 0.92,
            "rag_query_count": 0,
            "quality_score": None,
            "error_code": None,
            "error_message": None,
            "tags": ["rerun_from_return_ticket"],
            "started_at": "2026-03-08T09:10:05Z",
            "ended_at": None,
            "duration_s": None,
            "created_at": "2026-03-08T09:10:05Z",
            "updated_at": "2026-03-08T09:12:00Z",
        },
    ]

    return {
        "id": "round2_rerun_real_read",
        "label": "第二轮 · 回炉真实读取",
        "description": "通过 backend/rerun 真实骨架生成 rerun_plan_json 与 v+1 场景，展示最小重跑读取链路。",
        "focus_run_id": "run-real-rerun-v2",
        "runs": runs,
        "node_runs": node_runs,
        "review_tasks": [],
        "return_tickets": [ticket],
        "gate_list": None,
        "gate_detail": None,
        "stage2_summary": None,
        "stage4_summary": None,
        "version_patch": version_patch,
    }


def build_acceptance_scenarios() -> list[dict[str, Any]]:
    return [to_jsonable(build_rerun_active_scenario())]
