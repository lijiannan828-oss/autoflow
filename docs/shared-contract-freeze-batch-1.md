# 第一批共享合同冻结版 V1

## 目的
这份文档不再只是建议，而是今晚多 Agent 并行开发前的第一批冻结合同。

冻结原则：

- 只冻结 `MVP-0` 最小闭环必需的共享合同
- 冻结后执行 Agent 不得自行改名、改值、改接口形状
- 若后续需要调整，由主控 Agent 统一改本文件与相关 spec

## 真相源
本批冻结以以下文档为基础：

- `.spec-workflow/specs/aigc-core-orchestrator-platform/data-structures.md`
- `.spec-workflow/specs/aigc-core-orchestrator-platform/tasks.md`
- `.spec-workflow/specs/aigc-review-workflow-mvp/data-structures.md`

## 1. 状态枚举合同

### 1.1 `EpisodeVersion.status`
冻结值：

- `created`
- `running`
- `wait_review_stage_1`
- `wait_review_stage_2`
- `wait_review_stage_3`
- `wait_review_stage_4`
- `wait_review_stage_4_step_1`
- `wait_review_stage_4_step_2`
- `wait_review_stage_4_step_3`
- `approved_stage_1`
- `approved_stage_2`
- `approved_stage_3`
- `approved_stage_4`
- `returned`
- `patching`
- `delivered`
- `distributed`

冻结规则：

- Gate 挂起时，版本状态必须进入对应 `wait_review_*`
- Stage4 串行审核时，必须使用 `wait_review_stage_4_step_1/2/3`
- 任意人工打回或自动打回进入回炉时，版本状态进入 `returned`
- 生成 `v+1` 后并开始执行重跑时，版本状态进入 `patching` 或新版本 `running`

### 1.2 `Run.status`
冻结值：

- `pending`
- `running`
- `succeeded`
- `failed`
- `canceled`

冻结规则：

- Run 创建即 `pending`
- 实际开始调度时转 `running`
- 全部必需节点结束且无阻塞时转 `succeeded`
- 不可恢复失败转 `failed`
- 人工取消或系统取消转 `canceled`

### 1.3 `NodeRun.status`
冻结值：

- `pending`
- `running`
- `retrying`
- `succeeded`
- `failed`
- `canceled`
- `skipped`
- `partial`
- `auto_rejected`

冻结规则：

- 节点待执行为 `pending`
- 实际执行中为 `running`
- 同一节点重试中为 `retrying`
- 正常完成为 `succeeded`
- 明确失败为 `failed`
- 因最小重跑复用旧产物而不再执行时为 `skipped`
- 有部分产物可复用或部分子任务成功时为 `partial`
- 触发质检自动打回时，质检节点结果必须写成 `auto_rejected`

### 1.4 `ReviewTask.status`
冻结值：

- `pending`
- `in_progress`
- `approved`
- `returned`
- `skipped`

冻结规则：

- 任务创建后默认 `pending`
- 审核员领取或进入会话处理时转 `in_progress`
- 审核通过写 `approved`
- 审核打回写 `returned`
- 仅 Stage4 可跳过步骤允许 `skipped`

### 1.5 `ReturnTicket.status`
冻结值：

- `open`
- `in_progress`
- `resolved`
- `wontfix`

冻结规则：

- 新建打回单默认 `open`
- 已生成 rerun plan 并进入修复处理可转 `in_progress`
- 修复已由新版本解决时转 `resolved`
- 仅确认不再处理时才允许 `wontfix`

## 2. 核心数据字段合同

### 2.1 `review_tasks`
以下字段冻结为第一批并行开发最小关键字段面：

- `id`
- `episode_id`
- `episode_version_id`
- `stage_no`
- `gate_node_id`
- `review_step_no`
- `reviewer_role`
- `review_granularity`
- `anchor_type`
- `anchor_id`
- `status`
- `assignee_id`
- `priority`
- `openclaw_session_id`
- `payload_json`
- `started_at`
- `finished_at`
- `decision`
- `decision_comment`
- `created_at`
- `updated_at`

冻结规则：

- `stage_no` 固定取值 `1..4`
- `gate_node_id` 本批固定为 `N08`、`N18`、`N21`、`N24` 对应 Gate
- `review_step_no`：Stage2 固定 `1`；Stage4 固定 `1/2/3`
- `reviewer_role` 固定取值 `qc_inspector`、`middle_platform`、`partner`
- `review_granularity` 固定取值 `asset`、`shot`、`episode`
- `status` 与 `decision` 不混用：状态写流程态，`decision` 仅写 `approve` 或 `return`
- `openclaw_session_id` 在任务真正进入人工处理界面或会话绑定时写入
- `payload_json` 必须是脱敏后页面载荷，不得塞入内部提示词、供应商密钥或原始敏感上下文

### 2.2 `return_tickets`
冻结关键字段：

