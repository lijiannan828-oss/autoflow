from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.common.db import fetch_all as _fetch_all, fetch_one as _fetch_one  # noqa: E402

from backend.orchestrator.db_read_side import (  # noqa: E402
    build_dynamic_task_tabs,
    get_node_trace_payload,
    get_north_star_summary,
    get_registry_validation_payload,
    get_review_task_detail,
    get_stage_summary,
    get_tos_presigned_url,
    list_artifacts_by_node_run,
    list_dramas,
    list_episodes_for_drama,
    list_return_tickets,
    list_review_tasks,
)


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        raise SystemExit(
            "usage: orchestrator_read_api.py <acceptance|review-tasks|review-task-detail|review-stage2-summary|review-stage3-summary|review-stage4-summary|return-tickets|list-dramas|list-episodes|artifacts-by-node-run|tos-presigned-url|node-trace|registry-validation|north-star-summary> [arg]"
        )

    command = argv[1]

    if command == "acceptance":
        payload = {
            "taskTabs": build_dynamic_task_tabs(),
            "north_star_summary": get_north_star_summary(),
        }
    elif command == "review-tasks":
        limit = int(argv[2]) if len(argv) >= 3 else 20
        payload = list_review_tasks(limit=limit)
    elif command == "review-task-detail":
        if len(argv) < 3:
            raise SystemExit("review-task-detail requires <task_id>")
        payload = get_review_task_detail(argv[2]) or {"error": "not_found"}
    elif command == "review-stage2-summary":
        if len(argv) < 3:
            raise SystemExit("review-stage2-summary requires <episode_id>")
        payload = get_stage_summary(2, argv[2]) or {"error": "not_found"}
    elif command == "review-stage3-summary":
        if len(argv) < 3:
            raise SystemExit("review-stage3-summary requires <episode_id>")
        payload = get_stage_summary(3, argv[2]) or {"error": "not_found"}
    elif command == "review-stage4-summary":
        if len(argv) < 3:
            raise SystemExit("review-stage4-summary requires <episode_id>")
        payload = get_stage_summary(4, argv[2]) or {"error": "not_found"}
    elif command == "return-tickets":
        episode_id = argv[2] if len(argv) >= 3 else None
        status = argv[3] if len(argv) >= 4 else None
        limit = int(argv[4]) if len(argv) >= 5 else 50
        payload = list_return_tickets(episode_id=episode_id, status=status, limit=limit)
    elif command == "list-dramas":
        limit = int(argv[2]) if len(argv) >= 3 else 50
        payload = list_dramas(limit=limit)
    elif command == "list-episodes":
        if len(argv) < 3:
            raise SystemExit("list-episodes requires <episode_id>")
        payload = list_episodes_for_drama(argv[2])
    elif command == "artifacts-by-node-run":
        if len(argv) < 3:
            raise SystemExit("artifacts-by-node-run requires <node_run_id>")
        payload = list_artifacts_by_node_run(argv[2])
    elif command == "tos-presigned-url":
        if len(argv) < 3:
            raise SystemExit("tos-presigned-url requires <tos_url>")
        payload = get_tos_presigned_url(argv[2])
    elif command == "node-trace":
        payload = get_node_trace_payload()
    elif command == "registry-validation":
        payload = get_registry_validation_payload()
    elif command == "north-star-summary":
        payload = get_north_star_summary()

    # ═══ v2.2 Agent Infrastructure Read Commands ═══

    elif command == "agent-list":
        from backend.agents.registry import register_all_agents, list_agents
        register_all_agents()
        payload = {"agents": list_agents()}

    elif command == "agent-traces":
        agent_name = argv[2] if len(argv) >= 3 else None
        limit = int(argv[3]) if len(argv) >= 4 else 50
        conditions = []
        params: list = []
        if agent_name:
            conditions.append("agent_name = %s")
            params.append(agent_name)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.extend([limit])
        payload = _fetch_all(
            f"SELECT * FROM core_pipeline.agent_traces {where} ORDER BY created_at DESC LIMIT %s",
            params,
        )

    elif command == "agent-memory":
        from backend.common.agent_memory import list_memories, get_memory_stats
        agent_name = argv[2] if len(argv) >= 3 else None
        if agent_name:
            payload = list_memories(agent_name, limit=50)
        else:
            payload = get_memory_stats()

    elif command == "prompt-assets":
        from backend.common.prompt_assets import list_prompts, get_prompt_stats
        agent_name = argv[2] if len(argv) >= 3 else None
        if agent_name:
            payload = list_prompts(agent_name)
        else:
            payload = get_prompt_stats()

    elif command == "cost-dashboard":
        from backend.common.cost_events import get_cost_dashboard
        days = int(argv[2]) if len(argv) >= 3 else 7
        payload = get_cost_dashboard(days=days)

    elif command == "cost-run":
        if len(argv) < 3:
            raise SystemExit("cost-run requires <run_id>")
        from backend.common.cost_events import get_run_cost
        payload = get_run_cost(argv[2])

    elif command == "evolution-runs":
        limit = int(argv[2]) if len(argv) >= 3 else 20
        payload = _fetch_all(
            "SELECT * FROM core_pipeline.evolution_runs ORDER BY created_at DESC LIMIT %s",
            (limit,),
        )

    elif command == "rag-stats":
        # V8: 丰富 RAG 统计（Qdrant health + PG 多维度聚合 + 检索热度）
        from backend.agents.dispatch.rag_ingestion import get_rag_statistics
        payload = get_rag_statistics()

    # ═══ v2.2 Frontend API — Phase 0-3 New/Upgraded Commands ═══

    elif command == "tasks-by-role":
        # GET /api/tasks?role=&status=&gate=&page=&page_size=
        role = argv[2] if len(argv) >= 3 else None
        status = argv[3] if len(argv) >= 4 else None
        gate = argv[4] if len(argv) >= 5 else None
        page = int(argv[5]) if len(argv) >= 6 else 1
        page_size = int(argv[6]) if len(argv) >= 7 else 20
        conditions = []
        params: list = []
        if role and role != "admin":
            conditions.append("reviewer_role = %s")
            params.append(role)
        if status:
            conditions.append("status = %s")
            params.append(status)
        if gate:
            conditions.append("gate_node_id = %s")
            params.append(gate)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        offset = (page - 1) * page_size
        count_row = _fetch_one(
            f"SELECT COUNT(*) as total FROM core_pipeline.review_tasks {where}",
            params,
        )
        total = count_row["total"] if count_row else 0
        items = _fetch_all(
            f"""SELECT rt.*, d.title as drama_title, ev.title as episode_title
                FROM core_pipeline.review_tasks rt
                LEFT JOIN core_pipeline.episode_versions ev ON rt.episode_version_id = ev.id
                LEFT JOIN core_pipeline.episodes e ON ev.episode_id = e.id
                LEFT JOIN core_pipeline.dramas d ON e.drama_id = d.id
                {where}
                ORDER BY rt.created_at DESC
                LIMIT %s OFFSET %s""",
            params + [page_size, offset],
        )
        payload = {"total": total, "page": page, "items": items or []}

    elif command == "pipeline-dashboard":
        # GET /api/pipeline/dashboard — aggregated dashboard
        ns = get_north_star_summary()
        # Node distribution from node_runs
        try:
            dist = _fetch_one(
                """SELECT
                    COUNT(*) FILTER (WHERE status = 'running') as running,
                    COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed
                   FROM core_pipeline.node_runs
                   WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'""",
                (),
            ) or {"running": 0, "waiting": 0, "completed": 0, "failed": 0}
        except Exception:
            dist = {"running": 0, "waiting": 0, "completed": 0, "failed": 0}
        # Active runs
        try:
            active = _fetch_one(
                "SELECT COUNT(*) as cnt FROM core_pipeline.runs WHERE status IN ('running', 'gate_pending')",
                (),
            )
        except Exception:
            active = {"cnt": 0}
        # Today output
        try:
            today = _fetch_one(
                """SELECT COUNT(DISTINCT nr.id) as shots
                   FROM core_pipeline.node_runs nr
                   WHERE nr.completed_at >= CURRENT_DATE AND nr.status = 'completed'""",
                (),
            ) or {"shots": 0}
        except Exception:
            today = {"shots": 0}
        # Cost vs budget
        try:
            from backend.common.cost_events import get_cost_dashboard
            cost_data = get_cost_dashboard(days=1)
            total_cost = cost_data.get("total_cost_cny", 0) if isinstance(cost_data, dict) else 0
        except Exception:
            total_cost = 0
        # Recent anomalies (failed node_runs in last 24h)
        try:
            anomalies = _fetch_all(
                """SELECT node_id, error_message, created_at
                   FROM core_pipeline.node_runs
                   WHERE status = 'failed' AND created_at >= now() - INTERVAL '24 hours'
                   ORDER BY created_at DESC LIMIT 10""",
                (),
            ) or []
        except Exception:
            anomalies = []
        # Recent activity
        try:
            activity = _fetch_all(
                """SELECT node_id, status, agent_role, completed_at as timestamp
                   FROM core_pipeline.node_runs
                   WHERE completed_at IS NOT NULL
                   ORDER BY completed_at DESC LIMIT 20""",
                (),
            ) or []
        except Exception:
            activity = []
        payload = {
            "north_star": ns,
            "active_runs": active["cnt"] if active else 0,
            "node_distribution": dist,
            "today_output": today,
            "cost_today_cny": total_cost,
            "budget_per_min": 30.0,
            "recent_anomalies": anomalies,
            "activity_feed": activity,
        }

    elif command == "pipeline-trace":
        # GET /api/pipeline/trace/:episodeId — E2E episode-level trace with Agent decisions
        if len(argv) < 3:
            raise SystemExit("pipeline-trace requires <episode_id>")
        episode_id = argv[2]
        # Get episode info
        episode = _fetch_one(
            """SELECT ev.id, ev.title as episode_title, d.title as drama_title
               FROM core_pipeline.episode_versions ev
               LEFT JOIN core_pipeline.episodes e ON ev.episode_id = e.id
               LEFT JOIN core_pipeline.dramas d ON e.drama_id = d.id
               WHERE ev.id = %s""",
            (episode_id,),
        )
        # Get all node_runs for this episode
        nodes = _fetch_all(
            """SELECT nr.*, nr.node_id, nr.status, nr.agent_role,
                      nr.started_at, nr.completed_at, nr.cost_cny,
                      nr.input_summary, nr.output_summary, nr.error_message
               FROM core_pipeline.node_runs nr
               WHERE nr.episode_version_id = %s
               ORDER BY nr.execution_order, nr.started_at""",
            (episode_id,),
        ) or []
        # Enrich with agent decisions from agent_traces
        for node in nodes:
            node_run_id = str(node.get("id", ""))
            traces = _fetch_all(
                """SELECT trace_type, reasoning, duration_ms, tokens_used, created_at
                   FROM core_pipeline.agent_traces
                   WHERE node_run_id = %s
                   ORDER BY created_at""",
                (node_run_id,),
            ) or []
            node["agent_decisions"] = traces
            # Get artifacts
            arts = _fetch_all(
                """SELECT artifact_type, storage_url, metadata
                   FROM core_pipeline.artifacts
                   WHERE node_run_id = %s""",
                (node_run_id,),
            ) or []
            node["artifacts"] = arts
        # Total duration and cost
        total_duration = sum(
            (n.get("duration_sec") or 0) for n in nodes
        )
        total_cost = sum(
            (n.get("cost_cny") or 0) for n in nodes
        )
        payload = {
            "episode_id": episode_id,
            "drama_title": episode["drama_title"] if episode else None,
            "episode_title": episode["episode_title"] if episode else None,
            "total_duration_sec": total_duration,
            "total_cost_cny": total_cost,
            "nodes": nodes,
        }

    elif command == "pipeline-project":
        # GET /api/pipeline/:projectId
        if len(argv) < 3:
            raise SystemExit("pipeline-project requires <project_id>")
        project_id = argv[2]
        project = _fetch_one(
            "SELECT * FROM core_pipeline.projects WHERE id = %s",
            (project_id,),
        )
        episodes = _fetch_all(
            """SELECT ev.id as episode_id, e.episode_no, ev.title,
                      r.status, r.current_node_id as current_node,
                      r.started_at, r.completed_at
               FROM core_pipeline.episode_versions ev
               LEFT JOIN core_pipeline.episodes e ON ev.episode_id = e.id
               LEFT JOIN core_pipeline.runs r ON r.episode_version_id = ev.id
               WHERE e.drama_id IN (
                   SELECT id FROM core_pipeline.dramas WHERE project_id = %s
               )
               ORDER BY e.episode_no""",
            (project_id,),
        ) or []
        payload = {
            "project": project or {},
            "episodes": episodes,
        }

    elif command == "pipeline-highlights":
        # GET /api/pipeline/highlights — anomaly & excellence discovery
        highlight_type = argv[2] if len(argv) >= 3 else None  # anomaly|excellence
        days = int(argv[3]) if len(argv) >= 4 else 7
        limit = int(argv[4]) if len(argv) >= 5 else 20
        items = []
        # Anomalies: failed nodes, cost spikes
        if not highlight_type or highlight_type == "anomaly":
            failed = _fetch_all(
                """SELECT 'anomaly' as type, 'warning' as severity,
                          'Node failed: ' || node_id as title,
                          error_message as description,
                          episode_version_id as related_episode_id,
                          node_id as related_node_id,
                          agent_name as related_agent_name,
                          created_at as detected_at
                   FROM core_pipeline.node_runs
                   WHERE status = 'failed'
                   AND created_at >= now() - make_interval(days => %s)
                   ORDER BY created_at DESC LIMIT %s""",
                (days, limit),
            ) or []
            items.extend(failed)
        # Excellence: high QC scores
        if not highlight_type or highlight_type == "excellence":
            excellent = _fetch_all(
                """SELECT 'excellence' as type, 'notable' as severity,
                          'High quality: ' || node_id as title,
                          'QC score: ' || COALESCE(quality_score::text, 'N/A') as description,
                          episode_version_id as related_episode_id,
                          node_id as related_node_id,
                          agent_name as related_agent_name,
                          completed_at as detected_at
                   FROM core_pipeline.node_runs
                   WHERE quality_score >= 9.0
                   AND created_at >= now() - make_interval(days => %s)
                   ORDER BY quality_score DESC LIMIT %s""",
                (days, limit),
            ) or []
            items.extend(excellent)
        payload = {"items": items}

    elif command == "agent-profile":
        # GET /api/agents/:name/profile
        if len(argv) < 3:
            raise SystemExit("agent-profile requires <agent_name>")
        agent_name = argv[2]
        # Agent registry info
        from backend.agents.registry import register_all_agents, get_agent
        register_all_agents()
        try:
            agent = get_agent(agent_name)
            agent_info = {"agent_name": agent_name, "description": str(agent)}
        except Exception:
            agent_info = {"agent_name": agent_name, "description": "Not registered"}
        # Stats from node_runs (columns may vary across migrations)
        try:
            stats = _fetch_one(
                """SELECT COUNT(*) as total_tasks,
                    COUNT(*) FILTER (WHERE status = 'completed') as success_count
                   FROM core_pipeline.node_runs
                   WHERE agent_role = %s""",
                (agent_name,),
            ) or {}
        except Exception:
            stats = {"total_tasks": 0, "success_count": 0}
        # Quality trend (from agent_traces instead, more reliable)
        quality_trend = []
        try:
            quality_trend = _fetch_all(
                """SELECT DATE(created_at) as date, COUNT(*) as trace_count
                   FROM core_pipeline.agent_traces
                   WHERE agent_name = %s
                   AND created_at >= now() - INTERVAL '30 days'
                   GROUP BY DATE(created_at) ORDER BY date""",
                (agent_name,),
            ) or []
        except Exception:
            pass
        # Memories
        from backend.common.agent_memory import list_memories
        memories = list_memories(agent_name, limit=20)
        # Recent decisions from agent_traces
        try:
            recent = _fetch_all(
                """SELECT DISTINCT ON (node_run_id) node_run_id, reasoning as decision_summary,
                          created_at as timestamp
                   FROM core_pipeline.agent_traces
                   WHERE agent_name = %s
                   ORDER BY node_run_id, created_at DESC
                   LIMIT 10""",
                (agent_name,),
            ) or []
        except Exception:
            recent = []
        # Current strategy (active prompt)
        from backend.common.prompt_assets import list_prompts
        prompts = list_prompts(agent_name)
        payload = {
            **agent_info,
            "stats": stats,
            "quality_trend": quality_trend,
            "memories": memories,
            "recent_decisions": recent,
            "active_prompts": prompts,
        }

    elif command == "agent-decisions":
        # GET /api/agents/:name/decisions
        if len(argv) < 3:
            raise SystemExit("agent-decisions requires <agent_name>")
        agent_name = argv[2]
        limit = int(argv[3]) if len(argv) >= 4 else 20
        decisions = _fetch_all(
            """SELECT t.node_run_id, t.trace_type, t.reasoning as content,
                      t.tokens_used, t.duration_ms, t.created_at,
                      nr.node_id, nr.episode_version_id, nr.quality_score, nr.status as outcome_status
               FROM core_pipeline.agent_traces t
               LEFT JOIN core_pipeline.node_runs nr ON t.node_run_id = nr.id
               WHERE t.agent_name = %s
               ORDER BY t.created_at DESC LIMIT %s""",
            (agent_name, limit),
        ) or []
        payload = {"decisions": decisions}

    elif command == "evolution-daily-report":
        # GET /api/evolution/daily-report?date=
        target_date = argv[2] if len(argv) >= 3 else None
        date_filter = "DATE(created_at) = %s" if target_date else "DATE(created_at) = CURRENT_DATE"
        date_params = [target_date] if target_date else []
        # Evolution runs for the day
        runs = _fetch_all(
            f"""SELECT * FROM core_pipeline.evolution_runs
                WHERE {date_filter}
                ORDER BY created_at DESC""",
            date_params,
        ) or []
        # Prompt changes
        changes = _fetch_all(
            f"""SELECT pv.*, pa.agent_name, pa.prompt_stage
                FROM core_pipeline.prompt_versions pv
                LEFT JOIN core_pipeline.prompt_assets pa ON pv.prompt_asset_id = pa.id
                WHERE DATE(pv.created_at) = {'%s' if target_date else 'CURRENT_DATE'}
                ORDER BY pv.created_at DESC""",
            date_params,
        ) or []
        # RAG stats for the day
        rag_stats = _fetch_one(
            f"""SELECT
                COUNT(*) FILTER (WHERE case_type = 'positive') as new_positive,
                COUNT(*) FILTER (WHERE case_type = 'negative') as new_negative,
                COUNT(*) FILTER (WHERE case_type = 'corrective') as new_corrective
               FROM core_pipeline.rag_chain_cases
               WHERE DATE(created_at) = {'%s' if target_date else 'CURRENT_DATE'}""",
            date_params,
        ) or {"new_positive": 0, "new_negative": 0, "new_corrective": 0}
        total_cases = _fetch_one(
            "SELECT COUNT(*) as cnt FROM core_pipeline.rag_chain_cases", ()
        )
        rag_stats["total_cases"] = total_cases["cnt"] if total_cases else 0
        payload = {
            "date": target_date or str(datetime.now(timezone.utc).date()),
            "evolution_runs": runs,
            "prompt_changes": changes,
            "rag_stats": rag_stats,
        }

    elif command == "prompt-detail":
        # GET /api/evolution/prompts/:id
        if len(argv) < 3:
            raise SystemExit("prompt-detail requires <prompt_id>")
        prompt_id = argv[2]
        prompt = _fetch_one(
            "SELECT * FROM core_pipeline.prompt_assets WHERE id = %s",
            (prompt_id,),
        )
        if not prompt:
            payload = {"error": "not_found"}
        else:
            versions = _fetch_all(
                """SELECT * FROM core_pipeline.prompt_versions
                   WHERE prompt_asset_id = %s ORDER BY created_at DESC""",
                (prompt_id,),
            ) or []
            adapters = _fetch_all(
                """SELECT * FROM core_pipeline.genre_adapters
                   WHERE prompt_asset_id = %s ORDER BY genre_tag""",
                (prompt_id,),
            ) or []
            payload = {**prompt, "versions": versions, "genre_adapters": adapters}

    elif command == "gpu-status":
        # GET /api/resources/gpu-status — placeholder, real data from K8s metrics
        # In production: query K8s metrics API or DCGM exporter
        payload = {
            "gpus": [
                {"gpu_id": i, "model": "A800-80GB", "memory_total_gb": 80,
                 "memory_used_gb": 0, "utilization_pct": 0, "temperature_c": 0,
                 "assigned_models": [], "current_job": None}
                for i in range(8)
            ],
            "node_name": "gpu-node",
            "cluster": "autoflow-vke-dev",
            "source": "placeholder",
            "note": "Real data requires dcgm-exporter DaemonSet deployment",
        }

    elif command == "api-usage":
        # GET /api/resources/api-usage
        days = int(argv[2]) if len(argv) >= 3 else 7
        try:
            services = _fetch_all(
                """SELECT
                    COALESCE(cost_type, 'unknown') as service_name,
                    COUNT(*) as total_calls,
                    SUM(amount_cny) as total_cost_cny
                   FROM core_pipeline.cost_events
                   WHERE created_at >= now() - make_interval(days => %s)
                   GROUP BY cost_type
                   ORDER BY total_cost_cny DESC""",
                (days,),
            ) or []
        except Exception:
            services = []
        payload = {"period_days": days, "services": services}

    elif command == "health":
        # GET /api/health — system health check
        checks = []
        # PostgreSQL
        try:
            _fetch_one("SELECT 1 as ok", ())
            checks.append({"name": "postgres", "status": "up", "latency_ms": 0})
        except Exception as e:
            checks.append({"name": "postgres", "status": "down", "error": str(e)})
        # Redis
        try:
            import redis
            import os
            r = redis.Redis(
                host=os.environ.get("REDIS_HOST", "127.0.0.1"),
                port=int(os.environ.get("REDIS_PORT", 6379)),
                socket_timeout=2,
            )
            r.ping()
            checks.append({"name": "redis", "status": "up"})
        except Exception:
            checks.append({"name": "redis", "status": "down"})
        # Qdrant
        try:
            from backend.common.rag import get_rag_client
            client = get_rag_client()
            h = client.health()
            checks.append({"name": "qdrant", "status": "up" if h.get("healthy") else "degraded"})
        except Exception:
            checks.append({"name": "qdrant", "status": "down"})
        # RocketMQ
        try:
            from backend.common.mq import get_mq_client
            mq = get_mq_client()
            h = mq.health()
            checks.append({"name": "rocketmq", "status": "up" if h.get("connected") or h.get("grpc_connected") else "down"})
        except Exception:
            checks.append({"name": "rocketmq", "status": "down"})
        all_up = all(c["status"] == "up" for c in checks)
        any_down = any(c["status"] == "down" for c in checks)
        overall = "healthy" if all_up else ("down" if any_down else "degraded")
        payload = {"status": overall, "services": checks}

    elif command == "agents-collaboration":
        # GET /api/agents/collaboration — graph data for collaboration visualization
        from backend.orchestrator.graph.topology import PIPELINE_NODES, NODE_AGENT_ROLE
        nodes_list = []
        edges_list = []
        agents_seen: set[str] = set()
        for node_id in PIPELINE_NODES:
            agent = NODE_AGENT_ROLE.get(node_id, "unknown")
            if agent not in agents_seen:
                nodes_list.append({"id": agent, "label": agent, "type": "agent"})
                agents_seen.add(agent)
        # Edges from pipeline order
        for i in range(len(PIPELINE_NODES) - 1):
            from_agent = NODE_AGENT_ROLE.get(PIPELINE_NODES[i], "unknown")
            to_agent = NODE_AGENT_ROLE.get(PIPELINE_NODES[i + 1], "unknown")
            if from_agent != to_agent:
                edges_list.append({
                    "from": from_agent,
                    "to": to_agent,
                    "label": f"{PIPELINE_NODES[i]}→{PIPELINE_NODES[i+1]}",
                })
        payload = {"nodes": nodes_list, "edges": edges_list}

    else:
        raise SystemExit(f"unsupported command: {command}")

    print(json.dumps(payload, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main(sys.argv)
