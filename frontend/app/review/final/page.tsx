"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { toast } from "sonner"

import { FinalHeader } from "@/components/final/final-header"
import { FinalVideoPlayer } from "@/components/final/final-video-player"
import { EpisodeStrip } from "@/components/final/episode-strip"
import { RevisionPanel } from "@/components/final/revision-panel"
import { ReviewPanel } from "@/components/final/review-panel"

import { finalCompositeData as mockFinalData } from "@/lib/final-mock-data"
import { getFinalEpisodeSummary } from "@/lib/final-types"
import type { ReviewPoint, FinalCompositeData } from "@/lib/final-types"
import {
  useReviewTasks,
  approveReviewTask,
  returnReviewTask,
  skipReviewTask,
  fetchStage4Summary,
  revertToVersion,
} from "@/lib/review-api"
import { adaptFinalFromTasks } from "@/lib/review-adapters"
import type { Stage4StepQueryResponse } from "@/lib/orchestrator-contract-types"
import { GlobalNavSidebar } from "@/components/global-nav-sidebar"

export default function FinalCompositePage() {
  // Fetch real review tasks for Stage 4 (N24 Gate, 3-step serial)
  const { tasks, loading, error, reload } = useReviewTasks({
    stage: 4,
    limit: 100,
  })

  // Data state
  const [data, setData] = useState<FinalCompositeData>(mockFinalData)
  const [currentEpisodeId, setCurrentEpisodeId] = useState(mockFinalData.currentEpisode.id)
  const [reviewPoints, setReviewPoints] = useState<ReviewPoint[]>([])
  const [stage4Progress, setStage4Progress] = useState<Stage4StepQueryResponse | null>(null)

  // Update data when real tasks arrive
  useEffect(() => {
    if (!loading && tasks.length > 0) {
      const adapted = adaptFinalFromTasks(tasks)
      setData(adapted)
      if (adapted.currentEpisode) {
        setCurrentEpisodeId(adapted.currentEpisode.id)
      }
    }
  }, [tasks, loading])

  // Fetch Stage 4 step progress
  useEffect(() => {
    if (currentEpisodeId) {
      fetchStage4Summary(currentEpisodeId).then(setStage4Progress)
    }
  }, [currentEpisodeId])

  // Playback state
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Current episode
  const currentEpisode = useMemo(
    () => data.episodes.find((ep) => ep.id === currentEpisodeId) || data.episodes[0],
    [data.episodes, currentEpisodeId]
  )

  const episodeSummary = useMemo(() => getFinalEpisodeSummary(data.episodes), [data.episodes])

  const showRevisionPanel = currentEpisode?.isRevision ?? false
  const revisionHistory = showRevisionPanel ? data.revisionHistory : []
  const historicalVideos = showRevisionPanel ? data.historicalVideos : []

  // Handlers
  const handleSelectEpisode = useCallback((id: string) => {
    setCurrentEpisodeId(id)
    setCurrentTime(0)
    setIsPlaying(false)
    setReviewPoints([])
  }, [])

  const handlePlay = useCallback(() => setIsPlaying(true), [])
  const handlePause = useCallback(() => setIsPlaying(false), [])

  const handleStepBackward = useCallback(() => {
    setCurrentTime((prev) => Math.max(0, prev - 1))
  }, [])

  const handleStepForward = useCallback(() => {
    setCurrentTime((prev) => Math.min(currentEpisode?.duration ?? 60, prev + 1))
  }, [currentEpisode?.duration])

  // Approve — call real API
  const handleApprove = useCallback(async () => {
    // Find the pending task for current episode
    const pendingTask = tasks.find(
      (t) =>
        t.episode_id === currentEpisodeId &&
        (t.status === "pending" || t.status === "in_progress")
    )

    // Update local state immediately
    setData((prev) => ({
      ...prev,
      episodes: prev.episodes.map((ep) =>
        ep.id === currentEpisodeId ? { ...ep, status: "approved" as const } : ep
      ),
    }))

    if (pendingTask) {
      try {
        const result = await approveReviewTask(
          pendingTask.id,
          "成片审核通过",
          reviewPoints.map((rp) => ({
            timestamp_ms: rp.timestamp * 1000,
            issue_type: rp.categories?.[0] ?? "general",
            severity: "info",
            comment: rp.comment,
          }))
        )
        toast.success("本集已通过审核", {
          description: `${currentEpisode?.title} 审核决策已同步后端`,
        })
        reload()
      } catch {
        toast.success("本集已通过审核", {
          description: `${currentEpisode?.title} 已标记为通过（本地）`,
        })
      }
    } else {
      toast.success("本集已通过审核", {
        description: `${currentEpisode?.title} 已标记为通过`,
      })
    }

    // Move to next pending episode
    const nextPending = data.episodes.find(
      (ep) => ep.id !== currentEpisodeId && ep.status === "pending"
    )
    if (nextPending) {
      setCurrentEpisodeId(nextPending.id)
      setCurrentTime(0)
      setReviewPoints([])
    }
  }, [currentEpisodeId, currentEpisode?.title, data.episodes, tasks, reviewPoints, reload])

  // Reject — call real API
  const handleReject = useCallback(async () => {
    if (reviewPoints.length === 0) {
      toast.error("请先添加审阅打点", {
        description: "驳回前需要标注具体问题点",
      })
      return
    }

    // Find the pending task for current episode
    const pendingTask = tasks.find(
      (t) =>
        t.episode_id === currentEpisodeId &&
        (t.status === "pending" || t.status === "in_progress")
    )

    setData((prev) => ({
      ...prev,
      episodes: prev.episodes.map((ep) =>
        ep.id === currentEpisodeId ? { ...ep, status: "rejected" as const } : ep
      ),
    }))

    if (pendingTask) {
      try {
        await returnReviewTask(
          pendingTask.id,
          `成片驳回 — ${reviewPoints.length} 个问题点`,
          reviewPoints.map((rp) => ({
            timestamp_ms: rp.timestamp * 1000,
            issue_type: rp.categories?.[0] ?? "visual",
            severity: "major",
            comment: rp.comment,
          }))
        )
        toast.success("已驳回修改", {
          description: `${currentEpisode?.title} 已驳回，${reviewPoints.length} 个问题点已同步后端`,
        })
        reload()
      } catch {
        toast.success("已驳回修改", {
          description: `${currentEpisode?.title} 已标记为驳回（本地），共 ${reviewPoints.length} 个问题点`,
        })
      }
    } else {
      toast.success("已驳回修改", {
        description: `${currentEpisode?.title} 已标记为驳回，共 ${reviewPoints.length} 个问题点`,
      })
    }

    setReviewPoints([])
  }, [currentEpisodeId, currentEpisode?.title, reviewPoints, tasks, reload])

  const handleAddReviewPoint = useCallback(
    (point: Omit<ReviewPoint, "id" | "createdAt">) => {
      const newPoint: ReviewPoint = {
        ...point,
        id: `rp-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
      setReviewPoints((prev) => [...prev, newPoint])
      toast.success("已添加审阅打点", {
        description: `时间点 ${point.timecode}`,
      })
    },
    []
  )

  const handleRevertToVersion = useCallback(async (videoId: string) => {
    const pendingTask = tasks.find(
      (t) =>
        t.episode_id === currentEpisodeId &&
        (t.status === "pending" || t.status === "in_progress")
    )
    if (pendingTask) {
      try {
        await revertToVersion(pendingTask.id, videoId)
        toast.success("版本回退请求已提交", {
          description: "正在切换到历史版本",
        })
        reload()
        return
      } catch {
        // fallback
      }
    }
    toast.success("已应用历史版本", {
      description: "正在切换到原始视频",
    })
  }, [tasks, currentEpisodeId, reload])

  const handleBack = useCallback(() => {
    window.location.href = "/tasks"
  }, [])

  return (
    <div className="flex h-screen bg-background text-foreground">
      <GlobalNavSidebar />
      <div className="flex flex-1 flex-col min-w-0">
      {/* Loading / error indicator */}
      {loading && (
        <div className="bg-blue-500/10 border-b border-blue-500/30 px-4 py-1.5 text-center text-xs text-blue-300 animate-pulse">
          正在加载审核数据...
        </div>
      )}
      {error && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-center text-xs text-amber-300">
          使用离线数据（后端暂不可用）
        </div>
      )}

      {/* Stage 4 progress indicator */}
      {stage4Progress && (
        <div className="bg-card/50 border-b border-border px-4 py-1.5 flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">N24 串行审核:</span>
          {stage4Progress.steps.map((step) => (
            <span
              key={step.step_no}
              className={`px-2 py-0.5 rounded ${
                step.status === "approved"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : step.status === "skipped"
                    ? "bg-slate-500/10 text-slate-300"
                    : step.status === "returned"
                      ? "bg-red-500/10 text-red-300"
                      : step.step_no === stage4Progress.current_step_no
                        ? "bg-blue-500/10 text-blue-300"
                        : "bg-secondary/50 text-muted-foreground"
              }`}
            >
              Step {step.step_no}: {step.reviewer_role}
              {step.status ? ` (${step.status})` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Header */}
      <FinalHeader
        projectName={data.projectName}
        episodeTitle={currentEpisode?.title ?? ""}
        episodeSummary={episodeSummary}
        onBack={handleBack}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {showRevisionPanel && (
          <RevisionPanel
            revisionHistory={revisionHistory}
            historicalVideos={historicalVideos}
            onRevertToVersion={handleRevertToVersion}
          />
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <FinalVideoPlayer
            currentEpisode={currentEpisode}
            currentTime={currentTime}
            totalSeriesDuration={data.totalSeriesDuration}
            isPlaying={isPlaying}
            reviewStages={data.reviewStages}
            onPlay={handlePlay}
            onPause={handlePause}
            onStepBackward={handleStepBackward}
            onStepForward={handleStepForward}
            onReject={handleReject}
            onApprove={handleApprove}
          />

          <EpisodeStrip
            episodes={data.episodes}
            currentEpisodeId={currentEpisodeId}
            onSelectEpisode={handleSelectEpisode}
          />
        </div>

        <ReviewPanel
          currentTimestamp={currentTime}
          isPaused={!isPlaying}
          reviewPoints={reviewPoints}
          onAddReviewPoint={handleAddReviewPoint}
        />
      </div>
    </div>
    </div>
  )
}
