"use client"

import { Clock, ArrowRight } from "lucide-react"
import type { CycleMetrics } from "@/lib/employee-types"

interface CycleBreakdownCardProps {
  data: CycleMetrics
}

export function CycleBreakdownCard({ data }: CycleBreakdownCardProps) {
  const totalHours = data.stages.reduce((sum, s) => sum + s.hours, 0)

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
          <Clock className="h-4 w-4 text-blue-400" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">周期损耗拆解</span>
      </div>

      {/* Main metrics */}
      <div className="flex items-baseline gap-4 mb-4">
        <div>
          <span className="text-xs text-muted-foreground">平均成片质检完成周期</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{data.avgQACycleHours}</span>
            <span className="text-sm text-muted-foreground">小时</span>
          </div>
        </div>
        <div className="h-8 w-px bg-border/50" />
        <div>
          <span className="text-xs text-muted-foreground">总交付周期</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{data.avgTotalDeliveryHours}</span>
            <span className="text-sm text-muted-foreground">小时</span>
          </div>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div className="mb-3">
        <div className="flex h-6 w-full overflow-hidden rounded-lg">
          {data.stages.map((stage, idx) => {
            const widthPercent = (stage.hours / totalHours) * 100
            return (
              <div
                key={stage.name}
                className="h-full flex items-center justify-center text-[10px] font-medium text-white"
                style={{ 
                  width: `${widthPercent}%`, 
                  backgroundColor: stage.color,
                }}
                title={`${stage.name}: ${stage.hours}h`}
              >
                {widthPercent > 12 && `${stage.hours}h`}
              </div>
            )
          })}
        </div>
      </div>

      {/* Timeline legend */}
      <div className="flex items-center gap-1 flex-wrap">
        {data.stages.map((stage, idx) => (
          <div key={stage.name} className="flex items-center">
            {idx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground mx-1" />}
            <div className="flex items-center gap-1.5 rounded-md bg-secondary/30 px-2 py-1">
              <div 
                className="h-2 w-2 rounded-full" 
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-[11px] text-muted-foreground">
                {stage.name} <span className="text-foreground font-medium">({stage.hours}h)</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
