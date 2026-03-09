// ===== Review Steps =====
export type ReviewStep = "art-assets" | "visual-material" | "av-integration" | "final-composite"

export const REVIEW_STEPS: { id: ReviewStep; label: string }[] = [
  { id: "art-assets", label: "美术资产" },
  { id: "visual-material", label: "视觉素材" },
  { id: "av-integration", label: "视听整合" },
  { id: "final-composite", label: "成片合成" },
]

// ===== Episode / Shot based review model =====
export type EpisodeStatus = "approved" | "pending" | "in-progress"

export interface Episode {
  id: string
  title: string
  shotCount: number
  status: EpisodeStatus
}

// Summary of all episodes for dashboard display
export interface EpisodeSummary {
  total: number
  approved: number
  inProgress: number
  pending: number
}

// A single gacha draw result - can be image or video
export interface GachaResult {
  id: string
  type: "image" | "video"
  thumbnailColor: string
  thumbnailUrl?: string
  label: string
  prompt: string
  model: string
  score: number
  comment: string
  createdAt: string // ISO timestamp
  isSelected?: boolean // whether this is the currently applied version
}

// A group of related gacha results: one keyframe + multiple video versions
export interface GachaGroup {
  id: string
  keyframe: GachaResult
  videos: GachaResult[]
  isSelected?: boolean // whether this group is currently selected on timeline
}

export interface Shot {
  id: string
  index: number
  label: string
  thumbnailColor: string
  thumbnailUrl?: string
  estimatedDuration: number
  inPoint: number
  outPoint: number
  startTime: number
  imagePrompt: string
  videoPrompt: string
  referenceImageColor: string
  cameraMovement: string
  tags: string[]
  scores: ModelScore[]
  suggestions: string[]
  alternates: AlternateShot[]
  gachaGroups: GachaGroup[] // grouped gacha results
  gachaStats: { keyframeCount: number; videoCount: number }
  status: "pending" | "approved" | "rejected" | "generating"
}

export interface AlternateShot {
  id: string
  thumbnailColor: string
  thumbnailUrl?: string
  label: string
  scores: ModelScore[]
}

export interface ModelScore {
  model: string
  score: number
  comment: string
}

export interface EpisodeData {
  episodeId: string
  episodeTitle: string
  projectName: string
  shots: Shot[]
  totalDuration: number
  fps: number
  currentStep: ReviewStep
  completedSteps: ReviewStep[]
}

export type SelectedShotId = string | null

export type GenerationMode = "dialog-edit" | "image-gen" | "video-gen"

export function shotDuration(shot: Shot): number {
  return shot.outPoint - shot.inPoint
}

export function totalTimelineDuration(shots: Shot[]): number {
  return shots.reduce((sum, s) => sum + shotDuration(s), 0)
}

export function formatTimecode(seconds: number, _fps: number = 25): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

export function getEpisodeSummary(episodes: Episode[]): EpisodeSummary {
  return {
    total: episodes.length,
    approved: episodes.filter(e => e.status === "approved").length,
    inProgress: episodes.filter(e => e.status === "in-progress").length,
    pending: episodes.filter(e => e.status === "pending").length,
  }
}

// Summary of shots within current episode
export interface ShotProgressSummary {
  total: number
  approved: number
  inProgress: number // generating
  pending: number
  totalRawDuration: number // original duration
  estimatedEditDuration: number // after editing
}

export function getShotProgressSummary(shots: Shot[]): ShotProgressSummary {
  const total = shots.length
  const approved = shots.filter(s => s.status === "approved").length
  const inProgress = shots.filter(s => s.status === "generating" || s.status === "rejected").length
  const pending = shots.filter(s => s.status === "pending").length
  const totalRawDuration = shots.reduce((sum, s) => sum + s.estimatedDuration, 0)
  // Assume edited version is ~70% of raw
  const estimatedEditDuration = Math.round(totalRawDuration * 0.7)
  
  return { total, approved, inProgress, pending, totalRawDuration, estimatedEditDuration }
}
