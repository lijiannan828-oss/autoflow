# 28 节点规格卡（Node Spec Sheet — v2.2 含 N07b、N16b）

## 文档信息

| 项 | 值 |
|---|---|
| 文档名称 | `node-spec-sheet.md` |
| 所属 Spec | `aigc-core-orchestrator-platform` |
| 作用 | 每个管线节点的 I/O、模型、Prompt、超时、重试、质检、降级策略 |
| 当前状态 | `confirmed` — 全 6 轮已确认锁定 |
| 真相源层级 | 节点实现规格；类型定义以 `schema-contracts.md` 为准，数据库以 `data-structures.md` 为准 |

---

## 标注约定

- ✅ 已确认
- ⚠️ 已预填，待确认
- ❌ 空白，需要提供

---

## 全局模型策略（Script 阶段）

> **决策（已确认）**：脚本阶段全部使用闭源模型，闭源模型在结构化剧本输出和质检评审方面的表现明显优于开源模型。

| 用途 | 首选模型 | 备选模型 | 说明 |
|------|----------|----------|------|
| 剧本解析 / 拆镜 / 定稿 / 分级 | **Gemini 3.1** | **Claude Opus 4.6** | 结构化 JSON 输出能力强 |
| 分镜质检投票 | **GPT 5.4 + Gemini 3.1 + Claude** | — | 三模型独立评审，去极值取平均 |

---

## Stage 1 · Script 脚本阶段（N01 – N05）

---

### N01 · 主剧本结构化解析

| 字段 | 值 |
|------|-----|
| node_id | `N01` |
| 全称 | `N01_SCRIPT_EXTRACT` — 主剧本提取 |
| stage_group | `script` |
| agent_role | `script_analyst` |
| 依赖 | 无（管线起始节点） |
| is_human_gate | `false` |

#### 输入预处理

> **已确认**：剧本输入格式不固定，通常为 `.docx`（Word），内容混合了多种结构。
> N01 必须包含一个**预处理子步骤**，在调用 LLM 之前完成文档清洗。

典型输入文档结构（以实际 test-data 为参考）：

| 文档段落 | 内容 | 处理方式 |
|----------|------|----------|
| 时间表 / 制作说明 | 项目管理信息 | 提取为 `project_meta`，不传入剧本解析 |
| **剧本正文**（2.1 剧本） | 分集叙事文本：开场钩子 / 核心剧情 / 结尾悬念 | **核心输入** → LLM 解析 |
| 三幕大纲（Act 1/2/3） | 叙事结构分析 | 提取为 `narrative_arc` 辅助信息 |
| Shooting Script（分场+情绪曲线） | 已有的粗分镜：场景/角色/情绪曲线 | **质量评估**：如达标则作为 N02 参考输入，否则丢弃重写 |
| 人物形象参考 | 角色外貌 prompt + 参考图描述 | 提取为 `character_presets` |
| 制作要求 | 规格/风格/注意事项 | 提取为 `production_requirements` |

预处理步骤（代码层，不调 LLM）：
1. 解析 `.docx` → 按标题层级分段
2. 识别文档结构类型（正则 + 关键词匹配）
3. 提取剧本正文、角色预设、制作要求
4. 如果存在已有 Shooting Script，标记为 `existing_storyboard`
5. 组装为 `RawScriptInput` 传入 LLM

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<RawScriptInput>` | 预处理后的剧本文本 + 角色预设 + 制作要求 + 可选已有分镜 |
| **Output** | `NodeOutputEnvelope<ParsedScript>` | 结构化剧本：世界观、角色档案、场景档案、分集骨架（到场景级）、总体统计 |

Input 来源：项目创建时用户提交 `.docx` → 预处理 → DB → `node_run.input_ref`

Output 去向：
- `ParsedScript` JSON → TOS 存储，URI 写入 `artifacts` (type=`storyboard`)
- `character_registry` 同步写入 `character_appearance_index`
- 传递给 N02 作为输入
- `voice_config` **不在此节点确定**，延后到 N08 Stage1 审核美术资产时同步确认角色音色，N20 执行时可微调 ✅

Output 粒度：**分集 + 场景骨架**，具体镜头级拆分留给 N02 ✅

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `llm` | ✅ |
| primary_model | `Gemini 3.1` | ✅ |
| backup_model | `Claude Opus 4.6` | ✅ |
| endpoint | `Google AI API` / `Anthropic API` | ⚠️ 具体 endpoint 部署时配置 |
| temperature | `0.3` | ✅ 结构化解析低温 |
| max_tokens | `16384` | ✅ |

#### Prompt 模板

**System Prompt：**

```
你是一个专业的短剧剧本结构化分析师。你的任务是从原始剧本文本中提取以下结构化信息：

1. 世界观设定（时代、地点、基调、视觉风格、色彩基调）
2. 角色档案（外貌精确到五官/发型/肤色/体型、性格、服装方案）
3. 场景档案（地点名称、光照条件、道具、日夜变体）
4. 分集骨架（每集概要含 hook/development/climax/cliffhanger、情感基调、估计时长）
5. 场景骨架（每集内的场景划分、出场角色、场景描述、情感走势）
6. 全局统计（总集数、总场景数、估计总镜头数）

输出必须严格遵循 ParsedScript JSON Schema。

关键规则：
- 角色外貌描述必须具体到五官、发型、肤色、体型，绝对不能含糊
- 每个场景必须关联到具体 location_id
- 分集概要需包含 hook / development / climax / cliffhanger 四段式
- 单集时长按短剧节奏估算（50-90s）
- 本阶段不需要拆到镜头级，镜头拆分由下游 N02 完成
- 如果输入中包含已有分镜参考（existing_storyboard），提取其中的场景/角色/情绪信息作为辅助，但不直接采信镜头划分
```

**User Prompt：**

```
## 剧本正文
{raw_script_input.script_text}

## 三幕结构（如有）
{raw_script_input.narrative_arc | json}

## 角色预设
{raw_script_input.character_presets | json}

## 已有分镜参考（如有）
{raw_script_input.existing_storyboard | json}

## 制作要求
- 体裁: {genre}
- 风格标签: {style_tags}
- 目标画幅: {aspect_ratio}
- 总集数: {total_episodes}
- 单集时长: {episode_duration_sec}s
- 主语言: {primary_language}

请输出完整的 ParsedScript JSON。
```

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `120` | ✅ |
| max_retries | `3` | ✅ |
| retry_backoff | `exponential (2s, 4s, 8s)` | ✅ |
| candidate_count | `1` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `storyboard` | episode_version | ParsedScript 完整 JSON |
| `prompt_json` | episode_version | 本次 LLM 调用的完整 prompt |

---

### N02 · LLM 拆集拆镜

| 字段 | 值 |
|------|-----|
| node_id | `N02` |
| 全称 | `N02_EPISODE_SHOT_SPLIT` — LLM 拆集拆镜 |
| stage_group | `script` |
| agent_role | `director` |
| 依赖 | `N01` |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ parsed_script: ParsedScript, episode_index: number }>` | N01 的结构化剧本 + 当前处理的集号 |
| **Output** | `NodeOutputEnvelope<EpisodeScript>` | 单集完整数据：场景→镜头级规格 |

**调用方式**：按集逐个调用 ✅ — Supervisor 为每集创建一个独立的 N02 node_run

核心转换：从「叙事骨架」→「镜头级生产规格」

Output 关键字段：
- 每个 `ShotSpec`：shot_type, camera_movement, action_description, visual_prompt (英文), negative_prompt, characters_in_shot, dialogue, duration_sec, keyframe_specs **骨架**
- 每个 `SceneSpec`：bgm_config.mood, emotional_progression
- 自动编号：scene_number, shot_number, global_shot_index
- `keyframe_specs` 只出**时间点 + 构图描述**（骨架），详细生成参数由 N10 填充 ✅

#### 已有分镜的处理逻辑

如果 N01 标记了 `existing_storyboard`（输入文档中包含已有 Shooting Script）：

```
if existing_storyboard exists for this episode:
    1. LLM 评估已有分镜质量（场景完整性、镜头覆盖度、prompt 可执行性）
    2. if 质量达标:
         → 基于已有分镜生成 ShotSpec[]，补充缺失字段
    3. else:
         → 忽略已有分镜，从 ParsedScript 叙事重新拆分
```

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `llm` | ✅ |
| primary_model | `Gemini 3.1` | ✅ |
| backup_model | `Claude Opus 4.6` | ✅ |
| temperature | `0.5` | ✅ 创作性任务温度略高 |
| max_tokens | `32768` | ✅ |

#### Prompt 模板

**System Prompt：**

```
你是一个专业的短剧导演 AI。你的任务是将结构化剧本的一集拆解为可直接用于 AIGC 生产的镜头级规格。

对本集的每个场景，你需要：
1. 将场景拆分为具体镜头（ShotSpec）
2. 为每个镜头指定：
   - shot_type（景别）、camera_movement（运镜）
   - visual_prompt（正向提示词，必须用英文，面向图像/视频生成模型）
   - negative_prompt（负向提示词，英文）
   - 出场角色及其位置、动作、表情
   - 对白（含情感标签和时间窗口估算）
   - 预估时长（0.5s 粒度）
   - 关键帧骨架（keyframe_specs: 关键时间点比例 + 构图描述，不需要填生成参数）
3. 为每个场景指定 BGM 配置（mood + intensity curve）

关键规则：
- 短剧节奏极快，单个镜头 1-3s，平均约 2s
- 单集 50-90s 对应约 30-60 个镜头
- visual_prompt 必须用英文，包含具体画面描述（人物、场景、光线、构图、情绪）
- 对白时间窗口 = 文字长度 / 语速估算（中文 ~4 字/秒，英文 ~2.5 词/秒）
- 每集 target_duration_sec 必须被镜头时长之和覆盖（允许 ±10% 误差）
- camera_movement 必须在支持列表内: static, pan_left, pan_right, tilt_up, tilt_down, dolly_in, dolly_out, tracking, crane_up, handheld, zoom_in, zoom_out, orbital, whip_pan
- 每集需要前置 3-5s 高光镜头闪回再进入正片

输出 JSON Schema: EpisodeScript
```

**User Prompt：**

```
## 结构化剧本（全局上下文）
{parsed_script.world_setting | json}
{parsed_script.character_registry | json}
{parsed_script.location_registry | json}

## 本集信息
{parsed_script.episodes[episode_index] | json}

## 已有分镜参考（如有）
{existing_storyboard_for_episode | json}

请将本集拆分为场景→镜头级规格，输出完整的 EpisodeScript JSON。
```

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `300` | ✅ |
| max_retries | `3` | ✅ |
| retry_backoff | `exponential (5s, 15s, 45s)` | ✅ |
| candidate_count | `1` | ✅ |
| execution_mode | `per_episode` | ✅ 按集逐个调用 |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `storyboard` | episode_version | 单集 EpisodeScript JSON |
| `prompt_json` | episode_version | 拆镜 prompt 记录 |

---

### N03 · 分镜质量检验

| 字段 | 值 |
|------|-----|
| node_id | `N03` |
| 全称 | `N03_STORYBOARD_QC` — 分镜质量检验 |
| stage_group | `script` |
| agent_role | `quality_guardian` |
| 依赖 | `N02` |
| is_human_gate | `false` |
| reject_target | `N02` |
| max_auto_rejects | `3` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<EpisodeScript>` | N02 输出的单集完整分镜 |
| **Output** | `NodeOutputEnvelope<{ scores: QualityScore[], issues: QualityIssue[], decision: "pass" \| "reject" }>` | 多模型评分 + 问题列表 + 通过/打回决策 |

#### 模型配置（三模型投票）✅

| 投票位 | 模型 | 来源 |
|--------|------|------|
| model_1 | **GPT 5.4** | OpenAI API |
| model_2 | **Gemini 3.1** | Google AI API |
| model_3 | **Claude** (Sonnet/Opus) | Anthropic API |

投票规则 ✅：
- 3 模型分别独立评分（相同 prompt）
- 去极值取平均：去掉最高分和最低分，取中间值
- 如果只有 2 模型可用（降级），取二者平均

> N03 阶段分镜尚未经过 N05 分级，因此统一使用三模型投票。
> `qc_tier` 分级投票策略从 N11（关键帧质检）开始生效。

#### Prompt 模板

**System Prompt：**

```
你是一个专业的短剧分镜质检专家。你的任务是评审 AI 导演生成的镜头级分镜规格，从以下维度打分（1-10 分）：