- `id`
- `episode_id`
- `episode_version_id`
- `review_task_id`
- `source_type`
- `source_node_id`
- `stage_no`
- `anchor_type`
- `anchor_id`
- `timestamp_ms`
- `issue_type`
- `severity`
- `comment`
- `created_by_role`
- `suggested_stage_back`
- `system_root_cause_node_id`
- `rerun_plan_json`
- `status`
- `resolved_version_id`
- `created_at`
- `updated_at`

冻结规则：

- `source_type` 仅允许 `human_review` 或 `auto_qc`
- `review_task_id` 仅人工打回时必填；自动打回可为空
- `source_node_id` 仅自动打回时必填，首批固定来自 `N03`、`N11`、`N15`
- `rerun_plan_json` 必须作为最小重跑规划的唯一结构化输出，不允许不同 Agent 各自发明第二套格式

### 2.3 `runs`
冻结关键字段：

- `id`
- `episode_id`
- `episode_version_id`
- `status`
- `current_node_id`
- `plan_json`
- `is_rerun`
- `rerun_from_ticket_id`
- `langgraph_thread_id`
- `started_at`
- `finished_at`
- `created_at`
- `updated_at`

冻结规则：

- `plan_json` 是当前 Run 的执行计划真相源
- `is_rerun=true` 时，`rerun_from_ticket_id` 必须有值
- `langgraph_thread_id` 作为编排线程关联 ID，不得让各 Agent 再发明平行线程字段

### 2.4 `node_runs`
冻结关键字段：

- `id`
- `run_id`
- `episode_version_id`
- `node_id`
- `agent_role`
- `status`
- `attempt_no`
- `retry_count`
- `auto_reject_count`
- `scope_hash`
- `input_ref`
- `output_ref`
- `model_provider`
- `model_endpoint`
- `comfyui_workflow_id`
- `api_calls`
- `token_in`
- `token_out`
- `gpu_seconds`
- `cost_cny`
- `rag_query_count`
- `quality_score`
- `error_code`
- `error_message`
- `tags`
- `started_at`
- `ended_at`
- `duration_s`
- `created_at`
- `updated_at`

冻结规则：

- 幂等范围以 `episode_version_id + node_id + scope_hash` 为唯一业务组合
- 数据库唯一约束仍为 `unique(run_id, node_id, attempt_no)`，两者不得混淆
- `auto_reject_count` 仅质检相关节点使用，但字段名全链路统一

### 2.5 `artifacts`
冻结关键字段：

- `id`
- `episode_version_id`
- `node_run_id`
- `artifact_type`
- `anchor_type`
- `anchor_id`
- `time_range`
- `resource_url`
- `preview_url`
- `score`
- `score_detail`
- `meta_json`
- `created_at`

冻结规则：

- `resource_url` 统一指向 `MinIO/TOS`
- `artifact_type` 首批必须兼容以下值：
  - `storyboard`
  - `art_asset`
  - `keyframe`
  - `video`
  - `tts`
  - `bgm`
  - `sfx`
  - `subtitle`
  - `final_cut`
  - `prompt_json`
  - `comfyui_workflow`

## 3. Gate DTO 合同

### 3.1 列表接口
建议冻结为：

```json
{
  "items": [
    {
      "review_task_id": "uuid",
      "episode_id": "uuid",
      "episode_version_id": "uuid",
      "stage_no": 2,
      "gate_node_id": "N18",
      "review_step_no": 1,
      "reviewer_role": "qc_inspector",
      "review_granularity": "shot",
      "anchor_type": "shot",
      "anchor_id": "uuid",
      "status": "pending",
      "priority": "normal",
      "openclaw_session_id": null,
      "due_at": null,
      "payload": {}
    }
  ],
  "total": 1
}
```

冻结规则：

- 列表项主键统一使用 `review_task_id`
- 前端列表不直接依赖旧 `stage_tasks.id`
- 列表按 `reviewer_role + status in (pending, in_progress)` 聚合

### 3.2 详情接口
建议冻结为：

```json
{
  "review_task_id": "uuid",
  "episode_id": "uuid",
  "episode_version_id": "uuid",
  "stage_no": 4,
  "gate_node_id": "N24",
  "review_step_no": 2,
  "reviewer_role": "middle_platform",
  "review_granularity": "episode",
  "anchor_type": null,
  "anchor_id": null,
  "status": "in_progress",
  "priority": "normal",
  "openclaw_session_id": "session_xxx",
  "payload": {},
  "review_points": [],
  "stage4_progress": {
    "current_step_no": 2,
    "total_steps": 3,
    "previous_steps": [
      {
        "step_no": 1,
        "status": "approved"
      }
    ]
  }
}
```

### 3.3 审核通过接口
请求冻结为：

```json
{
  "review_task_id": "uuid",
  "decision": "approve",
  "decision_comment": "通过意见",
  "review_points": []
}
```

响应冻结为：

```json
{
  "review_task_id": "uuid",
  "status": "approved",
  "decision": "approve",
  "return_ticket_id": null,
  "next_action": "release_gate_or_create_next_step"
}
```

### 3.4 审核打回接口
请求冻结为：

