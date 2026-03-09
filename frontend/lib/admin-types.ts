// Admin Dashboard Types

// 22 pipeline nodes
export const PIPELINE_NODES = [
  { id: 1, name: "剧本关键要点提炼", phase: 1, isHuman: false },
  { id: 2, name: "美术资产人类检查", phase: 1, isHuman: true },
  { id: 3, name: "美术资产定稿", phase: 1, isHuman: false },
  { id: 4, name: "分镜脚本", phase: 2, isHuman: false },
  { id: 5, name: "分镜质量检查", phase: 2, isHuman: false },
  { id: 6, name: "分镜定稿", phase: 2, isHuman: false },
  { id: 7, name: "镜头分级", phase: 2, isHuman: false },
  { id: 8, name: "关键帧和视频提示词", phase: 3, isHuman: false },
  { id: 9, name: "关键帧生成", phase: 3, isHuman: false },
  { id: 10, name: "关键帧质检", phase: 3, isHuman: false },
  { id: 11, name: "剧情连续性检查", phase: 3, isHuman: false },
  { id: 12, name: "关键帧定稿", phase: 3, isHuman: false },
  { id: 13, name: "视频素材生成", phase: 3, isHuman: false },
  { id: 14, name: "视频素材质检", phase: 3, isHuman: false },
  { id: 15, name: "剧情连续性检查", phase: 3, isHuman: false },
  { id: 16, name: "视频素材定稿", phase: 3, isHuman: false },
  { id: 17, name: "视觉素材人类检查", phase: 3, isHuman: true },
  { id: 18, name: "视觉素材定稿", phase: 3, isHuman: false },
  { id: 19, name: "视听整合", phase: 4, isHuman: false },
  { id: 20, name: "视听整合人类检查", phase: 4, isHuman: true },
  { id: 21, name: "视听整合定稿", phase: 4, isHuman: false },
  { id: 22, name: "成片整合", phase: 5, isHuman: false },
  { id: 23, name: "成片人类检查", phase: 5, isHuman: true },
  { id: 24, name: "成片定稿", phase: 5, isHuman: false },
] as const

// 5 major phases
export const PHASES = [
  { id: 1, name: "剧本与资产", nodeRange: [1, 3] },
  { id: 2, name: "分镜", nodeRange: [4, 7] },
  { id: 3, name: "视觉生成", nodeRange: [8, 18] },
  { id: 4, name: "视听整合", nodeRange: [19, 21] },
  { id: 5, name: "成片", nodeRange: [22, 24] },
] as const

// Node execution status
export type NodeStatus = "pending" | "running" | "completed" | "failed" | "skipped"

// Pipeline node state
export interface PipelineNodeState {
  nodeId: number
  status: NodeStatus
  startTime?: string
  endTime?: string
  duration?: number // seconds
  assignee?: string // for human nodes
  inputSummary?: string
  outputSummary?: string
  scores?: { model: string; score: number }[]
  failReason?: string
}

// Episode production task
export interface EpisodeTask {
  id: string
  dramaTitle: string
  episodeNumber: number
  coverColor: string
  currentNodeId: number
  nodeStates: PipelineNodeState[]
  // Telemetry
  totalDuration: number // seconds
  computeCost: number // RMB
  humanTime: number // seconds
  // Status flags
  isWaitingHuman: boolean
  isRunning: boolean
  hasFailed: boolean
  isCostOverrun: boolean
}

// Global metrics
export interface GlobalMetrics {
  totalProductions: number
  inQC: number
  pendingQC: number
  pendingAssets: number
  avgProductionTime: number // minutes per minute of final video
  avgComputeCost: number // RMB per minute
  avgHumanTime: number // minutes per minute
  // Trends (last 7 days percentage change)
  productionTimeTrend: number
  computeCostTrend: number
  humanTimeTrend: number
}

// Filter types
export type FilterType = "all" | "waiting-human" | "running" | "failed" | "cost-overrun"

// Helper functions
export function getPhaseProgress(task: EpisodeTask, phaseId: number): { completed: number; total: number } {
  const phase = PHASES.find(p => p.id === phaseId)
  if (!phase) return { completed: 0, total: 0 }
  
  const [start, end] = phase.nodeRange
  const total = end - start + 1
  let completed = 0
  
  for (let i = start; i <= end; i++) {
    const nodeState = task.nodeStates.find(ns => ns.nodeId === i)
    if (nodeState?.status === "completed") completed++
  }
  
  return { completed, total }
}

export function getCurrentNodeInfo(task: EpisodeTask) {
  const node = PIPELINE_NODES.find(n => n.id === task.currentNodeId)
  const remaining = PIPELINE_NODES.length - task.currentNodeId
  return {
    node,
    remaining,
    display: node ? `${task.currentNodeId}/${PIPELINE_NODES.length} - ${node.name}` : "未知"
  }
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

export function formatCost(rmb: number): string {
  return `¥${rmb.toFixed(1)}`
}