评分维度：
1. 叙事连贯性（narrative_coherence）— 镜头之间的故事逻辑是否顺畅，是否有跳跃或断裂
2. 视觉可行性（visual_feasibility）— visual_prompt 是否能被 AIGC 生图/生视频模型有效执行
3. 节奏感（pacing）— 镜头时长分配是否符合短剧快节奏（1-3s/镜头），整体是否有张弛
4. 角色一致性（character_consistency）— 角色出场、对白、表情是否与人设和剧情匹配
5. 技术规范性（technical_compliance）— camera_movement 是否可实现、时长是否合理、编号是否连续
6. 情感表达力（emotional_impact）— 关键场景的戏剧张力是否足够，开头钩子和结尾悬念是否到位

对每个发现的问题，标注：
- severity: "critical"（必须修改，打回）/ "major"（强烈建议修改）/ "minor"（可选优化）
- 关联的 shot_id
- 具体描述和修改建议

输出 JSON:
{
  "dimensions": { "narrative_coherence": n, "visual_feasibility": n, "pacing": n, "character_consistency": n, "technical_compliance": n, "emotional_impact": n },
  "weighted_average": number,
  "issues": [{ "dimension": "...", "severity": "critical|major|minor", "shot_id": "...", "description": "...", "suggestion": "..." }],
  "overall_comment": "..."
}
```

#### 质检配置

| 字段 | 值 | 状态 |
|------|-----|------|
| quality_threshold | **`8.0`** | ✅ |
| scoring_scale | `1-10` | ✅ |
| voting_strategy | `drop_extremes_average` | ✅ 去极值取平均 |
| dimensions | 6 维（叙事/视觉/节奏/角色/技术/情感） | ✅ |
| dimension_weights | narrative_coherence 0.20, visual_feasibility 0.20, pacing 0.15, character_consistency 0.15, technical_compliance 0.15, emotional_impact 0.15 | ✅ |

#### 自动打回逻辑

```
if weighted_average < 8.0:
    status = "auto_rejected"
    create_return_ticket(
        source_type = "auto_qc",
        source_node_id = "N03",
        reject_target_node_id = "N02",
        issues = quality_issues,
        rerun_hint = "基于质检反馈修改不达标镜头，重新拆分本集"
    )
```

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `180` | ✅ (3 模型并行调用) |
| max_retries | `2` | ✅ |
| retry_backoff | `exponential (3s, 9s)` | ✅ |
| candidate_count | `1` | ✅ |
| execution_mode | `per_episode` | ✅ 按集质检 |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `storyboard` | episode_version | 质检结果 JSON（scores + issues） |
| `prompt_json` | episode_version | 质检 prompt 记录（3 模型各一份） |

---

### N04 · 分镜定稿

| 字段 | 值 |
|------|-----|
| node_id | `N04` |
| 全称 | `N04_STORYBOARD_FREEZE` — 分镜定稿 |
| stage_group | `script` |
| agent_role | `director` |
| 依赖 | `N03`（通过后） |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ episode: EpisodeScript, qc_result: { scores: QualityScore[], issues: QualityIssue[] } }>` | N02 的分镜 + N03 的质检结果 |
| **Output** | `NodeOutputEnvelope<EpisodeScript>` | 定稿版分镜：整合 minor 建议、锁定关键字段 |

核心逻辑：
- 如果 N03 输出 0 个 issue → **跳过 LLM 调用**，直接标记 frozen 输出 ✅
- 如果有 minor issues → Director Agent 用 LLM 自动微调
- critical/major issues 不会到达此处（已被 N03 自动打回）

定稿锁定范围 ✅：
- **锁定**（下游不可修改）：`dialogue.text`, `shot_type`, `camera_movement`, `duration_sec`, `characters_in_shot`, `shot_number`, `global_shot_index`
- **可精化**（下游允许优化）：`visual_prompt`, `negative_prompt`, `keyframe_specs`

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `llm` (条件调用) | ✅ |
| primary_model | `Gemini 3.1` | ✅ |
| backup_model | `Claude Opus 4.6` | ✅ |
| temperature | `0.2` | ✅ 定稿阶段低温确保稳定 |
| max_tokens | `32768` | ✅ |
| skip_if_no_issues | `true` | ✅ 无 issue 时直接盖章 |

#### Prompt 模板（仅当有 minor issues 时调用）

**System Prompt：**

```
你是短剧导演 AI 的定稿模块。你将收到：
1. 完整的分镜规格（EpisodeScript）
2. 质检评审结果中的 minor issues

你的任务：
- 对 severity=minor 的问题：直接修正相应字段
- 对已通过的部分：保持原样，不过度修改
- 确保所有 visual_prompt 语法正确、可被生成模型执行
- 确保对白时间窗口与镜头时长一致
- 确保角色出场与 character_registry 一致
- 修改处填写 _diff_notes 说明改动理由

输出与输入格式完全相同的 EpisodeScript。
```

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `240` | ✅ |
| max_retries | `2` | ✅ |
| retry_backoff | `exponential (3s, 9s)` | ✅ |
| candidate_count | `1` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `storyboard` | episode_version | 定稿 EpisodeScript JSON（frozen 标记） |

---

### N05 · 镜头分级与编号标注

| 字段 | 值 |
|------|-----|
| node_id | `N05` |
| 全称 | `N05_SHOT_LEVELING` — 镜头分级&编号标注 |
| stage_group | `script` |
| agent_role | `director` |
| 依赖 | `N04` |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<EpisodeScript>` | N04 定稿后的分镜 |
| **Output** | `NodeOutputEnvelope<EpisodeScript>` | 每个 ShotSpec 补充：`difficulty`(S0/S1/S2)、`qc_tier`(tier_1/2/3) |

#### 分级规则 ✅

**ShotDifficulty — 生产难度**（决定候选数量和模型选择）：

| 等级 | 定义 | 典型场景 | 候选数 |
|------|------|----------|--------|
| **S0** | 静态/近景对话，1 角色，无运镜 | 特写独白、空镜、道具插入 | 1-2 |
| **S1** | 中景多角色，简单运镜 | 双人对话、标准走位、pan/tilt | 2-3 |
| **S2** | 远景群戏/复杂运镜/动作场面 | 宴会全景、追逐、tracking/crane/orbital | 3-4 |

**QCTier — 质检等级**（决定下游 N11/N15 质检模型数量）：

| 等级 | 触发条件 | 投票模型数 |
|------|----------|------------|
| **tier_1_full** | S2 镜头 **或** 剧情关键节点 | 3 模型 |
| **tier_2_dual** | S1 镜头 | 2 模型 |
| **tier_3_single** | S0 镜头 | 1 模型 |

> qc_tier 不与 difficulty 严格 1:1。剧情关键节点（每集的开场钩子、高潮、结尾悬念对应的镜头）即使是 S0 也提升为 tier_1。LLM 自行判断关键节点。✅

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `llm` | ✅ |
| primary_model | `Gemini 3.1` | ✅ |
| backup_model | `Claude Opus 4.6` | ✅ |
| temperature | `0.2` | ✅ 分级需要稳定 |
| max_tokens | `16384` | ✅ |

#### Prompt 模板

**System Prompt：**

```
你是 AIGC 生产管线的镜头难度分级专家。你的任务是为每个镜头分配生产难度和质检等级。

1. difficulty（生产难度）:
   - S0: 静态镜头、单角色近景对话、无运镜、简单场景、空镜/道具插入
   - S1: 多角色中景、简单运镜（pan/tilt/zoom）、标准场景
   - S2: 群戏远景、复杂运镜（tracking/crane/orbital/whip_pan）、动作/追逐场面

2. qc_tier（质检等级）:
   - tier_1_full: S2 镜头，或虽非 S2 但属于剧情关键节点（开场钩子、高潮、结尾悬念对应镜头）
   - tier_2_dual: S1 镜头（非关键节点）
   - tier_3_single: S0 镜头（非关键节点）

判断依据：
- 角色数量和互动复杂度
- camera_movement 类型和实现难度
- 场景复杂度（多道具、光照变化、室内外切换）
- 是否有对白和唇形同步需求
- 是否处于叙事关键位置（开场、转折、高潮、结尾）

输出：为每个 shot_id 返回 { difficulty, difficulty_reason, qc_tier, qc_tier_reason }
```

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `120` | ✅ |
| max_retries | `2` | ✅ |
| retry_backoff | `exponential (2s, 6s)` | ✅ |
| candidate_count | `1` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `storyboard` | episode_version | 含分级信息的最终 EpisodeScript |

---

## N01-N05 数据流总览

```
用户提交 .docx 剧本文件
    │
    ▼
┌──────────────┐
│  预处理子步骤  │  解析 docx → 识别结构 → 提取剧本/角色/要求/已有分镜
└──────┬───────┘
       │  RawScriptInput
       ▼
┌─────────┐     RawScriptInput
│   N01   │ ──────────────────► ParsedScript
│ 剧本解析 │     (世界观 + 角色 + 场景 + 分集骨架)
│Gemini3.1│     粒度: 分集+场景级
└────┬────┘
     │
     ▼  (按集逐个调用)
┌─────────┐     ParsedScript + episode_index
│   N02   │ ──────────────────► EpisodeScript (per episode)
│ 拆集拆镜 │     (场景→镜头级: 30-60 shots/集, 1-3s/shot)
│Gemini3.1│     visual_prompt 全英文
└────┬────┘     keyframe_specs 只出骨架
     │
     ▼
┌─────────┐     EpisodeScript
│   N03   │ ──────────────────► QualityScore + QualityIssue[]
│ 分镜质检 │     三模型投票: GPT5.4 + Gemini3.1 + Claude
│ 3-model │     去极值取平均, 阈值 8.0
└────┬────┘     ──[<8.0]──► 打回 N02 (max 3次)
     │ [≥8.0 通过]
     ▼
┌─────────┐     EpisodeScript + QC issues
│   N04   │ ──────────────────► EpisodeScript (frozen)
│ 分镜定稿 │     无 issue → 直接盖章
│Gemini3.1│     有 minor → LLM 微调
└────┬────┘     锁定: dialogue/shot_type/camera/duration/characters
     │
     ▼
┌─────────┐     EpisodeScript (frozen)
│   N05   │ ──────────────────► EpisodeScript (frozen + graded)
│ 镜头分级 │     每 shot → difficulty(S0/S1/S2) + qc_tier
│Gemini3.1│     关键节点: 即使 S0 也提升 tier_1
└────┬────┘
     │
     ▼
   N06 (Art 阶段入口)
