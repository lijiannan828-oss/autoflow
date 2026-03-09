-- Autoflow Schema 初始化脚本（PostgreSQL）
-- 来源：.spec-workflow/specs/aigc-review-workflow-mvp/data-structures.md

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 枚举
-- =========================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('qc', 'platform_editor', 'partner_reviewer', 'admin');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage_task_status') THEN
        CREATE TYPE stage_task_status AS ENUM ('pending', 'in_progress', 'passed', 'rejected', 'generating', 'blocked');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'episode_status') THEN
        CREATE TYPE episode_status AS ENUM ('new', 'reviewing', 'generating', 'final_passed', 'archived');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_type') THEN
        CREATE TYPE asset_type AS ENUM ('tone', 'character', 'scene', 'prop');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'variant_type') THEN
        CREATE TYPE variant_type AS ENUM ('asset_image', 'keyframe_image', 'shot_video', 'voice_sample', 'audio_mix', 'final_cut');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity') THEN
        CREATE TYPE severity AS ENUM ('blocker', 'major', 'minor');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_scope') THEN
        CREATE TYPE feedback_scope AS ENUM (
            'character', 'scene', 'prop', 'tone', 'keyframe', 'video',
            'voice', 'sfx', 'music', 'subtitle', 'composite'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anchor_type') THEN
        CREATE TYPE anchor_type AS ENUM ('asset', 'shot', 'timestamp');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_decision') THEN
        CREATE TYPE review_decision AS ENUM ('pass', 'reject');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_group') THEN
        CREATE TYPE priority_group AS ENUM ('urgent_rejected', 'in_qc', 'new_pending', 'generating');
    END IF;
END
$$;

-- =========================
-- 核心表
-- =========================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role user_role NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    genre TEXT,
    planned_episode_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    episode_no INT NOT NULL,
    title TEXT,
    estimated_duration_sec INT NOT NULL DEFAULT 0,
    status episode_status NOT NULL DEFAULT 'new',
    current_stage SMALLINT NOT NULL DEFAULT 1 CHECK (current_stage BETWEEN 1 AND 4),
    current_version_id UUID NULL,
    due_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(series_id, episode_no)
);

CREATE TABLE IF NOT EXISTS partner_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    episode_id UUID NULL REFERENCES episodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stage_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    stage_no SMALLINT NOT NULL CHECK (stage_no BETWEEN 1 AND 4),
    status stage_task_status NOT NULL DEFAULT 'pending',
    priority_group priority_group NOT NULL DEFAULT 'new_pending',
    priority_score NUMERIC(8,2) NOT NULL DEFAULT 0,
    deadline_at TIMESTAMPTZ NULL,
    source_reason TEXT NULL,
    assigned_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    locked_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ NULL,
    lock_expire_at TIMESTAMPTZ NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    reject_count INT NOT NULL DEFAULT 0,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    episode_id UUID NULL REFERENCES episodes(id) ON DELETE CASCADE,
    asset_type asset_type NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    is_required BOOLEAN NOT NULL DEFAULT true,
    selected_variant_id UUID NULL,
    round_no INT NOT NULL DEFAULT 1,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    shot_no INT NOT NULL,
    name TEXT NULL,
    script_excerpt TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    risk_level TEXT NOT NULL DEFAULT 'normal',
    default_keyframe_variant_id UUID NULL,
    default_video_variant_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(episode_id, shot_no)
);

CREATE TABLE IF NOT EXISTS variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    asset_id UUID NULL REFERENCES assets(id) ON DELETE SET NULL,
    shot_id UUID NULL REFERENCES shots(id) ON DELETE SET NULL,
    episode_version_id UUID NULL,
    model_job_id TEXT NULL,
    variant_type variant_type NOT NULL,
    round_no INT NOT NULL DEFAULT 1,
    candidate_no INT NOT NULL DEFAULT 1,
    score NUMERIC(4,2) NULL CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
    model_provider TEXT NULL,
    model_name TEXT NULL,
    prompt_text TEXT NULL,
    negative_prompt_text TEXT NULL,
    duration_sec INT NULL,
    resource_url TEXT NOT NULL,
    preview_url TEXT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_source TEXT NOT NULL DEFAULT 'agent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (asset_id IS NOT NULL OR shot_id IS NOT NULL OR episode_version_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS character_voice_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    character_name TEXT NOT NULL,
    voice_variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE RESTRICT,
    is_baseline BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(series_id, character_name)
);

