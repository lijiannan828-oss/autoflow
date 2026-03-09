# 03 — 未实现部分分工

> 按 Agent 职责划分新建工作，3 天内完成

---

## Agent 分工总表

| 开发 Agent | 负责领域 | 文件所有权 | Day 1 | Day 2 | Day 3 |
|------------|---------|-----------|-------|-------|-------|
| **主控 Agent** | 合同/Schema/全局意识/进化架构 | `backend/agents/base.py`, `registry.py`, `supervisor.py`, `evolution_engine.py`, `backend/common/agent_memory.py`, `rag.py`, `mq.py`, `prompt_assets.py`, `cost_events.py`, `migrations/`, `schema/`, `docs/v2.2-*.md`, `CLAUDE.md` | 迁移+合同+BaseAgent | Prompt 资产库+Supervisor+EvolutionEngine | 集成验证+文档 |
| **编排运行时 Agent** | LangGraph 核心+Agent 运行时 | `backend/orchestrator/graph/*.py`, `backend/orchestrator/handlers/*.py`, `backend/agents/production/` | topology+state+N07b/N16b | supervisor 升级+Supervisor横切集成 | E2E 贯通 |
| **人审入口 Agent** | 前端全部页面 | `frontend/**` | Agent 面板+音色审核 | 进化看板+项目集页 | 成本看板+E2E |
| **回炉与版本 Agent** | Review Dispatcher+RAG | `backend/agents/dispatch/`, `orchestrator_write_api.py`(dispatcher), `orchestrator_read_api.py`(rag) | Dispatcher 核心逻辑 | RAG Qdrant 集成 | 入库流程+检索 |
| **运维 Agent** | K8s/GPU/CI-CD/监控/基础设施 | `scripts/`, `k8s/`, `docker/`, `Dockerfile*`, `.github/`, `ci/`, `.env.local`(infra vars), monitoring configs | GPU网络+存储修复+Qdrant+RocketMQ | 模型下载+ComfyUI+镜像+K8s manifests | CI/CD+监控+弹性伸缩 |
| **测试 Agent** | 单元/集成/E2E 测试体系 | `tests/`, `test_*.py`, `*_test.py`, `pytest.ini`, `conftest.py`, test fixtures | 测试架构+单元测试+Graph 测试 | Agent 集成测试+RAG 测试+E2E 骨架 | 全链路冒烟+性能基准+CI 集成 |

---

## 主控 Agent 任务清单

### Day 1（~12h）— 基础骨架 + 客户端接口

| # | 任务 | 产出 | 预估 | 前置依赖 |
|---|------|------|------|----------|
| M1 | **DB 迁移 009** | `migrations/009_v2.2_agent_infrastructure.sql`（所有新表） | 2h | 无 |
| M2 | **枚举更新** | `schema/enums.sql` 新增 agent_name/memory_type/memory_scope/evolution_type | 30min | 无 |
| M3 | **BaseAgent 基类** | `backend/agents/base.py`：execute/read_memory/save_memory/search_rag/log_trace | 3h | M1 |
| M4 | **Agent 注册表** | `backend/agents/registry.py`：agent_name → Agent 类映射 | 1h | M3 |
| M5 | **agent_memory.py** | `backend/common/agent_memory.py`：CRUD + 过期清理 | 2h | M1 |
| M6 | **rag.py — 接口+mock 模式** | `backend/common/rag.py`：抽象接口 + MockRagClient（本地字典模拟向量检索），真实 Qdrant 连接待 O5 部署后验证 | 1.5h | 无 |
| M7 | **mq.py — 接口+mock 模式** | `backend/common/mq.py`：抽象接口 + MockMQClient（本地队列模拟），真实 RocketMQ 连接待 O6 部署后验证 | 1.5h | 无 |
| M8 | **CLAUDE.md 更新** | 全局意识更新（00-global-awareness.md 内容落地） | 30min | 无 |

### Day 2（~14h）— 核心 Agent + 真实基础设施对接

