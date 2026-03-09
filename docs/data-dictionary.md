# Autoflow 数据字典（T1）

## 适用范围

本文汇总了 `autoflow` 数据库中由 T1 阶段创建的物理 Schema 对象。

## 枚举类型

- `user_role`: `qc`, `platform_editor`, `partner_reviewer`, `admin`
- `stage_task_status`: `pending`, `in_progress`, `passed`, `rejected`, `generating`, `blocked`
- `episode_status`: `new`, `reviewing`, `generating`, `final_passed`, `archived`
- `asset_type`: `tone`, `character`, `scene`, `prop`
- `variant_type`: `asset_image`, `keyframe_image`, `shot_video`, `voice_sample`, `audio_mix`, `final_cut`
- `severity`: `blocker`, `major`, `minor`
- `feedback_scope`: `character`, `scene`, `prop`, `tone`, `keyframe`, `video`, `voice`, `sfx`, `music`, `subtitle`, `composite`
- `anchor_type`: `asset`, `shot`, `timestamp`
- `review_decision`: `pass`, `reject`
- `priority_group`: `urgent_rejected`, `in_qc`, `new_pending`, `generating`

## 数据表

- `users`：用户身份与角色
- `projects`：顶层项目
- `series`：项目下的剧集系列
- `episodes`：系列下的单集
- `partner_scopes`：合作方在剧集/单集层面的可见范围
- `stage_tasks`：节点级任务及锁状态
- `assets`：节点1/2 的资产实体
- `shots`：单集镜头记录
- `variants`：资产/镜头/整集版本的候选产物（含 final_cut）
- `character_voice_bindings`：角色到音色基线的绑定
- `episode_versions`：单集版本演进
- `timelines`：版本在节点上的时间轴主记录
- `timeline_tracks`：时间轴轨道定义
- `timeline_clips`：轨道片段摆放
- `review_points`：时间戳/锚点审阅打点
- `review_decision_records`：通过/驳回决策记录
- `review_decision_points`：决策与打点关联
- `revision_logs`：自动/人工修订摘要日志
- `model_jobs`：模型异步任务台账（统一 `job_id`）
- `feedback_records`：结构化自然语言反馈
- `audit_logs`：操作审计日志
- `event_metrics`：分析埋点事实表

## 关键约束

- `episodes`: unique `(series_id, episode_no)`
- `shots`: unique `(episode_id, shot_no)`
- `stage_tasks`：对活跃状态使用部分唯一索引，约束每个 `(episode_id, stage_no)` 仅有一条活跃任务
- `variants`：`asset_id` / `shot_id` / `episode_version_id` 三者至少一个非空
- `variants.model_job_id`、`revision_logs.model_job_id`：外键指向 `model_jobs.job_id`
- `timeline_tracks`: unique `(timeline_id, track_type, track_order)`
- `timelines`: unique `(episode_version_id, stage_no)`
- `review_decision_points`: composite PK `(decision_id, point_id)`
- `model_jobs`: unique `job_id`

## 关键索引

- 任务排序：`idx_tasks_panel`
- 任务锁扫描：`idx_tasks_lock`
- 候选排序：`idx_variants_asset`、`idx_variants_shot`
- 整集版本候选检索：`idx_variants_episode_version_type`
- 模型产物追踪：`idx_variants_model_job`、`idx_revision_logs_model_job`
- 审阅查询：`idx_review_points_episode_version`、`idx_review_decision_episode`
- 模型任务查询：`idx_model_jobs_episode_stage`、`idx_model_jobs_status`
- 审计查询：`idx_audit_entity`、`idx_audit_actor`
- 埋点查询：`idx_event_metrics_event_time`、`idx_event_metrics_episode`
