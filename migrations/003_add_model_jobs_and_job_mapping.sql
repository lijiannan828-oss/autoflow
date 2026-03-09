-- 迁移脚本：统一模型任务标识（job_id）落库
-- 执行库：autoflow
-- 执行方式：psql -d autoflow -f migrations/003_add_model_jobs_and_job_mapping.sql

ALTER TABLE variants
    ADD COLUMN IF NOT EXISTS model_job_id TEXT NULL;

ALTER TABLE revision_logs
    ADD COLUMN IF NOT EXISTS model_job_id TEXT NULL;

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

CREATE INDEX IF NOT EXISTS idx_variants_model_job
    ON variants(model_job_id);

CREATE INDEX IF NOT EXISTS idx_revision_logs_model_job
    ON revision_logs(model_job_id);

CREATE INDEX IF NOT EXISTS idx_model_jobs_episode_stage
    ON model_jobs(episode_id, stage_no, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_jobs_status
    ON model_jobs(status, created_at DESC);
