from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from psycopg.types.json import Jsonb

from backend.common.db import fetch_all, fetch_one, get_connection

SEED_NAMESPACE = "round4_dev_seed"
ROUND6_NAMESPACE = "round6_dev_seed"
ROUND7_NAMESPACE = "round7_dev_seed"
STAGE_TO_GATE_NODE: dict[int, str] = {
    1: "N08",
    2: "N18",
    3: "N21",
    4: "N24",
}
STAGE_TO_ROOT_CAUSE_NODE: dict[int, str] = {
    1: "N07",
    2: "N17",
    3: "N20",
    4: "N23",
}


@dataclass(frozen=True, slots=True)
class NodeRegistrySeed:
    node_id: str
    name: str
    stage_group: str
    agent_role: str | None
    depends_on: list[str]
    is_human_gate: bool = False
    review_mapping: str | None = None
    review_steps: list[dict[str, Any]] | None = None
    comfyui_workflow_id: str | None = None
    reject_target_node_id: str | None = None
    max_auto_rejects: int = 3
    estimated_duration_s: int | None = None


NODE_REGISTRY_SEEDS: list[NodeRegistrySeed] = [
    NodeRegistrySeed("N01", "剧本结构化解析", "script", "script_analyst", [], estimated_duration_s=45),
    NodeRegistrySeed("N02", "拆集拆镜", "script", "director", ["N01"], estimated_duration_s=120),
    NodeRegistrySeed("N03", "分镜质检", "script", "quality_guardian", ["N02"], reject_target_node_id="N02", estimated_duration_s=60),
    NodeRegistrySeed("N04", "分镜定稿", "script", "director", ["N03"], estimated_duration_s=90),
    NodeRegistrySeed("N05", "镜头分级", "script", "director", ["N04"], estimated_duration_s=45),
    NodeRegistrySeed("N06", "视觉元素生成", "art", "visual_director", ["N04", "N05"], estimated_duration_s=180),
    NodeRegistrySeed("N07", "美术产品图生成", "art", "visual_director", ["N06"], comfyui_workflow_id="wf-art-assets", estimated_duration_s=600),
    NodeRegistrySeed(
        "N08",
        "Stage1 资产审核 Gate",
        "art",
        "human_review_entry",
        ["N07"],
        is_human_gate=True,
        review_mapping="stage1_asset_review",
        review_steps=[{"step_no": 1, "reviewer_role": "middle_platform", "skippable": False, "granularity": "asset"}],
        estimated_duration_s=0,
    ),
    NodeRegistrySeed("N09", "美术定稿固化", "art", "visual_director", ["N08"], comfyui_workflow_id="wf-art-freeze", estimated_duration_s=240),
    NodeRegistrySeed("N10", "关键帧生成(LLM+ComfyUI两阶段)", "keyframe", "visual_director", ["N06", "N09"], comfyui_workflow_id="wf-keyframe-generate", estimated_duration_s=300),
    NodeRegistrySeed("N11", "关键帧质检", "keyframe", "quality_guardian", ["N10"], reject_target_node_id="N10", estimated_duration_s=120),
    NodeRegistrySeed("N12", "跨镜头连续性检查", "keyframe", "storyboard_planner", ["N11"], estimated_duration_s=75),
    NodeRegistrySeed("N13", "关键帧定稿固化", "keyframe", "visual_director", ["N12"], comfyui_workflow_id="wf-keyframe-final", estimated_duration_s=180),
    NodeRegistrySeed("N14", "视频生成", "video", "visual_director", ["N13"], comfyui_workflow_id="wf-video-generate", estimated_duration_s=1200),
    NodeRegistrySeed("N15", "视频质检", "video", "quality_guardian", ["N14"], reject_target_node_id="N14", estimated_duration_s=150),
    NodeRegistrySeed("N16", "节奏连续性分析", "video", "storyboard_planner", ["N15"], estimated_duration_s=90),
    NodeRegistrySeed("N17", "视频定稿固化", "video", "visual_director", ["N16"], comfyui_workflow_id="wf-video-final", estimated_duration_s=300),
    NodeRegistrySeed(
        "N18",
        "Stage2 Shot 审核 Gate",
        "video",
        "human_review_entry",
        ["N17"],
        is_human_gate=True,
        review_mapping="stage2_shot_review",
        review_steps=[{"step_no": 1, "reviewer_role": "qc_inspector", "skippable": False, "granularity": "shot"}],
        estimated_duration_s=0,
    ),
    NodeRegistrySeed("N19", "视觉整体定稿", "video", "visual_director", ["N18"], estimated_duration_s=120),
    NodeRegistrySeed("N20", "视听整合", "audio", "audio_director", ["N19"], estimated_duration_s=720),
    NodeRegistrySeed(
        "N21",
        "Stage3 Episode 审核 Gate",
        "audio",
        "human_review_entry",
        ["N20"],
        is_human_gate=True,
        review_mapping="stage3_episode_review",
        review_steps=[{"step_no": 1, "reviewer_role": "qc_inspector", "skippable": False, "granularity": "episode"}],
        estimated_duration_s=0,
    ),
    NodeRegistrySeed("N22", "视听定稿固化", "audio", "audio_director", ["N21"], estimated_duration_s=150),
    NodeRegistrySeed("N23", "成片合成", "final", "director", ["N22"], comfyui_workflow_id="wf-final-compose", estimated_duration_s=480),
    NodeRegistrySeed(
        "N24",
        "Stage4 串行审核 Gate",
        "final",
        "human_review_entry",
        ["N23"],
        is_human_gate=True,
        review_mapping="stage4_serial_review",
        review_steps=[
            {"step_no": 1, "reviewer_role": "qc_inspector", "skippable": True, "granularity": "episode"},
            {"step_no": 2, "reviewer_role": "middle_platform", "skippable": False, "granularity": "episode"},
            {"step_no": 3, "reviewer_role": "partner", "skippable": False, "granularity": "episode"},
        ],
        estimated_duration_s=0,
    ),
    NodeRegistrySeed("N25", "成片定稿固化", "final", "director", ["N24"], estimated_duration_s=90),
    NodeRegistrySeed("N26", "分发与推送", "final", "director", ["N25"], estimated_duration_s=30),
]


