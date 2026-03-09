"use client"

import { Play, Pause, SkipBack, SkipForward, Film, X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatLongTimecode, formatDurationChinese } from "@/lib/final-types"
import type { FinalEpisode, ReviewStageInfo } from "@/lib/final-types"
import { ReviewProgressTracker } from "./review-progress-tracker"

interface FinalVideoPlayerProps {
  currentEpisode: FinalEpisode
  currentTime: number
  totalSeriesDuration: number
  isPlaying: boolean
  reviewStages: ReviewStageInfo[]
  onPlay: () => void
  onPause: () => void
  onStepBackward: () => void
  onStepForward: () => void
  onReject: () => void
  onApprove: () => void
}

export function FinalVideoPlayer({
  currentEpisode,
  currentTime,
  totalSeriesDuration,
  isPlaying,
  reviewStages,
  onPlay,
  onPause,
  onStepBackward,
  onStepForward,
  onReject,
  onApprove,
}: FinalVideoPlayerProps) {
  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* Main video area */}
      <div className="flex flex-1 items-center justify-center p-6 pb-2">
        <div className="relative w-full max-w-4xl aspect-video rounded-lg overflow-hidden bg-[#1a1a1a] shadow-2xl">
          {/* Video content placeholder */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: currentEpisode.thumbnailColor }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
          </div>

          {/* Episode label overlay */}
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded bg-black/60 backdrop-blur-sm">
            <span className="text-sm font-medium text-white">{currentEpisode.title}</span>
            {currentEpisode.isRevision && (
              <span className="ml-2 text-xs text-score-yellow">
                (修改版 v{currentEpisode.revisionCount + 1})
              </span>
            )}
          </div>

          {/* Centered play icon placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="h-16 w-16 text-white/20" />
          </div>
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex h-12 shrink-0 items-center justify-between bg-[#0d0d0d] px-6">
        {/* Left spacer for balance */}
        <div className="w-32" />

        {/* Center: playback controls */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onStepBackward}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>

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
            <span className="text-foreground">{formatLongTimecode(currentTime)}</span>
            <span className="mx-1 text-border">/</span>
            <span>{formatLongTimecode(currentEpisode.duration)}</span>
          </div>
        </div>

        {/* Right: total series duration */}
        <div className="w-32 text-right text-xs text-muted-foreground">
          <span>本剧总时长 </span>
          <span className="text-foreground">{formatDurationChinese(totalSeriesDuration)}</span>
        </div>
      </div>

      {/* Review progress tracker */}
      <ReviewProgressTracker stages={reviewStages} />

      {/* Decision buttons */}
      <div className="flex h-14 shrink-0 items-center justify-center gap-4 border-t border-border/30 bg-[#0d0d0d] px-4">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-5 text-sm border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onReject}
        >
          <X className="h-4 w-4" />
          驳回修改
        </Button>

        <Button
          size="sm"
          className="h-9 gap-2 px-6 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={onApprove}
        >
          <CheckCircle2 className="h-4 w-4" />
          本集通过
        </Button>
      </div>
    </div>
  )
}
