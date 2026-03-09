# AIGC短剧生产线（MVP）— 审核工作流 · 数据结构设计

## 1. 设计目标与约束

- 面向 PostgreSQL 设计（MVP）。
- 兼容 4 节点审核流、3 角色权限、回炉归因、版本追溯、任务锁定并发。
- 支持页面直接渲染所需结构，减少前端拼装成本。
- 模型相关能力通过外部接口，数据库只存“任务状态 + 输入输出引用 + 审计轨迹”。

真相源约束：
- 本文档描述审核工作流消费层的数据结构与页面契约，不定义 core orchestrator 的系统级业务真相。
- 若与 core spec 中的 `EpisodeVersion`、`Run`、`NodeRun`、`ReviewTask`、`ReturnTicket` 等核心对象冲突，以 core spec 为准。
- `StageTask`、页面统计字段、聚合视图，可作为审核工作流的消费层投影或兼容结构存在，但不应反向定义核心编排状态机。

> 现网兼容说明：
> 当前线上数据库存在历史 ID 形态不一致的问题：`episodes.id`、`shots.id` 仍保留旧字符串主键形态，而审核域和版本域大量业务字段已经使用 UUID。
> 因此，本文档中部分 `episode_id`、`shot_id` 在业务上仍表示“引用该对象”，但当前线上未必已经补齐物理外键；后续待 ID 体系统一后再补强 FK。

---

## 2. 命名规范

- 主键统一：`id`（UUID）。
- 外键命名：`<entity>_id`。
- 时间字段：`created_at`、`updated_at`，业务时间另设（如 `deadline_at`）。
- 枚举字段统一使用 `snake_case` 文本枚举。
- 可扩展字段统一 `jsonb`，命名 `meta_json` 或 `payload_json`。

---

## 3. 枚举定义

## 3.1 角色与权限

- `user_role`
  - `qc`（质检员）
  - `platform_editor`（剪辑中台）
  - `partner_reviewer`（合作方）
  - `admin`（系统管理员）

## 3.2 节点与状态

- `stage_no`: `1 | 2 | 3 | 4`
- `stage_task_status`
  - `pending`
  - `in_progress`
  - `passed`
  - `rejected`
  - `generating`
  - `blocked`

- `episode_status`
  - `new`
  - `reviewing`
  - `generating`
  - `final_passed`
  - `archived`

## 3.3 内容与审阅

- `asset_type`
  - `tone`
  - `character`
  - `scene`
  - `prop`

- `variant_type`
  - `asset_image`
  - `keyframe_image`
  - `shot_video`
  - `voice_sample`
  - `audio_mix`
  - `final_cut`

- `severity`
  - `blocker`
  - `major`
  - `minor`

- `feedback_scope`
  - `character`
  - `scene`
  - `prop`
  - `tone`
  - `keyframe`
  - `video`
  - `voice`
  - `sfx`
  - `music`
  - `subtitle`
  - `composite`

- `anchor_type`
  - `asset`
  - `shot`
  - `timestamp`

- `review_decision`
  - `pass`
  - `reject`

- `attribution_stage`
  - `1`
  - `2`
  - `3`
  - `4`
  - `other`

## 3.4 任务优先级

- `priority_group`
  - `urgent_rejected`
  - `in_qc`
  - `new_pending`
  - `generating`

---

## 4. 核心关系（ER）

- `project` 1 - n `series`
- `series` 1 - n `episode`
- `episode` 1 - n `stage_task`（审核页面任务投影 / 兼容结构）
- `episode` 1 - n `shot`
- `episode` 1 - n `episode_version`
- `episode_version` 1 - n `timeline`
- `asset` 1 - n `variant`
- `shot` 1 - n `variant`
- `timeline` 1 - n `timeline_track`
- `timeline_track` 1 - n `timeline_clip`
- `episode` 1 - n `review_point`
- `episode` 1 - n `review_decision_record`
- `episode_version` 1 - n `revision_log`
- `*` 1 - n `audit_log`

---

## 5. 数据表设计（MVP 全量）

> 说明：
> 以下结构优先服务审核页面、审核任务流转、页面读写契约与审计追溯。
> 对于核心运行态、回炉链路、成本质量统计等系统级结构，请以 core spec 的数据结构设计为准。

### 5.0 字段注释基线（适用于 5.1 ~ 5.8 全部表）

- `id`：主键 UUID（除特殊声明如 `bigserial`）。
- `*_id`：外键引用，命名遵循“被引用实体 + _id”。
- `created_at`：记录创建时间（审计时间）。
- `updated_at`：记录最后一次业务更新时间。
- `status`：当前对象状态，枚举含义以所在表定义为准，不跨表混用。
- `meta_json`：弱结构化扩展字段，承载非关键约束信息。
- `payload_json`：过程快照/上下文字段，面向追溯与排障。

## 5.1 组织与身份

