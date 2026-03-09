# AIGC 审核工作流：模型接口对接文档（外包详细版）

## 1. 文档定位

本文档用于外包团队与模型网关团队联调，覆盖：

- 每个 API 的调用时机
- 输入/输出字段的自然语言解释
- 请求与响应示例
- 异步回调与 `job_id` 落库规范

---

## 2. 对接边界与统一约定

### 2.1 责任边界

- 外包团队（Workflow）负责：
  - 审核流程页面与业务 API
  - 在业务节点调用模型网关 API
  - 接收模型异步回调并落库
- 你方团队（Model Gateway）负责：
  - 模型能力实现（生图、生视频、TTS、LLM）
  - 任务调度与回调

### 2.2 基础协议

- 模型网关前缀：`/model-api/v1`
- 回调入口（Workflow 暴露）：`/api/model-callbacks/v1/jobs/result`
- 鉴权：`Authorization: Bearer <token>`
- 幂等：`Idempotency-Key: <uuid>`
- 链路追踪：`X-Trace-Id: <trace_id>`
- Content-Type：`application/json`

### 2.3 通用错误码

- `400` 参数错误
- `401/403` 鉴权失败
- `404` 资源不存在
- `409` 幂等冲突/状态冲突
- `422` 业务不可执行
- `429` 限流
- `500` 网关内部错误
- `503` 下游模型不可用

### 2.4 异步任务通用约定

异步接口统一响应：

```json
{
  "job_id": "job_xxx",
  "status": "queued"
}
```

状态枚举：

- `queued`：已入队
- `running`：执行中
- `succeeded`：执行成功
- `failed`：执行失败
- `cancelled`：已取消

---

## 3. 外包必须对接 API 总览

| API | 用途 | 调用时机 | 模式 |
|---|---|---|---|
| `POST /model-api/v1/feedback/parse` | 自然语言解析 + 归因建议 | 任意节点提交文本反馈时 | 同步 |
| `POST /model-api/v1/generation/assets` | 节点1资产重生成 | 节点1提交修改建议后 | 异步 |
| `POST /model-api/v1/voice/candidates` | 节点1音色候选生成 | 节点1需生成/刷新音色时 | 异步 |
| `POST /model-api/v1/voice/preview` | 节点1音色试听 | 节点1点击试听时 | 同步 |
| `POST /model-api/v1/generation/keyframes` | 节点2关键帧重生成 | 节点2提交“仅关键帧/都修改”时 | 异步 |
| `POST /model-api/v1/generation/videos` | 节点2视频重生成 | 节点2提交“仅视频/都修改”时 | 异步 |
| `POST /model-api/v1/audio/tts` | 节点3人声生成 | 节点3替换/重生成人声时 | 异步 |
| `POST /model-api/v1/audio/music` | 节点3BGM生成/替换 | 节点3点击生成/替换BGM时 | 异步 |
| `POST /model-api/v1/audio/mix/analyze` | 节点3混音诊断建议 | 节点3自动或手动诊断时 | 同步 |
| `POST /model-api/v1/revision/summarize` | 节点4修订摘要生成 | 新版本完成后写修订日志时 | 同步 |
| `GET /model-api/v1/jobs/{job_id}` | 异步任务补偿查询 | 回调超时/排障时 | 同步 |
| `POST /api/model-callbacks/v1/jobs/result` | 模型结果回调到 Workflow | 模型任务完成时 | 回调 |

---

## 4. 详细接口定义

## 4.1 反馈解析与归因

### 4.1.1 `POST /model-api/v1/feedback/parse`

调用时机：

- 审核员在任意节点提交自然语言反馈后立即调用。
- 目标是把“人话”转成结构化字段，并给出建议归因节点。

调用方与模式：

