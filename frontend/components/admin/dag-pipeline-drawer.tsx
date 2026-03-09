"use client"

import { X, Check, AlertCircle, Clock, User, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PIPELINE_NODES, PHASES, formatDuration } from "@/lib/admin-types"
import type { EpisodeTask, PipelineNodeState } from "@/lib/admin-types"

interface DAGPipelineDrawerProps {
  task: EpisodeTask | null
  isOpen: boolean
  onClose: () => void
}

export function DAGPipelineDrawer({ task, isOpen, onClose }: DAGPipelineDrawerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())

  if (!task) return null

  const toggleNode = (nodeId: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[480px] bg-background border-l border-border shadow-2xl z-50 transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">{task.dramaTitle}</h2>
            <p className="text-sm text-muted-foreground">第{task.episodeNumber}集 - 全链路节点透视</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Pipeline Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {PHASES.map((phase) => {
            const phaseNodes = PIPELINE_NODES.filter(n => n.phase === phase.id)
            
            return (
              <div key={phase.id} className="mb-6">
                {/* Phase header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {phase.id}
                  </div>
                  <span className="text-sm font-medium text-foreground">{phase.name}</span>
                </div>

                {/* Nodes in this phase */}
                <div className="ml-3 border-l-2 border-border/50 pl-4 space-y-2">
                  {phaseNodes.map((node) => {
                    const nodeState = task.nodeStates.find(ns => ns.nodeId === node.id)
                    const isExpanded = expandedNodes.has(node.id)
                    
                    return (
                      <NodeItem
                        key={node.id}
                        node={node}
                        state={nodeState}
                        isExpanded={isExpanded}
                        onToggle={() => toggleNode(node.id)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

interface NodeItemProps {
  node: typeof PIPELINE_NODES[number]
  state?: PipelineNodeState
  isExpanded: boolean
  onToggle: () => void
}

function NodeItem({ node, state, isExpanded, onToggle }: NodeItemProps) {
  const status = state?.status || "pending"
  
  // Status colors and icons
  const statusConfig = {
    completed: { color: "text-emerald-400", bg: "bg-emerald-500/20", icon: Check },
    running: { color: "text-blue-400", bg: "bg-blue-500/20", icon: Clock },
    failed: { color: "text-red-400", bg: "bg-red-500/20", icon: AlertCircle },
    pending: { color: "text-muted-foreground", bg: "bg-secondary/50", icon: Clock },
    skipped: { color: "text-muted-foreground", bg: "bg-secondary/30", icon: Check },
  }
  
  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="group">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 p-2 rounded-lg transition-all text-left",
          config.bg,
          "hover:bg-opacity-80"
        )}
      >
        {/* Status icon */}
        <div className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
          status === "running" && "animate-pulse"
        )}>
          <StatusIcon className={cn("w-3.5 h-3.5", config.color)} />
        </div>

        {/* Node info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium", config.color)}>
              {node.id}. {node.name}
            </span>
            {node.isHuman && (
              <span className="px-1 py-0.5 rounded text-[8px] bg-amber-500/20 text-amber-400">
                人工
              </span>
            )}
          </div>
          {state?.duration && status === "completed" && (
            <span className="text-[10px] text-muted-foreground">
              耗时 {formatDuration(state.duration)}
            </span>
          )}
          {state?.assignee && status === "running" && (
            <span className="text-[10px] text-blue-400 flex items-center gap-1">
              <User className="w-2.5 h-2.5" />
              {state.assignee}
            </span>
          )}
        </div>

        {/* Expand toggle */}
        {(state?.inputSummary || state?.outputSummary || state?.scores || state?.failReason) && (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-1 ml-7 p-2 rounded bg-secondary/20 border border-border/30 text-xs space-y-2">
          {state?.inputSummary && (
            <div>
              <span className="text-muted-foreground">输入: </span>
              <span className="text-foreground">{state.inputSummary}</span>
            </div>
          )}
          {state?.outputSummary && (
            <div>
              <span className="text-muted-foreground">输出: </span>
              <span className="text-foreground">{state.outputSummary}</span>
            </div>
          )}
          {state?.scores && state.scores.length > 0 && (
            <div>
              <span className="text-muted-foreground">多模型打分: </span>
              <div className="flex items-center gap-2 mt-1">
                {state.scores.map((s, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    {s.model}: {(s.score * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          )}
          {state?.failReason && (
            <div className="text-red-400">
              <span className="text-muted-foreground">驳回理由: </span>
              {state.failReason}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
