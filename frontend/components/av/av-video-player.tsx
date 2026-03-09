"use client"

import { Play, Pause, SkipBack, SkipForward, Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatNLETimecode } from "@/lib/av-types"
import type { VideoClip, SubtitleClip } from "@/lib/av-types"

interface AVVideoPlayerProps {
  currentTime: number
  totalDuration: number
  fps: number
  isPlaying: boolean
  activeVideoClip: VideoClip | null
  activeSubtitle: SubtitleClip | null
  onPlay: () => void
  onPause: () => void
  onStepBackward: () => void
  onStepForward: () => void
}

export function AVVideoPlayer({
  currentTime,
  totalDuration,
  fps,
  isPlaying,
  activeVideoClip,
  activeSubtitle,
  onPlay,
  onPause,
  onStepBackward,
  onStepForward,
}: AVVideoPlayerProps) {
  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* Video canvas area - takes up available space */}
      <div className="flex flex-1 items-center justify-center p-4 pb-2">
        {/* 9:16 vertical video placeholder */}
        <div className="relative aspect-[9/16] h-full max-h-full rounded-lg overflow-hidden bg-[#1a1a1a] shadow-2xl">
          {/* Video content placeholder */}
          {activeVideoClip ? (
            <div
              className="absolute inset-0"
              style={{ backgroundColor: activeVideoClip.thumbnailColor }}
            >
              {/* Simulated video frame */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
              
              {/* Shot label overlay */}
              <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/50 text-[11px] font-medium text-white">
                {activeVideoClip.name}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Film className="h-12 w-12 text-muted-foreground/30" />
              <span className="text-muted-foreground text-sm">视频预览区</span>
            </div>
          )}

          {/* Subtitle overlay */}
          {activeSubtitle && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%]">
              <div className="bg-black/70 backdrop-blur-sm rounded px-3 py-2 text-center">
                {activeSubtitle.speaker && (
                  <span className="text-[10px] text-emerald-400 block mb-0.5">
                    {activeSubtitle.speaker}
                  </span>
                )}
                <span className="text-white text-sm leading-relaxed">{activeSubtitle.text}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transport controls - fixed at bottom, directly above timeline */}
      <div className="flex h-12 shrink-0 items-center justify-center gap-4 bg-[#0d0d0d] px-4">
        {/* Step backward */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onStepBackward}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>

        {/* Play/Pause - main play button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        {/* Step forward */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onStepForward}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>

        {/* Timecode display */}
        <div className="ml-3 font-mono text-xs text-muted-foreground">
          <span className="text-foreground">{formatNLETimecode(currentTime, fps)}</span>
          <span className="mx-1 text-border">/</span>
          <span>{formatNLETimecode(totalDuration, fps)}</span>
        </div>
      </div>
    </div>
  )
}
