/**
 * 数据适配器：将后端 ReviewTask / GateDetailResponse
 * 转换为各审核页面组件期望的前端数据结构。
 *
 * 当后端 payload_json 格式不完整时，提供合理的空值/占位。
 */

import type { ReviewTask } from "./orchestrator-contract-types"
import type { ArtAssetsData, Character, ScriptHighlight } from "./art-types"
import type { EpisodeData, Episode, Shot, GachaGroup, GachaResult, ReviewStep } from "./types"
import type { AVEpisodeData, Track, VideoClip, AudioClip, SubtitleClip, Character as AVCharacter } from "./av-types"
import type { FinalCompositeData, FinalEpisode, ReviewStageInfo } from "./final-types"
import type { DramaTask, TaskSwimlane, TaskDashboardSummary, TaskStatus } from "./task-types"

// ─── Helpers ────────────────────────────────────────────

function makeGachaResult(overrides: Partial<GachaResult> & { id: string; type: "image" | "video" }): GachaResult {
  return {
    thumbnailColor: "",
    label: "",
    prompt: "",
    model: "",
    score: 8.0,
    comment: "",
    createdAt: new Date().toISOString(),
    isSelected: false,
    ...overrides,
  }
}

function makeGachaGroup(id: string, keyframe: GachaResult, videos: GachaResult[]): GachaGroup {
  return { id, keyframe, videos, isSelected: false }
}

// ─── Stage 1: Art Assets ────────────────────────────────

export function adaptArtAssetsFromTasks(tasks: ReviewTask[]): ArtAssetsData {
  const characters: Character[] = []
  const scenes: typeof characters = []
  const props: typeof characters = []
  const highlights: ScriptHighlight[] = []

  let projectName = "审核项目"

  for (const task of tasks) {
    const p = task.payload_json ?? {}
    const anchorType = task.anchor_type ?? (p.asset_type as string) ?? "character"
    const anchorId = task.anchor_id ?? task.id

    if (p.project_name) projectName = p.project_name as string

    const candidates = (p.candidates ?? p.asset_candidates ?? []) as Array<{
      id?: string; prompt?: string; score?: number
    }>

    const images = candidates.map((c, i) => ({
      id: c.id ?? `${anchorId}-img-${i}`,
      thumbnailColor: "",
      prompt: (c.prompt as string) ?? "",
      score: (c.score as number) ?? 8.0,
      isLocked: false,
    }))

    if (images.length === 0) {
      images.push({ id: `${anchorId}-placeholder`, thumbnailColor: "#374151", prompt: "等待生成...", score: 0, isLocked: false })
    }

    const name = (p.name ?? p.asset_name ?? `资产 ${anchorId}`) as string
    const description = (p.description ?? "") as string
    const prompt = (p.prompt ?? p.generation_prompt ?? "") as string
    const entry = { id: anchorId, name, description, prompt, images, lockedImageId: null }

    if (anchorType === "character" || anchorType === "角色") characters.push(entry)
    else if (anchorType === "scene" || anchorType === "场景") scenes.push(entry)
    else if (anchorType === "prop" || anchorType === "道具") props.push(entry)
    else characters.push(entry)
  }

  const firstPayload = tasks[0]?.payload_json ?? {}
  const rawHighlights = firstPayload.highlights as Array<{ title?: string; content?: string }> | undefined
  if (rawHighlights) {
    for (const h of rawHighlights) {
      highlights.push({ id: `hl-${highlights.length}`, title: h.title ?? "", content: h.content ?? "" })
    }
  }

  return {
    projectName,
    scriptSummary: (firstPayload.script_summary as string) ?? "",
    highlights,
    artStyle: { id: "style-1", baseStyle: (firstPayload.art_style as string) ?? "待定", visualDescription: (firstPayload.visual_description as string) ?? "", isLocked: false },
    characters,
    scenes,
    props,
  }
}

// ─── Stage 2: Visual (Shot-level) ───────────────────────

