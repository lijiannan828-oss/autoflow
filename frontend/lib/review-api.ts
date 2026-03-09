/**
 * Review API 统一调用层。
 * 所有 review 页面通过此模块与后端交互，不再直接 import mock 数据。
 */

import type {
  GateDetailResponse,
  GateListItem,
  GateReviewPoint,
  ReturnTicket,
  ReviewTask,
  ReviewTaskStatus,
  Stage2AggregationResponse,
  Stage3AggregationResponse,
  Stage4StepQueryResponse,
} from "./orchestrator-contract-types"

// ─── 类型 ──────────────────────────────────────────────

export interface ReviewTaskListResponse {
  source: string
  items: ReviewTask[]
  total: number
  error?: string
}

/** 当前登录用户上下文（MVP‑0 简化：从 localStorage 读取） */
export interface UserContext {
  userId: string
  role: "qc_inspector" | "middle_platform" | "partner"
  displayName: string
}

// ─── 用户上下文 ─────────────────────────────────────────

const DEFAULT_USER: UserContext = {
  userId: "user-default",
  role: "qc_inspector",
  displayName: "质检专员",
}

export function getCurrentUser(): UserContext {
  if (typeof window === "undefined") return DEFAULT_USER
  try {
    const stored = localStorage.getItem("autoflow_user")
    if (stored) return JSON.parse(stored) as UserContext
  } catch {
    // ignore
  }
  return DEFAULT_USER
}

export function setCurrentUser(user: UserContext) {
  localStorage.setItem("autoflow_user", JSON.stringify(user))
}

// ─── Read API ───────────────────────────────────────────

export async function fetchReviewTasks(
  options: {
    stage?: number
    status?: ReviewTaskStatus
    role?: string
    limit?: number
  } = {}
): Promise<ReviewTaskListResponse> {
  const limit = options.limit ?? 100
  try {
    const res = await fetch(`/api/orchestrator/review/tasks?limit=${limit}`, {
      cache: "no-store",
    })
    const data = (await res.json()) as ReviewTaskListResponse

    let items = data.items ?? []

    // 客户端过滤：stage
    if (options.stage != null) {
      items = items.filter((t) => t.stage_no === options.stage)
    }
    // 客户端过滤：status
    if (options.status != null) {
      items = items.filter((t) => t.status === options.status)
    }
    // 客户端过滤：reviewer_role
    if (options.role != null) {
      items = items.filter((t) => t.reviewer_role === options.role)
    }

    return { ...data, items, total: items.length }
  } catch (err) {
    console.error("[review-api] fetchReviewTasks failed:", err)
    return { source: "error", items: [], total: 0, error: String(err) }
  }
}

export async function fetchReviewTaskDetail(
  taskId: string
): Promise<GateDetailResponse | null> {
  try {
    const res = await fetch(`/api/orchestrator/review/tasks/${taskId}`, {
      cache: "no-store",
    })
    const data = await res.json()
    return data?.detail ?? data ?? null
  } catch (err) {
    console.error("[review-api] fetchReviewTaskDetail failed:", err)
    return null
  }
}

export async function fetchStage2Summary(
  episodeId: string
): Promise<Stage2AggregationResponse | null> {
  try {
    const res = await fetch(
      `/api/orchestrator/review/stage2-summary?episode_id=${episodeId}`,
      { cache: "no-store" }
    )
    return (await res.json()) as Stage2AggregationResponse
  } catch {
    return null
  }
}

export async function fetchStage3Summary(
  episodeId: string
): Promise<Stage3AggregationResponse | null> {
  try {
    const res = await fetch(
      `/api/orchestrator/review/stage3-summary?episode_id=${episodeId}`,
      { cache: "no-store" }
    )
    return (await res.json()) as Stage3AggregationResponse
  } catch {
    return null
  }
}

export async function fetchStage4Summary(
  episodeId: string
): Promise<Stage4StepQueryResponse | null> {
  try {
    const res = await fetch(
      `/api/orchestrator/review/stage4-summary?episode_id=${episodeId}`,
      { cache: "no-store" }
    )
    return (await res.json()) as Stage4StepQueryResponse
  } catch {
    return null
  }
}

// ─── Return Tickets ─────────────────────────────────────

export interface ReturnTicketListResponse {
  source: string
  items: ReturnTicket[]
  total: number
  error?: string
}

export async function fetchReturnTickets(
  options: {
    episodeId?: string
    status?: string
    limit?: number
  } = {}
): Promise<ReturnTicketListResponse> {
  try {
    const params = new URLSearchParams()
    if (options.episodeId) params.set("episode_id", options.episodeId)
    if (options.status) params.set("status", options.status)
    if (options.limit) params.set("limit", String(options.limit))

    const res = await fetch(`/api/orchestrator/review/return-tickets?${params}`, {
      cache: "no-store",
    })
    return (await res.json()) as ReturnTicketListResponse
  } catch (err) {
    console.error("[review-api] fetchReturnTickets failed:", err)
    return { source: "error", items: [], total: 0, error: String(err) }
  }
}

// ─── Write API ──────────────────────────────────────────

export async function approveReviewTask(
  taskId: string,
  comment: string,
  reviewPoints: GateReviewPoint[] = []
) {
  const res = await fetch(`/api/orchestrator/review/tasks/${taskId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision_comment: comment,
      review_points: reviewPoints,
    }),
  })
  return res.json()
}

export async function returnReviewTask(
  taskId: string,
  comment: string,
  reviewPoints: GateReviewPoint[] = []
) {
  const res = await fetch(`/api/orchestrator/review/tasks/${taskId}/return`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision_comment: comment,
      review_points: reviewPoints,
    }),
  })
  return res.json()
}

export async function skipReviewTask(
  taskId: string,
  reason = "optional_step_skipped"
) {
  const res = await fetch(`/api/orchestrator/review/tasks/${taskId}/skip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  })
  return res.json()
}

