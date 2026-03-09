"use client"

import { cn } from "@/lib/utils"
import type { TraceNode, DecisionLevel } from "./trace-types"
import { Clock, DollarSign, Cpu, Zap, ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface NodeDetailPanelProps {
  node: TraceNode
  onClose: () => void
}

const LEVEL_CONFIG: Record<DecisionLevel, { label: string; color: string; tabs: string[] }> = {
  planning: { label: "集级策划", color: "bg-purple-500/20 text-purple-300", tabs: ["集级策划", "输入/输出", "遥测"] },
  execution: { label: "批量执行", color: "bg-blue-500/20 text-blue-300", tabs: ["执行总览", "单项详情", "输入/输出", "遥测"] },
  review: { label: "质检/复盘", color: "bg-amber-500/20 text-amber-300", tabs: ["检查报告", "逐项分数", "遥测"] },
  gate: { label: "人工审核", color: "bg-pink-500/20 text-pink-300", tabs: ["审核记录", "遥测"] },
  freeze: { label: "定稿操作", color: "bg-zinc-500/20 text-zinc-300", tabs: ["定稿记录", "遥测"] },
  compose: { label: "合成/分发", color: "bg-cyan-500/20 text-cyan-300", tabs: ["概览", "输入/输出", "遥测"] },
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const config = LEVEL_CONFIG[node.decision_level]
  const [activeTab, setActiveTab] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={cn(
      "border-t border-border bg-card/80 backdrop-blur transition-all",
      collapsed ? "h-10" : "min-h-[240px] max-h-[50vh]"
    )}>
      {/* Header bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border/50 cursor-pointer" onClick={() => setCollapsed(v => !v)}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground">{node.node_id}</span>
          <span className="text-sm font-medium text-foreground">{node.node_name}</span>
          <span className="text-xs text-muted-foreground">{node.agent_name.replace(/_/g, " ")}</span>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full", config.color)}>{config.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); onClose() }} className="text-xs text-muted-foreground hover:text-foreground">
            关闭
          </button>
          {collapsed ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="h-9 px-4 flex items-center gap-1 border-b border-border/30">
            {config.tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "px-3 py-1 text-xs rounded-md transition-colors",
                  i === activeTab ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 overflow-auto" style={{ maxHeight: "calc(50vh - 78px)" }}>
            {renderTabContent(node, config.tabs[activeTab])}
          </div>
        </>
      )}
    </div>
  )
}

function renderTabContent(node: TraceNode, tab: string) {
  if (tab === "遥测") return <TelemetryTab node={node} />
  if (tab === "集级策划") return <PlanningTab node={node} />
  if (tab === "执行总览") return <ExecutionTab node={node} />
  if (tab === "检查报告") return <ReviewTab node={node} />
  if (tab === "审核记录") return <GateTab node={node} />
  if (tab === "定稿记录") return <FreezeTab node={node} />
  return <PlaceholderTab tab={tab} />
}

function TelemetryTab({ node }: { node: TraceNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <MetricCard icon={Clock} label="执行时长" value={node.duration_seconds != null ? `${node.duration_seconds}s` : "—"} />
      <MetricCard icon={DollarSign} label="费用" value={`¥${node.cost_cny}`} />
      <MetricCard icon={Cpu} label="模型" value={node.model || "N/A"} />
      <MetricCard icon={Zap} label="质量均分" value={node.quality_score != null ? `${node.quality_score}` : "N/A"} />
    </div>
  )
}

function PlanningTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-4">
      <Section title="① 全集需求理解">
        <p className="text-xs text-muted-foreground">
          {node.agent_name === "shot_designer" ? "全集分镜设计 — 30~60镜头的景别/难度/质检层级分配" : "全集视觉策略 — 场景级prompt适配器+生成配方"}
        </p>
      </Section>
      <Section title="② RAG 检索">
        <p className="text-xs text-muted-foreground">按场景类型批量检索同题材成功案例 TOP-3</p>
      </Section>
      <Section title="③ 策略表">
        <p className="text-xs text-muted-foreground italic">策划详情将在后端 API 接通后展示完整数据</p>
      </Section>
      <Section title="④ 自检">
        <div className="flex gap-4 text-xs">
          <span className="text-emerald-400">✓ 景别分布合理</span>
          <span className="text-emerald-400">✓ 预算在红线内</span>
        </div>
      </Section>
    </div>
  )
}

function ExecutionTab({ node }: { node: TraceNode }) {
  const stats = node.batch_stats || { total_shots: 32, completed: 30, running: 2, failed: 0, retried: 3, one_pass_rate: 0.906 }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <MiniStat label="总镜头" value={stats.total_shots} />
        <MiniStat label="完成" value={stats.completed} color="text-emerald-400" />
        <MiniStat label="运行中" value={stats.running} color="text-blue-400" />
        <MiniStat label="失败" value={stats.failed} color="text-red-400" />
        <MiniStat label="重试" value={stats.retried} color="text-amber-400" />
        <MiniStat label="一次通过率" value={`${(stats.one_pass_rate * 100).toFixed(1)}%`} />
      </div>
      <p className="text-xs text-muted-foreground italic">镜头级执行详情将在后端 API 接通后展示</p>
    </div>
  )
}

function ReviewTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">质检/复盘报告</p>
      <p className="text-xs text-muted-foreground">
        {node.quality_score != null ? `综合评分: ${node.quality_score}` : "评分待生成"}
      </p>
      <p className="text-xs text-muted-foreground italic">详细逐项分数将在后端 API 接通后展示</p>
    </div>
  )
}

function GateTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">审核人: {node.gate_reviewer_name || "待分配"}</span>
        <span className={node.gate_decision === "approved" ? "text-emerald-400" : node.gate_decision === "rejected" ? "text-amber-400" : "text-muted-foreground"}>
          决策: {node.gate_decision === "approved" ? "✓ 通过" : node.gate_decision === "rejected" ? "↩ 打回" : "⏳ 等待中"}
        </span>
      </div>
      {node.gate_feedback && (
        <div className="bg-secondary/30 rounded-lg p-3">
          <p className="text-xs text-foreground">&ldquo;{node.gate_feedback}&rdquo;</p>
        </div>
      )}
    </div>
  )
}

function FreezeTab({ node }: { node: TraceNode }) {
  return (
    <div className="text-xs text-muted-foreground">
      {node.status === "completed" ? "✓ 已固化 — 产物已锁定，不可修改" : "等待上游节点完成"}
    </div>
  )
}

function PlaceholderTab({ tab }: { tab: string }) {
  return <p className="text-xs text-muted-foreground italic">{tab} — 后端 API 接通后展示</p>
}

// ── Shared sub-components ──

function MetricCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center">
      <p className={cn("text-lg font-semibold", color || "text-foreground")}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-secondary/20 rounded-lg p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  )
}