### 5.1.1 `users`
- `id uuid pk`
- `email text unique not null`
- `display_name text not null`
- `role user_role not null`
- `status text not null default 'active'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

索引：
- `idx_users_role(role)`

字段注释（增量）：
- `email`：账号唯一标识（建议统一小写存储）。
- `display_name`：界面展示名称，可与登录账号不同。
- `role`：角色权限边界来源字段（QC/中台/合作方/管理员）。
- `status`：账户可用状态（建议配套 active/disabled 等固定字典）。

### 5.1.2 `partner_scopes`（合作方可见范围）
- `id uuid pk`
- `user_id uuid fk -> users.id`
- `series_id uuid fk -> series.id`
- `episode_id uuid fk -> episodes.id null`
- `created_at timestamptz not null`

约束：
- `check (series_id is not null)`

字段注释（增量）：
- `user_id`：被授权的合作方用户。
- `series_id`：最小可见域锚点（至少到剧集级）。
- `episode_id`：可选细化到单集级可见范围；为空表示整剧集可见。

---

## 5.2 项目与剧集

### 5.2.1 `projects`
- `id uuid pk`
- `name text not null`
- `status text not null default 'active'`
- `meta_json jsonb not null default '{}'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

字段注释（增量）：
- `name`：项目名称（建议业务唯一，数据库可不强制）。
- `status`：项目生命周期状态（如 active/archived）。
- `meta_json`：项目级配置扩展（风格偏好、默认策略等）。

### 5.2.2 `series`
- `id uuid pk`
- `project_id uuid fk -> projects.id`
- `name text not null`
- `genre text`
- `planned_episode_count int not null default 0`
- `status text not null default 'active'`
- `meta_json jsonb not null default '{}'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

索引：
- `idx_series_project(project_id)`

字段注释（增量）：
- `project_id`：所属项目，支持同项目下多部剧集并行。
- `genre`：题材标签，用于筛选和策略分配。
- `planned_episode_count`：计划集数（用于产能和进度对照）。

### 5.2.3 `episodes`
- `id uuid pk`
- `series_id uuid fk -> series.id`
- `episode_no int not null`
- `title text`
- `estimated_duration_sec int not null default 0`
- `status episode_status not null default 'new'`
- `current_stage smallint not null default 1`
- `current_version_id uuid null`（后续外键到 `episode_versions.id`）
- `due_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

约束：
- `unique(series_id, episode_no)`
- `check (current_stage between 1 and 4)`

索引：
- `idx_episodes_series(series_id)`
- `idx_episodes_status(status, due_at)`

字段注释（增量）：
- `episode_no`：集号，剧集内唯一。
- `estimated_duration_sec`：预计片长（秒），用于排产与目标对照。
- `current_stage`：当前流程节点（1~4），用于任务路由。
- `current_version_id`：当前生效版本引用（延后外键绑定）。
- `due_at`：该集期望完成时间，用于超期预警。

---

## 5.3 任务与锁

> 迁移说明：
> 旧版 `stage_tasks` 继续保留，用于兼容首页任务面板、旧式“一阶段一任务”接口和已存在的审核页面假设。
> 新版 `review_tasks` 将作为更细粒度的人工审核主模型逐步接入，用于支持 `Stage2` shot 级任务和 `Stage4` 串行步骤任务。
> 过渡期两张表并存：`stage_tasks` 负责兼容任务池，`review_tasks` 负责新版审核任务事实。

### 5.3.1 `stage_tasks`
- `id uuid pk`
- `episode_id uuid fk -> episodes.id`
- `stage_no smallint not null`
- `status stage_task_status not null default 'pending'`
- `priority_group priority_group not null default 'new_pending'`
- `priority_score numeric(8,2) not null default 0`
- `deadline_at timestamptz null`
- `source_reason text null`（如 partner_reject / upstream_return）
- `assigned_user_id uuid null fk -> users.id`
- `locked_by uuid null fk -> users.id`
- `locked_at timestamptz null`
- `lock_expire_at timestamptz null`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `reject_count int not null default 0`
- `payload_json jsonb not null default '{}'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

约束：
- `check (stage_no between 1 and 4)`

关键约束（推荐 partial unique）：
- 同一集同一节点仅允许一个活跃任务（`status in ('pending','in_progress','generating','blocked')`）。

索引：
- `idx_tasks_panel(priority_group, deadline_at, priority_score desc, created_at)`
- `idx_tasks_lock(status, lock_expire_at)`
- `idx_tasks_episode_stage(episode_id, stage_no)`

字段注释（增量）：
- `stage_no`：任务所属流程节点。
- `priority_group`：看板分桶键（急单/质检中/新任务/生成中）。
- `priority_score`：分桶内排序分值。
- `deadline_at`：任务级截止时间（可为空）。
- `source_reason`：任务来源原因（上游驳回、合作方驳回等）。
- `assigned_user_id`：当前责任人（可空，支持待领取）。
- `locked_by / locked_at / lock_expire_at`：并发占用锁三元组，避免重复处理。
- `started_at / completed_at`：处理起止时间，用于效率统计。
- `reject_count`：节点累计驳回次数。

兼容说明：
- 本表适合表达“阶段级任务池”，不适合继续承接 `Stage2` 一集多 shot 任务或 `Stage4` 多步骤串行任务。
- 若新版审核任务已拆分为多条 `review_tasks`，可通过接口层做映射/聚合回投到本表。

### 5.3.2 `review_tasks`（新版审核任务主模型，过渡期新增）
- `id uuid pk`
- `episode_id uuid`（业务引用；当前线上暂不加物理 FK）
- `episode_version_id uuid fk -> episode_versions.id`
- `stage_no smallint not null`
- `gate_node_id text not null`
- `review_step_no smallint not null default 1`
- `reviewer_role text not null`
- `review_granularity text not null`
- `anchor_type anchor_type null`
- `anchor_id uuid null`
- `status text not null default 'pending'`（pending|in_progress|approved|returned|skipped）
- `assignee_id uuid null fk -> users.id`
- `due_at timestamptz null`
- `priority text not null default 'normal'`
- `openclaw_session_id text null`
- `payload_json jsonb not null default '{}'`
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `decision text null`（approve|return）
- `decision_comment text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

