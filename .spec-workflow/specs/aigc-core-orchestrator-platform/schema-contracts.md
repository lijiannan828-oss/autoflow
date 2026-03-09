# AutoFlow 核心数据模型定义（对齐版）

## 文档信息

| 项 | 值 |
|---|---|
| 文档名称 | `schema-contracts.md` |
| 所属 Spec | `aigc-core-orchestrator-platform` |
| 作用 | 应用层 Schema 契约、运行时上下文层、Schema 到数据库映射 |
| 当前状态 | `working baseline` |
| 真相源层级 | 应用层/运行时契约；数据库真相源仍以 `data-structures.md` + 实际迁移为准 |

---

## 1. 使用原则

### 1.1 目标

本文档用于把“业务对象定义”“运行时上下文定义”“当前数据库真相源”三件事拉齐，作为后续以下工作的共同底稿：

- Step 2：26 节点规格卡
- Step 3：LangGraph 状态机设计
- Step 4：质检评分体系
- Step 5：模型路由与成本控制
- 后续 `T8.x` Worker Agent 实现

### 1.2 真相源边界

1. `schema-contracts.md` 定义的是应用层与运行时层如何表达对象，不直接替代数据库真相源。
2. 涉及 `Run / NodeRun / Artifact / ReviewTask / ReturnTicket / ModelJob` 等系统对象时，以 `.spec-workflow/specs/aigc-core-orchestrator-platform/data-structures.md` 与实际迁移为准。
3. 审核消费层若与 core spec 冲突，以 core spec 为准；`aigc-review-workflow-mvp` 只消费、不反向定义核心编排状态。

### 1.3 本次统一拉齐后的核心规则

1. 不再使用一个全局 `TaskStatus` 覆盖所有域，改为按域拆分状态枚举。
2. 资源地址统一表述为“对象存储 URI”，支持 `tos://` / `s3://` / `minio://`。
3. 业务资产类型与系统 `artifact_type` 分层表达，不再混用。
4. 业务评分主量纲统一为 `1~10`；若需归一化，另存 `normalized_score`。
5. 业务对象目标 ID 规范仍为 UUID v4，但对现网历史 `episode_id / shot_id` 不一致保留兼容位。
6. `PipelineState` 仅作为编排运行时容器，不作为数据库主真相表。

---

## 2. 基础约定

### 2.1 通用元信息

```typescript
interface SchemaMeta {
  schema_version: string;              // 如 "1.0.0"
  object_type: string;                 // 如 "shot_spec" / "run_context"
  source: "human" | "agent" | "system";
  trace_id?: string;                   // 跨节点/跨回调追踪 ID
  source_run_id?: string;
  source_node_id?: string;
  created_at: string;                  // ISO 8601
  updated_at?: string;
}
```

### 2.2 业务引用 ID 兼容模型

```typescript
interface BusinessRefId {
  id: string;                          // 目标规范：UUID v4
  legacy_ref_id?: string;              // 过渡期兼容老系统字符串 ID
}
```

### 2.3 对象存储引用

```typescript
interface StorageRef {
  uri: string;                         // tos:// / s3:// / minio://
  provider: "tos" | "s3" | "minio" | "http";
  bucket?: string;
  object_key?: string;
  mime_type?: string;
  checksum?: string;
  width?: number;
  height?: number;
  duration_sec?: number;
  preview_uri?: string;
  retention_policy?: RetentionPolicy;
}
```

### 2.4 时间精度约定

- 业务层时长最小粒度：`0.5 秒`
- 时间轴定位最小粒度：`timestamp_ms`
- 聚合层若写入数据库总耗时，可在 `int 秒`、`ms` 或 `numeric` 之间按表结构适配

---

## 3. 枚举定义（对齐版）

### 3.1 镜头复杂度与内容枚举

```typescript
enum ShotDifficulty {
  S0 = "S0",
  S1 = "S1",
  S2 = "S2",
}

enum ShotType {
  EXTREME_CLOSE_UP = "extreme_close_up",
  CLOSE_UP = "close_up",
  MEDIUM_CLOSE_UP = "medium_close_up",
  MEDIUM = "medium",
  MEDIUM_LONG = "medium_long",
  FULL = "full",
  LONG = "long",
  EXTREME_LONG = "extreme_long",
  OVER_SHOULDER = "over_shoulder",
  POV = "pov",
  TWO_SHOT = "two_shot",
  GROUP = "group",
  INSERT = "insert",
  ESTABLISHING = "establishing",
}

enum CameraMovement {
  STATIC = "static",
  PAN_LEFT = "pan_left",
  PAN_RIGHT = "pan_right",
  TILT_UP = "tilt_up",
  TILT_DOWN = "tilt_down",
  DOLLY_IN = "dolly_in",
  DOLLY_OUT = "dolly_out",
  TRACKING = "tracking",
  CRANE_UP = "crane_up",
  CRANE_DOWN = "crane_down",
  HANDHELD = "handheld",
  ZOOM_IN = "zoom_in",
  ZOOM_OUT = "zoom_out",
  ORBITAL = "orbital",
  WHIP_PAN = "whip_pan",
}

enum AspectRatio {
  LANDSCAPE_16_9 = "16:9",
  PORTRAIT_9_16 = "9:16",
}

enum EmotionTag {
  NEUTRAL = "neutral",
  HAPPY = "happy",
  SAD = "sad",
  ANGRY = "angry",
  FEARFUL = "fearful",
  SURPRISED = "surprised",
  TENDER = "tender",
  TENSE = "tense",
  COMEDIC = "comedic",
  MYSTERIOUS = "mysterious",
  EPIC = "epic",
  MELANCHOLIC = "melancholic",
}

enum ContentLanguage {
  ZH = "zh",
  EN = "en",
  JA = "ja",
  KO = "ko",
  TH = "th",
  ES = "es",
  AR = "ar",
}

enum QCTier {
  TIER_1_FULL = "tier_1_full",       // 3 模型交叉评审：重要镜头/高风险镜头
  TIER_2_DUAL = "tier_2_dual",       // 2 模型投票：普通镜头
  TIER_3_SINGLE = "tier_3_single",   // 1 模型快检：简单镜头/低风险镜头
}

enum RetentionPolicy {
  TEMP_30D = "temp_30d",
  PERMANENT = "permanent",
}
```

### 3.2 按域拆分的状态枚举

