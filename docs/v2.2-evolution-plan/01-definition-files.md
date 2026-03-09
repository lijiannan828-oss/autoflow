# 01 — 定义性文件调整清单

> Spec、Schema、DB 迁移、质检要求等需要修改或新建的定义文件

---

## 1. 数据库迁移（新增 migrations/009_v2.2_agent_infrastructure.sql）

### 1.1 新表

```sql
-- Agent 记忆表
CREATE TABLE IF NOT EXISTS core_pipeline.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(64) NOT NULL,          -- "visual_director", "shot_designer" 等
    memory_type VARCHAR(32) NOT NULL,          -- "task_summary" | "lesson_learned" | "preference" | "statistics"
    scope VARCHAR(16) NOT NULL DEFAULT 'project', -- "global" | "project" | "episode"
    scope_id VARCHAR(128),                     -- project_id 或 episode_id
    content_key VARCHAR(256) NOT NULL,         -- "character_太后_best_practice"
    content_value JSONB NOT NULL DEFAULT '{}',
    confidence REAL NOT NULL DEFAULT 0.5,
    access_count INT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_memory_agent_scope ON core_pipeline.agent_memory(agent_name, scope, scope_id);
CREATE INDEX idx_agent_memory_key ON core_pipeline.agent_memory(content_key);

-- Agent 三层决策 trace 表
CREATE TABLE IF NOT EXISTS core_pipeline.agent_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(64) NOT NULL,
    node_id VARCHAR(8),
    run_id UUID,
    episode_version_id UUID,
    trace_type VARCHAR(32) NOT NULL,           -- 三层: "plan" | "execute" | "execute_fallback" | "review"
                                               -- 兼容: "recall" | "reason" | "act" | "reflect"
    input_summary JSONB,
    reasoning TEXT,
    output_summary JSONB,
    duration_ms INT,
    cost_cny REAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_traces_run ON core_pipeline.agent_traces(run_id, agent_name);

-- Prompt 资产表
CREATE TABLE IF NOT EXISTS core_pipeline.prompt_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(64) NOT NULL,
    prompt_stage VARCHAR(64) NOT NULL,          -- "script_parse" | "shot_design" | "visual_prompt" 等
    master_version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    master_system_prompt TEXT NOT NULL,
    master_output_schema_ref VARCHAR(256),
    locked_by VARCHAR(128),
    locked_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_prompt_assets_stage ON core_pipeline.prompt_assets(agent_name, prompt_stage) WHERE is_active;

-- 题材适配器表
CREATE TABLE IF NOT EXISTS core_pipeline.genre_adapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_asset_id UUID NOT NULL REFERENCES core_pipeline.prompt_assets(id),
    genre_tag VARCHAR(64) NOT NULL,             -- "古装宫斗" | "现代悬疑" | "甜宠"
    adapter_prompt TEXT NOT NULL,
    style_keywords JSONB DEFAULT '[]',
    few_shot_case_ids JSONB DEFAULT '[]',       -- RAG chain_id 列表
    created_by VARCHAR(16) NOT NULL DEFAULT 'human', -- "human" | "agent"
    total_uses INT NOT NULL DEFAULT 0,
    avg_qc_score REAL,
    human_approval_rate REAL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prompt 版本历史
CREATE TABLE IF NOT EXISTS core_pipeline.prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_asset_id UUID NOT NULL REFERENCES core_pipeline.prompt_assets(id),
    version VARCHAR(16) NOT NULL,
    system_prompt TEXT NOT NULL,
    change_reason TEXT,
    changed_by VARCHAR(128),                    -- "human:XXX" | "agent:prompt_evolver"
    performance_before JSONB,
    performance_after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RAG 链路案例索引（主体数据在 Qdrant，PG 仅存索引+元信息）
CREATE TABLE IF NOT EXISTS core_pipeline.rag_chain_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id VARCHAR(128) NOT NULL UNIQUE,
    quality_score REAL NOT NULL,
    case_type VARCHAR(16) NOT NULL,             -- "positive" | "negative" | "corrective"
    source_project_id UUID,
    source_episode_id UUID,
    source_shot_id VARCHAR(128),
    genre VARCHAR(64),
    scene_type VARCHAR(64),
    difficulty VARCHAR(4),                      -- "S0" | "S1" | "S2"
    retrieval_count INT NOT NULL DEFAULT 0,
    qdrant_point_id VARCHAR(128),               -- Qdrant 中的 point ID
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rag_cases_genre ON core_pipeline.rag_chain_cases(genre, scene_type, difficulty);

-- 项目集
CREATE TABLE IF NOT EXISTS public.project_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL,
    platform VARCHAR(64),                       -- "youtube_shorts" | "tiktok" | "reels"
    platform_constraints JSONB NOT NULL DEFAULT '{}',
    style_preferences JSONB NOT NULL DEFAULT '{}',
    compliance_rules JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 进化运行记录
CREATE TABLE IF NOT EXISTS core_pipeline.evolution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_type VARCHAR(32) NOT NULL,        -- "reflection" | "prompt_ab_test" | "lora_train" | "rag_cleanup"
    agent_name VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'running', -- "running" | "completed" | "failed"
    input_params JSONB,
    output_summary JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 实时成本事件
CREATE TABLE IF NOT EXISTS core_pipeline.cost_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID,
    episode_version_id UUID,
    node_id VARCHAR(8),
    agent_name VARCHAR(64),
    cost_type VARCHAR(32) NOT NULL,             -- "llm_api" | "gpu_compute" | "tts_api" | "storage"
    amount_cny REAL NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cost_events_run ON core_pipeline.cost_events(run_id);
CREATE INDEX idx_cost_events_episode ON core_pipeline.cost_events(episode_version_id);
```

