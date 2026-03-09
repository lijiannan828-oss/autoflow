# Task 验收记录

## 记录模板
### [日期时间] Task 编号 / 名称
- 执行 Agent：
- 目标：
- 实际结果：
- 验收结论：`pass | partial | blocked`
- 验证方式：
- 交付物：
- 未决风险：

## 当前记录
### [2026-03-08 12:30] T5 / Artifact 索引与版本固化
- 执行 Agent：`当前会话主控 Agent`
- 目标：让 `core_pipeline.artifacts` 不再停留在表结构，至少有一批真实样本和验收展示。
- 实际结果：补齐 `round6_dev_seed` artifact fixture，向同一条开发态 rerun run 写入 `N09/N13/N17/N19/N22/N25` 的最小完成态 NodeRun，并真实落库 `12` 条 artifacts。
- 验收结论：`pass`
- 验证方式：执行 `orchestrator_write_api.py seed-round6`，并通过 `db_read_side` 读取到 `round6_artifacts=12`。
- 交付物：`backend/orchestrator/dev_seed.py`、`backend/orchestrator/db_read_side.py`、验收页 artifact 面板。
- 未决风险：当前仍以开发态 fixture 为主，正式版本复用/继承策略尚未接入。

### [2026-03-08 12:31] T6 / 自动质检打回
- 执行 Agent：`当前会话主控 Agent`
- 目标：补一条真实 `source_type=auto_qc` 的写侧闭环。
- 实际结果：新增 `auto_reject_node_run()` 与 `seed_round6_auto_qc_demo()`，可真实写入 `auto_rejected` NodeRun、`auto_qc` ReturnTicket、`rerun_plan_json`，并把 rerun 目标指向 `N14`。
- 验收结论：`pass`
- 验证方式：执行 `seed-round6` 后读侧确认 `round6_auto_qc=1`。
- 交付物：`backend/orchestrator/write_side.py`、`backend/common/contracts/orchestrator_write_api.py`、验收页 Auto QC 面板。
- 未决风险：多维 QC 结果、阈值量纲统一与自动重跑推进仍未完成。

### [2026-03-08 12:32] T9 / Model Gateway Adapter
- 执行 Agent：`当前会话主控 Agent`
- 目标：冻结共享执行请求/回调/幂等键骨架，避免后续各 Agent 各写各的。
- 实际结果：新增 `backend/common/contracts/model_gateway.py` 与 `backend/orchestrator/model_gateway.py`，能预览 `N09/N14/N20` 的 provider、endpoint、workflow、callback topic、idempotency key。
- 验收结论：`pass`
- 验证方式：执行 `seed-round6` 返回 `model_gateway_preview`，并在第六轮验收 Tab 的 `version_patch` 可见。
- 交付物：`backend/common/contracts/model_gateway.py`、`backend/orchestrator/model_gateway.py`。
- 未决风险：尚未接真实 job 持久化、异步回调消费和 provider SDK。

### [2026-03-08 12:33] 数据库兼容修正 / 迁移 006
- 执行 Agent：`当前会话主控 Agent`
- 目标：修复数据库仍不接受 `auto_rejected` 状态的真实阻塞。
- 实际结果：新增并执行 `migrations/006_allow_auto_rejected_and_artifact_node_index.sql`，放开 `node_runs.status` 约束并新增 `idx_cp_artifacts_node_run`。
- 验收结论：`pass`
- 验证方式：迁移执行成功后，`seed-round6` 首次完整通过。
- 交付物：`migrations/006_allow_auto_rejected_and_artifact_node_index.sql`
- 未决风险：数据库环境若存在未同步迁移的其他实例，仍需后续统一补齐。