```typescript
enum ProjectPipelineStatus {
  PARSING = "parsing",
  ART_GENERATION = "art_generation",
  ART_REVIEW = "art_review",
  PLANNING = "planning",
  GENERATING = "generating",
  VISUAL_REVIEW = "visual_review",
  AV_ASSEMBLY = "av_assembly",
  AV_REVIEW = "av_review",
  COMPOSITING = "compositing",
  FINAL_REVIEW = "final_review",
  DONE = "done",
  ERROR = "error",
}

enum EpisodeVersionStatus {
  CREATED = "created",
  RUNNING = "running",
  WAIT_REVIEW_STAGE_1 = "wait_review_stage_1",
  WAIT_REVIEW_STAGE_2 = "wait_review_stage_2",
  WAIT_REVIEW_STAGE_3 = "wait_review_stage_3",
  WAIT_REVIEW_STAGE_4 = "wait_review_stage_4",
  WAIT_REVIEW_STAGE_4_STEP_1 = "wait_review_stage_4_step_1",
  WAIT_REVIEW_STAGE_4_STEP_2 = "wait_review_stage_4_step_2",
  WAIT_REVIEW_STAGE_4_STEP_3 = "wait_review_stage_4_step_3",
  APPROVED_STAGE_1 = "approved_stage_1",
  APPROVED_STAGE_2 = "approved_stage_2",
  APPROVED_STAGE_3 = "approved_stage_3",
  APPROVED_STAGE_4 = "approved_stage_4",
  RETURNED = "returned",
  PATCHING = "patching",
  DELIVERED = "delivered",
  DISTRIBUTED = "distributed",
}

enum RunStatus {
  PENDING = "pending",
  RUNNING = "running",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCELED = "canceled",
}

enum NodeExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  RETRYING = "retrying",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCELED = "canceled",
  SKIPPED = "skipped",
  PARTIAL = "partial",
  AUTO_REJECTED = "auto_rejected",
}

enum ReviewTaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  APPROVED = "approved",
  RETURNED = "returned",
  SKIPPED = "skipped",
}

enum CandidateDecisionStatus {
  PENDING = "pending",
  SELECTED = "selected",
  REJECTED = "rejected",
}

enum CandidateSetDecisionStatus {
  AWAITING_REVIEW = "awaiting_review",
  SELECTED = "selected",
  ALL_REJECTED_REGENERATING = "all_rejected_regenerating",
}

enum ReturnTicketStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  WONTFIX = "wontfix",
}

enum ModelJobStatus {
  QUEUED = "queued",
  RUNNING = "running",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

enum ReviewerRole {
  QC_INSPECTOR = "qc_inspector",
  MIDDLE_PLATFORM = "middle_platform",
  PARTNER = "partner",
}

enum ReviewGranularity {
  ASSET = "asset",
  SHOT = "shot",
  EPISODE = "episode",
}
```

补充约定：

- `ProjectPipelineStatus` 为**展示层派生状态**，不作为独立数据库主状态机。
- 核心运行态仍以 `EpisodeVersionStatus + current_node_id/current_stage_no` 为准。

推荐派生映射（第一版）：

| EpisodeVersion / 当前节点 | 派生 ProjectPipelineStatus |
|---|---|
| `running` + `N01~N05` | `parsing` |
| `running` + `N06~N09` | `art_generation` |
| `wait_review_stage_1` | `art_review` |
| `running` + `N10~N19` | `generating` / `visual_review`（遇 Gate 时） |
| `running` + `N20~N22` | `av_assembly` |
| `wait_review_stage_3` | `av_review` |
| `running` + `N23~N25` | `compositing` / `final_review`（遇 Gate 时） |
| `delivered/distributed` | `done` |
| 异常终止且无法推进 | `error` |

### 3.3 业务资产类型与系统产物类型

```typescript
enum BusinessAssetType {
  CHARACTER_REF = "character_ref",
  SCENE_BG = "scene_bg",
  PROP_REF = "prop_ref",
  KEYFRAME = "keyframe",
  VIDEO_RAW = "video_raw",
  VIDEO_LIPSYNC = "video_lipsync",
  AUDIO_TTS = "audio_tts",
  AUDIO_SFX = "audio_sfx",
  AUDIO_BGM = "audio_bgm",
  TIMELINE = "timeline",
  SUBTITLE = "subtitle",
  FINAL_EPISODE = "final_episode",
  VOICE_SAMPLE = "voice_sample",
  VISUAL_TONE = "visual_tone",
  PROMPT_JSON = "prompt_json",
  COMFYUI_WORKFLOW = "comfyui_workflow",
}

enum ArtifactType {
  ART_ASSET = "art_asset",
  KEYFRAME = "keyframe",
  VIDEO = "video",
  TTS = "tts",
  BGM = "bgm",
  SFX = "sfx",
  FINAL_CUT = "final_cut",
  TIMELINE_JSON = "timeline_json",
  SUBTITLE_JSON = "subtitle_json",
  STORYBOARD = "storyboard",
  PROMPT_JSON = "prompt_json",
  COMFYUI_WORKFLOW = "comfyui_workflow",
}
```

对齐原则：

- `BusinessAssetType` 用于节点规格、业务语义和候选集
- `ArtifactType` 用于 `core_pipeline.artifacts.artifact_type`
- 两者通过映射层衔接，不要求一一同名

---

## 4. 通用结构

### 4.1 多候选机制

```typescript
interface Candidate<T> extends SchemaMeta {
  candidate_id: string;
  version: number;
  prompt_used: string;
  prompt_variant_tag?: string;
  model_used: string;
  generation_params: Record<string, unknown>;
  seed: number;
  content: T;
  auto_score?: number;                // 1~10
  auto_score_detail?: Record<string, number>;
  status: CandidateDecisionStatus;
  selected_by?: string;
  selected_at?: string;
  rejection_reason?: string;
  retention_policy: RetentionPolicy;
  generation_time_sec: number;
  cost: number;
}

interface CandidateSet<T> extends SchemaMeta {
  set_id: string;
  target_type: string;
  target_ref_id: string;
  candidates: Candidate<T>[];
  total_requested: number;
  total_generated: number;
  prompt_diversity_strategy: string;
  decision_status: CandidateSetDecisionStatus;
  selected_candidate_id?: string;
  review_notes?: string;
  regeneration_count: number;
  max_regenerations: number;
  regeneration_instructions?: string;
  decided_at?: string;
}
```

候选回溯约定（第一阶段）：

- 即使 `CandidateSet<T>` 当前不单独建表，所有与候选直接相关的执行对象仍应在 JSON 级带上：
  - `candidate_set_id`
  - `candidate_id`
  - `prompt_variant_tag`
- 第一阶段优先落在：
  - `model_jobs.request_payload/result_payload`
  - `artifacts.meta_json`
  - 必要时 `review_tasks.payload_json`