```

---

## Round 1 已确认决策汇总

| # | 决策 | 结论 |
|---|------|------|
| M1 | 脚本阶段主模型 | ✅ Gemini 3.1 |
| M2 | 备选模型 | ✅ Claude Opus 4.6 |
| M3 | 质检投票模型 | ✅ GPT 5.4 + Gemini 3.1 + Claude（三模型） |
| P1 | N01 解析粒度 | ✅ 分集 + 场景骨架 |
| P2 | voice_config 时机 | ✅ N08 Stage1 审核时确认角色音色，N20 执行时可微调 |
| P3 | 输入格式 | ✅ .docx，结构不固定，需预处理 |
| P4 | visual_prompt 语言 | ✅ 全英文 |
| P5 | 单集镜头数 | ✅ 30-60 个（1-3s/shot，单集 50-90s） |
| P6 | N02 调用方式 | ✅ 按集逐个调用 |
| P7 | keyframe_specs 在 N02 | ✅ 只出骨架 |
| P8 | N04 无 issue 时跳过 LLM | ✅ 是 |
| Q1 | 评分维度 | ✅ 6 维先沿用，后续看输出调整 |
| Q2 | 通过阈值 | ✅ 8.0 |
| Q3 | 投票策略 | ✅ 去极值取平均 |
| Q4 | S0/S1/S2 分级 | ✅ 先沿用 |
| Q5 | qc_tier 含剧情权重 | ✅ 关键节点 S0 也提升 tier_1 |
| Q6 | 候选数量 | ✅ S0→1-2, S1→2-3, S2→3-4 |

---

## Stage 2 · Art 美术阶段（N06 – N09）

> 本阶段将 N05 输出的分镜规格转化为**可视化美术资产**：角色基线图、场景背景、道具参考。
> 人工在 Gate Stage1 资产级审核后，锁定美术基线供下游关键帧和视频使用。

---

### N06 · 视觉元素生成（Prompt + Workflow 构建）

| 字段 | 值 |
|------|-----|
| node_id | `N06` |
| 全称 | `N06_VISUAL_ELEMENT_GEN` — 视觉元素生成 |
| stage_group | `art` |
| agent_role | `visual_director` |
| 依赖 | `N04` + `N05` |
| is_human_gate | `false` |

> **关键特性**：N06 **不生成图像**，只生成 Prompt 和 ComfyUI Workflow JSON。
> 实际图像生成在 N07 完成。N06 是"视觉策划"节点，N07 是"视觉执行"节点。

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ episodes: EpisodeScript[], character_registry: CharacterProfile[], location_registry: LocationProfile[] }>` | N04/N05 定稿分镜 + 角色档案 + 场景档案 |
| **Output** | `NodeOutputEnvelope<{ art_generation_plan: ArtGenerationPlan }>` | 每个资产的生成方案：精炼 prompt、模型选择、ComfyUI workflow JSON、参考图策略 |

Output 核心结构 `ArtGenerationPlan`（新增应用层类型）：

```typescript
interface ArtGenerationPlan {
  characters: CharacterArtPlan[];
  locations: LocationArtPlan[];
  props: PropArtPlan[];
}

interface CharacterArtPlan {
  character_id: string;
  base_prompt: string;           // 英文，角色基线图 prompt
  negative_prompt: string;
  costume_prompts: { costume_id: string; prompt: string }[];
  expression_variants: EmotionTag[];
  reference_strategy: "firered_multiref" | "ip_adapter" | "none";
  reference_images: StorageRef[];
  comfyui_workflow_id: string;
  candidate_count: number;       // 生成几个候选
  resolution: { width: number; height: number };
}

interface LocationArtPlan {
  location_id: string;
  time_variants: { time_of_day: string; prompt: string }[];
  negative_prompt: string;
  comfyui_workflow_id: string;
  candidate_count: number;
  resolution: { width: number; height: number };
}

interface PropArtPlan {
  prop_id: string;
  prompt: string;
  negative_prompt: string;
  comfyui_workflow_id: string;
  candidate_count: number;
}
```

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `llm` | ✅ |
| primary_model | `Gemini 3.1` | ✅ prompt 质量直接决定 N07 出图效果，闭源更优 |
| backup_model | `Claude Opus 4.6` | ✅ |
| temperature | `0.6` | ✅ prompt 创作需要适度创造性 |
| max_tokens | `16384` | ✅ |

#### Prompt 模板

**System Prompt：**

```
你是一个 AIGC 视觉总监。你的任务是为每个角色、场景、道具设计精确的图像生成方案。

你将收到：
1. 定稿分镜（含角色出场统计、场景使用频率）
2. 角色档案（CharacterProfile: 外貌、服装、参考图）
3. 场景档案（LocationProfile: 描述、光照、道具）

对于每个角色，你需要输出：
- base_prompt: 英文正向 prompt，格式为 "Film still, ultra photorealistic, Medium shot, Half-body portrait, [角色具体外貌], [服装], grey background, studio lighting"
- negative_prompt: 排除不需要的元素
- costume_prompts: 每套服装一个变体 prompt
- expression_variants: 需要哪些表情变体
- reference_strategy: 角色一致性策略（firered_multiref / ip_adapter）
- candidate_count: 候选数量（主角 4-6，配角 2-3，群演 1-2）  ✅ 已确认
- resolution: 输出分辨率

对于每个道具，你需要输出：
- 独立的 prompt + negative_prompt  ✅ 道具独立生成已确认
- candidate_count: 1-2

对于每个场景，你需要输出：
- 多时段变体（日/夜/黄昏）的 prompt
- 场景道具和光照细节

关键规则：
- 所有 prompt 必须英文
- 角色外貌描述必须与 CharacterProfile 完全一致（五官、发色、肤色、体型）
- 人物形象风格: 真人写实，超写实风格
- 避免亚洲面孔（除非剧本明确要求），目标受众为欧美市场
- 反派角色五官可以更立体、有棱角
- reference_strategy 默认使用 firered_multiref（角色一致性最佳）
```

✅ **已确认决策**：
1. **角色候选数量** — ✅ 主角 4-6、配角 2-3、群演 1-2
2. **场景候选数量** — ✅ 每时段 2-3 个
3. **角色一致性策略** — ✅ 组合方案：N07 用 FLUX.2 Dev 出基线候选 → N08 人工选最佳 → N09 用 FireRed MultiRef 固化全套变体。FireRed 同时保留测试
4. **输出分辨率** — ✅ 角色 1024×1536（3:4 竖版半身），场景 1920×1080（16:9），不超分到 4K
5. **道具独立生成** — ✅ 道具单独生成（不在场景图中附带）

#### RAG 注入

| RAG 来源 | 用途 |
|----------|------|
| 风格参考图库 | 注入视觉基调参考（色彩/光影/构图风格） |
| 历史项目美术资产 | 类似题材的成功案例参考 |
| ComfyUI workflow 模板库 | 匹配最佳 workflow 模板 |

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `180` | ✅ |
| max_retries | `3` | ✅ |
| retry_backoff | `exponential (3s, 9s, 27s)` | ✅ |
| candidate_count | N/A | N06 不生成图，候选数量写入 ArtGenerationPlan |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `prompt_json` | episode_version | ArtGenerationPlan 完整 JSON |
| `comfyui_workflow` | episode_version | 生成的 ComfyUI workflow JSON 文件 |

---

### N07 · 美术产品图生成

| 字段 | 值 |
|------|-----|
| node_id | `N07` |
| 全称 | `N07_ART_ASSET_GEN` — 美术产品图生成 |
| stage_group | `art` |
| agent_role | `visual_director` |
| 依赖 | `N06` |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<ArtGenerationPlan>` | N06 输出的生成方案 |
| **Output** | `NodeOutputEnvelope<{ asset_candidate_sets: CandidateSet<ArtAssetCandidate>[] }>` | 每个资产的多候选图 |

核心转换：ArtGenerationPlan → ComfyUI 批量生成 → 多候选图像集

```typescript
interface ArtAssetCandidate {
  asset_type: "character_base" | "character_costume" | "character_expression" | "location" | "prop";
  target_id: string;           // character_id / location_id / prop_id
  variant_tag: string;         // "base" / "costume_formal" / "expression_happy" / "day" / "night"
  image: StorageRef;
  seed: number;
  generation_model: string;
  generation_params: Record<string, unknown>;
}
```

#### 模型配置（ComfyUI 图像生成）

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `comfyui` | ✅ |
| comfyui_workflow_id | `wf-art-assets` | ⚠️ 占位，需真实 workflow |

**生成模型矩阵**：

| 资产类型 | 首选模型 | 备选模型 | ComfyUI 节点 | 状态 |
|----------|----------|----------|-------------|------|
| 角色基线图 | `FLUX.2 Dev` | `Z-Image-Turbo` | I-image, Turbo | ✅ |
| 角色服装变体 | `FLUX.2 Dev` | `Z-Image-Turbo` | I-image, Turbo | ✅ |
| 角色表情变体 | `FLUX.2 Dev` + `FireRed-1.1` | — | FireRed MultiRef | ✅ |
| 场景背景 | `FLUX.2 Dev` | `Z-Image-Turbo` | I-image | ✅ 不固化 |
| 道具 | `FLUX.2 Dev` | `Z-Image-Turbo` | Turbo | ✅ 独立生成 |

✅ **已确认决策**：
1. **角色基线图首选 FLUX.2 Dev** — ✅ 两个模型（FLUX.2 Dev + FireRed）都保留，后续实测选优
2. **角色一致性** — ✅ 组合方案：N07 FLUX 出基线 → N08 人工选 → N09 FireRed 固化
3. **ComfyUI workflow** — ✅ 先出骨架 JSON，后续找开源好用的替代
4. **批量生成策略** — ✅ 所有资产并行提交到 ComfyUI 集群

#### 角色一致性策略

> 这是美术阶段最关键的技术问题：如何保证同一角色在不同服装、表情、角度下外貌一致。

方案（✅ 已确认：组合方案）：

| 策略 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| **FireRed MultiRef** | 用 3 张参考图 + FireRed 做多参考一致性 | 一致性最好 | 需要先有好的参考图 |
| **IP-Adapter** | 用 IP-Adapter 注入角色特征 | 灵活、效果好 | 参数调优复杂 |
| **ControlNet + 参考图** | 用 ControlNet OpenPose/Depth 控制姿态 | 姿态精确 | 只控姿态不控脸 |
| **组合方案** | N07 先 FLUX 出基线 → 人工选最佳 → N09 用 FireRed 固化所有变体 | 分步保障 | 需要两步 |

> ✅ **已确认方案：组合方案** — N07 用 FLUX.2 Dev 出角色候选，人工（N08 Gate）选出最佳基线，N09 用 FireRed MultiRef 基于选定基线批量生成所有服装/表情变体。人工选的是"基线脸"，后续一致性靠 FireRed 锁定。

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `1800` | ✅ (~25min，多资产多候选) |
| max_retries | `2` | ✅ (ComfyUI OOM 后重试意义有限) |
| retry_backoff | `exponential (10s, 30s)` | ✅ |
| execution_mode | `parallel_per_asset` | ✅ 所有资产并行提交到 ComfyUI 集群 |

#### 产物（Artifacts）

| artifact_type | anchor_type | anchor_id | 说明 |
|---------------|-------------|-----------|------|
| `art_asset` | asset | character_id | 每个角色候选图（多张） |
| `art_asset` | asset | location_id | 每个场景候选图 |
| `art_asset` | asset | prop_id | 每个道具候选图 |
| `comfyui_workflow` | episode_version | — | 实际执行的 workflow JSON |

---

### N07b · 核心角色音色生成（v2.2 新增）

| 字段 | 值 |
|------|-----|
| node_id | `N07b` |
| 全称 | `N07b_VOICE_GEN` — 核心角色音色生成 |
| stage_group | `art` |
| agent_role | `audio_director` |
| 依赖 | `N06`（角色档案 CharacterProfile[]） |
| is_human_gate | `false` |
| 并行关系 | **与 N07 并行执行** |

> Audio Director 在美术阶段即介入，为核心角色生成音色候选样本。与 N07 美术图生成并行，在 N08 Gate Stage1 中由剪辑中台同步确认音色。

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ characters: CharacterProfile[], voice_requirements: VoiceRequirement[] }>` | 角色档案 + 音色需求（性别/年龄/风格/情感） |
| **Output** | `NodeOutputEnvelope<{ voice_candidates: CandidateSet<VoiceSample>[] }>` | 每角色 2-3 个音色候选样本 |

