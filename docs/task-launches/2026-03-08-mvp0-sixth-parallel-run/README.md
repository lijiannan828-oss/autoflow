# 2026-03-08 MVP-0 第六轮并行任务

## 任务信息
- 日期：`2026-03-08`
- 轮次：`MVP-0 / 第六轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`completed`

## 本轮目标
- 把第五轮的“统一真相源 + 指标骨架”继续往主链硬能力推进一段。
- 优先覆盖 `T5`、`T6`、`T9` 的最小真实骨架：产物索引、自动打回、模型网关适配层。
- 让这三段能力不只是代码空位，而是能在验收页上看到真实或准真实承接结果。

## 本轮覆盖的 spec 任务编号
- `T5`：Artifact 索引与版本固化
- `T6`：质检自动打回机制
- `T9`：Model Gateway Adapter
- `T20`：节点调试/验收承接（最小展示补充）

## 为什么第六轮先做这个
- 第五轮已经把 truth source 和 north-star summary 收口，但还没有把“主链执行硬能力”继续往前推。
- 如果现在直接打开全量 `T8.x`，会马上撞上三块缺口：
  - 没有稳定的 artifact 写入与固化表达
  - 没有自动质检打回与 auto_qc ticket
  - 没有统一模型执行请求/回调合同
- 所以第六轮的定位是：为后续 `T8.x` 做执行前的三块关键底座。

## 本轮主线
1. 为已存在的 `core_pipeline.artifacts` 落第一版写入器与最小验收读侧。
2. 为 `N03 / N11 / N15` 对应的自动打回补最小写侧闭环，至少真实生成 `auto_qc` ReturnTicket 与 rerun_plan_json。
3. 新建 `Model Gateway` 的共享合同与最小适配器骨架，统一 provider / workflow / callback / idempotency 表达。
4. 将第六轮成果挂到统一验收页，继续保持“总体进度 + 独立任务验收 Tab”的结构不变。

## 技术路线
- 继续复用当前 `backend/orchestrator/write_side.py` 作为最小真实写侧中心，不新起完整服务框架。
- 复用 `backend/orchestrator/dev_seed.py` 继续补开发态 fixture，保证验收页能看到 T5/T6 真实样本。
- 在 `backend/common/contracts/**` 增加 `Model Gateway` 共享合同，在 `backend/orchestrator/**` 增加适配层骨架。
- 在 `backend/orchestrator/db_read_side.py` 与前端验收页补最小展示，不扩成完整数据中台。

## 主要文件
- 核心写侧：`backend/orchestrator/write_side.py`
- 开发态 seed：`backend/orchestrator/dev_seed.py`
- 编排骨架：`backend/orchestrator/service.py`
- 编排模型：`backend/orchestrator/models.py`
- 编排状态：`backend/orchestrator/statuses.py`
- 读侧承接：`backend/orchestrator/db_read_side.py`
- 共享合同：`backend/common/contracts/**`
- 验收页：`frontend/app/admin/orchestrator/acceptance/page.tsx`
- 前端合同：`frontend/lib/orchestrator-contract-types.ts`
- 总体进度：`frontend/lib/orchestrator-roadmap-progress.ts`

## Agent 分工建议
### 主控 Agent
- 冻结第六轮边界、目录、验收、总体进度与最终回填。

### Artifact Agent
- 对应任务：`T5`
- 目标：补 `artifacts` 写入、最小固化表达与验收读侧。

### Auto QC Agent
- 对应任务：`T6`
- 目标：补 `auto_qc` ReturnTicket 与最小自动打回链。

### Model Gateway Agent
- 对应任务：`T9`
- 目标：补 provider 路由、执行请求/回调、幂等键骨架。

### Acceptance Agent
- 对应任务：`T20`
- 目标：让第六轮成果在统一验收页可见，并同步总体进度。

## 允许改动路径
- `backend/common/**`
- `backend/orchestrator/**`
- `backend/rerun/**`
- `frontend/app/admin/orchestrator/acceptance/**`
- `frontend/lib/**`
- `docs/task-launches/2026-03-08-mvp0-sixth-parallel-run/**`

## 禁止碰的共享文件
- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- `.spec-workflow/specs/**`
- 既有迁移 SQL，除非第六轮明确扩 scope
- 外包审核页主工作流

## 不在本轮范围内
- 全量 `T8.1~T8.6` Worker Agent 真执行
- OpenClaw 真服务接入
- 全量 Data Center 页面
- 完整 T6 策略引擎与多维 QC 算法
- 完整模型网关生产执行链与 callback worker

## 验收标准
- 验收页新增第六轮任务 Tab，且不覆盖前五轮
- `artifacts` 在真实数据库中至少有一批第六轮样本可被读出
- 至少有一条 `source_type=auto_qc` 的真实 ReturnTicket 与 `rerun_plan_json`
- `Model Gateway` 至少形成共享合同和可预览的执行请求骨架
- `frontend/lib/orchestrator-roadmap-progress.ts` 与第六轮结果保持同步
- 第六轮目录下存在逐 Task 验收记录与总验收总结

## 风险与控制
- 风险：T5/T6/T9 很容易一口气扩成完整执行主链
- 控制：本轮只做最小真实骨架和验收承接，不直接打开全量 T8
- 风险：自动打回语义容易和人工 return 混在一起
- 控制：明确使用 `source_type=auto_qc`，并在验收页上单独标识
- 风险：artifact 类型与现有口径不完全统一
- 控制：优先补 `prompt_json / comfyui_workflow / final output` 三类最有价值产物

## 预期产出
- 一个新的第六轮任务目录
- 第一版 `Artifact Writer`
- 第一版 `Auto QC ReturnTicket` 写侧闭环
- 第一版 `Model Gateway Adapter` 合同与骨架
- 一轮更接近真实执行主链的统一验收结果

## 实际结果
- 已新增 `round6_dev_seed` 开发态 fixture，并真实写入 `12` 条 artifact 样本。
- 已新增 `source_type=auto_qc` 的真实 ReturnTicket，且带 `rerun_plan_json`。
- 已新增 `Model Gateway` 共享合同与 `N09/N14/N20` 路由预览骨架。
- 已新增第六轮验收 Tab，并在总体指标中纳入 `artifact_count` 与 `auto_qc_return_tickets`。
- 已新增非破坏性迁移 `migrations/006_allow_auto_rejected_and_artifact_node_index.sql`，修正数据库对 `auto_rejected` 的约束缺口。
