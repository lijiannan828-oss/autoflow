# 2026-03-07 MVP-0 首轮并行任务

## 任务信息
- 日期：`2026-03-07`
- 轮次：`MVP-0 / 夜间首轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`in_progress`

## 本轮目标
- 在不破坏现网测试数据、不破坏 `stage_tasks` 兼容层、不改动生产资源的前提下，完成今晚第一轮多 Agent 开工基线。
- 固化共享合同、文件所有权、任务启动制度，使后续并行开发可控。
- 推进 `MVP-0` 最小闭环的第一轮工程准备：环境守护、前端审核契约对齐、后端目录开槽与骨架准备。
- 如本轮节奏允许，补一个“最小编排验收页”，让 LangGraph 编排结果能以页面方式对齐和验收。

## 不在本轮范围内
- 大规模真实模型部署
- RAG 检索服务落地
- 数据运营与大盘实现
- 生产环境变更
- 破坏性数据库调整

## 对应 spec 任务编号
本轮并不是一次性覆盖全部 `MVP-0`，而是覆盖以下任务的“前置落地”或“最小切片”：

- `T0.4`：环境配置联调
- `T1`：LangGraph Orchestrator 骨架
- `T3`：Run / NodeRun 状态机
- `T4`：Gate 节点挂起与放行
- `T10`：ReturnTicket 与 RCA 规则引擎
- `T11`：Minimal Rerun Planner
- `T12`：回炉与新版本自动创建
- `T14`：OpenClaw 集成
- `T21`：Review Gateway

说明：
- 本轮不承诺上述任务全部做完，而是做其中最适合首轮并行的部分。
- 若增加“最小编排验收页”，它主要服务于本轮验收，不等同于完整交付 `T19/T20`。

## 关于“人审入口 Agent”本轮到底做什么
本轮的“人审入口 Agent”默认 **不是** 直接做完整生产页面，更不是一次性做完全部审核前端。

本轮它的职责定义为：

- 对齐 `T14 + T21` 所需的前端任务模型
- 对齐 `review_tasks` 与冻结的 Gate DTO
- 准备审核池、任务详情、通过/打回的接口层、类型层或 mock 层
- 若本轮节奏允许，再补一个最小可视化验收页，用来展示编排状态和 Gate 流转结果

换句话说：

- 默认目标：接口层、类型层、mock 层、最小交互壳
- 可选增强：最小验收页
- 非本轮目标：完整生产级审核页面、完整 OpenClaw 交互细节、完整时间轴编辑

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
- 对应任务：
  - 治理前置，不单独对应一个 spec 编号
- 目标：
  - 维护共享合同、文件所有权、任务启动目录
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
  - 今晚任务目录落地
  - 第一批共享合同冻结到可执行状态

### 运维平台 Agent
- 对应任务：
  - `T0.4`
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
- 对应任务：
  - `T14`
  - `T21`
- 目标：
  - 只围绕 `review_tasks` 和冻结的 Gate DTO 对齐前端任务模型
  - 为后续审核池、详情页、通过/打回动作准备前端接口层、类型层或 mock 层
  - 若本轮节奏允许，补一个最小编排验收页
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
  - 若最小编排验收页被纳入本轮，则页面至少能展示 `Run`、当前节点、节点状态、Gate 状态、ReturnTicket / rerun 概况

### 编排运行时 Agent
- 对应任务：
  - `T1`
  - `T3`
  - `T4`
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
- 对应任务：
  - `T10`
  - `T11`
  - `T12`
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

## 关于“今晚做完后是否能看到最小 MVP 编排页面”
结论是：**可以把它作为本轮明确验收项，但要把目标定义成“最小可视化验收页”，而不是完整生产后台”。**

更准确地说：

- 如果今晚只停留在规则、合同、前端 DTO、后端目录开槽，那么还不算“能看见 LangGraph 编排”
- 如果本轮额外补上“最小编排验收页”，就可以在一个页面上集中展示最小编排结果

这个页面建议作为本轮的可选增强交付，验收标准是：

- 在一个页面上能看到：
  - 当前 `Run`
  - 当前节点或最近节点
  - `NodeRun` 列表与状态
  - 当前是否卡在 Gate
  - 是否产生 `ReturnTicket`
  - 是否已有 rerun plan / `v+1`
- 数据来源允许是：
  - 真实最小骨架返回的数据
  - 或契约一致的 mock 数据
- 这个页面的目标是“对齐编排结果”，不是“替代完整管理后台”

## 启动顺序
1. 主控 Agent 先完成本轮任务目录与共享合同冻结。
2. 运维平台 Agent 持续守住环境脚本与连通性。
3. 人审入口 Agent 可立即开始对齐 `frontend/**`。
4. 主控 Agent 若决定本轮继续推进后端，先创建后端目录槽位。
5. 编排运行时 Agent、回炉与版本 Agent 仅在主控开槽后进入执行。
6. 若主控决定把最小编排验收页纳入本轮，则由人审入口 Agent 在 `frontend/**` 中承接。

## 统一验收标准
- 不得改动生产资源，不得做破坏性数据库变更。
- 不得绕过 `review_tasks` 冻结合同重新发明字段、状态或 DTO。
- 不得把共享文件变成多 Agent 并发改动对象。
- 所有执行结果都必须给出验证依据，不能只说“已完成”。
- 若某 Agent 本轮未真正启动，必须明确标注为 `pending`，而不是含混描述。
- 若本轮纳入最小编排验收页，则该页面也属于验收结果的一部分，需在验收记录中单独回填。

## 阻塞项与下一步
- 当前主要非阻塞约束：仓库尚无稳定后端目录，因此后端执行 Agent 不能直接散落创建结构。
- 当前决策：
  - 已将“最小编排验收页”提升为本轮正式交付项
  - 主控 Agent 将先开出后端目录槽位，再正式启动人审入口 Agent、编排运行时 Agent、回炉与版本 Agent
- 下一步：
  - 创建 `backend/common/contracts/`
  - 创建 `backend/orchestrator/`
  - 创建 `backend/rerun/`
  - 以本目录为唯一验收回填位置，启动首轮并行执行
