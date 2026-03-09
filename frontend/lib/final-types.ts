// ===== Final Composite Page Types =====

import type { EpisodeStatus } from "./types"

// Review stage progression
export type ReviewStage = "quality-check" | "platform-review" | "partner-review"

export interface ReviewStageInfo {
  id: ReviewStage
  label: string
  status: "completed" | "current" | "pending"
}

// Episode with full details for final review
export interface FinalEpisode {
  id: string
  index: number
  title: string
  duration: number // in seconds
  status: EpisodeStatus | "rejected"
  thumbnailColor: string
  isRevision: boolean // whether this is a revised version
  revisionCount: number
}

// Revision history entry
export interface RevisionEntry {
  id: string
  timestamp: string // ISO date
  summary: string // AI-generated summary of changes
  changes: RevisionChange[]
}

export interface RevisionChange {
  timeCode: string // e.g. "00:15"
  description: string
  type: "visual" | "audio" | "edit"
}

// Historical video version
export interface HistoricalVideo {
  id: string
  version: number
  createdAt: string
  thumbnailColor: string
  duration: number
}

// Review point (annotation)
export interface ReviewPoint {
  id: string
  timestamp: number // in seconds
  timecode: string // formatted "00:01:24"
  comment: string
  categories: ReviewCategory[]
  createdAt: string
}

export type ReviewCategory = "visual" | "av-integration" | "final-edit" | "other"

export const REVIEW_CATEGORIES: { id: ReviewCategory; label: string }[] = [
  { id: "visual", label: "视觉素材" },
  { id: "av-integration", label: "视听整合" },
  { id: "final-edit", label: "最终合成" },
  { id: "other", label: "其他" },
]

// Final composite episode data
export interface FinalCompositeData {
  projectName: string
  totalSeriesDuration: number // total duration of all episodes in seconds
  currentEpisode: FinalEpisode
  episodes: FinalEpisode[]
  reviewStages: ReviewStageInfo[]
  revisionHistory: RevisionEntry[]
  historicalVideos: HistoricalVideo[]
  reviewPoints: ReviewPoint[]
}

// Episode summary with rejected count
export interface FinalEpisodeSummary {
  total: number
  approved: number
  rejected: number
  pending: number
}

export function getFinalEpisodeSummary(episodes: FinalEpisode[]): FinalEpisodeSummary {
  return {
    total: episodes.length,
    approved: episodes.filter(e => e.status === "approved").length,
    rejected: episodes.filter(e => e.status === "rejected").length,
    pending: episodes.filter(e => e.status === "pending" || e.status === "in-progress").length,
  }
}

export function formatLongTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function formatDurationChinese(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}分${s}秒`
}
