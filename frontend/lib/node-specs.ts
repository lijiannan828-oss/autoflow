/**
 * Node specification data for all 26 pipeline nodes.
 * Used by pipeline viewer and debug playground pages.
 * Source of truth: node-spec-sheet.md + topology.py
 */

// ── Node type categorization ──
export type NodeCategory = "llm" | "qc" | "comfyui" | "freeze" | "gate" | "audio" | "ffmpeg" | "logic"

export interface NodeSpec {
  id: string
  name: string
  stage: number
  stageGroup: string
  category: NodeCategory
  description: string
  dependsOn: string[]
  isGate: boolean
  isQC: boolean
  /** Model used (primary) */
  model: string | null
  /** Fallback models */
  fallbackModels: string[]
  /** Agent role from topology.py */
  agentRole: string
  /** Default system prompt (for LLM/QC nodes) */
  systemPrompt: string | null
  /** Default user prompt template */
  userPromptTemplate: string | null
  /** Configurable parameters */
  params: NodeParam[]
  /** QC-specific config */
  qcConfig: QCConfig | null
  /** Output scope */
  outputScope: "episode" | "per_shot" | "per_asset"
}

export interface NodeParam {
  key: string
  label: string
  type: "number" | "string" | "boolean" | "select"
  defaultValue: number | string | boolean
  options?: string[] // for select type
  description: string
}

export interface QCConfig {
  votingModels: string[]
  threshold: number
  dimensions: { name: string; weight: number; label: string }[]
  singleDimFloor?: number // any dimension below this → reject
}

// ── QC Dimension configs ──

const QC_N03_DIMENSIONS = [
  { name: "narrative_coherence", weight: 0.20, label: "叙事连贯性" },
  { name: "visual_feasibility", weight: 0.20, label: "视觉可行性" },
  { name: "pacing", weight: 0.15, label: "节奏感" },
  { name: "character_consistency", weight: 0.15, label: "角色一致性" },
  { name: "technical_compliance", weight: 0.15, label: "技术合规性" },
  { name: "emotional_impact", weight: 0.15, label: "情感冲击力" },
]

const QC_N11_DIMENSIONS = [
  { name: "character_consistency", weight: 0.20, label: "角色一致性" },
  { name: "body_integrity", weight: 0.15, label: "人体完整性" },
  { name: "tone_consistency", weight: 0.15, label: "色调一致性" },
  { name: "script_fidelity", weight: 0.15, label: "剧本还原度" },
  { name: "action_accuracy", weight: 0.10, label: "动作准确性" },
  { name: "expression_match", weight: 0.10, label: "表情匹配度" },
  { name: "composition", weight: 0.10, label: "构图" },
  { name: "lighting_consistency", weight: 0.05, label: "光照一致性" },
]

const QC_N15_DIMENSIONS = [
  { name: "character_consistency", weight: 0.20, label: "角色一致性" },
  { name: "motion_fluidity", weight: 0.15, label: "运动流畅性" },
  { name: "physics_plausibility", weight: 0.15, label: "物理合理性" },
  { name: "action_accuracy", weight: 0.10, label: "动作准确性" },
  { name: "expression_match", weight: 0.10, label: "表情匹配度" },
  { name: "composition", weight: 0.10, label: "构图" },
  { name: "lighting_consistency", weight: 0.10, label: "光照一致性" },
  { name: "continuity_score", weight: 0.10, label: "连续性" },
]

// ── All 26 node specs ──