- 是否为 `model_jobs` / `artifacts` 增加物理列与索引，作为后续查询压力增大后的第二阶段优化。

### 4.2 Gate 审核步骤配置

```typescript
interface ReviewStepSpec {
  step_no: number;
  reviewer_role: ReviewerRole;
  review_granularity: ReviewGranularity;
  skippable: boolean;
}

interface GateReviewConfig {
  gate_node_id: string;               // N08 / N18 / N21 / N24
  stage_no: 1 | 2 | 3 | 4;
  review_steps: ReviewStepSpec[];
}
```

默认 Gate 审核步骤（与当前 core spec 对齐）：

| gate_node_id | stage_no | step_no | reviewer_role | review_granularity | skippable |
|---|---|---|---|---|---|
| `N08` | 1 | 1 | `middle_platform` | `asset` | 否 |
| `N18` | 2 | 1 | `qc_inspector` | `shot` | 否 |
| `N21` | 3 | 1 | `qc_inspector` | `episode` | 否 |
| `N24` | 4 | 1 | `qc_inspector` | `episode` | 是 |
| `N24` | 4 | 2 | `middle_platform` | `episode` | 否 |
| `N24` | 4 | 3 | `partner` | `episode` | 否 |

### 4.3 节点执行信封

```typescript
interface NodeInputEnvelope<TPayload = unknown> extends SchemaMeta {
  node_id: string;
  episode_id: string;
  episode_version_id: string;
  run_id: string;
  shot_id?: string;
  payload: TPayload;
  context_refs: {
    episode_context_id?: string;
    run_context_id?: string;
    shot_context_id?: string;
  };
  artifact_inputs?: ArtifactRef[];
}

interface NodeOutputEnvelope<TPayload = unknown> extends SchemaMeta {
  node_id: string;
  episode_id: string;
  episode_version_id: string;
  run_id: string;
  shot_id?: string;
  status: NodeExecutionStatus;
  payload: TPayload;
  artifact_outputs?: ArtifactRef[];
  metrics?: {
    duration_s?: number;
    cost_cny?: number;
    gpu_seconds?: number;
    token_in?: number;
    token_out?: number;
    quality_score?: number;           // 1~10
  };
  error?: {
    code: string;
    message: string;
  };
}

interface ArtifactRef {
  artifact_id?: string;
  business_asset_type?: BusinessAssetType;
  artifact_type: ArtifactType;
  storage: StorageRef;
  anchor_type?: "asset" | "shot" | "timestamp" | "episode_version";
  anchor_id?: string;
  time_range?: {
    start_ms: number;
    end_ms: number;
  };
  score?: number;
  score_detail?: Record<string, unknown>;
  meta_json?: Record<string, unknown>;
}
```

---

## 5. 核心业务对象（应用层）

### 5.1 剧本输入与解析

```typescript
interface RawScriptInput extends SchemaMeta {
  project_id: string;
  title: string;
  genre: string;
  style_tags: string[];
  target_audience: string;
  aspect_ratio: AspectRatio;
  total_episodes: number;
  episode_duration_sec: number;
  primary_language: ContentLanguage;
  distribution_languages: ContentLanguage[];
  distribution_regions?: string[];
  script_text?: string;
  script_file?: StorageRef;
  character_presets?: CharacterPreset[];
  reference_urls?: string[];
  style_reference_images?: StorageRef[];
  watermark_config?: WatermarkConfig;
  created_by: string;
}

interface CharacterPreset {
  name: string;
  gender: "male" | "female";
  age_range: string;
  ethnicity: string;
  appearance_notes?: string;
  voice_style?: string;
  reference_image?: StorageRef;
}

interface WatermarkConfig {
  enabled: boolean;
  type: "text" | "image" | "both";
  text_content?: string;
  image?: StorageRef;
  position: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center";
  opacity: number;
  apply_to: "final_only" | "all_outputs";
}

interface ParsedScript extends SchemaMeta {
  project_id: string;
  title: string;
  genre: string;
  style_tags: string[];
  aspect_ratio: AspectRatio;
  primary_language: ContentLanguage;
  prompt_language: ContentLanguage;
  prompt_language_override?: ContentLanguage;
  world_setting: WorldSetting;
  character_registry: CharacterProfile[];
  location_registry: LocationProfile[];
  episodes: EpisodeScript[];
  total_episodes: number;
  total_scenes: number;
  total_estimated_shots: number;
  parser_model: string;
  parser_version: string;
}

interface WorldSetting {
  time_period: string;
  location_overview: string;
  tone: string;
  visual_style_guide: string;
  color_palette?: string[];
}
```

### 5.2 角色 / 场景 / 镜头

```typescript
interface CharacterProfile extends SchemaMeta {
  character_id: string;
  name: string;
  name_en?: string;
  name_localized?: Partial<Record<ContentLanguage, string>>;
  gender: "male" | "female";
  age: number;
  role_type: "protagonist" | "antagonist" | "supporting" | "extra";
  appearance: {
    ethnicity: string;
    face_shape: string;
    hair: string;
    eyes: string;
    skin_tone: string;
    height: string;
    distinguishing_features?: string;
    body_type?: string;
  };
  costumes: CostumeSet[];
  voice_config: {
    tts_engine: "cosyvoice" | "elevenlabs";
    voice_id?: string;
    voice_description: string;
    speed_factor: number;
    pitch_shift?: number;
    emotion_style_map?: Partial<Record<EmotionTag, string>>;
    source_candidate_id?: string;
    source_candidate_set_id?: string;
  };
  reference_assets?: {
    face_ref_front?: StorageRef;
    face_ref_three_quarter?: StorageRef;
    face_ref_side?: StorageRef;
    full_body_ref_images?: StorageRef[];
    expression_ref_map?: Partial<Record<EmotionTag, StorageRef>>;
    firered_embedding?: StorageRef;
    source_candidate_id?: string;
    source_candidate_set_id?: string;
  };
  episode_appearances: number[];
  first_appearance_episode: number;
  total_scenes: number;
}

interface CostumeSet {
  costume_id: string;
  name: string;
  description: string;
  applicable_episodes?: number[];
  applicable_scene_ids?: string[];
  trigger_event?: string;
  color_scheme: string;
  reference_image?: StorageRef;
}

interface LocationProfile extends SchemaMeta {
  location_id: string;
  name: string;
  name_en?: string;
  name_localized?: Partial<Record<ContentLanguage, string>>;
  description: string;
  time_of_day_variants: {
    day?: string;
    night?: string;
    dawn?: string;
    dusk?: string;
  };
  lighting_style: string;
  props: string[];
  reference_images?: StorageRef[];
  source_candidate_id?: string;
  source_candidate_set_id?: string;
  episode_appearances: number[];
}

interface EpisodeScript extends SchemaMeta {
  episode_id: string;
  episode_number: number;
  title?: string;
  title_localized?: Partial<Record<ContentLanguage, string>>;
  synopsis: string;
  narrative_arc: {
    hook: string;
    development: string;
    climax: string;
    cliffhanger: string;
  };
  scenes: SceneSpec[];
  target_duration_sec: number;
  estimated_shot_count: number;
  dominant_emotion: EmotionTag;
  continuity_from_prev?: string;
  continuity_to_next?: string;
}

interface SceneSpec extends SchemaMeta {
  scene_id: string;
  episode_id: string;
  scene_number: number;
  location_id: string;
  time_of_day: "day" | "night" | "dawn" | "dusk";
  weather?: string;
  characters_present: string[];
  costume_overrides?: Record<string, string>;
  scene_description: string;
  emotional_progression: EmotionTag[];
  shots: ShotSpec[];
  estimated_duration_sec: number;
  bgm_config: SceneBGMConfig;
}

interface SceneBGMConfig {
  mood: EmotionTag;
  intensity_curve: { position_ratio: number; intensity: number }[];
  style_hint?: string;
  transition_in: "fade_in" | "cut";
  transition_out: "fade_out" | "cut" | "crossfade_next";
  bgm_candidates?: CandidateSet<BGMCandidate>;
}

interface BGMCandidate {
  audio: StorageRef;
  mood: EmotionTag;
  style: string;
  source: "stable_audio" | "library";
  library_id?: string;
}
```

