from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.orchestrator.write_side import (  # noqa: E402
    approve_review_task,
    auto_reject_node_run,
    apply_model_job_callback,
    request_regeneration,
    return_review_task,
    seed_round4_demo,
    seed_round6_demo,
    seed_round7_demo,
    skip_review_task,
    submit_model_job,
    update_review_task_payload,
)


def _load_json_payload(raw: str | None) -> dict[str, object]:
    if not raw:
        return {}
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise SystemExit("payload must be a JSON object")
    return payload


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        raise SystemExit(
            "usage: orchestrator_write_api.py <seed-round4|seed-round6|seed-round7|review-approve|review-return|review-skip|review-update-payload|review-regenerate|auto-qc-reject|model-submit|model-callback> [task_id] [json_payload]"
        )

    command = argv[1]

    if command == "seed-round4":
        payload: object = seed_round4_demo()
    elif command == "seed-round6":
        payload = seed_round6_demo()
    elif command == "seed-round7":
        payload = seed_round7_demo()
    elif command == "review-approve":
        if len(argv) < 3:
            raise SystemExit("review-approve requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = approve_review_task(
            argv[2],
            str(request.get("decision_comment") or ""),
            list(request.get("review_points") or []),
        )
    elif command == "review-return":
        if len(argv) < 3:
            raise SystemExit("review-return requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = return_review_task(
            argv[2],
            str(request.get("decision_comment") or ""),
            list(request.get("review_points") or []),
        )
    elif command == "review-skip":
        if len(argv) < 3:
            raise SystemExit("review-skip requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = skip_review_task(argv[2], str(request.get("reason") or "optional_step_skipped"))
    elif command == "review-update-payload":
        if len(argv) < 3:
            raise SystemExit("review-update-payload requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        updates = dict(request.get("updates") or {}) if "updates" in request else request
        payload = update_review_task_payload(argv[2], updates)
    elif command == "review-regenerate":
        if len(argv) < 3:
            raise SystemExit("review-regenerate requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        regen_type = str(request.get("regen_type") or "asset")
        params = dict(request.get("params") or {})
        payload = request_regeneration(argv[2], regen_type, params)
    elif command == "auto-qc-reject":
        if len(argv) < 3:
            raise SystemExit("auto-qc-reject requires <node_run_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = auto_reject_node_run(
            argv[2],
            issue_type=str(request.get("issue_type") or "auto_qc_reject"),
            comment=str(request.get("comment") or "auto qc reject"),
            severity=str(request.get("severity") or "major"),
            quality_score=float(request["quality_score"]) if request.get("quality_score") is not None else None,
            error_code=str(request.get("error_code") or "auto_qc_reject"),
        )
    elif command == "model-submit":
        if len(argv) < 3:
            raise SystemExit("model-submit requires <node_run_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = submit_model_job(
            argv[2],
            overrides=dict(request.get("overrides") or {}),
            seed_namespace=str(request.get("seed_namespace") or "") or None,
        )
    elif command == "model-callback":
        if len(argv) < 3:
            raise SystemExit("model-callback requires <job_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        payload = apply_model_job_callback(
            argv[2],
            status=str(request.get("status") or "succeeded"),
            output_ref=str(request.get("output_ref") or "") or None,
            error_code=str(request.get("error_code") or "") or None,
            error_message=str(request.get("error_message") or "") or None,
            metrics=dict(request.get("metrics") or {}),
        )
    # ═══ v2.2 Agent Infrastructure Write Commands ═══

    elif command == "memory-upsert":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.common.agent_memory import upsert_memory
        payload = upsert_memory(
            agent_name=str(request["agent_name"]),
            content_key=str(request["content_key"]),
            content_value=dict(request.get("content_value") or {}),
            memory_type=str(request.get("memory_type", "lesson_learned")),
            scope=str(request.get("scope", "project")),
            scope_id=str(request["scope_id"]) if request.get("scope_id") else None,
            confidence=float(request.get("confidence", 0.5)),
        )

    elif command == "memory-delete":
        if len(argv) < 3:
            raise SystemExit("memory-delete requires <memory_id>")
        from backend.common.agent_memory import delete_memory
        payload = {"deleted": delete_memory(argv[2])}

    elif command == "memory-cleanup":
        from backend.common.agent_memory import cleanup_stale_memories
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        payload = cleanup_stale_memories(
            stale_days=int(request.get("stale_days", 30)),
            decay_factor=float(request.get("decay_factor", 0.8)),
            min_confidence=float(request.get("min_confidence", 0.1)),
        )

    elif command == "prompt-create":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.common.prompt_assets import create_prompt
        payload = create_prompt(
            agent_name=str(request["agent_name"]),
            prompt_stage=str(request["prompt_stage"]),
            system_prompt=str(request["system_prompt"]),
            version=str(request.get("version", "v1.0")),
            output_schema_ref=str(request["output_schema_ref"]) if request.get("output_schema_ref") else None,
        )

    elif command == "prompt-update":
        if len(argv) < 3:
            raise SystemExit("prompt-update requires <prompt_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        from backend.common.prompt_assets import update_prompt
        payload = update_prompt(
            prompt_id=argv[2],
            system_prompt=str(request["system_prompt"]),
            new_version=str(request["new_version"]) if request.get("new_version") else None,
            change_reason=str(request.get("change_reason") or ""),
            changed_by=str(request.get("changed_by") or "human"),
        ) or {"error": "not_found"}

    elif command == "prompt-lock":
        if len(argv) < 3:
            raise SystemExit("prompt-lock requires <prompt_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        from backend.common.prompt_assets import lock_prompt
        payload = {"locked": lock_prompt(argv[2], str(request.get("locked_by", "human")))}

    elif command == "prompt-unlock":
        if len(argv) < 3:
            raise SystemExit("prompt-unlock requires <prompt_id>")
        from backend.common.prompt_assets import unlock_prompt
        payload = {"unlocked": unlock_prompt(argv[2])}

    elif command == "evolution-trigger":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.agents.registry import register_all_agents, get_agent
        from backend.agents.base import AgentContext
        register_all_agents()
        agent = get_agent("evolution_engine")
        ctx = AgentContext(
            project_id=str(request["project_id"]) if request.get("project_id") else None,
            extra={"evolution_mode": str(request.get("mode", "reflection"))},
        )
        result = agent.execute(ctx)
        payload = {
            "success": result.success,
            "output": result.output,
            "cost_cny": result.cost_cny,
            "duration_ms": result.duration_ms,
            "error": result.error,
        }

    elif command == "dispatch-annotation":
        if len(argv) < 3:
            raise SystemExit("dispatch-annotation requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        annotation = str(request.get("annotation", ""))
        if not annotation:
            raise SystemExit("dispatch-annotation requires non-empty 'annotation' in payload")
        # V3: 调用 ReviewDispatcherAgent 真实解析（LLM 解析 → 写入 DB）
        from backend.agents.dispatch.review_dispatcher import ReviewDispatcherAgent
        _dispatch_result = ReviewDispatcherAgent.parse_annotation(
            annotation=annotation,
            review_task_id=argv[2],
            gate_node_id=str(request.get("gate_node_id") or "") or None,
            stage_no=int(request.get("stage_no", 0)),
            genre=str(request.get("genre") or "") or None,
            shot_ids=list(request.get("shot_ids") or []),
            project_id=str(request.get("project_id") or "") or None,
        )
        payload = {
            "success": _dispatch_result.success,
            "task_count": _dispatch_result.output.get("task_count", 0),
            "dispatcher_tasks": _dispatch_result.output.get("dispatcher_tasks", []),
            "persisted": _dispatch_result.output.get("persisted", False),
            "review_task_id": argv[2],
            "cost_cny": _dispatch_result.cost_cny,
            "duration_ms": _dispatch_result.duration_ms,
            "error": _dispatch_result.error,
        }

    elif command == "dispatch-attribute":
        # V4: 打回归因 — 分析打回原因并归因到具体 Agent/节点
        if len(argv) < 3:
            raise SystemExit("dispatch-attribute requires <ticket_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        from backend.agents.dispatch.attribution import enrich_return_ticket_with_attribution
        payload = enrich_return_ticket_with_attribution(
            ticket_id=argv[2],
            decision_comment=str(request.get("decision_comment", "")),
            review_points=list(request.get("review_points") or []),
            stage_no=int(request.get("stage_no", 0)),
            system_root_cause_node_id=str(request.get("system_root_cause_node_id") or "") or None,
        )

    elif command == "dispatch-execute":
        # V2: 执行已解析的 dispatcher tasks（路由到目标 Agent）
        if len(argv) < 3:
            raise SystemExit("dispatch-execute requires <task_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        tasks = list(request.get("tasks") or [])
        if not tasks:
            raise SystemExit("dispatch-execute requires non-empty 'tasks' in payload")
        from backend.agents.dispatch.task_executor import TaskExecutor
        from backend.agents.base import AgentContext
        _executor = TaskExecutor()
        _exec_ctx = AgentContext(
            run_id=str(request.get("run_id") or "") or None,
            episode_version_id=str(request.get("episode_version_id") or "") or None,
            project_id=str(request.get("project_id") or "") or None,
            genre=str(request.get("genre") or "") or None,
        )
        _exec_results = _executor.execute_tasks(tasks, _exec_ctx)
        payload = TaskExecutor.summarize_results(_exec_results)

    elif command == "genre-adapter-create":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.common.prompt_assets import create_genre_adapter
        payload = create_genre_adapter(
            prompt_asset_id=str(request["prompt_asset_id"]),
            genre_tag=str(request["genre_tag"]),
            adapter_prompt=str(request["adapter_prompt"]),
            style_keywords=list(request.get("style_keywords") or []),
            few_shot_case_ids=list(request.get("few_shot_case_ids") or []),
            created_by=str(request.get("created_by", "human")),
        )

    # ═══ v2.2 RAG Ingestion Write Commands ═══

    elif command == "rag-ingest-positive":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.agents.dispatch.rag_ingestion import ingest_positive_from_qc
        result = ingest_positive_from_qc(
            shot_id=str(request["shot_id"]),
            quality_score=float(request["quality_score"]),
            genre=str(request.get("genre") or "") or None,
            scene_type=str(request.get("scene_type") or "") or None,
            difficulty=str(request.get("difficulty") or "") or None,
            chain_assets=dict(request.get("chain_assets") or {}),
            project_id=str(request.get("project_id") or "") or None,
            episode_id=str(request.get("episode_id") or "") or None,
            description=str(request.get("description") or "") or None,
        )
        payload = {"success": result.success, "chain_id": result.chain_id,
                   "qdrant_written": result.qdrant_written, "pg_written": result.pg_written,
                   "error": result.error}

    elif command == "rag-ingest-negative":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.agents.dispatch.rag_ingestion import ingest_negative
        result = ingest_negative(
            shot_id=str(request["shot_id"]),
            issue_description=str(request["issue_description"]),
            severity=str(request.get("severity", "major")),
            genre=str(request.get("genre") or "") or None,
            scene_type=str(request.get("scene_type") or "") or None,
            chain_assets=dict(request.get("chain_assets") or {}),
            project_id=str(request.get("project_id") or "") or None,
            episode_id=str(request.get("episode_id") or "") or None,
        )
        payload = {"success": result.success, "chain_id": result.chain_id,
                   "qdrant_written": result.qdrant_written, "pg_written": result.pg_written,
                   "error": result.error}

    elif command == "rag-ingest-corrective":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.agents.dispatch.rag_ingestion import ingest_corrective
        result = ingest_corrective(
            shot_id=str(request["shot_id"]),
            before_assets=dict(request.get("before_assets") or {}),
            after_assets=dict(request.get("after_assets") or {}),
            quality_before=float(request["quality_before"]),
            quality_after=float(request["quality_after"]),
            correction_description=str(request.get("correction_description", "")),
            genre=str(request.get("genre") or "") or None,
            scene_type=str(request.get("scene_type") or "") or None,
            project_id=str(request.get("project_id") or "") or None,
            episode_id=str(request.get("episode_id") or "") or None,
        )
        payload = {"success": result.success, "chain_id": result.chain_id,
                   "qdrant_written": result.qdrant_written, "pg_written": result.pg_written,
                   "error": result.error}

    elif command == "rag-search":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.agents.dispatch.rag_ingestion import search_cases
        payload = {"results": search_cases(
            genre=str(request.get("genre") or "") or None,
            scene_type=str(request.get("scene_type") or "") or None,
            case_type=str(request.get("case_type") or "") or None,
            difficulty=str(request.get("difficulty") or "") or None,
            min_score=float(request.get("min_score", 0.0)),
            query_text=str(request.get("query_text") or "") or None,
            limit=int(request.get("limit", 3)),
        )}

    # ═══ v2.2 Frontend API — Phase 0-3 New Write Commands ═══

    elif command == "prompt-playground":
        # POST /api/debug/prompt-playground — direct LLM call for testing
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        system_prompt = str(request.get("system_prompt", "You are a helpful assistant."))
        user_prompt = str(request.get("user_prompt", ""))
        if not user_prompt:
            raise SystemExit("prompt-playground requires non-empty 'user_prompt'")
        model = str(request.get("model", "gpt-4o-mini"))
        temperature = float(request.get("temperature", 0.7))
        max_tokens = int(request.get("max_tokens", 2048))
        # Variable substitution
        variables = dict(request.get("variables") or {})
        for k, v in variables.items():
            system_prompt = system_prompt.replace(f"{{{{{k}}}}}", str(v))
            user_prompt = user_prompt.replace(f"{{{{{k}}}}}", str(v))
        import time
        start = time.monotonic()
        from backend.common.llm_client import call_llm
        result = call_llm(
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        payload = {
            "response": result.get("content", ""),
            "tokens_used": result.get("usage", {}),
            "cost_cny": result.get("cost_cny", 0),
            "latency_ms": latency_ms,
            "model_used": model,
        }

    elif command == "settings-projects-list":
        from backend.common.db import fetch_all as _fetch_all
        payload = _fetch_all(
            "SELECT * FROM public.project_groups ORDER BY created_at DESC",
            (),
        ) or []

    elif command == "settings-projects-create":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.common.db import execute_returning_one
        payload = execute_returning_one(
            """INSERT INTO public.project_groups (group_name, genre_tags, compliance_rules, budget_override_per_min)
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (
                str(request["name"]),
                json.dumps(request.get("genre_tags", [])),
                json.dumps(request.get("compliance_rules", {})),
                float(request.get("budget_per_min", 30.0)),
            ),
        ) or {"error": "create_failed"}

    elif command == "settings-projects-update":
        if len(argv) < 3:
            raise SystemExit("settings-projects-update requires <project_group_id>")
        request = _load_json_payload(argv[3] if len(argv) >= 4 else None)
        from backend.common.db import execute_returning_one
        sets = []
        params_list: list = []
        if "name" in request:
            sets.append("group_name = %s")
            params_list.append(str(request["name"]))
        if "genre_tags" in request:
            sets.append("genre_tags = %s")
            params_list.append(json.dumps(request["genre_tags"]))
        if "compliance_rules" in request:
            sets.append("compliance_rules = %s")
            params_list.append(json.dumps(request["compliance_rules"]))
        if "budget_per_min" in request:
            sets.append("budget_override_per_min = %s")
            params_list.append(float(request["budget_per_min"]))
        if not sets:
            payload = {"error": "no_fields_to_update"}
        else:
            sets.append("updated_at = now()")
            params_list.append(argv[2])
            payload = execute_returning_one(
                f"UPDATE public.project_groups SET {', '.join(sets)} WHERE id = %s RETURNING *",
                params_list,
            ) or {"error": "not_found"}

    elif command == "settings-projects-delete":
        if len(argv) < 3:
            raise SystemExit("settings-projects-delete requires <project_group_id>")
        from backend.common.db import execute
        execute("DELETE FROM public.project_groups WHERE id = %s", (argv[2],))
        payload = {"success": True}

    elif command == "settings-notifications-get":
        from backend.common.db import fetch_one
        payload = fetch_one(
            "SELECT * FROM core_pipeline.notification_config WHERE is_active = TRUE LIMIT 1",
            (),
        ) or {"webhook_url": None, "events": {"gate_pending": True, "budget_alert": True, "pipeline_failed": True, "daily_report": False}}

    elif command == "settings-notifications-update":
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        from backend.common.db import execute_returning_one, fetch_one
        existing = fetch_one(
            "SELECT * FROM core_pipeline.notification_config WHERE is_active = TRUE LIMIT 1",
            (),
        )
        if existing:
            payload = execute_returning_one(
                """UPDATE core_pipeline.notification_config
                   SET webhook_url = %s, events = %s, updated_at = now()
                   WHERE id = %s RETURNING *""",
                (
                    str(request.get("webhook_url", "")),
                    json.dumps(request.get("events", {})),
                    existing["id"],
                ),
            ) or {"error": "update_failed"}
        else:
            payload = execute_returning_one(
                """INSERT INTO core_pipeline.notification_config (webhook_url, events)
                   VALUES (%s, %s) RETURNING *""",
                (
                    str(request.get("webhook_url", "")),
                    json.dumps(request.get("events", {})),
                ),
            ) or {"error": "create_failed"}

    elif command == "assistant-chat":
        # POST /api/assistant/chat — AI assistant with system context
        request = _load_json_payload(argv[2] if len(argv) >= 3 else None)
        message = str(request.get("message", ""))
        if not message:
            raise SystemExit("assistant-chat requires non-empty 'message'")
        # Build context from system state
        from backend.common.db import fetch_one
        active_runs = fetch_one("SELECT COUNT(*) as cnt FROM core_pipeline.runs WHERE status IN ('running', 'gate_pending')", ())
        pending_gates = fetch_one("SELECT COUNT(*) as cnt FROM core_pipeline.review_tasks WHERE status = 'pending'", ())
        system_context = (
            f"AutoFlow系统状态：活跃流水线{active_runs['cnt'] if active_runs else 0}条，"
            f"待审核任务{pending_gates['cnt'] if pending_gates else 0}个。"
        )
        from backend.common.llm_client import call_llm
        result = call_llm(
            model="gpt-4o-mini",
            system_prompt=f"你是AutoFlow AIGC短剧生产系统的AI助手。{system_context} 用简洁中文回答用户问题。",
            user_prompt=message,
        )
        import uuid
        payload = {
            "reply": result.get("content", ""),
            "conversation_id": str(request.get("conversation_id") or uuid.uuid4()),
        }

    else:
        raise SystemExit(f"unsupported command: {command}")

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv)
