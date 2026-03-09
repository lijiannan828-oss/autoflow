"use client"

import { useRef, useEffect } from "react"
import { Check, X, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDurationChinese } from "@/lib/final-types"
import type { FinalEpisode } from "@/lib/final-types"

interface EpisodeStripProps {
  episodes: FinalEpisode[]
  currentEpisodeId: string
  onSelectEpisode: (id: string) => void
}

export function EpisodeStrip({
  episodes,
  currentEpisodeId,
  onSelectEpisode,
}: EpisodeStripProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Scroll active episode into view
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current
      const active = activeRef.current
      const containerRect = container.getBoundingClientRect()
      const activeRect = active.getBoundingClientRect()

      if (activeRect.left < containerRect.left || activeRect.right > containerRect.right) {
        active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      }
    }
  }, [currentEpisodeId])

  return (
    <div className="h-[140px] shrink-0 border-t border-border/50 bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex h-8 items-center justify-between border-b border-border/30 px-4">
        <span className="text-xs font-medium text-muted-foreground">剧集列表</span>
        <span className="text-[10px] text-muted-foreground">
          {episodes.length} 集
        </span>
      </div>

      {/* Scrollable episode cards */}
      <div
        ref={containerRef}
        className="flex h-[108px] items-center gap-2 overflow-x-auto px-4 py-2 scrollbar-thin"
      >
        {episodes.map((ep) => {
          const isActive = ep.id === currentEpisodeId
          const isApproved = ep.status === "approved"
          const isRejected = ep.status === "rejected"
          const isPending = ep.status === "pending" || ep.status === "in-progress"

          return (
            <button
              key={ep.id}
              ref={isActive ? activeRef : null}
              onClick={() => onSelectEpisode(ep.id)}
              className={cn(
                "group relative flex h-[88px] w-[120px] shrink-0 flex-col rounded-lg overflow-hidden transition-all",
                isActive
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  : "hover:ring-1 hover:ring-border"
              )}
            >
              {/* Thumbnail */}
              <div
                className="flex-1 relative"
                style={{ backgroundColor: ep.thumbnailColor }}
              >
                {/* Status indicator - top left */}
                <div className="absolute top-1.5 left-1.5">
                  {isApproved && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-score-green">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                  {isRejected && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive">
                      <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                  {isPending && (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary border border-border/80">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Revision badge */}
                {ep.isRevision && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-score-yellow/80 text-[9px] font-medium text-background">
                    修改版
                  </div>
                )}
              </div>

              {/* Info bar */}
              <div
                className={cn(
                  "flex h-6 items-center justify-between px-2",
                  isApproved && "bg-score-green/20",
                  isRejected && "bg-destructive/20",
                  isPending && "bg-secondary/60"
                )}
              >
                <span className="text-[10px] font-medium text-foreground">{ep.title}</span>
                <span className="text-[9px] text-muted-foreground">
                  {formatDurationChinese(ep.duration)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