CREATE TABLE IF NOT EXISTS episode_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    version_no INT NOT NULL,
    source_stage SMALLINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    summary_text TEXT NULL,
    created_by_source TEXT NOT NULL DEFAULT 'agent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(episode_id, version_no)
);

ALTER TABLE episodes
    DROP CONSTRAINT IF EXISTS fk_episodes_current_version,
    ADD CONSTRAINT fk_episodes_current_version
    FOREIGN KEY (current_version_id) REFERENCES episode_versions(id) ON DELETE SET NULL;

ALTER TABLE assets
    DROP CONSTRAINT IF EXISTS fk_assets_selected_variant,
    ADD CONSTRAINT fk_assets_selected_variant
    FOREIGN KEY (selected_variant_id) REFERENCES variants(id) ON DELETE SET NULL;

ALTER TABLE shots
    DROP CONSTRAINT IF EXISTS fk_shots_default_keyframe_variant,
    ADD CONSTRAINT fk_shots_default_keyframe_variant
    FOREIGN KEY (default_keyframe_variant_id) REFERENCES variants(id) ON DELETE SET NULL;

ALTER TABLE shots
    DROP CONSTRAINT IF EXISTS fk_shots_default_video_variant,
    ADD CONSTRAINT fk_shots_default_video_variant
    FOREIGN KEY (default_video_variant_id) REFERENCES variants(id) ON DELETE SET NULL;

ALTER TABLE variants
    DROP CONSTRAINT IF EXISTS fk_variants_episode_version,
    ADD CONSTRAINT fk_variants_episode_version
    FOREIGN KEY (episode_version_id) REFERENCES episode_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    episode_version_id UUID NOT NULL REFERENCES episode_versions(id) ON DELETE CASCADE,
    stage_no SMALLINT NOT NULL CHECK (stage_no IN (2,3)),
    duration_sec INT NOT NULL,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(episode_version_id, stage_no)
);

CREATE TABLE IF NOT EXISTS timeline_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeline_id UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    track_type TEXT NOT NULL,
    track_order INT NOT NULL,
    name TEXT NOT NULL,
    mute BOOLEAN NOT NULL DEFAULT false,
    solo BOOLEAN NOT NULL DEFAULT false,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(timeline_id, track_type, track_order)
);

CREATE TABLE IF NOT EXISTS timeline_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES timeline_tracks(id) ON DELETE CASCADE,
    source_variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE RESTRICT,
    start_sec NUMERIC(10,3) NOT NULL,
    end_sec NUMERIC(10,3) NOT NULL,
    offset_sec NUMERIC(10,3) NOT NULL DEFAULT 0,
    volume NUMERIC(4,2) NOT NULL DEFAULT 1.0 CHECK (volume >= 0 AND volume <= 2),
    fade_in_sec NUMERIC(6,3) NOT NULL DEFAULT 0,
    fade_out_sec NUMERIC(6,3) NOT NULL DEFAULT 0,
    z_index INT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_sec > start_sec)
);

CREATE TABLE IF NOT EXISTS review_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    episode_version_id UUID NOT NULL REFERENCES episode_versions(id) ON DELETE CASCADE,
    stage_no SMALLINT NOT NULL CHECK (stage_no BETWEEN 1 AND 4),
    timecode_sec NUMERIC(10,3) NULL,
    scope feedback_scope NOT NULL,
    severity severity NOT NULL DEFAULT 'major',
    attribution_stage TEXT NOT NULL CHECK (attribution_stage IN ('1','2','3','4','other')),
    anchor_type anchor_type NOT NULL,
    anchor_id UUID NULL,
    note TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((anchor_type = 'timestamp' AND timecode_sec IS NOT NULL) OR anchor_type IN ('asset','shot'))
);

