"use client"

import { Clock, DollarSign, User, TrendingDown, TrendingUp } from "lucide-react"
import type { GlobalMetrics } from "@/lib/admin-types"

interface GlobalMetricsHeaderProps {
  metrics: GlobalMetrics
}

export function GlobalMetricsHeader({ metrics }: GlobalMetricsHeaderProps) {
  return (
    <div className="space-y-4">
      {/* AI Summary Banner */}
      <div className="rounded-lg bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 p-4">
        <p className="text-sm">
          <span className="text-muted-foreground">当前生产中视频有 </span>
          <span className="text-emerald-400 font-bold text-lg">{metrics.totalProductions}</span>
          <span className="text-muted-foreground"> 个，其中 </span>
          <span className="text-emerald-400 font-semibold">{metrics.inQC}</span>
          <span className="text-muted-foreground"> 个已进入质检，</span>
          <span className="text-amber-400 font-semibold">{metrics.pendingQC}</span>
          <span className="text-muted-foreground"> 个待质检，</span>
          <span className="text-blue-400 font-semibold">{metrics.pendingAssets}</span>
          <span className="text-muted-foreground"> 个尚未确认美术资产。</span>
        </p>
      </div>

      {/* Unit Economics Dash */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          icon={Clock}
          label="平均生产耗时"
          value={`${metrics.avgProductionTime} 分钟`}
          unit="/ 分钟成片"
          trend={metrics.productionTimeTrend}
        />
        <MetricCard
          icon={DollarSign}
          label="平均算力成本"
          value={`¥${metrics.avgComputeCost}`}
          unit="/ 分钟成片"
          trend={metrics.computeCostTrend}
        />
        <MetricCard
          icon={User}
          label="平均人力质检"
          value={`${metrics.avgHumanTime} 分钟`}
          unit="/ 分钟成片"
          trend={metrics.humanTimeTrend}
        />
      </div>
    </div>
  )
}

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: string
  unit: string
  trend: number
}

function MetricCard({ icon: Icon, label, value, unit, trend }: MetricCardProps) {
  const isPositive = trend > 0
  const TrendIcon = isPositive ? TrendingUp : TrendingDown
  // For costs/time, negative trend is good (green)
  const trendColor = isPositive ? "text-red-400" : "text-emerald-400"

  return (
    <div className="rounded-lg bg-card border border-border/50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          <span>{Math.abs(trend)}%</span>
        </div>
      </div>
      <div className="mt-2">
        <span className="text-2xl font-bold text-foreground">{value}</span>
        <span className="text-xs text-muted-foreground ml-1">{unit}</span>
      </div>
      {/* Mini sparkline placeholder */}
      <div className="mt-2 h-6 flex items-end gap-0.5">
        {[40, 55, 45, 60, 50, 35, 30].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-emerald-500/30 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}
