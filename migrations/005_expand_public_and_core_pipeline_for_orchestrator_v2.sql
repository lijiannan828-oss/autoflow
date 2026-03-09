-- 迁移脚本：补齐 public 审核兼容层 + core_pipeline v2 编排字段
-- 执行库：autoflow
-- 执行方式：psql -d autoflow -f migrations/005_expand_public_and_core_pipeline_for_orchestrator_v2.sql
--
-- 设计原则：
-- 1) 仅新增表、字段、索引、约束，不删除、不重命名、不破坏现有旧审核语义
-- 2) public 保留旧审核兼容层；新版多步审核主模型由 public.review_tasks 承接
-- 3) core_pipeline 作为新版编排内部真相源继续扩展
-- 4) 对现网已存在的历史 ID 类型不一致（如 episodes/shots）保持兼容，本轮不强行补有风险的外键

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. 枚举补齐（仅新增，不影响现有 user_role / severity / anchor_type）
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'reviewer_role'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.reviewer_role AS ENUM (
            'qc_inspector',
            'middle_platform',
            'partner'
        );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'review_granularity'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.review_granularity AS ENUM (
            'asset',
            'shot',
            'episode'
        );
    END IF;
END
$$;

-- =========================================================
-- 2. public 基础版本与审阅表补齐（兼容旧模型）
-- =========================================================

ALTER TABLE public.episode_versions
    ADD COLUMN IF NOT EXISTS run_id UUID NULL,
    ADD COLUMN IF NOT EXISTS total_duration_s INT NULL,
    ADD COLUMN IF NOT EXISTS total_cost_cny NUMERIC(12,2) NULL,
    ADD COLUMN IF NOT EXISTS human_minutes INT NULL,
    ADD COLUMN IF NOT EXISTS ai_minutes INT NULL,
    ADD COLUMN IF NOT EXISTS return_count_total INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS return_count_by_stage JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS auto_reject_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS first_pass_rate NUMERIC(5,2) NULL,
    ADD COLUMN IF NOT EXISTS stage_wait_time JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.revision_logs
    ADD COLUMN IF NOT EXISTS return_ticket_id UUID NULL,
    ADD COLUMN IF NOT EXISTS node_scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL;

ALTER TABLE public.review_points
    ADD COLUMN IF NOT EXISTS review_task_id UUID NULL,
    ADD COLUMN IF NOT EXISTS timestamp_ms BIGINT NULL,
    ADD COLUMN IF NOT EXISTS issue_type TEXT NULL,
    ADD COLUMN IF NOT EXISTS comment TEXT NULL,
    ADD COLUMN IF NOT EXISTS screenshot_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL;

ALTER TABLE public.review_decision_records
    ADD COLUMN IF NOT EXISTS review_task_id UUID NULL,
    ADD COLUMN IF NOT EXISTS gate_node_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS review_step_no SMALLINT NULL,
    ADD COLUMN IF NOT EXISTS review_granularity public.review_granularity NULL,
    ADD COLUMN IF NOT EXISTS anchor_type public.anchor_type NULL,
    ADD COLUMN IF NOT EXISTS anchor_id UUID NULL,
    ADD COLUMN IF NOT EXISTS decision_comment TEXT NULL,
    ADD COLUMN IF NOT EXISTS is_skipped BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS openclaw_session_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL;

ALTER TABLE public.feedback_records
    ADD COLUMN IF NOT EXISTS review_task_id UUID NULL,
    ADD COLUMN IF NOT EXISTS return_ticket_id UUID NULL,
    ADD COLUMN IF NOT EXISTS issue_type TEXT NULL,
    ADD COLUMN IF NOT EXISTS comment TEXT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL;

-- stage_tasks 仅做兼容映射字段扩展，不承接新版主审核模型
ALTER TABLE public.stage_tasks
    ADD COLUMN IF NOT EXISTS source_review_task_id UUID NULL,
    ADD COLUMN IF NOT EXISTS reviewer_role TEXT NULL,
    ADD COLUMN IF NOT EXISTS review_step_no SMALLINT NULL,
    ADD COLUMN IF NOT EXISTS anchor_type public.anchor_type NULL,
    ADD COLUMN IF NOT EXISTS anchor_id UUID NULL,
    ADD COLUMN IF NOT EXISTS openclaw_session_id TEXT NULL;

-- =========================================================
-- 3. public.review_tasks（新版审核任务主表）
-- =========================================================

