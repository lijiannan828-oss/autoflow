"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { 
  Clock, DollarSign, BarChart3, CheckCircle2, RotateCcw, 
  Layers, ChevronRight, Play, Pause, RefreshCw, Settings,
  Brain, Cpu, Shield, User, FileText, GitBranch, Zap
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

export default function PipelinePreviewPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("N14")
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
            <span className="hover:text-foreground cursor-pointer transition-colors">管线总览</span>
            <ChevronRight className="w-3 h-3" />
            <span className="hover:text-foreground cursor-pointer transition-colors">{MOCK_EPISODE_SUMMARY.project_name}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">第{MOCK_EPISODE_SUMMARY.episode_number}集</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
              Preview Mode - 无需登录
            </span>
            <button className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title + Version + Status + Stats */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  {MOCK_EPISODE_SUMMARY.project_name} · 第{MOCK_EPISODE_SUMMARY.episode_number}集
                  <span className="text-xs font-normal text-muted-foreground">1:28</span>
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  古装宫廷 · 32镜头 · YouTube Shorts 2026Q2
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
                    v{v.version_no} {v.is_current && "●"}
                  </span>
                ))}
              </div>
            </div>

            {/* Running status */}
            {runningNode && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs text-blue-400 font-medium">运行中</span>
                <span className="text-xs text-muted-foreground">
                  当前节点 <span className="text-blue-300 font-mono">{runningNode.node_id}</span> {runningNode.node_name}
                </span>
                <button className="ml-2 p-1 rounded hover:bg-blue-500/20 transition-colors">
                  <Pause className="w-3.5 h-3.5 text-blue-400" />
                </button>
              </div>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard
              icon={Clock}
              label="总耗时"
              value={formatDuration(summary.total_duration_seconds)}
              warn={summary.total_duration_seconds > 7200}
            />
            <StatCard
              icon={DollarSign}
              label="总成本"
              value={`¥${summary.total_cost_cny.toFixed(2)}`}
              subtitle="预算 ¥20"
              warn={summary.total_cost_cny > 20}
              danger={summary.total_cost_cny > 30}
            />
            <StatCard
              icon={Zap}
              label="平均质量"
              value={summary.avg_quality_score > 0 ? summary.avg_quality_score.toFixed(1) : "—"}
              warn={summary.avg_quality_score > 0 && summary.avg_quality_score < 8}
              danger={summary.avg_quality_score > 0 && summary.avg_quality_score < 7}
            />
            <StatCard
              icon={CheckCircle2}
              label="完成节点"
              value={`${summary.completed_nodes}/${summary.total_nodes}`}
              progress={summary.completed_nodes / summary.total_nodes}
            />
            <StatCard
              icon={RotateCcw}
              label="打回次数"
              value={summary.return_ticket_count.toString()}
              warn={summary.return_ticket_count > 0}
              danger={summary.return_ticket_count > 3}
            />
          </div>
        </div>

        {/* Decision Level Legend */}
        <div className="px-6 pb-3 flex items-center gap-4 text-[10px]">
          <span className="text-muted-foreground">决策层级:</span>
          <LegendItem icon={Brain} color="text-violet-400" label="集级策划" count={levelCounts.planning} />
          <LegendItem icon={Cpu} color="text-blue-400" label="批量执行" count={levelCounts.execution} />
          <LegendItem icon={Shield} color="text-amber-400" label="质检/复盘" count={levelCounts.review} />
          <LegendItem icon={User} color="text-pink-400" label="人工审核" count={levelCounts.gate} />
          <LegendItem icon={Layers} color="text-zinc-400" label="定稿" count={levelCounts.freeze} />
          <LegendItem icon={FileText} color="text-cyan-400" label="合成/分发" count={levelCounts.compose} />
        </div>
      </header>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          B区: DAG 流程图
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <main className="flex-1 min-h-0">
        <DagView
          nodes={MOCK_NODES}
          edges={MOCK_EDGES}
          stages={STAGES}
          selectedNodeId={selectedNodeId}
          onNodeSelect={setSelectedNodeId}
        />
      </main>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          C区: 节点详情面板
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 子组件
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatCard({ icon: Icon, label, value, subtitle, warn, danger, progress }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subtitle?: string
  warn?: boolean
  danger?: boolean
  progress?: number
}) {
  return (
    <div className="bg-card/50 backdrop-blur border border-border/30 rounded-xl px-4 py-3 hover:bg-card/70 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const min = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  if (min < 60) return `${min}m${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h${min % 60}m`
}