- 调用方：Workflow 后端
- 模式：同步（建议超时 2~5 秒）

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `episode_id` | string(uuid) | 是 | 当前集 ID |
| `stage_no` | integer | 是 | 当前审核节点（1~4） |
| `raw_text` | string | 是 | 用户原始反馈文本 |
| `context` | object | 否 | 辅助解析的上下文 |
| `context.series_id` | string(uuid) | 否 | 所属剧集 ID |
| `context.current_version_id` | string(uuid) | 否 | 当前版本 ID |
| `context.anchor_candidates` | array | 否 | 可选锚点候选列表 |
| `context.anchor_candidates[].anchor_type` | string | 否 | `asset` / `shot` / `timestamp` |
| `context.anchor_candidates[].anchor_id` | string(uuid) | 否 | 当锚点为 asset/shot 时使用 |
| `context.anchor_candidates[].timecode_sec` | number | 否 | 当锚点为 timestamp 时使用 |

响应字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `parsed` | object | 是 | 结构化解析结果 |
| `parsed.scope` | string | 是 | 问题域，如 `video`/`voice`/`music` |
| `parsed.severity` | string | 是 | 严重级别：`blocker`/`major`/`minor` |
| `parsed.anchor_type` | string | 是 | 锚点类型 |
| `parsed.anchor_id` | string(uuid/null) | 否 | 对应锚点对象 ID |
| `parsed.timecode_sec` | number/null | 否 | 时间码 |
| `parsed.note` | string | 是 | 归一化后的问题描述 |
| `attribution_suggestion` | object | 是 | 建议回炉节点 |
| `attribution_suggestion.suggested_stage` | string | 是 | `1`/`2`/`3`/`4`/`other` |
| `attribution_suggestion.confidence` | number | 是 | 置信度（0~1） |
| `attribution_suggestion.reasons` | array<string> | 否 | 判定理由 |

请求示例：

```json
{
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "stage_no": 4,
  "raw_text": "32秒镜头衔接生硬，背景音乐盖住人声",
  "context": {
    "series_id": "b366d4f7-f7d6-4fd1-a6ef-0ddde3f588a4",
    "current_version_id": "8af53c00-2f72-4126-b53d-d88d2fd7b8ce",
    "anchor_candidates": [
      {
        "anchor_type": "timestamp",
        "timecode_sec": 32.0
      }
    ]
  }
}
```

响应示例：

```json
{
  "parsed": {
    "scope": "video",
    "severity": "major",
    "anchor_type": "timestamp",
    "anchor_id": null,
    "timecode_sec": 32.0,
    "note": "镜头衔接生硬"
  },
  "attribution_suggestion": {
    "suggested_stage": "2",
    "confidence": 0.86,
    "reasons": [
      "问题主要发生在视觉连续性层面"
    ]
  }
}
```

后续动作（Workflow 必做）：

1. 将原文与解析结果分别写入 `feedback_records.raw_text` 和 `feedback_records.parsed_json`。
2. 基于 `parsed` 生成或更新 `review_points`（至少落 `scope/severity/anchor/note`）。
3. 将 `attribution_suggestion.suggested_stage` 作为默认归因建议写入（允许人工在提交驳回前覆盖）。
4. 给前端返回业务成功态即可，前端不需要消费全部解析字段。

---

## 4.2 节点1：资产与音色

### 4.2.1 `POST /model-api/v1/generation/assets`

调用时机：

- 节点1提交“修改建议”后触发，重生成人物/场景/道具/影调候选图。

调用方与模式：

- 调用方：Workflow 后端
- 模式：异步（返回 `job_id`，结果走回调）

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `episode_id` | string(uuid) | 是 | 当前集 ID |
| `stage_no` | integer | 是 | 固定为 1 |
| `asset_type` | string | 是 | `character`/`scene`/`prop`/`tone` |
| `asset_id` | string(uuid) | 是 | 目标资产 ID |
| `round_no` | integer | 是 | 第几轮重生成 |
| `candidate_count` | integer | 是 | 返回候选数量（建议 4） |
| `prompt.positive` | string | 是 | 正向提示词 |
| `prompt.negative` | string | 否 | 反向提示词 |
| `references` | array | 否 | 参考图列表 |
| `references[].url` | string(url) | 否 | 参考图地址 |