def utc_now() -> datetime:
    return datetime.now(tz=UTC)


def _stage_no_from_node_id(node_id: str | None) -> int | None:
    if not node_id or not node_id.startswith("N"):
        return None
    try:
        node_no = int(node_id[1:])
    except ValueError:
        return None
    if 1 <= node_no <= 8:
        return 1
    if 9 <= node_no <= 18:
        return 2
    if 19 <= node_no <= 21:
        return 3
    if 22 <= node_no <= 26:
        return 4
    return None


def _review_steps(seed: NodeRegistrySeed) -> list[dict[str, Any]]:
    return seed.review_steps or []


def _quality_threshold(seed: NodeRegistrySeed) -> dict[str, Any]:
    if seed.node_id == "N03":
        return {"score_min": 8.0}
    if seed.node_id == "N11":
        return {"pass_rate_min": 0.85}
    if seed.node_id == "N15":
        return {"physics_check": True, "face_check": True}
    return {}


def _model_config(seed: NodeRegistrySeed) -> dict[str, Any]:
    if seed.is_human_gate:
        return {"mode": "human_gate"}
    if seed.stage_group == "script":
        return {"provider": "llm", "profile": "text-reasoning"}
    if seed.node_id == "N10":
        return {
            "provider": "hybrid",
            "phase1": {"provider": "llm", "model": "gemini-3.1-pro-preview", "profile": "prompt-engineering"},
            "phase2": {"provider": "comfyui", "workflow_id": seed.comfyui_workflow_id},
        }
    if seed.stage_group in {"art", "keyframe", "video", "final"}:
        return {"provider": "comfyui", "workflow_id": seed.comfyui_workflow_id}
    if seed.stage_group == "audio":
        return {"provider": "audio-stack", "profile": "tts-sync-mix"}
    return {"provider": "internal"}


