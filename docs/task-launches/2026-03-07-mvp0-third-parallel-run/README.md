# 2026-03-07 MVP-0 第三轮并行任务

## 任务信息
- 日期：`2026-03-07`
- 轮次：`MVP-0 / 夜间第三轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`in_progress`

## 本轮目标
- 把当前“仓库内骨架真实读取”升级为“真实数据库读侧”。
- 把可见成果从单一验收页扩展到 `Review Gateway` 最小读侧和 `NodeRun` 调试读侧。
- 在不引入大规模后端框架改造的前提下，形成更长链路、可持续推进的第三轮主线。

## 本轮覆盖的 spec 任务编号
- `T1`：LangGraph Orchestrator 骨架
- `T2`：Node Registry 与 DAG 校验
- `T3`：Run / NodeRun 状态机
- `T4`：Gate 节点挂起与放行
- `T10`：ReturnTicket 与 RCA
- `T11`：Minimal Rerun Planner
- `T12`：回炉与新版本自动创建
- `T20`：节点调试页后端
- `T21`：Review Gateway

## 本轮策略
- 保留现有 `frontend/app/api/**` 作为 BFF 入口。
- 在 `backend/common/**`、`backend/orchestrator/**`、`backend/rerun/**` 增加最小数据库只读基础层与查询适配层。
- 继续由前端 Route 调 Python 读侧逻辑，不在本轮引入完整 FastAPI 服务。
- 只做真实数据库读侧，不做大规模写侧重构。

## 不在本轮范围内
- 大规模 Python 后端框架建设
- 全量真实业务写侧重构
- OpenClaw 真服务接入
- ComfyUI / LLM / 音频模型部署
- 数据中心全量真实 API
- 外包审核页的大规模改造

## 共享合同与真相源
- `.spec-workflow/specs/aigc-core-orchestrator-platform/tasks.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/design.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/data-structures.md`
- `docs/shared-contract-freeze-batch-1.md`
- `docs/multi-agent-file-ownership.md`
- `docs/multi-agent-execution-contract.md`

## 路径与文件所有权
### 允许改动路径
- `backend/common/**`
- `backend/orchestrator/**`
- `backend/rerun/**`
- `frontend/app/api/**`
- `frontend/app/admin/orchestrator/acceptance/**`
- `frontend/app/admin/drama/**`
- `frontend/lib/**`
- `docs/task-launches/2026-03-07-mvp0-third-parallel-run/**`

### 禁止碰的共享文件
- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- `.spec-workflow/specs/**`
- 已执行迁移 SQL 与既有 schema 真相源

## Agent 分工
### 主控 Agent
- 目标：
  - 维护第三轮任务目录、边界冻结与验收回填
  - 统筹真实数据库读侧的页面接入与总体进度同步

### 数据读侧 Agent
- 对应任务：
  - 数据库连接基础层
  - 公共只读工具、序列化与错误处理

### 编排运行时 Agent
- 对应任务：
  - `T1` `T3` `T4`
- 目标：
  - 将 `backend/orchestrator/**` 的读取从内存造数替换为真实数据库查询

### 回炉与版本 Agent
- 对应任务：
  - `T10` `T11` `T12`
- 目标：
  - 将 `backend/rerun/**` 的读取从样例流替换为真实数据库查询

### Review Gateway Agent
- 对应任务：
  - `T21`
- 目标：
  - 提供任务列表、任务详情、Stage2 聚合、Stage4 串行摘要的最小读侧 API

### 调试页 Agent
- 对应任务：
  - `T20`
- 目标：
  - 让 `/admin/drama/[id]` 至少一个关键区域优先展示真实 `NodeRun` 数据

### Registry / DAG Agent
- 对应任务：
  - `T2`
- 目标：
  - 提供 `node_registry` 读取、DAG 校验和验收展示材料

## 统一验收标准
- `/admin/orchestrator/acceptance` 仍为统一验收入口
- `总体进度` 结构不变，第三轮结束后要同步更新
- `独立任务验收` 中可看到第三轮任务 Tab，且与前两轮并存
- 页面至少展示一组来自真实数据库的 `Run / NodeRun / review_tasks / ReturnTicket / rerun_plan_json / v+1`
- `Review Gateway` 最小读侧接口可调用
- `/admin/drama/[id]` 至少一个关键区域优先展示真实 `NodeRun` 数据
- 本轮目录下存在逐 Task 验收记录与总验收总结

## 风险与控制
- 风险：仓库没有现成 ORM / repository，容易演变成铺整套后端框架
- 控制：严格限定为最小数据库读侧 + BFF 承接
- 风险：真实数据库字段与前端合同存在差异
- 控制：统一在 `backend/common/**` 映射层收口
- 风险：外包审核页仍在开发中，直接改他们页面会增加耦合
- 控制：第三轮优先建设 DTO / API 和 admin / internal 验收壳