约束：
- `check (stage_no between 1 and 4)`
- 同一版本下，同一 Gate、同一步骤、同一锚点任务不重复。

索引：
- `idx_review_tasks_assignee_status(assignee_id, status, due_at)`
- `idx_review_tasks_version_stage(episode_version_id, stage_no, review_step_no)`
- `idx_review_tasks_role(reviewer_role, status)`
- `idx_review_tasks_anchor(anchor_type, anchor_id)`

字段注释（增量）：
- `episode_id / episode_version_id`：审核任务归属的集与具体版本；一个版本内可同时存在多条审核任务。当前线上对 `episode_id` 先保留业务引用，不强行加 FK。
- `stage_no`：审核关卡编号（1~4），用于页面路由和权限过滤。
- `gate_node_id`：内部审核节点标识，用于与主管线编排对齐。
- `review_step_no`：同一 Gate 内的步骤序号；`Stage4` 串行审核依赖该字段推进。
- `reviewer_role`：当前任务属于哪个审核角色（质检员/中台/合作方）。
- `review_granularity`：当前任务审核粒度（asset/shot/episode）。
- `anchor_type / anchor_id`：若任务针对某个资产或 shot，用来定位具体审核对象。
- `status`：新版审核任务状态机；`skipped` 主要用于 `Stage4` 可跳过步骤。
- `assignee_id`：实际领取任务的审核员；为空表示仍在审核池中。
- `due_at`：审核任务截止时间，用于任务池排序和超期提醒。
- `priority`：新版审核任务内部优先级，可与旧 `priority_group` 并存。
- `openclaw_session_id`：OpenClaw 会话 ID，用于绑定聊天和时间轴交互上下文。
- `payload_json`：页面渲染所需的脱敏任务上下文。
- `started_at / finished_at`：审核真实起止时间，用于效率统计。
- `decision / decision_comment`：当前任务的最终决策和备注，建议由统一接口写入。

---

## 5.4 资产与候选（节点1/2）

### 5.4.1 `assets`
- `id uuid pk`
- `series_id uuid fk -> series.id`
- `episode_id uuid null fk -> episodes.id`
- `asset_type asset_type not null`
- `name text not null`
- `description text null`
- `is_required boolean not null default true`
- `selected_variant_id uuid null`
- `round_no int not null default 1`
- `meta_json jsonb not null default '{}'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

索引：
- `idx_assets_series_type(series_id, asset_type)`

字段注释（增量）：
- `episode_id`：为空表示剧集级公共资产；不为空表示集级资产。
- `asset_type`：资产类型（人设/场景/道具/风格等）。
- `is_required`：是否为当前生产必选资产。
- `selected_variant_id`：当前选定候选版本。
- `round_no`：资产在当前节点的迭代轮次。

### 5.4.2 `shots`
- `id uuid pk`
- `episode_id uuid fk -> episodes.id`
- `shot_no int not null`
- `name text null`
- `script_excerpt text null`
- `status text not null default 'pending'`（pending|attention|passed|rejected）
- `risk_level text not null default 'normal'`（normal|attention）
- `default_keyframe_variant_id uuid null`
- `default_video_variant_id uuid null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

约束：
- `unique(episode_id, shot_no)`

索引：
- `idx_shots_episode(episode_id, shot_no)`

字段注释（增量）：
- `shot_no`：镜头号，集内唯一。
- `script_excerpt`：脚本片段，供镜头意图对照。
- `status`：镜头处理状态（局部状态，不等同整集状态）。
- `risk_level`：镜头风险等级（用于提醒优先处理）。
- `default_keyframe_variant_id`：默认关键帧候选。
- `default_video_variant_id`：默认视频候选。