响应字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `job_id` | string | 是 | 异步任务 ID |
| `status` | string | 是 | 初始通常 `queued` |

请求示例：

```json
{
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "stage_no": 1,
  "asset_type": "character",
  "asset_id": "69df8950-c12f-4d58-85e0-2be1a4e97c25",
  "round_no": 2,
  "candidate_count": 4,
  "prompt": {
    "positive": "主角A，半写实，暖色电影感",
    "negative": "畸形手指，过曝"
  },
  "references": [
    {
      "url": "https://tos.example.com/ref/ref1.png"
    }
  ]
}
```

响应示例：

```json
{
  "job_id": "job_asset_001",
  "status": "queued"
}
```

后续动作（Workflow 必做）：

1. 立即 upsert `model_jobs`：记录 `job_id/job_type/status=queued/request_payload`。
2. 当前业务接口向前端返回“已进入生成队列”，不要阻塞等待模型完成。
3. 等待 `jobs/result` 回调成功后，将产物写入 `variants`（`variant_type=asset_image`，并写 `model_job_id`）。
4. 更新页面可见的候选列表与轮次信息（`round_no/candidate_no`）。

### 4.2.2 `POST /model-api/v1/voice/candidates`

调用时机：

- 节点1初次加载音色不足，或用户点击“重新生成音色”时。

调用方与模式：

- 调用方：Workflow 后端
- 模式：异步

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `series_id` | string(uuid) | 是 | 当前剧 ID |
| `character_name` | string | 是 | 角色名 |
| `candidate_count` | integer | 是 | 候选数量（建议 >=3） |
| `gender` | string | 否 | 性别标签 |
| `style_tags` | array<string> | 否 | 音色风格标签 |

请求示例：

```json
{
  "series_id": "b366d4f7-f7d6-4fd1-a6ef-0ddde3f588a4",
  "character_name": "主角A",
  "candidate_count": 3,
  "gender": "female",
  "style_tags": ["温柔", "坚定"]
}
```

响应示例：

```json
{
  "job_id": "job_voice_candidates_001",
  "status": "queued"
}
```

后续动作（Workflow 必做）：

1. upsert `model_jobs`，记录该异步任务。
2. 前端先显示“音色生成中”，无需等待结果。
3. 回调成功后写入 `variants`（`variant_type=voice_sample`，写 `model_job_id`）。
4. 用户确认某个候选后，再写 `character_voice_bindings.voice_variant_id`。

### 4.2.3 `POST /model-api/v1/voice/preview`

调用时机：

- 节点1点击“试听”按钮时。

调用方与模式：

- 调用方：Workflow 后端
- 模式：同步

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `series_id` | string(uuid) | 是 | 剧 ID |
| `character_name` | string | 是 | 角色名 |
| `voice_variant_id` | string(uuid) | 是 | 选择的音色候选 ID |
| `text` | string | 是 | 试听文本 |
| `speed` | number | 否 | 语速，默认 1.0 |
| `pitch` | number | 否 | 音高，默认 0 |

响应字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `preview_url` | string(url) | 是 | 试听音频地址 |
| `duration_sec` | number | 是 | 音频时长（秒） |

请求示例：

```json
{
  "series_id": "b366d4f7-f7d6-4fd1-a6ef-0ddde3f588a4",
  "character_name": "主角A",
  "voice_variant_id": "173bb5cc-808e-48b7-8342-e17d188f3bd0",
  "text": "这是该角色的试听台词",
  "speed": 1.0,
  "pitch": 0.0
}
```

响应示例：

```json
{
  "preview_url": "https://tos.example.com/preview/voice_a_001.wav",
  "duration_sec": 3.2
}
```

