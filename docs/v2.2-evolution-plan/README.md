# AutoFlow v2.2 自进化管线升级计划

> 日期：2026-03-10
> 触发：用户重写需求规格书，从「26节点流水线」升级为「10 Agent (9+1框架) 自进化管线」
> 来源文档：`docs/raw_doc/Pipeline`（AutoFlow v2.2 系统需求规格书）
> 目标：3天内完成整体系统可用，不降级

---

## 核心范式转变

| 维度 | v1（当前） | v2.2（目标） |
|------|-----------|-------------|
| 执行单元 | 26 个 handler 函数 | 10 个 Agent (9+1框架)（三层决策：策划→执行→复盘） |
| 行为驱动 | 硬编码逻辑 | Prompt + 配置驱动 |
| 记忆 | 无 | 三层：State → PG agent_memory → RAG Qdrant |
| 学习 | 无 | Evolution Engine 4模式：每日反思 → 每周进化 → 持续摄取 → 按需训练 |
| 审核交互 | 审核员操作技术参数 | 审核员只写自然语言，Review Dispatcher 拆任务 |
| 成本控制 | 静态预估 | Supervisor 横切守卫实时监控+动态降级 |
| 项目管理 | 单项目 | 三层：ProjectGroup → Project → Episode |
| 新节点 | — | N07b（角色音色）、N16b（影调节奏调整） |
| 消息 | 同步 LangGraph | LangGraph + RocketMQ 异步 |
| 知识库 | 无 | Qdrant RAG（链路级案例） |
| GPU 状态 | 无 GPU | A800×8 刚到位（03-09），模型/ComfyUI 尚未部署 |
| 开发 Agent 数 | 4 | 6（新增运维 Agent + 测试 Agent） |
| 基础设施管理 | 手动 | 运维 Agent 全权负责 K8s/GPU/CI-CD |
| 测试覆盖 | 冒烟测试 | 测试 Agent 全权负责单元/集成/E2E 测试体系 |

---

## 计划文件索引

| 文件 | 内容 |
|------|------|
| [00-global-awareness.md](./00-global-awareness.md) | 需写入全局意识（CLAUDE.md等）的内容 |
| [01-definition-files.md](./01-definition-files.md) | 需调整的定义性文件（spec/schema/DB/QC） |
| [02-existing-module-changes.md](./02-existing-module-changes.md) | 已实现模块的具体调整清单 |
| [03-new-work-agent-division.md](./03-new-work-agent-division.md) | 未实现部分的 Agent 分工与排期 |
| [04-day-by-day-schedule.md](./04-day-by-day-schedule.md) | 3天逐日执行计划 |
| [05-model-evaluation.md](./05-model-evaluation.md) | 模型评估与 GPU 部署方案 |
| [06-comfyui-workflows.md](./06-comfyui-workflows.md) | ComfyUI 工作流清单 |
| [07-frontend-phases.md](./07-frontend-phases.md) | **前端 Phase 0-3 开发计划**（替代 F1-F15） |

---

## 开发 Agent 编制（6 Agent 并行）

| 开发 Agent | 职责域 | 文件所有权 |
|------------|--------|-----------|
| 主控 Agent | 合同/Schema/全局意识/进化架构 | `backend/agents/base.py`, `registry.py`, `supervisor.py`, `evolution_engine.py`, `migrations/`, `schema/`, `docs/` |
| 编排运行时 Agent | LangGraph 核心 + Agent 运行时 | `backend/orchestrator/`, `backend/agents/production/` |
| 人审入口 Agent | 前端全部页面 | `frontend/**` |
| 回炉与版本 Agent | Review Dispatcher + RAG | `backend/agents/dispatch/`, write/read API dispatcher/rag methods |
| **运维 Agent** | K8s/GPU/CI-CD/监控/基础设施 | `scripts/`, `k8s/`, `docker/`, `Dockerfile*`, `.github/`, `ci/`, monitoring configs |
| **测试 Agent** | 单元/集成/E2E 测试体系 | `tests/`, `test_*.py`, `*_test.py`, `pytest.ini`, `conftest.py`, test fixtures |

> GPU（A800×8）于 03-09 刚开通，模型/ComfyUI 均未部署。运维 Agent Day 1 首要任务是 GPU 网络打通 + 存储驱动修复，Day 2 完成模型下载与 ComfyUI 部署。

---

## 关键策略：渐进式升级，不破坏现有能力

1. **保留 LangGraph StateGraph 骨架**——不推翻，在其上包装 Agent 类
2. **handler 函数升级为 Agent 三层决策方法**——plan_episode/execute_shot/review_batch，逻辑复用，LLM 调用从 60-120 次/集降至 3-5 次
3. **RocketMQ 作为异步扩展层**——LangGraph 同步流转保留，GPU 任务走 MQ
4. **先 Agent 壳 + 记忆层，再 RAG + 进化**——分层交付
