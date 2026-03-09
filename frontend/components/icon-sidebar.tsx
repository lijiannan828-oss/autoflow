"use client"

import { Check, Clock, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Episode } from "@/lib/types"

interface IconSidebarProps {
  episodes: Episode[]
  activeEpisodeId: string
  onSelectEpisode: (id: string) => void
}

export function IconSidebar({ episodes, activeEpisodeId, onSelectEpisode }: IconSidebarProps) {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-border/50 bg-[#0d0d0d] py-3">
      {/* Logo - artistic "L" */}
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
        <span
          className="text-xl font-bold text-primary leading-none"
          style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: "italic" }}
        >
          L
        </span>
      </div>

      {/* Divider */}
      <div className="mb-3 h-px w-6 bg-border/50" />

      {/* Episode list */}
      <nav className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {episodes.map((ep, i) => {
          const isActive = ep.id === activeEpisodeId
          return (
            <button
              key={ep.id}
              onClick={() => onSelectEpisode(ep.id)}
              className={cn(
                "group relative flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition-all",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
              title={ep.title}
            >
              {/* Number */}
              <span className="text-[11px] font-bold">{i + 1}</span>

              {/* Status badge - positioned top-right */}
              <div className="absolute -top-0.5 -right-0.5">
                {ep.status === "approved" && (
                  <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-score-green">
                    <Check className="h-2 w-2 text-background" strokeWidth={3} />
                  </div>
                )}
                {ep.status === "pending" && (
                  <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-secondary border border-border/80">
                    <Clock className="h-2 w-2 text-muted-foreground" />
                  </div>
                )}
                {ep.status === "in-progress" && (
                  <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-score-yellow/20 border border-score-yellow/50">
                    <Loader2 className="h-2 w-2 text-score-yellow animate-spin" />
                  </div>
                )}
              </div>

              {/* Active indicator left bar */}
              {isActive && (
                <div className="absolute -left-[7px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}

              {/* Tooltip */}
              <div className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
                {ep.title}
                <span className="ml-1.5 text-muted-foreground">({ep.shotCount}镜)</span>
                <span className="ml-1.5 text-[10px]">
                  {ep.status === "approved" && <span className="text-score-green">已通过</span>}
                  {ep.status === "pending" && <span className="text-muted-foreground">待审</span>}
                  {ep.status === "in-progress" && <span className="text-score-yellow">处理中</span>}
                </span>
              </div>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
