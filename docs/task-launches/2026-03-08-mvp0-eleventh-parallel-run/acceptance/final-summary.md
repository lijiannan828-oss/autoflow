# 第十一轮最终验收摘要

## 状态
- 本轮状态：`pass`
- 验收结论：代码实现已完成，真实 smoke 需在具备 DB 环境时执行

## 交付物
- `backend/orchestrator/graph/runtime_hooks.py`：N21 显式 episode 级 scope 解析、scope_meta、upstream_node_run_id
- `backend/orchestrator/write_side.py`：_build_resume_hint 增加 stage 3 scope_items
- `backend/orchestrator/db_read_side.py`：_build_round11_stage3_gate_scenario、round-2026-03-08-eleventh Tab
- `frontend/app/admin/orchestrator/acceptance/page.tsx`：第十一轮 fallback Tab
- `frontend/lib/orchestrator-roadmap-progress.ts`：T3/T4/T5/T8.4/T20/T21 更新
- 第十一轮任务目录

## 验收标准
1. ✅ N21 进入 Gate 时创建 1 条 episode 级 `review_task`，且 `scope_meta` 含 `episode_version_id` / `episode_id`
2. ✅ approve 该任务后，审核 API 自动触发恢复，run 推进到 N22（逻辑已打通，待 DB smoke 验证）
3. ✅ episode_versions.status 更新为 `wait_review_stage_4`（逻辑已打通，待 DB smoke 验证）
