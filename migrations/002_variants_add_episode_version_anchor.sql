-- 迁移脚本：variants 增加 episode_version 级锚点（方案A）
-- 执行库：autoflow
-- 执行方式：psql -d autoflow -f migrations/002_variants_add_episode_version_anchor.sql

ALTER TABLE variants
    ADD COLUMN IF NOT EXISTS episode_version_id UUID NULL;

ALTER TABLE variants
    DROP CONSTRAINT IF EXISTS fk_variants_episode_version,
    ADD CONSTRAINT fk_variants_episode_version
    FOREIGN KEY (episode_version_id) REFERENCES episode_versions(id) ON DELETE SET NULL;

DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'variants'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%asset_id IS NOT NULL OR shot_id IS NOT NULL%'
    LOOP
        EXECUTE format('ALTER TABLE variants DROP CONSTRAINT IF EXISTS %I', c.conname);
    END LOOP;
END
$$;

ALTER TABLE variants
    DROP CONSTRAINT IF EXISTS variants_check;

ALTER TABLE variants
    ADD CONSTRAINT ck_variants_anchor_scope
    CHECK (
        asset_id IS NOT NULL
        OR shot_id IS NOT NULL
        OR episode_version_id IS NOT NULL
    );

CREATE INDEX IF NOT EXISTS idx_variants_episode_version_type
    ON variants(episode_version_id, variant_type);
