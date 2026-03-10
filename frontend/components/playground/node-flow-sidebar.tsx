"use client"

import { cn } from "@/lib/utils"
import { NODE_SPECS, STAGE_GROUPS, getCategoryColor, getCategoryLabel } from "@/lib/node-specs"
import type { PlaygroundNodeData, PlaygroundNodeStatus } from "@/app/playground/page"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { User, Check, X, Loader2, Pause, Clock, Play, Square } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NodeFlowSidebarProps {
  nodes: Record<string, PlaygroundNodeData>
  selectedNodeId: string | null
  currentNodeId?: string
  onSelectNode: (nodeId: string) => void
  onToggleConnection: (nodeId: string, direction: "prev" | "next") => void
  onRunNode: (nodeId: string) => void
  onPauseNode: (nodeId: string) => void
}

const STATUS_STYLES: Record<
  PlaygroundNodeStatus,
  { bg: string; border: string; iconColor: string }
> = {
  idle: { bg: "bg-zinc-900/50", border: "border-zinc-700/50 border-dashed", iconColor: "text-zinc-500" },
  pending: { bg: "bg-zinc-900/60", border: "border-zinc-600/50", iconColor: "text-zinc-400" },
  running: { bg: "bg-blue-950/60", border: "border-blue-500/50", iconColor: "text-blue-400" },
  completed: { bg: "bg-emerald-950/40", border: "border-emerald-500/40", iconColor: "text-emerald-400" },
  failed: { bg: "bg-red-950/60", border: "border-red-500/50", iconColor: "text-red-400" },
  paused: { bg: "bg-amber-950/60", border: "border-amber-500/50", iconColor: "text-amber-400" },
  gate_waiting: { bg: "bg-purple-950/60", border: "border-purple-500/50", iconColor: "text-purple-400" },
}

