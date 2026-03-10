/**
 * 丰富的 Mock 数据 - 基于「万斯家的回响」第3集的真实场景
 * 展示古装宫廷题材的完整生产链路
 */

export type NodeStatus = "completed" | "running" | "pending" | "failed" | "skipped" | "gate_waiting" | "gate_approved" | "gate_rejected"
export type DecisionLevel = "planning" | "execution" | "review" | "gate" | "freeze" | "compose"

export interface StageInfo {
  stage: number
  label: string
  nodes: string[]
}

export interface TraceNode {
  node_id: string
  node_name: string
  stage: number
  category: string
  agent_name: string
  status: NodeStatus
  decision_level: DecisionLevel
  duration_seconds: number | null
  cost_cny: number
  quality_score: number | null
  model: string | null
  is_gate: boolean
  version_no: number
  // Gate 专属
  gate_reviewer_name?: string
  gate_decision?: "approved" | "rejected"
  gate_feedback?: string
  gate_duration_seconds?: number
  // 执行节点专属
  batch_stats?: {
    total_shots: number
    completed: number
    running: number
    failed: number
    retried: number
    one_pass_rate: number
  }
}

export interface TraceEdge {
  from: string
  to: string
  type: "normal" | "parallel" | "return"
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Stage 定义
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const STAGES: StageInfo[] = [
  { stage: 1, label: "Script 脚本", nodes: ["N01", "N02", "N03", "N04", "N05"] },
  { stage: 2, label: "Art 美术", nodes: ["N06", "N07", "N07b", "N08", "N09"] },
  { stage: 3, label: "Keyframe 关键帧", nodes: ["N10", "N11", "N12", "N13"] },
  { stage: 4, label: "Video 视频", nodes: ["N14", "N15", "N16", "N16b", "N17", "N18", "N19"] },
  { stage: 5, label: "AV 视听", nodes: ["N20", "N21", "N22"] },
  { stage: 6, label: "Final 成片", nodes: ["N23", "N24", "N25", "N26"] },
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 26 个节点的完整 Mock 数据
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MOCK_NODES: TraceNode[] = [
  // ── Stage 1: Script ──
  {
    node_id: "N01",
    node_name: "剧本结构化解析",
    stage: 1,
    category: "llm",
    agent_name: "script_analyst",
    status: "completed",
    decision_level: "planning",
    duration_seconds: 8.2,
    cost_cny: 0.012,
    quality_score: null,
    model: "Gemini 3.1",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N02",
    node_name: "拆集拆镜",
    stage: 1,
    category: "llm",
    agent_name: "shot_designer",
    status: "completed",
    decision_level: "planning",
    duration_seconds: 15.6,
    cost_cny: 0.028,
    quality_score: null,
    model: "Gemini 3.1",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N03",
    node_name: "分镜质检",
    stage: 1,
    category: "qc",
    agent_name: "quality_inspector",
    status: "completed",
    decision_level: "review",
    duration_seconds: 12.3,
    cost_cny: 0.045,
    quality_score: 8.7,
    model: "GPT5.4+Gemini3.1+Opus4.6",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N04",
    node_name: "分镜定稿",
    stage: 1,
    category: "freeze",
    agent_name: "shot_designer",
    status: "completed",
    decision_level: "freeze",
    duration_seconds: 2.1,
    cost_cny: 0.003,
    quality_score: null,
    model: "Gemini 3.1",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N05",
    node_name: "镜头分级",
    stage: 1,
    category: "llm",
    agent_name: "shot_designer",
    status: "completed",
    decision_level: "planning",
    duration_seconds: 6.8,
    cost_cny: 0.015,
    quality_score: null,
    model: "Gemini 3.1",
    is_gate: false,
    version_no: 1,
  },
  
  // ── Stage 2: Art ──
  {
    node_id: "N06",
    node_name: "视觉元素策划",
    stage: 2,
    category: "llm",
    agent_name: "visual_director",
    status: "completed",
    decision_level: "planning",
    duration_seconds: 18.5,
    cost_cny: 0.035,
    quality_score: null,
    model: "Gemini 3.1",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N07",
    node_name: "美术资产图生成",
    stage: 2,
    category: "comfyui",
    agent_name: "visual_director",
    status: "completed",
    decision_level: "execution",
    duration_seconds: 245,
    cost_cny: 2.8,
    quality_score: 8.5,
    model: "FLUX.2 Dev",
    is_gate: false,
    version_no: 1,
    batch_stats: {
      total_shots: 12,
      completed: 12,
      running: 0,
      failed: 0,
      retried: 1,
      one_pass_rate: 0.917,
    },
  },
  {
    node_id: "N07b",
    node_name: "核心角色音色生成",
    stage: 2,
    category: "audio",
    agent_name: "audio_director",
    status: "completed",
    decision_level: "execution",
    duration_seconds: 45,
    cost_cny: 0.15,
    quality_score: 9.0,
    model: "CosyVoice",
    is_gate: false,
    version_no: 1,
    batch_stats: {
      total_shots: 4,
      completed: 4,
      running: 0,
      failed: 0,
      retried: 0,
      one_pass_rate: 1.0,
    },
  },
  {
    node_id: "N08",
    node_name: "Gate1 美术资产审核",
    stage: 2,
    category: "gate",
    agent_name: "review_dispatcher",
    status: "gate_approved",
    decision_level: "gate",
    duration_seconds: 480,
    cost_cny: 0,
    quality_score: null,
    model: null,
    is_gate: true,
    version_no: 1,
    gate_reviewer_name: "李四（剪辑中台）",
    gate_decision: "approved",
    gate_feedback: "女主角确认，太后发型需微调。音色样本太后选用 #2。",
    gate_duration_seconds: 480,
  },
  {
    node_id: "N09",
    node_name: "美术资产定稿",
    stage: 2,
    category: "freeze",
    agent_name: "visual_director",
    status: "completed",
    decision_level: "freeze",
    duration_seconds: 120,
    cost_cny: 0.8,
    quality_score: null,
    model: "FireRed-1.1",
    is_gate: false,
    version_no: 1,
  },
  
  // ── Stage 3: Keyframe ──
  {
    node_id: "N10",
    node_name: "关键帧生成",
    stage: 3,
    category: "comfyui",
    agent_name: "visual_director",
    status: "completed",
    decision_level: "execution",
    duration_seconds: 380,
    cost_cny: 4.2,
    quality_score: 8.6,
    model: "FLUX.2 Dev + FireRed",
    is_gate: false,
    version_no: 1,
    batch_stats: {
      total_shots: 32,
      completed: 32,
      running: 0,
      failed: 0,
      retried: 3,
      one_pass_rate: 0.906,
    },
  },
  {
    node_id: "N11",
    node_name: "关键帧质检",
    stage: 3,
    category: "qc",
    agent_name: "quality_inspector",
    status: "completed",
    decision_level: "review",
    duration_seconds: 95,
    cost_cny: 0.35,
    quality_score: 8.4,
    model: "GPT5.4+Gemini3.1+Opus4.6",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N12",
    node_name: "跨镜连续性检查",
    stage: 3,
    category: "llm",
    agent_name: "quality_inspector",
    status: "completed",
    decision_level: "review",
    duration_seconds: 25,
    cost_cny: 0.08,
    quality_score: 8.2,
    model: "Gemini 3.1",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N13",
    node_name: "关键帧定稿",
    stage: 3,
    category: "freeze",
    agent_name: "visual_director",
    status: "completed",
    decision_level: "freeze",
    duration_seconds: 45,
    cost_cny: 0.25,
    quality_score: null,
    model: "FireRed-1.1 Edit",
    is_gate: false,
    version_no: 1,
  },
  
  // ── Stage 4: Video ──
  {
    node_id: "N14",
    node_name: "视频素材生成",
    stage: 4,
    category: "comfyui",
    agent_name: "visual_director",
    status: "running",
    decision_level: "execution",
    duration_seconds: 402,
    cost_cny: 8.2,
    quality_score: 8.6,
    model: "LTX-2.3",
    is_gate: false,
    version_no: 1,
    batch_stats: {
      total_shots: 32,
      completed: 30,
      running: 2,
      failed: 0,
      retried: 3,
      one_pass_rate: 0.906,
    },
  },
  {
    node_id: "N15",
    node_name: "视频质检",
    stage: 4,
    category: "qc",
    agent_name: "quality_inspector",
    status: "pending",
    decision_level: "review",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: "GPT5.4+Gemini3.1+Opus4.6",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N16",
    node_name: "节奏连续性分析",
    stage: 4,
    category: "llm",
    agent_name: "shot_designer",
    status: "pending",
    decision_level: "review",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: "Gemini 3.1",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N16b",
    node_name: "影调与节奏调整",
    stage: 4,
    category: "ffmpeg",
    agent_name: "compositor",
    status: "pending",
    decision_level: "compose",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: "FFmpeg + Gemini 3.1",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N17",
    node_name: "视频定稿",
    stage: 4,
    category: "freeze",
    agent_name: "visual_director",
    status: "pending",
    decision_level: "freeze",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: "FFmpeg + RealESRGAN",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N18",
    node_name: "Gate2 视觉素材审核",
    stage: 4,
    category: "gate",
    agent_name: "review_dispatcher",
    status: "pending",
    decision_level: "gate",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: null,
    is_gate: true,
    version_no: 1,
  },
  {
    node_id: "N19",
    node_name: "视觉素材定稿",
    stage: 4,
    category: "freeze",
    agent_name: "visual_director",
    status: "pending",
    decision_level: "freeze",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: null,
    is_gate: false,
    version_no: 1,
  },
  
  // ── Stage 5: AV ──
  {
    node_id: "N20",
    node_name: "视听整合",
    stage: 5,
    category: "audio",
    agent_name: "audio_director",
    status: "pending",
    decision_level: "execution",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: "CosyVoice + ACE-Step 1.5",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N21",
    node_name: "Gate3 视听整合审核",
    stage: 5,
    category: "gate",
    agent_name: "review_dispatcher",
    status: "pending",
    decision_level: "gate",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: null,
    is_gate: true,
    version_no: 1,
  },
  {
    node_id: "N22",
    node_name: "视听定稿",
    stage: 5,
    category: "freeze",
    agent_name: "audio_director",
    status: "pending",
    decision_level: "freeze",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: null,
    is_gate: false,
    version_no: 1,
  },
  
  // ── Stage 6: Final ──
  {
    node_id: "N23",
    node_name: "成片整合",
    stage: 6,
    category: "ffmpeg",
    agent_name: "compositor",
    status: "pending",
    decision_level: "compose",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: "FFmpeg",
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N24",
    node_name: "Gate4 成片终审",
    stage: 6,
    category: "gate",
    agent_name: "review_dispatcher",
    status: "pending",
    decision_level: "gate",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: null,
    is_gate: true,
    version_no: 1,
  },
  {
    node_id: "N25",
    node_name: "成片定稿",
    stage: 6,
    category: "freeze",
    agent_name: "compositor",
    status: "pending",
    decision_level: "freeze",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: null,
    is_gate: false,
    version_no: 1,
  },
  {
    node_id: "N26",
    node_name: "分发推送",
    stage: 6,
    category: "logic",
    agent_name: "compositor",
    status: "pending",
    decision_level: "compose",
    duration_seconds: null,
    cost_cny: 0,
    quality_score: null,
    model: "Platform API",
    is_gate: false,
    version_no: 1,
  },
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 边的定义
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MOCK_EDGES: TraceEdge[] = [
  // Stage 1
  { from: "N01", to: "N02", type: "normal" },
  { from: "N02", to: "N03", type: "normal" },
  { from: "N03", to: "N04", type: "normal" },
  { from: "N04", to: "N05", type: "normal" },
  // Stage 1 → 2
  { from: "N05", to: "N06", type: "normal" },
  // Stage 2
  { from: "N06", to: "N07", type: "normal" },
  { from: "N06", to: "N07b", type: "parallel" },
  { from: "N07", to: "N08", type: "normal" },
  { from: "N07b", to: "N08", type: "normal" },
  { from: "N08", to: "N09", type: "normal" },
  // Stage 2 → 3
  { from: "N09", to: "N10", type: "normal" },
  // Stage 3
  { from: "N10", to: "N11", type: "normal" },
  { from: "N11", to: "N12", type: "normal" },
  { from: "N12", to: "N13", type: "normal" },
  // Stage 3 → 4
  { from: "N13", to: "N14", type: "normal" },
  // Stage 4
  { from: "N14", to: "N15", type: "normal" },
  { from: "N15", to: "N16", type: "normal" },
  { from: "N16", to: "N16b", type: "normal" },
  { from: "N16b", to: "N17", type: "normal" },
  { from: "N17", to: "N18", type: "normal" },
  { from: "N18", to: "N19", type: "normal" },
  // Stage 4 → 5
  { from: "N19", to: "N20", type: "normal" },
  // Stage 5
  { from: "N20", to: "N21", type: "normal" },
  { from: "N21", to: "N22", type: "normal" },
  // Stage 5 → 6
  { from: "N22", to: "N23", type: "normal" },
  // Stage 6
  { from: "N23", to: "N24", type: "normal" },
  { from: "N24", to: "N25", type: "normal" },
  { from: "N25", to: "N26", type: "normal" },
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 策划节点详情 Mock - N02 拆集拆镜
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MOCK_N02_PLANNING = {
  node_id: "N02",
  agent_name: "shot_designer",
  // ① 全集需求理解
  context: {
    genre: "古装宫廷",
    scene_count: 5,
    character_count: 4,
    shot_count: 32,
    emotion_arc: "平静 → 紧张 → 高潮(#12怒摔茶杯) → 转折 → 余韵",
    project_constraints: ["ReelShort竖屏", "≤60秒", "甜宠风格偏好", "YouTube Shorts 2026Q2"],
  },
  // ② 场景级RAG检索
  rag_by_scene: [
    { scene_type: "宫殿大厅-夜景", results_count: 3, top_score: 9.3, recommended_strategy: "palace_night_v3", has_gap: false },
    { scene_type: "后花园-日景", results_count: 3, top_score: 8.7, recommended_strategy: "garden_daylight_v2", has_gap: false },
    { scene_type: "密室", results_count: 0, top_score: 0, recommended_strategy: "indoor_dark_v1", has_gap: true },
    { scene_type: "寝宫", results_count: 2, top_score: 8.5, recommended_strategy: "bedroom_warm_v2", has_gap: false },
    { scene_type: "回廊", results_count: 1, top_score: 7.8, recommended_strategy: "corridor_v1", has_gap: false },
  ],
  // ③ 策略表
  strategy_table: [
    { scene_type: "宫殿大厅夜景", shot_count: 12, difficulty_distribution: "S0×6, S1×4, S2×2", budget_cny: 4.2 },
    { scene_type: "后花园日景", shot_count: 8, difficulty_distribution: "S0×5, S1×3", budget_cny: 2.1 },
    { scene_type: "密室", shot_count: 4, difficulty_distribution: "S1×3, S2×1", budget_cny: 1.8 },
    { scene_type: "寝宫", shot_count: 5, difficulty_distribution: "S0×3, S1×2", budget_cny: 1.2 },
    { scene_type: "回廊", shot_count: 3, difficulty_distribution: "S0×2, S1×1", budget_cny: 0.7 },
  ],
  // ④ 生成配方（前 8 个示例）
  shot_recipes: [
    { shot_number: 1, scene: "宫殿大厅夜景", shot_type: "全景", difficulty: "S0", candidate_count: 2, budget_cny: 0.2, notes: "开场建立镜" },
    { shot_number: 5, scene: "宫殿大厅夜景", shot_type: "中景", difficulty: "S0", candidate_count: 2, budget_cny: 0.2, notes: "" },
    { shot_number: 12, scene: "宫殿大厅夜景", shot_type: "特写", difficulty: "S2", candidate_count: 4, budget_cny: 0.6, notes: "高潮：太后怒摔茶杯" },
    { shot_number: 15, scene: "后花园日景", shot_type: "中景", difficulty: "S1", candidate_count: 3, budget_cny: 0.3, notes: "" },
    { shot_number: 22, scene: "密室", shot_type: "中景", difficulty: "S1", candidate_count: 3, budget_cny: 0.35, notes: "新场景，需观察" },
    { shot_number: 28, scene: "密室", shot_type: "特写", difficulty: "S2", candidate_count: 4, budget_cny: 0.55, notes: "克莱尔潜入" },
    { shot_number: 30, scene: "寝宫", shot_type: "近景", difficulty: "S1", candidate_count: 3, budget_cny: 0.3, notes: "" },
    { shot_number: 32, scene: "回廊", shot_type: "全景", difficulty: "S0", candidate_count: 2, budget_cny: 0.2, notes: "结尾余韵" },
  ],
  total_budget_cny: 10.0,
  // ⑤ 自检
  self_check: {
    checks: [
      { item: "景别分布", passed: true, detail: "全景15% / 中景40% / 近景30% / 特写15% — 合理" },
      { item: "总预算", passed: true, detail: "¥10.0 < 红线 ¥12" },
      { item: "时长估算", passed: true, detail: "32镜头 × 2秒 = 64秒 ≈ 目标60秒" },
      { item: "S2占比", passed: true, detail: "12.5% (4/32) — 在合理范围" },
    ],
    warnings: ["密室场景无 RAG 案例，标记为观察对象"],
  },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 执行节点详情 Mock - N14 视频生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MOCK_N14_EXECUTION = {
  node_id: "N14",
  agent_name: "visual_director",
  summary: {
    total_shots: 32,
    completed: 30,
    running: 2,
    failed: 0,
    retried: 3,
    one_pass_rate: 0.906,
    total_duration_seconds: 402,
    total_cost_cny: 8.2,
    avg_quality_score: 8.6,
    budget_cny: 9.0,
    budget_usage: 0.91,
  },
  shot_results: [
    { shot_number: 1, scene: "宫殿大厅夜景", shot_type: "全景", status: "completed", quality_score: 8.5, duration_seconds: 8.2, cost_cny: 0.18, candidate_count: 2, has_adjustments: false, retry_count: 0 },
    { shot_number: 3, scene: "宫殿大厅夜景", shot_type: "中景", status: "completed", quality_score: 9.1, duration_seconds: 8.1, cost_cny: 0.18, candidate_count: 2, has_adjustments: false, retry_count: 0 },
    { shot_number: 5, scene: "宫殿大厅夜景", shot_type: "中景", status: "completed", quality_score: 9.5, duration_seconds: 8.5, cost_cny: 0.18, candidate_count: 2, has_adjustments: false, retry_count: 0 },
    { shot_number: 12, scene: "宫殿大厅夜景", shot_type: "特写", status: "completed", quality_score: 8.9, duration_seconds: 15, cost_cny: 0.45, candidate_count: 4, has_adjustments: true, retry_count: 0, 
      adjustments: [
        { param: "ip_adapter_scale", from_value: "0.78", to_value: "0.80", reason: "记忆: 太后特写最佳值0.80" },
        { param: "seed", from_value: "base", to_value: "base+12", reason: "按镜头序号偏移" },
      ],
    },
    { shot_number: 22, scene: "密室", shot_type: "中景", status: "completed", quality_score: 7.3, duration_seconds: 18, cost_cny: 0.42, candidate_count: 3, has_adjustments: true, retry_count: 1,
      adjustments: [
        { param: "cfg", from_value: "7.5", to_value: "8.5", reason: "光照不足，提升 CFG" },
      ],
      retries: [
        { attempt: 1, score: 5.8, failure_reason: "光照3.2 < 阈值5.0", adjustment_made: "cfg 7.5→8.5" },
      ],
    },
    { shot_number: 28, scene: "密室", shot_type: "特写", status: "completed", quality_score: 7.1, duration_seconds: 22, cost_cny: 0.52, candidate_count: 4, has_adjustments: true, retry_count: 2,
      adjustments: [
        { param: "cfg", from_value: "7.5", to_value: "8.5", reason: "光照不足" },
        { param: "steps", from_value: "20", to_value: "30", reason: "增强细节" },
      ],
      retries: [
        { attempt: 1, score: 5.8, failure_reason: "光照3.2 < 阈值5.0", adjustment_made: "cfg 7.5→8.5" },
        { attempt: 2, score: 6.5, failure_reason: "光照5.8 勉强", adjustment_made: "steps 20→30" },
      ],
      memory_written: "密室场景 indoor_dark_v1 效果差",
      evolution_reported: "暗室场景 prompt 需优化",
    },
    { shot_number: 31, scene: "寝宫", shot_type: "近景", status: "running", quality_score: null, duration_seconds: null, cost_cny: 0, candidate_count: 3, has_adjustments: false, retry_count: 0 },
    { shot_number: 32, scene: "回廊", shot_type: "全景", status: "running", quality_score: null, duration_seconds: null, cost_cny: 0, candidate_count: 2, has_adjustments: false, retry_count: 0 },
  ],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 质检节点详情 Mock - N11 关键帧质检
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MOCK_N11_QC = {
  node_id: "N11",
  agent_name: "quality_inspector",
  summary: {
    threshold: 7.5,
    single_dim_floor: 5.0,
    voting_mode: "去极值取平均",
    total_shots: 32,
    passed: 29,
    rejected: 3,
    pass_rate: 0.906,
    avg_score: 8.4,
    min_score: 5.8,
    max_score: 9.5,
  },
  dimensions: [
    { name: "character_consistency", weight: 0.20, label: "角色一致性", avg_score: 8.6 },
    { name: "body_integrity", weight: 0.15, label: "人体完整性", avg_score: 8.8 },
    { name: "tone_consistency", weight: 0.15, label: "色调一致性", avg_score: 8.2 },
    { name: "script_fidelity", weight: 0.15, label: "剧本还原度", avg_score: 8.5 },
    { name: "action_accuracy", weight: 0.10, label: "动作准确性", avg_score: 8.3 },
    { name: "expression_match", weight: 0.10, label: "表情匹配度", avg_score: 8.1 },
    { name: "composition", weight: 0.10, label: "构图", avg_score: 8.7 },
    { name: "lighting_consistency", weight: 0.05, label: "光照一致性", avg_score: 7.5 },
  ],
  rejected_items: [
    { shot_number: 22, score: 5.8, failed_dimension: "lighting_consistency", failed_score: 3.2, action: "回退 N10 重试" },
    { shot_number: 28, score: 6.2, failed_dimension: "lighting_consistency", failed_score: 4.1, action: "回退 N10 重试" },
    { shot_number: 29, score: 6.8, failed_dimension: "physics_plausibility", failed_score: 4.8, action: "回退 N10 重试" },
  ],
  model_votes: [
    { model: "GPT 5.4", avg_score: 8.5 },
    { model: "Gemini 3.1", avg_score: 8.3 },
    { model: "Opus 4.6", avg_score: 8.4 },
  ],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 复盘节点详情 Mock - N12 连续性检查
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MOCK_N12_REVIEW = {
  node_id: "N12",
  agent_name: "quality_inspector",
  overall_score: 8.2,
  issues: [
    { severity: "warning", description: "镜头 #8→#9 色温跳变（暖→冷，同场景不应有）", affected_shots: [8, 9], suggestion: "N13 定稿时对 #9 做 FireRed 色温修正", memory_written: false, evolution_reported: false },
    { severity: "warning", description: "男主远景 FaceID 偏低 (#15, #22, #27 均值 0.79)", affected_shots: [15, 22, 27], suggestion: "记忆：男主远景需增加 ip_adapter", memory_written: true, evolution_reported: false },
    { severity: "critical", description: "密室场景 (#28-#31) 整体偏暗", affected_shots: [28, 29, 30, 31], suggestion: "上报：indoor_dark_v1 适配器效果待优化", memory_written: true, evolution_reported: true },
  ],
  highlights: [
    { description: "高潮段 (#10-#14) 连续性评分 9.5", affected_shots: [10, 11, 12, 13, 14], score: 9.5 },
    { description: "花园日景 (#18-#22) 色调方差 0.02（极好）", affected_shots: [18, 19, 20, 21, 22], score: 9.2 },
  ],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 全局概要
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const MOCK_EPISODE_SUMMARY = {
  episode_id: "ep_003",
  project_id: "proj_wans",
  project_name: "万斯家的回响",
  episode_number: 3,
  versions: [
    { version_no: 1, status: "running" as const, is_current: true, created_at: "2026-03-10T10:05:00Z" },
  ],
  summary: {
    total_duration_seconds: 1892,
    total_cost_cny: 16.85,
    avg_quality_score: 8.5,
    completed_nodes: 14,
    total_nodes: 26,
    return_ticket_count: 0,
  },
}
