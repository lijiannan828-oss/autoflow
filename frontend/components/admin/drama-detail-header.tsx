"use client"

import { ArrowLeft, Globe, Film, Clock, DollarSign, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PipelineMode, DramaDetailData } from "@/lib/drama-detail-types"

interface DramaDetailHeaderProps {
  data: DramaDetailData
  mode: PipelineMode
  onModeChange: (mode: PipelineMode) => void
  onBack: () => void
}

export function DramaDetailHeader({
  data,
  mode,
  onModeChange,
  onBack,
}: DramaDetailHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border/50 bg-background">
      {/* Top row: back, title, stats */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回
          </Button>
          <div className="h-4 w-px bg-border/40" />
          <span className="text-sm font-semibold text-foreground">{data.title}</span>
          <span className="text-xs text-muted-foreground">共{data.totalEpisodes}集</span>
        </div>

        {/* Stats badges */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
            <span>已完成 {data.completedEpisodes}/{data.totalEpisodes}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>累计耗时 {data.totalDuration}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            <span>总成本 ${data.totalCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Second row: mode tabs */}
      <div className="flex h-10 items-center px-4 gap-2">
        <button
          onClick={() => onModeChange("global")}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
            ${mode === "global" 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }
          `}
        >
          <Globe className="h-3.5 w-3.5" />
          全局基建
          <span className="text-[10px] text-muted-foreground ml-1">节点 1-3</span>
        </button>
        <button
          onClick={() => onModeChange("episode")}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
            ${mode === "episode" 
              ? "bg-blue-500/10 text-blue-400 border border-blue-500/30" 
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }
          `}
        >
          <Film className="h-3.5 w-3.5" />
          分集流水线
          <span className="text-[10px] text-muted-foreground ml-1">节点 4-24</span>
        </button>
      </div>
    </header>
  )
}