```typescript
interface ShotSpec extends SchemaMeta {
  shot_id: string;
  legacy_shot_id?: string;
  scene_id: string;
  episode_id: string;
  shot_number: number;
  global_shot_index: number;
  shot_type: ShotType;
  camera_movement: CameraMovement;
  camera_movement_detail?: string;
  difficulty: ShotDifficulty;
  difficulty_reason: string;
  keyframe_count: number;
  qc_tier: QCTier;
  qc_tier_reason?: string;
  action_description: string;
  visual_prompt: string;
  negative_prompt?: string;
  characters_in_shot: ShotCharacter[];
  consistency_locked_count: number;
  dialogue?: DialogueLine[];
  sfx_tags?: string[];
  ambient_sound?: string;
  duration_sec: number;               // 0.5s 粒度
  transition_in?: "cut" | "fade_in" | "fade_out" | "dissolve" | "wipe" | "zoom_transition";
  transition_out?: "cut" | "fade_in" | "fade_out" | "dissolve" | "wipe" | "zoom_transition";
  keyframe_specs: KeyframeSpec[];
  prev_shot_id?: string;
  next_shot_id?: string;
  continuity_notes?: string;
  candidate_generation_config: {
    num_candidates: number;
    prompt_variants: string[];
  };
}

interface ShotCharacter {
  character_id: string;
  position_in_frame: "left" | "center_left" | "center" | "center_right" | "right" | "background";
  action: string;
  expression: EmotionTag;
  costume_id: string;
  is_speaking: boolean;
  needs_consistency_lock: boolean;
}

interface DialogueLine {
  line_id: string;
  character_id: string;
  text: string;
  text_localized?: Partial<Record<ContentLanguage, string>>;
  emotion: EmotionTag;
  timing: { start_sec: number; end_sec: number };
  timing_resolution_strategy?: "pad_silence" | "shift_following_segments" | "manual_review_required";
  tts_result?: {
    audio: StorageRef;
    actual_duration_sec: number;
    tts_engine: string;
    timing_adjustment_needed: boolean;
  };
}

TTS 时长对齐建议（第一版默认策略）：

- `actual_duration_sec < planned_window`
  - 默认：`pad_silence`
- `actual_duration_sec > planned_window` 且超出 `<= 0.5s`
  - 默认：允许局部时间轴微调
- `actual_duration_sec > planned_window` 且超出 `> 0.5s`
  - 默认：`shift_following_segments`
  - 若波及范围过大，则升级为 `manual_review_required`

interface KeyframeSpec {
  keyframe_index: number;
  timestamp_ratio: number;
  prompt: string;
  negative_prompt?: string;
  character_positions: {
    character_id: string;
    position: string;
    pose_description: string;
    expression: EmotionTag;
    face_direction: "front" | "left_profile" | "right_profile" | "three_quarter_left" | "three_quarter_right";
  }[];
  character_ref_images: {
    character_id: string;
    ref_images: StorageRef[];         // 最多 3 张
  }[];
  scene_ref_image?: StorageRef;
  prev_keyframe_image?: StorageRef;
  controlnet_type?: "openpose" | "depth" | "canny" | null;
  controlnet_strength?: number;
  ip_adapter_strength?: number;
  firered_strength?: number;
  retention_policy: RetentionPolicy;
}

interface ShotVisualCandidate {
  keyframes: {
    keyframe_index: number;
    image: StorageRef;
    seed: number;
  }[];
  video: {
    video: StorageRef;
    fps: number;
    generation_model: string;
    has_native_audio: boolean;
  };
  visual_prompt: string;
  negative_prompt?: string;
  prompt_variant_tag: string;
}
```

### 5.3 生成结果、审核与成本