### 5.4.3 `variants`
- `id uuid pk`
- `series_id uuid fk -> series.id`
- `episode_id uuid fk -> episodes.id`
- `asset_id uuid null fk -> assets.id`
- `shot_id uuid null fk -> shots.id`
- `episode_version_id uuid null fk -> episode_versions.id`
- `variant_type variant_type not null`
- `round_no int not null default 1`
- `candidate_no int not null default 1`（同轮第几版）
- `score numeric(4,2) null`
- `model_provider text null`
- `model_name text null`
- `prompt_text text null`
- `negative_prompt_text text null`
- `duration_sec int null`
- `resource_url text not null`
- `preview_url text null`
- `is_default boolean not null default false`
- `meta_json jsonb not null default '{}'`
- `created_by_source text not null default 'agent'`
- `created_at timestamptz not null`

约束：
- `check (asset_id is not null or shot_id is not null or episode_version_id is not null)`
- `check (score is null or (score >= 0 and score <= 10))`

索引：
- `idx_variants_asset(asset_id, round_no, score desc)`
- `idx_variants_shot(shot_id, round_no, score desc)`
- `idx_variants_episode_type(episode_id, variant_type)`
- `idx_variants_episode_version_type(episode_version_id, variant_type)`

字段注释（增量）：
- `asset_id / shot_id / episode_version_id`：候选挂载锚点（资产/镜头/整集版本），至少其一非空。
- `variant_type`：候选内容类型（图像/视频/音频/成片等）。
- `round_no`：生成迭代轮次。
- `candidate_no`：同轮内候选序号。
- `score`：质量评分（0~10），用于排序参考。
- `model_provider / model_name`：模型来源与型号，便于质量归因。
- `prompt_text / negative_prompt_text`：生成提示词与反向约束。
- `duration_sec`：素材时长（秒），用于时间轴装配。
- `resource_url`：主资源地址；`preview_url` 为轻量预览。
- `is_default`：当前作用域默认候选标记。
- `created_by_source`：候选来源（agent/人工/系统）。

### 5.4.4 `character_voice_bindings`（节点1音色确认）
- `id uuid pk`
- `series_id uuid fk -> series.id`
- `character_name text not null`
- `voice_variant_id uuid fk -> variants.id`
- `is_baseline boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

约束：
- `unique(series_id, character_name)`

字段注释（增量）：
- `character_name`：角色名（剧集域内唯一绑定键）。
- `voice_variant_id`：角色绑定的基准音色候选。
- `is_baseline`：是否为默认基线音色（通常 true）。

---

## 5.5 时间轴与音视频整合（节点2/3）

### 5.5.1 `episode_versions`
- `id uuid pk`
- `episode_id uuid fk -> episodes.id`
- `version_no int not null`（1,2,3...）
- `source_stage smallint not null`
- `status text not null default 'active'`（active|readonly|rolled_back）
- `summary_text text null`
- `created_by_source text not null default 'agent'`
- `created_at timestamptz not null`

约束：
- `unique(episode_id, version_no)`

索引：
- `idx_episode_versions_episode(episode_id, version_no desc)`

字段注释（增量）：
- `version_no`：集级版本号（1,2,3...）。
- `source_stage`：该版本最初生成来源节点。
- `status`：版本状态（active/readonly/rolled_back）。
- `summary_text`：版本摘要，便于列表快速理解变化。
- `created_by_source`：版本创建来源（agent/人工/系统）。

### 5.5.2 `timelines`
- `id uuid pk`
- `episode_id uuid fk -> episodes.id`
- `episode_version_id uuid fk -> episode_versions.id`
- `stage_no smallint not null`（2 或 3）
- `duration_sec int not null`
- `timeline_revision bigint not null default 1`
- `last_edited_by uuid null fk -> users.id`
- `meta_json jsonb not null default '{}'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

约束：
- `unique(episode_version_id, stage_no)`

字段注释（增量）：
- `episode_version_id`：对应版本的时间轴主记录。
- `stage_no`：节点语义（2=分镜拼接，3=音视频整合）。
- `duration_sec`：该版本在该节点的总时长。
- `timeline_revision`：时间轴乐观并发版本号；每次成功编辑 +1。
- `last_edited_by`：最近一次提交编辑的用户，便于冲突提示与审计展示。

### 5.5.3 `timeline_tracks`
- `id uuid pk`
- `timeline_id uuid fk -> timelines.id`
- `track_type text not null`（video|keyframe|voice|sfx|music）
- `track_order int not null`
- `name text not null`
- `mute boolean not null default false`
- `solo boolean not null default false`
- `meta_json jsonb not null default '{}'`

约束：
- `unique(timeline_id, track_type, track_order)`

字段注释（增量）：
- `track_type`：轨道类型（video/keyframe/voice/sfx/music）。
- `track_order`：同类型轨道顺序（多轨并存时使用）。
- `mute / solo`：编辑期监听控制，不改变源素材。

