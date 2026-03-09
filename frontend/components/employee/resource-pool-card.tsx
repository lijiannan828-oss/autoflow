"use client"

import { Users, Film } from "lucide-react"
import type { ResourcePoolOverview } from "@/lib/employee-types"

interface ResourcePoolCardProps {
  data: ResourcePoolOverview
}

export function ResourcePoolCard({ data }: ResourcePoolCardProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
          <Users className="h-4 w-4 text-emerald-400" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">资源池概览</span>
      </div>

      {/* Main metrics */}
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-lg font-medium text-foreground">近{data.periodDays}日活跃人员：</span>
        <span className="text-2xl font-bold text-emerald-400">{data.activeQACount}</span>
        <span className="text-sm text-muted-foreground">位质检员</span>
        <span className="text-muted-foreground mx-2">|</span>
        <span className="text-2xl font-bold text-blue-400">{data.activeHubEditorCount}</span>
        <span className="text-sm text-muted-foreground">位中台剪辑</span>
      </div>

      {/* Workload info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2">
        <Film className="h-3.5 w-3.5" />
        <span>当前审核池总负荷：</span>
        <span className="text-foreground font-medium">{data.totalDramas} 部剧</span>
        <span>/</span>
        <span className="text-foreground font-medium">{data.totalEpisodes} 集</span>
      </div>
    </div>
  )
}