### 1.2 现有表修改

```sql
-- projects 表增加 group_id
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.project_groups(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS requirements_json JSONB DEFAULT '{}';

-- review_tasks 表增加 dispatcher 字段
ALTER TABLE public.review_tasks ADD COLUMN IF NOT EXISTS dispatcher_tasks JSONB DEFAULT NULL;
-- dispatcher_tasks 示例: [{"task_type":"regenerate","target_agent":"visual_director","params":{...}}]
```

---

## 2. Schema 枚举更新（schema/enums.sql）

```sql
-- 新增 Agent 名称枚举
CREATE TYPE core_pipeline.agent_name AS ENUM (
    'script_analyst', 'shot_designer',
    'visual_director', 'audio_director', 'compositor',
    'quality_inspector', 'review_dispatcher',
    'supervisor', 'evolution_engine',
    'orchestrator'
);

-- 新增记忆类型枚举
CREATE TYPE core_pipeline.memory_type AS ENUM (
    'task_summary', 'lesson_learned', 'preference', 'statistics'
);

-- 新增记忆范围枚举
CREATE TYPE core_pipeline.memory_scope AS ENUM ('global', 'project', 'episode');

-- 新增进化类型枚举
CREATE TYPE core_pipeline.evolution_type AS ENUM (
    'reflection', 'prompt_ab_test', 'lora_train', 'rag_cleanup'
);
```

---

## 3. Spec 文件更新

### 3.1 `docs/raw_doc/node-spec-sheet.md` — 需同步更新

| 变更项 | 说明 |
|--------|------|
| 新增 N07b 节点规格 | 核心角色音色生成，Audio Director 负责，与 N07 并行 |
| 新增 N16b 节点规格 | 影调与节奏调整，Shot Designer + Compositor 协作 |
| N08 Gate 更新 | 增加音色候选审核（来自 N07b） |
| N20 模型更新 | BGM: ACE-Step 1.5（替代 Stable Audio）；SFX: HunyuanFoley（替代音效库匹配） |
| 所有节点增加 Agent 归属 | 每个节点标注负责 Agent |

### 3.2 `docs/raw_doc/schema-contracts.md` — 需同步更新