// ─── Payload Update (lock, select, prompt, track) ───────

export interface UpdatePayloadResponse {
  review_task_id: string
  action: "payload_updated"
  updated_keys: string[]
  payload_json: Record<string, unknown>
  error?: string
}

/** Generic payload merge — updates any keys in the task's payload_json. */
export async function updateReviewTaskPayload(
  taskId: string,
  updates: Record<string, unknown>
): Promise<UpdatePayloadResponse> {
  const res = await fetch(`/api/orchestrator/review/tasks/${taskId}/update-payload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  })
  return res.json()
}

/** Lock a specific asset image for a review task. */
export async function lockAssetImage(taskId: string, imageId: string) {
  return updateReviewTaskPayload(taskId, { locked_image_id: imageId })
}

/** Unlock asset (set locked_image_id to null). */
export async function unlockAssetImage(taskId: string) {
  return updateReviewTaskPayload(taskId, { locked_image_id: null })
}

/** Apply gacha selection (keyframe + video). */
export async function applyGachaSelection(
  taskId: string,
  selectedKeyframeId: string,
  selectedVideoId: string | null = null
) {
  return updateReviewTaskPayload(taskId, {
    selected_keyframe_id: selectedKeyframeId,
    selected_video_id: selectedVideoId,
  })
}

/** Update generation prompt for a review task. */
export async function updateTaskPrompt(taskId: string, prompt: string) {
  return updateReviewTaskPayload(taskId, { prompt })
}

/** Update track settings (mute, lock). */
export async function updateTrackSettings(
  taskId: string,
  trackId: string,
  settings: { muted?: boolean; locked?: boolean }
) {
  return updateReviewTaskPayload(taskId, {
    [`track_${trackId}_muted`]: settings.muted,
    [`track_${trackId}_locked`]: settings.locked,
  })
}

/** Update audio clip properties (volume, fade). */
export async function updateAudioClip(
  taskId: string,
  clipId: string,
  adjustments: { volume?: number; fadeIn?: number; fadeOut?: number }
) {
  return updateReviewTaskPayload(taskId, {
    audio_adjustments: { clip_id: clipId, ...adjustments },
  })
}

// ─── Regeneration Requests ──────────────────────────────

export type RegenType = "asset" | "shot" | "voice" | "sfx" | "music_feedback" | "export" | "revert"

export interface RegenerationResponse {
  review_task_id: string
  action: "regeneration_requested"
  regen_type: RegenType
  job_id: string
  job_type: string
  status: "queued"
  params: Record<string, unknown>
  error?: string
}

/** Generic regeneration request — creates a model_job. */
export async function requestRegeneration(
  taskId: string,
  regenType: RegenType,
  params: Record<string, unknown> = {}
): Promise<RegenerationResponse> {
  const res = await fetch(`/api/orchestrator/review/tasks/${taskId}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regen_type: regenType, params }),
  })
  return res.json()
}

/** Regenerate asset with updated prompt. */
export async function regenerateAsset(taskId: string, prompt?: string, model?: string) {
  return requestRegeneration(taskId, "asset", { prompt, model })
}

/** Regenerate shot (keyframe or video). */
export async function regenerateShot(
  taskId: string,
  mode: "image-gen" | "video-gen" | "chat2img",
  prompt?: string
) {
  return requestRegeneration(taskId, "shot", { mode, prompt })
}

/** Generate voice (TTS). */
export async function generateVoice(
  taskId: string,
  characterId: string,
  text: string,
  model?: string,
  language?: string
) {
  return requestRegeneration(taskId, "voice", { character_id: characterId, text, model, language })
}

/** Replace SFX. */
export async function replaceSfx(taskId: string, clipId: string, newSfxId?: string) {
  return requestRegeneration(taskId, "sfx", { clip_id: clipId, new_sfx_id: newSfxId })
}

/** Submit music/BGM feedback. */
export async function submitMusicFeedback(taskId: string, feedback: string) {
  return requestRegeneration(taskId, "music_feedback", { feedback })
}

/** Export rough cut. */
export async function exportRoughCut(taskId: string) {
  return requestRegeneration(taskId, "export", {})
}

/** Revert to historical version. */
export async function revertToVersion(taskId: string, targetVersionId: string) {
  return requestRegeneration(taskId, "revert", { target_version_id: targetVersionId })
}

// ─── React hook: useReviewTasks ─────────────────────────

import { useState, useEffect, useCallback } from "react"

export function useReviewTasks(options: {
  stage?: number
  role?: string
  status?: ReviewTaskStatus
  limit?: number
  autoRefreshMs?: number
}) {
  const [tasks, setTasks] = useState<ReviewTask[]>([])
  const [total, setTotal] = useState(0)
  const [source, setSource] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchReviewTasks(options)
    setTasks(data.items)
    setTotal(data.total)
    setSource(data.source)
    setError(data.error ?? null)
    setLoading(false)
  }, [options.stage, options.role, options.status, options.limit])

  useEffect(() => {
    load()
    if (options.autoRefreshMs && options.autoRefreshMs > 0) {
      const interval = setInterval(load, options.autoRefreshMs)
      return () => clearInterval(interval)
    }
  }, [load, options.autoRefreshMs])

  return { tasks, total, source, loading, error, reload: load }
}
