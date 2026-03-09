"use client"

import { Check, X, Loader2, Clock } from "lucide-react"
import type { EpisodeInstance } from "@/lib/drama-detail-types"

interface EpisodeInstanceStripProps {
  episodes: EpisodeInstance[]
  selectedEpisodeId: string | null
  onSelectEpisode: (episode: EpisodeInstance) => void
}

export function EpisodeInstanceStrip({
  episodes,
  selectedEpisodeId,
  onSelectEpisode,
}: EpisodeInstanceStripProps) {
  const getStatusIcon = (status: EpisodeInstance["status"]) => {
    switch (status) {
      case "completed":
        return <Check className="h-3 w-3 text-emerald-500" />
      case "running":
        return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
      case "failed":
        return <X className="h-3 w-3 text-red-500" />
      case "pending":
      case "queued":
        return <Clock className="h-3 w-3 text-muted-foreground" />
      default:
        return null
    }
  }

  const getStatusBorder = (status: EpisodeInstance["status"], isSelected: boolean) => {
    if (isSelected) return "border-white"
    switch (status) {
      case "completed": return "border-emerald-500/50"
      case "running": return "border-blue-500/50"
      case "failed": return "border-red-500/50"
      default: return "border-border/50"
    }
  }

  const getStatusBg = (status: EpisodeInstance["status"], isSelected: boolean) => {
    if (isSelected) return "bg-white/10"
    switch (status) {
      case "completed": return "bg-emerald-500/10"
      case "running": return "bg-blue-500/10"
      case "failed": return "bg-red-500/10"
      default: return "bg-secondary/30"
    }
  }

  return (
    <div className="shrink-0 border-b border-border/50 bg-[#0d0d0d] px-4 py-2">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent pb-1">
        {episodes.map((episode) => {
          const isSelected = episode.id === selectedEpisodeId
          return (
            <button
              key={episode.id}
              onClick={() => onSelectEpisode(episode)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium
                transition-all shrink-0
                ${getStatusBorder(episode.status, isSelected)}
                ${getStatusBg(episode.status, isSelected)}
                ${isSelected ? "ring-1 ring-white/30" : "hover:bg-secondary/50"}
              `}
            >
              {getStatusIcon(episode.status)}
              <span className={isSelected ? "text-foreground" : "text-muted-foreground"}>
                第{episode.episodeNumber}集
              </span>
              {episode.status === "failed" && episode.errorNode && (
                <span className="text-[10px] text-red-400 ml-0.5">
                  @{episode.errorNode}
                </span>
              )}
              {episode.status === "running" && episode.currentNode && (
                <span className="text-[10px] text-blue-400 ml-0.5">
                  @{episode.currentNode}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
