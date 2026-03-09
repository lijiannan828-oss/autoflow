# AIGC短剧生产线（MVP）— 审核工作流 · 设计文档

## 文档信息

- **产品名称**：AIGC短剧生产线（MVP）— 审核工作流
- **版本**：V1.0
- **依赖**：requirements.md

---

## 1. 架构概览

### 1.1 系统边界

```
[ 上游 Agent 管线 ] → [ 审核工作流系统 ] → [ 回炉/重生成接口 ]
    剧本→资产→关键帧/视频→视听整合→成片
         ↓ 仅 4 个节点人工介入
    节点1 → 节点2 → 节点3 → 节点4
         ↑______________打回归因与回炉______________|
```

- 前端：任务面板 + 4 个审核页面（对应 4 节点）。
- 后端：任务/版本/审阅/锁定/归因 API；与现有 Agent 接口、数据库对接。
- 外部：调「调好的接口」完成模型相关能力（节点2 等）；节点1 右侧自然语言、配音音色、节点4 修订总结等调接口即可。

边界约束：
- 本设计是审核消费层设计，不定义编排、运行态、回炉、成本、质量、吞吐等系统级真相。
- 页面所见任务、阶段、版本、打回与修订信息，均应由 core orchestrator truth objects 派生。
- 如 `StageTask` 与 core 中的 `ReviewTask / EpisodeVersion / Run / NodeRun` 发生语义冲突，以 core spec 为准，本设计只保留页面态表达。

### 1.2 技术选型（建议）

- 前端：按现有项目技术栈（如 React/Vue）；多轨时间轴可采用现成编辑器或轻量自绘。
- 后端：REST/内部 RPC；任务状态机、锁定、版本号在服务端维护。
- 数据：Project/Episode/StageTask/Asset/Variant/Shot/Timeline/ReviewPoint/ReviewDecision/RevisionLog/AuditLog 持久化；MVP 最小集合见 requirements。

推荐实现方式：
- 审核页面优先通过 `Review Gateway` / BFF 读取 DTO，而不是直接假设底层表结构。
- 页面层允许保留 `StageTask` 等聚合概念，但这些概念应是消费层投影，不是核心真相源。

---

## 2. 数据模型与状态

### 2.1 核心实体

- **Project / Series**  
  - 字段建议：id, name, created_at, 统计缓存（待审剧数、待审集数等）。

- **Episode**  
  - 字段建议：id, series_id, index, duration_estimate, status（draft | stage_1..4 | generating | done）, 当前版本号 current_version_id。

- **StageTask**  
  - 字段建议：id, episode_id, stage (1|2|3|4), status (pending | in_progress | passed | rejected), locked_by, locked_at, 优先级/截止时间等用于排序。

- **Asset**  
  - 字段建议：id, episode_id 或 series_id, type (人物|场景|道具|影调), 定稿 variant_id, 与剧本/角色关联外键。

- **Variant**  
  - 字段建议：id, asset_id 或 shot_id, version_label (v1/r2/r3), score, 存储路径或 URL, 元数据（模型、参数等）。

- **Shot**  
  - 字段建议：id, episode_id, index, 关键帧 variant、视频 variant、时间轴位置、通过/待修改/待审核状态。

- **Timeline**  
  - 节点2：分镜块序列 + 每块选用 variant；节点3：多轨（配音/音效/音乐）片段列表，每片段起止、音量、淡入淡出。

- **ReviewPoint**  
  - 字段建议：id, episode_id, timecode_sec, note, stage_attribution (2|3|4|other), 创建人、创建时间。

- **ReviewDecision**  
  - 字段建议：id, episode_id, stage, decision (pass | reject), note, 审阅人、时间、关联 ReviewPoint 列表。

- **RevisionLog**  
  - 字段建议：id, episode_id, version_id, summary_text（Agent 总结）, 变更类型（重生成资产/调整音乐等）、创建时间。

- **AuditLog**  
  - 操作审计：谁、何时、对哪集/哪任务、做了什么（领取、通过、打回、定稿等）。