CREATE TABLE IF NOT EXISTS review_decision_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    episode_version_id UUID NOT NULL REFERENCES episode_versions(id) ON DELETE CASCADE,
    stage_no SMALLINT NOT NULL,
    reviewer_role user_role NOT NULL,
    decision review_decision NOT NULL,
    note TEXT NULL,
    point_count INT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_decision_points (
    decision_id UUID NOT NULL REFERENCES review_decision_records(id) ON DELETE CASCADE,
    point_id UUID NOT NULL REFERENCES review_points(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(decision_id, point_id)
);

CREATE TABLE IF NOT EXISTS revision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    episode_version_id UUID NOT NULL REFERENCES episode_versions(id) ON DELETE CASCADE,
    trigger_decision_id UUID NULL REFERENCES review_decision_records(id) ON DELETE SET NULL,
    model_job_id TEXT NULL,
    source_stage SMALLINT NOT NULL,
    change_type TEXT NOT NULL,
    summary_text TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    stage_no SMALLINT NOT NULL,
    scope feedback_scope NOT NULL,
    severity severity NOT NULL,
    anchor_type anchor_type NOT NULL,
    anchor_id UUID NULL,
    note TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    parsed_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id TEXT NOT NULL,
    actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_role user_role NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    before_json JSONB NULL,
    after_json JSONB NULL,
    ip TEXT NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_metrics (
    id BIGSERIAL PRIMARY KEY,
    event_name TEXT NOT NULL,
    series_id UUID NULL REFERENCES series(id) ON DELETE SET NULL,
    episode_id UUID NULL REFERENCES episodes(id) ON DELETE SET NULL,
    stage_no SMALLINT NULL,
    task_id UUID NULL REFERENCES stage_tasks(id) ON DELETE SET NULL,
    actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL UNIQUE,
    request_id TEXT NULL,
    job_type TEXT NOT NULL,
    episode_id UUID NULL REFERENCES episodes(id) ON DELETE SET NULL,
    stage_no SMALLINT NULL CHECK (stage_no BETWEEN 1 AND 4),
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    provider TEXT NULL,
    callback_url TEXT NULL,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_payload JSONB NULL,
    error_payload JSONB NULL,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE variants
    DROP CONSTRAINT IF EXISTS fk_variants_model_job,
    ADD CONSTRAINT fk_variants_model_job
    FOREIGN KEY (model_job_id) REFERENCES model_jobs(job_id) ON DELETE SET NULL;

ALTER TABLE revision_logs
    DROP CONSTRAINT IF EXISTS fk_revision_logs_model_job,
    ADD CONSTRAINT fk_revision_logs_model_job
    FOREIGN KEY (model_job_id) REFERENCES model_jobs(job_id) ON DELETE SET NULL;

-- =========================
-- 索引
-- =========================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_series_project ON series(project_id);
CREATE INDEX IF NOT EXISTS idx_episodes_series ON episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(status, due_at);

CREATE INDEX IF NOT EXISTS idx_tasks_panel ON stage_tasks(priority_group, deadline_at, priority_score DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_lock ON stage_tasks(status, lock_expire_at);
CREATE INDEX IF NOT EXISTS idx_tasks_episode_stage ON stage_tasks(episode_id, stage_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_tasks_active_per_stage
    ON stage_tasks(episode_id, stage_no)
    WHERE status IN ('pending', 'in_progress', 'generating', 'blocked');

CREATE INDEX IF NOT EXISTS idx_assets_series_type ON assets(series_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_shots_episode ON shots(episode_id, shot_no);
CREATE INDEX IF NOT EXISTS idx_variants_asset ON variants(asset_id, round_no, score DESC);
CREATE INDEX IF NOT EXISTS idx_variants_shot ON variants(shot_id, round_no, score DESC);
CREATE INDEX IF NOT EXISTS idx_variants_episode_type ON variants(episode_id, variant_type);
CREATE INDEX IF NOT EXISTS idx_variants_episode_version_type ON variants(episode_version_id, variant_type);
CREATE INDEX IF NOT EXISTS idx_variants_model_job ON variants(model_job_id);
CREATE INDEX IF NOT EXISTS idx_episode_versions_episode ON episode_versions(episode_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_clips_track_time ON timeline_clips(track_id, start_sec, end_sec);

CREATE INDEX IF NOT EXISTS idx_review_points_episode_version ON review_points(episode_id, episode_version_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_points_attr ON review_points(attribution_stage, severity);
CREATE INDEX IF NOT EXISTS idx_review_decision_episode ON review_decision_records(episode_id, stage_no, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revision_logs_episode ON revision_logs(episode_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revision_logs_model_job ON revision_logs(model_job_id);
CREATE INDEX IF NOT EXISTS idx_feedback_stage ON feedback_records(episode_id, stage_no, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_metrics_event_time ON event_metrics(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_metrics_episode ON event_metrics(episode_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_jobs_episode_stage ON model_jobs(episode_id, stage_no, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_jobs_status ON model_jobs(status, created_at DESC);