```typescript
// 说明：GeneratedShotAssets 是只读聚合视图，不作为核心持久化真相写入结构；
// 核心持久化以 core_pipeline.artifacts + 对象存储元数据为准。
interface GeneratedShotAssets extends SchemaMeta {
  shot_id: string;
  keyframes: {
    keyframe_index: number;
    image: StorageRef;
    generation_model: string;
    seed: number;
  }[];
  video_raw: {
    video: StorageRef;
    fps: number;
    generation_model: string;
    has_native_audio: boolean;
  };
  audio_tts?: {
    audio: StorageRef;
    character_id: string;
    language: ContentLanguage;
    tts_engine: string;
  }[];
  audio_sfx?: {
    audio: StorageRef;
    sfx_type: string;
    timing_sec: number;
  }[];
  video_lipsync?: {
    video: StorageRef;
    sync_model: "latentsync";
    sync_quality_score?: number;
  };
  video_final?: {
    video: StorageRef;
    has_audio: boolean;
    has_lipsync: boolean;
    has_sfx: boolean;
  };
  total_generation_time_sec: number;
  version: number;
  is_final: boolean;
  previous_version?: StorageRef;
}

interface EpisodeTimeline extends SchemaMeta {
  episode_id: string;
  total_duration_sec: number;
  video_track: TimelineVideoItem[];
  dialogue_track: TimelineAudioItem[];
  sfx_track: TimelineAudioItem[];
  bgm_track: TimelineBGMItem[];
  ambient_track: TimelineAudioItem[];
  review_status: "auto_assembled" | "under_review" | "approved" | "adjusting";
  timeline_version: number;
}

interface TimelineVideoItem {
  shot_id: string;
  start_sec: number;
  end_sec: number;
  video: StorageRef;
  transition_type?: string;
}

interface TimelineAudioItem {
  item_id: string;
  track_type: "dialogue" | "sfx" | "ambient";
  start_sec: number;
  end_sec: number;
  audio: StorageRef;
  volume: number;
  fade_in_sec?: number;
  fade_out_sec?: number;
  source_shot_id?: string;
  character_id?: string;
  sfx_tag?: string;
  is_replaceable: boolean;
  replacement_source?: "library_search" | "ai_regenerate";
}

interface TimelineBGMItem {
  item_id: string;
  scene_id: string;
  start_sec: number;
  end_sec: number;
  audio: StorageRef;
  volume: number;
  mood: EmotionTag;
  fade_in_sec: number;
  fade_out_sec: number;
  crossfade_with_next: boolean;
  is_replaceable: boolean;
  can_regenerate: boolean;
  bgm_alternatives?: CandidateSet<BGMCandidate>;
}

interface QualityScore extends SchemaMeta {
  shot_id?: string;                   // N03 无 shot_id（集级评审）
  node_id: string;                    // 来源质检节点（N03 / N11 / N15）
  check_type: "auto" | "human";
  qc_tier: QCTier;
  scale: "1_10";
  normalized_score?: number;          // 0~1，仅用于聚合/统计

  // 动态维度：不同节点有不同维度集（见 quality-standards.md §4.3）
  //   N03: narrative_coherence, visual_feasibility, pacing, character_consistency, technical_compliance, emotional_impact
  //   N11: character_consistency, body_integrity, tone_consistency, script_fidelity, action_accuracy, expression_match, composition, lighting_consistency
  //   N15: character_consistency, motion_fluidity, physics_plausibility, action_accuracy, expression_match, composition, lighting_consistency, continuity_score
  dimensions: Record<string, number>;
  dimension_weights: Record<string, number>;

  weighted_average: number;
  pass_threshold: number;
  is_passed: boolean;
  model_reviews: {
    model_name: string;
    scores: Record<string, number>;
    reasoning: string;
    latency_ms: number;
  }[];
  aggregation_method: "weighted_average" | "median" | "min_of_max";
  issues?: QualityIssue[];

  tool_checks?: {
    tool_name: string;              // "FaceID" | "ReActor" | "PhysicsChecker"
    metric: string;                 // "cosine_similarity" | "detection_rate" | "violation_rate"
    value: number;
    threshold: number;
    passed: boolean;
  }[];
}

interface QualityIssue {
  issue_id: string;
  dimension: string;
  severity: "critical" | "major" | "minor";
  description: string;
  suggestion: string;
  target_node: string;
  target_asset_type: BusinessAssetType;
  target_keyframe_index?: number;
  retry_hint?: string;
}

interface HumanReview extends SchemaMeta {
  review_id: string;
  reviewer_id: string;
  reviewer_role?: ReviewerRole;
  source_review_task_id?: string;
  review_scope: {
    type: "character_assets" | "visual_check" | "av_integration" | "final_check";
    episode_id: string;
    shot_ids?: string[];
  };
  // partial_approved: Stage2 场景下，部分 shot 通过、部分 shot 打回时的聚合态
  decision: "approved" | "rejected" | "partial_approved"; // 应用层聚合态
  overall_comment?: string;
  shot_feedbacks?: ShotFeedback[];
  global_feedbacks?: {
    target: string;
    feedback: string;
    action_required: string;
  }[];
  review_duration_sec?: number;
}

interface ShotFeedback {
  shot_id: string;
  decision: "pass" | "redo" | "adjust";
  issues: {
    dimension: string;
    description: string;
    target_node: string;
    target_keyframe_index?: number;
    modification_instruction: string;
  }[];
  prompt_override?: string;
}

interface CostRecord extends SchemaMeta {
  shot_id: string;
  episode_id: string;
  breakdown: {
    llm_cost: number;
    image_gen_cost: number;
    video_gen_cost: number;
    tts_cost: number;
    lipsync_cost: number;
    sfx_cost: number;
    storage_cost: number;
    retry_overhead: number;
    candidate_overhead: number;
  };
  total_cost: number;
  duration_sec: number;
  cost_per_minute: number;
  retry_count: number;
  candidates_generated: number;
  candidates_regenerated: number;
  is_over_budget: boolean;
  budget_utilization: number;
}
```

补充说明：

- `GeneratedShotAssets` 是查询时的聚合对象，写入层仍以 `ArtifactRef[] / artifacts` 为主。
- `CostRecord` 是由多个 `NodeOutputEnvelope.metrics` / `node_runs` 聚合得到的镜头级只读汇总结构，不替代原子执行指标。

### 5.4 Reflection / Feedback 占位结构

```typescript
interface FeedbackRecord extends SchemaMeta {
  source_review_task_id: string;
  source_return_ticket_id?: string;
  feedback_type: "quality_issue" | "style_preference" | "process_improvement";
  original_prompt?: string;
  corrected_prompt?: string;
  lesson_learned: string;
  applicable_nodes: string[];
  rag_collection_target?: string;
  adopted: boolean;
  adopted_at?: string;
}
```

### 5.5 Agent 记忆（v2.2 新增）

```typescript
// agent_memory 表（PostgreSQL）
interface AgentMemory extends SchemaMeta {
  memory_id: string;
  agent_name: string;                  // "visual_director" | "shot_designer" | ...
  memory_type: "task_summary" | "lesson_learned" | "preference" | "statistics";
  scope: "global" | "project" | "episode";
  scope_id?: string;

  content: {
    key: string;                       // "character_太后_best_practice"
    value: any;
    confidence: number;                // 越常被验证越高
  };

  created_at: string;
  last_accessed_at: string;
  access_count: number;
}
```

### 5.6 Prompt 资产库（v2.2 新增）