| # | 任务 | 产出 | 预估 | 前置依赖 |
|---|------|------|------|----------|
| M6b | **rag.py — 真实 Qdrant 连接** | MockRagClient → QdrantRagClient 切换 + 连通性验证 + collection schema 初始化 | 1h | M6 + **O5 就绪** |
| M7b | **mq.py — 真实 RocketMQ 连接** | MockMQClient → RocketMQClient 切换 + topic/consumer-group 创建 + 收发验证 | 1h | M7 + **O6 就绪** |
| M9 | **payload_schemas 扩展** | Stage1Payload + VoiceSampleItem + enrich 函数 | 30min | 无 |
| M10 | **Prompt 资产库 Python 层** | `backend/common/prompt_assets.py`：加载母版→适配器→实例组装 | 3h | M1 |
| M11 | **cost_events.py** | `backend/common/cost_events.py`：成本事件记录+汇总查询 | 1.5h | M1 |
| M12 | **SupervisorAgent（成本+合规横切守卫）** | `backend/agents/supervisor.py`：预算检查+降级决策+项目集约束校验（规则引擎+LLM） | 3h | M3+M5+M11 |
| M13 | **EvolutionEngineAgent（4模式）** | `backend/agents/evolution_engine.py`：每日反思+每周进化+持续摄取+按需训练 | 3h | M3+M6b |
| M17 | **v2.2 后端 API 实现（read_api + write_api）** | 新增前端所需全部后端 API（详见下方 API 清单） | 2h | M5+M11+M6b |

#### M17 API 清单

> 当前 read_api 有 14 个命令，write_api 有 11 个命令，全部是 MVP-0 审核/管线相关。
> v2.2 新页面需要以下 API，均不存在，需主控 Agent 在 Day 2 实现。
> 人审入口 Agent (F5) 的前端 API 桥接层依赖这些后端 API 就绪。

**`orchestrator_read_api.py` 新增命令：**

| 命令 | 前端页面 | 返回内容 |
|------|---------|---------|
| `get-agent-traces` | `/admin/agents/`, `/admin/drama/[id]` | Agent 决策 trace 列表（agent_name/node_id/reasoning/duration/cost） |
| `get-agent-status` | `/admin/agents/` | 10 Agent 运行状态汇总（最近执行/成功率/平均耗时） |
| `get-evolution-dashboard` | `/admin/evolution/` | 进化看板数据（反思报告/A-B 结果/RAG 统计/LoRA 训练状态） |
| `get-project-groups` | `/admin/project-groups/` | 项目集列表 + 约束配置 |
| `get-cost-summary` | `/admin/costs/` | 成本汇总（按 run/episode/agent 维度 + 预算占用率 + 趋势） |
| `get-rag-statistics` | `/admin/evolution/` | RAG 库统计（案例数/genre 分布/检索热度/入库趋势） |

**`orchestrator_write_api.py` 新增命令：**

| 命令 | 前端页面 | 功能 |
|------|---------|------|
| `dispatch-review-annotation` | 所有审核页 | 自然语言批注 → Review Dispatcher 解析 → 返回任务列表 |
| `create-project-group` | `/admin/project-groups/` | 创建项目集 |
| `update-project-group` | `/admin/project-groups/` | 更新项目集约束配置 |
| `delete-project-group` | `/admin/project-groups/` | 删除项目集 |
| `save-agent-memory` | 内部 Agent 调用 | Agent 记忆写入 |
| `query-agent-memory` | `/admin/agents/` | Agent 记忆查询 |

### Day 3（~6h）— 合同文档 + 上线验收

