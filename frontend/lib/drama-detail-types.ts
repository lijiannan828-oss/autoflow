// Drama Detail Page Types

// Pipeline mode
export type PipelineMode = "global" | "episode"

// Node status
export type NodeStatus = "completed" | "running" | "failed" | "pending" | "skipped"

// Episode status in the strip
export type EpisodeStatus = "completed" | "running" | "failed" | "pending" | "queued"

// 5 major phases
export type PhaseId = "script-assets" | "storyboard-prompts" | "visual-generation" | "audiovisual" | "final-composition"

export interface Phase {
  id: PhaseId
  name: string
  nodeRange: string // e.g., "节点 1-3"
  nodes: PipelineNode[]
}

// Pipeline node definition
export interface PipelineNode {
  id: string
  nodeNumber: number
  name: string
  isHumanNode: boolean
  status: NodeStatus
  input: NodeIO
  output: NodeIO
  telemetry: NodeTelemetry
}

// Node Input/Output
export interface NodeIO {
  type: "text" | "json" | "image" | "video" | "audio" | "mixed"
  label: string
  content: string | object | null
  items?: IOItem[]
}

export interface IOItem {
  id: string
  type: "text" | "json" | "image" | "video" | "audio"
  label: string
  preview?: string // thumbnail or preview text
  data?: object
}

// Node telemetry data
export interface NodeTelemetry {
  duration: string // e.g., "1m 24s"
  model?: string // e.g., "Wan 2.6", "GPT-4o"
  cost?: number // in USD or credits
  tokens?: number
  apiCalls?: number
  timestamp?: string
  errorMessage?: string
}

// Multi-model scoring (for quality check nodes)
export interface ModelScore {
  model: string
  score: number
  maxScore: number
  deductions: string[]
}

// Episode in the horizontal strip
export interface EpisodeInstance {
  id: string
  episodeNumber: number
  status: EpisodeStatus
  currentNode?: number
  errorNode?: number
  progress: number // 0-100
}

// Drama detail data
export interface DramaDetailData {
  id: string
  title: string
  totalEpisodes: number
  totalDuration: string
  totalCost: number
  completedEpisodes: number
  episodes: EpisodeInstance[]
  globalPhases: Phase[]
  episodePhases: Phase[]
}

// Global setup nodes (1-3)
export const GLOBAL_NODES = [
  { number: 1, name: "剧本关键要点提炼", isHuman: false },
  { number: 2, name: "美术资产人类检查", isHuman: true },
  { number: 3, name: "美术资产定稿", isHuman: false },
]

// Episode pipeline nodes (4-22)
export const EPISODE_NODES = [
  { number: 4, name: "分镜脚本", isHuman: false },
  { number: 5, name: "分镜质量检查", isHuman: false },
  { number: 6, name: "分镜定稿", isHuman: false },
  { number: 7, name: "镜头分级", isHuman: false },
  { number: 8, name: "关键帧和视频提示词", isHuman: false },
  { number: 9, name: "关键帧生成", isHuman: false },
  { number: 10, name: "关键帧质检", isHuman: false },
  { number: 11, name: "剧情连续性检查", isHuman: false },
  { number: 12, name: "关键帧定稿", isHuman: false },
  { number: 13, name: "视频素材生成", isHuman: false },
  { number: 14, name: "视频素材质检", isHuman: false },
  { number: 15, name: "剧情连续性检查", isHuman: false },
  { number: 16, name: "视频素材定稿", isHuman: false },
  { number: 17, name: "视觉素材人类检查", isHuman: true },
  { number: 18, name: "视觉素材定稿", isHuman: false },
  { number: 19, name: "视听整合", isHuman: false },
  { number: 20, name: "视听整合人类检查", isHuman: true },
  { number: 21, name: "视听整合定稿", isHuman: false },
  { number: 22, name: "成片整合", isHuman: false },
  { number: 23, name: "成片人类检查", isHuman: true },
  { number: 24, name: "成片定稿", isHuman: false },
]

// Phase definitions
export const PHASES: { id: PhaseId; name: string; nodeRange: string; nodeNumbers: number[] }[] = [
  { id: "script-assets", name: "剧本与资产", nodeRange: "节点 1-3", nodeNumbers: [1, 2, 3] },
  { id: "storyboard-prompts", name: "分镜与提示词", nodeRange: "节点 4-8", nodeNumbers: [4, 5, 6, 7, 8] },
  { id: "visual-generation", name: "视觉生成", nodeRange: "节点 9-18", nodeNumbers: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { id: "audiovisual", name: "视听整合", nodeRange: "节点 19-21", nodeNumbers: [19, 20, 21] },
  { id: "final-composition", name: "最终成片", nodeRange: "节点 22-24", nodeNumbers: [22, 23, 24] },
]

// Helper to get status color
export function getNodeStatusColor(status: NodeStatus): string {
  switch (status) {
    case "completed": return "text-emerald-500"
    case "running": return "text-blue-500"
    case "failed": return "text-red-500"
    case "pending": return "text-muted-foreground"
    case "skipped": return "text-muted-foreground/50"
    default: return "text-muted-foreground"
  }
}

export function getNodeStatusBg(status: NodeStatus): string {
  switch (status) {
    case "completed": return "bg-emerald-500"
    case "running": return "bg-blue-500"
    case "failed": return "bg-red-500"
    case "pending": return "bg-muted-foreground/30"
    case "skipped": return "bg-muted-foreground/20"
    default: return "bg-muted-foreground/30"
  }
}

export function getEpisodeStatusIcon(status: EpisodeStatus): string {
  switch (status) {
    case "completed": return "check"
    case "running": return "loader"
    case "failed": return "x"
    case "pending": return "clock"
    case "queued": return "clock"
    default: return "clock"
  }
}
