"use client"

import { useState } from "react"
import { ChevronDown, Check, Loader2, X, Clock, User } from "lucide-react"
import type { Phase, PipelineNode, NodeStatus } from "@/lib/drama-detail-types"

interface PhaseAccordionSidebarProps {
  phases: Phase[]
  selectedNodeId: string | null
  onSelectNode: (node: PipelineNode) => void
}

export function PhaseAccordionSidebar({
  phases,
  selectedNodeId,
  onSelectNode,
}: PhaseAccordionSidebarProps) {
  const [expandedPhases, setExpandedPhases] = useState<string[]>(
    phases.map(p => p.id) // All expanded by default
  )

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev =>
      prev.includes(phaseId)
        ? prev.filter(id => id !== phaseId)
        : [...prev, phaseId]
    )
  }

  const getPhaseStatus = (nodes: PipelineNode[]): NodeStatus => {
    if (nodes.some(n => n.status === "failed")) return "failed"
    if (nodes.some(n => n.status === "running")) return "running"
    if (nodes.every(n => n.status === "completed")) return "completed"
    return "pending"
  }

  const getStatusIcon = (status: NodeStatus, isHuman: boolean) => {
    if (isHuman) {
      return <User className="h-3 w-3" />
    }
    switch (status) {
      case "completed":
        return <Check className="h-3 w-3" />
      case "running":
        return <Loader2 className="h-3 w-3 animate-spin" />
      case "failed":
        return <X className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  const getStatusColor = (status: NodeStatus) => {
    switch (status) {
      case "completed": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
      case "running": return "text-blue-500 bg-blue-500/10 border-blue-500/30"
      case "failed": return "text-red-500 bg-red-500/10 border-red-500/30"
      default: return "text-muted-foreground bg-secondary/30 border-border/50"
    }
  }

  const getPhaseBadgeColor = (status: NodeStatus) => {
    switch (status) {
      case "completed": return "bg-emerald-500"
      case "running": return "bg-blue-500"
      case "failed": return "bg-red-500"
      default: return "bg-muted-foreground/30"
    }
  }

  return (
    <div className="w-56 shrink-0 border-r border-border/50 bg-[#0a0a0a] overflow-y-auto">
      <div className="p-3">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          流程阶段
        </h3>
        
        <div className="space-y-1">
          {phases.map((phase) => {
            const isExpanded = expandedPhases.includes(phase.id)
            const phaseStatus = getPhaseStatus(phase.nodes)
            const completedCount = phase.nodes.filter(n => n.status === "completed").length

            return (
              <div key={phase.id}>
                {/* Phase header */}
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/50 transition-colors"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${getPhaseBadgeColor(phaseStatus)}`} />
                  <span className="flex-1 text-left text-xs font-medium text-foreground">
                    {phase.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {completedCount}/{phase.nodes.length}
                  </span>
                  <ChevronDown 
                    className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`} 
                  />
                </button>

                {/* Phase nodes */}
                {isExpanded && (
                  <div className="ml-3 mt-1 space-y-0.5 border-l border-border/30 pl-2">
                    {phase.nodes.map((node) => {
                      const isSelected = node.id === selectedNodeId
                      return (
                        <button
                          key={node.id}
                          onClick={() => onSelectNode(node)}
                          className={`
                            w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left
                            transition-colors
                            ${isSelected 
                              ? "bg-white/10 ring-1 ring-white/20" 
                              : "hover:bg-secondary/50"
                            }
                          `}
                        >
                          <div className={`
                            flex h-5 w-5 items-center justify-center rounded border text-[10px]
                            ${getStatusColor(node.status)}
                          `}>
                            {getStatusIcon(node.status, node.isHumanNode)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                {node.nodeNumber}.
                              </span>
                              <span className={`text-[11px] truncate ${
                                isSelected ? "text-foreground" : "text-muted-foreground"
                              }`}>
                                {node.name}
                              </span>
                            </div>
                            {node.isHumanNode && (
                              <span className="text-[9px] text-amber-500">人工节点</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