Output 去向：
- 音色候选样本 → TOS 存储
- 候选列表传递给 N08 Gate，由剪辑中台试听选定
- 选定音色写入 CharacterProfile.voice_config，供 N20 TTS 使用

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `tts` | ✅ |
| primary_model | `CosyVoice`（中文） / `ElevenLabs`（英文） | ✅ |
| endpoint | 自部署 GPU / 第三方 API | ✅ |

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `600` | ✅ (~10min，多角色多候选) |
| max_retries | `2` | ✅ |
| retry_backoff | `exponential (5s, 15s)` | ✅ |
| execution_mode | `parallel_per_character` | ✅ 各角色并行生成 |
| candidate_count | `2-3 per character` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | anchor_id | 说明 |
|---------------|-------------|-----------|------|
| `tts` | asset | character_id | 每个角色的音色候选音频样本 |

---

### N08 · Gate Stage1 — 美术资产人工审核

| 字段 | 值 |
|------|-----|
| node_id | `N08` |
| 全称 | `N08_ART_HUMAN_GATE` — 美术产品人类检确 |
| stage_group | `art` |
| agent_role | `review_dispatcher` |
| 依赖 | `N07` ∥ `N07b`（两者均完成后触发） |
| is_human_gate | **`true`** |

#### Gate 配置

| 字段 | 值 | 状态 |
|------|-----|------|
| stage_no | `1` | ✅ |
| reviewer_role | `middle_platform`（剪辑中台） | ✅ |
| review_granularity | `asset`（资产级 + 音色选定） | ✅ |
| review_steps | `[{ step_no: 1, reviewer_role: "middle_platform", skippable: false, granularity: "asset" }]` | ✅ |

#### 审核流程

1. N07 和 N07b **均完成后**，Supervisor 为每集创建 **1 个 ReviewTask**
2. 剪辑中台在 OpenClaw 审核界面中看到所有角色/场景/道具的候选图 **+ 核心角色音色候选**
3. 对每个资产：
   - **选定最佳候选**（selected_candidate_id）
   - 或 **全部打回**（附修改意见，触发 ReturnTicket → 回到 N06 重新生成 prompt → N07 重新出图）
4. 对每个核心角色音色：
   - **试听并选定音色**（selected_voice_candidate_id）
   - 选定音色写入 CharacterProfile.voice_config
5. 所有资产+音色确认完毕 → ReviewTask approved → 放行到 N09

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `CandidateSet<ArtAssetCandidate>[]` + `CandidateSet<VoiceSample>[]` | N07 输出的多资产多候选图集 + N07b 输出的音色候选 |
| **Output** | `HumanReview` | 每个资产的选定 candidate_id + 修改意见（如有） |

#### 审核界面需求（OpenClaw）

- 按资产类型分组展示：角色 → 场景 → 道具
- 每个资产展示所有候选图，支持左右对比
- 角色要展示：基线图 + 服装变体 + 表情变体
- ✅ **展示角色档案（CharacterProfile）**作为审核参考对照
- ✅ **支持单个资产打回**（附文字修改意见），不影响其他资产
- 支持全部通过 / 部分通过
- ✅ **支持自然语言改图**：审核员可输入自然语言修改指令（如"眼睛放大一点"、"发色调暗一些"），系统调用模型基于指令重新生成该资产候选

✅ **已确认决策**：
1. **打回粒度** — ✅ 支持单个资产独立打回（只重做某角色/场景/道具）
2. **审核参考** — ✅ 审核页面呈现角色档案（CharacterProfile）文本作为对照
3. **自然语言改图** — ✅ 审核员可在页面上通过自然语言指令微调候选图（调用模型重新生成）

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `0` (人工无超时) | ✅ |
| max_retries | N/A | ✅ |

---

### N09 · 美术产品定稿（固化基线）

| 字段 | 值 |
|------|-----|
| node_id | `N09` |
| 全称 | `N09_ART_FREEZE` — 美术产品定稿 |
| stage_group | `art` |
| agent_role | `visual_director` |
| 依赖 | `N08`（通过后） |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ selected_assets: { asset_id: string, selected_candidate_id: string }[], art_plan: ArtGenerationPlan }>` | N08 审核选定的候选 + 原始生成方案 |
| **Output** | `NodeOutputEnvelope<{ frozen_assets: FrozenArtAsset[] }>` | 高保真固化的美术基线资产集 |

核心动作：
1. 以人工选定的角色基线图为**锚点参考**
2. 用 FireRed-1.1 MultiRef 基于锚点生成**全套变体**：
   - 所有服装 × 所有表情 × 关键角度（正面/3/4侧）
3. 场景和道具：选定候选直接固化（无需 FireRed）
4. 所有固化图上传 TOS，写入 `artifacts` (type=`art_asset`)，标记 `frozen=true`

```typescript
interface FrozenArtAsset {
  asset_type: "character" | "location" | "prop";
  target_id: string;
  base_image: StorageRef;          // 人工选定的基线图
  variants: {
    variant_tag: string;           // "costume_formal_front" / "expression_happy_front"
    image: StorageRef;
    generated_from: "firered_multiref" | "direct_selection";
  }[];
  frozen_at: string;               // ISO 8601
}
```

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `comfyui` | ✅ |
| primary_model | `FireRed-1.1` | ✅ 角色一致性固化（FLUX.2 Dev 也保留测试） |
| comfyui_workflow_id | `wf-art-freeze` | ⚠️ 占位，需骨架 workflow |
| comfyui_nodes | `FireRed MultiRef + BatchRun` | ✅ |

✅ **已确认决策**：
1. **FireRed 参考图** — ✅ 3 张参考图（正面+3/4侧+全身）
2. **变体数量** — ✅ 每部剧每角色 5-10 个变体（服装×表情×关键角度，按角色重要性动态调整）
3. **场景图** — ✅ 不需要 FireRed 固化，N07 选定即为最终版（场景不做固化）
4. **固化分辨率** — ✅ 保持 N07 分辨率，不超分到 4K

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `600` | ✅ (FireRed 批量生成较慢) |
| max_retries | `2` | ✅ |
| retry_backoff | `exponential (10s, 30s)` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | anchor_id | 说明 |
|---------------|-------------|-----------|------|
| `art_asset` | asset | character_id | 固化角色基线 + 全套变体 |
| `art_asset` | asset | location_id | 固化场景图 |
| `art_asset` | asset | prop_id | 固化道具图 |
| `comfyui_workflow` | episode_version | — | FireRed 固化 workflow |

---

## N06-N09 数据流总览

```
N05 定稿分镜 (frozen + graded)
  │
  ├── character_registry
  ├── location_registry
  ├── ShotSpec[] (含 visual_prompt)
  │
  ▼
┌─────────┐     ParsedScript + 角色/场景档案
│   N06   │ ──────────────────► ArtGenerationPlan
│视觉元素  │     (每个资产的 prompt + workflow + 候选数 + 参考策略)
│Gemini3.1│     ** 不生成图 **
└────┬────┘
     │
     ▼
┌─────────┐     ArtGenerationPlan
│   N07   │ ──────────────────► CandidateSet<ArtAssetCandidate>[]
│美术图生成│     FLUX.2 Dev + FireRed → ComfyUI 并行生成
│ ComfyUI │     主角 4-6 / 配角 2-3 / 群演 1-2 / 场景 2-3 / 道具独立
└────┬────┘
     │
     ▼
┌─────────┐     CandidateSet<ArtAssetCandidate>[]
│   N08   │     Gate Stage1: 剪辑中台，资产级审核
│  Gate   │     选定每个资产最佳候选 / 打回修改
│ Stage1  │     ──[打回]──► ReturnTicket → N06
└────┬────┘
     │ [全部通过]
     ▼
┌─────────┐     selected candidates + ArtGenerationPlan
│   N09   │ ──────────────────► FrozenArtAsset[]
│美术定稿  │     FireRed-1.1 MultiRef: 基于选定基线生成全套变体
│ FireRed │     角色: 服装×表情×角度 / 场景: 直接固化
└────┬────┘
     │
     ▼
   N10 (Keyframe 阶段入口)
   下游消费: 所有关键帧/视频生成都引用 FrozenArtAsset 作为角色一致性锚点
```

---

## Round 2 已确认决策汇总

| # | 决策 | 结论 |
|---|------|------|
| M1 | N06 prompt 工程模型 | ✅ Gemini 3.1（闭源，prompt 质量直接决定出图效果） |
| M2 | N07 角色基线图模型 | ✅ FLUX.2 Dev + FireRed-1.1 均保留，后续实测选优 |
| M3 | 角色一致性方案 | ✅ 组合方案：N07 FLUX 出基线 → N08 人工选 → N09 FireRed 固化 |
| A1 | 角色候选数量 | ✅ 主角 4-6 / 配角 2-3 / 群演 1-2 |
| A2 | 场景候选数量 | ✅ 每时段 2-3 |
| A3 | 道具生成 | ✅ 独立生成，不附带在场景图中 |
| A4 | 输出分辨率 | ✅ 角色 1024×1536 / 场景 1920×1080，不超分到 4K |
| A5 | FireRed 参考图 | ✅ 3 张（正面+3/4侧+全身） |
| A6 | 角色变体控制 | ✅ 每部剧每角色 5-10 个变体 |
| A7 | 场景图固化 | ✅ 不需要固化，N07 选定即最终版 |
| G1 | 打回粒度 | ✅ 支持单个资产独立打回 |
| G2 | 审核参考 | ✅ 展示 CharacterProfile 角色档案对照 |
| G3 | 审核员改图 | ✅ 支持自然语言改图（"眼睛放大一点"等） |
| C1 | ComfyUI workflow | ✅ 先出骨架 JSON，后续找开源替代 |
| C2 | 生成策略 | ✅ 所有资产并行生成 |
| VC | 音色确认时机 | ✅ 在 N08 Stage1 审核时同步确认角色音色，N20 可换 |

---

## Stage 3 · Keyframe 关键帧阶段（N10 – N13）

> 本阶段将 N09 固化的美术基线 + N05 的分镜规格转化为**每个镜头的关键帧图像**。
> 关键帧是视频生成（N14）的起始锚点，质量直接决定最终视频效果。

---

### N10 · 关键帧生成

| 字段 | 值 |
|------|-----|
| node_id | `N10` |
| 全称 | `N10_KEYFRAME_GEN` — 关键帧生成 |
| stage_group | `keyframe` |
| agent_role | `visual_director` |
| 依赖 | `N06`（prompt/workflow） + `N09`（固化美术资产） |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ shot_spec: ShotSpec, frozen_assets: FrozenArtAsset[], art_plan: ArtGenerationPlan }>` | 镜头规格 + 角色/场景固化基线 + 生成参数 |
| **Output** | `NodeOutputEnvelope<{ candidate_sets: CandidateSet<ShotVisualCandidate>[] }>` | 每个镜头的多候选关键帧集 |

执行粒度：**per shot** — 每个镜头独立生成关键帧候选

