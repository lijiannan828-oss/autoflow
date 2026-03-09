-- 迁移脚本：创建 core_pipeline schema 及核心表
-- 执行库：autoflow
-- 执行方式：psql -d autoflow -f migrations/004_create_core_pipeline_schema.sql

CREATE SCHEMA IF NOT EXISTS core_pipeline;

CREATE TABLE IF NOT EXISTS core_pipeline.node_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    stage_group TEXT NOT NULL,
    is_human_gate BOOLEAN NOT NULL DEFAULT false,
    depends_on JSONB NOT NULL DEFAULT '[]'::jsonb,
    inputs_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    outputs_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    retry_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    timeout_s INT NOT NULL DEFAULT 300,
    cost_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    produces_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_mapping TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core_pipeline.runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    episode_version_id UUID NOT NULL REFERENCES public.episode_versions(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'canceled')),
    current_node_id TEXT NULL,
    plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core_pipeline.node_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES core_pipeline.runs(id) ON DELETE CASCADE,
    episode_version_id UUID NOT NULL REFERENCES public.episode_versions(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'retrying', 'succeeded', 'failed', 'canceled', 'skipped', 'partial')),
    attempt_no INT NOT NULL DEFAULT 1,
    retry_count INT NOT NULL DEFAULT 0,
    input_ref TEXT NULL,
    output_ref TEXT NULL,
    model_provider TEXT NULL,
    api_calls INT NOT NULL DEFAULT 0,
    token_in BIGINT NOT NULL DEFAULT 0,
    token_out BIGINT NOT NULL DEFAULT 0,
    gpu_seconds NUMERIC(12,3) NOT NULL DEFAULT 0,
    cost_cny NUMERIC(12,2) NOT NULL DEFAULT 0,
    error_code TEXT NULL,
    error_message TEXT NULL,
    tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NULL,
    ended_at TIMESTAMPTZ NULL,
    duration_s INT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(run_id, node_id, attempt_no)
);

CREATE TABLE IF NOT EXISTS core_pipeline.artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_version_id UUID NOT NULL REFERENCES public.episode_versions(id) ON DELETE CASCADE,
    node_run_id UUID NULL REFERENCES core_pipeline.node_runs(id) ON DELETE SET NULL,
    artifact_type TEXT NOT NULL,
    anchor_type public.anchor_type NOT NULL,
    anchor_id UUID NULL,
    time_range JSONB NULL,
    resource_url TEXT NOT NULL,
    preview_url TEXT NULL,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core_pipeline.return_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    episode_version_id UUID NOT NULL REFERENCES public.episode_versions(id) ON DELETE CASCADE,
    stage_no SMALLINT NOT NULL CHECK (stage_no BETWEEN 1 AND 4),
    anchor_type public.anchor_type NOT NULL,
    anchor_id UUID NULL,
    timestamp_ms BIGINT NULL,
    issue_type TEXT NOT NULL,
    severity public.severity NOT NULL,
    comment TEXT NOT NULL,
    created_by_role TEXT NOT NULL,
    suggested_stage_back TEXT NULL,
    system_root_cause_node_id TEXT NULL,
    rerun_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wontfix')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_node_registry_stage
    ON core_pipeline.node_registry(stage_group, is_human_gate);

CREATE INDEX IF NOT EXISTS idx_cp_runs_episode_version
    ON core_pipeline.runs(episode_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cp_node_runs_version_node
    ON core_pipeline.node_runs(episode_version_id, node_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cp_node_runs_status
    ON core_pipeline.node_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cp_artifacts_version_type
    ON core_pipeline.artifacts(episode_version_id, artifact_type);

CREATE INDEX IF NOT EXISTS idx_cp_artifacts_anchor
    ON core_pipeline.artifacts(anchor_type, anchor_id);

CREATE INDEX IF NOT EXISTS idx_cp_return_tickets_episode
    ON core_pipeline.return_tickets(episode_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cp_return_tickets_status
    ON core_pipeline.return_tickets(status, created_at DESC);