### 5.5.4 `timeline_clips`
- `id uuid pk`
- `track_id uuid fk -> timeline_tracks.id`
- `source_variant_id uuid fk -> variants.id`
- `start_sec numeric(10,3) not null`
- `end_sec numeric(10,3) not null`
- `offset_sec numeric(10,3) not null default 0`
- `volume numeric(4,2) not null default 1.0`
- `fade_in_sec numeric(6,3) not null default 0`
- `fade_out_sec numeric(6,3) not null default 0`
- `z_index int not null default 0`
- `is_deleted boolean not null default false`
- `meta_json jsonb not null default '{}'`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

约束：
- `check (end_sec > start_sec)`
- `check (volume >= 0 and volume <= 2)`

索引：
- `idx_timeline_clips_track_time(track_id, start_sec, end_sec)`

字段注释（增量）：
- `source_variant_id`：片段来源候选。
- `start_sec / end_sec`：片段在时间轴上的摆放区间。
- `offset_sec`：从源素材内部偏移开始取样。
- `volume`：片段音量增益（0~2）。
- `fade_in_sec / fade_out_sec`：入/出淡时长。
- `z_index`：重叠时显示层级（可视轨道生效）。
- `is_deleted`：软删除标记，保留历史可追溯性。
- 业务约束（MVP）：节点3仅支持轻量命令（move/trim/replace/volume/fade/delete），不支持复杂剪辑语义（如 ripple edit、跨轨批量吸附）。

---

## 5.6 审阅、打回归因、修订（节点4核心）

### 5.6.1 `review_points`
- `id uuid pk`
- `review_task_id uuid null fk -> review_tasks.id`
- `episode_id uuid fk -> episodes.id`
- `episode_version_id uuid fk -> episode_versions.id`
- `stage_no smallint not null`
- `timecode_sec numeric(10,3) null`
- `timestamp_ms bigint null`
- `scope feedback_scope not null`
- `issue_type text null`
- `severity severity not null default 'major'`
- `attribution_stage text not null`（1|2|3|4|other）
- `anchor_type anchor_type not null`
- `anchor_id uuid null`
- `note text not null`
- `comment text null`
- `screenshot_url text null`
- `created_by uuid fk -> users.id`
- `created_at timestamptz not null`

约束：
- `check (stage_no between 1 and 4)`
- `check ((anchor_type = 'timestamp' and timecode_sec is not null) or anchor_type in ('asset','shot'))`

索引：
- `idx_review_points_episode_version(episode_id, episode_version_id, created_at desc)`
- `idx_review_points_attr(attribution_stage, severity)`

字段注释（增量）：
- `review_task_id`：若问题点来自新版审核任务，则绑定对应 `review_tasks.id`；为空时表示旧链路兼容数据。
- `stage_no`：问题被提出时所在节点。
- `timecode_sec`：时间码锚点（当 `anchor_type='timestamp'` 时必填）。
- `timestamp_ms`：毫秒级时间码，新版播放器和时间轴优先使用该字段。
- `scope`：问题领域（角色/场景/视频/字幕等）。
- `issue_type`：结构化问题类型，供回炉归因和最小重跑规则使用。
- `severity`：严重度（blocker/major/minor）。
- `attribution_stage`：根因归属节点（1~4/other）。
- `anchor_type / anchor_id`：问题锚点类型与对象 ID。
- `note`：问题描述与整改意见原文。
- `comment`：标准化评论字段；过渡期可与 `note` 双写。
- `screenshot_url`：问题截图或帧快照地址，用于审核复现。

### 5.6.2 `review_decision_records`
- `id uuid pk`
- `review_task_id uuid null fk -> review_tasks.id`
- `episode_id uuid fk -> episodes.id`
- `episode_version_id uuid fk -> episode_versions.id`
- `stage_no smallint not null`
- `gate_node_id text null`
- `review_step_no smallint null`
- `reviewer_role user_role not null`
- `review_granularity text null`
- `anchor_type anchor_type null`
- `anchor_id uuid null`
- `decision review_decision not null`
- `note text null`
- `decision_comment text null`
- `point_count int not null default 0`
- `is_skipped boolean not null default false`
- `openclaw_session_id text null`
- `created_by uuid fk -> users.id`
- `created_at timestamptz not null`

索引：
- `idx_review_decision_episode(episode_id, stage_no, created_at desc)`

字段注释（增量）：
- `review_task_id`：若决策来自新版审核任务，则绑定具体任务；为空表示旧版阶段级决策。
- `gate_node_id`：内部 Gate 节点标识，用于和主管线步骤推进对齐。
- `review_step_no`：同一 Gate 内的步骤号；`Stage4` 串行审核依赖该字段。
- `reviewer_role`：决策发起角色，用于权限审计。
- `review_granularity`：本次决策作用粒度（asset/shot/episode）。
- `anchor_type / anchor_id`：当决策针对某个 shot 或资产时，定位具体对象。
- `decision`：决策结果（pass/reject）。
- `note`：本次决策备注（可空）。
- `decision_comment`：新版任务接口中的标准决策备注字段；过渡期与 `note` 并存。
- `point_count`：该次决策关联问题数快照。
- `is_skipped`：当前步骤是否被跳过；主要用于 `Stage4` 可选审核步骤。
- `openclaw_session_id`：对应 OpenClaw 会话 ID。

