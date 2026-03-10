"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { 
  Clock, DollarSign, BarChart3, CheckCircle2, RotateCcw, 
  Layers, ChevronRight, Pause, X,
  Brain, Cpu, Shield, User, FileText, Zap, PieChart
} from "lucide-react"
import { DagView } from "./dag-view"
import { NodeDetailPanel } from "./node-panels"
import { 
  MOCK_NODES, 
  MOCK_EDGES, 
  STAGES, 
  MOCK_EPISODE_SUMMARY,
  type TraceNode 
} from "./mock-data"

type MetricType = "duration" | "cost" | "quality" | "returns" | null

export default function PipelinePreviewPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeMetricChart, setActiveMetricChart] = useState<MetricType>(null)
  
  const summary = MOCK_EPISODE_SUMMARY.summary
  const selectedNode = MOCK_NODES.find(n => n.node_id === selectedNodeId) || null
  const runningNode = MOCK_NODES.find(n => n.status === "running")

  // 计算各决策层级的节点数
  const levelCounts = {
    planning: MOCK_NODES.filter(n => n.decision_level === "planning").length,
    execution: MOCK_NODES.filter(n => n.decision_level === "execution").length,
    review: MOCK_NODES.filter(n => n.decision_level === "review").length,
    gate: MOCK_NODES.filter(n => n.decision_level === "gate").length,
    freeze: MOCK_NODES.filter(n => n.decision_level === "freeze").length,
    compose: MOCK_NODES.filter(n => n.decision_level === "compose").length,
  }

  // 按 Stage 计算统计数据
  const stageStats = STAGES.map(stage => {
    const stageNodes = MOCK_NODES.filter(n => stage.nodes.includes(n.node_id))
    return {
      stage: stage.stage,
      label: stage.label,
      cost: stageNodes.reduce((sum, n) => sum + n.cost_cny, 0),
      duration: stageNodes.reduce((sum, n) => sum + (n.duration_seconds || 0), 0),
      avgQuality: stageNodes.filter(n => n.quality_score).length > 0
        ? stageNodes.filter(n => n.quality_score).reduce((sum, n) => sum + (n.quality_score || 0), 0) / stageNodes.filter(n => n.quality_score).length
        : 0,
      returns: stageNodes.filter(n => n.status === "gate_rejected").length,
    }
  })

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          A区: 顶部信息栏
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-xl">
        {/* Breadcrumb */}
        <div className="px-6 py-2 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="w-4 h-4 text-primary" />
            <span className="hover:text-foreground cursor-pointer transition-colors">Pipeline</span>
            <ChevronRight className="w-3 h-3" />
            <span className="hover:text-foreground cursor-pointer transition-colors">{MOCK_EPISODE_SUMMARY.project_name}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Ep.{MOCK_EPISODE_SUMMARY.episode_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
              Preview Mode
            </span>
          </div>
        </div>

        {/* Title + Stats */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  {MOCK_EPISODE_SUMMARY.project_name} - Ep.{MOCK_EPISODE_SUMMARY.episode_number}
                  <span className="text-xs font-normal text-muted-foreground">1:28</span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {MOCK_NODES[0].category === "llm" ? "古装宫廷" : "现代都市"} | 32 Shots | YouTube Shorts
                </p>
              </div>
              
              {/* Version tabs */}
              <div className="flex gap-1.5 ml-4">
                {MOCK_EPISODE_SUMMARY.versions.map(v => (
                  <span
                    key={v.version_no}
                    className={cn(
                      "text-[10px] px-3 py-1 rounded-full border cursor-pointer transition-all",
                      v.is_current
                        ? "border-primary/50 bg-primary/15 text-primary font-medium"
                        : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    v{v.version_no}
                  </span>
                ))}
              </div>
            </div>

            {/* Running status */}
            {runningNode && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs text-blue-400 font-medium">Running</span>
                <span className="text-xs text-muted-foreground">
                  <span className="text-blue-300 font-mono">{runningNode.node_id}</span> {runningNode.node_name}
                </span>
                <button className="ml-2 p-1 rounded hover:bg-blue-500/20 transition-colors">
                  <Pause className="w-3.5 h-3.5 text-blue-400" />
                </button>
              </div>
            )}
          </div>

          {/* Stats cards - 可点击展示饼图 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard
              icon={Clock}
              label="Total Duration"
              value={formatDuration(summary.total_duration_seconds)}
              warn={summary.total_duration_seconds > 7200}
              onClick={() => setActiveMetricChart(activeMetricChart === "duration" ? null : "duration")}
              active={activeMetricChart === "duration"}
            />
            <StatCard
              icon={DollarSign}
              label="Total Cost"
              value={`CNY ${summary.total_cost_cny.toFixed(2)}`}
              subtitle="Budget: CNY 20"
              warn={summary.total_cost_cny > 20}
              danger={summary.total_cost_cny > 30}
              onClick={() => setActiveMetricChart(activeMetricChart === "cost" ? null : "cost")}
              active={activeMetricChart === "cost"}
            />
            <StatCard
              icon={Zap}
              label="Avg Quality"
              value={summary.avg_quality_score > 0 ? summary.avg_quality_score.toFixed(1) : "-"}
              warn={summary.avg_quality_score > 0 && summary.avg_quality_score < 8}
              danger={summary.avg_quality_score > 0 && summary.avg_quality_score < 7}
              onClick={() => setActiveMetricChart(activeMetricChart === "quality" ? null : "quality")}
              active={activeMetricChart === "quality"}
            />
            <StatCard
              icon={CheckCircle2}
              label="Completed"
              value={`${summary.completed_nodes}/${summary.total_nodes}`}
              progress={summary.completed_nodes / summary.total_nodes}
            />
            <StatCard
              icon={RotateCcw}
              label="Returns"
              value={summary.return_ticket_count.toString()}
              warn={summary.return_ticket_count > 0}
              danger={summary.return_ticket_count > 3}
              onClick={() => setActiveMetricChart(activeMetricChart === "returns" ? null : "returns")}
              active={activeMetricChart === "returns"}
            />
          </div>
        </div>

        {/* Decision Level Legend */}
        <div className="px-6 pb-3 flex items-center gap-4 text-[10px]">
          <span className="text-muted-foreground">Node Types:</span>
          <LegendItem icon={Brain} color="text-violet-400" label="Planning" count={levelCounts.planning} />
          <LegendItem icon={Cpu} color="text-blue-400" label="Execution" count={levelCounts.execution} />
          <LegendItem icon={Shield} color="text-amber-400" label="QC/Review" count={levelCounts.review} />
          <LegendItem icon={User} color="text-pink-400" label="Gate" count={levelCounts.gate} />
          <LegendItem icon={Layers} color="text-zinc-400" label="Freeze" count={levelCounts.freeze} />
          <LegendItem icon={FileText} color="text-cyan-400" label="Compose" count={levelCounts.compose} />
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          B区: 主内容区 (DAG + 右侧详情面板)
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="flex-1 min-h-0 flex">
        {/* DAG 流程图 */}
        <div className={cn(
          "flex-1 min-w-0 transition-all duration-300",
          selectedNode && "mr-0"
        )}>
          <DagView
            nodes={MOCK_NODES}
            edges={MOCK_EDGES}
            stages={STAGES}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
          />
        </div>

        {/* 右侧详情面板 */}
        {selectedNode && (
          <div className="w-[480px] shrink-0 border-l border-border/50 bg-card/95 backdrop-blur-xl overflow-hidden flex flex-col">
            <NodeDetailPanel
              node={selectedNode}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
      </main>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          饼图弹窗
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeMetricChart && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setActiveMetricChart(null)}>
          <div className="bg-card border border-border/50 rounded-2xl p-6 w-[500px] max-w-[90vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  {activeMetricChart === "cost" ? "Cost by Stage" : 
                   activeMetricChart === "duration" ? "Duration by Stage" :
                   activeMetricChart === "quality" ? "Quality by Stage" :
                   "Returns by Stage"}
                </h3>
              </div>
              <button onClick={() => setActiveMetricChart(null)} className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* 简易饼图展示 */}
            <div className="flex gap-6">
              {/* 饼图 */}
              <div className="relative w-48 h-48">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {renderPieChart(stageStats, activeMetricChart)}
                </svg>
              </div>
              
              {/* 图例 */}
              <div className="flex-1 space-y-2">
                {stageStats.map((stage, i) => {
                  const value = activeMetricChart === "cost" ? stage.cost :
                               activeMetricChart === "duration" ? stage.duration :
                               activeMetricChart === "quality" ? stage.avgQuality :
                               stage.returns
                  const total = stageStats.reduce((sum, s) => sum + (
                    activeMetricChart === "cost" ? s.cost :
                    activeMetricChart === "duration" ? s.duration :
                    activeMetricChart === "quality" ? s.avgQuality :
                    s.returns
                  ), 0)
                  const percent = total > 0 ? (value / total * 100).toFixed(1) : "0"
                  const colors = ["#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#EC4899", "#06B6D4"]
                  
                  return (
                    <div key={stage.stage} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[i] }} />
                        <span className="text-muted-foreground">Stage {stage.stage}</span>
                        <span className="text-foreground/80">{stage.label.split(" ")[0]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-foreground">
                          {activeMetricChart === "cost" ? `CNY ${value.toFixed(2)}` :
                           activeMetricChart === "duration" ? formatDuration(value) :
                           activeMetricChart === "quality" ? (value > 0 ? value.toFixed(1) : "-") :
                           value}
                        </span>
                        <span className="text-xs text-muted-foreground w-12 text-right">{percent}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 辅助组件
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatCard({ icon: Icon, label, value, subtitle, warn, danger, progress, onClick, active }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subtitle?: string
  warn?: boolean
  danger?: boolean
  progress?: number
  onClick?: () => void
  active?: boolean
}) {
  return (
    <div 
      className={cn(
        "bg-card/50 backdrop-blur border rounded-xl px-4 py-3 transition-all",
        onClick && "cursor-pointer hover:bg-card/70",
        active ? "border-primary/50 bg-primary/10" : "border-border/30"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-3.5 h-3.5", active ? "text-primary" : "text-muted-foreground")} />
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        {onClick && <PieChart className={cn("w-3 h-3 ml-auto", active ? "text-primary" : "text-muted-foreground/50")} />}
      </div>
      <div className="flex items-end justify-between">
        <p className={cn(
          "text-lg font-bold",
          danger ? "text-red-400" : warn ? "text-amber-400" : "text-foreground"
        )}>
          {value}
        </p>
        {subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}
      </div>
      {progress !== undefined && (
        <div className="mt-2 h-1 bg-secondary/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary/60 rounded-full transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

function LegendItem({ icon: Icon, color, label, count }: {
  icon: React.ComponentType<{ className?: string }>
  color: string
  label: string
  count: number
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("w-3 h-3", color)} />
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", color)}>{count}</span>
    </div>
  )
}

function renderPieChart(stageStats: { cost: number; duration: number; avgQuality: number; returns: number }[], metric: MetricType) {
  const colors = ["#8B5CF6", "#3B82F6", "#F59E0B", "#10B981", "#EC4899", "#06B6D4"]
  const values = stageStats.map(s => 
    metric === "cost" ? s.cost :
    metric === "duration" ? s.duration :
    metric === "quality" ? s.avgQuality :
    s.returns
  )
  const total = values.reduce((a, b) => a + b, 0)
  
  if (total === 0) {
    return <circle cx="50" cy="50" r="40" fill="hsl(var(--secondary))" />
  }

  const segments: React.ReactNode[] = []
  let currentAngle = 0

  values.forEach((value, i) => {
    if (value === 0) return
    const percent = value / total
    const angle = percent * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    
    const largeArc = angle > 180 ? 1 : 0
    const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
    const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
    const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
    const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)
    
    segments.push(
      <path
        key={i}
        d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
        fill={colors[i]}
        className="transition-all hover:opacity-80"
      />
    )
    
    currentAngle = endAngle
  })

  return segments
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const min = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  if (min < 60) return `${min}m${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h${min % 60}m`
}