export function adaptVisualFromTasks(tasks: ReviewTask[]): {
  episodeData: EpisodeData
  episodes: Episode[]
} {
  let cumulativeTime = 0

  const shots: Shot[] = tasks.map((task, idx) => {
    const p = task.payload_json ?? {}
    const shotId = task.anchor_id ?? `shot-${idx + 1}`

    const keyframeCandidates = (p.keyframe_candidates ?? []) as Array<{
      id?: string; prompt?: string; score?: number; model?: string
    }>
    const videoCandidates = (p.video_candidates ?? []) as Array<{
      id?: string; prompt?: string; score?: number; model?: string; duration?: number
    }>

    const gachaGroups: GachaGroup[] = []
    const duration = (p.duration as number) ?? 3.0

    if (keyframeCandidates.length > 0 || videoCandidates.length > 0) {
      const kfCount = Math.max(keyframeCandidates.length, 1)
      for (let g = 0; g < kfCount; g++) {
        const kf = keyframeCandidates[g]
        const groupVideos = videoCandidates.slice(
          g * Math.ceil(videoCandidates.length / kfCount),
          (g + 1) * Math.ceil(videoCandidates.length / kfCount)
        )

        const keyframe = makeGachaResult({
          id: kf?.id ?? `${shotId}-kf-${g}`,
          type: "image",
          label: `关键帧 ${g + 1}`,
          prompt: kf?.prompt ?? "",
          score: kf?.score ?? 8.0,
          model: kf?.model ?? "FLUX.2",
          isSelected: g === 0,
        })

        const videos = groupVideos.map((v, vi) =>
          makeGachaResult({
            id: v?.id ?? `${shotId}-vid-${g}-${vi}`,
            type: "video",
            label: `视频 ${g + 1}-${vi + 1}`,
            prompt: v?.prompt ?? "",
            score: v?.score ?? 8.0,
            model: v?.model ?? "LTX-2.3",
            isSelected: vi === 0,
          })
        )

        gachaGroups.push(makeGachaGroup(`${shotId}-group-${g}`, keyframe, videos))
      }
    } else {
      gachaGroups.push(
        makeGachaGroup(`${shotId}-group-0`,
          makeGachaResult({ id: `${shotId}-kf-0`, type: "image", label: "等待生成", thumbnailColor: "#374151", isSelected: true }),
          []
        )
      )
    }

    const startTime = cumulativeTime
    cumulativeTime += duration

    const shot: Shot = {
      id: shotId,
      index: idx + 1,
      label: (p.shot_title ?? p.title ?? `镜头 ${idx + 1}`) as string,
      thumbnailColor: "#374151",
      estimatedDuration: duration,
      inPoint: 0,
      outPoint: duration,
      startTime,
      imagePrompt: (p.prompt ?? p.visual_prompt ?? "") as string,
      videoPrompt: (p.video_prompt ?? "") as string,
      referenceImageColor: "#374151",
      cameraMovement: (p.camera_movement ?? "") as string,
      tags: [],
      scores: [],
      suggestions: (p.suggestions ?? []) as string[],
      alternates: [],
      gachaGroups,
      gachaStats: {
        keyframeCount: gachaGroups.length,
        videoCount: gachaGroups.reduce((s, g) => s + g.videos.length, 0),
      },
      status: task.status === "approved" ? "approved" : task.status === "returned" ? "rejected" : "pending",
    }
    return shot
  })

  const episodeIds = [...new Set(tasks.map((t) => t.episode_id))]
  const episodes: Episode[] = episodeIds.map((epId, i) => ({
    id: epId,
    title: `第 ${i + 1} 集`,
    shotCount: tasks.filter((t) => t.episode_id === epId).length,
    status: "in-progress" as const,
  }))

  return {
    episodeData: {
      episodeId: episodeIds[0] ?? "ep-1",
      episodeTitle: episodes[0]?.title ?? "第 1 集",
      projectName: "审核项目",
      shots,
      totalDuration: cumulativeTime,
      fps: 25,
      currentStep: "visual-material" as ReviewStep,
      completedSteps: ["art-assets" as ReviewStep],
    },
    episodes,
  }
}

// ─── Stage 3: Audiovisual ───────────────────────────────