核心动作：
1. 从 `ShotSpec.keyframe_specs` 读取关键时间点和构图骨架
2. 从 `FrozenArtAsset` 获取角色参考图（FireRed 锚点）
3. 组装 ComfyUI workflow：关键帧图 prompt + ControlNet/OpenPose（如有） + FireRed MultiRef（角色一致性） + IP-Adapter
4. 按 `difficulty` 决定候选数：S0→1-2, S1→2-3, S2→3-4
5. 批量提交 ComfyUI 生成

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `comfyui` | ✅ |
| primary_model | `FLUX.2 Dev` + `FireRed-1.1` | ✅ FLUX 负责画面质量，FireRed 保角色一致性 |
| backup_model | `Z-Image-Turbo` | ✅ 速度优先降级方案 |
| comfyui_workflow_id | `wf-keyframe-generate` | ⚠️ 占位，需真实 workflow |
| comfyui_nodes | `FireRed MultiRef, ControlNet（自动选型）, OpenPose, Depth, NAG` | ✅ |
| controlnet_strategy | 根据 shot_type 自动选：多人→OpenPose，复杂构图→Depth，特写→无 | ✅ |
| resolution | `2048×1152`（2K 横屏）/ `1152×2048`（竖屏） | ✅ |

> ✅ **已确认**：关键帧是静态图，主模型 `FLUX.2 Dev` + `FireRed`（角色一致性），LTX 留给 N14 视频。
> ControlNet 根据镜头类型自动选择。分辨率 2K，暂不上 4K。

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `300` | ✅ 单镜头多候选，per shot |
| max_retries | `2` | ✅ |
| retry_backoff | `exponential (10s, 30s)` | ✅ |
| execution_mode | `parallel_per_shot` | ✅ 每个 shot 独立 ComfyUI job（并行） |

#### 产物（Artifacts）

| artifact_type | anchor_type | anchor_id | 说明 |
|---------------|-------------|-----------|------|
| `keyframe` | shot | shot_id | 每个镜头的候选关键帧图 |
| `comfyui_workflow` | shot | shot_id | 执行的 workflow JSON |

---

### N11 · 关键帧质检

| 字段 | 值 |
|------|-----|
| node_id | `N11` |
| 全称 | `N11_KEYFRAME_QC` — 关键帧质检 |
| stage_group | `keyframe` |
| agent_role | `quality_guardian` |
| 依赖 | `N10` |
| is_human_gate | `false` |
| reject_target | `N10` |
| max_auto_rejects | `3` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ shot_spec: ShotSpec, candidates: CandidateSet<ShotVisualCandidate>, frozen_assets: FrozenArtAsset[] }>` | 镜头候选关键帧 + 角色基线参考 |
| **Output** | `NodeOutputEnvelope<{ scores: QualityScore[], issues: QualityIssue[], selected_candidate_id?: string, decision: "pass" \| "reject" }>` | 评分 + 自动选最佳候选 + 通过/打回 |

核心动作：
1. 按 `qc_tier` 决定投票模型数（tier_1→3 模型, tier_2→2, tier_3→1）**← 这里 qc_tier 开始生效**
2. 多模型评分各候选
3. 选出最佳候选（auto_select）
4. 如果最佳候选分数 < 阈值 → 自动打回 N10

#### 模型配置（多模型 + 视觉检查）

**评分模型**（按 qc_tier 动态选择）：

| qc_tier | 使用模型 |
|---------|----------|
| tier_1_full | GPT 5.4 + Gemini 3.1 + Claude |
| tier_2_dual | GPT 5.4 + Gemini 3.1 |
| tier_3_single | Gemini 3.1 |

**辅助检查工具**（ComfyUI 节点）：

| 工具 | 用途 | 状态 |
|------|------|------|
| `ReActor` | 角色人脸一致性检测 — 比对关键帧中人脸与 FrozenArtAsset 基线 | ⚠️ |
| `FaceID Checker` | 人脸 ID 相似度评分（cosine similarity） | ⚠️ |

#### 质检评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| character_consistency | 0.20 | 角色外貌与基线的匹配度（结合 FaceID 分数） |
| body_integrity | 0.15 | 无肢体残缺、多余手指、断肢、面部扭曲等 AI 生图常见缺陷 |
| tone_consistency | 0.15 | 关键帧色调/影调与 N09 冻结的美术资产基调一致 |
| script_fidelity | 0.15 | 画面是否忠实表达了 visual_prompt 的意图 |
| action_accuracy | 0.10 | 角色动作是否匹配 ShotSpec.action_description |
| expression_match | 0.10 | 表情是否匹配 ShotSpec.characters_in_shot[].expression |
| composition | 0.10 | 构图是否合理（人物位置、前后景关系） |
| lighting_consistency | 0.05 | 光照是否匹配场景设定 |

#### 质检配置

| 字段 | 值 | 状态 |
|------|-----|------|
| quality_threshold | ✅ `weighted_average` — 加权总分作为阈值（各维度按权重加权，总分 < 7.5 打回） | ✅ |
| scoring_scale | `1-10` | ✅ |
| voting_strategy | `drop_extremes_average` (tier_1), `average` (tier_2/3) | ✅ |
| auto_select | ✅ 自动选最高分候选（最小化人工干预原则），人工在 N18 Gate 复核 | ✅ |

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `180` | ✅ |
| max_retries | `2` | ✅ |
| execution_mode | `per_shot` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `keyframe` | shot | 质检评分 JSON + 选定候选标记 |
| `prompt_json` | shot | 质检 prompt |

---

### N12 · 跨镜头连续性检查

| 字段 | 值 |
|------|-----|
| node_id | `N12` |
| 全称 | `N12_KEYFRAME_CONTINUITY` — 剧情连续性检查 |
| stage_group | `keyframe` |
| agent_role | `storyboard_planner` |
| 依赖 | `N11`（通过后） |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ episode_keyframes: { shot_id: string, selected_keyframe: StorageRef, shot_spec: ShotSpec }[] }>` | 本集所有通过质检的选定关键帧（按 shot 顺序） |
| **Output** | `NodeOutputEnvelope<{ continuity_report: ContinuityReport }>` | 连续性分析报告 + 问题列表 |

```typescript
interface ContinuityReport {
  overall_score: number;          // 1-10
  scene_transitions: {
    from_shot_id: string;
    to_shot_id: string;
    transition_type: string;
    continuity_score: number;
    issues?: string[];
  }[];
  character_continuity: {
    character_id: string;
    consistency_across_shots: number;
    problematic_shots?: string[];
  }[];
  pacing_analysis: {
    rhythm_score: number;
    suggestions?: string[];
  };
  blocking_issues: ContinuityIssue[];
}

interface ContinuityIssue {
  shot_id: string;
  type: "character_appearance_change" | "scene_mismatch" | "lighting_jump" | "prop_inconsistency" | "temporal_gap";
  severity: "critical" | "major" | "minor";
  description: string;
  suggestion: string;
}
```

核心动作：
1. 将所有关键帧按顺序排列，LLM 做多图理解分析
2. 检查场景切换的连续性（光照/时间/角色位置）
3. 检查角色跨镜头一致性
4. 如果有 critical issue → 标记相关 shot 需要重新生成（但不自动打回，由 Supervisor 决策）

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `llm` (多模态) | ✅ |
| primary_model | `Gemini 3.1` | ✅ 多模态能力强，适合多图/跨帧分析 |
| backup_model | `GPT 5.4` | ✅ |
| temperature | `0.3` | ✅ |
| max_tokens | `8192` | ✅ |

> ✅ **已确认**：连续性检查需要多模态能力（同时看多张关键帧图像），Gemini 3.1 显著优于 Qwen3。

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `240` | ✅ 需要传多张图 |
| max_retries | `2` | ✅ |
| execution_mode | `per_episode` | ✅ 一次检查全集连续性 |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `storyboard` | episode_version | ContinuityReport JSON |

---

### N13 · 关键帧定稿

| 字段 | 值 |
|------|-----|
| node_id | `N13` |
| 全称 | `N13_KEYFRAME_FREEZE` — 关键帧定稿 |
| stage_group | `keyframe` |
| agent_role | `visual_director` |
| 依赖 | `N12` |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ selected_keyframes: { shot_id: string, candidate_id: string, keyframe: StorageRef }[], continuity_report: ContinuityReport }>` | N11 选定候选 + N12 连续性报告 |
| **Output** | `NodeOutputEnvelope<{ frozen_keyframes: FrozenKeyframe[] }>` | 固化关键帧集 |

```typescript
interface FrozenKeyframe {
  shot_id: string;
  keyframe_index: number;
  image: StorageRef;
  seed: number;
  generation_model: string;
  frozen_at: string;
  continuity_adjusted: boolean;
}
```

核心动作：
1. 如果 N12 无 critical issue → 直接固化（不调 ComfyUI）
2. 如果有 minor issue → 用 FireRed Edit 做微调修正（保持一致性前提下调整光照/构图）
3. 如果有 critical issue → Supervisor 判断是回 N10 重生成还是 FireRed 修复
4. 固化：上传 TOS，写入 `artifacts` (type=`keyframe`)，标记 `frozen=true`

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `comfyui` (条件调用) | ✅ |
| primary_model | `FireRed-1.1` (Edit 模式) | ✅ |
| comfyui_workflow_id | `wf-keyframe-final` | ⚠️ 占位 |
| skip_if_no_issues | `true` | ✅ 无连续性问题时直接固化 |

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `300` | ✅ |
| max_retries | `2` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | anchor_id | 说明 |
|---------------|-------------|-----------|------|
| `keyframe` | shot | shot_id | 固化关键帧 |

---

## N10-N13 数据流总览

```
N09 固化美术资产 + N06 生成方案
  │
  ├── FrozenArtAsset[] (角色基线+变体)
  ├── ArtGenerationPlan
  ├── ShotSpec[] (含 keyframe_specs 骨架)
  │
  ▼  (per shot 并行)
┌─────────┐     ShotSpec + FrozenArtAsset + ArtPlan
│   N10   │ ──────────────────► CandidateSet<ShotVisualCandidate>
│关键帧生成│     FLUX.2 Dev + FireRed MultiRef, 2K
│ ComfyUI │     S0→1-2 / S1→2-3 / S2→3-4, ControlNet 自动选
└────┬────┘
     │
     ▼  (per shot, qc_tier 决定模型数)
┌─────────┐     CandidateSet + FrozenArtAsset (参考)
│   N11   │ ──────────────────► QualityScore + 自动选最佳候选
│关键帧质检│     GPT5.4 / Gemini3.1 / Claude + ReActor + FaceID
│ 多模型  │     加权总分 < 7.5 → 打回 N10 (max 3次)
└────┬────┘
     │ [通过]
     ▼  (per episode)
┌─────────┐     全集选定关键帧 (按序)
│   N12   │ ──────────────────► ContinuityReport
│连续性检查│     Gemini 3.1 多模态分析
│ 多图LLM │     角色一致/场景切换/节奏
└────┬────┘
     │
     ▼
┌─────────┐     选定关键帧 + ContinuityReport
│   N13   │ ──────────────────► FrozenKeyframe[]
│关键帧定稿│     无 issue → 直接固化
│ FireRed │     有 issue → FireRed Edit 微调
└────┬────┘
     │
     ▼
   N14 (Video 阶段入口)
```

---

## Round 3 已确认决策汇总

| # | 决策 | 结论 |
|---|------|------|
| K1 | N10 关键帧主模型 | ✅ FLUX.2 Dev + FireRed（静态图像优势），LTX 留给视频 |
| K2 | ControlNet 策略 | ✅ 按 shot_type 自动选：多人→OpenPose，复杂构图→Depth，特写→无 |
| K3 | 关键帧分辨率 | ✅ 2K（2048×1152），暂不上 4K |
| K4 | N11 质检阈值 | ✅ 加权总分（weighted_average），< 7.5 打回 |
| K5 | N11 候选选择 | ✅ 自动选最高分候选（最小化人工干预），N18 Gate 复核 |
| K6 | N12 连续性模型 | ✅ Gemini 3.1（多模态能力显著优于 Qwen3） |

---

## Stage 4 · Video 视频阶段（N14 – N19）

> 本阶段是管线中**计算量最大、耗时最长**的部分。
> 将固化关键帧 → 视频片段 → 质检 → 连续性 → 人工审核（shot 级）。

---

### N14 · 视频素材生成

| 字段 | 值 |
|------|-----|
| node_id | `N14` |
| 全称 | `N14_VIDEO_GEN` — 视频素材生成 |
| stage_group | `video` |
| agent_role | `visual_director` |
| 依赖 | `N13`（固化关键帧） |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ shot_spec: ShotSpec, frozen_keyframe: FrozenKeyframe, frozen_assets: FrozenArtAsset[] }>` | 镜头规格 + 固化关键帧 + 角色基线 |
| **Output** | `NodeOutputEnvelope<{ candidate_sets: CandidateSet<VideoCandidate>[] }>` | 每个镜头的多候选视频 |