```json
{
  "review_task_id": "uuid",
  "decision": "return",
  "decision_comment": "需要修改",
  "review_points": [
    {
      "timestamp_ms": 1200,
      "issue_type": "subtitle",
      "severity": "major",
      "comment": "字幕错位"
    }
  ]
}
```

响应冻结为：

```json
{
  "review_task_id": "uuid",
  "status": "returned",
  "decision": "return",
  "return_ticket_id": "uuid",
  "next_action": "create_return_ticket_and_stop_following_steps"
}
```

### 3.5 跳过步骤接口
请求冻结为：

```json
{
  "review_task_id": "uuid",
  "reason": "optional_step_skipped"
}
```

响应冻结为：

```json
{
  "review_task_id": "uuid",
  "status": "skipped",
  "next_action": "create_next_step"
}
```

冻结规则：

- 仅 `Stage4 Step1` 允许跳过
- 其他任何任务调用跳过都应报错

### 3.6 Stage2 聚合查询接口
响应冻结为：

```json
{
  "episode_version_id": "uuid",
  "gate_node_id": "N18",
  "approved_count": 8,
  "returned_count": 1,
  "pending_count": 2,
  "total_count": 11,
  "all_approved": false
}
```

### 3.7 Stage4 串行步骤查询接口
响应冻结为：

```json
{
  "episode_version_id": "uuid",
  "gate_node_id": "N24",
  "current_step_no": 2,
  "total_steps": 3,
  "steps": [
    {
      "step_no": 1,
      "reviewer_role": "qc_inspector",
      "status": "approved"
    },
    {
      "step_no": 2,
      "reviewer_role": "middle_platform",
      "status": "pending"
    },
    {
      "step_no": 3,
      "reviewer_role": "partner",
      "status": null
    }
  ]
}
```

## 4. 异步回调合同

### 4.1 Broker 与队列
冻结值：

- broker：`Celery + Redis broker`
- queue：`node-run-events`
- queue：`model-callbacks`
- queue：`return-tickets`

冻结规则：

- `node-run-events` 用于节点执行推进、状态更新
- `model-callbacks` 用于模型侧异步回调入站
- `return-tickets` 用于打回单、回炉计划、版本补丁链路

### 4.2 模型回调 payload
冻结最小字段面：

```json
{
  "provider_job_id": "string",
  "node_run_id": "uuid",
  "run_id": "uuid",
  "episode_version_id": "uuid",
  "node_id": "N14",
  "callback_status": "succeeded",
  "output_ref": "tos://bucket/key-or-http-url",
  "error_code": null,
  "error_message": null,
  "metrics": {
    "duration_s": 12,
    "api_calls": 1,
    "token_in": 0,
    "token_out": 0,
    "gpu_seconds": 12.3,
    "cost_cny": 0.88
  },
  "received_at": "2026-03-07T18:00:00Z"
}
```

冻结规则：

- `provider_job_id` 是外部供应商任务 ID
- `node_run_id` 是内部对账主键
- `callback_status` 仅允许映射到 `succeeded`、`failed`、`partial`
- 输出产物必须进入 `artifacts`，不能只停留在回调原文

### 4.3 幂等键规则
冻结规则：

- Node 业务幂等键固定为：`episode_version_id + node_id + scope_hash`
- 回调去重键固定为：`provider_job_id + callback_status`
- 若外部无稳定 `provider_job_id`，则退化为：`node_run_id + callback_status + output_ref`

## 5. 人审流程合同

### 5.1 Stage2
冻结规则：

- Stage2 只能拆成 `shot` 级 `review_tasks`
- `anchor_type` 必须为 `shot`
- `anchor_id` 必须为对应 `shot_id`
- 只有当同一 `episode_version_id` 下全部 Stage2 shot 任务都为 `approved` 时，才能集级放行

### 5.2 Stage4
冻结规则：

- Stage4 必须严格按 `1 -> 2 -> 3` 串行
- `step_1=qc_inspector` 可跳过
- `step_2=middle_platform` 不可跳过
- `step_3=partner` 不可跳过
- 任一步 `returned`，后续步骤不得继续创建或激活

## 6. 兼容层合同

冻结规则：

- `review_tasks` 是新版人工审核主模型
- `stage_tasks` 在过渡期继续保留，但仅作为兼容层和旧页面任务面板输入
- 新接口、新状态推进、新回炉归因统一基于 `review_tasks`
- 面向外包前端时，如果仍需旧任务面板，可由接口层聚合 `review_tasks -> stage_tasks view`
- 执行 Agent 不得把新流程主逻辑继续写回旧 `stage_tasks` 作为真相源

## 7. 今晚不冻结的内容
以下内容后置，不阻塞今晚并行开发：

- 真实模型参数与路由细节
- RAG 检索策略与召回参数
- 大盘字段与运营指标口径
- 复杂成本拆账口径

## 8. 执行要求
- 这份冻结版是今晚多 Agent 的共享开发基线
- 任何执行 Agent 若发现需要新增或修改上述合同，必须先回到主控 Agent
- 主控 Agent 后续如有更新，按 `V2/V3` 继续演进，不在执行中口头漂移
