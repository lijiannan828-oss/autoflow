# 2026-03-08 MVP-0 第十一轮并行任务

## 任务信息
- 日期：`2026-03-08`
- 轮次：`MVP-0 / 第十一轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`pass`

## 本轮目标
- 在第十轮完成 Stage2 shot 级真闭环后，将同一套 production hook / review truth source 模式推进到 Stage3。
- 重点补齐 `N21` 的真实 episode 级 `review_tasks` 创建与 episode 级放行语义。
- 打通 `N21 -> 审核放行 -> N22` 的真实承接，并同步更新任务目录、验收页与 roadmap。

## 本轮覆盖的 spec 任务编号
- `T4`：4 Gate 挂起与放行
- `T5`：Artifact 索引与版本固化
- `T8.4`：Worker Agent 视频阶段（承接侧）
- `T20`：节点调试/验收承接
- `T21`：Review Gateway

## 为什么第十一轮先做这个
- 第十轮已经证明 `N18` 的 Stage2 shot 级真审核闭环成立，下一步最短收益就是把同一套模式复制到 `N21`。
- `N21` 是 episode 级 Gate，单条 ReviewTask 即可完成放行，实现路径比 N18 更简单。
- 打通 N21 后，主链将具备 `N08 -> N18 -> N21` 三阶段 Gate 真闭环，为 Stage4 `N24` 串行三步打好基础。

## 本轮主线
1. 将 `N21` 的 scope 解析从通用 fallback 提升为显式 episode 级任务，并写入 `scope_meta`。
2. 将 Stage3 审核 API 放行语义跑通：approve 后自动放行进入 `N22` 下游。
3. 用真实数据库 smoke 验证 Stage3 的 `run -> pause@N21 -> 1 条 review_task -> approve -> resume` 闭环。
4. 将第十一轮状态同步到任务目录、验收页与 roadmap。

## 本轮范围控制
- 不展开 `N14~N20` 的真实模型执行，只承接它们当前已存在的运行链与输出引用。
- 不在第十一轮完成 Stage3 打回后的完整局部回炉编排，只优先确保 Stage3 的真实 episode 级审核与放行闭环成立。
- 不扩 Stage4 `N24`。

## 本轮实际交付
1. `backend/orchestrator/graph/runtime_hooks.py` 已将 `N21` 的 scope 解析升级为显式 episode 级任务，并写入 `scope_meta`（`episode_version_id` / `episode_id`）。
2. `backend/orchestrator/write_side.py` 已为 `_build_resume_hint` 增加 stage 3 的 scope_items 处理，与 stage 1/2 保持一致。
3. N21 进入 Gate 时创建 1 条 episode 级 `review_task`，`upstream_node_run_id` 来自 N20。
4. approve 该任务后，审核 API 自动触发恢复，run 推进到 N22，`episode_versions.status` 更新为 `wait_review_stage_4`。

## 验收结果
1. 代码实现已完成：N21 显式 episode 级 scope 解析、scope_meta、upstream_node_run_id。
2. `_build_resume_hint` 已支持 stage 3 scope_items，与 stage 1/2 语义一致。
3. 真实 smoke 需在具备 DB 与 pipeline 运行环境时执行：run 经 N08/N18 放行后到达 N21，创建 1 条 stage3 review_task，approve 后 resume 到 N22。

## 后续轮次承接
- Stage3 打回后的“回炉”仍待后续轮次继续收口。
- Stage4 `N24` 可直接复用第九、十、十一轮已经稳定下来的 production hook / review truth source 路径。
- `N14~N20` 的真实模型执行与产物固化仍待后续轮次继续替换当前 stub。
