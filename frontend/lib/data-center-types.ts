// Data Center Types

// Time range filter options
export type TimeRange = "7d" | "14d" | "30d" | "90d"

// Core KPI metrics
export interface ScaleMetrics {
  totalDramas: number
  totalEpisodes: number
  totalMinutes: number
  deltaPercent: number // vs previous period
}

export interface EfficiencyMetrics {
  avgMinutesPerOutput: number // 单分钟成片平均耗时
  deltaPercent: number
  phaseBreakdown: {
    phase: string
    percentage: number
    minutes: number
  }[]
}

export interface CostMetrics {
  avgCostPerMinute: number // 单分钟成片平均成本
  deltaPercent: number
  budgetLine: number // 200元红线
  healthPercent: number // 距离红线的健康度
  phaseBreakdown: {
    phase: string
    percentage: number
    cost: number
  }[]
}

export interface QualityMetrics {
  avgHumanReviewMinutes: number // 人类质检平均干预耗时
  totalHumanEdits: number // 人工修改总频次
  aiJudgeRejectCount: number // AI裁判自动打回次数
  deltaPercent: number
}

export interface CoreKPIs {
  scale: ScaleMetrics
  efficiency: EfficiencyMetrics
  cost: CostMetrics
  quality: QualityMetrics
}

// Trend data point
export interface TrendDataPoint {
  date: string
  costPerMinute: number
  outputMinutes: number
}

// Phase breakdown for radar/bar chart
export interface PhaseBreakdown {
  phase: string
  cost: number
  duration: number
  percentage: number
}

// Phase detail for episode
export interface PhaseDetail {
  phase: string
  duration: number // minutes
  cost: number // yuan
  revisions: number
}

// Episode data for table
export interface EpisodeDataRow {
  id: string
  dramaTitle: string
  episodeNumber: number
  totalDuration: number // minutes
  totalCost: number // yuan
  humanEdits: number
  status: "completed" | "in-progress" | "failed"
  phaseDetails: PhaseDetail[]
}

// Model consumption data
export interface LLMConsumption {
  model: string
  tokenCount: number
  costUSD: number
  costCNY: number
}

export interface ImageModelConsumption {
  model: string
  generations: number
  costCNY: number
}

export interface VideoModelConsumption {
  model: string
  type: "self-hosted" | "api"
  calls: number
  duration?: number // seconds for API models
  costCNY: number
}

export interface AudioModelConsumption {
  model: string
  characters?: number // for TTS
  generations?: number // for music/sfx
  costCNY: number
}

export interface ModelConsumptionData {
  llm: LLMConsumption[]
  image: ImageModelConsumption[]
  video: VideoModelConsumption[]
  audio: AudioModelConsumption[]
}

// Full data center state
export interface DataCenterState {
  timeRange: TimeRange
  selectedDrama: string | null
  kpis: CoreKPIs
  trendData: TrendDataPoint[]
  phaseBreakdown: PhaseBreakdown[]
  episodeData: EpisodeDataRow[]
  modelConsumption: ModelConsumptionData
  aiInsight: string
}

// Phase names
export const PHASE_NAMES = [
  "剧本与资产",
  "分镜与提示词", 
  "视觉生成",
  "视听整合",
  "最终成片",
] as const

export type PhaseName = typeof PHASE_NAMES[number]