### 2.2 任务与节点状态机（简化）

- **StageTask.status**：pending → in_progress（锁定）→ passed | rejected；rejected 后由归因接口决定回到哪一 stage，生成新 StageTask 或重入当前 stage。
- **Episode 维度**：按当前各 stage 的 StageTask 聚合出「本集在节点几、是否通过、是否生成中」。
- **锁定**：同一 StageTask 仅允许一个 in_progress 且 locked_by 为用户；超时则自动释放（可配置 30 分钟）。

约束说明：
- 上述状态机用于审核页面表达，不应覆盖 core orchestrator 的状态机定义。
- 实现时如 core 已提供 `ReviewTask`、Stage 聚合与版本状态，应优先从 core 派生本节页面态，而不是重复维护两套真相。

### 2.3 自然语言反馈结构化（全节点统一）

- 存储结构：scope, severity, anchor, note（见 requirements US-30）。
- 提交后：调后端/Agent 接口生成重生成任务或修订；节点1 按资产类别、节点2 按关键帧/视频范围、节点3/4 按归属 stage。

---

## 3. API 设计要点

### 3.1 任务面板

- `GET /api/tasks/panel`  
  - 返回：分组（紧急驳回/质检中/新剧待检/生成中）、全局摘要、任务卡片列表（已按优先级排序）。  
  - 排序逻辑与 requirements 4.1/US-5 一致（写死 MVP）。

- `POST /api/tasks/:taskId/claim`  
  - 领取/继续：将 StageTask 置为 in_progress、locked_by 当前用户、locked_at 当前时间；若已被锁则返回 409 与占用者信息。

### 3.2 节点 1（美术资产）

- `GET /api/series/:seriesId/episodes/:episodeId/stage/1`  
  - 返回：流程步进、左侧导航结构、资产列表及每资产 4 版 Variant（含分数、定稿状态）、音色候选与当前基线。

- `POST /api/series/:seriesId/episodes/:episodeId/stage/1/lock-variant`  
  - 定稿：将某 variant_id 设为该 asset 的定稿。

- `POST /api/series/:seriesId/episodes/:episodeId/stage/1/feedback`  
  - Body：natural_language, asset_id 或 asset_type；调接口生成重生成任务，返回任务 id 或轮次。

- `POST /api/series/:seriesId/episodes/:episodeId/stage/1/confirm-voice`  
  - 确认音色：角色 → 音色 id，写入本剧音色基线。

- `POST /api/series/:seriesId/episodes/:episodeId/stage/1/submit`  
  - 全部确认：校验必选资产定稿 + 主角音色；通过则创建节点2 任务并推进；失败返回缺项列表。

### 3.3 节点 2（视觉素材）

- `GET /api/episodes/:episodeId/stage/2`  
  - 返回：分镜/镜头列表、每镜头关键帧与视频候选、时间轴默认选用、分数、状态（已通过/待修改/待审核）。

- `POST /api/episodes/:episodeId/stage/2/set-timeline-default`  
  - 将某 shot 的某 variant 设为时间轴默认。

- `POST /api/episodes/:episodeId/stage/2/feedback`  
  - Body：shot_id, scope（关键帧|视频|都改）, note；创建回炉任务，生成新候选。

- `POST /api/episodes/:episodeId/stage/2/decision`  
  - 镜头级或分集级通过/打回；打回带 reason 与可选归属。

### 3.4 节点 3（视听整合）

- `GET /api/episodes/:episodeId/stage/3`  
  - 返回：多轨 Timeline、素材库列表（音效/配音/音乐）、当前选中片段属性。

- `PUT /api/episodes/:episodeId/stage/3/timeline`  
  - 替换素材、微调起止、音量、淡入淡出、删除片段（轻量编辑）。
  - 请求必须包含 `timeline_revision`（客户端当前版本号）；服务端更新成功后返回新 `timeline_revision` 与完整快照。
  - 若 `timeline_revision` 不匹配，返回冲突（409）与最新快照摘要，前端需提示用户刷新后重试。

