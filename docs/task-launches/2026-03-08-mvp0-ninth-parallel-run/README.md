# 2026-03-08 MVP-0 第九轮并行任务

## 任务信息
- 日期：`2026-03-08`
- 轮次：`MVP-0 / 第九轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`pass`

## 本轮目标
- 把第八轮留下的“开发态 hook + 最小脚本链”推进到“生产化依赖注入 + Stage1 真 Gate 闭环”。
- 优先补齐 `context_loader`、`review_task_creator` 和 `N08 -> N09` 的真实承接，让系统从“可暂停/恢复”推进到“Stage1 真审核任务可落库、可放行、可继续执行”。
- 同步把第九轮的真实实现状态回填到任务目录、验收页和 roadmap，而不是停在计划冻结。

## 本轮覆盖的 spec 任务编号
- `T1`：LangGraph Orchestrator 骨架
- `T3`：Run / NodeRun 状态机
- `T4`：4 Gate 挂起与放行
- `T8.1`：Worker Agent 脚本阶段
- `T20`：节点调试/验收承接
- `T21`：Review Gateway

## 为什么第九轮先做这个
- 第八轮已经证明真实入口具备 `run -> pause -> resume` 能力，但当前 `context_loader` 和 `review_task_creator` 仍偏开发态，意味着真实审核与真实上下文还没完全进入主链。
- 如果现在直接去开 `N10+`、模型 SDK 或更多节点，很容易再次让“运行时主链”和“真实业务真相源”分叉。
- 所以第九轮的定位是：把第八轮打通的最小真实 graph，继续收紧成“生产语义更完整的 Stage1 真闭环”。

## 本轮主线
1. 将 `context_loader` 从当前 fallback/开发态读取，推进到面向真实 `EpisodeContext` 的正式加载入口。
2. 将 `review_task_creator` 从开发态任务创建，推进到真实 `public.review_tasks` / `Review Gateway` 协同链路。
3. 打通 `N08` 审核放行后到 `N09` 的真实承接，让 Stage1 从“能暂停恢复”推进到“真审核任务 -> 真放行 -> 真继续执行”。
4. 同步第九轮计划状态到统一验收页、任务目录和 roadmap，便于在实现前就可见范围与验收口径。

## 本轮实际技术路线
- 继续以 `backend/orchestrator/graph/**` 作为主编排入口，不开第二套 runtime。
- 继续复用 `core_pipeline.runs / node_runs / artifacts / return_tickets` 与 `public.review_tasks`，不新增平行流程表。
- 将 `pipeline_tasks.compile_graph_session()` 默认接到 production `context_loader / review_task_creator`，让真实入口不再依赖调用方手工注入。
- 保持 `Review Gateway / 外部审核 API` 负责审核动作，graph 仅接收 gate decision 并继续执行，不把聚合责任塞回 supervisor。
- 第九轮只收口 Stage1 真闭环，不展开 Stage2~Stage4 全量实现。

## 主要文件
- `backend/orchestrator/graph/**`
- `backend/pipeline_tasks.py`
- `backend/api/routes/pipeline.py`
- `backend/orchestrator/db_read_side.py`
- `frontend/app/admin/orchestrator/acceptance/page.tsx`
- `frontend/lib/orchestrator-roadmap-progress.ts`
- `docs/task-launches/2026-03-08-mvp0-ninth-parallel-run/**`

## 本轮实际交付
1. 新增 `backend/orchestrator/graph/runtime_hooks.py`，落地 production `context_loader` 与 `review_task_creator`。
2. `pipeline_tasks` 默认编译真实 graph 时注入 production hooks，避免运行入口与图内部 runtime 继续分叉。
3. `workers.py` 在 `N01` 成功后回填 `episode_context_ref`，`script_handlers.py` 的 `N02` 优先读取真实 `EpisodeContext`。
4. `gates.py` 从真实 `public.review_tasks` 反推 `scope_items`，保证 Gate state 与真实审核任务一致。
5. `reviews.py` 在审核通过后自动触发 `resume_pipeline.run(...)`，形成 `N08 -> 审核放行 -> N09 -> N18` 的最小真实闭环。
6. 修复两个真实运行问题：`UUID` 写入 `payload_json` 的序列化错误，以及 `compiled_graph_session()` 在异常分支下的 contextmanager 退化问题。

## 验收结果
1. 真实 smoke 已验证：`run_pipeline.run()` 可在 `N08` 暂停，并创建真实 Stage1 `public.review_tasks` 记录。
2. 审核 API `approve` 已验证：可基于 `resume_hint` 自动调用 `resume_pipeline.run()`，将同一条 run 推进到 `N18`。
3. 真实 DB 已验证：放行后 `core_pipeline.runs.current_node_id = N18`、`current_stage_no = 2`，且存在成功的 `N09` `node_run`。
4. 真实 DB 已验证：第九轮 smoke 样本 `episode_versions.status` 已推进到 `wait_review_stage_2`，说明 Stage1 放行后 Stage2 Gate 承接成功。
5. `production_context_loader` 已验证：可基于 `episode_version_id` 从真实 artifact/meta 中恢复 `parsed_script`，返回 production-shaped `EpisodeContext`。

## 允许改动路径
- `backend/common/**`
- `backend/orchestrator/**`
- `backend/api/**`
- `frontend/app/admin/orchestrator/acceptance/**`
- `frontend/lib/**`
- `docs/task-launches/2026-03-08-mvp0-ninth-parallel-run/**`

## 禁止碰的共享文件
- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- 已冻结旧轮次目录内容，除非补交叉引用
- 与第九轮无关的管理后台页面

## 不在本轮范围内
- `N10~N26` 全量真实节点展开
- 多 provider 真正 SDK 批量接入
- 全量 Gate UI 联调与权限体系完工
- Reflection / 质量评测 / 审核运营等后续主线

## 本轮验收标准
- 第九轮任务目录已从计划态升级为实现/验收态，包含真实验证结果
- 验收页第九轮 Tab 已改为展示“生产化依赖注入 + Stage1 真闭环已完成”
- roadmap 中 `T1 / T3 / T4 / T8.1 / T20 / T21` 已同步第九轮完成状态
- 第九轮已真实收口到 `context_loader / review_task_creator / N08 -> N09`，未向无关节点扩散
- 用户可从面板直接看出第九轮已经完成什么、业务价值是什么、后续仍缺什么

## 风险与控制
- 风险：第九轮再次膨胀成“把剩下所有真实依赖一次性做完”
- 控制：只收口到生产化依赖注入和 Stage1 真闭环
- 风险：把审核聚合职责塞回 graph 内部
- 控制：继续保持 `Review Gateway / 外部审核 API` 负责聚合，graph 只负责暂停、恢复和防御性校验
- 风险：为了追求真实上下文而重写数据层
- 控制：优先基于现有真相源做适配层，不开平行模型

## 后续轮次承接
- Stage2~Stage4 仍需按同一 production hook / review truth source 路径继续推进
- `EpisodeContext` 当前已可读真实 artifact/meta，但项目级信息仍有部分字段缺省，后续可继续补全正式项目真相源映射
- `N10~N26` 的真实业务 handler、真实模型 SDK 与 TOS 正式写入仍待后续轮次展开
