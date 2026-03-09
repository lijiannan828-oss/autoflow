# 2026-03-08 MVP-0 第十二轮并行任务

## 任务信息
- 日期：`2026-03-08`
- 轮次：`MVP-0 / 第十二轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`pass`

## 本轮目标
- 在第十一轮完成 Stage3 episode 级真闭环后，将同一套 production hook / review truth source 模式推进到 Stage4。
- 重点补齐 `N24` 的真实 episode 级串行 3 步 `review_tasks` 创建与放行语义。
- 打通 `N24 -> Step1 approve -> Step2 approve -> Step3 approve -> N25` 的真实承接，完成 4 Gate 全生产化。

## 本轮覆盖的 spec 任务编号
- `T4`：4 Gate 挂起与放行
- `T5`：Artifact 索引与版本固化
- `T8.4`：Worker Agent 视频阶段（承接侧）
- `T20`：节点调试/验收承接
- `T21`：Review Gateway

## 为什么第十二轮先做这个
- 第十一轮已经证明 `N21` 的 Stage3 episode 级真闭环成立，下一步最短收益就是把同一套模式复制到 `N24`。
- N24 是串行 3 步 Gate，与 N08/N18/N21 的单步模式略有不同，但 production hook 模式完全可复用。
- 完成 N24 后，4 个 Gate 全部生产化，主链 Gate 体系收口，可专注后续 handler 与真实执行链。

## 本轮主线
1. 将 `N24` 的 scope 解析从通用 fallback 提升为显式 episode 级串行 3 步任务。
2. 为 Step 1 创建任务时写入 `scope_meta`（`episode_version_id` / `episode_id` / `step_no`）。
3. `_ensure_next_stage4_step` 升级为与 production 一致：uuid5 确定性 task_id、scope_meta、scope_id。
4. 将 `_build_resume_hint` 增加 stage 4 的 scope_items 处理，与 stage 1/2/3 保持一致。
5. 将第十二轮状态同步到任务目录、验收页与 roadmap。

## 本轮实际交付
1. `backend/orchestrator/graph/runtime_hooks.py` 已将 `N24` 的 scope 解析升级为显式 episode 级串行 3 步，并写入 `scope_meta`。
2. `backend/orchestrator/write_side.py` 已升级 `_ensure_next_stage4_step`：使用 uuid5 确定性 task_id、scope_id、scope_meta、due_at。
3. `_build_resume_hint` 已支持 stage 4 scope_items。
4. approve Step 1/2 时自动创建下一步任务；Step 3 approve 后 resume 推进到 N25。

## 验收结果
1. 代码实现已完成：N24 显式 episode 级 scope 解析、scope_meta、upstream_node_run_id（来自 N23）。
2. `_ensure_next_stage4_step` 已与 production 对齐：task_id、scope_id、scope_meta、payload。
3. graph test 已通过：gate enter N24、gate resume N24 step advance。
4. 真实 smoke 需在具备 DB 与 pipeline 运行环境时执行：run 经 N08/N18/N21 放行后到达 N24，串行 approve 三步后 resume 到 N25。

## 后续轮次承接
- 4 Gate 全生产化已完成，可专注 PLAN Phase 0（Agent-α 基础设施）与 Phase 1（各 Agent 并行 handler）。
- Stage2/Stage3/Stage4 打回后的局部回炉仍待后续轮次继续收口。
- `N14~N23` 的真实模型执行与正式产物固化仍待后续轮次展开。
