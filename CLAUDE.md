# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目概述

**Autoflow** 是一套全自动化 AIGC 短剧生产系统。输入完整剧本（5–10 万字），通过 26 节点 LangGraph 流水线自动生产 30–90 集短剧（每集 1–1.5 分钟）。仅保留 4 个人工审核关卡（Gate 节点 N08、N18、N21、N24），分别对应美术资产、视觉素材、视听整合、成片最终审核。

基础设施：火山引擎（TOS、VikingDB、PostgreSQL、Redis、VKE）。视频生成：ComfyUI on 4090 GPU。成本硬约束：≤ 30 元人民币/分钟成片。

## 目录结构

```
backend/
  common/        # 共享 DB 工具、env、合同、模型定义、状态枚举
                 #   agent_memory.py — Agent 记忆层 CRUD
                 #   rag.py — RAG 检索客户端（Mock/Qdrant）
                 #   mq.py — 消息队列客户端（Mock/RocketMQ）
                 #   llm_client.py — LLM 调用 + 成本追踪
  agents/        # v2.2 Agent 框架
    base.py      #   BaseAgent 基类（三层决策: plan_episode→execute_shot→review_batch）
    registry.py  #   10 Agent 注册表 + 自动发现
    supervisor.py      # SupervisorAgent（成本+合规横切守卫）
    evolution_engine.py # EvolutionEngineAgent（4模式自进化）
    production/  #   7 生产 Agent 实现
  orchestrator/  # LangGraph 流水线：graph/、service.py、models.py、statuses.py
  rerun/         # 回炉票据 / 重跑规划器（T10–T12，预留）
frontend/        # Next.js 16 审核与管理后台（从 frontend/ 目录启动）
migrations/      # 顺序执行的 SQL 迁移文件（001_*.sql … 009_*.sql）
schema/          # 枚举与约束 SQL 文件
docs/            # 架构决策、合同文档、任务启动文档
scripts/         # 基础设施 / 联通性脚本（运维平台 Agent 负责）
tests/           # 集成测试存根
```

## 常用命令

### 前端（在 `frontend/` 目录下执行）
```bash
pnpm dev          # 启动 Next.js 开发服务器
pnpm build        # 生产构建
pnpm lint         # ESLint 检查
```

### 后端 Python 测试（在仓库根目录执行）

后端使用根目录下的 `.venv-connectivity` 虚拟环境：

```bash
# 运行图构建冒烟测试套件
python3 -m backend.orchestrator.graph.test_graph_build

# 运行单个测试函数
python3 -c "
from backend.orchestrator.graph.test_graph_build import test_topology_sanity
test_topology_sanity()
"
```

### 环境变量

所有环境变量从根目录 `.env.local` 加载（系统环境变量优先于文件值）。数据库必填项：`PG_HOST`、`PG_PORT`、`PG_DATABASE`、`PG_USER`、`PG_PASSWORD`。可选：`PG_SSLMODE`。

## 架构说明

### LangGraph 流水线（`backend/orchestrator/graph/`）

流水线是以 `supervisor` 节点为中枢、路由至 26 个 Worker/Gate 节点的 `StateGraph`。

| 文件 | 职责 |
|---|---|
| `topology.py` | 节点 ID、执行顺序、Stage 分配、QC 打回目标、Agent 角色的唯一真相源 |
| `state.py` | `PipelineState` TypedDict — 精简状态（大文件通过 URL/UUID 引用，不存入 state） |
| `supervisor.py` | 纯控制流路由：推进、QC 自动打回（最多 3 次）、Gate partial-approve 重新暂停、重跑跳过 |
| `workers.py` | Worker 节点工厂；真实处理器通过 `register_handler()` 注册（MVP-0 阶段为存根） |
| `gates.py` | Gate enter/resume 节点；N08=资产级、N18=镜头级、N21=剧集级、N24=串行三步 |
| `builder.py` | 构建并编译完整图；生产环境使用 `PostgresSaver` checkpointer |
| `context.py` | 节点间数据交接的输入/输出 envelope 构建器 |

Gate 流程：`gate_enter_N08 → gate_resume_N08（interrupt_before 暂停）→ supervisor`。外部系统通过 `app.update_state()` 注入审核决策后图继续执行。

重跑：在 `PipelineState` 中设置 `is_rerun=True` 和 `rerun_node_ids=[...]`，Supervisor 自动跳过不在列表中的节点。

### 前端（`frontend/`）

Next.js 16 应用，使用 React 19 + Tailwind CSS v4 + shadcn/ui（Radix UI 组件）。

