# 多 Agent 文件所有权表

## 目的
这份文档用于回答“每个 Agent 到底能改哪些文件”。原则规则写在 `.cursor/rules/`，具体目录级归属写在这里，由主控 Agent 维护并在每轮并行开发前冻结。

## 当前规则
除非主控 Agent 明确重新分配，否则按以下范围执行。

## 共享文件
以下文件属于共享合同与全局边界，默认只允许主控 Agent 主改：

- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- `docs/task-launches/**`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/requirements.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/design.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/tasks.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/data-structures.md`
- `.spec-workflow/specs/aigc-review-workflow-mvp/data-structures.md`
- `migrations/*.sql`
- `schema/**`
- `sql/**`

## Agent 对应改动范围

### 主控 Agent
- 负责所有共享合同文件
- 负责任务拆分、文件归属调整、冲突处理、最终合并

### 运维平台 Agent
- `scripts/**`
- `.env.local` 的开发接入项
- `autoflow-vke-dev*.kubeconfig`
- 仅限 `dev` 的部署、连通性、健康检查、运行脚本

### 人审入口 Agent
- `frontend/**`
- 面向 `review_tasks`、审核池、Gate 页面、Review Gateway 对接的前端与接口适配文件

### 编排运行时 Agent
- 未来后端编排目录
- `Run`、`NodeRun`、DAG、Gate 控制器、状态机实现文件
- 在当前仓库尚未出现明确后端目录前，不得自行创建大范围新结构，须由主控 Agent 先定目录

### 执行代理 Agent
- 未来模型适配器、异步回调、任务分发相关后端目录
- 在当前仓库尚未出现明确后端目录前，不得自行创建大范围新结构，须由主控 Agent 先定目录

### 回炉与版本 Agent
- 未来 `ReturnTicket`、rerun plan、版本切换相关后端目录
- 在当前仓库尚未出现明确后端目录前，不得自行创建大范围新结构，须由主控 Agent 先定目录

### RAG Agent
- 未来知识库接入与检索相关后端目录
- 在当前仓库尚未出现明确后端目录前，不得自行创建大范围新结构，须由主控 Agent 先定目录

### 数据运营 Agent
- 未来观测、报表、采集相关目录
- 在当前仓库尚未出现明确后端目录前，不得自行创建大范围新结构，须由主控 Agent 先定目录

## 当前阶段的特殊约束
- 当前仓库还没有稳定成型的后端代码目录，因此目录级所有权现在主要能先冻结 `frontend`、`scripts`、`docs`、`migrations`、`schema`、`sql`。
- 在后端目录正式建立前，所有“新增后端目录结构”的动作都先归主控 Agent。
- 也就是说，今晚可以并行，但要以“共享合同先定、目录先由主控开槽、执行 Agent 再进场”为前提。

## 变更方法
如果后续要开放新的代码目录给某个 Agent，主控 Agent 先更新本文件，再启动对应并行任务。
