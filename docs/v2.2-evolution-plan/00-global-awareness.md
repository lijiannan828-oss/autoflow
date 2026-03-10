# 00 — 全局意识更新

> 需写入 CLAUDE.md、memory 文件、以及各 Agent rules 的内容

---

## A. CLAUDE.md 必须更新的部分

### A1. 项目概述（替换现有段落）

```
**Autoflow v2.2** 是一套自进化 AIGC 短剧生产系统。输入完整剧本（5-10万字），
通过 10 个 AI Agent (9+1框架) 协作，全自动输出 30-90 集短剧（每集 60-90 秒）。
系统设计原则：Agent-First（行为由 Prompt 驱动，非硬编码）、进化即生产
（每次生产运行同时收集训练数据）、人类是教练非操作员。

核心架构：
- 26 节点 LangGraph 流水线（Orchestrator 作为框架，不计入 Agent 数）+ 9 Agent 类封装三层决策模型（策划→执行→复盘）
- 7 生产 Agent：Script Analyst, Shot Designer, Visual Director, Audio Director, Quality Inspector, Compositor, Review Dispatcher
- 1 监督 Agent：Supervisor（横切守卫，N02/N05/N09/N14/N17/N23 处做成本+合规+项目需求校验）
- 1 进化 Agent：Evolution Engine（4模式：每日反思、每周进化、持续摄取、按需训练）
- 1 框架：LangGraph Orchestrator（状态机编排，不计入 Agent）
- 4 Gate 人审节点（N08/N18/N21/N24）
- 三层 Agent 记忆：工作记忆(State) → 项目记忆(PG agent_memory) → 长期记忆(RAG Qdrant)
- Prompt 资产库：母版 → 题材适配器 → 实例适配器
- 新增节点：N07b（角色音色生成，与N07并行）、N16b（影调节奏调整，N16之后）

基础设施：火山引擎（TOS/RDS/Redis/RocketMQ/VKE）+ Qdrant 向量库。
GPU：A800×8（视频/关键帧/SFX）— 03-09 刚到位，nvidia-device-plugin 已运行，但模型/ComfyUI 尚未部署。
  GPU 节点（10.1.11.110）位于 HPC 集群 cn-shanghai-b 子网，与 VKE worker 节点（10.0.0.116/117）不同子网，需跨子网打通。
  csi-ebs-node 在 GPU 节点上 CrashLoopBackOff，存储驱动待修复。
  待部署开源模型：FLUX.2, LTX-2.3, FireRed adapter, CosyVoice, ACE-Step 1.5, HunyuanFoley。
  4090D×8（TTS/唇同步/BGM/兜底LLM/LoRA）— 待后续采购。
成本硬约束：≤30 元/分钟成片。
```

### A2. 目录结构（新增部分）

```
backend/
  agents/          # Agent 基类 + 9 个 Agent 实现
    base.py        # BaseAgent：三层决策模型（plan/execute/review）、记忆读写、RAG检索、trace记录
    registry.py    # Agent 注册表
    production/    # 7 个生产 Agent
    supervisor.py  # Supervisor（横切守卫：成本+合规+项目需求校验）
    evolution_engine.py  # Evolution Engine（4模式：反思/进化/摄取/训练）
  common/
    mq.py          # RocketMQ 客户端
    rag.py         # Qdrant RAG 客户端
    agent_memory.py # agent_memory 表读写
  orchestrator/    # LangGraph 流水线（保留，Agent 类作为 handler 注入）
k8s/               # Kubernetes manifests（运维 Agent 负责）
  deployments/     # backend/frontend/comfyui Deployment
  services/        # Service + Ingress
  storage/         # PVC, StorageClass
  monitoring/      # Prometheus/Grafana configs
docker/            # Dockerfiles + compose（运维 Agent 负责）
tests/             # 全量测试（测试 Agent 负责）
  unit/            # 单元测试
  integration/     # 集成测试
  e2e/             # 端到端测试
  fixtures/        # 测试固件
ci/                # CI/CD pipeline configs（运维 Agent 负责）
```

### A3. 架构说明（新增 Agent 运行时段落）

