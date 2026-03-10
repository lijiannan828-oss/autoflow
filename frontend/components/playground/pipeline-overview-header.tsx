"use client"

import { cn } from "@/lib/utils"
import {
  Clock,
  DollarSign,
  Star,
  RotateCcw,
  Play,
  Pause,
  Link2,
  Unlink,
  FileText,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { PipelineExecutionState } from "@/app/playground/page"
import { NODE_SPECS, STAGE_GROUPS } from "@/lib/node-specs"
import { useState, useMemo } from "react"

// QC 节点 ID 列表
const QC_NODE_IDS = ["N03", "N11", "N12", "N15", "N16"]

// QC 维度配置
const QC_DIMENSIONS = {
  N03: { name: "分镜质检", dimensions: ["连贯性", "角色一致性", "场景描述", "节奏感", "情感表达"] },
  N11: { name: "关键帧质检", dimensions: ["角色一致性", "构图", "光影", "清晰度", "风格统一"] },
  N12: { name: "关键帧批量质检", dimensions: ["整体一致性", "风格统一", "光线连贯", "角色稳定"] },
  N15: { name: "视频质检", dimensions: ["运动流畅度", "时长准确度", "画面稳定性", "转场自然度"] },
  N16: { name: "视频节奏质检", dimensions: ["节奏匹配", "时长偏差", "转场流畅", "整体协调"] },
}

interface PipelineOverviewHeaderProps {
  state: PipelineExecutionState
  onInputScript: () => void
  onConnectAll: () => void
  onDisconnectAll: () => void
  onReset: () => void
  onPause: () => void
}

export function PipelineOverviewHeader({
  state,
  onInputScript,
  onConnectAll,
  onDisconnectAll,
  onReset,
  onPause,
}: PipelineOverviewHeaderProps) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showQCDetails, setShowQCDetails] = useState(false)

  // Calculate QC details by node and dimension
  const qcDetails = useMemo(() => {
    return QC_NODE_IDS.map((nodeId) => {
      const nodeData = state.nodes[nodeId]
      const config = QC_DIMENSIONS[nodeId as keyof typeof QC_DIMENSIONS]
      const score = nodeData?.qualityScore

      // Generate mock dimension scores if node is completed
      const dimensions = config.dimensions.map((dim) => ({
        name: dim,
        score: nodeData?.status === "completed" ? 7.5 + Math.random() * 2 : null,
      }))

      return {
        nodeId,
        name: config.name,
        overallScore: score,
        status: nodeData?.status || "idle",
        dimensions,
      }
    })
  }, [state.nodes])

  // Calculate overall dimension averages
  const dimensionAverages = useMemo(() => {
    const allDimensions: Record<string, number[]> = {}
    qcDetails.forEach((qc) => {
      qc.dimensions.forEach((dim) => {
        if (dim.score != null) {
          if (!allDimensions[dim.name]) allDimensions[dim.name] = []
          allDimensions[dim.name].push(dim.score)
        }
      })
    })

    return Object.entries(allDimensions).map(([name, scores]) => ({
      name,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      count: scores.length,
    }))
  }, [qcDetails])

  // Calculate stats by stage
  const stageStats = STAGE_GROUPS.map((group) => {
    const groupNodes = NODE_SPECS.filter((n) => group.nodeIds.includes(n.id))
    const completedNodes = groupNodes.filter((n) => state.nodes[n.id]?.status === "completed")
    const totalCost = groupNodes.reduce((sum, n) => sum + (state.nodes[n.id]?.costCny || 0), 0)
    const totalTime = groupNodes.reduce((sum, n) => sum + (state.nodes[n.id]?.durationMs || 0), 0)
    const scores = groupNodes
      .map((n) => state.nodes[n.id]?.qualityScore)
      .filter((s): s is number => s != null)
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    return {
      ...group,
      completed: completedNodes.length,
      total: groupNodes.length,
      cost: totalCost,
      time: totalTime,
      avgScore,
    }
  })

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur shrink-0">
      <div className="h-full px-4 flex items-center justify-between">
        {/* Left: Title + Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Pipeline Playground</h1>
              <p className="text-[10px] text-muted-foreground">26 节点调试面板</p>
            </div>
          </div>

          {/* Status indicator */}
          <div
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium",
              state.isRunning
                ? "bg-blue-500/20 text-blue-400"
                : state.isPaused
                  ? "bg-amber-500/20 text-amber-400"
                  : state.completedCount > 0
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-zinc-500/20 text-zinc-400"
            )}
          >
            {state.isRunning
              ? "运行中"
              : state.isPaused
                ? "已暂停"
                : state.completedCount > 0
                  ? `已完成 ${state.completedCount}/26`
                  : "就绪"}
          </div>
        </div>

        {/* Center: Metrics */}
        <div className="flex items-center gap-6">
          <MetricItem
            icon={Clock}
            label="总耗时"
            value={formatDuration(state.totalDurationMs)}
            onClick={() => setShowBreakdown((v) => !v)}
            hasDropdown
          />
          <MetricItem
            icon={DollarSign}
            label="总成本"
            value={`¥${state.totalCostCny.toFixed(2)}`}
            onClick={() => setShowBreakdown((v) => !v)}
            hasDropdown
          />
          <MetricItem
            icon={Star}
            label="质检均分"
            value={state.avgQualityScore > 0 ? state.avgQualityScore.toFixed(2) : "-"}
            color={
              state.avgQualityScore >= 9
                ? "text-emerald-400"
                : state.avgQualityScore >= 8
                  ? "text-foreground"
                  : state.avgQualityScore > 0
                    ? "text-amber-400"
                    : undefined
            }
            onClick={() => setShowQCDetails((v) => !v)}
            hasDropdown
          />
          <MetricItem
            icon={RotateCcw}
            label="打回次数"
            value={state.returnCount.toString()}
            color={state.returnCount > 0 ? "text-amber-400" : undefined}
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onInputScript}
            className="h-8 gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            输入剧本
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                连接
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onConnectAll}>
                <Link2 className="w-3.5 h-3.5 mr-2" />
                全部连接
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDisconnectAll}>
                <Unlink className="w-3.5 h-3.5 mr-2" />
                全部断开
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {state.isRunning || state.completedCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onPause}
              className="h-8 gap-1.5"
            >
              {state.isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  继续
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  暂停
                </>
              )}
            </Button>
          ) : null}

          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            重置
          </Button>
        </div>
      </div>

      {/* Breakdown dropdown */}
      {showBreakdown && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-[600px] bg-card border border-border rounded-lg shadow-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">按阶段分布</h3>
            <button
              onClick={() => setShowBreakdown(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              关闭
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {stageStats.map((stage) => (
              <div
                key={stage.id}
                className="bg-secondary/30 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">{stage.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {stage.completed}/{stage.total}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <p className="text-muted-foreground">耗时</p>
                    <p className="text-foreground">{formatDuration(stage.time)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">成本</p>
                    <p className="text-foreground">¥{stage.cost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">质量</p>
                    <p className="text-foreground">
                      {stage.avgScore > 0 ? stage.avgScore.toFixed(1) : "-"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QC Details dropdown */}
      {showQCDetails && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-[700px] bg-card border border-border rounded-lg shadow-xl p-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium">质检详情</h3>
              <p className="text-[10px] text-muted-foreground">所有质检环节各维度评分</p>
            </div>
            <button
              onClick={() => setShowQCDetails(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              关闭
            </button>
          </div>

          {/* Overall dimension averages */}
          {dimensionAverages.length > 0 && (
            <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="text-xs font-medium mb-2 text-primary">各维度综合均分</h4>
              <div className="flex flex-wrap gap-2">
                {dimensionAverages.map((dim) => (
                  <div
                    key={dim.name}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-[11px] font-medium",
                      dim.avgScore >= 9
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : dim.avgScore >= 8
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    )}
                  >
                    {dim.name}: {dim.avgScore.toFixed(2)}
                    <span className="text-[9px] opacity-60 ml-1">({dim.count}次)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QC nodes breakdown */}
          <div className="space-y-3">
            {qcDetails.map((qc) => (
              <div
                key={qc.nodeId}
                className={cn(
                  "p-3 rounded-lg border",
                  qc.status === "completed"
                    ? "bg-secondary/30 border-border"
                    : "bg-secondary/10 border-border/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">{qc.nodeId}</span>
                    <span className="text-xs font-medium">{qc.name}</span>
                    {qc.status !== "completed" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-400">
                        {qc.status === "idle" ? "未运行" : qc.status === "running" ? "运行中" : qc.status}
                      </span>
                    )}
                  </div>
                  {qc.overallScore != null && (
                    <span
                      className={cn(
                        "text-sm font-bold",
                        qc.overallScore >= 9
                          ? "text-emerald-400"
                          : qc.overallScore >= 8
                            ? "text-foreground"
                            : "text-amber-400"
                      )}
                    >
                      {qc.overallScore.toFixed(2)}
                    </span>
                  )}
                </div>
                {qc.status === "completed" && (
                  <div className="grid grid-cols-5 gap-2">
                    {qc.dimensions.map((dim) => (
                      <div key={dim.name} className="text-center">
                        <p className="text-[9px] text-muted-foreground mb-1 truncate" title={dim.name}>
                          {dim.name}
                        </p>
                        <p
                          className={cn(
                            "text-xs font-medium",
                            dim.score != null && dim.score >= 9
                              ? "text-emerald-400"
                              : dim.score != null && dim.score >= 8
                                ? "text-foreground"
                                : dim.score != null
                                  ? "text-amber-400"
                                  : "text-muted-foreground"
                          )}
                        >
                          {dim.score != null ? dim.score.toFixed(1) : "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}

function MetricItem({
  icon: Icon,
  label,
  value,
  color,
  onClick,
  hasDropdown,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  color?: string
  onClick?: () => void
  hasDropdown?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-md transition-colors",
        onClick && "hover:bg-secondary/50 cursor-pointer"
      )}
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div className="text-left">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-medium", color || "text-foreground")}>{value}</p>
      </div>
      {hasDropdown && <ChevronDown className="w-3 h-3 text-muted-foreground" />}
    </button>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}
