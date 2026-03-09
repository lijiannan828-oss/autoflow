# 2026-03-08 MVP-0 第七轮并行任务

## 任务信息
- 日期：`2026-03-08`
- 轮次：`MVP-0 / 第七轮`
- 主控 Agent：`当前会话主控 Agent`
- 任务状态：`completed`

## 本轮目标
- 把第六轮的 `T9` 静态骨架推进成最小真实执行链。
- 让系统至少具备一条可验证的 `model_jobs -> submit -> callback -> node_run 回写` 流程。
- 继续围绕统一验收页回填，避免“链路做了但不可见”。

## 本轮覆盖的 spec 任务编号
- `T9`：Model Gateway Adapter
- `T20`：节点调试/验收承接（补模型任务链展示）
- `T15`：NodeRun 采集与成本归集（补模型任务状态信号）

## 为什么第七轮先做这个
- 第六轮已经完成 `artifact`、`auto_qc` 和 `model gateway` 合同骨架，但 `T8.x` 真执行仍缺一条真正可跑的模型任务链。
- 如果现在直接开始某个 Worker Agent，很容易每个 Agent 各自实现提交、回调和幂等，后续还得返工统一。
- 所以第七轮优先把模型任务链打穿，再让后续 `T8.x` 直接复用这层。

## 本轮主线
1. 将 `backend/orchestrator/model_gateway.py` 从 route preview 推进到真实 `model_jobs` 落库。
2. 新增最小 submit 写侧：从 `node_run` 构造请求，写入/更新 `model_jobs`，并返回 `job_id`。
3. 新增最小 callback 写侧：按 `job_id` 幂等回写 `model_jobs`，并同步更新 `node_runs.output_ref/status/error_*`。
4. 在验收页补第七轮 Tab，至少能看到模型任务对象与回写结果。

## 技术路线
- 继续复用已有 `model_jobs` 表，不新增平行模型任务表。
- 继续使用 `backend/common/contracts/model_gateway.py` 作为共享合同，避免 provider payload 漂移。
- 通过 `backend/common/contracts/orchestrator_write_api.py` 提供最小命令入口，便于 smoke test 与验收。
- 将第七轮的真实样本也回收到统一 acceptance 读侧。

## 主要文件
- `backend/common/contracts/model_gateway.py`
- `backend/common/contracts/orchestrator_write_api.py`
- `backend/orchestrator/model_gateway.py`
- `backend/orchestrator/write_side.py`
- `backend/orchestrator/db_read_side.py`
- `frontend/lib/orchestrator-contract-types.ts`
- `frontend/app/admin/orchestrator/acceptance/page.tsx`
- `frontend/lib/orchestrator-roadmap-progress.ts`
- `docs/task-launches/2026-03-08-mvp0-seventh-parallel-run/**`

## Agent 分工建议
### 主控 Agent
- 冻结目录、边界、验收、进度和最终回填。

### Submit Agent
- 对应任务：`T9`
- 目标：补 `node_run -> model_jobs` 提交写侧。

### Callback Agent
- 对应任务：`T9`
- 目标：补 `job_id -> model_jobs/node_runs` 回调回写。

### Acceptance Agent
- 对应任务：`T20`
- 目标：把第七轮模型任务链挂到统一验收页。

## 允许改动路径
- `backend/common/**`
- `backend/orchestrator/**`
- `frontend/app/admin/orchestrator/acceptance/**`
- `frontend/lib/**`
- `docs/task-launches/2026-03-08-mvp0-seventh-parallel-run/**`

## 禁止碰的共享文件
- `.cursor/rules/*.mdc`
- `docs/multi-agent-*.md`
- `.spec-workflow/specs/**`
- 与本轮无关的外包页面

## 不在本轮范围内
- 全量 ComfyUI / LLM / 音频 provider SDK 接入
- callback worker 进程化部署
- 全量 `T8.x` Worker Agent 真执行
- 完整超时补偿、重试调度和取消控制

## 验收标准
- 至少一条真实 `model_jobs` 记录可由第七轮写侧生成
- 至少一条 callback 可幂等更新 `model_jobs` 与对应 `node_runs`
- 验收页新增第七轮任务 Tab 且能看到模型任务链结果
- `frontend/lib/orchestrator-roadmap-progress.ts` 与第七轮结果保持同步
- 第七轮目录下存在逐 Task 验收记录与总验收总结

## 风险与控制
- 风险：会不小心扩成完整多 provider 平台
- 控制：本轮只打通统一 job 链和回写，不追求全 provider 真接入
- 风险：callback 语义和 node_run 状态机不一致
- 控制：优先以 `model_jobs.status` 为准，再同步到 `node_runs`
- 风险：幂等处理遗漏导致重复落库
- 控制：`job_id` 作为唯一键，所有回写先按 `job_id` upsert

## 实际结果
- 已新增 `seed-round7`，能真实生成一条 `model_jobs` 样本并完成 callback 回写。
- 已打通 `node_run -> model_jobs(queued) -> model_jobs(succeeded) -> node_runs(succeeded)` 的最小真实链路。
- 已把第七轮结果挂到统一验收页，新增第七轮任务 Tab 与 `model_jobs` 展示。
- 已把 `model_job_count`、`active_model_jobs` 纳入 north-star throughput 摘要。