def _produces_artifacts(seed: NodeRegistrySeed) -> list[str]:
    mapping = {
        "N07": ["image"],
        "N09": ["image", "prompt_json", "comfyui_workflow"],
        "N10": ["prompt_json", "image", "comfyui_workflow"],
        "N13": ["image", "prompt_json", "comfyui_workflow"],
        "N14": ["video"],
        "N17": ["video", "comfyui_workflow"],
        "N19": ["video"],
        "N20": ["audio", "timeline_json"],
        "N22": ["audio", "timeline_json"],
        "N23": ["video", "subtitle_json", "comfyui_workflow"],
        "N25": ["video"],
    }
    return mapping.get(seed.node_id, [])


def seed_node_registry() -> dict[str, Any]:
    now = utc_now()
    with get_connection() as connection, connection.cursor() as cursor:
        for seed in NODE_REGISTRY_SEEDS:
            cursor.execute(
                """
                insert into core_pipeline.node_registry (
                    node_id,
                    name,
                    stage_group,
                    is_human_gate,
                    depends_on,
                    inputs_schema,
                    outputs_schema,
                    retry_policy,
                    timeout_s,
                    cost_tags,
                    produces_artifacts,
                    review_mapping,
                    is_active,
                    created_at,
                    updated_at,
                    agent_role,
                    review_steps,
                    model_config,
                    comfyui_nodes,
                    comfyui_workflow_id,
                    rag_sources,
                    quality_threshold,
                    estimated_duration_s,
                    reject_target_node_id,
                    max_auto_rejects
                ) values (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                on conflict (node_id) do update set
                    name = excluded.name,
                    stage_group = excluded.stage_group,
                    is_human_gate = excluded.is_human_gate,
                    depends_on = excluded.depends_on,
                    inputs_schema = excluded.inputs_schema,
                    outputs_schema = excluded.outputs_schema,
                    retry_policy = excluded.retry_policy,
                    timeout_s = excluded.timeout_s,
                    cost_tags = excluded.cost_tags,
                    produces_artifacts = excluded.produces_artifacts,
                    review_mapping = excluded.review_mapping,
                    is_active = excluded.is_active,
                    updated_at = excluded.updated_at,
                    agent_role = excluded.agent_role,
                    review_steps = excluded.review_steps,
                    model_config = excluded.model_config,
                    comfyui_nodes = excluded.comfyui_nodes,
                    comfyui_workflow_id = excluded.comfyui_workflow_id,
                    rag_sources = excluded.rag_sources,
                    quality_threshold = excluded.quality_threshold,
                    estimated_duration_s = excluded.estimated_duration_s,
                    reject_target_node_id = excluded.reject_target_node_id,
                    max_auto_rejects = excluded.max_auto_rejects
                """,
                (
                    seed.node_id,
                    seed.name,
                    seed.stage_group,
                    seed.is_human_gate,
                    Jsonb(seed.depends_on),
                    Jsonb({"seed_namespace": SEED_NAMESPACE, "node_id": seed.node_id}),
                    Jsonb({"primary_output": _produces_artifacts(seed)}),
                    Jsonb({"max_retries": 3 if not seed.is_human_gate else 0}),
                    seed.estimated_duration_s or 300,
                    Jsonb([seed.stage_group]),
                    Jsonb(_produces_artifacts(seed)),
                    seed.review_mapping,
                    True,
                    now,
                    now,
                    seed.agent_role,
                    Jsonb(_review_steps(seed)),
                    Jsonb(_model_config(seed)),
                    Jsonb([]),
                    seed.comfyui_workflow_id,
                    Jsonb([]),
                    Jsonb(_quality_threshold(seed)),
                    seed.estimated_duration_s,
                    seed.reject_target_node_id,
                    seed.max_auto_rejects,
                ),
            )
        connection.commit()

    return {
        "seed_namespace": SEED_NAMESPACE,
        "seeded_count": len(NODE_REGISTRY_SEEDS),
        "node_ids": [seed.node_id for seed in NODE_REGISTRY_SEEDS],
    }