**API 桥接**：前端通过 `lib/python-read-api.ts` 和 `lib/python-write-api.ts` 调用后端 Python 脚本，内部使用 `execFile` 执行 `.venv-connectivity` 下的 Python 解释器，目标脚本为 `backend/common/contracts/orchestrator_read_api.py` 和 `orchestrator_write_api.py`。

**路由结构**：
- `/` — 主审核页面
- `/admin/` — 流水线管理后台（剧集列表、节点追踪、注册表校验、验收）
- `/review/` — 人工审核任务页（美术资产、视听、成片、视觉）
- `/tasks/` — 任务看板与泳道视图

**UI 数据层**（`frontend/lib/`）：所有 mock 数据与类型定义放在此处。类型定义在 `*-types.ts`，mock 数据在 `*-mock-data.ts`，编排器合同类型在 `orchestrator-contract-types.ts`。

### 数据库与迁移

按顺序执行迁移：`migrations/001_*.sql` → … → `migrations/009_*.sql`。枚举：`schema/enums.sql`。约束：`schema/t1_constraints.sql`。

迁移规则（合同约定）：**只增不删** —— 加表、加字段、加索引。未经明确授权，禁止删表、删字段、修改已有列类型。

### v2.2 Agent 架构（`backend/agents/`）

10 Agent 自进化管线：7 生产 Agent + SupervisorAgent + EvolutionEngineAgent + Orchestrator（框架层）。

**三层记忆**：Working Memory（PipelineState）→ Project Memory（PG `agent_memory`）→ Long-term Memory（Qdrant RAG）。

**三层决策模型**：集级策划 `plan_episode()`（1次LLM）→ 镜头执行 `execute_shot()`（零LLM）→ 批后复盘 `review_batch()`（1次LLM）。非生产 Agent 保持旧接口 `reason()`+`act()`。每步自动记录 `agent_traces`。

**Prompt 资产**：Master Template（`prompt_assets`）→ Genre Adapter（`genre_adapters`）→ Instance Adapter（运行时注入）。

**基础设施客户端**：
- `rag.py`: `get_rag_client()` — 有 `QDRANT_URL` 用 QdrantRagClient，否则 MockRagClient
- `mq.py`: `get_mq_client()` — 有 `ROCKETMQ_ENDPOINT` 用 RocketMQClient，否则 MockMQClient

**新环境变量**（可选）：`QDRANT_URL`、`QDRANT_API_KEY`、`ROCKETMQ_ENDPOINT`、`ROCKETMQ_ACCESS_KEY`、`ROCKETMQ_SECRET_KEY`

### 多 Agent 文件所有权

本仓库由多个 Agent 协作开发，文件所有权严格划分：
- `backend/common/contracts/`、`migrations/`、`schema/`、`docs/multi-agent-*.md`、`.cursor/rules/*.mdc`、`backend/agents/base.py`、`backend/agents/registry.py` — **主控 Agent** 专属
- `frontend/**` — **人审入口 Agent**（除非主控 Agent 临时授权）
- `scripts/**` — **运维平台 Agent**
- `backend/orchestrator/` — **编排运行时 Agent**
- `backend/rerun/` — **回炉与版本 Agent**

修改共享合同（状态枚举、`review_tasks`/`return_tickets`/`runs`/`node_runs`/`artifacts` 关键字段、Gate DTO、异步回调 payload）前，必须先查阅 `docs/shared-contract-freeze-batch-1.md`。冻结合同不得由执行 Agent 自行修改，需向主控 Agent 汇报冲突。

### 冲刺进度同步（强制规则）

**所有 Agent 在完成任务后，必须同步更新 `frontend/lib/sprint-data.ts`**：
1. 将对应 task 的 `status` 改为 `"done"`，填入 `completedAt`（ISO 时间戳）
2. 如果任务产生了新的阻塞信息或依赖变更，同步更新 `v22Checkpoints` 中对应检查点的 `passed` 状态
3. 完成后运行 `cd frontend && pnpm build` 确认无编译错误

这是**硬性要求**，不需要用户提醒。冲刺看板（`/admin/sprint`）是全员共享的进度真相源。

### 关键合同约定

- **Stage 2 Gate（N18）**：镜头级聚合，审核角色为 `qc_inspector`
- **Stage 4 Gate（N24）**：严格三步串行；仅第一步（`qc_inspector`）可跳过；各步骤角色定义在 `STAGE4_REVIEWER_ROLE_BY_STEP`
- **QC 自动打回**：N03→N02、N11→N10、N15→N14；超过 3 次不终止流水线，继续往下走并加入预警信息
- **`review_tasks`** 是人工审核的唯一真相源；`stage_tasks` 仅为过渡兼容层，不得反向成为新流程主真相源
