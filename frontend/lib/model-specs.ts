// 模型接口测试 - 模型和工作流规格定义

// ============ 类型定义 ============

export type ParamType = "string" | "number" | "file" | "select" | "textarea"

export interface ParamSpec {
  key: string
  label: string
  type: ParamType
  default?: string | number
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: string }[]
  placeholder?: string
  required?: boolean
  description?: string
}

export interface ModelSpec {
  id: string
  name: string
  category: "llm" | "image" | "video" | "audio" | "other"
  description: string
  vram?: string
  params: ParamSpec[]
  outputType: "text" | "image" | "video" | "audio" | "json"
  // 成本估算
  costPerCall?: number // 固定成本（元）
  costPerToken?: { input: number; output: number } // 每百万 token 成本（元）
  estimatedDuration?: number // 预估耗时（秒）
}

// ============ LLM 模型 ============

export const LLM_MODELS: ModelSpec[] = [
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro",
    category: "llm",
    description: "一梯队旗舰模型，性价比最优，适合脚本阶段",
    params: [
      { key: "system_prompt", label: "系统提示词", type: "textarea", placeholder: "定义 Agent 角色和约束...", required: false },
      { key: "user_prompt", label: "用户提示词", type: "textarea", placeholder: "具体任务输入...", required: true },
      { key: "temperature", label: "Temperature", type: "number", default: 0.3, min: 0, max: 1, step: 0.1, description: "0=确定性输出，1=更多创意" },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 16384, min: 256, max: 32768, step: 256 },
      { key: "json_mode", label: "JSON 模式", type: "select", default: "false", options: [{ label: "否", value: "false" }, { label: "是", value: "true" }] },
    ],
    outputType: "text",
    costPerToken: { input: 9.79, output: 58.75 },
    estimatedDuration: 5,
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    category: "llm",
    description: "一梯队旗舰，适合 QC 投票",
    params: [
      { key: "system_prompt", label: "系统提示词", type: "textarea", placeholder: "定义 Agent 角色和约束...", required: false },
      { key: "user_prompt", label: "用户提示词", type: "textarea", placeholder: "具体任务输入...", required: true },
      { key: "temperature", label: "Temperature", type: "number", default: 0.3, min: 0, max: 1, step: 0.1 },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 16384, min: 256, max: 32768, step: 256 },
      { key: "json_mode", label: "JSON 模式", type: "select", default: "false", options: [{ label: "否", value: "false" }, { label: "是", value: "true" }] },
    ],
    outputType: "text",
    costPerToken: { input: 24.30, output: 121.52 },
    estimatedDuration: 8,
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    category: "llm",
    description: "一梯队旗舰，适合 QC 投票",
    params: [
      { key: "system_prompt", label: "系统提示词", type: "textarea", placeholder: "定义 Agent 角色和约束...", required: false },
      { key: "user_prompt", label: "用户提示词", type: "textarea", placeholder: "具体任务输入...", required: true },
      { key: "temperature", label: "Temperature", type: "number", default: 0.3, min: 0, max: 1, step: 0.1 },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 16384, min: 256, max: 32768, step: 256 },
      { key: "json_mode", label: "JSON 模式", type: "select", default: "false", options: [{ label: "否", value: "false" }, { label: "是", value: "true" }] },
    ],
    outputType: "text",
    costPerToken: { input: 12.24, output: 73.44 },
    estimatedDuration: 6,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    category: "llm",
    description: "二梯队，成本敏感场景首选",
    params: [
      { key: "system_prompt", label: "系统提示词", type: "textarea", placeholder: "定义 Agent 角色和约束...", required: false },
      { key: "user_prompt", label: "用户提示词", type: "textarea", placeholder: "具体任务输入...", required: true },
      { key: "temperature", label: "Temperature", type: "number", default: 0.3, min: 0, max: 1, step: 0.1 },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 8192, min: 256, max: 16384, step: 256 },
      { key: "json_mode", label: "JSON 模式", type: "select", default: "false", options: [{ label: "否", value: "false" }, { label: "是", value: "true" }] },
    ],
    outputType: "text",
    costPerToken: { input: 1.47, output: 12.24 },
    estimatedDuration: 3,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    category: "llm",
    description: "最低成本兜底模型",
    params: [
      { key: "system_prompt", label: "系统提示词", type: "textarea", placeholder: "定义 Agent 角色和约束...", required: false },
      { key: "user_prompt", label: "用户提示词", type: "textarea", placeholder: "具体任务输入...", required: true },
      { key: "temperature", label: "Temperature", type: "number", default: 0.3, min: 0, max: 1, step: 0.1 },
      { key: "max_tokens", label: "Max Tokens", type: "number", default: 4096, min: 256, max: 8192, step: 256 },
      { key: "json_mode", label: "JSON 模式", type: "select", default: "false", options: [{ label: "否", value: "false" }, { label: "是", value: "true" }] },
    ],
    outputType: "text",
    costPerToken: { input: 0.73, output: 2.94 },
    estimatedDuration: 2,
  },
]

