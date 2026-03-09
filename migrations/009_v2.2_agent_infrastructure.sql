-- Migration 009: v2.2 Agent Infrastructure
-- Adds all tables required for the 10-Agent self-evolving pipeline.
-- Follows "only add" principle: no drops, no column type changes.

BEGIN;

-- ═══════════════════════════════════════════════
-- 1. New enums (in core_pipeline schema)
-- ═══════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_name_enum') THEN
        CREATE TYPE core_pipeline.agent_name_enum AS ENUM (
            'script_analyst', 'shot_designer',
            'visual_director', 'audio_director', 'compositor',
            'quality_inspector', 'review_dispatcher',
            'supervisor', 'evolution_engine',
            'orchestrator'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_type_enum') THEN
        CREATE TYPE core_pipeline.memory_type_enum AS ENUM (
            'task_summary', 'lesson_learned', 'preference', 'statistics'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_scope_enum') THEN
        CREATE TYPE core_pipeline.memory_scope_enum AS ENUM ('global', 'project', 'episode');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evolution_type_enum') THEN
        CREATE TYPE core_pipeline.evolution_type_enum AS ENUM (
            'reflection', 'prompt_ab_test', 'lora_train', 'rag_cleanup'
        );
    END IF;
END
$$;

-- ═══════════════════════════════════════════════
-- 2. Agent Memory — project-scoped Agent knowledge
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_pipeline.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(64) NOT NULL,
    memory_type VARCHAR(32) NOT NULL,
    scope VARCHAR(16) NOT NULL DEFAULT 'project',
    scope_id VARCHAR(128),
    content_key VARCHAR(256) NOT NULL,
    content_value JSONB NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 0.5,
    access_count INT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_scope
    ON core_pipeline.agent_memory(agent_name, scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_key
    ON core_pipeline.agent_memory(content_key);

-- ═══════════════════════════════════════════════
-- 3. Agent Traces — decision audit log
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_pipeline.agent_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(64) NOT NULL,
    node_id VARCHAR(8),
    run_id UUID,
    episode_version_id UUID,
    trace_type VARCHAR(32) NOT NULL,
    input_summary JSONB,
    reasoning TEXT,
    output_summary JSONB,
    duration_ms INT,
    cost_cny REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_traces_run
    ON core_pipeline.agent_traces(run_id, agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_traces_created
    ON core_pipeline.agent_traces(created_at DESC);

-- ═══════════════════════════════════════════════
-- 4. Prompt Assets — master prompt templates
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_pipeline.prompt_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(64) NOT NULL,
    prompt_stage VARCHAR(64) NOT NULL,
    master_version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    master_system_prompt TEXT NOT NULL,
    master_output_schema_ref VARCHAR(256),
    locked_by VARCHAR(128),
    locked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_assets_stage
    ON core_pipeline.prompt_assets(agent_name, prompt_stage) WHERE is_active;

-- ═══════════════════════════════════════════════
-- 5. Genre Adapters — per-genre prompt tweaks
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_pipeline.genre_adapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_asset_id UUID NOT NULL REFERENCES core_pipeline.prompt_assets(id),
    genre_tag VARCHAR(64) NOT NULL,
    adapter_prompt TEXT NOT NULL,
    style_keywords JSONB DEFAULT '[]',
    few_shot_case_ids JSONB DEFAULT '[]',
    created_by VARCHAR(16) NOT NULL DEFAULT 'human',
    total_uses INT NOT NULL DEFAULT 0,
    avg_qc_score REAL,
    human_approval_rate REAL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════
-- 6. Prompt Versions — change history
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_pipeline.prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_asset_id UUID NOT NULL REFERENCES core_pipeline.prompt_assets(id),
    version VARCHAR(16) NOT NULL,
    system_prompt TEXT NOT NULL,
    change_reason TEXT,
    changed_by VARCHAR(128),
    performance_before JSONB,
    performance_after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════
-- 7. RAG Chain Cases — index (payload in Qdrant)
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_pipeline.rag_chain_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id VARCHAR(128) NOT NULL UNIQUE,
    quality_score REAL NOT NULL,
    case_type VARCHAR(16) NOT NULL,
    source_project_id UUID,
    source_episode_id UUID,
    source_shot_id VARCHAR(128),
    genre VARCHAR(64),
    scene_type VARCHAR(64),
    difficulty VARCHAR(4),
    retrieval_count INT NOT NULL DEFAULT 0,
    qdrant_point_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rag_cases_genre
    ON core_pipeline.rag_chain_cases(genre, scene_type, difficulty);

-- ═══════════════════════════════════════════════
-- 8. Project Groups — multi-project constraints
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.project_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL,
    platform VARCHAR(64),
    platform_constraints JSONB NOT NULL DEFAULT '{}',
    style_preferences JSONB NOT NULL DEFAULT '{}',
    compliance_rules JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════
-- 9. Evolution Runs — self-evolution audit
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_pipeline.evolution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_type VARCHAR(32) NOT NULL,
    agent_name VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'running',
    input_params JSONB,
    output_summary JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════
-- 10. Cost Events — real-time cost tracking
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core_pipeline.cost_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID,
    episode_version_id UUID,
    node_id VARCHAR(8),
    agent_name VARCHAR(64),
    cost_type VARCHAR(32) NOT NULL,
    amount_cny REAL NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cost_events_run
    ON core_pipeline.cost_events(run_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_episode
    ON core_pipeline.cost_events(episode_version_id);

-- ═══════════════════════════════════════════════
-- 11. Existing table modifications
-- ═══════════════════════════════════════════════

-- projects: link to project group + requirements
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.project_groups(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS requirements_json JSONB DEFAULT '{}';

-- review_tasks: dispatcher task decomposition result
ALTER TABLE public.review_tasks ADD COLUMN IF NOT EXISTS dispatcher_tasks JSONB DEFAULT NULL;

COMMIT;