def _pick_demo_episode_versions(limit: int = 3) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            version_no,
            status,
            created_at
        from public.episode_versions
        order by created_at desc
        limit %s
        """,
        (limit,),
    )
    if len(rows) < 2:
        raise RuntimeError("at least two episode_versions are required for round4 dev seed")
    return rows


def _pick_demo_users() -> dict[str, str]:
    users = fetch_all(
        """
        select id::text as id, role
        from public.users
        order by created_at asc
        """
    )
    role_map: dict[str, str] = {}
    for user in users:
        role = user["role"]
        if role == "qc" and "qc_inspector" not in role_map:
            role_map["qc_inspector"] = user["id"]
        if role in {"platform_editor", "admin"} and "middle_platform" not in role_map:
            role_map["middle_platform"] = user["id"]
        if role == "partner_reviewer" and "partner" not in role_map:
            role_map["partner"] = user["id"]
    missing = [role for role in ("qc_inspector", "middle_platform", "partner") if role not in role_map]
    if missing:
        raise RuntimeError(f"missing demo users for roles: {', '.join(missing)}")
    return role_map


def _find_existing_run(seed_key: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        select id::text as id
        from core_pipeline.runs
        where plan_json ->> 'seed_key' = %s
        limit 1
        """,
        (seed_key,),
    )


def _insert_run(
    cursor: Any,
    *,
    episode_id: str,
    episode_version_id: str,
    seed_key: str,
    current_node_id: str,
    status: str,
    is_rerun: bool = False,
    rerun_from_ticket_id: str | None = None,
) -> str:
    existing = _find_existing_run(seed_key)
    if existing:
        cursor.execute(
            """
            update core_pipeline.runs
            set status = %s,
                current_node_id = %s,
                current_stage_no = %s,
                updated_at = %s
            where id = %s
            returning id::text as id
            """,
            (status, current_node_id, _stage_no_from_node_id(current_node_id), utc_now(), existing["id"]),
        )
        return cursor.fetchone()["id"]

    run_id = str(uuid4())
    now = utc_now()
    cursor.execute(
        """
        insert into core_pipeline.runs (
            id,
            episode_id,
            episode_version_id,
            status,
            current_node_id,
            current_stage_no,
            plan_json,
            started_at,
            finished_at,
            created_at,
            updated_at,
            is_rerun,
            rerun_from_ticket_id,
            langgraph_thread_id
        ) values (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        """,
        (
            run_id,
            episode_id,
            episode_version_id,
            status,
            current_node_id,
            _stage_no_from_node_id(current_node_id),
            Jsonb({"seed_key": seed_key, "seed_namespace": SEED_NAMESPACE}),
            now,
            None,
            now,
            now,
            is_rerun,
            rerun_from_ticket_id,
            f"lg-{seed_key}",
        ),
    )
    return run_id


def _upsert_node_run(
    cursor: Any,
    *,
    run_id: str,
    episode_version_id: str,
    node_id: str,
    agent_role: str,
    status: str,
    attempt_no: int = 1,
    input_ref: str | None = None,
    output_ref: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    quality_score: float | None = None,
    model_provider: str | None = None,
    model_endpoint: str | None = None,
    gpu_seconds: float = 0.0,
    cost_cny: float = 0.0,
    tags: list[str] | None = None,
) -> str:
    now = utc_now()
    cursor.execute(
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
            %s, %s, %s, %s, %s, %s, 0, %s, %s, %s, 0, 0, 0, %s, %s, %s, %s, %s,
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
            attempt_no,
            input_ref,
            output_ref,
            model_provider,
            gpu_seconds,
            cost_cny,
            error_code,
            error_message,
            Jsonb(tags or [SEED_NAMESPACE]),
            now,
            None if status in {"running", "pending"} else now,
            None if status in {"running", "pending"} else 60,
            now,
            now,
            agent_role,
            f"{SEED_NAMESPACE}:{run_id}:{node_id}",
            model_endpoint,
            quality_score,
        ),
    )
    return cursor.fetchone()["id"]


