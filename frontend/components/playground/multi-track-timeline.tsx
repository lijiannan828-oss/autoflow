"use client"

import { cn } from "@/lib/utils"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Film,
  Music,
  MessageSquare,
  Sparkles,
  Mic2,
} from "lucide-react"

// 轨道类型定义
export type TrackType = "video" | "tts" | "bgm" | "sfx" | "subtitle"

export interface TrackClip {
  id: string
  trackType: TrackType
  startTime: number // 秒
  duration: number // 秒
  label: string
  color?: string
  // 视频轨特有
  shotId?: string
  thumbnail?: string
  // 音频轨特有
  waveform?: number[]
  // 字幕轨特有
  text?: string
}

export interface Track {
  id: string
  type: TrackType
  label: string
  clips: TrackClip[]
  muted?: boolean
  volume?: number
}

export interface MultiTrackTimelineProps {
  tracks: Track[]
  totalDuration: number // 总时长（秒）
  currentTime?: number
  isPlaying?: boolean
  onTimeChange?: (time: number) => void
  onPlayPause?: () => void
  onTrackMute?: (trackId: string) => void
  onClipClick?: (clip: TrackClip) => void
  className?: string
}

// 轨道图标映射
const TRACK_ICONS: Record<TrackType, typeof Film> = {
  video: Film,
  tts: Mic2,
  bgm: Music,
  sfx: Sparkles,
  subtitle: MessageSquare,
}

// 轨道颜色映射
const TRACK_COLORS: Record<TrackType, string> = {
  video: "bg-blue-500",
  tts: "bg-emerald-500",
  bgm: "bg-purple-500",
  sfx: "bg-amber-500",
  subtitle: "bg-pink-500",
}

const TRACK_LABELS: Record<TrackType, string> = {
  video: "视频轨",
  tts: "TTS轨",
  bgm: "BGM轨",
  sfx: "音效轨",
  subtitle: "字幕轨",
}