| # | 任务 | 产出 | 预估 | 前置依赖 |
|---|------|------|------|----------|
| M14 | **合同文档** | `docs/v2.2-agent-architecture.md` + `docs/v2.2-memory-rag-contract.md` | 2h | M3+M6b+M12+M13 |
| M15 | **集成验收 — 真实基础设施** | BaseAgent→真实Qdrant RAG→真实RocketMQ→handler注册→记忆读写→trace | 2h | M6b+M7b+全Day2 |
| M15b | **生产环境配置** | `.env.production` 整理 + Qdrant/RocketMQ/PG/TOS 连接串确认 + Secret 验证 | 1h | O10 |
| M16 | **sprint-data.ts 最终更新** | 更新完成状态和验收记录 | 1h | 全部完成 |
| M19 | **base.py 三层决策模型重构** | AgentContext.mode + execute() 四路由 + plan_episode/execute_shot/review_batch + confidence escape hatch | 2h | M3 |

---

## 编排运行时 Agent 任务清单

### Day 1（~14h）

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| R1 | **topology.py 升级** | 新增 N07b/N16b 定义 + 全部 NODE_AGENT_ROLE 更新 + 依赖关系 | 2h |
| R2 | **state.py 升级** | 增加 agent_traces/cost_budget/project_group_constraints 字段 | 1h |
| R3 | **builder.py 升级** | N07b/N16b 节点注册 + N07/N07b 并行边 + N16b 串入 | 2h |
| R4 | **N07b handler** | AudioDirectorAgent.execute_N07b：CosyVoice/ElevenLabs 音色候选生成 | 3h |
| R5 | **N16b handler** | ShotDesignerAgent.execute_N16b：FFmpeg 影调 + Gemini 节奏决策 | 3h |
| R6 | **workers.py 升级 — NODE_DECISION_LAYER 路由** | 按 §2.5 映射表实现 NODE_DECISION_LAYER dict → worker 工厂设置 context.mode → Agent.execute(context) 自动分流。依赖 M19 base.py 框架 | 2h |
| R7 | **context.py 升级** | N07b/N16b envelope builders | 1h |

### Day 2（~12h）

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| R8 | **supervisor.py 并行组** | N07/N07b 并行 dispatch + 合并等待 | 3h |
| R9 | **supervisor.py Supervisor横切检查** | N02/N05/N09/N14/N17/N23 后自动触发 Supervisor 校验（成本+合规+项目需求） | 2h |
| R10 | **supervisor.py 预算降级** | 每节点执行前 Supervisor 成本检查，超限触发降级策略 | 2h |
| R11 | **gates.py N08 扩展** | 合并 N07b 音色候选到 N08 payload | 1.5h |
| R12 | **runtime_hooks.py 扩展** | enrich Stage1 增加 voice_candidates | 1.5h |
| R13 | **7 生产 Agent 按需分层实现** | 按 §2.4 角色表实现各 Agent 对应层级方法（非全部三层！）：ScriptAnalyst=plan_only, ShotDesigner=全三层, VisualDirector=plan+shot, AudioDirector=plan+shot, Compositor=shot_only, QualityInspector=review_only, ReviewDispatcher=legacy。详见 v2.2-agent-architecture.md §2.4-§2.5 | 3h |

### Day 3（~8h）

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| R14 | **图编译测试更新** | test_graph_build.py 增加 N07b/N16b/并行/PM/Cost 测试 | 3h |
| R15 | **E2E 验证** | N01→N26（含 N07b/N16b）全链路冒烟 | 3h |
| R16 | **handler 注册更新** | register_all_handlers() 注册 N07b/N16b + Agent 类模式 | 2h |

---

## 人审入口 Agent 任务清单

> **完整需求规格书**：`docs/raw_doc/human-AI`（864行，含角色权限、7大导航区、~25个页面）
> **API 合同文档**：`docs/v2.2-frontend-api-contract.md`（30个端点，含请求/响应结构）
> **详细 Phase 计划**：`docs/v2.2-evolution-plan/07-frontend-phases.md`（Phase 0-3 拆解）
>
> **原则**：现有页面（`/admin/*`、`/review/*`、`/tasks`）保持不动，新系统在独立路由树下（`/(auth)/login` + `/(main)/*`）
>
> **3天冲刺安排**：按优先级分 4 个 Phase 压入 3 天
> - Day 1: Phase 0（登录骨架 + E2E追踪 + 节点调试 + Agent中心）
> - Day 2: Phase 1（生产大盘 + 成本/GPU监控 + 异常发现 + Prompt Playground）
> - Day 3: Phase 2+3 骨架（审核工作流 + 进化观测台 + 系统设置）

