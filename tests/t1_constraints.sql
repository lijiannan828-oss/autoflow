-- T1 constraint/lock smoke tests
-- Run:
-- psql -d autoflow -f tests/t1_constraints.sql
-- This script leaves no data after execution.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- prepare minimal data
INSERT INTO users (id, email, display_name, role)
VALUES
  (gen_random_uuid(), 'qa1@example.com', 'QA 1', 'qc'),
  (gen_random_uuid(), 'editor1@example.com', 'Editor 1', 'platform_editor')
ON CONFLICT (email) DO NOTHING;

INSERT INTO projects (id, name)
VALUES (gen_random_uuid(), 'autoflow-project')
ON CONFLICT DO NOTHING;

WITH p AS (
  SELECT id FROM projects WHERE name = 'autoflow-project' LIMIT 1
)
INSERT INTO series (id, project_id, name, planned_episode_count)
SELECT gen_random_uuid(), p.id, 'autoflow-series', 30 FROM p
ON CONFLICT DO NOTHING;

WITH s AS (
  SELECT id FROM series WHERE name = 'autoflow-series' LIMIT 1
)
INSERT INTO episodes (id, series_id, episode_no, title)
SELECT gen_random_uuid(), s.id, 1, 'EP1' FROM s
ON CONFLICT (series_id, episode_no) DO NOTHING;

-- check unique(episode_id, stage_no) for active stage_tasks via partial unique index
DO $$
DECLARE
  v_episode_id uuid;
BEGIN
  SELECT id INTO v_episode_id FROM episodes WHERE title = 'EP1' LIMIT 1;

  INSERT INTO stage_tasks (id, episode_id, stage_no, status, priority_group)
  VALUES (gen_random_uuid(), v_episode_id, 1, 'pending', 'new_pending');

  BEGIN
    INSERT INTO stage_tasks (id, episode_id, stage_no, status, priority_group)
    VALUES (gen_random_uuid(), v_episode_id, 1, 'in_progress', 'in_qc');
    RAISE EXCEPTION 'Expected unique violation for active stage task did not occur';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS: partial unique index on active stage_tasks works';
  END;
END $$;

-- check unique(episode_id, shot_no)
DO $$
DECLARE
  v_episode_id uuid;
BEGIN
  SELECT id INTO v_episode_id FROM episodes WHERE title = 'EP1' LIMIT 1;
  INSERT INTO shots (id, episode_id, shot_no, name) VALUES (gen_random_uuid(), v_episode_id, 1, 'S1');
  BEGIN
    INSERT INTO shots (id, episode_id, shot_no, name) VALUES (gen_random_uuid(), v_episode_id, 1, 'S1-dup');
    RAISE EXCEPTION 'Expected unique violation for shot_no did not occur';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS: unique(episode_id, shot_no) works';
  END;
END $$;

ROLLBACK;
