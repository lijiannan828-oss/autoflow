-- Canonical enum definitions for Autoflow
-- Source of truth should stay aligned with sql/init_autoflow_schema.sql

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
        CREATE TYPE anchor_type AS ENUM ('asset', 'shot', 'timestamp', 'episode_version');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_decision') THEN
        CREATE TYPE review_decision AS ENUM ('pass', 'reject');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_group') THEN
        CREATE TYPE priority_group AS ENUM ('urgent_rejected', 'in_qc', 'new_pending', 'generating');
    END IF;
END
$$;