```typescript
interface VideoCandidate {
  video: StorageRef;
  fps: number;
  duration_sec: number;
  generation_model: string;
  seed: number;
  has_native_audio: boolean;
  motion_score?: number;           // 运动流畅度自评
}
```

执行粒度：**per shot** — 每个镜头独立生成视频候选

核心动作：
1. 以固化关键帧为 i2v（image-to-video）起始帧
2. 根据 `camera_movement` + `shot_type` + `difficulty` 路由到最佳视频模型
3. 按 difficulty 决定候选数：S0→1-2, S1→2-3, S2→3-4

#### 模型配置（视频生成模型路由）

| 场景 | 首选模型 | 备选模型 | 说明 | 状态 |
|------|----------|----------|------|------|
| 默认（所有 S0/S1） | **`LTX-2.3`** | `Wan2.2` | LTX 默认首选，1080p | ✅ |
| 复杂运镜/动作 (S2) | `LTX-2.3` + `HuMo`（条件） | `Wan2.2` + `HuMo` | HuMo 仅在复杂动作时叠加，效果需实测 | ✅ |
| 追踪/orbital 运镜 | `SkyReels` | `ViVi + Mochi` | SkyReels 运镜控制能力强 | ⚠️ 备选 |

> ✅ **已确认**：
> - `LTX-2.3` 作为**默认首选**，分辨率 1080p
> - `HuMo` 仅在复杂动作场景叠加使用，效果需实测确认
> - 模型路由表可配置，运行时可调整

✅ **已确认决策**：
1. **默认首选** — ✅ LTX-2.3（1080p）
2. **视频分辨率** — ✅ 1080p（横屏 1920×1080 / 竖屏 1080×1920）
3. **视频时长** — ✅ 生成略长于 ShotSpec.duration_sec（+0.5~1s），N16/N17 自动根据剧情节奏裁切
4. **HuMo** — ✅ 仅在复杂动作（S2）时应用，效果需实测

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `600` | ✅ 视频生成最慢，单镜头 3-8min |
| max_retries | `2` | ✅ |
| retry_backoff | `exponential (15s, 60s)` | ✅ |
| execution_mode | `parallel_per_shot` | ✅ 并行（受 GPU 资源限制，队列调度） |

#### 产物（Artifacts）

| artifact_type | anchor_type | anchor_id | 说明 |
|---------------|-------------|-----------|------|
| `video` | shot | shot_id | 每镜头候选视频 |
| `comfyui_workflow` | shot | shot_id | 执行的 workflow |

---

### N15 · 视频素材质检

| 字段 | 值 |
|------|-----|
| node_id | `N15` |
| 全称 | `N15_VIDEO_QC` — 视频素材质检 |
| stage_group | `video` |
| agent_role | `quality_guardian` |
| 依赖 | `N14` |
| is_human_gate | `false` |
| reject_target | `N14` |
| max_auto_rejects | `3` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ shot_spec: ShotSpec, candidates: CandidateSet<VideoCandidate>, frozen_assets: FrozenArtAsset[], frozen_keyframe: FrozenKeyframe }>` | 视频候选 + 参考资产 |
| **Output** | `NodeOutputEnvelope<{ scores: QualityScore[], issues: QualityIssue[], selected_candidate_id?: string, decision: "pass" \| "reject" }>` | 多维度评分 + 选定候选 |

#### 模型配置（多模型 + 视觉工具）

**评分模型**（按 qc_tier）：与 N11 相同策略

**辅助检查工具**：

| 工具 | 用途 |
|------|------|
| `ReActor` | 视频中人脸一致性检测（逐帧采样比对） |
| `FaceID Checker` | 人脸 ID 相似度 |
| `Physics Checker` | 物理合理性：重力、碰撞、物体穿模检测 |

#### 质检评分维度

| 维度 | 权重 | 说明 |
|------|------|------|
| character_consistency | 0.20 | 角色外貌在视频中是否保持一致（FaceID 辅助） |
| motion_fluidity | 0.15 | 运动流畅度（无抖动/卡帧/变形） |
| physics_plausibility | 0.15 | 物理合理性（Physics Checker 辅助） |
| action_accuracy | 0.10 | 人物动作是否匹配描述 |
| expression_match | 0.10 | 表情变化是否自然 |
| composition | 0.10 | 构图稳定性 |
| lighting_consistency | 0.10 | 光照一致性 |
| continuity_score | 0.10 | 与关键帧的连贯度 |

#### 质检配置

| 字段 | 值 | 状态 |
|------|-----|------|
| quality_threshold | ✅ weighted_average（加权总分 < 7.5 打回），任何维度 < 5.0 直接打回 | ✅ |
| physics_check | `true` | ✅ |
| face_check | `true` | ✅ |
| auto_select | ✅ 自动选最高加权总分候选 | ✅ |

> ✅ **已确认阈值策略**：
> - weighted_average < 7.5 → 打回
> - 任何单维度 < 5.0 → critical → 直接打回
> - physics_plausibility < 6.0 → 打回
> - character_consistency < 7.0 → 打回

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `240` | ✅ 视频分析比图像慢 |
| max_retries | `2` | ✅ |
| execution_mode | `per_shot` | ✅ |

#### 产物

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `video` | shot | 质检评分 JSON + 选定候选标记 |

---

### N16 · 剧情与节奏连续性分析

| 字段 | 值 |
|------|-----|
| node_id | `N16` |
| 全称 | `N16_VIDEO_CONTINUITY_PACE` — 剧情&节奏连续性 |
| stage_group | `video` |
| agent_role | `storyboard_planner` |
| 依赖 | `N15`（通过后） |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ episode_videos: { shot_id: string, selected_video: StorageRef, shot_spec: ShotSpec }[] }>` | 本集所有通过质检的选定视频（按 shot 顺序） |
| **Output** | `NodeOutputEnvelope<{ pacing_report: PacingReport }>` | 节奏分析 + 剪辑建议 |

```typescript
interface PacingReport {
  overall_rhythm_score: number;
  total_duration_sec: number;
  target_duration_sec: number;
  duration_deviation_pct: number;
  shot_pacing: {
    shot_id: string;
    actual_duration_sec: number;
    planned_duration_sec: number;
    pacing_judgment: "too_fast" | "ok" | "too_slow";
    trim_suggestion?: { start_sec: number; end_sec: number };
  }[];
  scene_transitions: {
    from_shot_id: string;
    to_shot_id: string;
    transition_smoothness: number;
    suggestion?: string;
  }[];
  blocking_issues: string[];
}
```

> **我的建议**：与 N12 类似，这里需要多模态能力（看视频分析节奏），建议用 Gemini 3.1。
> 如果视频文件太大无法直接传 API，可以抽帧（每秒 2 帧）发图。

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `llm` (多模态) | ✅ |
| primary_model | `Gemini 3.1` | ✅ 视频/多图理解，多模态能力强 |
| backup_model | `GPT 5.4` | ✅ |
| temperature | `0.3` | ✅ |

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `300` | ✅ 多视频分析 |
| max_retries | `2` | ✅ |
| execution_mode | `per_episode` | ✅ |

---

### N16b · 影调与节奏调整（v2.2 新增）

| 字段 | 值 |
|------|-----|
| node_id | `N16b` |
| 全称 | `N16b_TONE_RHYTHM_ADJUST` — 影调与节奏调整 |
| stage_group | `video` |
| agent_role | `shot_designer` + `compositor`（协作） |
| 依赖 | `N16` |
| is_human_gate | `false` |

> v2.2 新增节点。在视频定稿前，基于 N16 的 PacingReport 进行影调一致化和节奏调整。Shot Designer 负责决策（调整哪些镜头、调整策略），Compositor 负责执行（FFmpeg 剪辑操作）。

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ frozen_videos: FrozenVideo[], pacing_report: PacingReport, episode_script: EpisodeScript }>` | N15 通过的视频 + N16 的节奏报告 + 剧本参考 |
| **Output** | `NodeOutputEnvelope<{ adjusted_videos: AdjustedVideo[], updated_timeline: EpisodeTimeline }>` | 调整后的视频序列 + 更新的时间轴 |

```typescript
interface AdjustedVideo {
  shot_id: string;
  original_video: StorageRef;
  adjusted_video: StorageRef;
  adjustments_applied: {
    type: "trim" | "color_grade" | "transition" | "speed_adjust" | "tone_match";
    params: Record<string, any>;
    description: string;
  }[];
  duration_before_sec: number;
  duration_after_sec: number;
}
```

核心动作：
1. **影调一致化** — 统一全集色调/亮度/对比度，消除镜头间视觉跳变
2. **节奏微调** — 根据 PacingReport 调整镜头长短（trim/speed_adjust）
3. **转场处理** — 在场景切换处添加适当转场效果
4. **时间轴更新** — 重新计算调整后的时间轴，确保与 TTS 同阶段对齐

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| 剪辑执行 | `FFmpeg`（规则引擎） | ✅ |
| 决策 LLM | `Gemini 3.1`（分析影调偏差、决定调整策略） | ✅ |
| 备选 | `GPT 5.4` | ✅ |

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `600` | ✅ (~10min) |
| max_retries | `2` | ✅ |
| execution_mode | `per_episode` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `video` | shot | 调整后的视频片段 |
| `timeline_json` | episode_version | 更新后的时间轴 |

---

### N17 · 视频素材定稿

| 字段 | 值 |
|------|-----|
| node_id | `N17` |
| 全称 | `N17_VIDEO_FREEZE` — 视频素材定稿 |
| stage_group | `video` |
| agent_role | `visual_director` |
| 依赖 | `N16b` |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | N16b 调整后视频 + PacingReport | |
| **Output** | `FrozenVideo[]` | 固化视频片段（含超分） |

核心动作：
- 如果 PacingReport 建议裁剪 → 执行 trim（FFmpeg）
- ✅ 按文档要求做超分辨率（Topaz 或 RealESRGAN），但**控制单集文件大小 ≤ 500MB**
- 固化：上传 TOS，写入 `artifacts` (type=`video`)

> ✅ **已确认**：N17 做超分，但注意单集大小不超过 500MB（通过编码参数控制码率）。

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `300` | ✅ 含超分 |
| max_retries | `2` | ✅ |

---

### N18 · Gate Stage2 — 视觉素材人工审核

| 字段 | 值 |
|------|-----|
| node_id | `N18` |
| 全称 | `N18_VISUAL_HUMAN_GATE` — 视觉素材人类检确 |
| stage_group | `video` |
| agent_role | `human_review_entry` |
| 依赖 | `N17` |
| is_human_gate | **`true`** |

#### Gate 配置

| 字段 | 值 | 状态 |
|------|-----|------|
| stage_no | `2` | ✅ |
| reviewer_role | `qc_inspector`（质检员） | ✅ |
| review_granularity | `shot`（分镜/shot级） | ✅ |
| review_steps | `[{ step_no: 1, reviewer_role: "qc_inspector", skippable: false, granularity: "shot" }]` | ✅ |

#### 审核流程

1. N17 完成后，为本集的**每个 shot 创建一条独立的 ReviewTask**（N 条/集）
2. 质检员在 OpenClaw 时间轴界面逐 shot 审核：
   - 查看关键帧 + 视频片段
   - 确认角色一致性、动作、表情、构图
   - 通过 / 打回（附修改意见）
3. **单个 shot 打回**只影响该 shot（ReturnTicket → N14 重新生成该 shot 视频）
4. **全部 shot approved 后** → 集级放行 → N19
5. 集放行后立即进入 N19 → N20 → … 审核池（多集并行）

#### 审核界面需求（OpenClaw）

- 时间轴视图：所有 shot 按顺序排列，可播放单个或连续播放
- 左侧：关键帧缩略图；右侧：对应视频播放
- 每个 shot 独立审核（approve/return）
- 打回时必须附文字意见
- 展示 N15 的质检评分作为参考

---

### N19 · 视觉素材定稿

| 字段 | 值 |
|------|-----|
| node_id | `N19` |
| 全称 | `N19_VISUAL_FREEZE` — 视觉素材定稿 |
| stage_group | `video` |
| agent_role | `visual_director` |
| 依赖 | `N18`（通过后） |
| is_human_gate | `false` |

纯固化节点：Gate 通过后将所有视频标记为 frozen，写入最终 `artifacts`。
**不调模型，不调 ComfyUI。**

---

## N14-N19 数据流总览

```
N13 固化关键帧
  │
  ▼  (per shot 并行, GPU 密集)
