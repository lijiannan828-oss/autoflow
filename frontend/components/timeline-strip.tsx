"use client"

import { useRef, useCallback, useEffect } from "react"
import { Video, Copy, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Shot, SelectedShotId } from "@/lib/types"

interface TimelineStripProps {
  shots: Shot[]
  selectedShotId: SelectedShotId
  currentTime: number
  onSelectShot: (id: string) => void
  onSeek: (time: number) => void
}

export function TimelineStrip({ shots, selectedShotId, currentTime, onSelectShot, onSeek }: TimelineStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to keep selected shot visible
  useEffect(() => {
    if (!selectedShotId || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-shot-id="${selectedShotId}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }
  }, [selectedShotId])

  // Calculate which shot the playhead is on
  const getPlayheadShotIndex = useCallback(() => {
    let t = 0
    for (let i = 0; i < shots.length; i++) {
      const dur = shots[i].outPoint - shots[i].inPoint
      if (currentTime >= t && currentTime < t + dur) return i
      t += dur
    }
    return shots.length - 1
  }, [shots, currentTime])

  const playheadIndex = getPlayheadShotIndex()

  return (
    <div className="shrink-0 border-t border-border/50 bg-[#0d0d0d]">
      {/* Horizontal scrollable shot thumbnails */}
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto px-3 py-2.5"
        style={{ scrollbarWidth: "thin" }}
      >
        {shots.map((shot, i) => {
          const isSelected = shot.id === selectedShotId
          const isPlayheadHere = i === playheadIndex

          return (
            <div
              key={shot.id}
              data-shot-id={shot.id}
              className={cn(
                "group relative shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition-all",
                isSelected
                  ? "border-primary ring-1 ring-primary/30"
                  : isPlayheadHere
                    ? "border-foreground/30"
                    : "border-transparent hover:border-border/60"
              )}
              style={{ width: 140 }}
              onClick={() => onSelectShot(shot.id)}
            >
              {/* Thumbnail */}
              <div
                className="aspect-video w-full"
                style={{ backgroundColor: shot.thumbnailColor }}
              />

              {/* Bottom bar with shot info */}
              <div className="flex items-center justify-between bg-[#1a1a1a] px-2 py-1">
                <div className="flex items-center gap-1">
                  <Video className="h-3 w-3 text-muted-foreground/60" />
                  <span className="text-[10px] text-muted-foreground">{shot.label}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {shot.estimatedDuration.toFixed(0).padStart(2, "0")}:{String(Math.round((shot.estimatedDuration % 1) * 100)).padStart(2, "0")}
                </span>
              </div>

              {/* Hover action icons */}
              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="flex h-5 w-5 items-center justify-center rounded bg-background/60 backdrop-blur-sm text-foreground/70 hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
                <button className="flex h-5 w-5 items-center justify-center rounded bg-background/60 backdrop-blur-sm text-foreground/70 hover:text-foreground">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* Duration overlay on thumbnail */}
              <div className="absolute bottom-7 left-1.5">
                <span className="text-[9px] font-mono text-foreground/80 bg-background/50 backdrop-blur-sm px-1 rounded">
                  {shot.estimatedDuration.toFixed(1)}s
                </span>
              </div>

              {/* Playhead indicator */}
              {isPlayheadHere && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