export function adaptAVFromTasks(tasks: ReviewTask[]): AVEpisodeData {
  const task = tasks[0]
  const p = task?.payload_json ?? {}

  const tracks: Track[] = [
    { id: "subtitle", type: "subtitle", name: "字幕", color: "#94a3b8", muted: false, locked: false, height: 32 },
    { id: "video", type: "video", name: "视频", color: "#3b82f6", muted: false, locked: false, height: 48 },
    { id: "voiceover", type: "voiceover", name: "配音", color: "#22c55e", muted: false, locked: false, height: 40 },
    { id: "sfx", type: "sfx", name: "音效", color: "#f59e0b", muted: false, locked: false, height: 40 },
    { id: "bgm", type: "bgm", name: "背景音乐", color: "#a855f7", muted: false, locked: false, height: 40 },
  ]

  const videoClips: VideoClip[] = ((p.video_clips ?? []) as Array<Record<string, unknown>>).map((c, i) => ({
    id: (c.id as string) ?? `vc-${i}`,
    name: (c.name as string) ?? `片段 ${i + 1}`,
    thumbnailColor: "#374151",
    startTime: (c.start_time as number) ?? i * 3,
    duration: (c.duration as number) ?? 3,
    inPoint: (c.in_point as number) ?? 0,
    outPoint: (c.out_point as number) ?? (c.duration as number) ?? 3,
  }))

  const audioClips: AudioClip[] = ((p.audio_clips ?? []) as Array<Record<string, unknown>>).map((c, i) => ({
    id: (c.id as string) ?? `ac-${i}`,
    type: ((c.type as string) ?? "voiceover") as AudioClip["type"],
    name: (c.name as string) ?? `音频 ${i + 1}`,
    waveformColor: "#3b82f6",
    startTime: (c.start_time as number) ?? i * 3,
    duration: (c.duration as number) ?? 2,
    trackIndex: (c.track_index as number) ?? 2,
    volume: (c.volume as number) ?? 1.0,
    fadeIn: (c.fade_in as number) ?? 0,
    fadeOut: (c.fade_out as number) ?? 0,
    character: (c.character as string) ?? undefined,
    dialogueText: (c.dialogue_text as string) ?? undefined,
  }))

  const subtitleClips: SubtitleClip[] = ((p.subtitle_clips ?? []) as Array<Record<string, unknown>>).map((c, i) => ({
    id: (c.id as string) ?? `sc-${i}`,
    text: (c.text as string) ?? "",
    startTime: (c.start_time as number) ?? i * 3,
    duration: (c.duration as number) ?? 3,
    speaker: (c.speaker as string) ?? undefined,
  }))

  const characters: AVCharacter[] = ((p.characters ?? []) as Array<Record<string, unknown>>).map((c, i) => ({
    id: (c.id as string) ?? `char-${i}`,
    name: (c.name as string) ?? `角色 ${i + 1}`,
    avatarColor: (c.avatar_color as string) ?? "#6366f1",
    voiceModel: (c.voice_model as string) ?? "Rachel",
    defaultLanguage: (c.language as string) ?? "zh",
  }))

  const totalDuration = videoClips.length > 0
    ? videoClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
    : 60

  return {
    episodeId: task?.episode_id ?? "ep-1",
    episodeTitle: (p.episode_title as string) ?? "第 1 集",
    projectName: (p.project_name as string) ?? "审核项目",
    totalDuration,
    fps: 25,
    totalShots: (p.total_shots as number) ?? videoClips.length,
    generatedAudioCount: audioClips.length,
    matchedSfx: audioClips.filter((a) => a.type === "sfx").length,
    matchedBgm: audioClips.filter((a) => a.type === "bgm").length,
    tracks,
    videoClips,
    audioClips,
    subtitleClips,
    characters,
    audioTakes: [],
  }
}

// ─── Stage 4: Final Composite ───────────────────────────

export function adaptFinalFromTasks(tasks: ReviewTask[]): FinalCompositeData {
  const episodeIds = [...new Set(tasks.map((t) => t.episode_id))]

  const episodes: FinalEpisode[] = episodeIds.map((epId, i) => {
    const epTasks = tasks.filter((t) => t.episode_id === epId)
    const latestTask = epTasks[epTasks.length - 1]
    const p = latestTask?.payload_json ?? {}

    const statusMap: Record<string, FinalEpisode["status"]> = {
      approved: "approved",
      returned: "rejected",
      pending: "pending",
      in_progress: "in-progress",
      skipped: "pending",
    }

    return {
      id: epId,
      index: i + 1,
      title: (p.episode_title as string) ?? `第 ${i + 1} 集`,
      duration: (p.duration as number) ?? 60,
      status: statusMap[latestTask?.status ?? "pending"] ?? "pending",
      thumbnailColor: "#1e293b",
      isRevision: (p.is_revision as boolean) ?? false,
      revisionCount: (p.revision_count as number) ?? 0,
    }
  })

  // 三步串行审核阶段
  const reviewStages: ReviewStageInfo[] = [
    { id: "quality-check", label: "质检审核", status: "pending" },
    { id: "platform-review", label: "中台审核", status: "pending" },
    { id: "partner-review", label: "合作方审核", status: "pending" },
  ]

  // 更新审核阶段状态
  for (const task of tasks) {
    const stepNo = task.review_step_no
    if (stepNo >= 1 && stepNo <= 3 && reviewStages[stepNo - 1]) {
      const statusMap: Record<string, ReviewStageInfo["status"]> = {
        approved: "completed",
        pending: "pending",
        in_progress: "current",
        skipped: "completed",
      }
      reviewStages[stepNo - 1].status = statusMap[task.status] ?? "pending"
    }
  }

  const totalDuration = episodes.reduce((s, ep) => s + ep.duration, 0)

  return {
    projectName: "审核项目",
    totalSeriesDuration: totalDuration,
    episodes,
    currentEpisode: episodes[0] ?? {
      id: "ep-1", index: 1, title: "第 1 集", duration: 60, status: "pending",
      thumbnailColor: "#1e293b", isRevision: false, revisionCount: 0,
    },
    reviewStages,
    revisionHistory: [],
    historicalVideos: [],
    reviewPoints: [],
  }
}

