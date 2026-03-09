# 2026-03-07 MVP-0 第二轮并行任务

## 任务信息
- 日期：`2026-03-07`
- 轮次：`MVP-0 / 夜间第二轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`in_progress`

## 本轮目标
- 把现有总验收页从“契约一致的 mock 展示”升级为“真实最小读取链路展示”。
- 保持当前总页面结构不变：`总体进度` 保留，`独立任务验收` 通过任务 Tab 查阅。
- 在不做真实数据库写入的前提下，让页面展示真实后端骨架产出的 `Run / NodeRun / ReturnTicket / rerun_plan_json / v+1` 数据。

## 不在本轮范围内
- 真实数据库写入
- 真实状态推进写回
- 真实 OpenClaw 接入
- 模型部署与模型调用
- 大规模后端框架铺设

## 对应 spec 任务编号
- `T1`：LangGraph Orchestrator 骨架
- `T3`：Run / NodeRun 状态机
- `T4`：Gate 节点挂起与放行
- `T10`：ReturnTicket 与 RCA 规则引擎
- `T11`：Minimal Rerun Planner
- `T12`：回炉与新版本自动创建
- `T21`：Review Gateway（只读 DTO 适配）

## 本轮策略
- 只做真实读取链路，不做真实写入链路。
- 后端 Python 骨架负责生成结构化真实数据。
- 前端通过最小 API 读取这些数据。
- 如果真实读取失败，页面允许优雅降级到 mock，但必须标识数据来源。

## 共享合同与真相源
- `.spec-workflow/specs/aigc-core-orchestrator-platform/tasks.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/data-structures.md`
- `docs/shared-contract-freeze-batch-1.md`
- `docs/multi-agent-file-ownership.md`
- `docs/multi-agent-execution-contract.md`

## 路径与文件所有权
### 允许改动路径
- `backend/common/contracts/**`
- `backend/orchestrator/**`
- `backend/rerun/**`
- `frontend/app/admin/orchestrator/acceptance/**`
- `frontend/app/api/**`
- `frontend/lib/**`
- `docs/task-launches/2026-03-07-mvp0-second-parallel-run/**`

### 禁止碰的共享文件
- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- `.spec-workflow/specs/**`
- `migrations/*.sql`
- `schema/**`
- `sql/**`

## Agent 分工
### 主控 Agent
- 对应任务：
  - 治理前置与验收汇总
- 目标：
  - 维护本轮目录与验收记录
  - 统一真实读取链路的数据出口与页面入口

### 编排运行时 Agent
- 对应任务：
  - `T1` `T3` `T4`
- 目标：
  - 在 `backend/orchestrator/**` 中增加最小只读查询结构与真实示例数据出口

### 回炉与版本 Agent
- 对应任务：
  - `T10` `T11` `T12`
- 目标：
  - 在 `backend/rerun/**` 中增加最小只读查询结构与真实示例数据出口

### 人审入口 Agent
- 对应任务：
  - `T21`
- 目标：
  - 验收页改为优先读取真实最小数据
  - 保持总页面不被覆盖
  - 在 `独立任务验收` 下新增第二轮任务 Tab

## 统一验收标准
- 页面入口仍为 `/admin/orchestrator/acceptance`
- `总体进度` Tab 继续存在
- `独立任务验收` 中可看到第二轮任务 Tab
- 页面至少有一部分展示来自真实最小读取链路，而不是静态 mock
- 不发生真实数据库写入
- 本轮目录下有逐 Task 验收记录与总验收总结

## 阻塞项与下一步
- 当前主要风险：仓库没有完整后端服务框架，因此读取链路需要通过最小 API 适配层承接。
- 下一步：
  - 增加后端只读查询层
  - 增加前端最小 API
  - 页面切换为真实读取优先模式