- `PATCH /api/episodes/:episodeId/stage/3/timeline/commands`（推荐）  
  - Body：`{ timeline_revision, commands[] }`  
  - `commands[]` 仅允许：`move_clip`, `trim_clip`, `replace_clip`, `set_volume`, `set_fade`, `delete_clip`。  
  - 约束：单次提交原子生效；任一命令校验失败则整体回滚并返回错误列表。

- `POST /api/episodes/:episodeId/stage/3/submit`  
  - 本集通过或打回；打回必填归属与理由。

### 3.5 节点 4（成片合成）

- `GET /api/episodes/:episodeId/stage/4`  
  - 返回：当前成片 URL、修订记录列表、历史版本卡片、审阅打点列表、审核链路状态（质检员/中台/合作方）。

- `POST /api/episodes/:episodeId/stage/4/review-points`  
  - Body：timecode_sec, note, stage_attribution；添加审阅打点。

- `POST /api/episodes/:episodeId/stage/4/reject`  
  - Body：review_point_ids 或 free_text, stage_attribution；驳回并触发归因回炉；集状态改为生成中，旧版只读。

- `POST /api/episodes/:episodeId/stage/4/approve`  
  - 当前角色「本集通过」：按顺序推进到下一审核方或最终通过池。

- `GET /api/episodes/:episodeId/versions/:versionId`  
  - 历史版本回放或对比（至少成片 URL + 修订摘要）。

### 3.6 通用

- `POST /api/tasks/:taskId/release`  
  - 主动释放锁（或由定时任务超时释放）。

- 埋点：任务领取/开始/完成、打回、通过等事件上报（任务维度、质量维度、交付维度见 requirements §6）。

---

## 4. 页面与路由结构

- `/` 或 `/tasks`：首页任务面板（分组 + 摘要 + 任务卡 + 处理/继续）。
- `/series/:seriesId/episode/:episodeId/stage/1`：节点1 美术资产审核（剪辑中台）。
- `/series/:seriesId/episode/:episodeId/stage/2`：节点2 视觉素材审核（质检员）。
- `/series/:seriesId/episode/:episodeId/stage/3`：节点3 视听整合审核（质检员）。
- `/series/:seriesId/episode/:episodeId/stage/4`：节点4 成片合成审核（质检员/中台/合作方）。

权限：根据当前用户角色过滤可见节点与操作（通过/打回/定稿/覆盖等）；合作方仅见节点4 且脱敏。

---

## 5. 打回归因与回炉

- 节点4 打回：用户选择归属（节点2/3/4/其他）；后端或调归因接口，创建对应 stage 的重新生成/重审任务，Episode 当前版本保留为只读，新版本生成后挂到该集。
- 节点2/3 打回：默认归属本节点；允许「上游归因」时，将问题归属到节点1 或 2，由接口创建对应回炉任务。
- 每次回炉产生新版本号（v2/v3…），RevisionLog 记录 Agent 修订总结，供节点4 左侧展示。

---

## 6. 安全与一致性

- 所有修改操作校验：任务是否被当前用户锁定（或未锁则可领取）；角色是否有权执行该操作。
- 敏感信息：合作方接口与前端不返回内部 asset、模型名、未脱敏元数据。
- 审计：关键操作写 AuditLog（谁、何时、哪集、哪任务、动作）。
- 节点3时间轴编辑权限最小化：  
  - 质检员：可 `move/trim/replace/volume/fade/delete`（轻量编辑）。  
  - 剪辑中台：MVP 默认只读（如需开放，需在任务配置中显式开启）。  
  - 合作方：无编辑权限，仅可审阅打点与通过/不通过。
- 时间轴编辑必须记录前后差异（before/after）并关联 `episode_version_id`、`review_task_id`，用于回放与审计。

---

## 7. 与现有系统的对接

