"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import type { NodeStatus } from "./trace-types"

const STATUS_STYLES: Record<NodeStatus, { bg: string; border: string; icon: string }> = {
  completed: { bg: "bg-emerald-950/60", border: "border-emerald-500/50", icon: "✓" },
  running: { bg: "bg-blue-950/60", border: "border-blue-500/50 animate-pulse", icon: "●" },
  pending: { bg: "bg-zinc-900/60", border: "border-zinc-700/50 border-dashed", icon: "○" },
  failed: { bg: "bg-red-950/60", border: "border-red-500/50", icon: "✕" },
  skipped: { bg: "bg-zinc-900/40", border: "border-zinc-700/30", icon: "—" },
  gate_waiting: { bg: "bg-purple-950/60", border: "border-purple-500/50 animate-pulse", icon: "👤" },
  gate_approved: { bg: "bg-emerald-950/60", border: "border-emerald-500/50", icon: "✓👤" },
  gate_rejected: { bg: "bg-amber-950/60", border: "border-amber-500/50", icon: "↩" },
}

const STATUS_ICON_COLOR: Record<NodeStatus, string> = {
  completed: "text-emerald-400",
  running: "text-blue-400",
  pending: "text-zinc-500",
  failed: "text-red-400",
  skipped: "text-zinc-600",
  gate_waiting: "text-purple-400",
  gate_approved: "text-emerald-400",
  gate_rejected: "text-amber-400",
}

const DECISION_BADGE: Record<string, { label: string; color: string }> = {
  planning: { label: "策划", color: "bg-purple-500/20 text-purple-300" },
  execution: { label: "执行", color: "bg-blue-500/20 text-blue-300" },
  review: { label: "复盘", color: "bg-amber-500/20 text-amber-300" },
  gate: { label: "人审", color: "bg-pink-500/20 text-pink-300" },
  freeze: { label: "定稿", color: "bg-zinc-500/20 text-zinc-300" },
  compose: { label: "合成", color: "bg-cyan-500/20 text-cyan-300" },
}

export const PipelineNode = memo(function PipelineNode({ data }: NodeProps) {
  const d = data as Record<string, unknown>
  const status = (d.status as NodeStatus) || "pending"
  const style = STATUS_STYLES[status]
  const badge = DECISION_BADGE[(d.decision_level as string) || "execution"]
  const isGate = d.is_gate as boolean
  const selected = d.selected as boolean

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-zinc-600 !w-1.5 !h-1.5 !border-0" />
      <div
        className={cn(
          "rounded-lg border px-3 py-2 transition-all",
          style.bg,
          style.border,
          isGate ? "min-w-[180px]" : "min-w-[150px]",
          selected && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-105"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-mono text-muted-foreground">{d.node_id as string}</span>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full", badge?.color)}>{badge?.label}</span>
        </div>

        {/* Name */}
        <p className="text-xs font-medium text-foreground leading-tight mb-1">{d.node_name as string}</p>

        {/* Agent */}
        <p className="text-[10px] text-muted-foreground mb-1.5">
          {(d.agent_name as string)?.replace(/_/g, " ")}
        </p>

        {/* Status + metrics */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className={cn("font-medium", STATUS_ICON_COLOR[status])}>
            {style.icon} {status === "running" ? "运行中" : status === "completed" ? "完成" : status === "pending" ? "等待" : status === "failed" ? "失败" : status}
          </span>
          {(d.duration_seconds as number) != null && (
            <span className="text-muted-foreground">{d.duration_seconds as number}s</span>
          )}
          {(d.cost_cny as number) > 0 && (
            <span className="text-muted-foreground">¥{d.cost_cny as number}</span>
          )}
        </div>

        {/* Quality score */}
        {(d.quality_score as number) != null && (
          <div className="mt-1">
            <span className={cn(
              "text-[10px] font-medium",
              (d.quality_score as number) >= 9 ? "text-emerald-400" : (d.quality_score as number) >= 8 ? "text-foreground" : "text-amber-400"
            )}>
              质量 {d.quality_score as number}
            </span>
          </div>
        )}

        {/* Gate info */}
        {isGate && (d.gate_feedback as string) && (
          <p className="text-[9px] text-muted-foreground mt-1 truncate max-w-[160px]">
            "{d.gate_feedback as string}"
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-600 !w-1.5 !h-1.5 !border-0" />
    </>
  )
})