后续动作（Workflow 必做）：

1. 将 `preview_url` 直接返回前端用于试听播放。
2. 不要求写入 `variants`（试听通常是临时资源）；如需审计可记录到 `audit_logs`。
3. 若播放失败，前端提示“试听失败请重试”，不影响主流程状态。

---

## 4.3 节点2：关键帧与视频

### 4.3.1 `POST /model-api/v1/generation/keyframes`

调用时机：

- 节点2提交“仅关键帧”或“都修改”时。

调用方与模式：

- 调用方：Workflow 后端
- 模式：异步

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `episode_id` | string(uuid) | 是 | 当前集 ID |
| `shot_id` | string(uuid) | 是 | 镜头 ID |
| `round_no` | integer | 是 | 重生成轮次 |
| `candidate_count` | integer | 是 | 候选数量 |
| `prompt.positive` | string | 是 | 正向提示词 |
| `prompt.negative` | string | 否 | 反向提示词 |
| `generation_params` | object | 否 | 生成参数 |
| `generation_params.ratio` | string | 否 | 画幅比例，如 `9:16` |
| `generation_params.seed` | integer | 否 | 随机种子 |

请求示例：

```json
{
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "shot_id": "10084bad-d5ff-4aa6-b8a6-7535e8a8115c",
  "round_no": 3,
  "candidate_count": 4,
  "prompt": {
    "positive": "雨夜追逐，运动感强",
    "negative": "模糊，鬼影"
  },
  "generation_params": {
    "ratio": "9:16",
    "seed": 12345
  }
}
```

响应示例：

```json
{
  "job_id": "job_keyframe_001",
  "status": "queued"
}
```

后续动作（Workflow 必做）：

1. upsert `model_jobs` 并返回“关键帧生成中”给前端。
2. 回调成功后写入 `variants`（`variant_type=keyframe_image`，关联 `shot_id`、`model_job_id`）。
3. 触发镜头候选刷新；如有评分规则，重算“需关注”标记。
4. 回调失败时更新 `model_jobs.status=failed` 并提示可重试。

### 4.3.2 `POST /model-api/v1/generation/videos`

调用时机：

- 节点2提交“仅视频”或“都修改”时。

调用方与模式：

- 调用方：Workflow 后端
- 模式：异步

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `episode_id` | string(uuid) | 是 | 当前集 ID |
| `shot_id` | string(uuid) | 是 | 镜头 ID |
| `round_no` | integer | 是 | 重生成轮次 |
| `candidate_count` | integer | 是 | 候选数量 |
| `source_keyframe_variant_ids` | array<string(uuid)> | 否 | 可选关键帧输入 |
| `duration_sec` | integer | 是 | 目标时长（秒） |
| `prompt.positive` | string | 是 | 正向提示词 |
| `prompt.negative` | string | 否 | 反向提示词 |
| `generation_params.fps` | integer | 否 | 帧率 |
| `generation_params.motion_strength` | number | 否 | 动作强度 |

请求示例：

```json
{
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "shot_id": "10084bad-d5ff-4aa6-b8a6-7535e8a8115c",
  "round_no": 2,
  "candidate_count": 3,
  "source_keyframe_variant_ids": [
    "c8f2aa11-97f4-4b4f-a94b-28967ecf4169"
  ],
  "duration_sec": 5,
  "prompt": {
    "positive": "稳定跟拍，动作连贯",
    "negative": "抖动，拖影"
  },
  "generation_params": {
    "fps": 24,
    "motion_strength": 0.6
  }
}
```

响应示例：

```json
{
  "job_id": "job_video_001",
  "status": "queued"
}
```

后续动作（Workflow 必做）：

1. upsert `model_jobs` 并向前端返回“视频生成中”。
2. 回调成功后写入 `variants`（`variant_type=shot_video`，关联 `shot_id`、`model_job_id`）。
3. 若业务设置了自动默认策略，可按分数/规则更新 `shots.default_video_variant_id`。
4. 回调失败则落错误详情，允许用户再次发起本镜头生成。