export function MultiTrackTimeline({
  tracks,
  totalDuration,
  currentTime = 0,
  isPlaying = false,
  onTimeChange,
  onPlayPause,
  onTrackMute,
  onClipClick,
  className,
}: MultiTrackTimelineProps) {
  const [zoom, setZoom] = useState(1) // 1 = 100px per second
  const [internalTime, setInternalTime] = useState(currentTime)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const timelineRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 像素/秒比例
  const pixelsPerSecond = 60 * zoom
  const timelineWidth = totalDuration * pixelsPerSecond

  // 同步外部时间
  useEffect(() => {
    setInternalTime(currentTime)
  }, [currentTime])

  // 自动播放时更新时间
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setInternalTime((prev) => {
        const next = prev + 0.1
        if (next >= totalDuration) {
          onPlayPause?.()
          return 0
        }
        onTimeChange?.(next)
        return next
      })
    }, 100)
    return () => clearInterval(interval)
  }, [isPlaying, totalDuration, onTimeChange, onPlayPause])

  // 点击时间线跳转
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0)
      const time = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond))
      setInternalTime(time)
      onTimeChange?.(time)
    },
    [pixelsPerSecond, totalDuration, onTimeChange]
  )

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${mins}:${String(secs).padStart(2, "0")}.${ms}`
  }

  // 生成时间刻度
  const timeMarkers = []
  const markerInterval = zoom >= 2 ? 1 : zoom >= 1 ? 2 : 5 // 根据缩放调整间隔
  for (let t = 0; t <= totalDuration; t += markerInterval) {
    timeMarkers.push(t)
  }

  return (
    <div className={cn("border border-border rounded-lg bg-secondary/20 overflow-hidden", className)}>
      {/* 控制栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          {/* 播放控制 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setInternalTime(0)
              onTimeChange?.(0)
            }}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPlayPause}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setInternalTime(totalDuration)
              onTimeChange?.(totalDuration)
            }}
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          {/* 时间显示 */}
          <div className="ml-2 px-2 py-1 bg-zinc-800 rounded text-xs font-mono text-foreground">
            {formatTime(internalTime)} / {formatTime(totalDuration)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 音量控制 */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={([v]) => {
                setVolume(v)
                if (v > 0) setIsMuted(false)
              }}
              max={100}
              step={1}
              className="w-20"
            />
          </div>

          {/* 缩放控制 */}
          <div className="flex items-center gap-1 border-l border-border pl-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.5))}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[10px] text-muted-foreground w-10 text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setZoom(Math.min(4, zoom + 0.5))}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* 轨道数 */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground border-l border-border pl-3">
            <Layers className="w-3.5 h-3.5" />
            <span>{tracks.length} 轨</span>
          </div>
        </div>
      </div>

      {/* 时间线主体 */}
      <div className="flex">
        {/* 轨道标签列 */}
        <div className="w-24 shrink-0 border-r border-border bg-secondary/20">
          {/* 时间刻度行的占位 */}
          <div className="h-6 border-b border-border" />
          {/* 轨道标签 */}
          {tracks.map((track) => {
            const Icon = TRACK_ICONS[track.type]
            return (
              <div
                key={track.id}
                className="h-10 flex items-center gap-2 px-2 border-b border-border/50 hover:bg-secondary/40 transition-colors"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => onTrackMute?.(track.id)}
                >
                  {track.muted ? (
                    <VolumeX className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <Volume2 className="w-3 h-3 text-foreground" />
                  )}
                </Button>
                <Icon className={cn("w-3.5 h-3.5 shrink-0", `text-${track.type === 'video' ? 'blue' : track.type === 'tts' ? 'emerald' : track.type === 'bgm' ? 'purple' : track.type === 'sfx' ? 'amber' : 'pink'}-400`)} />
                <span className="text-[10px] text-foreground truncate">{track.label}</span>
              </div>
            )
          })}
        </div>

        {/* 时间线滚动区域 */}
        <ScrollArea className="flex-1" ref={scrollContainerRef as any}>
          <div style={{ width: timelineWidth + 100 }}>
            {/* 时间刻度 */}
            <div className="h-6 border-b border-border relative bg-zinc-900/50">
              {timeMarkers.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left: t * pixelsPerSecond }}
                >
                  <div className="h-2 w-px bg-zinc-600" />
                  <span className="text-[9px] text-muted-foreground mt-0.5">
                    {formatTime(t)}
                  </span>
                </div>
              ))}
            </div>

            {/* 轨道内容 */}
            <div
              ref={timelineRef}
              className="relative cursor-pointer"
              onClick={handleTimelineClick}
            >
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className={cn(
                    "h-10 border-b border-border/50 relative",
                    track.muted && "opacity-50"
                  )}
                >
                  {/* 网格背景 */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent ${pixelsPerSecond - 1}px, rgba(255,255,255,0.03) ${pixelsPerSecond - 1}px, rgba(255,255,255,0.03) ${pixelsPerSecond}px)`,
                    }}
                  />

                  {/* Clips */}
                  {track.clips.map((clip) => (
                    <TooltipProvider key={clip.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              "absolute top-1 bottom-1 rounded transition-all track-clip-hover",
                              "hover:brightness-110 hover:ring-1 hover:ring-white/30",
                              TRACK_COLORS[track.type],
                              "opacity-90 shadow-sm"
                            )}
                            style={{
                              left: clip.startTime * pixelsPerSecond,
                              width: Math.max(4, clip.duration * pixelsPerSecond - 2),
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onClipClick?.(clip)
                            }}
                          >
                            {/* Clip 内容 */}
                            <div className="absolute inset-0 flex items-center px-1 overflow-hidden">
                              {clip.duration * pixelsPerSecond > 40 && (
                                <span className="text-[9px] text-white truncate">
                                  {clip.label}
                                </span>
                              )}
                            </div>

                            {/* 波形显示 (音频轨) */}
                            {clip.waveform && clip.duration * pixelsPerSecond > 20 && (
                              <div className="absolute inset-0 flex items-center justify-around px-0.5 opacity-50">
                                {clip.waveform.slice(0, Math.floor(clip.duration * pixelsPerSecond / 3)).map((h, i) => (
                                  <div
                                    key={i}
                                    className="w-px bg-white rounded-full"
                                    style={{ height: `${h * 70}%` }}
                                  />
                                ))}
                              </div>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="text-xs">
                            <p className="font-medium">{clip.label}</p>
                            <p className="text-muted-foreground">
                              {formatTime(clip.startTime)} - {formatTime(clip.startTime + clip.duration)}
                            </p>
                            {clip.text && <p className="mt-1 max-w-48 truncate">{clip.text}</p>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              ))}

              {/* 播放头 */}
              <div
                className={cn(
                  "absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none",
                  isPlaying && "playhead-glow"
                )}
                style={{ left: internalTime * pixelsPerSecond }}
              >
                {/* 播放头顶部三角 */}
                <div className="absolute -top-[22px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-red-500" />
                {/* 时间指示 */}
                {isPlaying && (
                  <div className="absolute -top-[38px] left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-red-500 rounded text-[9px] text-white font-mono whitespace-nowrap">
                    {formatTime(internalTime)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  )
}

// 生成 mock 轨道数据
export function generateMockTracks(totalDuration: number = 62): Track[] {
  // 生成随机波形
  const generateWaveform = (length: number) =>
    Array.from({ length }, () => Math.random() * 0.3 + 0.4)

  // 视频轨 - 连续的镜头片段
  const videoClips: TrackClip[] = []
  let videoTime = 0
  let shotIndex = 1
  while (videoTime < totalDuration) {
    const duration = Math.random() * 2 + 1.5
    if (videoTime + duration > totalDuration) break
    videoClips.push({
      id: `video_${shotIndex}`,
      trackType: "video",
      startTime: videoTime,
      duration,
      label: `shot_${String(shotIndex).padStart(3, "0")}`,
      shotId: `shot_${String(shotIndex).padStart(3, "0")}`,
    })
    videoTime += duration
    shotIndex++
  }

  // TTS轨 - 对白片段
  const ttsClips: TrackClip[] = []
  let ttsTime = 0.5
  let lineIndex = 1
  while (ttsTime < totalDuration - 2) {
    const duration = Math.random() * 2 + 1
    const gap = Math.random() * 3 + 0.5
    ttsClips.push({
      id: `tts_${lineIndex}`,
      trackType: "tts",
      startTime: ttsTime,
      duration,
      label: `台词 ${lineIndex}`,
      waveform: generateWaveform(30),
    })
    ttsTime += duration + gap
    lineIndex++
  }

  // BGM轨 - 背景音乐
  const bgmClips: TrackClip[] = [
    {
      id: "bgm_1",
      trackType: "bgm",
      startTime: 0,
      duration: totalDuration * 0.4,
      label: "开场BGM",
      waveform: generateWaveform(50),
    },
    {
      id: "bgm_2",
      trackType: "bgm",
      startTime: totalDuration * 0.45,
      duration: totalDuration * 0.55,
      label: "高潮BGM",
      waveform: generateWaveform(50),
    },
  ]

  // SFX轨 - 音效
  const sfxClips: TrackClip[] = []
  for (let i = 0; i < 8; i++) {
    const startTime = Math.random() * (totalDuration - 1)
    sfxClips.push({
      id: `sfx_${i}`,
      trackType: "sfx",
      startTime,
      duration: Math.random() * 0.5 + 0.2,
      label: ["脚步声", "门声", "风声", "环境音", "特效"][Math.floor(Math.random() * 5)],
    })
  }
  sfxClips.sort((a, b) => a.startTime - b.startTime)

  // 字幕轨
  const subtitleClips: TrackClip[] = ttsClips.map((tts, idx) => ({
    id: `sub_${idx}`,
    trackType: "subtitle",
    startTime: tts.startTime,
    duration: tts.duration,
    label: `字幕 ${idx + 1}`,
    text: "这是一段示例字幕文本...",
  }))

  return [
    { id: "video", type: "video", label: "视频轨", clips: videoClips },
    { id: "tts", type: "tts", label: "TTS轨", clips: ttsClips },
    { id: "bgm", type: "bgm", label: "BGM轨", clips: bgmClips },
    { id: "sfx", type: "sfx", label: "音效轨", clips: sfxClips },
    { id: "subtitle", type: "subtitle", label: "字幕轨", clips: subtitleClips },
  ]
}