CREATE TABLE IF NOT EXISTS public.review_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL,
    episode_version_id UUID NOT NULL REFERENCES public.episode_versions(id) ON DELETE CASCADE,
    stage_no SMALLINT NOT NULL CHECK (stage_no BETWEEN 1 AND 4),
    gate_node_id TEXT NOT NULL,
    review_step_no SMALLINT NOT NULL DEFAULT 1,
    reviewer_role public.reviewer_role NOT NULL,
    review_granularity public.review_granularity NOT NULL,
    anchor_type public.anchor_type NULL,
    anchor_id UUID NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'approved', 'returned', 'skipped')),
    assignee_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    due_at TIMESTAMPTZ NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    openclaw_session_id TEXT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    decision TEXT NULL CHECK (decision IN ('approve', 'return')),
    decision_comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_tasks_assignee_status
    ON public.review_tasks(assignee_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_review_tasks_version_stage
    ON public.review_tasks(episode_version_id, stage_no, review_step_no);

CREATE INDEX IF NOT EXISTS idx_review_tasks_role
    ON public.review_tasks(reviewer_role, status);

CREATE INDEX IF NOT EXISTS idx_review_tasks_anchor
    ON public.review_tasks(anchor_type, anchor_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_tasks_gate_scope
    ON public.review_tasks(episode_version_id, gate_node_id, review_step_no, COALESCE(anchor_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- review_points / review_decision_records 与 review_tasks 建立弱耦合关联
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_review_points_review_task'
    ) THEN
        ALTER TABLE public.review_points
            ADD CONSTRAINT fk_review_points_review_task
            FOREIGN KEY (review_task_id) REFERENCES public.review_tasks(id) ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_review_decision_records_review_task'
    ) THEN
        ALTER TABLE public.review_decision_records
            ADD CONSTRAINT fk_review_decision_records_review_task
            FOREIGN KEY (review_task_id) REFERENCES public.review_tasks(id) ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_feedback_records_review_task'
    ) THEN
        ALTER TABLE public.feedback_records
            ADD CONSTRAINT fk_feedback_records_review_task
            FOREIGN KEY (review_task_id) REFERENCES public.review_tasks(id) ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_stage_tasks_source_review_task'
    ) THEN
        ALTER TABLE public.stage_tasks
            ADD CONSTRAINT fk_stage_tasks_source_review_task
            FOREIGN KEY (source_review_task_id) REFERENCES public.review_tasks(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- =========================================================
-- 4. core_pipeline 表扩展（补齐 v2 编排字段）
-- =========================================================

ALTER TABLE core_pipeline.node_registry
    ADD COLUMN IF NOT EXISTS agent_role TEXT NULL,
    ADD COLUMN IF NOT EXISTS review_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS comfyui_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS comfyui_workflow_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS rag_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS quality_threshold JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS estimated_duration_s INT NULL,
    ADD COLUMN IF NOT EXISTS reject_target_node_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS max_auto_rejects INT NOT NULL DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_cp_node_registry_agent
    ON core_pipeline.node_registry(agent_role);

ALTER TABLE core_pipeline.runs
    ADD COLUMN IF NOT EXISTS is_rerun BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS rerun_from_ticket_id UUID NULL,
    ADD COLUMN IF NOT EXISTS langgraph_thread_id TEXT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_cp_runs_rerun_from_ticket'
    ) THEN
        ALTER TABLE core_pipeline.runs
            ADD CONSTRAINT fk_cp_runs_rerun_from_ticket
            FOREIGN KEY (rerun_from_ticket_id) REFERENCES core_pipeline.return_tickets(id) ON DELETE SET NULL;
    END IF;
END
$$;

ALTER TABLE core_pipeline.node_runs
    ADD COLUMN IF NOT EXISTS agent_role TEXT NULL,
    ADD COLUMN IF NOT EXISTS auto_reject_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS scope_hash TEXT NULL,
    ADD COLUMN IF NOT EXISTS model_endpoint TEXT NULL,
    ADD COLUMN IF NOT EXISTS comfyui_workflow_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS rag_query_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) NULL;

CREATE INDEX IF NOT EXISTS idx_cp_node_runs_agent
    ON core_pipeline.node_runs(agent_role, created_at DESC);

ALTER TABLE core_pipeline.artifacts
    ADD COLUMN IF NOT EXISTS score NUMERIC(5,2) NULL,
    ADD COLUMN IF NOT EXISTS score_detail JSONB NULL;

ALTER TABLE core_pipeline.return_tickets
    ADD COLUMN IF NOT EXISTS review_task_id UUID NULL,
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'human_review',
    ADD COLUMN IF NOT EXISTS source_node_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS resolved_version_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_cp_return_tickets_review_task'
    ) THEN
        ALTER TABLE core_pipeline.return_tickets
            ADD CONSTRAINT fk_cp_return_tickets_review_task
            FOREIGN KEY (review_task_id) REFERENCES public.review_tasks(id) ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_cp_return_tickets_resolved_version'
    ) THEN
        ALTER TABLE core_pipeline.return_tickets
            ADD CONSTRAINT fk_cp_return_tickets_resolved_version
            FOREIGN KEY (resolved_version_id) REFERENCES public.episode_versions(id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_cp_return_tickets_review_task
    ON core_pipeline.return_tickets(review_task_id);

CREATE INDEX IF NOT EXISTS idx_cp_return_tickets_source_type
    ON core_pipeline.return_tickets(source_type, created_at DESC);

-- =========================================================
-- 5. 新版辅助表
-- =========================================================

CREATE TABLE IF NOT EXISTS public.rag_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_name TEXT NOT NULL UNIQUE,
    description TEXT NULL,
    source_type TEXT NOT NULL,
    document_count INT NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.character_appearance_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL,
    episode_version_id UUID NOT NULL REFERENCES public.episode_versions(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    shot_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (episode_version_id, asset_id, shot_id)
);

CREATE INDEX IF NOT EXISTS idx_character_appearance_episode_version
    ON public.character_appearance_index(episode_version_id, asset_type);

-- =========================================================
-- 6. 兼容层索引补齐
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_review_points_review_task
    ON public.review_points(review_task_id);

CREATE INDEX IF NOT EXISTS idx_review_points_issue_type
    ON public.review_points(issue_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_decision_records_review_task
    ON public.review_decision_records(review_task_id);

CREATE INDEX IF NOT EXISTS idx_feedback_records_return_ticket
    ON public.feedback_records(return_ticket_id);

CREATE INDEX IF NOT EXISTS idx_episode_versions_run_id
    ON public.episode_versions(run_id);

COMMIT;