- **数据库**：节点1「调取数据库里的数据即可」— 资产、4 版候选、分数等从现有表/接口读取。
- **模型与生成**：节点2 所有涉及模型的调用「调我调好的接口即可」；节点1 右侧自然语言反馈、配音音色、节点4 修订总结等「调接口即可」。
- 前端页面布局与交互以你已画好的核心页面为准，本设计仅约定数据与接口语义，便于前后端对齐。

真相源统一要求：
- `aigc-core-orchestrator-platform` 负责核心业务对象与状态定义。
- 本设计通过 `Review Gateway` 消费核心对象派生出来的审核 DTO。
- 不允许审核层直接把页面字段反向定义成核心业务字段，再要求编排层兼容。

---

## 8. 核心页面驱动的数据契约

为保证实现与设计稿一致，前后端接口返回应满足以下页面数据契约。

### 8.1 首页任务卡契约（对应任务面板）

- `task_card` 建议字段：
  - `task_id`, `series_id`, `episode_id`, `series_name`
  - `group`（urgent_rejected | in_qc | new_pending | generating）
  - `stage`（1|2|3|4）, `stage_label`
  - `deadline_at`, `created_at`, `estimated_duration_sec`
  - `progress`: `{ qc: {done,total}, platform: {done,total}, partner: {done,total} }`
  - `action_type`（handle | continue）
  - `is_urgent`, `is_locked`, `locked_by_name`

- `panel_summary` 建议字段：
  - `pending_review_series_count`
  - `pending_review_episode_count`
  - `overdue_count`
  - `generating_count`

### 8.2 节点页通用契约（对应 1~4 节点）

- 顶部流程条统一返回：
  - `workflow_steps`: `[ { stage, label, status } ]`
  - `status`: `done | current | upcoming`

- 页面上下文统一返回：
  - `series_id`, `episode_id`, `episode_index`, `current_version`
  - `task_lock`: `{ status, locked_by, locked_at, expires_at }`

### 8.3 节点2/3 时间轴契约

- `timeline` 字段统一：
  - `timeline_id`, `stage`, `duration_sec`
  - `timeline_revision`（乐观并发版本号）
  - `tracks[]`: `{ track_type, clips[] }`
  - `clips[]`: `{ clip_id, source_variant_id, start_sec, end_sec, volume, fade_in_sec, fade_out_sec }`

- 节点2 镜头块建议字段：
  - `shot_block`: `{ shot_id, shot_index, status, risk_level, default_variant_id }`

### 8.4 节点4 审阅契约

- `review_points[]`:
  - `review_point_id`, `timecode_sec`, `note`, `severity`, `attribution_stage`, `created_by`, `created_at`
- `revision_logs[]`:
  - `revision_log_id`, `version_id`, `summary_text`, `created_at`
- `audit_chain`:
  - `{ qc_status, platform_status, partner_status, current_reviewer_role }`

---

> 详细字段级数据结构见 `data-structures.md`。

## 9. T1 基础结构与数据模型设计方案

本节为 `tasks.md` 中 T1 的实施蓝图，目标是在不依赖完整业务逻辑的前提下，先完成稳定的数据底座。

### 9.1 T1 目标与边界

- 完成核心表结构与枚举定义。
- 完成关键索引、唯一约束、外键约束。
- 完成可支撑 4 节点流程的最小状态机字段。
- 完成审计与版本追溯的基础能力。
- 不在 T1 实现复杂编排，只实现可用数据骨架与读写接口桩。

### 9.2 建议表结构（逻辑层）

- `projects`
  - `id`, `name`, `status`, `created_at`, `updated_at`

- `series`
  - `id`, `project_id`, `name`, `genre`, `total_episodes`, `created_at`, `updated_at`

- `episodes`
  - `id`, `series_id`, `episode_no`, `title`, `status`, `current_stage`, `current_version_id`, `duration_estimate_sec`, `created_at`, `updated_at`
  - 约束：`UNIQUE(series_id, episode_no)`

- `stage_tasks`
  - `id`, `episode_id`, `stage`, `status`, `priority_group`, `deadline_at`, `locked_by`, `locked_at`, `lock_expire_at`, `source_reason`, `created_at`, `updated_at`
  - 约束：同一集同一阶段仅允许一个 active 任务（可通过 partial unique index 实现）

