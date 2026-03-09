# 外包团队确认项：Review Workflow 最小改动说明

本文档用于同步 `review-workflow` 外包前端当前需要关注的最小改动范围。目标是让外包团队只关注会影响页面交互、接口契约和任务流转的内容，不需要理解内部编排、回炉、RAG、模型调度等实现细节。

## 1. 结论

- 本轮数据库迁移会新增部分表和字段，但**外包前端不需要关注绝大多数内部字段变化**。
- 外包团队当前需要重点确认的，不是 `node_runs`、`return_tickets`、`rag_collections` 等内部表，而是**人工审核任务模型**的调整。
- 旧的 `stage_tasks` 不会立即删除，但它**不再适合作为新版人工审核主任务模型**。
- 新版人工审核主任务模型将由 **`review_tasks`** 承接。

## 2. 外包团队需要关注什么

外包前端只需要重点确认下面 4 件事。

### 2.1 任务主模型从“阶段任务”升级为“审核任务”

旧模型：

- 一个 `episode + stage` 基本对应一条人工任务
- 前端更容易把任务理解为“第几关的整集任务”

新模型：

- 人工审核统一抽象为 `review_tasks`
- 每条任务都有独立 `review_task_id`
- 一条任务不仅有 `stage_no`，还会有：
  - `gate_node_id`
  - `review_step_no`
  - `reviewer_role`
  - `review_granularity`
  - `anchor_type`
  - `anchor_id`

原因：

- `Stage2` 变成 `shot` 级审核，一集会拆出多条任务
- `Stage4` 变成 3 步串行审核，不能再用“一阶段一任务”表达

### 2.2 Stage2 不再是“整集一条任务”，而是“按 shot 拆任务”

外包需要确认：

- `Stage2` 页面是否支持按 `shot` 粒度展示待审任务
- 任务列表是否支持同一集出现多条待审记录
- 提交通过/打回时，是否能明确绑定到某个 `shot`

原因：

- 新版设计要求 `Stage2` 每个 `shot` 生成独立审核任务
- 某个 `shot` 打回不应阻塞其他 `shot` 审核

### 2.3 Stage4 不再是“一次审核”，而是 3 步串行

外包需要确认：

- `Stage4` 页面是否支持按“当前审核步骤”展示状态
- 当前用户只看到属于自己角色的那一步
- 上一步未通过前，下一步不应可操作

Stage4 规则：

- Step1：质检员，可选，可跳过
- Step2：剪辑中台
- Step3：合作方

原因：

- 新版 Stage4 是严格串行流转，不再是单次通过/打回

### 2.4 打点和提交决策需要绑定 `review_task_id`

外包需要确认：

- 通过/打回接口提交时带 `review_task_id`
- 时间戳打点、评论、轻微调整都绑定到具体 `review_task_id`

原因：

- 同一集可能同时存在多个人工审核任务
- 如果仍只按 `episode_id + stage_no` 提交，会出现任务归属不清

## 3. `review_tasks` 是什么

`review_tasks` 是新版人工审核任务主表，对外可以理解为：

- “一条可以被某个审核角色领取、查看、通过、打回、打点的实际任务”

它和旧 `stage_tasks` 的区别：

- `stage_tasks` 更像旧版流程里的阶段任务/兼容任务
- `review_tasks` 才能表达新版真实审核粒度

`review_tasks` 最核心的字段语义如下：

- `id`
  - 审核任务唯一 ID，前端任务详情、提交决策、打点都应基于它
- `stage_no`
  - 所属关卡（1~4）
- `gate_node_id`
  - 所属审核节点，例如 `N18_VISUAL_HUMAN_GATE`
- `review_step_no`
  - 同一关卡里的审核步骤序号
  - `Stage4` 会是 `1 / 2 / 3`
- `reviewer_role`
  - 当前任务属于哪个审核角色
- `review_granularity`
  - 当前任务是 `asset / shot / episode`
- `anchor_type + anchor_id`
  - 如果是 `shot` 或 `asset` 级审核，用来标识具体对象
- `status`
  - `pending / in_progress / approved / returned / skipped`

## 4. 外包团队不需要关注什么

以下改动属于内部实现或内部编排能力，外包前端本轮不需要理解，也不应直接依赖这些数据库表：

- `core_pipeline.node_registry`
- `core_pipeline.runs`
- `core_pipeline.node_runs`
- `core_pipeline.artifacts`
- `core_pipeline.return_tickets`
- `rag_collections`
- `character_appearance_index`
- `episode_versions` 的成本/耗时/自动打回等聚合字段
- `revision_logs` 的回炉范围字段
- `feedback_records` 的内部归因扩展字段

原因：

- 这些属于核心编排、回炉、可观测、RAG 和内部分析能力
- 外包前端只需要消费稳定 DTO / API，不应直接绑定内部数据库设计

## 5. 对外包前端的最小影响面

外包团队当前最小需要调整或确认的是：

1. 任务列表和详情的任务主键改为 `review_task_id`
2. Stage2 支持 `shot` 级任务展示与提交
3. Stage4 支持按步骤串行显示与操作
4. 决策提交、打点提交与任务强绑定

除此之外，其余迁移字段可以暂不关注。

## 6. 建议的对接方式

外包前端不要直接依赖底层 `public` 表结构，而是以 API / DTO 契约为准。

建议对接原则：

- 任务列表：后端返回“当前用户可处理的 `review_tasks` 列表”
- 任务详情：后端返回单条 `review_task` 的上下文、媒体、时间轴、历史意见
- 决策提交：基于 `review_task_id`
- 打点提交：基于 `review_task_id`

## 7. 需要外包团队确认的问题

请外包团队确认以下 5 点：

1. 当前任务列表页是否可以接受 `Stage2` 一集多条 `shot` 任务的展示方式
2. 当前 Stage2 页面是否可以按 `shot` 粒度处理通过/打回
3. 当前 Stage4 页面是否可以支持“步骤式串行审核”展示
4. 当前所有通过/打回/打点接口是否可以统一改为基于 `review_task_id`
5. 外包前端是否仍存在任何地方直接依赖 `stage_tasks` 的“一阶段一任务”假设

## 8. 最终原则

- 外包前端只关注“审核任务怎么展示、怎么提交、怎么打点”
- 内部编排、回炉、任务拆分、模型调度由主系统承担
- 数据库迁移会发生，但外包不需要跟随内部表结构频繁调整
- 只要外包前端切换到 `review_tasks` 概念，后续兼容成本会显著降低