---

## 4.4 节点3：人声、BGM、混音诊断

### 4.4.1 `POST /model-api/v1/audio/tts`

调用时机：

- 节点3替换配音、修复配音对齐时。

调用方与模式：

- 调用方：Workflow 后端
- 模式：异步

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `episode_id` | string(uuid) | 是 | 当前集 ID |
| `shot_id` | string(uuid) | 是 | 镜头 ID |
| `voice_variant_id` | string(uuid) | 是 | 音色候选 ID |
| `lines` | array | 是 | 台词列表 |
| `lines[].text` | string | 是 | 台词文本 |
| `lines[].start_sec` | number | 否 | 建议起始时间 |
| `prosody.speed` | number | 否 | 语速 |
| `prosody.emotion` | string | 否 | 情感标签 |

请求示例：

```json
{
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "shot_id": "10084bad-d5ff-4aa6-b8a6-7535e8a8115c",
  "voice_variant_id": "173bb5cc-808e-48b7-8342-e17d188f3bd0",
  "lines": [
    {
      "text": "台词A",
      "start_sec": 1.2
    }
  ],
  "prosody": {
    "speed": 1.0,
    "emotion": "calm"
  }
}
```

响应示例：

```json
{
  "job_id": "job_tts_001",
  "status": "queued"
}
```

后续动作（Workflow 必做）：

1. upsert `model_jobs` 并返回“人声生成中”。
2. 回调成功后写入 `variants`（`variant_type=voice_sample` 或 `audio_mix`，写 `model_job_id`）。
3. 再通过时间轴业务接口把新音频挂到 `timeline_clips`，不要在回调里直接改复杂编排。
4. 回调失败时保留原时间轴，提示用户重试。

### 4.4.2 `POST /model-api/v1/audio/music`

调用时机：

- 节点3点击“生成BGM/替换BGM”时。

调用方与模式：

- 调用方：Workflow 后端
- 模式：异步

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `episode_id` | string(uuid) | 是 | 当前集 ID |
| `scene_tags` | array<string> | 否 | 场景标签 |
| `duration_sec` | integer | 是 | 音乐时长 |
| `bpm` | integer | 否 | 节拍速度 |
| `style` | string | 否 | 音乐风格 |

请求示例：

```json
{
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "scene_tags": ["紧张", "追逐"],
  "duration_sec": 30,
  "bpm": 120,
  "style": "cinematic"
}
```

响应示例：

```json
{
  "job_id": "job_music_001",
  "status": "queued"
}
```

后续动作（Workflow 必做）：

1. upsert `model_jobs` 并返回“BGM 生成中”。
2. 回调成功后写入 `variants`（通常 `audio_mix`，写 `model_job_id`）。
3. 用户确认后再替换 `music` 轨片段，避免自动替换误伤已调好的时间轴。
4. 回调失败时不改现有轨道，只做错误提示。

### 4.4.3 `POST /model-api/v1/audio/mix/analyze`

调用时机：

- 节点3页面自动诊断，或用户手动点击“诊断”。

调用方与模式：

- 调用方：Workflow 后端
- 模式：同步

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `episode_id` | string(uuid) | 是 | 当前集 ID |
| `episode_version_id` | string(uuid) | 是 | 当前版本 ID |
| `timeline_snapshot` | object | 是 | 当前时间轴快照 |
| `subtitle_track` | array | 否 | 字幕轨信息 |
| `rules` | array<string> | 否 | 诊断规则列表 |

响应字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `warnings` | array | 是 | 告警列表 |
| `warnings[].type` | string | 是 | 告警类型 |
| `warnings[].severity` | string | 是 | 严重程度 |
| `warnings[].time_range` | array<number> | 否 | 问题时间范围 |
| `warnings[].suggestion` | string | 是 | 调整建议 |

