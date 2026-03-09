# 2026-03-07 MVP-0 首轮并行任务

> 本文件已升级为“每轮一个目录”的管理方式。
> 本轮的正式任务文档与验收记录请统一查看：
> `docs/task-launches/2026-03-07-mvp0-first-parallel-run/`

## 任务信息
- 日期：`2026-03-07`
- 轮次：`MVP-0 / 夜间首轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`ready`

## 本轮目标
- 在不破坏现网测试数据、不破坏 `stage_tasks` 兼容层、不改动生产资源的前提下，完成今晚第一轮多 Agent 开工基线。
- 固化共享合同、文件所有权、任务启动制度，使后续并行开发可控。
- 为 `MVP-0` 最小闭环准备首批可并行的工程槽位：环境守护、前端审核契约对齐、后端目录开槽与骨架准备。

## 本轮目标拆解
### 目标 1：主控层
- 共享合同已冻结到第一批可执行程度。
- 文件所有权与任务启动文档制度生效。
- 今晚任务范围、路径、Agent 分工、验收口径统一。

### 目标 2：环境层
- `Redis` 与 `TOS` 已具备可复用健康检查路径。
- 本地 `Redis tunnel` 方案、健康检查脚本、运行命令清晰可复用。

### 目标 3：工程层
- 为后续并行开发预留明确目录与所有权，不允许执行 Agent 自行散落创建后端结构。
- 人审入口开发只对齐 `review_tasks` 与冻结的 Gate DTO，不反向把新流程继续绑死到旧 `stage_tasks`。

## 不在本轮范围内
- 大规模真实模型部署
- RAG 检索服务落地
- 数据运营与大盘实现
- 生产环境变更
- 破坏性数据库调整

## 共享合同与真相源
- `.spec-workflow/specs/aigc-core-orchestrator-platform/requirements.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/design.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/tasks.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/data-structures.md`
- `.spec-workflow/specs/aigc-review-workflow-mvp/data-structures.md`
- `docs/multi-agent-execution-contract.md`
- `docs/multi-agent-file-ownership.md`
- `docs/shared-contract-freeze-batch-1.md`

## 路径与文件所有权
### 当前已存在且可分配的路径
- 共享合同路径：
  - `.cursor/rules/*.mdc`
  - `docs/multi-agent-*.md`
  - `docs/task-launches/**`
  - `.spec-workflow/specs/**`
  - `migrations/*.sql`
  - `schema/**`
  - `sql/**`
- 运维路径：
  - `scripts/**`
  - `.env.local` 的开发接入项
  - `autoflow-vke-dev*.kubeconfig`
- 人审入口路径：
  - `frontend/**`

### 本轮新增目录策略
- 当前仓库还没有稳定成型的后端代码目录。
- 本轮若需要新增后端目录，只允许主控 Agent 先开槽，再把目录所有权下放给对应执行 Agent。
- 本轮允许主控 Agent 预留但尚未默认开放的目录建议如下：
  - `backend/common/contracts/`
  - `backend/orchestrator/`
  - `backend/rerun/`
  - `backend/worker-adapters/`

### 禁止碰的共享文件
除主控 Agent 外，以下文件或路径均视为禁止直接改动：

- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- `docs/task-launches/**`
- `.spec-workflow/specs/**`
- `migrations/*.sql`
- `schema/**`
- `sql/**`

## Agent 分工
### 主控 Agent
- 目标：
  - 维护共享合同、文件所有权、任务启动文档
  - 在需要时创建后端目录槽位
  - 拆分并启动下一轮可并行工程任务
- 允许改动范围：
  - `.cursor/rules/*.mdc`
  - `docs/multi-agent-*.md`
  - `docs/task-launches/**`
  - `.spec-workflow/specs/**`
  - 由主控新建的后端目录骨架
- 禁止碰的共享文件：
  - 无
- 本轮验收结果：
  - 任务启动制度落地
  - 今晚任务文档落地
  - 第一批共享合同冻结到可执行状态

### 运维平台 Agent
- 目标：
  - 固化 `Redis` / `TOS` 连通性脚本与本地运行方式
  - 保证后续开发随时可验证环境可用
- 允许改动范围：
  - `scripts/**`
  - `.env.local` 的开发接入项
  - `autoflow-vke-dev*.kubeconfig`
- 禁止碰的共享文件：
  - `.cursor/rules/*.mdc`
  - `docs/multi-agent-*.md`
  - `docs/task-launches/**`
  - `.spec-workflow/specs/**`
  - `migrations/*.sql`
- 本轮验收结果：
  - `Redis` / `TOS` 健康检查脚本可运行
  - 至少一条本地开发可复用运行命令沉淀完成
  - 环境异常能被快速区分为“资源问题”或“本地接入问题”

### 人审入口 Agent
- 目标：
  - 只围绕 `review_tasks` 和冻结的 Gate DTO 对齐前端任务模型
  - 为后续审核池、详情页、通过/打回动作准备前端接口层或 mock 层
- 允许改动范围：
  - `frontend/**`
- 禁止碰的共享文件：
  - `.cursor/rules/*.mdc`
  - `docs/**`
  - `.spec-workflow/specs/**`
  - `migrations/*.sql`
  - `schema/**`
  - `sql/**`
- 本轮验收结果：
  - 前端不再把新版审核主逻辑建立在 `stage_tasks` 之上
  - `review_tasks` 列表、详情、通过、打回相关 DTO 或 mock 结构与冻结合同一致
  - 若当前前端尚未具备完整页面，也至少完成接口层或类型层对齐

### 编排运行时 Agent
- 目标：
  - 在主控开槽后，为 `Run`、`NodeRun`、Gate、状态机建立最小骨架
  - 严格遵守已冻结状态枚举、关键字段和幂等键规则
- 允许改动范围：
  - 仅限主控 Agent 本轮新开槽的编排目录
- 禁止碰的共享文件：
  - `.cursor/rules/*.mdc`
  - `docs/**`
  - `.spec-workflow/specs/**`
  - `migrations/*.sql`
  - `schema/**`
  - `sql/**`
  - `frontend/**`
- 本轮验收结果：
  - 若本轮被启动，需完成最小骨架并与冻结合同一致
  - 若主控尚未开槽，则状态保持 `pending`，不允许自行创建目录

### 回炉与版本 Agent
- 目标：
  - 在主控开槽后，为 `ReturnTicket`、`rerun_plan_json`、`v+1` 版本切换准备实现骨架
- 允许改动范围：
  - 仅限主控 Agent 本轮新开槽的回炉目录
- 禁止碰的共享文件：
  - `.cursor/rules/*.mdc`
  - `docs/**`
  - `.spec-workflow/specs/**`
  - `migrations/*.sql`
  - `schema/**`
  - `sql/**`
  - `frontend/**`
- 本轮验收结果：
  - 若本轮被启动，输出的结构和字段必须与冻结合同一致
  - 若主控尚未开槽，则状态保持 `pending`

## 启动顺序
1. 主控 Agent 先完成本轮任务文档与共享合同冻结。
2. 运维平台 Agent 持续守住环境脚本与连通性。
3. 人审入口 Agent 可立即开始对齐 `frontend/**`。
4. 主控 Agent 若决定本轮继续推进后端，先创建后端目录槽位。
5. 编排运行时 Agent、回炉与版本 Agent 仅在主控开槽后进入执行。

## 统一验收标准
- 不得改动生产资源，不得做破坏性数据库变更。
- 不得绕过 `review_tasks` 冻结合同重新发明字段、状态或 DTO。
- 不得把共享文件变成多 Agent 并发改动对象。
- 所有执行结果都必须给出验证依据，不能只说“已完成”。
- 若某 Agent 本轮未真正启动，必须明确标注为 `pending`，而不是含混描述。

## 本轮总验收结果
- 状态：`ready_to_start`
- 预期总结果：
  - 今晚多 Agent 启动前的规则、合同、边界和任务文档全部齐备
  - 至少 2 个可立即启动的 Agent 包已经具备明确目标和验收口径
  - 后端类 Agent 在主控开槽前不会乱动目录或共享文件

## 实际结果回填
- 主控 Agent：已完成任务启动文档、共享合同冻结、文件所有权冻结
- 运维平台 Agent：已完成 `Redis` / `TOS` 健康检查脚本
- 人审入口 Agent：待启动
- 编排运行时 Agent：待主控开槽
- 回炉与版本 Agent：待主控开槽

## 阻塞项与下一步
- 当前主要非阻塞约束：仓库尚无稳定后端目录，因此后端执行 Agent 不能直接散落创建结构。
- 下一步由主控 Agent 决定是否在本轮继续开出后端目录槽位，并正式启动人审入口 Agent 与后端 Agent 的首轮并行任务。
