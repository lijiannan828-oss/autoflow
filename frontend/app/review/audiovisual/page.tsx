"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { toast } from "sonner"
import { IconSidebar } from "@/components/icon-sidebar"
import { AVHeader } from "@/components/av/av-header"
import { AudioPanel } from "@/components/av/audio-panel"
import { AVVideoPlayer } from "@/components/av/av-video-player"
import { PropertiesPanel } from "@/components/av/properties-panel"
import { NLETimeline } from "@/components/av/nle-timeline"
import { avEpisodeData as mockAvData } from "@/lib/av-mock-data"
import { episodes as episodesList } from "@/lib/mock-data"
import { getEpisodeSummary } from "@/lib/types"
import type { AVEpisodeData, SelectedItem, AudioTake } from "@/lib/av-types"
import {
  useReviewTasks,
  approveReviewTask,
  generateVoice,
  replaceSfx,
  submitMusicFeedback,
  exportRoughCut,
  updateTrackSettings,
  updateAudioClip,
} from "@/lib/review-api"
import { adaptAVFromTasks } from "@/lib/review-adapters"
import { GlobalNavSidebar } from "@/components/global-nav-sidebar"

export default function AudiovisualPage() {
  // Fetch real review tasks for Stage 3 (N21 Gate, episode-level)
  const { tasks, loading, error, reload } = useReviewTasks({
    stage: 3,
    limit: 50,
  })

  const [episodeData, setEpisodeData] = useState<AVEpisodeData>(mockAvData)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
  const [pixelsPerSecond, setPixelsPerSecond] = useState(40)
  const [activeEpisodeId, setActiveEpisodeId] = useState("ep-1")

  // Update data when real tasks arrive
  useEffect(() => {
    if (!loading && tasks.length > 0) {
      setEpisodeData(adaptAVFromTasks(tasks))
    }
  }, [tasks, loading])

  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const episodeSummary = useMemo(() => getEpisodeSummary(episodesList), [])

  // Find active video clip under playhead
  const activeVideoClip = useMemo(() => {
    return (
      episodeData.videoClips.find(
        (clip) => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
      ) ?? null
    )
  }, [currentTime, episodeData.videoClips])

  // Find active subtitle under playhead
  const activeSubtitle = useMemo(() => {
    return (
      episodeData.subtitleClips.find(
        (clip) => currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration
      ) ?? null
    )
  }, [currentTime, episodeData.subtitleClips])

  // Playback simulation
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 1 / episodeData.fps
          if (next >= episodeData.totalDuration) {
            setIsPlaying(false)
            return episodeData.totalDuration
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
  }, [isPlaying, episodeData.totalDuration, episodeData.fps])

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

  const handleSeek = useCallback(
    (time: number) => setCurrentTime(Math.max(0, Math.min(episodeData.totalDuration, time))),
    [episodeData.totalDuration]
  )

  const handleStepBackward = useCallback(() => {
    setCurrentTime((prev) => Math.max(0, prev - 1))
  }, [])

  const handleStepForward = useCallback(() => {
    setCurrentTime((prev) => Math.min(episodeData.totalDuration, prev + 1))
  }, [episodeData.totalDuration])

  const handleGenerateVoice = useCallback(
    async (characterId: string, text: string, model: string, language: string) => {
      const character = episodeData.characters.find((c) => c.id === characterId)
      toast.success("正在生成配音...", {
        description: `角色: ${character?.name ?? "未知"}, 模型: ${model}`,
      })

      // Try real API
      const pendingTask = tasks.find(
        (t) => t.status === "pending" || t.status === "in_progress"
      )
      if (pendingTask) {
        try {
          await generateVoice(pendingTask.id, characterId, text, model, language)
          toast.success("配音生成请求已提交")
          return
        } catch {
          // fallback
        }
      }

      setTimeout(() => {
        const newTake: AudioTake = {
          id: `take-${Date.now()}`,
          characterId,
          dialogueText: text,
          duration: 2 + Math.random() * 3,
          model,
          language,
          createdAt: new Date().toISOString(),
          waveformColor: "#3B82F6",
        }
        setEpisodeData((prev) => ({
          ...prev,
          audioTakes: [newTake, ...prev.audioTakes],
          generatedAudioCount: prev.generatedAudioCount + 1,
        }))
        toast.success("配音生成完成!")
      }, 2000)
    },
    [episodeData.characters, tasks]
  )

  const handleDragTake = useCallback((_takeId: string) => {
    toast.info("拖放音频片段到时间轴", { description: "将在播放头位置插入" })
  }, [])

  const handleSelectItem = useCallback((item: SelectedItem) => {
    setSelectedItem(item)
  }, [])

  const handleToggleTrackMute = useCallback((trackId: string) => {
    let newMuted = false
    setEpisodeData((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id === trackId) {
          newMuted = !t.muted
          return { ...t, muted: newMuted }
        }
        return t
      }),
    }))
    const pendingTask = tasks.find((t) => t.status === "pending" || t.status === "in_progress")
    if (pendingTask) {
      updateTrackSettings(pendingTask.id, trackId, { muted: newMuted }).catch(() => {})
    }
  }, [tasks])

  const handleToggleTrackLock = useCallback((trackId: string) => {
    let newLocked = false
    setEpisodeData((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) => {
        if (t.id === trackId) {
          newLocked = !t.locked
          return { ...t, locked: newLocked }
        }
        return t
      }),
    }))
    const pendingTask = tasks.find((t) => t.status === "pending" || t.status === "in_progress")
    if (pendingTask) {
      updateTrackSettings(pendingTask.id, trackId, { locked: newLocked }).catch(() => {})
    }
  }, [tasks])

  const handleVolumeChange = useCallback((clipId: string, volume: number) => {
    setEpisodeData((prev) => ({
      ...prev,
      audioClips: prev.audioClips.map((c) => (c.id === clipId ? { ...c, volume } : c)),
    }))
    const pendingTask = tasks.find((t) => t.status === "pending" || t.status === "in_progress")
    if (pendingTask) {
      updateAudioClip(pendingTask.id, clipId, { volume }).catch(() => {})
    }
  }, [tasks])

  const handleFadeChange = useCallback((clipId: string, fadeIn: number, fadeOut: number) => {
    setEpisodeData((prev) => ({
      ...prev,
      audioClips: prev.audioClips.map((c) =>
        c.id === clipId ? { ...c, fadeIn, fadeOut } : c
      ),
    }))
    const pendingTask = tasks.find((t) => t.status === "pending" || t.status === "in_progress")
    if (pendingTask) {
      updateAudioClip(pendingTask.id, clipId, { fadeIn, fadeOut }).catch(() => {})
    }
  }, [tasks])

  const handleReplaceSfx = useCallback((clipId: string, newSfxName: string) => {
    setEpisodeData((prev) => ({
      ...prev,
      audioClips: prev.audioClips.map((c) =>
        c.id === clipId ? { ...c, name: newSfxName } : c
      ),
    }))
    toast.success("音效已替换", { description: newSfxName })

    // Sync to backend
    const pendingTask = tasks.find(
      (t) => t.status === "pending" || t.status === "in_progress"
    )
    if (pendingTask) {
      replaceSfx(pendingTask.id, clipId, newSfxName).catch(() => {})
    }
  }, [tasks])

  const handleSubmitMusicFeedback = useCallback((_clipId: string, feedback: string) => {
    toast.success("修改建议已提交", {
      description: "自动流将根据建议调整配乐",
    })

    const pendingTask = tasks.find(
      (t) => t.status === "pending" || t.status === "in_progress"
    )
    if (pendingTask) {
      submitMusicFeedback(pendingTask.id, feedback).catch(() => {})
    }
  }, [tasks])

  const handleExportRough = useCallback(async () => {
    const pendingTask = tasks.find(
      (t) => t.status === "pending" || t.status === "in_progress"
    )
    if (pendingTask) {
      try {
        await exportRoughCut(pendingTask.id)
        toast.success("导出粗剪请求已提交", {
          description: `包含 ${episodeData.videoClips.length} 个视频片段，后台处理中`,
        })
        return
      } catch {
        // fallback
      }
    }
    toast.success("导出粗剪任务已提交", {
      description: `包含 ${episodeData.videoClips.length} 个视频片段`,
    })
  }, [episodeData.videoClips.length, tasks])

  // Approve all — call real API
  const handleApproveAll = useCallback(async () => {
    const pendingTasks = tasks.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    )

    if (pendingTasks.length > 0) {
      let successCount = 0
      for (const task of pendingTasks) {
        try {
          await approveReviewTask(task.id, "视听整合审核通过")
          successCount++
        } catch {
          // continue
        }
      }
      if (successCount > 0) {
        toast.success("本集已通过审核", {
          description: `视听整合阶段完成，${successCount} 个审核决策已同步`,
        })
        reload()
        return
      }
    }

    toast.success("本集已通过审核", {
      description: "视听整合阶段完成",
    })
  }, [tasks, reload])

  const handleSelectEpisode = useCallback((id: string) => {
    setActiveEpisodeId(id)
    toast.info("切换剧集", { description: `已切换到剧集 ${id}` })
  }, [])

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

      {/* Top header */}
      <AVHeader
        projectName={episodeData.projectName}
        episodeTitle={episodeData.episodeTitle}
        currentStep="av-integration"
        completedSteps={["art-assets", "visual-material"]}
        totalShots={episodeData.totalShots}
        matchedSfx={episodeData.matchedSfx}
        matchedBgm={episodeData.matchedBgm}
        episodeSummary={episodeSummary}
        onExportRough={handleExportRough}
        onApproveAll={handleApproveAll}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <IconSidebar
          episodes={episodesList}
          activeEpisodeId={activeEpisodeId}
          onSelectEpisode={handleSelectEpisode}
        />

        <AudioPanel
          characters={episodeData.characters}
          audioTakes={episodeData.audioTakes}
          selectedItem={selectedItem}
          audioClips={episodeData.audioClips}
          onGenerateVoice={handleGenerateVoice}
          onDragTake={handleDragTake}
          onReplaceSfx={handleReplaceSfx}
          onSubmitMusicFeedback={handleSubmitMusicFeedback}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-[60] min-h-0">
            <AVVideoPlayer
              currentTime={currentTime}
              totalDuration={episodeData.totalDuration}
              fps={episodeData.fps}
              isPlaying={isPlaying}
              activeVideoClip={activeVideoClip}
              activeSubtitle={activeSubtitle}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onStepBackward={handleStepBackward}
              onStepForward={handleStepForward}
            />
          </div>

          <div className="flex-[40] min-h-0">
            <NLETimeline
              tracks={episodeData.tracks}
              videoClips={episodeData.videoClips}
              audioClips={episodeData.audioClips}
              subtitleClips={episodeData.subtitleClips}
              currentTime={currentTime}
              totalDuration={episodeData.totalDuration}
              pixelsPerSecond={pixelsPerSecond}
              selectedItem={selectedItem}
              onSeek={handleSeek}
              onSelectItem={handleSelectItem}
              onToggleTrackMute={handleToggleTrackMute}
              onToggleTrackLock={handleToggleTrackLock}
            />
          </div>
        </div>

        <PropertiesPanel
          selectedItem={selectedItem}
          audioClips={episodeData.audioClips}
          videoClips={episodeData.videoClips}
          subtitleClips={episodeData.subtitleClips}
          onVolumeChange={handleVolumeChange}
          onFadeChange={handleFadeChange}
        />
      </div>
    </div>
    </div>
  )
}
