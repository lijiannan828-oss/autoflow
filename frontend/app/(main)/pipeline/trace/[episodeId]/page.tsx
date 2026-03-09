"use client"

import { useEffect, useState, use } from "react"
import { Clock, DollarSign, BarChart3, CheckCircle2, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { DagFlow } from "@/components/pipeline/dag-flow"
import { NodeDetailPanel } from "@/components/pipeline/node-detail-panel"
import type { EpisodeTrace, TraceNode } from "@/components/pipeline/trace-types"

export default function EpisodeTracePage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = use(params)
  const [trace, setTrace] = useState<EpisodeTrace | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pipeline/trace/${episodeId}`)
      .then(r => r.json())
      .then(data => {
        setTrace(data)
        setError("")
      })
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false))
  }, [episodeId])

  // Auto-refresh when running
  useEffect(() => {
    if (!trace || trace.versions[0]?.status !== "running") return
    const interval = setInterval(() => {
      fetch(`/api/pipeline/trace/${episodeId}`)
        .then(r => r.json())
        .then(setTrace)
        .catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [trace, episodeId])

  const selectedNode = trace?.nodes.find(n => n.node_id === selectedNodeId) || null

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !trace) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>{error || "暂无数据"}</p>
      </div>
    )
  }

  const s = trace.summary
  const runningNode = trace.nodes.find(n => n.status === "running")

  return (
    <div className="h-full flex flex-col">
      {/* ── A区: 顶部信息栏 ── */}
      <div className="shrink-0 border-b border-border/50 px-5 py-3">
        {/* Breadcrumb */}
        <div className="text-xs text-muted-foreground mb-2">
          <span className="hover:text-foreground cursor-pointer">管线总览</span>
          <span className="mx-1.5">›</span>
          <span className="hover:text-foreground cursor-pointer">{trace.project_name}</span>
          <span className="mx-1.5">›</span>
          <span className="text-foreground">第{trace.episode_number}集</span>
        </div>

        {/* Title + version + status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-foreground">
              {trace.project_name} · 第{trace.episode_number}集
            </h1>
            {/* Version tabs */}
            <div className="flex gap-1">
              {trace.versions.map(v => (
                <span
                  key={v.version_no}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border cursor-pointer",
                    v.is_current
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  v{v.version_no} {v.is_current ? "●" : ""}
                </span>
              ))}
            </div>
          </div>

          {/* Running status */}
          {runningNode && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-blue-400">运行中</span>
              <span className="text-muted-foreground">当前节点 {runningNode.node_id}</span>
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div className="flex gap-3">
          <StatCard
            icon={Clock}
            label="总耗时"
            value={formatDuration(s.total_duration_seconds)}
            warn={s.total_duration_seconds > 7200}
          />
          <StatCard
            icon={DollarSign}
            label="总成本"
            value={`¥${s.total_cost_cny}`}
            warn={s.total_cost_cny > 20}
            danger={s.total_cost_cny > 30}
          />
          <StatCard
            icon={BarChart3}
            label="平均质量"
            value={s.avg_quality_score > 0 ? `${s.avg_quality_score}` : "—"}
            warn={s.avg_quality_score > 0 && s.avg_quality_score < 8}
            danger={s.avg_quality_score > 0 && s.avg_quality_score < 7}
          />
          <StatCard
            icon={CheckCircle2}
            label="完成节点"
            value={`${s.completed_nodes}/${s.total_nodes}`}
          />
          <StatCard
            icon={RotateCcw}
            label="打回次数"
            value={`${s.return_ticket_count}`}
            warn={s.return_ticket_count > 0}
            danger={s.return_ticket_count > 3}
          />
        </div>
      </div>

      {/* ── B区: DAG 流程图 ── */}
      <div className="flex-1 min-h-[300px]">
        <DagFlow
          traceNodes={trace.nodes}
          traceEdges={trace.edges}
          stages={trace.stages}
          selectedNodeId={selectedNodeId}
          onNodeSelect={setSelectedNodeId}
        />
      </div>

      {/* ── C区: 节点详情面板 ── */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, warn, danger }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  warn?: boolean
  danger?: boolean
}) {
  return (
    <div className="bg-secondary/30 rounded-lg px-3 py-2 min-w-[100px]">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={cn(
        "text-sm font-semibold",
        danger ? "text-red-400" : warn ? "text-amber-400" : "text-foreground"
      )}>
        {value}
      </p>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  if (min < 60) return `${min}m${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h${min % 60}m`
}