请求示例：

```json
{
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "episode_version_id": "8af53c00-2f72-4126-b53d-d88d2fd7b8ce",
  "timeline_snapshot": {},
  "subtitle_track": [],
  "rules": ["bgm_voice_balance", "silence_gap", "lip_sync_hint"]
}
```

响应示例：

```json
{
  "warnings": [
    {
      "type": "bgm_over_voice",
      "severity": "major",
      "time_range": [12.3, 18.8],
      "suggestion": "建议音乐音量从1.0降至0.65"
    }
  ]
}
```

后续动作（Workflow 必做）：

1. 将 `warnings` 返回前端用于标注时间轴告警点。
2. 可选：将诊断结果快照写入 `event_metrics` 便于后续质量统计。
3. 不直接改时间轴数据，所有改动仍通过人工确认后的业务接口提交。

---

## 4.5 节点4：修订摘要

### 4.5.1 `POST /model-api/v1/revision/summarize`

调用时机：

- 新版本产物落库完成后，用于生成版本摘要文案。

调用方与模式：

- 调用方：Workflow 后端（通常在回调消费后触发）
- 模式：同步

请求字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `episode_id` | string(uuid) | 是 | 当前集 ID |
| `from_version_id` | string(uuid) | 是 | 旧版本 ID |
| `to_version_id` | string(uuid) | 是 | 新版本 ID |
| `trigger_decision_id` | string(uuid) | 否 | 触发该修订的决策记录 ID |
| `change_payload` | object | 是 | 变化明细 |
| `style` | string | 否 | 摘要风格，如 `concise_cn` |

响应字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `summary_text` | string | 是 | 一段式修订摘要 |
| `bullets` | array<string> | 否 | 要点列表 |

请求示例：

```json
{
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "from_version_id": "8af53c00-2f72-4126-b53d-d88d2fd7b8ce",
  "to_version_id": "f5679105-fdd4-4b76-95de-93ef03f90021",
  "trigger_decision_id": "4e4fd4f6-2cc3-4734-a2f2-b5a75831bc4f",
  "change_payload": {
    "updated_shots": ["S03", "S08"],
    "audio_changes": ["BGM volume adjust", "voice re-align"]
  },
  "style": "concise_cn"
}
```

响应示例：

```json
{
  "summary_text": "修复了S03/S08镜头连贯性并调整BGM与配音平衡，整体节奏更稳定。",
  "bullets": ["镜头连贯性优化", "BGM音量下调", "配音对齐修正"]
}
```

后续动作（Workflow 必做）：

1. 将 `summary_text/bullets` 写入 `revision_logs`，并关联当前 `episode_version_id`。
2. 若此次摘要由模型任务链触发，补写 `revision_logs.model_job_id` 便于追溯。
3. 返回给前端用于节点4左侧“修订记录”展示。

---

## 4.6 异步状态查询与回调

### 4.6.1 `GET /model-api/v1/jobs/{job_id}`

调用时机：

- 回调超时、排障、补偿重查。

调用方与模式：

- 调用方：Workflow 后端
- 模式：同步

响应字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `job_id` | string | 是 | 任务 ID |
| `job_type` | string | 是 | 任务类型 |
| `status` | string | 是 | 当前状态 |
| `progress` | integer | 否 | 进度百分比（0~100） |
| `started_at` | string(datetime) | 否 | 开始时间 |
| `finished_at` | string(datetime/null) | 否 | 结束时间 |
| `error` | object/null | 否 | 错误对象 |

响应示例：

```json
{
  "job_id": "job_video_001",
  "job_type": "video_generation",
  "status": "running",
  "progress": 57,
  "started_at": "2026-03-06T10:00:00Z",
  "finished_at": null,
  "error": null
}
```

后续动作（Workflow 必做）：

