-- 迁移脚本：为 anchor_type 枚举新增 'episode_version' 值
-- 背景：node-spec-sheet 中 N01/N02/N20/N23 等节点大量使用
--       anchor_type='episode_version' 来锚定集级产物（timeline_json、
--       subtitle_json、bgm、storyboard 等），当前 DB 枚举缺失该值
-- 执行库：autoflow
-- 执行方式：psql -d autoflow -f migrations/008_add_anchor_type_episode_version.sql

BEGIN;

ALTER TYPE public.anchor_type ADD VALUE IF NOT EXISTS 'episode_version';

-- 同步更新 schema/enums.sql 注释保持一致
-- anchor_type: asset | shot | timestamp | episode_version

COMMIT;
