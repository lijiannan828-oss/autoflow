# 2026-03-08 MVP-0 第八轮并行任务

## 任务信息
- 日期：`2026-03-08`
- 轮次：`MVP-0 / 第八轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`pass`

## 本轮目标
- 把已经冻结好的 LangGraph 状态机、Gate 机制和 26 节点规格，从“可审阅设计”推进到“最小真实可执行图”。
- 优先打通 `N01 -> N02 -> N03` 的最小真实链路，让系统首次具备 `真实 graph 编译 -> 节点执行 -> node_run/artifact/output_ref -> auto reject` 的一条主链。
- 保持任务目录、验收页和总体 roadmap 同步更新，避免“开始推进了但面板上看不到”。

## 本轮覆盖的 spec 任务编号
- `T1`：LangGraph Orchestrator 骨架
- `T2`：Node Registry 与 DAG 校验
- `T3`：Run / NodeRun 状态机
- `T4`：4 Gate 挂起与放行（先完成真实 graph 接线前置能力）
- `T8.1`：Worker Agent 脚本阶段
- `T20`：节点调试/验收承接

## 为什么第八轮先做这个
- 第四到第七轮已经把 `runs / node_runs / review_tasks / return_tickets / artifacts / model_jobs` 等核心对象逐步补到“有真实样本”的程度。
- 但当前仍缺一层真正的 `LangGraph` 编排引擎接线：节点、边、暂停、恢复、状态推进虽然都设计好了，还没有编译成真实可运行的图。
- 如果不先补这层，后续直接做 `T8.1~T8.6` 的 Worker Agent，很容易再次出现“每个节点各自执行、难以统一暂停/回写/重跑”的漂移。
- 所以第八轮的定位是：把“设计图 + 状态机 + 节点规格”收口成第一条最小真实 graph 主链。

## 本轮主线
1. 在项目 `.venv-connectivity` 中接通 `langgraph`，编译第一版真实 `Pipeline Graph`。
2. 将 `supervisor / workers / gates / topology / context loader / review task creator` 接成真实可运行的 orchestrator 编排图。
3. 先落 `N01 / N02 / N03` 的最小真实 handler 样板，打通：
   - `NodeInputEnvelope`
   - `NodeOutputEnvelope`
   - `node_runs.input_ref/output_ref`
   - `artifacts`
   - `auto_qc` 打回
4. 将第八轮启动状态和后续结果挂到统一验收页与总体进度中。

## 技术路线
- 先以 `backend/orchestrator/graph/**` 作为真实 graph 编排入口，不另起平行框架。
- 继续复用已有 `core_pipeline` 表和 `backend/orchestrator/write_side.py` / `db_read_side.py`，不新增平行运行态表。
- 先接最小 `context_loader` 与 `review_task_creator`，后续再逐步扩成正式服务注入层。
- `N01/N02/N03` 优先走最小真实写侧和真实 DB/TOS ref，不在本轮打开 Stage1~Stage4 全部真实 Gate。

## 当前已确认结果
- 项目 `.venv-connectivity` 已确认安装 `langgraph`，无需再为第八轮单独创建新的 Python 环境。
- 已实测执行 `compile_pipeline(checkpointer=None, interrupt_before_gates=True)`，当前 graph 可真实编译为 `CompiledStateGraph`。
- 已实测运行 `backend.orchestrator.graph.test_graph_build`（项目 venv），现有 topology / supervisor / gates / context builder smoke path 通过。
- 已新增 `N01/N02/N03` 最小真实 script handlers，并在真实数据库 run 上顺序执行三步，确认 `storyboard` artifacts、`node_runs` 和 `N03` 评分结果可连续落库。
- 已实测 `pipeline_tasks` 真实入口可完成 `run -> pause@N08 -> resume -> pause@N18`，证明第八轮不是停留在 worker 级 smoke，而是已经进入真实入口可暂停/恢复阶段。

## 验收结论
- 本轮验收结果：`pass`
- 结论说明：第八轮原始验收标准已全部满足，本轮范围内的“真实 graph 接线 + N01/N02/N03 最小真实链 + 面板承接”已经完成。
- 后续说明：真实 LLM/TOS/正式 `EpisodeContext` 来源、生产级 hook 和后续节点展开属于下一轮范围，不再作为第八轮阻塞项。

## 主要文件
- `backend/orchestrator/graph/**`
- `backend/orchestrator/write_side.py`
- `backend/orchestrator/db_read_side.py`
- `backend/common/contracts/**`
- `frontend/app/admin/orchestrator/acceptance/page.tsx`
- `frontend/lib/orchestrator-roadmap-progress.ts`
- `docs/task-launches/2026-03-08-mvp0-eighth-parallel-run/**`

## Agent 分工建议
### 主控 Agent
- 冻结第八轮目录、边界、验收和总体进度。

### Graph Runtime Agent
- 对应任务：`T1`、`T2`、`T3`
- 目标：接入 `langgraph`、编译真实 graph、接通状态推进和最小 checkpointer/loader 注入。

### Script Worker Agent
- 对应任务：`T8.1`
- 目标：实现 `N01 / N02 / N03` 的最小真实 handler 样板。

### Acceptance Agent
- 对应任务：`T20`
- 目标：把第八轮启动状态、后续 graph 状态和最小真实链结果挂到统一验收页。

## 允许改动路径
- `backend/common/**`
- `backend/orchestrator/**`
- `frontend/app/admin/orchestrator/acceptance/**`
- `frontend/lib/**`
- `docs/task-launches/2026-03-08-mvp0-eighth-parallel-run/**`

## 禁止碰的共享文件
- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- 已冻结的旧轮次目录内容，除非为引用链路补充最小交叉说明
- 与第八轮无关的管理后台页面

## 不在本轮范围内
- 全量 `N01~N26` Worker Agent 真执行
- 多 provider 全量 SDK 接入
- 全量 Gate 前台交互页联调
- 完整 callback worker / scheduler / distributed runtime
- Reflection / 质量评测 / 审核运营等后续主线

## 验收标准
- 验收页新增第八轮任务 Tab，且不覆盖前七轮
- 第八轮目录下存在任务说明、逐 Task 验收记录和总验收总结
- `langgraph` 接入后至少能编译出第一版真实 graph
- `N01 -> N02 -> N03` 至少有一条最小真实链可被执行或被明确验证到“真实接线已完成”
- 第八轮状态在 `frontend/lib/orchestrator-roadmap-progress.ts` 中有同步反映

## 风险与控制
- 风险：第八轮很容易失控扩成“整个编排核心重写”
- 控制：只聚焦真实 graph 接线和 `N01/N02/N03` 最小主链，不一次性打开全部节点
- 风险：安装 `langgraph` 后会暴露更多运行时依赖问题
- 控制：先打通最小 graph compile + smoke path，再逐步接真实 handler
- 风险：真实 graph 接线后，旧 stub 逻辑和真实写侧混用会产生状态漂移
- 控制：以 `node_runs/output_ref/artifacts` 为唯一结果承接，禁止新建平行状态结构

## 当前预期产出
- 一个新的第八轮任务目录
- 一版“真实 LangGraph 编译与接线”最小实现
- 一条 `N01 -> N02 -> N03` 最小真实执行链
- 一轮从“状态机设计完成”推进到“真实 graph 开始运转”的可验收结果
