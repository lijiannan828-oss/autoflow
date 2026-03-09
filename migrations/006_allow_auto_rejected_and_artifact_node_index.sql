-- 迁移脚本：放开 node_runs.auto_rejected 状态并补 artifact node_run 索引
-- 执行库：autoflow
-- 执行方式：psql -d autoflow -f migrations/006_allow_auto_rejected_and_artifact_node_index.sql

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'node_runs_status_check'
          AND conrelid = 'core_pipeline.node_runs'::regclass
    ) THEN
        ALTER TABLE core_pipeline.node_runs
            DROP CONSTRAINT node_runs_status_check;
    END IF;
END
$$;

ALTER TABLE core_pipeline.node_runs
    ADD CONSTRAINT node_runs_status_check
    CHECK (status IN ('pending', 'running', 'retrying', 'succeeded', 'failed', 'canceled', 'skipped', 'partial', 'auto_rejected'));

CREATE INDEX IF NOT EXISTS idx_cp_artifacts_node_run
    ON core_pipeline.artifacts(node_run_id);