### Day 1（~14h）— Phase 0：看懂系统

> 目标：登录鉴权 + E2E追踪 + 节点调试升级 + Agent中心。让开发者和管理员能看到系统在干什么。

| # | 任务 | 产出 | 预估 | API 依赖 |
|---|------|------|------|----------|
| F1 | **登录页 + 鉴权中间件** | `/(auth)/login/page.tsx` + `middleware.ts` + 全局 Layout（左侧导航+角色过滤） | 3h | `auth_api.py login/me` ✅ |
| F2 | **API 桥接层 — auth + pipeline + agents** | `lib/python-auth-api.ts` + Next.js API routes（/api/auth/*, /api/pipeline/*, /api/agents/*） | 2h | 全部新 API ✅ |
| F3 | **E2E 单集追踪** | `/(main)/pipeline/trace/[episodeId]/page.tsx` — 节点时间线 + Agent 三层决策（策划/执行/复盘） + 成本 waterfall | 4h | `pipeline-trace` ✅ |
| F4 | **节点调试面板升级** | `/(main)/debug/page.tsx` — 快速场景测试 + 对比运行 + 运行历史 | 2h | `debug/run-node` ✅ |
| F5 | **Agent 团队总览 + Profile** | `/(main)/agents/page.tsx` + `/(main)/agents/[agentName]/page.tsx` — 10 Agent 卡片 + 三层决策 trace（plan/execute/review）+ 记忆 | 3h | `agent-profile` + `agent-decisions` ✅ |

### Day 2（~14h）— Phase 1：监控运行

> 目标：管线能跑了，实时监控运行状况，调优 prompt。

| # | 任务 | 产出 | 预估 | API 依赖 |
|---|------|------|------|----------|
| F6 | **生产大盘** | `/(main)/pipeline/page.tsx` — 北极星指标 + 节点分布 + 活动流 + 成本红线 | 4h | `pipeline-dashboard` ✅ |
| F7 | **成本仪表盘** | `/(main)/resources/page.tsx` — 趋势折线图 + 按 Agent/节点分组 + 预算红线 | 2h | `cost-dashboard` (升级版) ✅ |
| F8 | **GPU 资源监控** | `/(main)/resources/gpu/page.tsx` — 8 卡状态网格 + 模型映射 + 10秒刷新 | 2h | `gpu-status` ✅ |
| F9 | **异常与优秀发现** | `/(main)/pipeline/highlights/page.tsx` — 异常/优秀卡片流 + 跳转E2E追踪 | 2h | `pipeline-highlights` ✅ |
| F10 | **Prompt Playground** | `/(main)/debug/prompt-playground/page.tsx` — 左右分栏编辑器 + 变量替换 + 运行历史 | 3h | `prompt-playground` ✅ |
| F15 | **前后端联调 — Phase 0+1 全部切真实 API** | 验证 Day 1-2 所有页面数据联通 | 1h | M17+M18 全部 ✅ |

### Day 3（~10h）— Phase 2+3 骨架：审核工作流 + 进化

> 目标：审核页面全量搭建 + 进化/设置页面骨架。Day 3 先完成可交互骨架，后续迭代补全细节。

| # | 任务 | 产出 | 预估 | API 依赖 |
|---|------|------|------|----------|
| F11 | **我的任务（升级版）** | `/(main)/tasks/page.tsx` — 角色过滤 + 任务卡片流 + 个人统计条 | 2h | `tasks-by-role` ✅ |
| F12 | **Gate1-4 审核页（动态路由）** | `/(main)/tasks/[taskId]/review/page.tsx` — 根据 gate_node_id 渲染 Gate1/2/3/4 组件（复用现有 `/review/*` 组件） | 3h | 已有 review API ✅ |
| F13 | **进化观测台骨架** | `/(main)/evolution/page.tsx` + prompts + rag + lora 子页面骨架 | 2h | `evolution-daily-report` + `prompt-detail` ✅ |
| F14 | **系统设置骨架** | `/(main)/settings/` — 项目集管理 + 人员权限 + 通知配置 | 2h | `settings-*` + `auth_api` ✅ |
| F16 | **前端类型同步 + 集成测试** | `orchestrator-contract-types.ts` 全部新类型 + E2E 验证 | 1h | — |

---

## 回炉与版本 Agent 任务清单

### Day 1（~10h）

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| V1 | **ReviewDispatcherAgent** | `backend/agents/dispatch/review_dispatcher.py`：自然语言解析 → 任务拆分 | 4h |
| V2 | **dispatcher 任务执行器** | 任务类型路由（regenerate/adjust/replace）→ 调度到目标 Agent | 3h |
| V3 | **write_api: dispatch_review_annotation** | API 入口 + 调用 Dispatcher + 写入 review_tasks.dispatcher_tasks | 2h |
| V4 | **回炉票据升级** | return_review_task 增加 Dispatcher 解析（打回原因 → 归因 Agent） | 1h |

### Day 2（~12h）

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| V5 | **Qdrant 集成** | 连接管理 + collection 初始化 + upsert + search | 3h |
| V6 | **RAG 入库流程** | QC 评分 ≥9.0 → 关联全链路资产 → 生成 embedding → 写入 Qdrant | 4h |
| V7 | **RAG 检索 API** | 标签预筛 + 向量语义检索 + 评分排序 → TOP-K 返回 | 3h |
| V8 | **read_api: get_rag_statistics** | RAG 库统计（案例数/genre 分布/检索热度） | 2h |

### Day 3（~8h）

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| V9 | **Dispatcher E2E 测试** | 自然语言批注 → 解析 → 任务拆分 → Agent 调用 → 结果回写 | 3h |
| V10 | **RAG E2E 测试** | 模拟高分 shot → 入库 → 检索验证 | 2h |
| V11 | **负向案例处理** | 人审标记「典型错误」→ negative 案例入库 + counter-example 检索 | 2h |
| V12 | **corrective 案例** | 打回 → 修改成功 → before/after 对比入库 | 1h |

---

## 运维 Agent 任务清单

> GPU（A800×8）于 03-09 刚开通，模型/ComfyUI 尚未部署。运维 Agent 是 GPU 相关一切工作的前置条件。
> 文件所有权：`scripts/`, `k8s/`, `docker/`, `Dockerfile*`, `.github/`, `ci/`, `.env.local`（infra vars only）, monitoring configs

### Day 1（~12h）— 网络打通 + 核心中间件部署（⚡ 阻塞其他 Agent）

> **关键**：O5/O6 完成后立刻通知主控（解锁 M6b/M7b）和回炉（解锁 V5）Agent。

| # | 任务 | 产出 | 预估 | 前置依赖 | 解锁 |
|---|------|------|------|----------|------|
| O1 | **火山引擎资源全盘点 + 架构设计文档** | `docs/infra-architecture.md`：VKE 集群拓扑、网络规划、存储方案、服务依赖图 | 2h | 无 | — |
| O2 | **GPU 节点网络打通** | 跨子网 GPU（10.1.11.110, cn-shanghai-b）↔ VKE worker（10.0.0.116/117）互通，安全组/路由表配置 | 2h | O1 | O7 |
| O3 | **修复 csi-ebs-node CrashLoopBackOff** | GPU 节点存储驱动恢复正常，EBS 卷可挂载 | 1h | O1 | O7 |
| O4 | **Helm 安装 + Ingress controller 部署** | Helm 3 安装、nginx-ingress 部署、域名/证书配置 | 1.5h | O1 | O5/O6 |
| O5 | **⚡ Qdrant 向量数据库部署** | K8s StatefulSet + PVC 持久化、`autoflow_rag` collection 初始化、**连通性验证后通知主控/回炉** | 2h | O4 | **M6b, V5** |
| O6 | **⚡ RocketMQ 部署** | K8s 部署（或火山引擎托管）、NameServer + Broker、`autoflow` consumer group 创建、**连通性验证后通知主控** | 2h | O4 | **M7b** |
| O7 | **ComfyUI 基础镜像构建 + GPU Pod 部署** | Dockerfile（基于 NVIDIA CUDA base）+ K8s Deployment（GPU resource request）+ Service 暴露 | 2h | O2+O3 | O8 |

### Day 2（~14h）— 模型部署 + 逐模型调试 + 全服务联通

> **新增**：O9a-O9d 为每个模型/handler 组合的独立调试验证，确保 GPU 推理真实可用。

| # | 任务 | 产出 | 预估 | 前置依赖 | 解锁 |
|---|------|------|------|----------|------|
| O8 | **开源模型下载到 GPU 节点** | FLUX.2 + LTX-2.3（优先）→ FireRed → CosyVoice → ACE-Step 1.5 → HunyuanFoley，全部 sha256 校验 | 4h | O7 | O9 |
| O9 | **ComfyUI workflow 基线验证** | txt2img workflow（FLUX.2）1 张图 + img2vid workflow（LTX-2.3）1 段视频 → 确认 ComfyUI API 可调 | 1h | O8 | O9a-O9d |
| O9a | **🔬 FLUX.2 调试 — N07 美术图真实 GPU 验证** | 用 N07 handler 真实调用 ComfyUI FLUX.2 → 验证输出图质量/分辨率/延迟 → 记录基线指标（耗时/VRAM/cost_cny） | 1.5h | O9 + R4 | V22-INT.9 |
| O9b | **🔬 FLUX+FireRed 调试 — N10 关键帧真实 GPU 验证** | 用 N10 handler 真实调用 FLUX.2+FireRed → 角色一致性参考图注入 → 验证多参考输出质量 | 1.5h | O9 + R4 | V22-INT.9 |
| O9c | **🔬 LTX-2.3 调试 — N14 视频真实 GPU 验证** | 用 N14 handler 真实调用 LTX-2.3 → 验证 2s 视频输出质量/分辨率/帧率 → 记录 VRAM 峰值 | 1.5h | O9 | V22-INT.9 |
| O9d | **🔬 CosyVoice 调试 — N07b 音色真实 GPU 验证** | CosyVoice 模型加载 + 推理 → 验证音色候选质量/延迟 → 与 N07b handler 对接 | 1h | O9 + R4 | V22-INT.9 |
| O10 | **全服务连通性验证** | PG / Redis / TOS / Qdrant / RocketMQ / ComfyUI 全部从 VKE Pod 内可达 → 生成连通性报告 | 1.5h | O5+O6+O9 | M15b |
| O11 | **Docker 镜像构建 + CR 推送** | backend 镜像 + frontend 镜像，推送到 autoflow-cn-shanghai.cr.volces.com | 1.5h | 无 | O12 |

### Day 3（~10h）— K8s 部署 + CI/CD + 监控 + 上线准备

| # | 任务 | 产出 | 预估 | 前置依赖 |
|---|------|------|------|----------|
| O12 | **K8s Deployment manifests** | backend / frontend / comfyui Deployment + Service + ConfigMap + Secret + 生产环境变量 | 2h | O11 |
| O12b | **K8s 生产部署执行** | kubectl apply 全部 manifests → 验证 Pod Running → 服务可访问 | 1h | O12+O10 |
| O13 | **CI/CD pipeline** | GitHub Actions：build → test → push CR → deploy K8s（dev/prod 分环境） | 2.5h | O12 |
| O14 | **监控体系** | Prometheus + Grafana（或火山云监控）+ GPU 利用率仪表盘 + 告警规则（GPU VRAM/温度/推理延迟） | 2.5h | O12b |
| O15 | **弹性伸缩** | HPA for backend pods、GPU pod scheduling policies（node affinity/tolerations）、资源 limits/requests 调优 | 1h | O12b |
| O16 | **🚀 生产上线 checklist** | 服务健康检查脚本 + 自动重启策略 + 数据备份方案 + 故障恢复 runbook + **上线签核确认** | 1h | 全部 |

---

## 测试 Agent 任务清单

> 文件所有权：`tests/`, `test_*.py`, `*_test.py`, `pytest.ini`, `conftest.py`, test fixtures

### Day 1（~9h）— 测试基础 + 单元测试

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| T1 | **测试架构设计 + pytest 基础配置** | `pytest.ini`、`conftest.py`（共享 fixtures）、`tests/` 目录结构、mock 工具选型 | 2h |
| T2 | **后端单元测试 — 基础模块** | LLM client mock 测试、TOS client mock 测试、agent_memory CRUD 测试（待 M5 完成） | 3h |
| T3 | **Graph 编译测试升级** | 28 节点（含 N07b/N16b）拓扑验证、并行边验证、Agent 角色映射验证（依赖 R1/R3 完成） | 2h |
| T4 | **Handler 单元测试框架** | mock 外部服务（ComfyUI/LLM/TOS）的 fixture 体系 + 3 个示例 handler 测试 | 2h |

### Day 2（~10h）— 集成测试 + E2E 骨架

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| T5 | **Agent 集成测试** | BaseAgent → execute → memory 读写 → trace 记录 全流程（依赖 M3/M5 完成） | 3h |
| T6 | **Dispatcher 集成测试** | 自然语言批注解析 → 任务拆分 → 路由验证（依赖 V1 完成） | 2h |
| T7 | **RAG 集成测试** | Qdrant 写入 → 向量检索 → 结果返回（依赖 V5/O5 完成，O5 未完成则用 mock） | 2h |
| T8 | **前端 E2E 测试骨架** | Playwright（或 Cypress）配置 + 审核页面基础操作流程测试 | 3h |

### Day 3（~8.5h）— 全链路冒烟 + 性能基准 + CI 集成

| # | 任务 | 产出 | 预估 |
|---|------|------|------|
| T9 | **N01→N26 全链路冒烟测试自动化** | 含 N07b/N16b 的完整流水线冒烟（stub 模式 + 可选 GPU 真实模式） | 3h |
| T10 | **Gate 审核流程 E2E 测试** | gate_enter → interrupt → update_state(审核决策) → gate_resume → supervisor 全流程 | 2h |
| T11 | **性能基准测试** | 单集处理时间基线、API 延迟基线、GPU 推理延迟基线 | 2h |
| T12 | **测试报告生成 + CI 集成** | pytest-html 报告、coverage 报告、与运维 Agent CI/CD pipeline 集成 | 1.5h |

---

## 工时总表

| 开发 Agent | Day 1 | Day 2 | Day 3 | 合计 |
|------------|:-----:|:-----:|:-----:|:----:|
| 主控 | 12h | 15h | 6h | **33h** |
| 编排运行时 | 14h | 12h | 8h | **34h** |
| 人审入口 | 12h | 14h | 8h | **34h** |
| 回炉与版本 | 10h | 12h | 8h | **30h** |
| 运维 | 12.5h | 14h | 10h | **36.5h** |
| 测试 | 9h | 10h | 8.5h | **27.5h** |
| **合计** | **69.5h** | **77h** | **48.5h** | **195h** |

> 6 个 Agent 并行开发，实际挂钟 ≈ 14h + 15h + 10h = 39h（3天）。
>
> **两条关键路径**：
> 1. **基础设施链** O1→O2→O7→O8→O9→O9a/b/c/d → 真实 GPU 出图出视频（Day 2 下午）
> 2. **软件集成链** M1→M3→M12/M13 + O5→M6b→V5→V6 + M17→F15 → 前后端联调（Day 2 晚）
>
> Day 3 目标：**全部服务部署到 K8s + 全链路冒烟 + 上线 checklist 签核**

---

## 关键依赖关系（按阻塞链路排序）

```
═══ 关键链路 1：基础设施 → GPU 出图（运维主导，Day 1-2）═══

  O1 (盘点) ─┬→ O2 (GPU网络) ──→ O7 (ComfyUI Pod)
              └→ O3 (csi-ebs)  ──→ O7
  O1 ──→ O4 (Helm/Ingress) ─┬→ O5 (Qdrant)    ★ Day 1 完成后通知主控/回炉
                              └→ O6 (RocketMQ)  ★ Day 1 完成后通知主控
  O7 ──→ O8 (模型下载, 优先FLUX+LTX) ──→ O9 (基线验证)
  O9 ──→ O9a (FLUX.2 + N07 handler 真实GPU)
  O9 ──→ O9b (FLUX+FireRed + N10 handler 真实GPU)
  O9 ──→ O9c (LTX-2.3 + N14 handler 真实GPU)
  O9 ──→ O9d (CosyVoice + N07b handler 真实GPU)
  验收：4 个视觉/音频 handler 真实 GPU 推理输出，记录基线指标

═══ 关键链路 2：中间件 → 客户端真实连接（跨 Agent 阻塞）═══

  ★ O5 (Qdrant 部署) ──→ M6b (rag.py 真实连接) ──→ V5 (Qdrant 集成) ──→ V6/V7 (RAG 入库/检索)
  ★ O6 (RocketMQ 部署) ──→ M7b (mq.py 真实连接)
  说明：Day 1 M6/M7 先写接口+mock 模式，不阻塞 Day 1 其他 Agent 工作
        Day 2 O5/O6 就绪后，M6b/M7b 切换为真实连接

═══ 关键链路 3：后端 API → 前端联调（跨 Agent 阻塞）═══

  M5+M11+M6b ──→ M17 (后端 API 12 个命令) ──→ F15 (前端 mock→真实 API 切换)
  ★ M17 Day 2 完成后，F15 当晚切换

═══ Day 1 并行启动（无阻塞，可同时开始）═══

  主控：M1→M2→M3→M4→M5 | M6(mock)→M7(mock) | M8
  编排：R1→R2→R3→R4/R5→R6→R7
  人审：F5(API桥接)→F1(Agent面板,mock)→F2(音色UI)→F3(Dispatcher UI)→F4
  回炉：V1→V2→V3→V4
  运维：O1→O2+O3→O4→O5+O6→O7
  测试：T1→T2→T3→T4

═══ Day 2 主要依赖═══

  M3 (BaseAgent) ──→ R12 (7 Agent类壳) + R6 (workers兼容层)
  M12 (Supervisor) ──→ R9/R10 (横切检查集成)
  M10 (Prompt 资产) ──→ R12 (Agent类集成 prompt 加载)
  V5 (Qdrant集成) ──→ V6/V7 (RAG 入库/检索)
  V1 (Dispatcher) ──→ T6 (集成测试)

═══ Day 3 上线准备═══

  O11 (镜像) → O12 (K8s manifests) → O12b (生产部署) → O14 (监控)
  O10 (连通性) → M15b (生产配置) → O12b
  R14+R15 (E2E) 依赖 Day 1-2 全部后端任务
  F12 (前端联通) 依赖 M17+F15
  ★ T9 (全链路冒烟) 依赖 O9a-d (GPU handler 真实验证) + Day 2 全部后端
  T12 (CI 集成) 依赖 O13 (CI/CD pipeline)
  O16 (上线 checklist) = Day 3 最终签核点

★ = 跨 Agent 阻塞依赖
```