| 变更项 | 说明 |
|--------|------|
| ProjectGroup 结构 | 三层需求体系：ProjectGroup → Project → Episode |
| AgentMemory 结构 | agent_memory 表定义 |
| PromptAsset 结构 | Prompt 资产库三层架构 |
| RAGChainCase 结构 | 链路级 RAG 案例 |
| AgentTrace 结构 | Agent 三层决策 trace（plan/execute/review） |
| CostEvent 结构 | 实时成本事件 |

### 3.3 质检要求更新

| 变更项 | 说明 |
|--------|------|
| QC 阈值与 Supervisor 联动 | 超预算 150% 触发 Supervisor 成本检查介入 |
| Supervisor 校验点 | N02/N05/N09/N14/N17/N23 后自动校验成本+合规+项目集约束 |
| 进化指标 | 质检自动通过率、人审一次通过率、快速确认率月度目标 |

---

## 4. TypeScript 类型定义更新

### 4.1 `frontend/lib/orchestrator-contract-types.ts`

新增类型：
- `AgentName` — 10 Agent 名称联合类型
- `AgentTrace` — Agent 决策 trace
- `AgentMemoryEntry` — Agent 记忆条目
- `ProjectGroup` — 项目集
- `ProjectRequirements` — 项目需求
- `PromptAsset` — Prompt 资产
- `EvolutionRun` — 进化运行记录
- `Stage1PayloadJson` — 更新：增加 voice_candidates 字段（N07b 音色候选）

### 4.2 `frontend/lib/review-adapters.ts`

更新：
- `adaptArtAssetsFromTasks` — 增加音色候选适配（voice_candidates → VoiceSample[]）

---

## 5. topology.py 更新

```python
# 新增节点
"N07b": {"order": 7.5, "stage": 2, "agent": "audio_director"},
"N16b": {"order": 16.5, "stage": 4, "agent": "shot_designer"},

# 依赖关系
"N07b": ["N06"],      # 与 N07 并行
"N16b": ["N16"],      # N16 → N16b → N17

# Agent 角色映射更新
NODE_AGENT_ROLE = {
    "N01": "script_analyst",
    "N02": "shot_designer",   # was "episode_planner"
    "N03": "quality_inspector",
    "N04": "shot_designer",
    "N05": "shot_designer",
    "N06": "visual_director",
    "N07": "visual_director",
    "N07b": "audio_director",
    "N08": "review_dispatcher",
    "N09": "visual_director",
    "N10": "visual_director",
    "N11": "quality_inspector",
    "N12": "quality_inspector",
    "N13": "visual_director",
    "N14": "visual_director",
    "N15": "quality_inspector",
    "N16": "shot_designer",
    "N16b": "shot_designer",  # + compositor 协作
    "N17": "visual_director",
    "N18": "review_dispatcher",
    "N19": "visual_director",
    "N20": "audio_director",
    "N21": "review_dispatcher",
    "N22": "audio_director",
    "N23": "compositor",
    "N24": "review_dispatcher",
    "N25": "compositor",
    "N26": "compositor",
}
```

---

## 6. 基础设施前置条件（运维 Agent 负责）

> 以下组件需运维 Agent 在 K8s 集群中完成部署后，相关 Python 客户端（rag.py / mq.py）才能连通。

| 组件 | 运维任务 | 阻塞对象 |
|------|---------|---------|
| **Qdrant** | O5 (K8s StatefulSet 部署) | `backend/common/rag.py` 连接、V5/V6/V7 RAG 集成 |
| **RocketMQ** | O6 (K8s 或托管部署) | `backend/common/mq.py` 连接、GPU 异步任务 |
| **ComfyUI + 模型** | O7/O8/O9 (GPU Pod + 模型下载) | N07/N07b/N10/N14/N20 handler 真实执行 |
| **跨子网网络** | O2 (GPU↔VKE 互通) | 所有 GPU 节点相关服务 |

在运维 Agent 完成部署前，主控 Agent 的 rag.py / mq.py 应实现为可降级模式（连接失败时 fallback 到 stub/本地模式）。
