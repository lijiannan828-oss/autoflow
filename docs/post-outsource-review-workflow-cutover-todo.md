# 外包交付后待办：Review Workflow 切换与收口清单

本文档用于记录外包团队完成当前 `review-workflow` 交付后，主系统仍需执行的数据库、接口、页面和流程切换工作。目标是避免过渡期方案长期固化，确保后续顺利切到新版审核任务模型。

## 1. 目标

- 从兼容期的 `stage_tasks + review_tasks` 并存方案，逐步收敛到以 `review_tasks` 为审核真相源
- 保持外包已交付页面尽量少返工
- 让主管线与人工审核任务模型完全对齐

## 2. 切换原则

- 先接口切换，再页面切换，最后再考虑清理旧兼容字段/旧表语义
- 先双写、双读，再单写、单读
- 任何清理动作都要在外包交付稳定后、验证无回归后再执行

## 3. 必做待办

### 3.1 审核任务真相源切换

- [ ] 将审核任务创建逻辑的主写入源正式切为 `review_tasks`
- [ ] 保留 `stage_tasks` 仅作为兼容投影视图/兼容任务池，不再承载新版审核真实流转
- [ ] 梳理所有“通过/打回/打点”后端逻辑，统一改为以 `review_task_id` 为主键驱动

### 3.2 Stage2 切换到 shot 级任务模型

- [ ] 将 Stage2 页面、接口、审核池正式切换为“一集多 shot 任务”
- [ ] 取消对“一集一条 Stage2 任务”的默认假设
- [ ] 增加“全部 shot approved 后集级放行”的正式聚合逻辑

### 3.3 Stage4 切换到串行步骤模型

- [ ] 将 Stage4 正式切换到 `review_step_no` 驱动的 3 步串行审核
- [ ] 支持 Step1（质检员）可跳过
- [ ] 明确上一步未完成时，下一步不可见/不可操作

### 3.4 DTO / API 契约切换

- [ ] 任务列表接口主键改为 `review_task_id`
- [ ] 任务详情接口返回 `review_step_no`、`reviewer_role`、`review_granularity`、`anchor_type`、`anchor_id`
- [ ] 决策提交接口改为基于 `review_task_id`
- [ ] 打点提交接口改为基于 `review_task_id`
- [ ] 清理所有仍依赖 `episode_id + stage_no` 作为唯一任务标识的接口假设

### 3.5 旧兼容字段收口

- [ ] 停止对 `review_points.note` / `review_points.timecode_sec` 的旧式单写，统一改为标准字段优先
- [ ] 停止对 `review_decision_records.note` 的旧式单写，改为 `decision_comment` 为主
- [ ] 明确 `feedback_records` 是原始反馈/审计辅助表，不再承担新版审核主状态表达
- [ ] 评估 `stage_tasks.source_review_task_id` 等兼容字段是否仍有必要保留

## 4. 数据层补强待办

### 4.1 物理外键补强

- [ ] 统一 `episodes.id`、`shots.id` 与审核域引用字段的 ID 类型
- [ ] 为以下字段补齐当前因历史兼容而未加的物理 FK：
  - `review_tasks.episode_id`
  - `character_appearance_index.episode_id`
  - `character_appearance_index.shot_id`
  - 其他当前仅为“业务引用”的 `episode_id` / `shot_id`

### 4.2 历史数据整理

- [ ] 如有需要，将兼容期内的 `stage_tasks` / `review_points` / `review_decision_records` 历史记录回填为更标准的 `review_tasks` 关联关系
- [ ] 评估是否需要补齐 `review_task_id` 的历史回填脚本

### 4.3 索引与查询优化

- [ ] 审核池切到 `review_tasks` 后，基于真实流量补齐索引
- [ ] 为 Stage2 shot 聚合、Stage4 当前步骤查询、待审任务池聚合补充查询优化

## 5. 外包联调后检查项

- [ ] 确认外包页面已不再写死“一阶段一任务”
- [ ] 确认外包页面已支持 `review_task_id` 主键
- [ ] 确认 Stage2 支持一集多条 shot 任务
- [ ] 确认 Stage4 支持按步骤串行展示与提交
- [ ] 确认旧接口是否还需要保留一段过渡期

## 6. 清理动作（最后阶段再做）

- [ ] 评估是否停用 `stage_tasks` 在人工审核链路中的主职责
- [ ] 评估是否废弃/隐藏旧审核 DTO
- [ ] 评估是否减少或移除旧兼容字段双写逻辑
- [ ] 在完成全链路回归后，再决定是否精简旧字段或旧接口

## 7. 回归验证清单

- [ ] Stage1：资产级审核任务正常创建、通过、打回
- [ ] Stage2：同一集多个 shot 任务可独立审核，全部通过后放行
- [ ] Stage3：episode 级审核任务正常流转
- [ ] Stage4：3 步串行审核、可跳过、可中断、可打回
- [ ] 打点、评论、通过/打回均绑定 `review_task_id`
- [ ] 外包页面与主管线状态一致

## 8. 备注

- 当前阶段允许外包基于 `stage_tasks` 兼容模型先交付
- 但中长期审核任务真相源必须收敛到 `review_tasks`
- 本文档默认由主系统团队在外包交付后接手执行