1. 当回调超时时，轮询该接口做补偿；拿到终态后执行与回调相同的落库逻辑。
2. 若 `status=succeeded` 且本地未落产物，触发一次“幂等入库”流程。
3. 若 `status=failed/cancelled`，更新 `model_jobs` 并结束等待。

### 4.6.2 `POST /api/model-callbacks/v1/jobs/result`（Workflow 接收）

调用时机：

- 模型任务进入终态后（`succeeded`/`failed`/`cancelled`）由模型网关回调。

调用方与模式：

- 调用方：模型网关
- 模式：HTTP 回调（支持重试）

回调字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `job_id` | string | 是 | 任务 ID |
| `request_id` | string | 否 | 请求流水号 |
| `episode_id` | string(uuid) | 否 | 集 ID |
| `stage_no` | integer | 否 | 节点号 |
| `status` | string | 是 | 终态 |
| `result` | object | 否 | 成功结果 |
| `error` | object/null | 否 | 错误对象 |
| `finished_at` | string(datetime) | 否 | 完成时间 |

回调示例：

```json
{
  "job_id": "job_video_001",
  "request_id": "req_20260306_001",
  "episode_id": "2f10a1e0-2d64-4ff7-b7ce-1ea1b74ce3c2",
  "stage_no": 2,
  "status": "succeeded",
  "result": {
    "variants": [
      {
        "variant_type": "shot_video",
        "round_no": 2,
        "candidate_no": 1,
        "score": 8.9,
        "resource_url": "https://tos.example.com/video/v2_c1.mp4",
        "preview_url": "https://tos.example.com/video/v2_c1_preview.mp4",
        "model_provider": "volc",
        "model_name": "video-model-x"
      }
    ]
  },
  "error": null,
  "finished_at": "2026-03-06T10:05:00Z"
}
```

Workflow 回调响应示例：

```json
{
  "ack": true
}
```

后续动作（Workflow 接收端必做）：

1. 先按 `job_id` 幂等更新 `model_jobs`（状态、结果、错误、完成时间）。
2. 再根据 `job_type` 分发到对应落库逻辑（`variants` / `revision_logs` 等）。
3. 整个处理流程需幂等：同一回调重复到达不能产生重复候选或重复日志。
4. 处理成功后返回 `ack=true`；失败返回非 2xx 让网关按策略重试。

---

## 5. `job_id` 落库规范（已实现）

数据库统一规则：

- 任务台账：`model_jobs`
- 关联字段：
  - `variants.model_job_id` -> `model_jobs.job_id`
  - `revision_logs.model_job_id` -> `model_jobs.job_id`

推荐落库顺序：

1. 调模型网关成功后先写/更新 `model_jobs`（`status=queued`）
2. 回调到达后更新 `model_jobs.status/result_payload/error_payload`
3. 产物落库时把 `model_job_id`写入 `variants` / `revision_logs`

---

## 6. 落库映射速查

- 反馈解析：`feedback_records.parsed_json`
- 模型产物：`variants`
  - 核心字段：`variant_type`, `resource_url`, `preview_url`, `round_no`, `candidate_no`, `score`, `model_provider`, `model_name`, `prompt_text`, `negative_prompt_text`, `model_job_id`
  - 锚点：
    - 资产/镜头级：`asset_id` 或 `shot_id`
    - 整集成片：`episode_version_id`（`final_cut`）
- 音色基线：`character_voice_bindings.voice_variant_id`
- 修订摘要：`revision_logs.summary_text`, `revision_logs.payload_json`, `revision_logs.model_job_id`

---

## 7. 联调顺序建议

1. 同步接口：`feedback/parse`、`audio/mix/analyze`、`revision/summarize`
2. 异步生成接口：`generation/assets`、`voice/candidates`、`generation/keyframes`、`generation/videos`、`audio/tts`、`audio/music`
3. 回调与补偿：`model-callbacks`、`jobs/{job_id}`