export const NODE_SPECS: NodeSpec[] = [
  // ── Stage 1: Script ──
  {
    id: "N01",
    name: "剧本结构化解析",
    stage: 1,
    stageGroup: "script",
    category: "llm",
    description: "解析原始剧本，提取世界观、角色、场景、分集骨架等结构化信息",
    dependsOn: [],
    isGate: false,
    isQC: false,
    model: "gemini-3.1-pro-preview",
    fallbackModels: ["claude-opus-4-6", "gemini-2.5-pro"],
    agentRole: "script_analyst",
    systemPrompt: `你是一位专业的剧本分析师。你的任务是解析输入的原始剧本文本，提取以下结构化信息：
1. 世界观设定（worldsetting）
2. 角色档案（character_registry）：每个角色的姓名、年龄、外貌、性格、服装描述
3. 场景档案（location_registry）：每个场景的名称、描述、视觉特征
4. 分集骨架（episodes）：每集的场景列表和关键情节点
5. 全局统计（global_stats）：角色数、场景数、预估总集数

输出必须是严格的 JSON 格式。`,
    userPromptTemplate: `请解析以下剧本，输出 ParsedScript JSON：

【剧本正文】
{{script_text}}

【三幕结构（如有）】
{{narrative_arc}}

【角色预设（如有）】
{{character_presets}}

【制作要求】
{{production_requirements}}`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.3, description: "生成温度，越低越确定性" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 16384, description: "最大输出 token 数" },
      { key: "json_mode", label: "JSON Mode", type: "boolean", defaultValue: true, description: "是否强制 JSON 输出" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N02",
    name: "拆集拆镜",
    stage: 1,
    stageGroup: "script",
    category: "llm",
    description: "将结构化剧本拆分为镜头级制作规格（EpisodeScript），每镜头 1-3 秒",
    dependsOn: ["N01"],
    isGate: false,
    isQC: false,
    model: "gemini-3.1-pro-preview",
    fallbackModels: ["claude-opus-4-6", "gemini-2.5-pro"],
    agentRole: "director",
    systemPrompt: `你是一位 AI 导演，负责将结构化剧本分解为镜头级制作规格。

关键规则：
- 短剧每个镜头 1-3 秒（平均 2 秒）
- 每集 30-60 个镜头
- visual_prompt 必须使用英语
- camera_movement 从以下预定义列表选择：static, pan_left, pan_right, tilt_up, tilt_down, zoom_in, zoom_out, tracking, crane, orbital, handheld
- 每集开头需要 3-5 秒精彩片段闪回

输出 EpisodeScript JSON，包含 scenes[] → shots[]（ShotSpec）。`,
    userPromptTemplate: `基于以下 ParsedScript，为第 {{episode_number}} 集生成 EpisodeScript：

【ParsedScript】
{{parsed_script_json}}

【角色注册表】
{{character_registry}}

【场景注册表】
{{location_registry}}`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.5, description: "稍高温度以增加创意" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 32768, description: "拆镜输出较大" },
      { key: "json_mode", label: "JSON Mode", type: "boolean", defaultValue: true, description: "强制 JSON 输出" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N03",
    name: "分镜质检",
    stage: 1,
    stageGroup: "script",
    category: "qc",
    description: "三模型投票评估分镜质量（6 维度），< 8.0 分自动打回 N02",
    dependsOn: ["N02"],
    isGate: false,
    isQC: true,
    model: null,
    fallbackModels: [],
    agentRole: "quality_guardian",
    systemPrompt: `你是一位专业的分镜质检员。请从以下 6 个维度对分镜脚本进行评分（每个维度 0-10 分）：

1. narrative_coherence（叙事连贯性）：情节是否流畅、有逻辑
2. visual_feasibility（视觉可行性）：描述是否可以被 AI 视觉生成模型实现
3. pacing（节奏感）：镜头时长和切换是否合理
4. character_consistency（角色一致性）：角色行为和外观描述是否前后一致
5. technical_compliance（技术合规性）：是否符合短剧技术规范（时长、镜头数等）
6. emotional_impact（情感冲击力）：是否有足够的情感张力

输出 JSON 格式评分，附带每个维度的扣分理由。`,
    userPromptTemplate: `请对以下分镜脚本（EpisodeScript）进行质检评分：

{{episode_script_json}}`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.3, description: "低温度保证评分稳定" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 8192, description: "评分输出" },
      { key: "threshold", label: "通过阈值", type: "number", defaultValue: 8.0, description: "加权平均低于此值自动打回" },
    ],
    qcConfig: {
      votingModels: ["gemini-3.1-pro-preview", "claude-opus-4-6", "gpt-5.4"],
      threshold: 8.0,
      dimensions: QC_N03_DIMENSIONS,
    },
    outputScope: "episode",
  },
  {
    id: "N04",
    name: "分镜定稿",
    stage: 1,
    stageGroup: "script",
    category: "llm",
    description: "根据 QC 反馈微调分镜，或直接盖章定稿",
    dependsOn: ["N03"],
    isGate: false,
    isQC: false,
    model: "gemini-3.1-pro-preview",
    fallbackModels: ["claude-opus-4-6"],
    agentRole: "director",
    systemPrompt: `你是一位 AI 导演，负责根据质检反馈对分镜脚本进行最终修订。

规则：
- 如果 QC 没有发现问题（issues 为空），直接返回原始分镜并标记 _frozen=true
- 如果有 minor issues，仅修改指出的问题，不做其他改动
- 保持与原始剧本的一致性`,
    userPromptTemplate: `【原始分镜】
{{episode_script_json}}

【QC 反馈】
{{qc_result_json}}

请根据 QC 反馈修订分镜，或直接定稿。`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.2, description: "低温度保证稳定修订" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 32768, description: "定稿输出" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N05",
    name: "镜头分级",
    stage: 1,
    stageGroup: "script",
    category: "llm",
    description: "为每个镜头分配难度等级 (S0/S1/S2) 和质检层级 (tier_1/2/3)",
    dependsOn: ["N04"],
    isGate: false,
    isQC: false,
    model: "gemini-3.1-pro-preview",
    fallbackModels: ["claude-opus-4-6"],
    agentRole: "director",
    systemPrompt: `你是镜头分级专家。为每个镜头分配：

1. difficulty（S0/S1/S2）：
   - S0：静态镜头，1个角色，无运镜 → 候选 1-2 张
   - S1：多角色，简单运镜 → 候选 2-3 张
   - S2：群戏，复杂运镜（tracking/crane/orbital） → 候选 3-4 张

2. qc_tier：
   - tier_1_full：S2 镜头 或 叙事关键点 → 3 个投票模型
   - tier_2_dual：S1 非关键镜头 → 2 个投票模型
   - tier_3_single：S0 非关键镜头 → 1 个投票模型

注意：叙事关键节点（开场钩子、高潮、结尾悬念）即使是 S0 也要给 tier_1。`,
    userPromptTemplate: `请对以下定稿分镜的每个镜头进行分级：

{{frozen_episode_script_json}}`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.2, description: "低温度保证分级一致" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 16384, description: "分级输出" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N06",
    name: "视觉元素生成",
    stage: 1,
    stageGroup: "art",
    category: "llm",
    description: "为角色/场景/道具生成图像 Prompt 和 ComfyUI 工作流参数（不生成图像）",
    dependsOn: ["N04", "N05"],
    isGate: false,
    isQC: false,
    model: "gemini-3.1-pro-preview",
    fallbackModels: ["claude-opus-4-6"],
    agentRole: "visual_director",
    systemPrompt: `你是 AIGC 视觉总监。为每个视觉资产设计图像生成方案：

输出 ArtGenerationPlan JSON，包含：
- 角色：base_prompt (英文), negative_prompt, costume_prompts (每套服装), expression_variants, reference_strategy
- 场景：base_prompt (英文), negative_prompt, 候选数量
- 道具：base_prompt (英文), negative_prompt

Prompt 规则：
- 英文，"Film still, ultra photorealistic, [外貌], [服装], grey background, studio lighting"
- 角色分辨率：1024×1536 (3:4 竖向半身)
- 场景分辨率：1920×1080 (16:9)
- 候选数：主角 4-6, 配角 2-3, 群演 1-2`,
    userPromptTemplate: `基于以下定稿分镜和注册表，生成 ArtGenerationPlan：

【定稿分镜】
{{frozen_episode_script_json}}

【角色注册表】
{{character_registry}}

【场景注册表】
{{location_registry}}`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.6, description: "创意任务需要更高温度" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 16384, description: "Prompt 生成输出" },
      { key: "main_character_candidates", label: "主角候选数", type: "number", defaultValue: 5, description: "主角图像候选数量" },
      { key: "supporting_character_candidates", label: "配角候选数", type: "number", defaultValue: 3, description: "配角图像候选数量" },
      { key: "location_candidates", label: "场景候选数", type: "number", defaultValue: 3, description: "场景图像候选数量" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N07",
    name: "美术产品图生成",
    stage: 1,
    stageGroup: "art",
    category: "comfyui",
    description: "通过 ComfyUI + FLUX.2 Dev 生成角色/场景/道具候选图",
    dependsOn: ["N06"],
    isGate: false,
    isQC: false,
    model: "FLUX.2 Dev",
    fallbackModels: ["Z-Image-Turbo"],
    agentRole: "visual_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "timeout_s", label: "超时(秒)", type: "number", defaultValue: 1800, description: "多资产多候选总超时" },
      { key: "max_retries", label: "最大重试", type: "number", defaultValue: 2, description: "每个资产重试次数" },
      { key: "execution_mode", label: "执行模式", type: "select", defaultValue: "parallel_per_asset", options: ["parallel_per_asset", "sequential"], description: "并行或串行生成" },
    ],
    qcConfig: null,
    outputScope: "per_asset",
  },
  {
    id: "N08",
    name: "Stage1 资产审核 Gate",
    stage: 1,
    stageGroup: "art",
    category: "gate",
    description: "人工审核美术资产（角色/场景/道具），按资产粒度逐个审批",
    dependsOn: ["N07"],
    isGate: true,
    isQC: false,
    model: null,
    fallbackModels: [],
    agentRole: "human_review_entry",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [],
    qcConfig: null,
    outputScope: "per_asset",
  },

  // ── Stage 2: Keyframe & Video ──
  {
    id: "N09",
    name: "美术定稿固化",
    stage: 2,
    stageGroup: "art",
    category: "freeze",
    description: "固化人审选定的美术资产，用 FireRed 生成角色变体套件",
    dependsOn: ["N08"],
    isGate: false,
    isQC: false,
    model: "FireRed-1.1",
    fallbackModels: ["FLUX.2 Dev"],
    agentRole: "visual_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "timeout_s", label: "超时(秒)", type: "number", defaultValue: 600, description: "FireRed 批量生成超时" },
      { key: "variants_per_character", label: "每角色变体数", type: "number", defaultValue: 8, description: "5-10 个变体" },
    ],
    qcConfig: null,
    outputScope: "per_asset",
  },
  {
    id: "N10",
    name: "关键帧生成",
    stage: 2,
    stageGroup: "keyframe",
    category: "comfyui",
    description: "用 FLUX.2 + FireRed + ControlNet 为每个镜头生成关键帧候选",
    dependsOn: ["N06", "N09"],
    isGate: false,
    isQC: false,
    model: "FLUX.2 Dev + FireRed-1.1",
    fallbackModels: ["Z-Image-Turbo"],
    agentRole: "visual_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "timeout_s", label: "每镜头超时(秒)", type: "number", defaultValue: 300, description: "单镜头生成超时" },
      { key: "max_retries", label: "最大重试", type: "number", defaultValue: 2, description: "重试次数" },
      { key: "resolution", label: "分辨率", type: "select", defaultValue: "2048x1152", options: ["2048x1152", "1152x2048", "1536x1536"], description: "关键帧分辨率" },
    ],
    qcConfig: null,
    outputScope: "per_shot",
  },
  {
    id: "N11",
    name: "关键帧质检",
    stage: 2,
    stageGroup: "keyframe",
    category: "qc",
    description: "按 qc_tier 选用 1-3 个模型，8 维评分关键帧质量，< 7.5 打回 N10",
    dependsOn: ["N10"],
    isGate: false,
    isQC: true,
    model: null,
    fallbackModels: [],
    agentRole: "quality_guardian",
    systemPrompt: `你是关键帧质检专家。请从以下 8 个维度对关键帧进行评分（每个维度 0-10 分）：

1. character_consistency（角色一致性）：角色外貌是否与参考图一致
2. body_integrity（人体完整性）：人体比例、四肢是否正常
3. tone_consistency（色调一致性）：色调是否与场景风格一致
4. script_fidelity（剧本还原度）：画面是否准确还原剧本描述
5. action_accuracy（动作准确性）：角色动作是否符合剧本要求
6. expression_match（表情匹配度）：表情是否匹配对白情绪
7. composition（构图）：构图是否美观、符合镜头类型
8. lighting_consistency（光照一致性）：光照方向和强度是否合理

输出加权平均分和每个维度的详细评分。`,
    userPromptTemplate: `请对以下关键帧进行质检：

【镜头规格 ShotSpec】
{{shot_spec_json}}

【关键帧图片】
{{keyframe_images}}

【角色参考图】
{{character_references}}`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.3, description: "低温度保证评分稳定" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 8192, description: "评分输出" },
      { key: "threshold", label: "通过阈值", type: "number", defaultValue: 7.5, description: "加权平均低于此值自动打回" },
    ],
    qcConfig: {
      votingModels: ["gemini-3.1-pro-preview", "claude-opus-4-6", "gpt-5.4"],
      threshold: 7.5,
      dimensions: QC_N11_DIMENSIONS,
    },
    outputScope: "per_shot",
  },
  {
    id: "N12",
    name: "跨镜头连续性检查",
    stage: 2,
    stageGroup: "keyframe",
    category: "llm",
    description: "多模态分析全集关键帧序列，检查场景转换、角色外观、节奏等连续性",
    dependsOn: ["N11"],
    isGate: false,
    isQC: false,
    model: "gemini-3.1-pro-preview",
    fallbackModels: ["gpt-5.4"],
    agentRole: "storyboard_planner",
    systemPrompt: `你是连续性检查专家。分析全集关键帧序列，检查以下方面：
- 场景转换是否自然
- 角色外观是否前后一致（服装、发型、面部特征）
- 光照和色调是否连贯
- 道具是否出现不一致
- 时间线是否有跳跃

输出 ContinuityReport JSON。`,
    userPromptTemplate: `请分析以下全集关键帧的连续性：

【全集关键帧列表】
{{episode_keyframes}}

【角色参考图】
{{character_references}}`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.3, description: "分析温度" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 8192, description: "报告输出" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N13",
    name: "关键帧定稿固化",
    stage: 2,
    stageGroup: "keyframe",
    category: "freeze",
    description: "固化关键帧：无问题直接冻结，有问题用 FireRed 修补",
    dependsOn: ["N12"],
    isGate: false,
    isQC: false,
    model: "FireRed-1.1 (Edit)",
    fallbackModels: [],
    agentRole: "visual_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "timeout_s", label: "超时(秒)", type: "number", defaultValue: 300, description: "修补超时" },
      { key: "skip_if_no_issues", label: "无问题跳过", type: "boolean", defaultValue: true, description: "无连续性问题时跳过修补" },
    ],
    qcConfig: null,
    outputScope: "per_shot",
  },
  {
    id: "N14",
    name: "视频生成",
    stage: 2,
    stageGroup: "video",
    category: "comfyui",
    description: "i2v 图生视频：以冻结关键帧为起始帧，生成镜头视频候选",
    dependsOn: ["N13"],
    isGate: false,
    isQC: false,
    model: "LTX-2.3",
    fallbackModels: ["Wan2.2", "SkyReels"],
    agentRole: "visual_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "timeout_s", label: "每镜头超时(秒)", type: "number", defaultValue: 600, description: "视频生成较慢，3-8 分钟" },
      { key: "max_retries", label: "最大重试", type: "number", defaultValue: 2, description: "重试次数" },
      { key: "resolution", label: "分辨率", type: "select", defaultValue: "1920x1080", options: ["1920x1080", "1080x1920"], description: "视频分辨率" },
      { key: "extra_duration_s", label: "额外时长(秒)", type: "number", defaultValue: 0.5, description: "比 ShotSpec 多生成的时长" },
    ],
    qcConfig: null,
    outputScope: "per_shot",
  },
  {
    id: "N15",
    name: "视频质检",
    stage: 2,
    stageGroup: "video",
    category: "qc",
    description: "按 qc_tier 评分视频质量（8 维），单维 < 5.0 直接打回",
    dependsOn: ["N14"],
    isGate: false,
    isQC: true,
    model: null,
    fallbackModels: [],
    agentRole: "quality_guardian",
    systemPrompt: `你是视频质检专家。从以下 8 个维度评分（0-10 分）：

1. character_consistency（角色一致性）
2. motion_fluidity（运动流畅性）
3. physics_plausibility（物理合理性）
4. action_accuracy（动作准确性）
5. expression_match（表情匹配度）
6. composition（构图）
7. lighting_consistency（光照一致性）
8. continuity_score（连续性）

多级拒绝阈值（短路优先）：
1. 任何维度 < 5.0 → 立即拒绝
2. character_consistency < 7.0 → 拒绝
3. physics_plausibility < 6.0 → 拒绝
4. 加权平均 < 7.5 → 拒绝`,
    userPromptTemplate: `请对以下视频候选进行质检：

【镜头规格 ShotSpec】
{{shot_spec_json}}

【视频候选帧截图】
{{video_frames}}

【对应关键帧参考】
{{keyframe_reference}}`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.3, description: "评分温度" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 8192, description: "评分输出" },
      { key: "threshold", label: "通过阈值", type: "number", defaultValue: 7.5, description: "加权平均阈值" },
      { key: "single_dim_floor", label: "单维下限", type: "number", defaultValue: 5.0, description: "任何维度低于此值直接打回" },
    ],
    qcConfig: {
      votingModels: ["gemini-3.1-pro-preview", "claude-opus-4-6", "gpt-5.4"],
      threshold: 7.5,
      dimensions: QC_N15_DIMENSIONS,
      singleDimFloor: 5.0,
    },
    outputScope: "per_shot",
  },
  {
    id: "N16",
    name: "节奏连续性分析",
    stage: 2,
    stageGroup: "video",
    category: "llm",
    description: "分析全集视频节奏、时长偏差、场景转换，生成修剪建议",
    dependsOn: ["N15"],
    isGate: false,
    isQC: false,
    model: "gemini-3.1-pro-preview",
    fallbackModels: ["gpt-5.4"],
    agentRole: "storyboard_planner",
    systemPrompt: `你是节奏分析专家。分析全集视频的节奏连贯性：
- 整体时长是否符合目标（60-90 秒）
- 每个镜头时长是否合理
- 场景转换是否流畅
- 是否需要修剪（trim）

输出 PacingReport JSON，含 trim_suggestion（start_sec, end_sec）。`,
    userPromptTemplate: `请分析以下全集视频的节奏：

【全集视频列表（帧截图）】
{{episode_video_frames}}

【目标时长】
{{target_duration_sec}} 秒`,
    params: [
      { key: "temperature", label: "Temperature", type: "number", defaultValue: 0.3, description: "分析温度" },
      { key: "max_tokens", label: "Max Tokens", type: "number", defaultValue: 8192, description: "报告输出" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N17",
    name: "视频定稿固化",
    stage: 2,
    stageGroup: "video",
    category: "freeze",
    description: "冻结视频：按 PacingReport 修剪后上传 TOS",
    dependsOn: ["N16"],
    isGate: false,
    isQC: false,
    model: "FFmpeg",
    fallbackModels: [],
    agentRole: "visual_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "crf", label: "CRF 质量", type: "number", defaultValue: 23, description: "H.264 CRF 值，越低质量越高" },
      { key: "preset", label: "编码预设", type: "select", defaultValue: "fast", options: ["ultrafast", "fast", "medium", "slow"], description: "编码速度/质量权衡" },
      { key: "max_size_mb", label: "最大文件(MB)", type: "number", defaultValue: 500, description: "单集视频最大体积" },
    ],
    qcConfig: null,
    outputScope: "per_shot",
  },
  {
    id: "N18",
    name: "Stage2 Shot 审核 Gate",
    stage: 2,
    stageGroup: "video",
    category: "gate",
    description: "人工逐镜头审核冻结视频，可单独打回个别镜头重生成",
    dependsOn: ["N17"],
    isGate: true,
    isQC: false,
    model: null,
    fallbackModels: [],
    agentRole: "human_review_entry",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [],
    qcConfig: null,
    outputScope: "per_shot",
  },

  // ── Stage 3: Audio ──
  {
    id: "N19",
    name: "视觉整体定稿",
    stage: 3,
    stageGroup: "video",
    category: "freeze",
    description: "验证 N18 审核通过后，标记所有视频为最终视觉冻结",
    dependsOn: ["N18"],
    isGate: false,
    isQC: false,
    model: null,
    fallbackModels: [],
    agentRole: "visual_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N20",
    name: "视听整合",
    stage: 3,
    stageGroup: "audio",
    category: "audio",
    description: "TTS 语音 + BGM + 声效 + 唇形同步 + 混音 + 字幕",
    dependsOn: ["N19"],
    isGate: false,
    isQC: false,
    model: "ElevenLabs + Suno + LatentSync",
    fallbackModels: [],
    agentRole: "audio_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "tts_model", label: "TTS 模型", type: "select", defaultValue: "elevenlabs/text-to-speech-multilingual-v2", options: ["elevenlabs/text-to-speech-multilingual-v2"], description: "TTS 语音合成模型" },
      { key: "tts_voice", label: "TTS 默认嗓音", type: "string", defaultValue: "Rachel", description: "默认语音角色" },
      { key: "bgm_model", label: "BGM 模型版本", type: "select", defaultValue: "V4", options: ["V3_5", "V4", "V4_5", "V4_5PLUS", "V5"], description: "Suno BGM 模型版本" },
      { key: "bgm_instrumental", label: "纯音乐 BGM", type: "boolean", defaultValue: true, description: "BGM 是否为纯音乐（无人声）" },
      { key: "sfx_model", label: "SFX 模型", type: "select", defaultValue: "elevenlabs/sound-effect-v2", options: ["elevenlabs/sound-effect-v2"], description: "声效生成模型" },
      { key: "sfx_default_duration", label: "SFX 默认时长(秒)", type: "number", defaultValue: 3, description: "声效片段默认时长" },
      { key: "skip_lip_sync", label: "跳过唇形同步", type: "boolean", defaultValue: true, description: "MVP 阶段 GPU 未到位时跳过" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N21",
    name: "Stage3 Episode 审核 Gate",
    stage: 3,
    stageGroup: "audio",
    category: "gate",
    description: "人工审核整集视听合成效果",
    dependsOn: ["N20"],
    isGate: true,
    isQC: false,
    model: null,
    fallbackModels: [],
    agentRole: "human_review_entry",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [],
    qcConfig: null,
    outputScope: "episode",
  },

  // ── Stage 4: Final ──
  {
    id: "N22",
    name: "视听定稿固化",
    stage: 4,
    stageGroup: "audio",
    category: "freeze",
    description: "验证 N21 审核通过后，冻结所有视听产物",
    dependsOn: ["N21"],
    isGate: false,
    isQC: false,
    model: null,
    fallbackModels: [],
    agentRole: "audio_director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N23",
    name: "成片合成",
    stage: 4,
    stageGroup: "final",
    category: "ffmpeg",
    description: "FFmpeg 拼接视频 + 混音 + 字幕烧录 + 水印 → 成片 MP4",
    dependsOn: ["N22"],
    isGate: false,
    isQC: false,
    model: "FFmpeg",
    fallbackModels: [],
    agentRole: "director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "crf", label: "CRF 质量", type: "number", defaultValue: 23, description: "H.264 CRF" },
      { key: "preset", label: "编码预设", type: "select", defaultValue: "fast", options: ["ultrafast", "fast", "medium", "slow"], description: "编码预设" },
      { key: "audio_bitrate", label: "音频比特率", type: "string", defaultValue: "128k", description: "AAC 音频比特率" },
      { key: "burn_subtitles", label: "烧录字幕", type: "boolean", defaultValue: true, description: "是否将字幕烧录到视频" },
      { key: "add_watermark", label: "添加水印", type: "boolean", defaultValue: false, description: "是否添加水印" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N24",
    name: "Stage4 串行审核 Gate",
    stage: 4,
    stageGroup: "final",
    category: "gate",
    description: "三步串行审核：QC审查 → 中台审核 → 合作方确认",
    dependsOn: ["N23"],
    isGate: true,
    isQC: false,
    model: null,
    fallbackModels: [],
    agentRole: "human_review_entry",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N25",
    name: "成片定稿固化",
    stage: 4,
    stageGroup: "final",
    category: "freeze",
    description: "标记成片为 delivered，设置归档保留策略",
    dependsOn: ["N24"],
    isGate: false,
    isQC: false,
    model: null,
    fallbackModels: [],
    agentRole: "director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "retention_final_cut", label: "成片保留", type: "select", defaultValue: "permanent", options: ["permanent", "temp_90d", "temp_30d"], description: "成片保留策略" },
      { key: "retention_intermediates", label: "中间产物保留", type: "select", defaultValue: "temp_30d", options: ["permanent", "temp_90d", "temp_30d"], description: "候选/workflow 保留策略" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
  {
    id: "N26",
    name: "分发与推送",
    stage: 4,
    stageGroup: "final",
    category: "logic",
    description: "创建 DistributionRecord（MVP 阶段为草稿，不真实推送）",
    dependsOn: ["N25"],
    isGate: false,
    isQC: false,
    model: null,
    fallbackModels: [],
    agentRole: "director",
    systemPrompt: null,
    userPromptTemplate: null,
    params: [
      { key: "auto_publish", label: "自动发布", type: "boolean", defaultValue: false, description: "MVP 阶段始终为 false" },
      { key: "platforms", label: "目标平台", type: "string", defaultValue: "tiktok,feishu,youtube", description: "逗号分隔的平台列表" },
    ],
    qcConfig: null,
    outputScope: "episode",
  },
]

// ── Helper functions ──

export function getNodeSpec(nodeId: string): NodeSpec | undefined {
  return NODE_SPECS.find(n => n.id === nodeId)
}

export function getNodesByStage(stage: number): NodeSpec[] {
  return NODE_SPECS.filter(n => n.stage === stage)
}

export function getNodesByGroup(group: string): NodeSpec[] {
  return NODE_SPECS.filter(n => n.stageGroup === group)
}

export const STAGE_NAMES: Record<number, string> = {
  1: "剧本与资产",
  2: "关键帧与视频",
  3: "视听整合",
  4: "最终成片",
}

export const STAGE_GROUPS = [
  { id: "script", label: "脚本", stage: 1, nodeIds: ["N01", "N02", "N03", "N04", "N05"] },
  { id: "art", label: "美术", stage: 1, nodeIds: ["N06", "N07", "N08", "N09"] },
  { id: "keyframe", label: "关键帧", stage: 2, nodeIds: ["N10", "N11", "N12", "N13"] },
  { id: "video", label: "视频", stage: 2, nodeIds: ["N14", "N15", "N16", "N17", "N18", "N19"] },
  { id: "audio", label: "音频", stage: 3, nodeIds: ["N20", "N21"] },
  { id: "final", label: "成片", stage: 4, nodeIds: ["N22", "N23", "N24", "N25", "N26"] },
]

export function getCategoryLabel(cat: NodeCategory): string {
  const labels: Record<NodeCategory, string> = {
    llm: "LLM 推理",
    qc: "多模型质检",
    comfyui: "ComfyUI 生成",
    freeze: "固化",
    gate: "人工审核",
    audio: "音频处理",
    ffmpeg: "FFmpeg 合成",
    logic: "逻辑处理",
  }
  return labels[cat]
}

export function getCategoryColor(cat: NodeCategory): string {
  const colors: Record<NodeCategory, string> = {
    llm: "text-violet-400 bg-violet-500/10 border-violet-500/30",
    qc: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    comfyui: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    freeze: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    gate: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    audio: "text-pink-400 bg-pink-500/10 border-pink-500/30",
    ffmpeg: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    logic: "text-gray-400 bg-gray-500/10 border-gray-500/30",
  }
  return colors[cat]
}