```typescript
interface PromptAsset extends SchemaMeta {
  prompt_id: string;
  agent_name: string;                  // 归属 Agent
  prompt_stage: string;                // "script_parse" | "shot_design" | "visual_prompt" | "qc_review" | ...

  // === 母版 ===
  master_template: {
    version: string;                   // "v3.2"
    system_prompt: string;
    output_schema_ref: string;         // 指向 schema-contracts.md 中的类型
    locked_by: string;                 // 锁定确认人
    locked_at: string;
  };

  // === 题材适配器库 ===
  genre_adapters: {
    genre_tag: string;                 // "古装宫斗" | "现代悬疑" | "甜宠" | ...
    adapter_prompt: string;            // 注入到 system_prompt 的差异化片段
    few_shot_examples: RAGCaseRef[];   // 关联的经典案例
    style_keywords: string[];          // 影响 visual_prompt 的风格关键词
    created_by: "human" | "agent";
    performance_stats: {
      total_uses: number;
      avg_qc_score: number;
      human_approval_rate: number;
    };
  }[];

  // === 版本历史 ===
  version_history: PromptVersion[];
}

interface RAGCaseRef {
  chain_id: string;
  relevance_score: number;
}

interface PromptVersion {
  version: string;
  changed_by: "human" | "agent";
  change_reason: string;
  created_at: string;
  a_b_test_result?: {
    test_id: string;
    improvement_pct: number;
    adopted: boolean;
  };
}
```

### 5.7 RAG 链路级案例（v2.2 新增）

```typescript
interface RAGChainCase extends SchemaMeta {
  chain_id: string;                    // 链路唯一 ID
  quality_score: number;               // >= 9.0 才入库
  case_type: "positive" | "negative" | "corrective";

  // === 全链路碎片资产，通过 chain_id 关联 ===
  chain_assets: {
    script_fragment: string;           // 原始剧本片段
    shot_spec: ShotSpec;               // 分镜规格
    visual_prompt: string;             // 使用的画面 prompt
    negative_prompt: string;
    generation_params: Record<string, any>;
    keyframe_images: StorageRef[];
    video: StorageRef;
    audio_config: {
      tts_params: any;
      bgm_style: string;
      sfx_tags: string[];
    };
    qc_scores: QualityScore;
    human_feedback?: string;
  };

  // === 检索标签（用于向量+标签混合检索）===
  retrieval_tags: {
    genre: string;
    scene_type: string;               // "多人对话" | "动作打斗" | "独白特写" | ...
    emotion: EmotionTag;
    difficulty: ShotDifficulty;
    shot_type: ShotType;
    camera_movement: CameraMovement;
    character_count: number;
    has_dialogue: boolean;
    location_type: string;
  };

  // === 向量 embedding ===
  embedding_visual_prompt: number[];
  embedding_script_fragment: number[];

  // === 元信息 ===
  source_project_id: string;
  source_episode: number;
  source_shot_id: string;
  created_at: string;
  retrieval_count: number;
}
```

### 5.8 项目集与发行需求（v2.2 新增）

```typescript
interface ProjectGroup extends SchemaMeta {
  group_id: string;
  name: string;                         // "YouTube Shorts 2026Q2"
  platform: string;                     // "youtube_shorts" | "tiktok" | "reels"

  platform_constraints: {
    aspect_ratio: AspectRatio;
    max_duration_sec: number;
    min_duration_sec: number;
    max_file_size_mb: number;
    video_codec: string;
    fps: number;
    subtitle_style: "hardcode" | "srt" | "none";
    watermark_required: boolean;
    content_rating: string;
  };

  style_preferences: {
    pacing: "fast" | "medium" | "slow";
    hook_duration_sec: number;
    cliffhanger_required: boolean;
    bgm_loudness_ratio: number;
    text_overlay_style?: string;
  };

  compliance_rules: {
    forbidden_content: string[];
    required_disclaimers?: string[];
    music_copyright: "royalty_free_only" | "licensed_ok";
  };
}

interface ProjectRequirements extends SchemaMeta {
  project_id: string;
  group_id: string;

  overrides: {
    special_instructions: string;
    brand_assets?: {
      logo_url?: string;
      intro_video_url?: string;
      outro_video_url?: string;
    };
    target_audience_notes?: string;
    partner_review_required: boolean;
  };
}
```

### 5.9 Agent 决策追踪（v2.2 新增）

```typescript
interface AgentTrace extends SchemaMeta {
  trace_id: string;
  agent_name: string;
  node_id: string;
  run_id: string;
  episode_id: string;
  shot_id?: string;

  decision_steps: {
    step: "context" | "retrieval" | "strategy" | "execution" | "self_check" | "record";
    input_summary: string;
    output_summary: string;
    duration_ms: number;
    model_used?: string;
    rag_cases_retrieved?: string[];
    memories_accessed?: string[];
  }[];

  final_strategy: Record<string, any>;
  quality_score?: number;
  cost_cny?: number;
  created_at: string;
}
```

### 5.10 成本事件（v2.2 新增）

```typescript
interface CostEvent extends SchemaMeta {
  event_id: string;
  run_id: string;
  node_id: string;
  episode_id: string;
  shot_id?: string;

  cost_type: "llm_api" | "gpu_compute" | "tts_api" | "storage" | "external_api";
  provider: string;                    // "gemini" | "claude" | "comfyui" | "elevenlabs" | ...
  model_name?: string;
  amount_cny: number;

  usage_detail: {
    token_in?: number;
    token_out?: number;
    gpu_seconds?: number;
    api_calls?: number;
  };

  budget_context: {
    episode_budget_cny: number;
    episode_spent_cny: number;
    budget_utilization: number;
    over_budget_alert: boolean;
  };

  created_at: string;
}
```

---

## 附录 B：运行时上下文层

### B.1 设计意图

运行时不再依赖一个“大一统 PipelineState”承载所有信息，而是拆成 3 层：

- `EpisodeContext`：整集稳定上下文
- `RunContext`：单次运行/回炉动态上下文
- `ShotContext`：单镜头工作上下文

这样做的目的：

1. 避免 LangGraph state 无限膨胀
2. 让节点读写边界清楚
3. 让 rerun / artifact reuse / auto_qc 更容易表达

### B.2 EpisodeContext

```typescript
interface EpisodeContext extends SchemaMeta {
  episode_id: string;
  episode_version_id: string;
  project_id: string;
  series_id?: string;
  primary_language: ContentLanguage;
  aspect_ratio: AspectRatio;
  parsed_script: ParsedScript;
  world_setting: WorldSetting;
  character_registry: CharacterProfile[];
  location_registry: LocationProfile[];
  shot_index: Array<{
    shot_id: string;
    scene_id: string;
    difficulty: ShotDifficulty;
    qc_tier: QCTier;
  }>;
  delivery_targets: {
    dual_format_enabled: boolean;
    formats: AspectRatio[];
    watermark_config?: WatermarkConfig;
  };
  global_quality_policy: {
    score_scale: "1_10";
    default_pass_threshold: number;
    cost_redline_per_minute_cny: number;
  };
  rag_baseline_refs?: string[];
}
```

适合存放：

