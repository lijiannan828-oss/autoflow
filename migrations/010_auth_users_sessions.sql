-- AutoFlow v2.2 — Migration 010: Auth Users & Sessions
-- 用户鉴权表，支持飞书SSO + 独立账号（合作方）
-- 依赖: 009_v2.2_agent_infrastructure.sql

BEGIN;

-- 角色枚举
DO $$ BEGIN
    CREATE TYPE core_pipeline.user_role_enum AS ENUM (
        'admin',            -- 管理员（制片人/CTO）
        'qc_inspector',     -- 质检专员
        'middle_platform',  -- 剪辑中台
        'partner',          -- 合作方
        'developer'         -- 开发者
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 登录方式枚举
DO $$ BEGIN
    CREATE TYPE core_pipeline.login_provider_enum AS ENUM (
        'feishu',           -- 飞书SSO
        'password'          -- 独立账号
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── users 表 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core_pipeline.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role core_pipeline.user_role_enum NOT NULL DEFAULT 'developer',
    login_provider core_pipeline.login_provider_enum NOT NULL DEFAULT 'feishu',
    -- 飞书SSO 字段
    feishu_user_id TEXT,                    -- 飞书 open_id
    feishu_union_id TEXT,                   -- 飞书 union_id（跨应用）
    -- 独立账号字段
    username TEXT,                          -- 合作方登录用户名
    password_hash TEXT,                     -- bcrypt hash
    -- 通用字段
    avatar_url TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_feishu_user_id
    ON core_pipeline.users (feishu_user_id) WHERE feishu_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
    ON core_pipeline.users (username) WHERE username IS NOT NULL;

-- ── sessions 表 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS core_pipeline.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES core_pipeline.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,               -- SHA256(JWT) 用于验证/撤销
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON core_pipeline.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON core_pipeline.sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON core_pipeline.sessions (expires_at);

-- ── notification_config 表（Phase 3 预留）─────────────
CREATE TABLE IF NOT EXISTS core_pipeline.notification_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_type TEXT NOT NULL DEFAULT 'feishu_webhook',
    webhook_url TEXT,
    events JSONB NOT NULL DEFAULT '{"gate_pending": true, "budget_alert": true, "pipeline_failed": true, "daily_report": false}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES core_pipeline.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 初始化种子数据 ────────────────────────────────────
-- 默认管理员账号（飞书SSO绑定后更新 feishu_user_id）
INSERT INTO core_pipeline.users (name, role, login_provider, username)
VALUES
    ('管理员', 'admin', 'feishu', NULL),
    ('测试质检员', 'qc_inspector', 'feishu', NULL),
    ('测试中台', 'middle_platform', 'feishu', NULL),
    ('测试开发者', 'developer', 'feishu', NULL),
    ('合作方测试', 'partner', 'password', 'partner_test')
ON CONFLICT DO NOTHING;

COMMIT;
