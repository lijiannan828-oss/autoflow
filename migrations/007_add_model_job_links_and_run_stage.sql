-- 迁移脚本：补 model_jobs 与管线关联字段，并为 runs 增加 current_stage_no
-- 执行库：autoflow
-- 执行方式：psql -d autoflow -f migrations/007_add_model_job_links_and_run_stage.sql

BEGIN;

ALTER TABLE public.model_jobs
    ADD COLUMN IF NOT EXISTS node_run_id UUID NULL,
    ADD COLUMN IF NOT EXISTS node_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS episode_version_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_model_jobs_node_run'
    ) THEN
        ALTER TABLE public.model_jobs
            ADD CONSTRAINT fk_model_jobs_node_run
            FOREIGN KEY (node_run_id) REFERENCES core_pipeline.node_runs(id) ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_model_jobs_episode_version'
    ) THEN
        ALTER TABLE public.model_jobs
            ADD CONSTRAINT fk_model_jobs_episode_version
            FOREIGN KEY (episode_version_id) REFERENCES public.episode_versions(id) ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_model_jobs_node_run
    ON public.model_jobs(node_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_jobs_episode_version
    ON public.model_jobs(episode_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_jobs_node_id
    ON public.model_jobs(node_id, created_at DESC);

ALTER TABLE core_pipeline.runs
    ADD COLUMN IF NOT EXISTS current_stage_no SMALLINT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_cp_runs_current_stage_no'
    ) THEN
        ALTER TABLE core_pipeline.runs
            ADD CONSTRAINT chk_cp_runs_current_stage_no
            CHECK (current_stage_no IS NULL OR current_stage_no BETWEEN 1 AND 4);
    END IF;
END
$$;

UPDATE core_pipeline.runs
SET current_stage_no = CASE
    WHEN current_node_id IS NULL THEN current_stage_no
    WHEN NULLIF(regexp_replace(current_node_id, '\D', '', 'g'), '')::int BETWEEN 1 AND 8 THEN 1
    WHEN NULLIF(regexp_replace(current_node_id, '\D', '', 'g'), '')::int BETWEEN 9 AND 18 THEN 2
    WHEN NULLIF(regexp_replace(current_node_id, '\D', '', 'g'), '')::int BETWEEN 19 AND 21 THEN 3
    WHEN NULLIF(regexp_replace(current_node_id, '\D', '', 'g'), '')::int BETWEEN 22 AND 26 THEN 4
    ELSE current_stage_no
END
WHERE current_node_id IS NOT NULL
  AND current_stage_no IS NULL;

COMMIT;