- 剧本结构化结果
- 角色卡 / 场景卡
- 全局风格
- 全局预算与质量目标
- 集级交付要求

不适合存放：

- 当前节点状态
- 当前 job 状态
- 某个镜头的最新局部错误

### B.3 RunContext

```typescript
interface RunContext extends SchemaMeta {
  run_id: string;
  episode_id: string;
  episode_version_id: string;
  is_rerun: boolean;
  rerun_from_ticket_id?: string;
  langgraph_thread_id?: string;
  current_node_id?: string;
  current_stage_no?: number;
  status: RunStatus;
  node_statuses: Record<string, NodeExecutionStatus>;
  retry_counters: Record<string, number>;
  auto_reject_counters: Record<string, number>;
  pending_review_task_ids: string[];
  active_model_job_ids: string[];
  artifact_ids: string[];
  return_ticket_ids: string[];
  total_cost_cny: number;
  total_gpu_seconds: number;
  total_duration_s?: number;
  checkpoint_refs?: string[];
  downgrade_flags?: string[];
  warnings: string[];
  errors: string[];
}
```

适合存放：

- 当前这次执行跑到哪里
- 当前 Run 的节点推进情况
- 本轮 model jobs / artifacts / review tasks
- 本轮累计成本、耗时、告警

### B.4 ShotContext

```typescript
interface ShotContext extends SchemaMeta {
  shot_id: string;
  legacy_shot_id?: string;
  episode_id: string;
  episode_version_id: string;
  scene_id: string;
  shot_spec: ShotSpec;
  current_candidate_set_ids?: string[];
  selected_visual_candidate_id?: string;
  retry_count?: number;
  max_retries?: number;
  artifact_ids: string[];
  generated_assets?: GeneratedShotAssets;
  quality_score?: QualityScore;
  latest_feedback?: HumanReview;
  current_status: NodeExecutionStatus;
  last_error?: {
    code: string;
    message: string;
    source_node_id?: string;
  };
  rerun_required: boolean;
  rerun_target_node_id?: string;
  local_cost_cny?: number;
  cost_record?: CostRecord;
}
```

适合存放：

- 单镜头的局部生成状态
- 单镜头候选、选中结果、QC、反馈
- 局部 rerun 决策

### B.5 推荐读写边界

| 层 | 常见读取方 | 常见写入方 |
|---|---|---|
| `EpisodeContext` | `N01~N06`、Supervisor、RAG 检索器 | Script/Director 早期节点，版本初始化逻辑 |
| `RunContext` | Supervisor、T9、Gate 处理器、RCA/Rerun Planner | Supervisor、callback handler、gate write-side |
| `ShotContext` | `N10~N22`、QC 节点、局部 rerun 逻辑 | 各视觉/视听 Worker、QC 节点、人类反馈映射器 |

### B.6 生命周期建议

| Context | 创建时机 | 更新时机 | 归档/冻结 |
|---|---|---|---|
| `EpisodeContext` | `N01` 解析完成后首次创建 | `N02/N04/N06` 可补充结构化信息；回炉仅允许局部受控更新 | 集交付后冻结，作为版本级快照保留 |
| `RunContext` | `create_run` / `create_rerun` 时创建 | 每个 `NodeRun`、Gate 决策、callback、ReturnTicket 处理后更新 | Run 结束后归档 |
| `ShotContext` | `N02` 拆镜完成后批量初始化 | 视觉/视听节点、QC、人类反馈、局部 rerun 时更新 | 跟随 Run 归档；回炉生成新版本上下文 |

### B.7 PipelineState（降级后的容器）

```typescript
interface PipelineState extends SchemaMeta {
  project_id: string;
  pipeline_status: ProjectPipelineStatus;
  episode_context_ref: string;
  run_context: RunContext;
  active_shot_contexts: Record<string, ShotContext>;
}
```

说明：

- `PipelineState` 只做编排容器
- 业务对象真相不再全部内嵌

---

## 附录 C：Schema -> 数据库映射表

### C.1 映射原则

1. 能映射到现有 core truth 表的，优先映射到现有表。
2. 当前没有专门核心表承接的对象，先按“对象存储 JSON + artifact/meta_json + payload_json”承接。
3. 审核消费层表只消费，不反向定义编排主真相。

### C.2 核心对象映射

| Schema 对象 | 当前持久化层 | 系统真相源 | 主要表/字段 | 适配说明 |
|---|---|---|---|---|
| `RawScriptInput` | 应用层输入快照 | 过渡期 JSON 快照 | 建议先存对象存储 JSON；最小索引落 `projects/series/episodes` | 当前 core 无独立 `raw_script_inputs` 表 |
| `ParsedScript` | 应用层核心对象 | 过渡期 JSON + artifact | 建议存对象存储 JSON；`N01/N02/N04` 的 `node_runs.output_ref` + `artifacts(artifact_type=storyboard/prompt_json)` | 当前 core 无独立 `parsed_scripts` 表 |
| `CharacterProfile` | 应用层业务对象 | 过渡期 JSON | 建议存 `ParsedScript` 快照 + 选中参考图落对象存储；必要索引由 `character_appearance_index` 承接 | 当前无独立核心角色表 |
| `LocationProfile` | 应用层业务对象 | 过渡期 JSON | 同上，先挂在对象存储 JSON / `artifacts.meta_json` | 当前无独立核心场景表 |
| `EpisodeScript` | 应用层业务对象 | 过渡期 JSON | 对象存储 JSON + `node_runs.output_ref` | 与 `episodes / episode_versions` 是不同层级 |
| `SceneSpec` | 应用层业务对象 | 过渡期 JSON | 对象存储 JSON | 当前无独立 `scene_specs` 表 |
| `ShotSpec` | 应用层业务对象 | 过渡期 JSON + 审核锚点 | 对象存储 JSON；Stage2 审核锚点走 `review_tasks.anchor_id`；局部索引可进 `character_appearance_index.shot_id` | 当前 shot 主键兼容层仍可能是字符串 |
| `CandidateSet<T>` | 应用层候选集 | 组合真相 | 候选内容建议挂对象存储 JSON；生成任务走 `model_jobs`；最终选中产物走 `artifacts`；审核决策走 `review_tasks/review_points` | 第一阶段要求在 `model_jobs.request_payload/result_payload` 和 `artifacts.meta_json` 中保留 `candidate_set_id/candidate_id` |
| `NodeInputEnvelope` | 运行时输入 | `node_runs.input_ref` | `core_pipeline.node_runs.input_ref` + 对象存储 JSON | 适合作为 T8 节点统一 I/O |
| `NodeOutputEnvelope` | 运行时输出 | `node_runs.output_ref` | `core_pipeline.node_runs.output_ref` + `node_runs.error_*` + `artifacts` | 质检/成本可落 `node_runs` |
| `EpisodeContext` | 运行时上下文 | 组合真相 | `episode_versions` + `ParsedScript` JSON + 角色/场景对象快照 | 建议先存对象存储 JSON，主键挂 `episode_version_id` |
| `RunContext` | 运行时上下文 | 核心真相 | `core_pipeline.runs` 为主，辅以 `node_runs` / `return_tickets` / `model_jobs` | 是 LangGraph 最重要的持久化镜像 |
| `ShotContext` | 运行时上下文 | 组合真相 | `ShotSpec` JSON + 相关 `node_runs/artifacts/review_tasks/review_points` | 当前适合以聚合读侧生成，不强制单表落地 |
| `GeneratedShotAssets` | 业务结果对象 | 组合真相 | `core_pipeline.artifacts` 为主，补充对象存储元数据 | `video_raw/video_lipsync/final` 映射到不同 `artifact_type` |
| `EpisodeTimeline` | 业务结果对象 | 过渡期 JSON + artifact | 对象存储 JSON；核心索引可落 `artifacts(artifact_type=timeline_json/final_cut)` | 当前无独立 `episode_timelines` 表 |
| `QualityScore` | 业务评分对象 | 核心 + JSON | `node_runs.quality_score`、`artifacts.score/score_detail`、必要时 `review_points/comment` | 主量纲 1~10 |
| `HumanReview` | 应用层审核聚合对象 | `review_tasks + review_points + return_tickets` | `public.review_tasks`、`public.review_points`、`core_pipeline.return_tickets` | `partial_approved` 为应用层聚合态，不直接做主状态 |
| `CostRecord` | 业务聚合对象 | `node_runs` / `episode_versions` | `node_runs.cost_cny/gpu_seconds`、`episode_versions.total_cost_cny` | 镜头级可作为应用层汇总结构 |
| `ModelExecutionJob` | 核心执行对象 | 核心真相 | `model_jobs` | 已有真实表，可继续扩展 request/result payload |
| `FeedbackRecord` | Reflection 占位对象 | 过渡期 JSON / 反馈沉淀流 | 当前建议先落对象存储 JSON，后续再决定是否专表化 | 用于 RAG / Reflection 主线占位 |