def _find_run_by_seed_key(seed_key: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        select
            id::text as id,
            episode_id::text as episode_id,
            episode_version_id::text as episode_version_id
        from core_pipeline.runs
        where plan_json ->> 'seed_key' = %s
        limit 1
        """,
        (seed_key,),
    )


def _upsert_artifact(
    cursor: Any,
    *,
    episode_version_id: str,
    node_run_id: str,
    artifact_type: str,
    resource_url: str,
    preview_url: str | None,
    meta_json: dict[str, Any],
    anchor_type: str = "asset",
) -> str:
    existing = fetch_one(
        """
        select id::text as id
        from core_pipeline.artifacts
        where episode_version_id::text = %s
          and node_run_id::text = %s
          and artifact_type = %s
          and resource_url = %s
        limit 1
        """,
        (episode_version_id, node_run_id, artifact_type, resource_url),
    )
    if existing:
        cursor.execute(
            """
            update core_pipeline.artifacts
            set preview_url = %s,
                meta_json = %s
            where id = %s
            returning id::text as id
            """,
            (preview_url, Jsonb(meta_json), existing["id"]),
        )
        return cursor.fetchone()["id"]

    artifact_id = str(uuid4())
    cursor.execute(
        """
        insert into core_pipeline.artifacts (
            id,
            episode_version_id,
            node_run_id,
            artifact_type,
            anchor_type,
            anchor_id,
            time_range,
            resource_url,
            preview_url,
            meta_json,
            created_at
        ) values (
            %s, %s, %s, %s, %s::public.anchor_type, null, null, %s, %s, %s, %s
        )
        returning id::text as id
        """,
        (
            artifact_id,
            episode_version_id,
            node_run_id,
            artifact_type,
            anchor_type,
            resource_url,
            preview_url,
            Jsonb(meta_json),
            utc_now(),
        ),
    )
    return cursor.fetchone()["id"]


def seed_round6_artifact_fixture() -> dict[str, Any]:
    rerun_run = _find_run_by_seed_key(f"{SEED_NAMESPACE}:rerun_run")
    if rerun_run is None:
        raise RuntimeError("round4 rerun_run seed is required before round6 artifact fixture")

    artifact_specs = {
        "N09": {
            "agent_role": "visual_director",
            "model_provider": "comfyui",
            "model_endpoint": "wf-art-freeze",
            "gpu_seconds": 8.0,
            "cost_cny": 0.5,
            "artifacts": ["image", "prompt_json", "comfyui_workflow"],
        },
        "N13": {
            "agent_role": "visual_director",
            "model_provider": "comfyui",
            "model_endpoint": "wf-keyframe-final",
            "gpu_seconds": 10.0,
            "cost_cny": 0.6,
            "artifacts": ["image", "prompt_json", "comfyui_workflow"],
        },
        "N17": {
            "agent_role": "visual_director",
            "model_provider": "comfyui",
            "model_endpoint": "wf-video-final",
            "gpu_seconds": 16.0,
            "cost_cny": 1.4,
            "artifacts": ["video", "comfyui_workflow"],
        },
        "N19": {
            "agent_role": "visual_director",
            "model_provider": "comfyui",
            "model_endpoint": "wf-video-global-final",
            "gpu_seconds": 6.0,
            "cost_cny": 0.4,
            "artifacts": ["video"],
        },
        "N22": {
            "agent_role": "audio_director",
            "model_provider": "audio-stack",
            "model_endpoint": "tts-sync-mix",
            "gpu_seconds": 4.0,
            "cost_cny": 0.3,
            "artifacts": ["audio", "timeline_json"],
        },
        "N25": {
            "agent_role": "director",
            "model_provider": "comfyui",
            "model_endpoint": "wf-final-deliver",
            "gpu_seconds": 7.0,
            "cost_cny": 0.8,
            "artifacts": ["video"],
        },
    }

    seeded_node_runs: list[str] = []
    seeded_artifacts: list[str] = []
    with get_connection() as connection, connection.cursor() as cursor:
        for node_id, spec in artifact_specs.items():
            input_ref = f"tos://autoflow-media/{rerun_run['episode_version_id']}/{node_id}/input.json"
            output_ref = f"tos://autoflow-media/{rerun_run['episode_version_id']}/{node_id}/output.bin"
            if "video" in spec["artifacts"]:
                output_ref = f"tos://autoflow-media/{rerun_run['episode_version_id']}/{node_id}/output.mp4"
            elif "audio" in spec["artifacts"]:
                output_ref = f"tos://autoflow-media/{rerun_run['episode_version_id']}/{node_id}/output.wav"
            elif "image" in spec["artifacts"]:
                output_ref = f"tos://autoflow-media/{rerun_run['episode_version_id']}/{node_id}/output.png"

            node_run_id = _upsert_node_run(
                cursor,
                run_id=rerun_run["id"],
                episode_version_id=rerun_run["episode_version_id"],
                node_id=node_id,
                agent_role=str(spec["agent_role"]),
                status="succeeded",
                input_ref=input_ref,
                output_ref=output_ref,
                model_provider=str(spec["model_provider"]),
                model_endpoint=str(spec["model_endpoint"]),
                gpu_seconds=float(spec["gpu_seconds"]),
                cost_cny=float(spec["cost_cny"]),
                tags=[SEED_NAMESPACE, ROUND6_NAMESPACE, "artifact_fixture"],
                quality_score=0.92,
            )
            seeded_node_runs.append(node_run_id)

            for artifact_type in spec["artifacts"]:
                if artifact_type == "prompt_json":
                    resource_url = f"tos://autoflow-media/{rerun_run['episode_version_id']}/{node_id}/prompt.json"
                    preview_url = None
                elif artifact_type == "comfyui_workflow":
                    resource_url = f"tos://autoflow-media/{rerun_run['episode_version_id']}/{node_id}/workflow.json"
                    preview_url = None
                elif artifact_type == "timeline_json":
                    resource_url = f"tos://autoflow-media/{rerun_run['episode_version_id']}/{node_id}/timeline.json"
                    preview_url = None
                else:
                    resource_url = output_ref
                    preview_url = output_ref

                artifact_id = _upsert_artifact(
                    cursor,
                    episode_version_id=rerun_run["episode_version_id"],
                    node_run_id=node_run_id,
                    artifact_type=artifact_type,
                    resource_url=resource_url,
                    preview_url=preview_url,
                    meta_json={
                        "seed_namespace": ROUND6_NAMESPACE,
                        "source_seed_namespace": SEED_NAMESPACE,
                        "node_id": node_id,
                        "artifact_type": artifact_type,
                    },
                )
                seeded_artifacts.append(artifact_id)

        connection.commit()

    return {
        "seed_namespace": ROUND6_NAMESPACE,
        "run_id": rerun_run["id"],
        "episode_version_id": rerun_run["episode_version_id"],
        "seeded_node_run_count": len(seeded_node_runs),
        "seeded_artifact_count": len(seeded_artifacts),
    }


def _ensure_review_task(
    cursor: Any,
    *,
    episode_id: str,
    episode_version_id: str,
    stage_no: int,
    gate_node_id: str,
    review_step_no: int,
    reviewer_role: str,
    review_granularity: str,
    anchor_type: str | None,
    anchor_id: str | None,
    assignee_id: str | None,
    status: str,
    priority: str,
    seed_key: str,
) -> str:
    payload = {"seed_namespace": SEED_NAMESPACE, "seed_key": seed_key}
    existing = fetch_one(
        """
        select id::text as id
        from public.review_tasks
        where payload_json ->> 'seed_key' = %s
        limit 1
        """,
        (seed_key,),
    )
    now = utc_now()
    if existing:
        cursor.execute(
            """
            update public.review_tasks
            set status = %s,
                assignee_id = %s,
                started_at = %s,
                finished_at = %s,
                decision = null,
                decision_comment = null,
                payload_json = %s,
                updated_at = %s
            where id = %s
            returning id::text as id
            """,
            (
                status,
                assignee_id,
                now if status == "in_progress" else None,
                now if status in {"approved", "returned", "skipped"} else None,
                Jsonb(payload),
                now,
                existing["id"],
            ),
        )
        return cursor.fetchone()["id"]

    task_id = str(uuid4())
    cursor.execute(
        """
        insert into public.review_tasks (
            id,
            episode_id,
            episode_version_id,
            stage_no,
            gate_node_id,
            review_step_no,
            reviewer_role,
            review_granularity,
            anchor_type,
            anchor_id,
            status,
            assignee_id,
            due_at,
            priority,
            openclaw_session_id,
            payload_json,
            started_at,
            finished_at,
            decision,
            decision_comment,
            created_at,
            updated_at
        ) values (
            %s, %s, %s, %s, %s, %s, %s::public.reviewer_role, %s::public.review_granularity,
            %s::public.anchor_type, %s, %s, %s, null, %s, null, %s, %s, null, null, null, %s, %s
        )
        """,
        (
            task_id,
            episode_id,
            episode_version_id,
            stage_no,
            gate_node_id,
            review_step_no,
            reviewer_role,
            review_granularity,
            anchor_type,
            anchor_id,
            status,
            assignee_id,
            priority,
            Jsonb(payload),
            now if status == "in_progress" else None,
            now,
            now,
        ),
    )
    return task_id


def _find_seed_episode_version(seed_key: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        select id::text as id, episode_id::text as episode_id, version_no
        from public.episode_versions
        where created_by_source = %s
        limit 1
        """,
        (seed_key,),
    )