```
### Agent 运行时（`backend/agents/`）

每个 Agent 是 BaseAgent 的子类，核心方法为 execute(context) → AgentResult。
Agent 采用三层决策模型（§2.4），按 context.mode 分流：

第一层：集级策划（plan_episode）— N02/N06 触发，1 次 LLM 覆盖全集 30-60 镜头
  产出"全集作战计划"：镜头参数表、资源分配、风格锚定
第二层：镜头级执行（execute_shot）— N10/N14 触发
  N10 两阶段：Phase 1 调用 LLM 为每个关键帧×每个候选生成详细生图 prompt（1次LLM/shot）→ Phase 2 提交 ComfyUI 批量生图（零LLM）
  N14 纯 ComfyUI 执行，零 LLM
  confidence 低于阈值时降级回 LLM 单次推理（trace_type=execute_fallback）
第三层：批后复盘（review_batch）— N12/N16 触发，1 次多模态 LLM 分析全集产物连续性

每集 LLM 决策调用 3-5 次 + N10 每镜头 1 次 prompt 编排（轻量，可并行），vs 旧模式 60-120 次重量级推理，成本降低一个数量级。
非生产 Agent（Supervisor/EvolutionEngine）继续使用 reason()+act() 旧接口。

Agent 通过 register_agent() 注册到 LangGraph handler 中，保持现有流水线拓扑不变。

Supervisor 横切守卫在 N02/N05/N09/N14/N17/N23 处自动触发，合并了原 PM Agent（项目需求校验）和 Cost Controller（成本监控+降级决策）的职责。

Evolution Engine 以 4 种模式运行：每日反思(daily reflection)、每周进化(weekly evolution)、持续摄取(continuous ingestion)、按需训练(conditional training)，合并了原 Reflection/Prompt Evolver/RAG Curator/Style Trainer 4 个独立 Agent。

LangGraph Orchestrator 作为框架层（状态机编排），不计入 Agent 总数。

### 新增节点

- N07b：核心角色音色生成，与 N07 并行执行，Audio Director 负责
- N16b：影调与节奏调整，N16 之后 N17 之前，Shot Designer + Compositor 协作
```

### A4. 多 Agent 文件所有权（更新）

