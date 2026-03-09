"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"

import { AdminNavSidebar } from "@/components/admin/admin-nav-sidebar"
import { AIInsightsBanner } from "@/components/data-center/ai-insights-banner"
import { DataFilterBar } from "@/components/data-center/data-filter-bar"
import { KPIBentoCards } from "@/components/data-center/kpi-bento-cards"
import { CostTrendChart } from "@/components/data-center/cost-trend-chart"
import { PhaseBreakdownChart } from "@/components/data-center/phase-breakdown-chart"
import { GranularDataTables } from "@/components/data-center/granular-data-tables"

import {
  aiInsightText,
  coreKPIs,
  trendData,
  phaseBreakdown,
  episodeData,
  modelConsumption,
  dramaList,
} from "@/lib/data-center-mock-data"
import type { TimeRange } from "@/lib/data-center-types"

export default function DataCenterPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d")
  const [selectedDrama, setSelectedDrama] = useState("all")

  const handleExport = useCallback(() => {
    toast.success("正在导出数据报表...")
  }, [])

  return (
    <div className="flex h-screen bg-background">
      {/* Global left navigation sidebar */}
      <AdminNavSidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="flex h-12 items-center justify-between px-6">
            <span className="text-sm font-medium text-foreground">全局生产数据中心</span>

            <div className="flex items-center gap-2">
              {/* User identity badge */}
              <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-2.5 py-1">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] font-bold text-red-400">
                  A
                </div>
                <span className="text-[11px] font-medium text-foreground">超级管理员</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* AI Insights Banner */}
          <AIInsightsBanner insight={aiInsightText} />

          {/* Filter Bar */}
          <DataFilterBar
            timeRange={timeRange}
            selectedDrama={selectedDrama}
            dramaOptions={dramaList}
            onTimeRangeChange={setTimeRange}
            onDramaChange={setSelectedDrama}
            onExport={handleExport}
          />

          {/* KPI Bento Cards */}
          <KPIBentoCards kpis={coreKPIs} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CostTrendChart data={trendData} budgetLine={200} />
            <PhaseBreakdownChart data={phaseBreakdown} />
          </div>

          {/* Granular Data Tables */}
          <GranularDataTables episodeData={episodeData} modelData={modelConsumption} />
        </main>
      </div>
    </div>
  )
}