### C.3 状态映射要点

| 应用层对象 | 推荐状态字段 | 数据库主状态 |
|---|---|---|
| `RunContext` | `RunStatus` | `core_pipeline.runs.status` |
| `NodeOutputEnvelope` / `ShotContext.current_status` | `NodeExecutionStatus` | `core_pipeline.node_runs.status` |
| `HumanReview` | `approved/rejected/partial_approved`（聚合态） | `public.review_tasks.status` + `review_points` + `return_tickets` |
| `CandidateSet` | `CandidateSetDecisionStatus` | 当前无独立表，需映射到审核决策结果 |
| `ModelExecutionJob` | `ModelJobStatus` | `model_jobs.status` |

### C.4 AssetType / ArtifactType 映射建议

| BusinessAssetType | ArtifactType | 说明 |
|---|---|---|
| `CHARACTER_REF` | `ART_ASSET` | 角色基线图 |
| `SCENE_BG` | `ART_ASSET` | 场景背景资产 |
| `PROP_REF` | `ART_ASSET` | 道具资产 |
| `KEYFRAME` | `KEYFRAME` | 关键帧图 |
| `VIDEO_RAW` | `VIDEO` | 原始镜头视频 |
| `VIDEO_LIPSYNC` | `VIDEO` | 唇同步后视频 |
| `AUDIO_TTS` | `TTS` | 语音 |
| `VOICE_SAMPLE` | `TTS` | 角色试音样本，第一阶段复用 TTS 类产物表示 |
| `AUDIO_BGM` | `BGM` | 背景音乐 |
| `AUDIO_SFX` | `SFX` | 音效 |
| `VISUAL_TONE` | `ART_ASSET` | 影调/基调参考图 |
| `TIMELINE` | `TIMELINE_JSON` | 时间轴 JSON |
| `SUBTITLE` | `SUBTITLE_JSON` | 字幕数据 |
| `FINAL_EPISODE` | `FINAL_CUT` | 成片 |
| `PROMPT_JSON` | `PROMPT_JSON` | Prompt 快照 |
| `COMFYUI_WORKFLOW` | `COMFYUI_WORKFLOW` | Workflow 快照 |

### C.5 当前仍无专表承接、需先按 JSON 承接的对象

- `CharacterProfile`
- `LocationProfile`
- `CostumeSet`
- `SceneSpec`
- `ShotSpec`
- `EpisodeTimeline`
- `CandidateSet<T>`

推荐第一阶段承接方式：

1. 对象存储 JSON 快照
2. `node_runs.input_ref/output_ref`
3. `artifacts.meta_json`
4. `review_tasks.payload_json`

### C.6 当前建议保持“只读聚合 / 运行时层”的对象

- `GeneratedShotAssets`
- `CostRecord`
- `ProjectPipelineStatus`

说明：

- `GeneratedShotAssets`：从 `artifacts` 与对象存储元数据聚合得到
- `CostRecord`：从 `node_runs` 原子指标聚合得到
- `ProjectPipelineStatus`：从 `EpisodeVersionStatus + current_node_id/current_stage_no` 派生得到

---

## 7. CameraMovement MVP 能力分级

| CameraMovement | 支持级别 | 说明 |
|---|---|---|
| `static` / `pan_left` / `pan_right` / `zoom_in` / `zoom_out` | `mvp_supported` | MVP 阶段优先支持 |
| `tracking` / `dolly_in` / `dolly_out` | `conditional` | 依赖 HuMo / 特定视频模型和额外控制 |
| `tilt_up` / `tilt_down` / `handheld` | `conditional` | 允许实现，但需质量兜底 |
| `orbital` / `whip_pan` / `crane_up` / `crane_down` | `future_only` | MVP 阶段建议降级或改写为更稳定运镜 |

---

## 8. 可执行性结论

在本对齐版基础上，当前已足以继续展开：

- Step 2：26 节点规格卡
- Step 3：LangGraph 路由与状态机
- Step 4：质检评分体系
- Step 5：模型路由与成本控制
- Step 8：验收标准与测试样例

当前仍建议在真正大规模进入 `T8.x` 前，继续补齐：

1. 26 节点 I/O 信封的实例化样例
2. `HumanReview -> review_tasks/review_points/return_tickets` 的更细映射
3. 角色/场景/镜头对象的专表化策略（若决定不长期只用 JSON 承接）