```
- `backend/agents/base.py`, `backend/agents/registry.py`, `backend/agents/supervisor.py`, `backend/agents/evolution_engine.py` — **主控 Agent**
- `backend/common/agent_memory.py`, `backend/common/rag.py`, `backend/common/mq.py`, `backend/common/prompt_assets.py`, `backend/common/cost_events.py` — **主控 Agent**
- `backend/agents/production/` — 各对应 Agent（Visual Director → 编排运行时 Agent 实现）
- `migrations/`, `schema/`, `docs/v2.2-*.md`, `CLAUDE.md` — **主控 Agent**
- `backend/orchestrator/graph/*.py`, `backend/orchestrator/handlers/*.py` — **编排运行时 Agent**
- `frontend/**` — **人审入口 Agent**
- `backend/agents/dispatch/`, `backend/common/contracts/orchestrator_write_api.py`（dispatcher methods）, `backend/common/contracts/orchestrator_read_api.py`（rag methods）— **回炉与版本 Agent**
- `scripts/`, `k8s/`, `docker/`, `Dockerfile*`, `.github/`, `ci/`, `.env.local`（infra vars only）, monitoring configs — **运维 Agent**
- `tests/`, `test_*.py`, `*_test.py`, `pytest.ini`, `conftest.py`, test fixtures — **测试 Agent**
```

---

## B. 新增 Agent 共享意识文件

### B1. `docs/v2.2-agent-architecture.md`（全 Agent 必读）

核心内容：
- 10 Agent (9+1框架) 编制表（名称 → 负责节点 → 核心模型 → 自主权限）
- Agent ↔ 节点对照表（从 v2.2 spec 第八章提取）
- BaseAgent 接口规范（execute / read_memory / save_memory / search_rag / log_trace）
- 三层决策模型（plan_episode / execute_shot / review_batch）
- Agent 间通信协议（LangGraph State 直传 vs RocketMQ 异步）

### B2. `docs/v2.2-memory-rag-contract.md`（记忆层合同）

核心内容：
- agent_memory 表 schema（memory_id, agent_name, memory_type, scope, scope_id, content, confidence, created_at, last_accessed_at, access_count）
- RAGChainCase 结构定义（chain_id, quality_score, case_type, chain_assets, retrieval_tags, embeddings）
- 入库规则（≥9.0 positive / 人审优秀 / 典型错误 negative / 修正成功 corrective）
- 检索策略（标签预筛 → 向量语义 → 评分排序 → TOP-3）

### B3. `docs/v2.2-prompt-asset-contract.md`（Prompt 资产库合同）

核心内容：
- 三层架构：母版（人锁定）→ 题材适配器（Agent 可调）→ 实例适配器（实时组装）
- PromptAsset 数据结构
- 版本管理规则

---

## C. 前端全局意识

前端需要知道的变更：
1. **Review Dispatcher**：审核页提交的自然语言批注会被 Agent 自动拆解为执行任务，前端需展示任务拆解结果
2. **N07b 音色审核**：Gate 1 (N08) 新增音色候选选择 UI
3. **ProjectGroup 管理**：新增项目集管理页面
4. **Agent 状态面板**：替代现有节点调试页，展示 Agent 决策 trace
5. **进化看板**：展示 Reflection 报告、A/B 测试结果、RAG 库统计

---

## D. 数据库全局意识

新增表清单（详见 01-definition-files.md）：
- `agent_memory` — Agent 项目记忆
- `prompt_assets` — Prompt 资产库
- `prompt_versions` — Prompt 版本历史
- `genre_adapters` — 题材适配器
- `rag_chain_cases` — RAG 链路案例索引（主体在 Qdrant）
- `project_groups` — 项目集
- `project_requirements` — 项目特殊需求
- `evolution_runs` — 进化运行记录（反思/A/B测试/LoRA训练）
- `agent_traces` — Agent 决策 trace（输入→推理→输出→耗时→成本）
- `cost_events` — 实时成本事件

修改表清单：
- `review_tasks` — 增加 `dispatcher_tasks` JSONB 字段（Review Dispatcher 拆解结果）
- `episode_versions` — 增加 `project_group_id` 外键
- `projects` — 增加 `group_id` 外键 + `requirements_json`

---

## E. 运维全局意识

### E1. 当前基础设施状态（截至 2026-03-09）

**已就绪：**
- VKE 集群（cn-shanghai）：3 节点
  - `10.0.0.116` / `10.0.0.117`：2 vCPU / 8GB worker 节点（VPC vpc-3i64ne1gc2gao5r0lrr4jgd71）
  - `10.1.11.110`：A800×8 GPU 裸金属（`ecs.ebmhpcpni2l.32xlarge`），128 CPU / 2TB RAM / 8× NVIDIA A800-SXM4-80GB — **03-09 刚开通**，nvidia-device-plugin 已运行，无工作负载
- 已部署服务：aigc-backend, aigc-front, nginx LB（均在 worker 节点）
- TOS 对象存储：tos-cn-shanghai.volces.com（可用未使用）
- CR 容器镜像仓库：autoflow-cn-shanghai.cr.volces.com（可用未使用）
- PostgreSQL RDS（可用）
- Redis（SSH 隧道连接）
- ECS 跳板机：118.196.103.136

**待解决问题：**
- GPU 节点位于 HPC 集群 cn-shanghai-b 子网，与 VKE worker 节点不同子网 — 需跨子网网络打通
- csi-ebs-node 在 GPU 节点上 CrashLoopBackOff — 存储驱动需修复
- 无 Helm 安装
- 无 Ingress controller
- 无 PVC 配置

**缺失组件（运维 Agent 负责部署）：**
- Qdrant 向量数据库 — RAG 层前置条件
- RocketMQ — 异步消息前置条件
- ComfyUI — GPU 推理服务
- 开源模型：FLUX.2, LTX-2.3, FireRed adapter, CosyVoice, ACE-Step 1.5, HunyuanFoley

### E2. 运维 Agent 文件所有权

```
scripts/           # 基础设施/联通性脚本
k8s/               # 全部 Kubernetes manifests
docker/            # Dockerfiles + compose
Dockerfile*        # 容器构建文件
.github/           # GitHub Actions CI/CD
ci/                # CI/CD 配置
.env.local         # 仅基础设施相关环境变量
monitoring/        # Prometheus/Grafana 配置
```

### E3. GPU 部署阻塞关系

GPU 到位前以下任务全部 **阻塞**，运维 Agent 完成 O7/O8/O9 后方可解除：
- N07 美术生成（ComfyUI + FLUX.2）→ VisualDirectorAgent 真实执行
- N07b 音色生成（CosyVoice on GPU）→ AudioDirectorAgent 真实执行
- N10 关键帧生成（ComfyUI + FLUX.2）→ VisualDirectorAgent 真实执行
- N14 视频生成（ComfyUI + LTX-2.3）→ VisualDirectorAgent 真实执行
- N20 音效生成（HunyuanFoley / ACE-Step 1.5）→ AudioDirectorAgent 真实执行

在 GPU 服务就绪前，以上 handler 使用 stub 模式运行。

---

## F. 测试全局意识

### F1. 测试策略

三层测试体系：
1. **单元测试**：Agent 基类方法、DB CRUD、LLM client mock、TOS client mock
2. **集成测试**：Agent 完整 execute 流程、Dispatcher 批注解析→任务派发、RAG 写入→检索、Graph 编译（28 节点拓扑验证）
3. **E2E 测试**：N01→N26 全链路冒烟、Gate 审核流程端到端、前端页面 Playwright/Cypress

### F2. 测试 Agent 文件所有权

```
tests/             # 全量测试根目录
  unit/            # 单元测试
  integration/     # 集成测试
  e2e/             # 端到端测试
  fixtures/        # 测试固件/mock 数据
test_*.py          # 散布的测试文件
*_test.py          # 散布的测试文件
pytest.ini         # pytest 配置
conftest.py        # pytest 共享 fixtures
```

### F3. 测试覆盖目标

- 关键路径测试覆盖率 >80%
- 全链路冒烟测试可自动化运行
- E2E 测试纳入 CI/CD pipeline（运维 Agent 配合）
