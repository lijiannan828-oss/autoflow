"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { toast } from "sonner"
import { IconSidebar } from "@/components/icon-sidebar"
import { TopBar } from "@/components/top-bar"
import { ShotDetailPanel } from "@/components/shot-detail-panel"
import { VideoPreview } from "@/components/video-preview"
import { AltPanel } from "@/components/alt-panel"
import { TimelineStrip } from "@/components/timeline-strip"
import { episodes as mockEpisodes, currentEpisodeData as mockEpisodeData } from "@/lib/mock-data"
import type { EpisodeData, SelectedShotId, GenerationMode } from "@/lib/types"
import { shotDuration, totalTimelineDuration, getEpisodeSummary, getShotProgressSummary } from "@/lib/types"
import {
  useReviewTasks,
  approveReviewTask,
  returnReviewTask,
  applyGachaSelection,
  regenerateShot,
} from "@/lib/review-api"
import { adaptVisualFromTasks } from "@/lib/review-adapters"
import { GlobalNavSidebar } from "@/components/global-nav-sidebar"

export default function VisualReviewPage() {
  // Fetch real review tasks for Stage 2 (N18 Gate, shot-level)
  const { tasks, loading, error, reload } = useReviewTasks({
    stage: 2,
    limit: 200,
  })

  // Adapt real data or fallback to mock
  const { episodeData: realEpisodeData, episodes: realEpisodes } = useMemo(() => {
    if (loading || tasks.length === 0) {
      return { episodeData: mockEpisodeData, episodes: mockEpisodes }
    }
    return adaptVisualFromTasks(tasks)
  }, [tasks, loading])

  const [activeEpisodeId, setActiveEpisodeId] = useState("ep-1")
  const [episodeData, setEpisodeData] = useState<EpisodeData>(mockEpisodeData)
  const [selectedShotId, setSelectedShotId] = useState<SelectedShotId>(null)
  const [selectedGachaId, setSelectedGachaId] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showSubtitles, setShowSubtitles] = useState(true)

  const episodes = realEpisodes.length > 0 ? realEpisodes : mockEpisodes

  // Update episode data when real data arrives
  useEffect(() => {
    if (!loading && tasks.length > 0) {
      const { episodeData: adapted } = adaptVisualFromTasks(tasks)
      setEpisodeData(adapted)
      if (adapted.shots.length > 0) {
        setSelectedShotId(adapted.shots[0].id)
      }
    }
  }, [tasks, loading])

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const totalDur = useMemo(
    () => totalTimelineDuration(episodeData.shots),
    [episodeData.shots]
  )

  const episodeSummary = useMemo(() => getEpisodeSummary(episodes), [episodes])
  const shotProgress = useMemo(() => getShotProgressSummary(episodeData.shots), [episodeData.shots])

  // Find active shot under playhead
  const activeShot = useMemo(() => {
    let t = 0
    for (const shot of episodeData.shots) {
      const dur = shotDuration(shot)
      if (currentTime >= t && currentTime < t + dur) return shot
      t += dur
    }
    return episodeData.shots[episodeData.shots.length - 1] ?? null
  }, [currentTime, episodeData.shots])

  const selectedShot = useMemo(() => {
    if (!selectedShotId) return null
    return episodeData.shots.find((s) => s.id === selectedShotId) ?? null
  }, [selectedShotId, episodeData.shots])

  // Playback simulation
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1 / episodeData.fps
          if (next >= totalDur) {
            setIsPlaying(false)
            return totalDur
          }
          return next
        })
      }, 1000 / episodeData.fps)
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
    }
  }, [isPlaying, totalDur, episodeData.fps])

  // Space bar to play/pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault()
        setIsPlaying((p) => !p)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const handleSelectEpisode = useCallback((id: string) => {
    setActiveEpisodeId(id)
    setSelectedShotId(null)
    setSelectedGachaId(null)
    setCurrentTime(0)
    setIsPlaying(false)
    toast.info(`已切换到 ${episodes.find((e) => e.id === id)?.title ?? id}`)
  }, [episodes])

  const handleSelectShot = useCallback((id: string) => {
    setSelectedShotId(id)
    setSelectedGachaId(null)
    const shot = episodeData.shots.find((s) => s.id === id)
    if (shot) setCurrentTime(shot.startTime)
  }, [episodeData.shots])

  const handleSelectGacha = useCallback((_shotId: string, gachaId: string) => {
    setSelectedGachaId(gachaId)
  }, [])

  const handleApplyGacha = useCallback((shotId: string, gachaId: string) => {
    setEpisodeData((prev) => ({
      ...prev,
      shots: prev.shots.map((s) => {
        if (s.id !== shotId) return s
        const allGachas = s.gachaGroups.flatMap((g) => [g.keyframe, ...g.videos])
        const gacha = allGachas.find((g) => g.id === gachaId)
        if (!gacha) return s
        const updatedGroups = s.gachaGroups.map((group) => {
          const isThisGroup =
            group.keyframe.id === gachaId || group.videos.some((v) => v.id === gachaId)
          return {
            ...group,
            isSelected: isThisGroup,
            keyframe: { ...group.keyframe, isSelected: group.keyframe.id === gachaId },
            videos: group.videos.map((v) => ({ ...v, isSelected: v.id === gachaId })),
          }
        })
        return {
          ...s,
          thumbnailColor: gacha.thumbnailColor,
          referenceImageColor: gacha.thumbnailColor,
          gachaGroups: updatedGroups,
        }
      }),
    }))
    toast.success("已应用到时间轴")

    // Sync to backend
    const task = tasks.find((t) => t.anchor_id === shotId)
    if (task) {
      applyGachaSelection(task.id, gachaId).catch(() => {})
    }
  }, [tasks])

  const handleSeek = useCallback(
    (time: number) => setCurrentTime(Math.max(0, Math.min(totalDur, time))),
    [totalDur]
  )

  // Approve single shot — call real API
  const handleApproveShot = useCallback(
    async (shotId: string) => {
      // Find the review task for this shot
      const task = tasks.find((t) => t.anchor_id === shotId)

      setEpisodeData((prev) => ({
        ...prev,
        shots: prev.shots.map((s) =>
          s.id === shotId ? { ...s, status: "approved" as const } : s
        ),
      }))

      if (task) {
        try {
          await approveReviewTask(task.id, "镜头审核通过")
          toast.success("本分镜已通过审核（已同步后端）")
        } catch {
          toast.success("本分镜已通过审核（本地标记）")
        }
      } else {
        toast.success("本分镜已通过审核")
      }
    },
    [tasks]
  )

  // Approve entire episode — call real API for all pending shots
  const handleApproveAll = useCallback(async () => {
    setEpisodeData((prev) => ({
      ...prev,
      shots: prev.shots.map((s) => ({ ...s, status: "approved" as const })),
    }))

    const pendingTasks = tasks.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    )

    let successCount = 0
    for (const task of pendingTasks) {
      try {
        await approveReviewTask(task.id, "全集通过审核")
        successCount++
      } catch {
        // continue
      }
    }

    if (successCount > 0) {
      toast.success("本集已通过审核", {
        description: `${successCount} 个镜头审核决策已同步后端`,
      })
      reload()
    } else {
      toast.success("本集已通过审核", {
        description: `${episodeData.shots.length} 个分镜全部标记为通过`,
      })
    }
  }, [episodeData.shots.length, tasks, reload])

  const handleGenerate = useCallback(
    async (shotId: string, mode: GenerationMode, prompt: string) => {
      setEpisodeData((prev) => ({
        ...prev,
        shots: prev.shots.map((s) =>
          s.id === shotId ? { ...s, status: "generating" as const } : s
        ),
      }))

      // Try real API
      const task = tasks.find((t) => t.anchor_id === shotId)
      if (task) {
        try {
          const apiMode = mode === "dialog-edit" ? "chat2img" : mode
          await regenerateShot(task.id, apiMode, prompt)
          toast.success("重新生成请求已提交", {
            description: `${mode === "image-gen" ? "图片" : mode === "video-gen" ? "视频" : "对话改图"}生成中...`,
          })
          // Poll or wait, then reload
          setTimeout(() => {
            reload()
            setEpisodeData((prev) => ({
              ...prev,
              shots: prev.shots.map((s) =>
                s.id === shotId ? { ...s, status: "pending" as const } : s
              ),
            }))
          }, 3000)
          return
        } catch {
          // fallback to local simulation
        }
      }

      setTimeout(() => {
        setEpisodeData((prev) => ({
          ...prev,
          shots: prev.shots.map((s) =>
            s.id === shotId ? { ...s, status: "pending" as const } : s
          ),
        }))
        toast.success(
          `${mode === "image-gen" ? "图片" : mode === "video-gen" ? "视频" : "对话改图"}生成完成`
        )
      }, 3000)
    },
    [tasks, reload]
  )

  const handleExport = useCallback(() => {
    const approvedCount = episodeData.shots.filter((s) => s.status === "approved").length
    toast.success("导出任务已提交", {
      description: `${approvedCount}/${episodeData.shots.length} 个分镜已通过审核`,
    })
  }, [episodeData.shots])

  return (
    <div className="flex h-screen bg-background">
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

      {/* Top bar */}
      <TopBar
        projectName={episodeData.projectName}
        currentStep={episodeData.currentStep}
        completedSteps={episodeData.completedSteps}
        episodeSummary={episodeSummary}
        onExport={handleExport}
        onApproveAll={handleApproveAll}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        <IconSidebar
          episodes={episodes}
          activeEpisodeId={activeEpisodeId}
          onSelectEpisode={handleSelectEpisode}
        />

        <ShotDetailPanel
          shot={selectedShot}
          selectedGachaId={selectedGachaId}
          onApplyGacha={handleApplyGacha}
          onGenerate={handleGenerate}
          onApproveShot={handleApproveShot}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <VideoPreview
              activeShot={activeShot}
              currentTime={currentTime}
              totalDuration={totalDur}
              isPlaying={isPlaying}
              fps={episodeData.fps}
              showSubtitles={showSubtitles}
              shotProgress={shotProgress}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onToggleSubtitles={() => setShowSubtitles((p) => !p)}
            />

            <AltPanel
              shot={selectedShot}
              selectedGachaId={selectedGachaId}
              onSelectGacha={handleSelectGacha}
              onApplyGacha={handleApplyGacha}
            />
          </div>

          <TimelineStrip
            shots={episodeData.shots}
            selectedShotId={selectedShotId}
            currentTime={currentTime}
            onSelectShot={handleSelectShot}
            onSeek={handleSeek}
          />
        </div>
      </div>
    </div>
    </div>
  )
}
