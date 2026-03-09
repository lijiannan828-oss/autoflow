"use client"

import { TrendingUp, TrendingDown, Clock, DollarSign, Shield, BarChart3 } from "lucide-react"
import type { CoreKPIs } from "@/lib/data-center-types"

interface KPIBentoCardsProps {
  kpis: CoreKPIs
}

function DeltaBadge({ value, inverted = false }: { value: number; inverted?: boolean }) {
  // For some metrics, negative is good (e.g., cost, time)
  const isPositive = inverted ? value < 0 : value > 0
  const Icon = isPositive ? TrendingUp : TrendingDown
  const colorClass = isPositive ? "text-emerald-400" : "text-red-400"
  
  return (
    <div className={`flex items-center gap-0.5 text-xs ${colorClass}`}>
      <Icon className="h-3 w-3" />
      <span>{Math.abs(value).toFixed(1)}%</span>
    </div>
  )
}

// Mini stacked bar for efficiency breakdown
function EfficiencyBreakdown({ breakdown }: { breakdown: CoreKPIs["efficiency"]["phaseBreakdown"] }) {
  const colors = [
    "bg-blue-500",
    "bg-purple-500", 
    "bg-amber-500",
    "bg-emerald-500",
    "bg-pink-500",
  ]

  return (
    <div className="mt-3 space-y-2">
      {/* Stacked bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/50">
        {breakdown.map((item, idx) => (
          <div
            key={item.phase}
            className={`h-full ${colors[idx]}`}
            style={{ width: `${item.percentage}%` }}
            title={`${item.phase}: ${item.percentage}%`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {breakdown.map((item, idx) => (
          <div key={item.phase} className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${colors[idx]}`} />
            <span className="text-[10px] text-muted-foreground">{item.phase}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Cost breakdown similar to efficiency breakdown
function CostBreakdown({ breakdown }: { breakdown: CoreKPIs["cost"]["phaseBreakdown"] }) {
  const colors = [
    "bg-blue-500",
    "bg-purple-500", 
    "bg-amber-500",
    "bg-emerald-500",
    "bg-pink-500",
  ]

  return (
    <div className="mt-3 space-y-2">
      {/* Stacked bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/50">
        {breakdown.map((item, idx) => (
          <div
            key={item.phase}
            className={`h-full ${colors[idx]}`}
            style={{ width: `${item.percentage}%` }}
            title={`${item.phase}: ${item.cost}元 (${item.percentage}%)`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {breakdown.map((item, idx) => (
          <div key={item.phase} className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${colors[idx]}`} />
            <span className="text-[10px] text-muted-foreground">{item.phase}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function KPIBentoCards({ kpis }: KPIBentoCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Scale Card */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
              <BarChart3 className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">规模</span>
          </div>
          <DeltaBadge value={kpis.scale.deltaPercent} />
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{kpis.scale.totalDramas}</span>
            <span className="text-sm text-muted-foreground">部剧集</span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{kpis.scale.totalEpisodes} 集</span>
            <span>{kpis.scale.totalMinutes.toLocaleString()} 分钟</span>
          </div>
        </div>
      </div>

      {/* Efficiency Card */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20">
              <Clock className="h-4 w-4 text-purple-400" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">效率</span>
          </div>
          <DeltaBadge value={kpis.efficiency.deltaPercent} inverted />
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{kpis.efficiency.avgMinutesPerOutput}</span>
            <span className="text-sm text-muted-foreground">分钟/成片分钟</span>
          </div>
          <EfficiencyBreakdown breakdown={kpis.efficiency.phaseBreakdown} />
        </div>
      </div>

      {/* Cost Card */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
              <DollarSign className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">成本</span>
          </div>
          <DeltaBadge value={kpis.cost.deltaPercent} inverted />
        </div>
        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{kpis.cost.avgCostPerMinute.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">元/分钟</span>
            <span className="text-xs text-muted-foreground ml-auto">红线 {kpis.cost.budgetLine}元</span>
          </div>
          <CostBreakdown breakdown={kpis.cost.phaseBreakdown} />
        </div>
      </div>

      {/* Quality Card */}
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">质量</span>
          </div>
          <DeltaBadge value={kpis.quality.deltaPercent} inverted />
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">{kpis.quality.avgHumanReviewMinutes}</span>
            <span className="text-sm text-muted-foreground">分钟/集审核</span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>人工修改 {kpis.quality.totalHumanEdits} 次</span>
            <span className="text-emerald-400">AI拦截 {kpis.quality.aiJudgeRejectCount} 次</span>
          </div>
        </div>
      </div>
    </div>
  )
}