### 5.6.3 `review_decision_points`（决策与打点关联）
- `decision_id uuid fk -> review_decision_records.id`
- `point_id uuid fk -> review_points.id`
- `created_at timestamptz not null`

主键：
- `pk(decision_id, point_id)`

字段注释（增量）：
- `decision_id`：决策主记录。
- `point_id`：被该决策引用的问题点。

### 5.6.4 `revision_logs`
- `id uuid pk`
- `episode_id uuid fk -> episodes.id`
- `episode_version_id uuid fk -> episode_versions.id`
- `trigger_decision_id uuid null fk -> review_decision_records.id`
- `return_ticket_id uuid null`
- `source_stage smallint not null`
- `change_type text not null`
- `summary_text text not null`
- `payload_json jsonb not null default '{}'`
- `node_scope_json jsonb not null default '{}'`
- `created_at timestamptz not null`

索引：
- `idx_revision_logs_episode(episode_id, created_at desc)`

字段注释（增量）：
- `trigger_decision_id`：触发本次修订的决策记录（可空）。
- `return_ticket_id`：若本次修订来自新版回炉链路，则关联对应打回单。
- `source_stage`：修订发起节点。
- `change_type`：修订类型标签（建议固定字典）。
- `summary_text`：面向协作的修订摘要。
- `payload_json`：结构化修订内容明细。
- `node_scope_json`：本次修订涉及的节点/镜头/时间段范围，便于复盘和展示。

---

## 5.7 自然语言反馈结构化（全节点统一）

### 5.7.1 `feedback_records`
- `id uuid pk`
- `review_task_id uuid null fk -> review_tasks.id`
- `return_ticket_id uuid null`
- `episode_id uuid fk -> episodes.id`
- `stage_no smallint not null`
- `scope feedback_scope not null`
- `issue_type text null`
- `severity severity not null`
- `anchor_type anchor_type not null`
- `anchor_id uuid null`
- `note text not null`
- `comment text null`
- `raw_text text not null`
- `parsed_json jsonb not null default '{}'`
- `created_by uuid fk -> users.id`
- `created_at timestamptz not null`

索引：
- `idx_feedback_stage(episode_id, stage_no, created_at desc)`

字段注释（增量）：
- `review_task_id`：若反馈在新版审核任务中产生，则绑定对应任务。
- `return_ticket_id`：若该反馈最终沉淀为正式打回单，可回填对应 ticket。
- `raw_text`：原始自然语言反馈。
- `parsed_json`：结构化解析结果（实体/范围/建议动作等）。
- `scope / severity`：解析后的业务分类标签。
- `issue_type`：结构化问题类型，与主管线 RCA 规则对齐。
- `anchor_type / anchor_id`：反馈锚点定位。
- `comment`：标准化反馈文本字段，供新版任务接口统一消费。

---

## 5.8 审计与埋点

### 5.8.1 `audit_logs`
- `id uuid pk`
- `trace_id text not null`
- `actor_id uuid null fk -> users.id`
- `actor_role user_role null`
- `entity_type text not null`
- `entity_id uuid not null`
- `action text not null`
- `before_json jsonb null`
- `after_json jsonb null`
- `ip text null`
- `user_agent text null`
- `created_at timestamptz not null`

索引：
- `idx_audit_entity(entity_type, entity_id, created_at desc)`
- `idx_audit_actor(actor_id, created_at desc)`

字段注释（增量）：
- `trace_id`：跨服务链路追踪 ID。
- `entity_type / entity_id`：被操作对象类型与对象主键。
- `action`：审计动作名（建议稳定字典）。
- `before_json / after_json`：变更前后快照。
- `actor_id / actor_role`：操作者身份信息（允许系统动作为空）。
- 时间轴推荐动作字典：`timeline.move_clip`、`timeline.trim_clip`、`timeline.replace_clip`、`timeline.set_volume`、`timeline.set_fade`、`timeline.delete_clip`、`timeline.conflict_rejected`。

### 5.8.2 `event_metrics`（分析埋点）
- `id bigserial pk`
- `event_name text not null`
- `series_id uuid null`
- `episode_id uuid null`
- `stage_no smallint null`
- `task_id uuid null`
- `actor_id uuid null`
- `payload_json jsonb not null default '{}'`
- `occurred_at timestamptz not null`

索引：
- `idx_event_metrics_event_time(event_name, occurred_at desc)`
- `idx_event_metrics_episode(episode_id, occurred_at desc)`