┌─────────┐     FrozenKeyframe + ShotSpec + FrozenAssets
│   N14   │ ──────────────────► CandidateSet<VideoCandidate>
│视频生成  │     默认 LTX-2.3 1080p, S2→+HuMo（条件）
│ ComfyUI │     生成略长+自动裁切, 全集最重节点
└────┬────┘
     │
     ▼  (per shot, qc_tier)
┌─────────┐     VideoCandidate[] + FrozenAssets
│   N15   │ ──────────────────► QualityScore + 选定候选
│视频质检  │     GPT5.4/Gemini/Claude + ReActor + Physics Checker
│多模型+工具│    加权总分<7.5 → 打回 N14 (max 3), 自动选最高分
└────┬────┘
     │ [通过]
     ▼  (per episode)
┌─────────┐
│   N16   │ ──────────────────► PacingReport
│节奏连续性│     Gemini 3.1 多模态分析
└────┬────┘
     │
     ▼
┌─────────┐
│   N17   │ ──────────────────► FrozenVideo[]
│视频定稿  │     trim + 超分(≤500MB) + 固化
└────┬────┘
     │
     ▼
┌─────────┐     N × ReviewTask (per shot)
│   N18   │     Gate Stage2: 质检员, shot 级
│  Gate   │     时间轴逐 shot 审核
│ Stage2  │     单 shot 打回 → N14 重做该 shot
└────┬────┘     全部 approved → 集级放行
     │
     ▼
┌─────────┐
│   N19   │ ──────────────────► frozen 视觉素材
│视觉定稿  │     纯固化，不调模型
└────┬────┘
     │
     ▼
   N20 (AV 阶段入口)
```

---

## Round 4 已确认决策汇总

| # | 决策 | 结论 |
|---|------|------|
| V1 | 视频默认首选 | ✅ LTX-2.3（1080p），Wan2.2 作为备选 |
| V2 | 视频分辨率 | ✅ 1080p（横屏 1920×1080 / 竖屏 1080×1920） |
| V3 | 视频时长策略 | ✅ 生成略长（+0.5~1s），自动根据剧情节奏裁切 |
| V4 | HuMo 使用场景 | ✅ 仅 S2 复杂动作，效果需实测 |
| V5 | N15 质检阈值 | ✅ weighted_average < 7.5 打回，单维度 < 5 直接打回 |
| V6 | N12/N16 连续性 | ✅ Gemini 3.1（多模态能力远强于 Qwen3） |
| V7 | N17 超分 | ✅ 按文档要求超分，单集 ≤ 500MB |
| V8 | 候选选择 | ✅ 自动选加权最高分（最小化人工干预） |

---

## Stage 5 · AV 视听阶段（N20 – N22）

> 本阶段为固化视频添加**语音、唇形同步、BGM、SFX**，完成视听整合。

---

### N20 · 视听整合

| 字段 | 值 |
|------|-----|
| node_id | `N20` |
| 全称 | `N20_AV_INTEGRATE` — 视听整合 |
| stage_group | `audio` |
| agent_role | `audio_director` |
| 依赖 | `N19`（固化视觉素材） |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ frozen_videos: FrozenVideo[], episode_script: EpisodeScript, character_registry: CharacterProfile[] }>` | 固化视频 + 剧本（含对白 + BGM 配置） + 角色声音配置 |
| **Output** | `NodeOutputEnvelope<{ av_tracks: AVTrackSet }>` | 多轨音视频工程 |

```typescript
interface AVTrackSet {
  episode_id: string;
  video_track: { shot_id: string; video: StorageRef; start_sec: number; end_sec: number }[];
  tts_tracks: { line_id: string; character_id: string; audio: StorageRef; start_sec: number; end_sec: number; actual_duration_sec: number }[];
  lipsync_videos: { shot_id: string; video: StorageRef; lipsync_applied: boolean }[];
  bgm_track: { scene_id: string; audio: StorageRef; start_sec: number; end_sec: number; mood: EmotionTag }[];
  sfx_tracks: { shot_id: string; audio: StorageRef; start_sec: number; end_sec: number; sfx_tag: string }[];
  mixed_audio?: StorageRef;        // Geek_AudioMixer 混合后的完整音轨
  subtitle_json?: StorageRef;      // 字幕数据
}
```

核心子步骤（按顺序执行）：

| 步骤 | 模型/工具 | 输入 | 输出 |
|------|-----------|------|------|
| 1. TTS 语音生成 | **按语言切换**：英文→`ElevenLabs` API / 中文→`CosyVoice` 自部署 | DialogueLine + CharacterProfile.voice_config | 每句对白的音频 |
| 2. TTS 时长对齐 | 代码逻辑 + STT 对轴 | actual_duration vs planned_window | timing_resolution_strategy |
| 3. 唇形同步 | `LatentSync` | 视频 + TTS 音频 | 唇形同步后视频 |
| 4. BGM 生成/选择 | `Stable Audio 2.5` 生成 **或** 曲库选择（均支持） | SceneBGMConfig | BGM 音频 |
| 5. SFX 音效 | 音效库匹配 | ShotSpec.sfx_tags | 音效文件 |
| 6. 音频混合 | `Geek_AudioMixer` | TTS + BGM + SFX | 混合音轨 |
| 7. 字幕生成 | 文本生成 + STT 对轴校准 | DialogueLine 文本 + 音频时间戳 | subtitle_json（烧录用） |

#### 模型配置

| 工具 | 版本 | 部署方式 | 状态 |
|------|------|----------|------|
| **CosyVoice** | 最新版 | 自部署 GPU（中文 TTS） | ✅ |
| **ElevenLabs** | API | 第三方 API（英文 TTS） | ✅ |
| **LatentSync** | — | 自部署 GPU | ✅ |
| **Stable Audio 2.5** | — | 自部署或 API（BGM 生成） | ✅ |
| **Geek_AudioMixer** | — | ComfyUI 节点 | ✅ |

> ✅ **已确认**：
> - TTS 按 `primary_language` 自动切换：英文→ElevenLabs API（美国口语），中文→CosyVoice 自部署
> - `voice_config.tts_engine` 字段支持此切换
> - LatentSync 失败时降级为无唇形同步版本 + 标记 issue

✅ **已确认决策**：
1. **TTS 引擎** — ✅ 按语言切换：英文→ElevenLabs，中文→CosyVoice
2. **BGM 来源** — ✅ 可生成（Stable Audio 2.5）也可从曲库选择，均支持
3. **voice_config 确认时机** — ✅ 在 N08 Stage1 审核美术资产时同步确认角色音色，N20 执行时可换
4. **字幕生成** — ✅ 文本生成 + STT 对轴（最合适方案）
5. **输出制式** — ✅ 同时输出横屏和竖屏双版本
6. **字幕方式** — ✅ 烧录（hardcode）到视频中

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `900` | ✅ 多步骤串行，整集 ~25min |
| max_retries | `2` | ✅ |
| execution_mode | `per_episode` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `tts` | shot | 每句对白音频 |
| `video` (lipsync) | shot | 唇形同步后视频 |
| `bgm` | episode_version | 场景 BGM |
| `sfx` | shot | 音效 |
| `timeline_json` | episode_version | 多轨时间轴 JSON |
| `subtitle_json` | episode_version | 字幕数据 |

---

### N21 · Gate Stage3 — 视听整合人工审核

| 字段 | 值 |
|------|-----|
| node_id | `N21` |
| 全称 | `N21_AV_HUMAN_GATE` — 视听整合人类检确 |
| stage_group | `audio` |
| agent_role | `human_review_entry` |
| 依赖 | `N20` |
| is_human_gate | **`true`** |

#### Gate 配置

| 字段 | 值 | 状态 |
|------|-----|------|
| stage_no | `3` | ✅ |
| reviewer_role | `qc_inspector`（质检员） | ✅ |
| review_granularity | `episode`（集级） | ✅ |
| review_steps | `[{ step_no: 1, reviewer_role: "qc_inspector", skippable: false, granularity: "episode" }]` | ✅ |

#### 审核流程

1. N20 完成后创建 **1 个 ReviewTask**（集级）
2. 质检员在 OpenClaw Audio Timeline 界面审核：
   - 完整播放视听合成结果
   - 检查：唇形同步、配音语调、BGM 匹配、音效合理性、字幕正确性
   - 通过 / 打回（附具体 shot + 问题描述）
3. 打回 → ReturnTicket → 回到 N20 修正（重做某些 shot 的 TTS/唇形/BGM）

#### 审核界面需求

- 整集视频播放器 + 多轨音频波形图
- 可分轨静音（只听 TTS / 只听 BGM / 只听 SFX）
- 字幕实时显示
- 按 shot 定位跳转

---

### N22 · 视听定稿

| 字段 | 值 |
|------|-----|
| node_id | `N22` |
| 全称 | `N22_AV_FREEZE` — 视听整合全定稿 |
| stage_group | `audio` |
| agent_role | `audio_director` |
| 依赖 | `N21`（通过后） |
| is_human_gate | `false` |

核心动作：
- 固化所有视听产物（视频+音频+字幕）
- 可选：STT 校验字幕准确性
- 写入 `artifacts`，标记 `frozen=true`

**不调外部模型，纯固化 + 校验。**

---

## N20-N22 数据流总览

```
N19 固化视觉素材
  │
  ├── FrozenVideo[] (全集 shot 视频)
  ├── EpisodeScript (对白 + BGM 配置)
  ├── CharacterProfile[] (voice_config)
  │
  ▼  (per episode, 多步串行)
┌──────────┐
│   N20    │  1. TTS: 英文→ElevenLabs / 中文→CosyVoice
│ 视听整合  │  2. STT 对轴 + 时长对齐
│ 多模型串行│  3. LatentSync → 唇形同步
│          │  4. BGM: Stable Audio 生成 或 曲库选择
│          │  5. 音效库 → SFX
│          │  6. Geek_AudioMixer → 混合
│          │  7. 字幕生成（文本+STT对轴，烧录用）
└────┬─────┘  产出: AVTrackSet
     │
     ▼
┌─────────┐     1 ReviewTask / episode
│   N21   │     Gate Stage3: 质检员, 集级审核
│  Gate   │     视听播放器 + 多轨波形
│ Stage3  │     打回 → N20 局部修正
└────┬────┘
     │ [通过]
     ▼
┌─────────┐
│   N22   │ ──────────────────► frozen 视听产物
│视听定稿  │     固化 + STT 校验
└────┬────┘
     │
     ▼
   N23 (Final 阶段入口)
```