- `assets`
  - `id`, `series_id`, `episode_id`, `asset_type`, `name`, `is_required`, `selected_variant_id`, `created_at`, `updated_at`

- `variants`
  - `id`, `series_id`, `episode_id`, `asset_id`, `shot_id`, `variant_kind`, `round_no`, `score`, `model_provider`, `model_name`, `uri`, `meta_json`, `created_at`
  - 说明：`variant_kind` 区分 image/video/audio/subtitle/final_cut

- `shots`
  - `id`, `episode_id`, `shot_no`, `name`, `status`, `risk_level`, `default_keyframe_variant_id`, `default_video_variant_id`, `created_at`, `updated_at`
  - 约束：`UNIQUE(episode_id, shot_no)`

- `timelines`
  - `id`, `episode_id`, `stage`, `duration_sec`, `version_id`, `created_at`, `updated_at`
  - 约束：`UNIQUE(episode_id, stage, version_id)`

- `timeline_clips`
  - `id`, `timeline_id`, `track_type`, `track_order`, `source_variant_id`, `start_sec`, `end_sec`, `volume`, `fade_in_sec`, `fade_out_sec`, `created_at`, `updated_at`

- `review_points`
  - `id`, `episode_id`, `version_id`, `stage`, `timecode_sec`, `scope`, `severity`, `attribution_stage`, `anchor_type`, `anchor_id`, `note`, `created_by`, `created_at`

- `review_decisions`
  - `id`, `episode_id`, `stage`, `reviewer_role`, `decision`, `note`, `version_id`, `created_by`, `created_at`

- `revision_logs`
  - `id`, `episode_id`, `version_id`, `summary_text`, `change_type`, `source_stage`, `created_at`

- `audit_logs`
  - `id`, `actor_id`, `actor_role`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `trace_id`, `created_at`

### 9.3 枚举定义（建议）

- `stage`: 1 | 2 | 3 | 4
- `task_status`: pending | in_progress | passed | rejected | generating
- `episode_status`: pending | reviewing | generating | final_passed
- `priority_group`: urgent_rejected | in_qc | new_pending | generating
- `severity`: blocker | major | minor
- `attribution_stage`: 1 | 2 | 3 | 4 | other
- `review_decision`: pass | reject

### 9.4 关键索引与约束

- `idx_stage_tasks_priority`：(`priority_group`, `deadline_at`, `created_at`)
- `idx_stage_tasks_lock`：(`status`, `lock_expire_at`)
- `idx_variants_asset_round`：(`asset_id`, `round_no`, `score desc`)
- `idx_shots_episode_no`：(`episode_id`, `shot_no`)
- `idx_review_points_episode_version`：(`episode_id`, `version_id`, `timecode_sec`)
- `idx_audit_logs_entity_time`：(`entity_type`, `entity_id`, `created_at desc`)

### 9.5 T1 迁移实施顺序

1. 建立枚举与基础主表：`projects/series/episodes/stage_tasks`。  
2. 建立内容表：`assets/variants/shots/timelines/timeline_clips`。  
3. 建立审阅追溯表：`review_points/review_decisions/revision_logs/audit_logs`。  
4. 添加索引、唯一约束、外键与默认值。  
5. 补充种子数据：角色、阶段、默认优先级组。  
6. 提供最小读写 API（可先 stub），打通首页任务列表读取。  

### 9.6 T1 验收标准（技术侧）

- 可创建项目、系列、剧集、节点任务并可查询排序。
- 可写入资产与候选版本，支持选定默认版本。
- 可写入镜头、时间轴与轨道片段。
- 可记录审阅打点、通过/驳回、修订日志与审计日志。
- 可通过单测/集成测试验证关键约束（唯一约束、锁冲突、版本关联）。

---

*本文档为 MCP-SPEC-WORKFLOW 的 design 输出，与 requirements.md 共同构成 AIGC 审核工作流 MVP 的完整 SPEC。*