字段注释（增量）：
- `event_name`：埋点事件名（建议 `domain.action.result` 风格）。
- `stage_no / task_id / actor_id`：事件关联上下文。
- `payload_json`：扩展埋点维度。
- `occurred_at`：事件实际发生时间（业务时间）。

### 5.8.3 `model_jobs`（模型任务台账）
- `id uuid pk`
- `job_id text unique not null`
- `request_id text null`
- `job_type text not null`
- `episode_id uuid null fk -> episodes.id`
- `stage_no smallint null`
- `status text not null`（queued|running|succeeded|failed|cancelled）
- `provider text null`
- `callback_url text null`
- `request_payload jsonb not null default '{}'`
- `result_payload jsonb null`
- `error_payload jsonb null`
- `queued_at timestamptz not null`
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

索引：
- `idx_model_jobs_episode_stage(episode_id, stage_no, created_at desc)`
- `idx_model_jobs_status(status, created_at desc)`

字段注释（增量）：
- `job_id`：模型网关返回的全局任务 ID（对接主键）。
- `request_payload/result_payload/error_payload`：请求入参、成功结果与错误详情快照。
- `status`：模型任务状态机，支持补偿查询与重试决策。

## 5.9 协作注释（字段语义速查）

> 本节用于多人协作时统一字段语义理解，避免“同名不同义”或“只看字面误解业务”。
> 原字段定义以各表结构为准，本节仅补充业务解释。

### 5.9.1 通用字段（跨表）

- `status`：当前业务状态；不同表的可选值不同，不可跨表直接对比。
- `stage_no`：审核流程节点号（1~4），表示“流程位置”，不是版本号。
- `round_no`：同一节点内的重试/迭代轮次；通常由打回后递增。
- `version_no`：集级内容版本号（`episode_versions`），用于跨节点追溯版本演进。
- `meta_json`：预留扩展字段，存放弱结构化补充信息；不承载关键约束字段。
- `payload_json`：事件/变更/任务上下文快照，偏“过程记录”；可用于排障和审计还原。
- `created_by_source`：产出来源（如 `agent`/人工/系统任务），用于区分自动与人工操作链路。

### 5.9.2 任务与并发相关

- `stage_tasks.priority_group`：首页任务分组键，用于看板分桶与排序优先级，不等同于业务紧急程度本身。
- `stage_tasks.priority_score`：同分组内细粒度排序分值，数值越高越优先。
- `stage_tasks.source_reason`：任务来源原因（如上游打回、合作方驳回），用于解释“为什么进入当前任务池”。
- `stage_tasks.locked_by`：当前持有任务锁的用户；为空表示未被占用。
- `stage_tasks.lock_expire_at`：锁过期时间，超时后允许其他用户重新领取，避免任务长期僵死。
- `stage_tasks.reject_count`：该节点累计被驳回次数，用于风险识别和效率分析。
- `review_tasks.id`：新版人工审核任务唯一主键；后续通过/打回/打点都应尽量基于该 ID。
- `review_tasks.review_step_no`：同一 Gate 内的步骤号，让 `Stage4` 串行审核可以显式建模。
- `review_tasks.review_granularity`：审核粒度标记，决定当前任务对应资产、镜头还是整集级交互。
- `review_tasks.anchor_type/anchor_id`：新版审核任务锚点；任务被拆到 shot 或 asset 级时依赖它定位对象。
- `review_tasks.status`：新版审核任务状态，语义不同于旧 `stage_tasks.status`，不应混用。

### 5.9.3 资产、镜头与候选相关

- `assets.is_required`：是否为当前生产必备资产；`false` 表示可选增强项。
- `assets.selected_variant_id`：资产当前被选中的候选版本，指向 `variants.id`。
- `shots.status`：镜头处理状态（局部状态），不代表整集审核状态。
- `shots.risk_level`：镜头风险等级，用于提示优先处理，不直接驱动流程流转。
- `variants.candidate_no`：同轮内候选序号，便于比较同批次多个结果。
- `variants.score`：候选质量评分（0~10），用于筛选与排序，不直接代表最终通过。
- `variants.resource_url`：原始资源地址（主引用）；`preview_url` 用于轻量预览。
- `variants.is_default`：当前上下文默认候选标记；通常同一作用域仅应存在一个默认项。

### 5.9.4 时间轴与版本相关

- `episode_versions.source_stage`：该版本最初生成自哪个节点，便于回溯版本来源责任域。
- `episode_versions.status`：版本生命周期状态；`readonly` 常用于冻结历史版本防误改。
- `timelines.stage_no`：时间轴所属节点（2/3），用于区分“分镜拼接”与“音视频整合”阶段数据。
- `timeline_tracks.track_type`：轨道类型语义标签（video/voice/music 等），决定前端渲染和编辑能力。
- `timeline_clips.offset_sec`：素材内偏移起点；配合 `start_sec/end_sec` 决定剪辑片段映射关系。
- `timeline_clips.z_index`：同时间区间重叠时的视觉层级（仅对可视轨道显著）。
- `timeline_clips.is_deleted`：软删除标记；为审计可追溯保留历史剪辑记录。