def _ensure_seed_episode_version(
    cursor: Any,
    *,
    episode_id: str,
    source_stage: int,
    seed_key: str,
    status: str,
) -> str:
    existing = _find_seed_episode_version(seed_key)
    if existing:
        cursor.execute(
            """
            update public.episode_versions
            set status = %s,
                updated_at = %s
            where id = %s
            returning id::text as id
            """,
            (status, utc_now(), existing["id"]),
        )
        return cursor.fetchone()["id"]

    latest = fetch_one(
        """
        select coalesce(max(version_no), 0) as max_version_no
        from public.episode_versions
        where episode_id::text = %s
        """,
        (episode_id,),
    )
    next_version_no = int(latest["max_version_no"] or 0) + 1
    version_id = str(uuid4())
    now = utc_now()
    cursor.execute(
        """
        insert into public.episode_versions (
            id,
            episode_id,
            version_no,
            source_stage,
            status,
            summary_text,
            created_by_source,
            created_at,
            run_id,
            total_duration_s,
            total_cost_cny,
            human_minutes,
            ai_minutes,
            return_count_total,
            return_count_by_stage,
            auto_reject_count,
            first_pass_rate,
            stage_wait_time,
            updated_at
        ) values (
            %s, %s, %s, %s, %s, %s, %s, %s, null, 0, 0, 0, 0, 1, %s, 0, 0, %s, %s
        )
        """,
        (
            version_id,
            episode_id,
            next_version_no,
            source_stage,
            status,
            f"{SEED_NAMESPACE}:{seed_key}",
            seed_key,
            now,
            Jsonb({str(source_stage): 1}),
            Jsonb({}),
            now,
        ),
    )
    return version_id