// ============ ComfyUI 工作流 ============

export const COMFYUI_WORKFLOWS: ModelSpec[] = [
  // 文生图 / 图像处理
  {
    id: "wf-01-flux-dev",
    name: "WF-01: FLUX.2 Dev 32B",
    category: "image",
    description: "高质量角色/场景图生成，管线主力文生图模型",
    vram: "~20GB",
    params: [
      { key: "positive_prompt", label: "正向提示词", type: "textarea", required: true, placeholder: "描述目标画面内容..." },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "", placeholder: "排除不想要的元素..." },
      { key: "width", label: "宽度", type: "number", default: 1024, min: 512, max: 2048, step: 8, description: "需为8的倍数" },
      { key: "height", label: "高度", type: "number", default: 1024, min: 512, max: 2048, step: 8 },
      { key: "steps", label: "采样步数", type: "number", default: 20, min: 15, max: 30, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 1.0, min: 1.0, max: 3.0, step: 0.1, description: "FLUX 架构 1.0 已足够" },
      { key: "seed", label: "种子", type: "number", default: -1, description: "-1 为随机" },
      { key: "sampler", label: "采样器", type: "select", default: "euler", options: [{ label: "Euler", value: "euler" }, { label: "DPM++ 2M", value: "dpmpp_2m" }] },
    ],
    outputType: "image",
    costPerCall: 0.20,
    estimatedDuration: 25,
  },
  {
    id: "wf-02-z-turbo",
    name: "WF-02: Z-Image-Turbo",
    category: "image",
    description: "快速预览/草图生成，速度比 FLUX 快 5-8 倍",
    vram: "~8GB",
    params: [
      { key: "positive_prompt", label: "正向提示词", type: "textarea", required: true },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "" },
      { key: "width", label: "宽度", type: "number", default: 1024, min: 512, max: 2048, step: 8 },
      { key: "height", label: "高度", type: "number", default: 1024, min: 512, max: 2048, step: 8 },
      { key: "steps", label: "采样步数", type: "number", default: 4, min: 4, max: 6, step: 1, description: "Turbo 仅需 4 步" },
      { key: "cfg", label: "CFG Scale", type: "number", default: 1.0, min: 1.0, max: 2.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "image",
    costPerCall: 0.05,
    estimatedDuration: 5,
  },
  {
    id: "wf-08-firered",
    name: "WF-08: FireRed-1.1",
    category: "image",
    description: "多参考图编辑 - 角色换装、风格迁移",
    vram: "~12GB",
    params: [
      { key: "source_image", label: "源图片", type: "file", required: true },
      { key: "reference_images", label: "参考图（1-3张）", type: "file", required: true, description: "服装/体型/风格来源" },
      { key: "prompt", label: "编辑指令", type: "textarea", required: true, placeholder: "如：穿上参考图中的红色裙子" },
      { key: "steps", label: "采样步数", type: "number", default: 28, min: 20, max: 40, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 3.5, min: 2.0, max: 5.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "image",
    costPerCall: 0.15,
    estimatedDuration: 30,
  },
  {
    id: "wf-09-pulid",
    name: "WF-09: PuLID-FLUX",
    category: "image",
    description: "人脸 ID 保持 - 跨场景角色一致性",
    vram: "~20GB",
    params: [
      { key: "face_image", label: "人脸参考照片", type: "file", required: true, description: "正面、清晰、无遮挡效果最佳" },
      { key: "positive_prompt", label: "目标场景描述", type: "textarea", required: true },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "" },
      { key: "width", label: "宽度", type: "number", default: 1024, min: 512, max: 2048, step: 8 },
      { key: "height", label: "高度", type: "number", default: 1024, min: 512, max: 2048, step: 8 },
      { key: "id_weight", label: "人脸 ID 权重", type: "number", default: 1.0, min: 0.6, max: 1.2, step: 0.1, description: "越高越像参考人脸" },
      { key: "steps", label: "采样步数", type: "number", default: 20, min: 15, max: 30, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 1.0, min: 1.0, max: 3.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "image",
    costPerCall: 0.25,
    estimatedDuration: 30,
  },

  // 视频生成
  {
    id: "wf-03-wan-i2v",
    name: "WF-03: Wan2.2 14B I2V",
    category: "video",
    description: "图生视频，管线主力视频生成方案",
    vram: "~14GB",
    params: [
      { key: "image", label: "输入参考图", type: "file", required: true, description: "作为视频首帧" },
      { key: "positive_prompt", label: "运动描述", type: "textarea", required: true, placeholder: "如：人物缓慢转身看向窗外" },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "blurry, low quality" },
      { key: "width", label: "宽度", type: "number", default: 832, min: 480, max: 1280, step: 16, description: "需为16的倍数" },
      { key: "height", label: "高度", type: "number", default: 480, min: 480, max: 832, step: 16 },
      { key: "num_frames", label: "帧数", type: "number", default: 81, min: 41, max: 121, step: 1, description: "81帧 ≈ 5s @16fps" },
      { key: "steps", label: "采样步数", type: "number", default: 30, min: 20, max: 40, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 6.0, min: 5.0, max: 7.0, step: 0.1 },
      { key: "denoise", label: "去噪强度", type: "number", default: 1.0, min: 0.5, max: 1.0, step: 0.1, description: "1.0=完全重新生成" },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "video",
    costPerCall: 0.80,
    estimatedDuration: 120,
  },
  {
    id: "wf-04-wan-t2v",
    name: "WF-04: Wan2.2 14B T2V",
    category: "video",
    description: "文生视频 - 无参考图纯文字生成",
    vram: "~14GB",
    params: [
      { key: "positive_prompt", label: "场景和运动描述", type: "textarea", required: true },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "blurry, low quality" },
      { key: "width", label: "宽度", type: "number", default: 832, min: 480, max: 1280, step: 16 },
      { key: "height", label: "高度", type: "number", default: 480, min: 480, max: 832, step: 16 },
      { key: "num_frames", label: "帧数", type: "number", default: 81, min: 41, max: 121, step: 1 },
      { key: "steps", label: "采样步数", type: "number", default: 30, min: 20, max: 40, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 6.0, min: 5.0, max: 7.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "video",
    costPerCall: 0.80,
    estimatedDuration: 120,
  },
  {
    id: "wf-05-wan-flf2v",
    name: "WF-05: Wan2.2 14B FLF2V",
    category: "video",
    description: "首末帧生视频 - 镜头间过渡",
    vram: "~14GB",
    params: [
      { key: "first_frame", label: "首帧图片", type: "file", required: true },
      { key: "last_frame", label: "末帧图片", type: "file", required: true },
      { key: "positive_prompt", label: "中间过渡运动描述", type: "textarea", required: true },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "blurry" },
      { key: "width", label: "宽度", type: "number", default: 832, min: 480, max: 1280, step: 16 },
      { key: "height", label: "高度", type: "number", default: 480, min: 480, max: 832, step: 16 },
      { key: "num_frames", label: "帧数", type: "number", default: 81, min: 41, max: 121, step: 1 },
      { key: "steps", label: "采样步数", type: "number", default: 30, min: 20, max: 40, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 6.0, min: 5.0, max: 7.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "video",
    costPerCall: 0.85,
    estimatedDuration: 130,
  },
  {
    id: "wf-06-ltx-i2v",
    name: "WF-06: LTX-Video 2.3 I2V",
    category: "video",
    description: "轻量级图生视频，VRAM 占用低 ~30%",
    vram: "~10GB",
    params: [
      { key: "image", label: "输入参考图", type: "file", required: true },
      { key: "positive_prompt", label: "运动描述", type: "textarea", required: true },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "" },
      { key: "width", label: "宽度", type: "number", default: 768, min: 512, max: 1024, step: 8 },
      { key: "height", label: "高度", type: "number", default: 512, min: 512, max: 768, step: 8 },
      { key: "num_frames", label: "帧数", type: "number", default: 97, min: 49, max: 121, step: 1, description: "97帧 ≈ 7s" },
      { key: "steps", label: "采样步数", type: "number", default: 20, min: 15, max: 25, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 1.0, min: 1.0, max: 2.0, step: 0.1, description: "LTX 低 CFG 即可" },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "video",
    costPerCall: 0.60,
    estimatedDuration: 90,
  },
  {
    id: "wf-07-ltx-t2v",
    name: "WF-07: LTX-Video 2.3 T2V",
    category: "video",
    description: "LTX 架构纯文字生成视频",
    vram: "~10GB",
    params: [
      { key: "positive_prompt", label: "场景和运动描述", type: "textarea", required: true },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "" },
      { key: "width", label: "宽度", type: "number", default: 768, min: 512, max: 1024, step: 8 },
      { key: "height", label: "高度", type: "number", default: 512, min: 512, max: 768, step: 8 },
      { key: "num_frames", label: "帧数", type: "number", default: 97, min: 49, max: 121, step: 1 },
      { key: "steps", label: "采样步数", type: "number", default: 20, min: 15, max: 25, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 1.0, min: 1.0, max: 2.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "video",
    costPerCall: 0.60,
    estimatedDuration: 90,
  },
  {
    id: "wf-ltx-4kf",
    name: "自研: LTX-2.3 四关键帧",
    category: "video",
    description: "4 个关键帧图片驱动视频生成，两阶段扩散采样",
    vram: "~12GB",
    params: [
      { key: "positive_prompt", label: "正向提示词", type: "textarea", required: true },
      { key: "negative_prompt", label: "负向提示词", type: "textarea", default: "" },
      { key: "prompt_suffix", label: "提示词后缀", type: "string", default: "", description: "自动追加的品质标签" },
      { key: "keyframe_1", label: "关键帧1（起始）", type: "file", required: true },
      { key: "keyframe_2", label: "关键帧2", type: "file", required: true },
      { key: "keyframe_3", label: "关键帧3", type: "file", required: true },
      { key: "keyframe_4", label: "关键帧4（结尾）", type: "file", required: true },
      { key: "frame_pos_2", label: "帧位置2", type: "number", default: 0.3, min: 0.2, max: 0.4, step: 0.05 },
      { key: "frame_pos_3", label: "帧位置3", type: "number", default: 0.7, min: 0.6, max: 0.8, step: 0.05 },
      { key: "frame_weight_1", label: "帧权重1", type: "number", default: 1.0, min: 0.5, max: 1.5, step: 0.1 },
      { key: "frame_weight_2", label: "帧权重2", type: "number", default: 0.3, min: 0.1, max: 0.8, step: 0.1 },
      { key: "frame_weight_3", label: "帧权重3", type: "number", default: 0.3, min: 0.1, max: 0.8, step: 0.1 },
      { key: "frame_weight_4", label: "帧权重4", type: "number", default: 1.0, min: 0.5, max: 1.5, step: 0.1 },
      { key: "duration", label: "时长(秒)", type: "number", default: 7.0, min: 3, max: 15, step: 0.5 },
      { key: "width", label: "宽度", type: "number", default: 768, min: 512, max: 1024, step: 8 },
      { key: "height", label: "高度", type: "number", default: 512, min: 512, max: 768, step: 8 },
      { key: "num_frames", label: "帧数", type: "number", default: 97, min: 49, max: 161, step: 1 },
      { key: "cfg_stage1", label: "CFG（阶段1）", type: "number", default: 1.0, min: 1.0, max: 2.0, step: 0.1 },
      { key: "cfg_stage2", label: "CFG（阶段2）", type: "number", default: 1.0, min: 1.0, max: 2.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "video",
    costPerCall: 0.70,
    estimatedDuration: 100,
  },
  {
    id: "wf-14-seedvr2",
    name: "WF-14: SeedVR2",
    category: "video",
    description: "视频超分辨率，512p → 1080p",
    vram: "~12GB",
    params: [
      { key: "video", label: "输入视频", type: "file", required: true },
      { key: "scale", label: "放大倍数", type: "select", default: "2.0", options: [{ label: "2x", value: "2.0" }, { label: "4x", value: "4.0" }] },
      { key: "steps", label: "去噪步数", type: "number", default: 20, min: 15, max: 30, step: 1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "video",
    costPerCall: 0.50,
    estimatedDuration: 60,
  },

  // 音频
  {
    id: "wf-10-cosyvoice",
    name: "WF-10: CosyVoice 3.0",
    category: "audio",
    description: "语音合成 TTS，支持声音克隆",
    vram: "~4GB",
    params: [
      { key: "text", label: "要朗读的文本", type: "textarea", required: true },
      { key: "voice_sample", label: "参考音色样本", type: "file", required: true, description: "3-10s WAV 文件" },
      { key: "language", label: "语言", type: "select", default: "zh", options: [{ label: "中文", value: "zh" }, { label: "英语", value: "en" }, { label: "日语", value: "ja" }, { label: "韩语", value: "ko" }] },
      { key: "speed", label: "语速倍率", type: "number", default: 1.0, min: 0.5, max: 2.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "audio",
    costPerCall: 0.05,
    estimatedDuration: 10,
  },
  {
    id: "wf-11-ace-step",
    name: "WF-11: ACE-Step 1.5",
    category: "audio",
    description: "BGM 音乐生成，支持纯音乐和歌曲，最长 300 秒",
    vram: "~4GB",
    params: [
      { key: "lyrics", label: "歌词内容", type: "textarea", default: "", placeholder: "纯 BGM 留空" },
      { key: "tags", label: "风格标签", type: "string", required: true, placeholder: "如: cinematic, orchestral, dramatic, 120bpm" },
      { key: "duration", label: "时长(秒)", type: "number", default: 60.0, min: 10, max: 300, step: 5 },
      { key: "steps", label: "去噪步数", type: "number", default: 100, min: 60, max: 200, step: 10, description: "越高质量越好" },
      { key: "cfg", label: "CFG Scale", type: "number", default: 3.0, min: 2.0, max: 5.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "audio",
    costPerCall: 0.30,
    estimatedDuration: 60,
  },
  {
    id: "wf-12-foley",
    name: "WF-12: HunyuanVideo-Foley",
    category: "audio",
    description: "视频转音效 - 自动生成环境音/拟音",
    vram: "~8GB",
    params: [
      { key: "video", label: "输入视频", type: "file", required: true },
      { key: "prompt", label: "音效描述提示", type: "string", default: "", placeholder: "如: footsteps on gravel, wind" },
      { key: "steps", label: "去噪步数", type: "number", default: 25, min: 15, max: 40, step: 1 },
      { key: "cfg", label: "CFG Scale", type: "number", default: 4.5, min: 3.0, max: 7.0, step: 0.1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "audio",
    costPerCall: 0.15,
    estimatedDuration: 30,
  },
  {
    id: "wf-13-lipsync",
    name: "WF-13: LatentSync v1.6",
    category: "video",
    description: "口型同步 - 让视频人物嘴型匹配配音",
    vram: "~6GB",
    params: [
      { key: "video", label: "输入人物说话视频", type: "file", required: true },
      { key: "audio", label: "目标语音音频", type: "file", required: true, description: "已配好的台词" },
      { key: "steps", label: "推理步数", type: "number", default: 20, min: 15, max: 30, step: 1 },
      { key: "seed", label: "种子", type: "number", default: -1 },
    ],
    outputType: "video",
    costPerCall: 0.25,
    estimatedDuration: 45,
  },
]

// ============ 所有模型汇总 ============

export const ALL_MODELS: ModelSpec[] = [...LLM_MODELS, ...COMFYUI_WORKFLOWS]

export function getModelById(id: string): ModelSpec | undefined {
  return ALL_MODELS.find(m => m.id === id)
}

export function getModelsByCategory(category: ModelSpec["category"]): ModelSpec[] {
  return ALL_MODELS.filter(m => m.category === category)
}

// 分类标签
export const MODEL_CATEGORIES = [
  { id: "llm", label: "LLM 语言模型", color: "bg-blue-500" },
  { id: "image", label: "文生图/图像处理", color: "bg-emerald-500" },
  { id: "video", label: "视频生成", color: "bg-purple-500" },
  { id: "audio", label: "音频生成", color: "bg-amber-500" },
] as const
