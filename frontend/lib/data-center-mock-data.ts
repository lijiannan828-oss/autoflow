import type {
  CoreKPIs,
  TrendDataPoint,
  PhaseBreakdown,
  EpisodeDataRow,
  ModelConsumptionData,
} from "./data-center-types"

// AI Insight text
export const aiInsightText = "本周平均单分钟成本为 177.3元（达标）。但昨日《万斯家族》第14集因 Kling 3.0 API 生成复杂动作失败率高，导致「视觉生成」环节成本超标 15%。建议优化该集的动态提示词。人类审核平均耗时已降至 18分钟/集。AI裁判本周自动拦截废片 127 次，节省人工复审时间约 42 小时。"

// Core KPIs
export const coreKPIs: CoreKPIs = {
  scale: {
    totalDramas: 12,
    totalEpisodes: 156,
    totalMinutes: 4680,
    deltaPercent: 23.5,
  },
  efficiency: {
    avgMinutesPerOutput: 25,
    deltaPercent: -8.2,
    phaseBreakdown: [
      { phase: "剧本与资产", percentage: 12, minutes: 3 },
      { phase: "分镜与提示词", percentage: 18, minutes: 4.5 },
      { phase: "视觉生成", percentage: 42, minutes: 10.5 },
      { phase: "视听整合", percentage: 18, minutes: 4.5 },
      { phase: "最终成片", percentage: 10, minutes: 2.5 },
    ],
  },
  cost: {
    avgCostPerMinute: 160.8,
    deltaPercent: -5.3,
    budgetLine: 200,
    healthPercent: 80.4,
    phaseBreakdown: [
      { phase: "剧本与资产", percentage: 12, cost: 19.3 },
      { phase: "分镜与提示词", percentage: 16, cost: 25.7 },
      { phase: "视觉生成", percentage: 45, cost: 72.4 },
      { phase: "视听整合", percentage: 18, cost: 28.9 },
      { phase: "最终成片", percentage: 9, cost: 14.5 },
    ],
  },
  quality: {
    avgHumanReviewMinutes: 16,
    totalHumanEdits: 342,
    aiJudgeRejectCount: 127,
    deltaPercent: -12.5,
  },
}

// Trend data for the past 7 days
export const trendData: TrendDataPoint[] = [
  { date: "03/01", costPerMinute: 165, outputMinutes: 580 },
  { date: "03/02", costPerMinute: 172, outputMinutes: 620 },
  { date: "03/03", costPerMinute: 158, outputMinutes: 710 },
  { date: "03/04", costPerMinute: 185, outputMinutes: 650 },
  { date: "03/05", costPerMinute: 192, outputMinutes: 540 },
  { date: "03/06", costPerMinute: 177, outputMinutes: 680 },
  { date: "03/07", costPerMinute: 168, outputMinutes: 720 },
]

// Phase breakdown
export const phaseBreakdown: PhaseBreakdown[] = [
  { phase: "剧本与资产", cost: 18.5, duration: 3, percentage: 12 },
  { phase: "分镜与提示词", cost: 25.2, duration: 4.5, percentage: 16 },
  { phase: "视觉生成", cost: 72.8, duration: 10.5, percentage: 45 },
  { phase: "视听整合", cost: 28.6, duration: 4.5, percentage: 18 },
  { phase: "最终成片", cost: 15.7, duration: 2.5, percentage: 9 },
]

// Helper function to generate phase details
function generatePhaseDetails(totalDuration: number, totalCost: number, totalEdits: number): EpisodeDataRow["phaseDetails"] {
  return [
    { phase: "剧本与资产", duration: Math.round(totalDuration * 0.12), cost: Math.round(totalCost * 0.12), revisions: Math.round(totalEdits * 0.1) },
    { phase: "分镜与提示词", duration: Math.round(totalDuration * 0.18), cost: Math.round(totalCost * 0.16), revisions: Math.round(totalEdits * 0.15) },
    { phase: "视觉生成", duration: Math.round(totalDuration * 0.42), cost: Math.round(totalCost * 0.45), revisions: Math.round(totalEdits * 0.45) },
    { phase: "视听整合", duration: Math.round(totalDuration * 0.18), cost: Math.round(totalCost * 0.18), revisions: Math.round(totalEdits * 0.2) },
    { phase: "最终成片", duration: Math.round(totalDuration * 0.10), cost: Math.round(totalCost * 0.09), revisions: Math.round(totalEdits * 0.1) },
  ]
}