def seed_runtime_fixture() -> dict[str, Any]:
    episode_versions = _pick_demo_episode_versions(limit=2)
    users = _pick_demo_users()
    live_version = episode_versions[0]
    rerun_source_version = episode_versions[1]

    with get_connection() as connection, connection.cursor() as cursor:
        live_run_id = _insert_run(
            cursor,
            episode_id=live_version["episode_id"],
            episode_version_id=live_version["id"],
            seed_key=f"{SEED_NAMESPACE}:stage4_live_run",
            current_node_id="N24",
            status="running",
        )
        for node_id, agent_role, status in [
            ("N08", "human_review_entry", "succeeded"),
            ("N18", "human_review_entry", "succeeded"),
            ("N21", "human_review_entry", "succeeded"),
            ("N24", "human_review_entry", "running"),
        ]:
            _upsert_node_run(
                cursor,
                run_id=live_run_id,
                episode_version_id=live_version["id"],
                node_id=node_id,
                agent_role=agent_role,
                status=status,
                input_ref=f"tos://autoflow-media/{live_version['id']}/{node_id}/input.json",
                output_ref=None if status == "running" else f"tos://autoflow-media/{live_version['id']}/{node_id}/output.json",
                model_provider="internal" if agent_role == "human_review_entry" else None,
                model_endpoint="gate" if agent_role == "human_review_entry" else None,
                tags=[SEED_NAMESPACE, "stage4_live"],
            )

        live_review_task_id = _ensure_review_task(
            cursor,
            episode_id=live_version["episode_id"],
            episode_version_id=live_version["id"],
            stage_no=4,
            gate_node_id="N24",
            review_step_no=1,
            reviewer_role="qc_inspector",
            review_granularity="episode",
            anchor_type="asset",
            anchor_id=str(uuid4()),
            assignee_id=users["qc_inspector"],
            status="in_progress",
            priority="round4_live",
            seed_key=f"{SEED_NAMESPACE}:stage4_live_task",
        )

        stage2_run_id = _insert_run(
            cursor,
            episode_id=rerun_source_version["episode_id"],
            episode_version_id=rerun_source_version["id"],
            seed_key=f"{SEED_NAMESPACE}:stage2_live_run",
            current_node_id="N18",
            status="running",
        )
        for node_id, status in [("N08", "succeeded"), ("N18", "running")]:
            _upsert_node_run(
                cursor,
                run_id=stage2_run_id,
                episode_version_id=rerun_source_version["id"],
                node_id=node_id,
                agent_role="human_review_entry",
                status=status,
                input_ref=f"tos://autoflow-media/{rerun_source_version['id']}/{node_id}/input.json",
                output_ref=None if status == "running" else f"tos://autoflow-media/{rerun_source_version['id']}/{node_id}/output.json",
                model_provider="internal",
                model_endpoint="gate",
                tags=[SEED_NAMESPACE, "stage2_live"],
            )

        _ensure_review_task(
            cursor,
            episode_id=rerun_source_version["episode_id"],
            episode_version_id=rerun_source_version["id"],
            stage_no=2,
            gate_node_id="N18",
            review_step_no=1,
            reviewer_role="qc_inspector",
            review_granularity="shot",
            anchor_type="shot",
            anchor_id=str(uuid4()),
            assignee_id=users["qc_inspector"],
            status="approved",
            priority="round4_stage2",
            seed_key=f"{SEED_NAMESPACE}:stage2_task_approved",
        )
        _ensure_review_task(
            cursor,
            episode_id=rerun_source_version["episode_id"],
            episode_version_id=rerun_source_version["id"],
            stage_no=2,
            gate_node_id="N18",
            review_step_no=1,
            reviewer_role="qc_inspector",
            review_granularity="shot",
            anchor_type="shot",
            anchor_id=str(uuid4()),
            assignee_id=users["qc_inspector"],
            status="in_progress",
            priority="round4_stage2",
            seed_key=f"{SEED_NAMESPACE}:stage2_task_live",
        )

        rerun_version_id = _ensure_seed_episode_version(
            cursor,
            episode_id=rerun_source_version["episode_id"],
            source_stage=4,
            seed_key=f"{SEED_NAMESPACE}:rerun_version",
            status="patching",
        )
        rerun_run_id = _insert_run(
            cursor,
            episode_id=rerun_source_version["episode_id"],
            episode_version_id=rerun_version_id,
            seed_key=f"{SEED_NAMESPACE}:rerun_run",
            current_node_id="N23",
            status="running",
            is_rerun=True,
            rerun_from_ticket_id=None,
        )
        _upsert_node_run(
            cursor,
            run_id=rerun_run_id,
            episode_version_id=rerun_version_id,
            node_id="N23",
            agent_role="director",
            status="running",
            input_ref=f"tos://autoflow-media/{rerun_version_id}/N23/input.json",
            output_ref=None,
            model_provider="comfyui",
            model_endpoint="wf-final-compose",
            gpu_seconds=12.0,
            cost_cny=1.2,
            tags=[SEED_NAMESPACE, "rerun_live"],
        )
        connection.commit()

    return {
        "seed_namespace": SEED_NAMESPACE,
        "live_review_task_id": live_review_task_id,
        "live_run_seed_key": f"{SEED_NAMESPACE}:stage4_live_run",
        "rerun_run_seed_key": f"{SEED_NAMESPACE}:rerun_run",
    }
