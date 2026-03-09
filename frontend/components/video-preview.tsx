"use client"

import { useCallback, useMemo } from "react"
import { Play, Pause, Grid3X3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { formatTimecode } from "@/lib/types"
import type { Shot, ShotProgressSummary } from "@/lib/types"

interface VideoPreviewProps {
  activeShot: Shot | null
  currentTime: number
  totalDuration: number
  isPlaying: boolean
  fps: number
  showSubtitles: boolean
  shotProgress?: ShotProgressSummary
  onPlay: () => void
  onPause: () => void
  onToggleSubtitles: () => void
}

export function VideoPreview({
  activeShot,
  currentTime,
  totalDuration,
  isPlaying,
  fps,
  showSubtitles,
  shotProgress,
  onPlay,
  onPause,
  onToggleSubtitles,
}: VideoPreviewProps) {
  const handlePlayPause = useCallback(() => {
    if (isPlaying) onPause()
    else onPlay()
  }, [isPlaying, onPlay, onPause])

  const timecodeDisplay = useMemo(
    () => `${formatTimecode(currentTime, fps)}/${formatTimecode(totalDuration, fps)}`,
    [currentTime, totalDuration, fps]
  )

  return (
    <div className="flex flex-1 flex-col bg-[#0a0a0a]">
      {/* Main preview canvas */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {activeShot ? (
          <div
            className="relative h-full w-full"
            style={{ backgroundColor: activeShot.thumbnailColor }}
          >
            {/* Shot label overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="text-xs font-medium text-foreground/80 bg-background/40 backdrop-blur-sm px-2 py-1 rounded">
                {activeShot.label}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-muted-foreground/50">预览区域</span>
          </div>
        )}
      </div>

      {/* Shot progress summary bar */}
      {shotProgress && (
        <div className="flex h-8 shrink-0 items-center justify-center border-t border-border/30 bg-[#0d0d0d]/50 px-4">
          <p className="text-[11px] text-muted-foreground">
            本集共
            <span className="text-foreground font-medium mx-0.5">{shotProgress.total}</span>
            个分镜，
            <span className="text-score-green font-medium mx-0.5">{shotProgress.approved}</span>
            个审阅通过，
            <span className="text-score-yellow font-medium mx-0.5">{shotProgress.inProgress}</span>
            个修改中，
            <span className="text-muted-foreground font-medium mx-0.5">{shotProgress.pending}</span>
            个待审阅。
            原始素材共
            <span className="text-foreground font-medium mx-0.5">{shotProgress.totalRawDuration}s</span>
            ，预计剪辑版
            <span className="text-foreground font-medium mx-0.5">{shotProgress.estimatedEditDuration}s</span>
          </p>
        </div>
      )}

      {/* Transport bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-t border-border/30 bg-[#0d0d0d] px-4">
        {/* Left: subtitle toggle */}
        <div className="flex items-center gap-2">
          <Label htmlFor="subtitle-toggle" className="text-xs text-muted-foreground cursor-pointer">
            字幕
          </Label>
          <Switch
            id="subtitle-toggle"
            checked={showSubtitles}
            onCheckedChange={onToggleSubtitles}
            className="h-4 w-7 data-[state=checked]:bg-primary"
          />
        </div>

        {/* Center: play + timecode */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-foreground hover:bg-secondary"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {timecodeDisplay}
          </span>
        </div>

        {/* Right: storyboard view */}
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Grid3X3 className="h-3.5 w-3.5" />
          故事版图
        </Button>
      </div>
    </div>
  )
}
