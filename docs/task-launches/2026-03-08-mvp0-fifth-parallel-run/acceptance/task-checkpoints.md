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
### [2026-03-08 12:05] T28 / 真相源统一与 Review Gateway 收口
- 执行 Agent：主控 Agent
- 目标：让 acceptance / Node Trace / Review Gateway 开始共享统一的 truth source 状态，而不是各自散落判断 `public.review_tasks` 与 `public.stage_tasks`。
- 实际结果：新增 `get_truth_source_status()` 与 `get_north_star_summary()`；`acceptance`、`node-trace` 读侧现在都会返回 `truth_source.preferred_review_task_source`，当前真实结果为 `public.review_tasks`。
- 验收结论：`pass`
- 验证方式：执行 `backend/common/contracts/orchestrator_read_api.py north-star-summary` 与 `node-trace`，确认返回 `preferred_review_task_source=public.review_tasks`，且 `core_truth_ready=true`。
- 交付物：`backend/orchestrator/db_read_side.py`、`backend/common/contracts/orchestrator_read_api.py`
- 未决风险：详情/列表接口虽然已优先读 `public.review_tasks`，但内部仍保留 compat fallback 兜底逻辑。

### [2026-03-08 12:12] T15 / T16 / 最小指标聚合与 Data Center 摘要 API
- 执行 Agent：主控 Agent
- 目标：为成本、质量、吞吐/等待、反馈闭环建立一层最小可计算事实层，并暴露统一摘要 API。
- 实际结果：新增 `north_star_summary` 契约，聚合了 `core_pipeline.runs/node_runs/return_tickets` 与 `public.review_tasks/review_points`；新增 `/api/orchestrator/data-center/summary`。
- 验收结论：`pass`
- 验证方式：执行 `backend/common/contracts/orchestrator_read_api.py north-star-summary`，确认真实返回 `runs=4`、`node_runs=8`、`return_tickets=1`、`total_cost_cny=2.2` 等摘要字段。
- 交付物：`backend/orchestrator/db_read_side.py`、`frontend/app/api/orchestrator/data-center/summary/route.ts`、`frontend/lib/orchestrator-contract-types.ts`
- 未决风险：当前还没有真实成片分钟数，所以不能给出严格的“单分钟成本”，只能先看到 NodeRun 级成本信号。

### [2026-03-08 12:18] T20 / 验收页与 Node Trace 指标承接
- 执行 Agent：主控 Agent
- 目标：让 `/admin/orchestrator/acceptance` 与 `/admin/drama/[id]` 都能展示第五轮新增的统一指标摘要，而不只展示第四轮写侧样本。
- 实际结果：验收页新增北极星指标摘要卡，并新增第五轮任务 Tab；Node Trace 顶部增加第五轮指标摘要区。
- 验收结论：`pass`
- 验证方式：执行 acceptance 读侧，确认存在 `round-2026-03-08-fifth` 且 payload 带 `north_star_summary`；执行 `node-trace` 读侧，确认返回 `north_star_summary`。
- 交付物：`frontend/app/admin/orchestrator/acceptance/page.tsx`、`frontend/app/admin/drama/[id]/page.tsx`
- 未决风险：Node Trace 页面主体仍保留大量 mock 结构，当前新增的是顶部真实摘要区而不是整页全面收口。

### [2026-03-08 12:22] T25 / 质量评测最小骨架
- 执行 Agent：主控 Agent
- 目标：先建立质量指标的统一读侧输出，让质量不再只是 NodeRun 表里的零散字段。
- 实际结果：`north_star_summary.quality` 统一输出 `avg_quality_score / scored_node_runs / low_quality_node_runs / unstable_node_runs`，验收页与 Node Trace 已开始消费这组质量字段。
- 验收结论：`pass`
- 验证方式：检查 `orchestrator-contract-types.ts` 与 `north-star-summary` 输出结构，确认存在统一质量指标分组。
- 交付物：`backend/orchestrator/db_read_side.py`、`frontend/lib/orchestrator-contract-types.ts`、`frontend/app/admin/orchestrator/acceptance/page.tsx`
- 未决风险：当前只是质量指标字典与最小聚合骨架，还没有形成驱动模型路由或自动打回阈值的完整策略链。