### 5.9.5 审阅、归因与修订相关

- `review_points.scope`：问题归属范围（角色/场景/音频/字幕等），用于聚合统计与责任分发。
- `review_points.severity`：问题严重度（blocker/major/minor），用于是否阻断提交流程。
- `review_points.attribution_stage`：问题根因归属节点（1~4/other），用于回炉路径和质量复盘。
- `review_points.anchor_type + anchor_id/timecode_sec`：问题锚点；可锚定资产、镜头或具体时间码。
- `review_decision_records.point_count`：本次决策关联的问题数量快照，便于列表快速展示。
- `revision_logs.trigger_decision_id`：触发本次修订的决策记录来源；为空表示系统或其他非决策触发。
- `revision_logs.change_type`：修订类型标签（建议固定字典），用于后续统计“改动结构”。

### 5.9.6 反馈结构化与审计相关

- `feedback_records.raw_text`：用户原始自然语言输入，保留原文用于追溯。
- `feedback_records.parsed_json`：结构化解析结果（实体、情绪、范围、建议动作等）供系统消费。
- `audit_logs.trace_id`：跨服务链路追踪 ID，用于串联一次完整操作的审计事件。
- `audit_logs.before_json/after_json`：变更前后快照；仅记录必要字段以控制体积。
- `event_metrics.event_name`：埋点事件名，建议采用稳定命名规范（如 `domain.action.result`）。
- `event_metrics.occurred_at`：事件发生时间（业务时间），不等同于入库时间。

---

## 6. 首页任务面板查询视图（建议）

建议创建物化视图或查询视图：`v_task_panel_items`

字段建议：
- `task_id`, `episode_id`, `series_id`, `series_name`, `episode_no`
- `priority_group`, `deadline_at`, `created_at`
- `stage_no`, `stage_label`, `status`
- `is_urgent`
- `qc_progress_done`, `qc_progress_total`
- `platform_progress_done`, `platform_progress_total`
- `partner_progress_done`, `partner_progress_total`
- `action_type`（handle/continue）
- `is_locked`, `locked_by_name`, `lock_expire_at`

排序实现：
1) `priority_group` 固定映射排序值  
2) `deadline_at asc nulls last`  
3) `partner_reject first`（可映射到 `source_reason`）  
4) `remaining_episode_count asc`  
5) `created_at asc`

---

## 7. 节点页面 DTO（前后端契约）

## 7.1 首页 `TaskPanelResponse`

```json
{
  "summary": {
    "pendingSeries": 9,
    "pendingEpisodes": 289,
    "overdueCount": 2,
    "generatingCount": 2
  },
  "groups": [
    { "group": "urgent_rejected", "count": 3 },
    { "group": "in_qc", "count": 2 },
    { "group": "new_pending", "count": 2 },
    { "group": "generating", "count": 2 }
  ],
  "items": []
}
```

## 7.2 节点1 `Stage1DetailResponse`

```json
{
  "workflowSteps": [],
  "leftNav": [],
  "assets": [],
  "voiceBaselines": [],
  "taskLock": {}
}
```

## 7.3 节点2 `Stage2DetailResponse`

```json
{
  "workflowSteps": [],
  "shotStats": { "total": 0, "passed": 0, "needFix": 0, "pending": 0 },
  "shotList": [],
  "timeline": {},
  "candidatePanel": {},
  "taskLock": {}
}
```

## 7.4 节点3 `Stage3DetailResponse`

```json
{
  "workflowSteps": [],
  "library": { "voice": [], "sfx": [], "music": [] },
  "timeline": {},
  "selectedClipProps": {},
  "autoHints": [],
  "taskLock": {}
}
```

## 7.5 节点4 `Stage4DetailResponse`

```json
{
  "workflowSteps": [],
  "player": {},
  "revisionLogs": [],
  "versionCards": [],
  "reviewPoints": [],
  "episodeCards": [],
  "auditChain": {},
  "taskLock": {}
}
```

---

## 8. 最小迁移批次（建议）

- `M1`: 枚举 + `users/projects/series/episodes/stage_tasks`
- `M2`: `assets/shots/variants/character_voice_bindings`
- `M3`: `episode_versions/timelines/timeline_tracks/timeline_clips`
- `M4`: `review_tasks` + `review_points/review_decision_records/review_decision_points/revision_logs`
- `M5`: `feedback_records/audit_logs/event_metrics` + 关键索引

---

## 9. T1 完成定义（数据结构视角）

- 所有表可迁移成功，外键与唯一约束生效。
- 可以完整表达：任务领取锁定、4 节点流转、打回归因、版本生成、修订追溯。
- 首页任务面板查询可返回与设计稿一致的卡片信息。
- 节点1/2/3/4 的详情接口 DTO 均有稳定 schema。
- 审计与埋点可覆盖“处理/继续、通过、驳回、回炉、回滚”。
