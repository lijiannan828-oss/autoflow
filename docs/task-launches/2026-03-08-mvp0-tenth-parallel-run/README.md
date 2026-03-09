# 2026-03-08 MVP-0 第十轮并行任务

## 任务信息
- 日期：`2026-03-08`
- 轮次：`MVP-0 / 第十轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`pass`

## 本轮目标
- 在第九轮完成 Stage1 真闭环后，将同一套 production hook / review truth source 模式推进到 Stage2。
- 重点补齐 `N18` 的真实 shot 级 `review_tasks` 创建与 shot 级聚合放行语义。
- 打通 `N18 -> 审核放行 -> N19` 的真实承接，并同步更新任务目录、验收页与 roadmap。

## 本轮覆盖的 spec 任务编号
- `T4`：4 Gate 挂起与放行
- `T5`：Artifact 索引与版本固化
- `T8.4`：Worker Agent 视频阶段（承接侧）
- `T20`：节点调试/验收承接
- `T21`：Review Gateway

## 为什么第十轮先做这个
- 第九轮已经证明 `N08` 的 Stage1 真审核闭环成立，下一步最短收益就是把同一套模式复制到 `N18`。
- `N18` 是第一个真正需要“每个 shot 一条 ReviewTask”的 Gate，如果这里打通，后续 Stage3/Stage4 的人工审核语义就更容易沿同一路径继续展开。
- 相比直接扩更多真实模型节点，第十轮更能继续收敛运行时主链与真实审核真相源，避免再次分叉。

## 本轮主线
1. 将 `N18` 的 scope 解析从单条占位 shot 提升到真实 shot 列表。
2. 将 Stage2 审核 API 聚合语义跑通：部分通过时继续停在 `N18`，全部通过后自动放行进入 `N19` 下游。
3. 用真实数据库 smoke 验证 Stage2 的 `run -> pause@N18 -> 多条 review_tasks -> approve all -> resume` 闭环。
4. 将第十轮状态同步到任务目录、验收页与 roadmap。

## 本轮实际交付
1. `backend/orchestrator/graph/runtime_hooks.py` 已将 `N18` 的 scope 解析升级为真实多 shot 列表，而不是单条占位 task。
2. Stage2 `review_tasks.payload_json` 已补齐 `scope_meta`，包含 `shot_id / scene_id / shot_number / global_shot_index`，便于 Review Gateway 与面板直接消费。
3. 现有审核 API 已验证 Stage2 聚合语义：部分 approve 时继续停在 `N18`，最后一条 approve 才会自动放行。
4. 已实测同一条 run 在 Stage2 放行后跑过 `N19`，并继续停在 `N21`，说明 `N18 -> N19 -> N20 -> N21` 承接成立。

## 验收结果
1. 真实 smoke 已验证：Stage1 放行后，`N18` 会创建 4 条 shot 级 `review_tasks`，不再是单条占位任务。
2. 真实 smoke 已验证：只 approve 第 1 条 shot 任务时，`gate_snapshot` 显示 `approved_count = 1 / total_count = 4`，且 `resume_hint = None`，run 继续停在 `N18`。
3. 真实 smoke 已验证：全部 shot approve 后，审核 API 自动触发恢复，`resume_result.paused_at = N21`。
4. 真实 DB 已验证：同一条 run 存在成功的 `N19 node_run`，且 `public.episode_versions.status = wait_review_stage_3`。

## 本轮范围控制
- 不展开 `N14~N17` 的真实模型执行，只承接它们当前已存在的运行链与输出引用。
- 不在第十轮完成 Stage2 打回后的完整局部回炉编排，只优先确保 Stage2 的真实 shot 级审核与放行闭环成立。
- 不扩 Stage3 / Stage4。

## 后续轮次承接
- Stage2 打回后的“只重跑被退回 shot”仍待后续轮次继续收口。
- Stage3 `N21` 与 Stage4 `N24` 可直接复用第九、十轮已经稳定下来的 production hook / review truth source 路径。
- `N14~N20` 的真实模型执行与产物固化仍待后续轮次继续替换当前 stub。