---

## Round 5 已确认决策汇总

| # | 决策 | 结论 |
|---|------|------|
| AV1 | TTS 引擎 | ✅ 按语言切换：英文→ElevenLabs API / 中文→CosyVoice 自部署 |
| AV2 | BGM 来源 | ✅ 可生成（Stable Audio 2.5）也可从曲库选择 |
| AV3 | voice_config 时机 | ✅ N08 Stage1 审核时确认角色音色，N20 可换 |
| AV4 | 字幕生成 | ✅ 文本生成 + STT 对轴校准 |
| AV5 | LatentSync 降级 | ✅ 失败降级为无唇形同步 + issue 标记 |
| AV6 | 输出制式 | ✅ 横屏 + 竖屏双版本 |
| AV7 | 字幕烧录 | ✅ 烧录（hardcode）到视频 |

---

## Stage 6 · Final 成片阶段（N23 – N26）

> 本阶段将视听产物合成为最终成片，经过三步串行人工审核后发布。

---

### N23 · 成片整合

| 字段 | 值 |
|------|-----|
| node_id | `N23` |
| 全称 | `N23_FINAL_COMPOSE` — 成片整合 |
| stage_group | `final` |
| agent_role | `director` |
| 依赖 | `N22`（视听定稿） |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ av_tracks: AVTrackSet, episode_script: EpisodeScript }>` | 视听多轨工程 + 剧本 |
| **Output** | `NodeOutputEnvelope<{ final_episode: FinalEpisode }>` | 完整成片 |

```typescript
interface FinalEpisode {
  episode_id: string;
  video: StorageRef;              // 完整成片视频
  duration_sec: number;
  resolution: { width: number; height: number };
  fps: number;
  audio_codec: string;
  video_codec: string;
  file_size_mb: number;
  timeline: EpisodeTimeline;      // 精确时间轴
  subtitle: StorageRef;           // 烧录/外挂字幕
  watermark_applied: boolean;
  highlight_reel?: {              // 前 3-5s 高光闪回
    shots: string[];
    duration_sec: number;
  };
}
```

核心动作：
1. 按 EpisodeTimeline 顺序合成所有 shot 视频
2. 混入合成音轨（TTS + BGM + SFX 混合）
3. 添加转场效果（根据 ShotSpec.transition_in/out）
4. 添加 3-5s 开头高光闪回（test-data 要求）
5. 烧录字幕（如配置）
6. 添加水印（如配置）
7. 输出最终视频文件

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `ffmpeg` (主) + `comfyui` (辅) | ✅ |
| ffmpeg_pipeline | 合成 + 转场 + 字幕烧录 + 水印 + 编码 | ✅ |
| comfyui_nodes | `VHS_VideoCombine`（复杂转场辅助） | ✅ |
| output_format | H.264, 双制式（横屏 1920×1080 + 竖屏 1080×1920） | ✅ |
| max_file_size | `500MB` per episode | ✅ |

> ✅ **已确认**：成片合成是视频编辑而非 AI 生成，FFmpeg 为主力引擎。
> 复杂转场（zoom_transition 等）由 ComfyUI VHS_VideoCombine 辅助。

✅ **已确认决策**：
1. **合成引擎** — ✅ FFmpeg 为主 + ComfyUI 辅助
2. **输出编码** — ✅ H.264，双制式：横屏 1920×1080 + 竖屏 1080×1920，单集 ≤ 500MB
3. **字幕** — ✅ 烧录（hardcode）
4. **高光闪回** — ✅ LLM 选择（基于 narrative_arc + climax 标签关联的 shot）
5. **水印** — ✅ 根据 WatermarkConfig 配置，config 驱动

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `480` | ✅ |
| max_retries | `2` | ✅ |
| execution_mode | `per_episode` | ✅ |

#### 产物（Artifacts）

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| `final_cut` | episode_version | 完整成片视频 |
| `timeline_json` | episode_version | 精确时间轴 |
| `subtitle_json` | episode_version | 字幕文件 |

---

### N24 · Gate Stage4 — 成片三步串行审核

| 字段 | 值 |
|------|-----|
| node_id | `N24` |
| 全称 | `N24_FINAL_HUMAN_GATE` — 成片人类检确 |
| stage_group | `final` |
| agent_role | `human_review_entry` |
| 依赖 | `N23` |
| is_human_gate | **`true`** |

#### Gate 配置（三步串行）

| step_no | reviewer_role | skippable | granularity | 说明 |
|---------|---------------|-----------|-------------|------|
| 1 | `qc_inspector`（质检员） | **`true`** | `episode` | 可选：质检员快检 |
| 2 | `middle_platform`（剪辑中台） | `false` | `episode` | 必选：中台终审 |
| 3 | `partner`（合作方） | `false` | `episode` | 必选：合作方验收 |

#### 审核流程

```
N23 成片完成
     │
     ▼
Step 1: 质检员审核（可跳过）
     │── 通过 → Step 2
     │── 打回 → ReturnTicket → 终止后续步骤
     │── 跳过 → Step 2
     ▼
Step 2: 剪辑中台审核（必选）
     │── 通过 → Step 3
     │── 打回 → ReturnTicket → 终止后续步骤
     ▼
Step 3: 合作方审核（必选）
     │── 通过 → N25
     │── 打回 → ReturnTicket → 终止后续步骤
```

**任何一步打回都终止后续步骤**，生成 ReturnTicket。
打回目标取决于问题类型（可能回到 N14 重做视频 / N20 重做音频 / N23 重做合成）。

#### 审核界面需求

- 完整视频播放器（支持 1x/0.5x/2x 速度）
- 时间轴标注工具（打点标记问题位置）
- 逐帧查看（关键场景）
- 合作方界面需要额外**脱敏**：不展示模型信息、成本数据

#### 运行时配置

| 字段 | 值 |
|------|-----|
| timeout_per_attempt_s | `0` (人工无超时) |

---

### N25 · 成片定稿

| 字段 | 值 |
|------|-----|
| node_id | `N25` |
| 全称 | `N25_FINAL_FREEZE` — 成片定稿 |
| stage_group | `final` |
| agent_role | `director` |
| 依赖 | `N24`（三步全通过） |
| is_human_gate | `false` |

核心动作：
- 标记成片为 `delivered`
- 写入最终 `artifacts` (type=`final_cut`)
- 更新 `episode_versions.status = delivered`
- 归档所有中间产物的保留策略（temp_30d / permanent）

**不调模型，纯状态固化。**

---

### N26 · 分发与推送

| 字段 | 值 |
|------|-----|
| node_id | `N26` |
| 全称 | `N26_DISTRIBUTION` — TikTok/飞书推送 |
| stage_group | `final` |
| agent_role | `director` |
| 依赖 | `N25` |
| is_human_gate | `false` |

#### I/O 规格

| 方向 | 类型 | 说明 |
|------|------|------|
| **Input** | `NodeInputEnvelope<{ final_episode: FinalEpisode, distribution_config: DistributionConfig }>` | 成片 + 分发配置 |
| **Output** | `NodeOutputEnvelope<{ distribution_records: DistributionRecord[] }>` | 推送结果 |

```typescript
interface DistributionConfig {
  platforms: ("tiktok" | "feishu" | "youtube" | "custom")[];
  tiktok_config?: { account_id: string; hashtags: string[]; publish_time?: string };
  feishu_config?: { group_id: string; mention_users?: string[] };
  auto_publish: boolean;          // true=自动发布 / false=仅推送草稿
}

interface DistributionRecord {
  platform: string;
  status: "published" | "draft" | "failed";
  external_url?: string;
  external_id?: string;
  published_at?: string;
  error?: string;
}
```

核心动作：
1. 根据平台 API 上传成片视频
2. 附加标题、标签、描述
3. 如果 `auto_publish=false` → 仅创建草稿
4. 记录推送结果

#### 模型配置

| 字段 | 值 | 状态 |
|------|-----|------|
| provider | `api` (平台 API) | ✅ |
| tiktok_api | TikTok Open API | ✅ config 驱动 |
| feishu_api | 飞书 Open API | ✅ config 驱动 |

> **不调 AI 模型，纯 API 集成。**

#### 运行时配置

| 字段 | 值 | 状态 |
|------|-----|------|
| timeout_per_attempt_s | `60` | ✅ |
| max_retries | `3` | ✅ |
| retry_backoff | `exponential (5s, 15s, 45s)` | ✅ |

#### 产物

| artifact_type | anchor_type | 说明 |
|---------------|-------------|------|
| — | — | DistributionRecord JSON 存入 node_run.output_ref |

---

## N23-N26 数据流总览

```
N22 固化视听产物
  │
  ▼
┌──────────┐     AVTrackSet + EpisodeScript
│   N23    │ ──────────────────► FinalEpisode (横屏+竖屏)
│ 成片整合  │     FFmpeg (主) + VHS_VideoCombine (辅)
│          │     合成+转场+字幕烧录+水印+高光闪回(LLM选), ≤500MB
└────┬─────┘
     │
     ▼
┌──────────┐     三步串行审核
│   N24    │     Step1: 质检员（可跳过）
│  Gate    │     Step2: 剪辑中台（必选）
│ Stage4   │     Step3: 合作方（必选, 脱敏）
│ 3-step   │     任意打回 → ReturnTicket
└────┬─────┘
     │ [三步全通过]
     ▼
┌──────────┐
│   N25    │ ──────────────────► status = delivered
│ 成片定稿  │     固化 + 归档保留策略
└────┬─────┘
     │
     ▼
┌──────────┐     DistributionConfig
│   N26    │ ──────────────────► DistributionRecord[]
│ 分发推送  │     TikTok / 飞书 / YouTube
│ 平台API  │     auto_publish or draft
└──────────┘
```

---

## Node ↔ Agent 映射总表（v2.2 更新）

| Agent | 负责节点 | 核心统筹职责 |
|-------|---------|-------------|
| **Script Analyst** | N01 | 剧本理解 + 结构化提取 + 分集骨架 |
| **Shot Designer** | N02, N04, N05, N16, N16b | 分镜设计→定稿→分级→节奏调整，叙事节奏全链路 |
| **Visual Director** | N06, N07, N09, N10, N13, N14, N17, N19 | 视觉策划→美术生成→关键帧→视频→定稿，视觉质量全链路 |
| **Audio Director** | N07b, N20, N22 | 音色生成→TTS/唇同步/BGM/SFX→视听定稿 |
| **Quality Inspector** | N03, N11, N12, N15 | 分镜质检→关键帧质检→连续性→视频质检 |
| **Compositor** | N16b(协作), N23, N25, N26 | 影调调整(协作)→成片合成→定稿→分发 |
| **Review Dispatcher** | N08, N18, N21, N24 | 所有 Gate 节点的审核批注解析→任务拆分→执行调度 |
| **Supervisor** | 横切(N02/N05/N09/N14/N17/N23) | 成本监控 + 项目需求校验 + 预算分配 + 降级触发 + 合规检查 |
| **Evolution Engine** | 后台（四模式） | 每日反思→每周 prompt 进化→持续 RAG 管理→按条件 LoRA 训练 |

---

## Round 6 已确认决策汇总

| # | 决策 | 结论 |
|---|------|------|
| F1 | 合成引擎 | ✅ FFmpeg 为主 + ComfyUI 辅助 |
| F2 | 输出编码 | ✅ H.264，横屏 + 竖屏双制式，≤ 500MB |
| F3 | 字幕 | ✅ 烧录（hardcode） |
| F4 | 高光闪回 | ✅ LLM 选择关键镜头 |
| F5 | 分发平台 | ✅ config 驱动，根据项目配置决定 |
| F6 | auto_publish | ✅ config 驱动，默认 draft |