// ─── Tasks Dashboard ────────────────────────────────────

export function adaptTasksFromReviewTasks(
  tasks: ReviewTask[],
  currentRole: string
): { swimlanes: TaskSwimlane[]; summary: TaskDashboardSummary } {
  const byEpisode = new Map<string, ReviewTask[]>()
  for (const task of tasks) {
    const key = task.episode_id
    if (!byEpisode.has(key)) byEpisode.set(key, [])
    byEpisode.get(key)!.push(task)
  }

  const dramaTasks: DramaTask[] = []

  for (const [episodeId, epTasks] of byEpisode) {
    const hasReturned = epTasks.some((t) => t.status === "returned")
    const allApproved = epTasks.every((t) => t.status === "approved" || t.status === "skipped")
    const hasInProgress = epTasks.some((t) => t.status === "in_progress")

    let status: TaskStatus = "new"
    if (hasReturned) status = "rejected-hub"
    else if (allApproved) status = "new"
    else if (hasInProgress) status = "in-progress"

    const firstPayload = epTasks[0]?.payload_json ?? {}
    const title = (firstPayload.drama_title ?? firstPayload.episode_title ?? `剧集 ${episodeId.slice(0, 8)}`) as string

    const stageProgress = (stageNo: number) => {
      const stageTasks = epTasks.filter((t) => t.stage_no === stageNo)
      return {
        current: stageTasks.filter((t) => t.status === "approved" || t.status === "skipped").length,
        total: Math.max(stageTasks.length, 1),
      }
    }

    const roleProgress = (role: string) => {
      const roleTasks = epTasks.filter((t) => t.reviewer_role === role)
      return {
        current: roleTasks.filter((t) => t.status === "approved" || t.status === "skipped").length,
        total: Math.max(roleTasks.length, 1),
      }
    }

    const deadline = new Date()
    deadline.setDate(deadline.getDate() + 3)

    const isUrgent = deadline.toDateString() === new Date().toDateString()

    dramaTasks.push({
      id: episodeId,
      title,
      coverImage: "#1e293b",
      deadline,
      status,
      episodeCount: 1,
      estimatedMinutes: (firstPayload.estimated_minutes as number) ?? 1.5,
      progress: {
        qa: roleProgress("qc_inspector"),
        hub: roleProgress("middle_platform"),
        partner: roleProgress("partner"),
      },
      qaStageProgress: {
        visual: stageProgress(2),
        audiovisual: stageProgress(3),
        final: stageProgress(4),
      },
      isUrgent,
      hoursRemaining: isUrgent ? 8 : undefined,
    })
  }

  const rejected = dramaTasks.filter((t) => t.status === "rejected-partner" || t.status === "rejected-hub")
  const inProgress = dramaTasks.filter((t) => t.status === "in-progress")
  const newTasks = dramaTasks.filter((t) => t.status === "new")
  const generating = dramaTasks.filter((t) => t.status === "generating")

  const swimlanes: TaskSwimlane[] = []
  if (rejected.length > 0) swimlanes.push({ id: "rejected", title: "紧急驳回", icon: "flame", badgeColor: "red", tasks: rejected })
  if (inProgress.length > 0) swimlanes.push({ id: "in-progress", title: "质检中", icon: "clock", badgeColor: "emerald", tasks: inProgress })
  if (newTasks.length > 0) swimlanes.push({ id: "new", title: "新任务待检", icon: "sparkles", badgeColor: "blue", tasks: newTasks })
  if (generating.length > 0) swimlanes.push({ id: "generating", title: "Agent 生成中", icon: "bot", badgeColor: "gray", tasks: generating })

  if (swimlanes.length === 0) {
    swimlanes.push({ id: "empty", title: "暂无任务", icon: "sparkles", badgeColor: "gray", tasks: [] })
  }

  return {
    swimlanes,
    summary: {
      totalDramas: byEpisode.size,
      totalEpisodes: dramaTasks.reduce((s, t) => s + t.episodeCount, 0),
      dueToday: dramaTasks.filter((t) => t.deadline.toDateString() === new Date().toDateString()).length,
      agentGenerating: generating.length,
    },
  }
}