// Episode data
export const episodeData: EpisodeDataRow[] = [
  { id: "ep-1", dramaTitle: "万斯家族的回响", episodeNumber: 14, totalDuration: 32, totalCost: 245, humanEdits: 8, status: "completed", phaseDetails: generatePhaseDetails(32, 245, 8) },
  { id: "ep-2", dramaTitle: "万斯家族的回响", episodeNumber: 15, totalDuration: 28, totalCost: 198, humanEdits: 5, status: "completed", phaseDetails: generatePhaseDetails(28, 198, 5) },
  { id: "ep-3", dramaTitle: "深渊之上", episodeNumber: 8, totalDuration: 35, totalCost: 212, humanEdits: 6, status: "completed", phaseDetails: generatePhaseDetails(35, 212, 6) },
  { id: "ep-4", dramaTitle: "深渊之上", episodeNumber: 9, totalDuration: 30, totalCost: 178, humanEdits: 4, status: "in-progress", phaseDetails: generatePhaseDetails(30, 178, 4) },
  { id: "ep-5", dramaTitle: "逆流时光", episodeNumber: 3, totalDuration: 26, totalCost: 165, humanEdits: 3, status: "completed", phaseDetails: generatePhaseDetails(26, 165, 3) },
  { id: "ep-6", dramaTitle: "逆流时光", episodeNumber: 4, totalDuration: 29, totalCost: 185, humanEdits: 5, status: "in-progress", phaseDetails: generatePhaseDetails(29, 185, 5) },
  { id: "ep-7", dramaTitle: "星际迷途", episodeNumber: 1, totalDuration: 38, totalCost: 268, humanEdits: 9, status: "completed", phaseDetails: generatePhaseDetails(38, 268, 9) },
  { id: "ep-8", dramaTitle: "星际迷途", episodeNumber: 2, totalDuration: 34, totalCost: 225, humanEdits: 7, status: "failed", phaseDetails: generatePhaseDetails(34, 225, 7) },
  { id: "ep-9", dramaTitle: "暗夜玫瑰", episodeNumber: 5, totalDuration: 27, totalCost: 172, humanEdits: 4, status: "completed", phaseDetails: generatePhaseDetails(27, 172, 4) },
  { id: "ep-10", dramaTitle: "暗夜玫瑰", episodeNumber: 6, totalDuration: 31, totalCost: 195, humanEdits: 6, status: "completed", phaseDetails: generatePhaseDetails(31, 195, 6) },
]

// Model consumption data
export const modelConsumption: ModelConsumptionData = {
  llm: [
    { model: "GPT-5.2", tokenCount: 12500000, costUSD: 187.5, costCNY: 1350 },
    { model: "Gemini 3.1", tokenCount: 8200000, costUSD: 82, costCNY: 590 },
    { model: "Claude 4.6", tokenCount: 5600000, costUSD: 168, costCNY: 1210 },
    { model: "DeepSeek V3", tokenCount: 15800000, costUSD: 31.6, costCNY: 228 },
  ],
  image: [
    { model: "Z-Image-Turbo", generations: 45000, costCNY: 2250 },
    { model: "Flux.2", generations: 28000, costCNY: 1680 },
    { model: "SDXL-Lightning", generations: 62000, costCNY: 1240 },
  ],
  video: [
    { model: "Wan 2.2", type: "self-hosted", calls: 3200, duration: 48000, costCNY: 4800 },
    { model: "Hunyuan 1.5", type: "self-hosted", calls: 2100, duration: 31500, costCNY: 3150 },
    { model: "Kling 3.0", type: "api", calls: 1850, duration: 27750, costCNY: 8325 },
    { model: "Wan 2.6", type: "api", calls: 980, duration: 14700, costCNY: 4410 },
  ],
  audio: [
    { model: "ElevenLabs", characters: 2500000, costCNY: 1875 },
    { model: "Suno", generations: 450, costCNY: 675 },
    { model: "Udio", generations: 280, costCNY: 420 },
  ],
}

// Drama list for filter
export const dramaList = [
  { id: "all", name: "全部剧集" },
  { id: "drama-1", name: "万斯家族的回响" },
  { id: "drama-2", name: "深渊之上" },
  { id: "drama-3", name: "逆流时光" },
  { id: "drama-4", name: "星际迷途" },
  { id: "drama-5", name: "暗夜玫瑰" },
]