export function NodeFlowSidebar({
  nodes,
  selectedNodeId,
  currentNodeId,
  onSelectNode,
  onToggleConnection,
  onRunNode,
  onPauseNode,
}: NodeFlowSidebarProps) {
  return (
    <aside className="w-72 border-l border-border bg-card/30 flex flex-col shrink-0">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border/50">
        <span className="text-xs font-medium text-foreground">节点流程图</span>
        <span className="text-[10px] text-muted-foreground">26 节点</span>
      </div>

      {/* Nodes list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {STAGE_GROUPS.map((group) => (
            <div key={group.id}>
              {/* Stage label */}
              <div className="px-2 py-1 mb-2">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Stage {group.stage} · {group.label}
                </span>
              </div>

              {/* Nodes */}
              <div className="space-y-0">
                {group.nodeIds.map((nodeId, idx) => {
                  const spec = NODE_SPECS.find((n) => n.id === nodeId)
                  const nodeData = nodes[nodeId]
                  if (!spec || !nodeData) return null

                  const isSelected = selectedNodeId === nodeId
                  const isCurrent = currentNodeId === nodeId
                  const style = STATUS_STYLES[nodeData.status]
                  const prevNodeId = idx > 0 ? group.nodeIds[idx - 1] : null
                  const prevNodeData = prevNodeId ? nodes[prevNodeId] : null
                  const isPrevRunning = prevNodeData?.status === "running"
                  const isPrevCompleted = prevNodeData?.status === "completed"

                  return (
                    <div key={nodeId} className="relative">
                      {/* Connection line from previous node */}
                      {idx > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onToggleConnection(nodeId, "prev")
                                }}
                                className={cn(
                                  "w-full h-4 flex items-center justify-center cursor-pointer hover:bg-secondary/30 rounded transition-colors",
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-px h-full transition-all relative",
                                    nodeData.isConnectedToPrev
                                      ? isPrevRunning
                                        ? "bg-blue-500/70"
                                        : isPrevCompleted
                                          ? "bg-emerald-500/70"
                                          : "bg-zinc-500/50"
                                      : "bg-zinc-700/30 border-l border-dashed border-zinc-600"
                                  )}
                                >
                                  {/* Flow animation when running */}
                                  {nodeData.isConnectedToPrev && isPrevRunning && (
                                    <div className="absolute inset-0 animate-flow" />
                                  )}
                                </div>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px]">
                              点击{nodeData.isConnectedToPrev ? "断开" : "连接"}上游
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {/* Node card */}
                      <button
                        onClick={() => onSelectNode(nodeId)}
                        className={cn(
                          "w-full text-left rounded-lg border px-3 py-2 transition-all relative overflow-hidden",
                          style.bg,
                          style.border,
                          isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.02]",
                          nodeData.status === "running" && "animate-pulse-glow node-running"
                        )}
                      >
                        {/* Shimmer overlay for running state */}
                        {nodeData.status === "running" && (
                          <div className="absolute inset-0 animate-shimmer pointer-events-none" />
                        )}
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {nodeId}
                            </span>
                            {spec.isGate && (
                              <User className="w-3 h-3 text-purple-400" />
                            )}
                          </div>
                          <StatusIcon status={nodeData.status} />
                        </div>

                        {/* Name */}
                        <p className="text-xs font-medium text-foreground leading-tight mb-1 truncate">
                          {spec.name}
                        </p>

                        {/* Agent */}
                        <p className="text-[10px] text-muted-foreground truncate mb-1">
                          {spec.agentRole.replace(/_/g, " ")}
                        </p>

                        {/* Metrics row */}
                        {(nodeData.status === "completed" || nodeData.status === "running") && (
                          <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                            {nodeData.durationMs != null && (
                              <span>{(nodeData.durationMs / 1000).toFixed(1)}s</span>
                            )}
                            {nodeData.costCny != null && nodeData.costCny > 0 && (
                              <span>¥{nodeData.costCny.toFixed(2)}</span>
                            )}
                            {nodeData.qualityScore != null && (
                              <span
                                className={cn(
                                  nodeData.qualityScore >= 9
                                    ? "text-emerald-400"
                                    : nodeData.qualityScore >= 8
                                      ? "text-foreground"
                                      : "text-amber-400"
                                )}
                              >
                                {nodeData.qualityScore.toFixed(1)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Category badge + Control buttons */}
                        <div className="mt-1.5 flex items-center justify-between">
                          <span
                            className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded border",
                              getCategoryColor(spec.category)
                            )}
                          >
                            {getCategoryLabel(spec.category)}
                          </span>
                          
                          {/* Play/Pause control button */}
                          <div className="flex items-center gap-1">
                            {nodeData.status === "running" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 hover:bg-amber-500/20"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onPauseNode(nodeId)
                                }}
                              >
                                <Pause className="w-3 h-3 text-amber-400" />
                              </Button>
                            ) : nodeData.status === "paused" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 hover:bg-emerald-500/20"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onRunNode(nodeId)
                                }}
                              >
                                <Play className="w-3 h-3 text-emerald-400" />
                              </Button>
                            ) : nodeData.status === "idle" || nodeData.status === "pending" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 hover:bg-blue-500/20"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onRunNode(nodeId)
                                }}
                              >
                                <Play className="w-3 h-3 text-blue-400" />
                              </Button>
                            ) : nodeData.status === "completed" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 hover:bg-secondary/50"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onRunNode(nodeId)
                                }}
                              >
                                <Play className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </button>

                    </div>
                  )
                })}
              </div>

              {/* Inter-stage connector */}
              {group.stage < 4 && (
                <div className="flex justify-center py-2">
                  <div className="w-px h-4 bg-zinc-700/30" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}

function StatusIcon({ status }: { status: PlaygroundNodeStatus }) {
  const style = STATUS_STYLES[status]

  switch (status) {
    case "completed":
      return <Check className={cn("w-3.5 h-3.5", style.iconColor)} />
    case "running":
      return <Loader2 className={cn("w-3.5 h-3.5 animate-spin", style.iconColor)} />
    case "failed":
      return <X className={cn("w-3.5 h-3.5", style.iconColor)} />
    case "paused":
      return <Pause className={cn("w-3.5 h-3.5", style.iconColor)} />
    case "gate_waiting":
      return <User className={cn("w-3.5 h-3.5", style.iconColor)} />
    case "pending":
      return <Clock className={cn("w-3.5 h-3.5", style.iconColor)} />
    default:
      return <div className={cn("w-2.5 h-2.5 rounded-full bg-zinc-600")} />
  }
}
