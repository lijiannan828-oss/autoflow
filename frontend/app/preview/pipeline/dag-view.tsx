"use client"

import { useCallback, useMemo, useState } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Position,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@/lib/utils"
import type { TraceNode, TraceEdge, StageInfo, NodeStatus, DecisionLevel } from "./mock-data"
import { 
  CheckCircle2, Play, Clock, XCircle, User, RotateCcw, Pause,
  Brain, Cpu, Shield, Layers, FileText, Volume2
} from "lucide-react"

interface DagViewProps {
  nodes: TraceNode[]
  edges: TraceEdge[]
  stages: StageInfo[]
  selectedNodeId: string | null
  onNodeSelect: (nodeId: string) => void
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 自定义节点组件
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PipelineNodeComponent({ data }: { data: TraceNode & { selected: boolean } }) {
  const statusConfig: Record<NodeStatus, { bg: string; border: string; icon: React.ReactNode }> = {
    completed: { bg: "bg-emerald-950/80", border: "border-emerald-500/50", icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" /> },
    running: { bg: "bg-blue-950/80", border: "border-blue-500/50 animate-pulse", icon: <Play className="w-3 h-3 text-blue-400 animate-spin" style={{ animationDuration: "2s" }} /> },
    pending: { bg: "bg-zinc-900/80", border: "border-zinc-600/50 border-dashed", icon: <Clock className="w-3 h-3 text-zinc-500" /> },
    failed: { bg: "bg-red-950/80", border: "border-red-500/50", icon: <XCircle className="w-3 h-3 text-red-400" /> },
    skipped: { bg: "bg-zinc-900/50", border: "border-zinc-700/30", icon: null },
    gate_waiting: { bg: "bg-pink-950/80", border: "border-pink-500/50 animate-pulse", icon: <User className="w-3 h-3 text-pink-400" /> },
    gate_approved: { bg: "bg-emerald-950/80", border: "border-emerald-500/50", icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" /> },
    gate_rejected: { bg: "bg-amber-950/80", border: "border-amber-500/50", icon: <RotateCcw className="w-3 h-3 text-amber-400" /> },
  }

  const levelConfig: Record<DecisionLevel, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
    planning: { color: "text-violet-400", icon: Brain },
    execution: { color: "text-blue-400", icon: Cpu },
    review: { color: "text-amber-400", icon: Shield },
    gate: { color: "text-pink-400", icon: User },
    freeze: { color: "text-zinc-400", icon: Layers },
    compose: { color: "text-cyan-400", icon: FileText },
  }

  const config = statusConfig[data.status]
  const levelCfg = levelConfig[data.decision_level]
  const LevelIcon = levelCfg.icon

  const isGate = data.is_gate
  const width = isGate ? 200 : 160

  return (
    <div 
      className={cn(
        "rounded-lg border-2 backdrop-blur-sm transition-all duration-200 cursor-pointer overflow-hidden",
        config.bg,
        config.border,
        data.selected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
      )}
      style={{ width }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono font-bold text-primary">{data.node_id}</span>
          <div className="flex items-center gap-1.5">
            <LevelIcon className={cn("w-3 h-3", levelCfg.color)} />
            {config.icon}
          </div>
        </div>
        <p className="text-xs font-medium text-foreground/90 truncate">{data.node_name}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {data.agent_name.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
        </p>
      </div>

      {/* Metrics */}
      <div className="px-3 py-2 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1">
          {data.status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
          <span className={cn(
            data.status === "completed" ? "text-emerald-400" :
            data.status === "running" ? "text-blue-400" :
            data.status === "failed" ? "text-red-400" :
            "text-muted-foreground"
          )}>
            {data.status === "completed" ? "完成" :
             data.status === "running" ? "运行中" :
             data.status === "failed" ? "失败" :
             data.status === "gate_waiting" ? "等待审核" :
             data.status === "gate_approved" ? "已通过" :
             data.status === "gate_rejected" ? "已打回" :
             "等待"}
          </span>
        </div>
        {data.duration_seconds != null && (
          <span className="text-muted-foreground">{formatDuration(data.duration_seconds)}</span>
        )}
      </div>

      {/* Cost & Quality */}
      {(data.cost_cny > 0 || data.quality_score != null) && (
        <div className="px-3 pb-2 flex items-center justify-between text-[10px]">
          {data.cost_cny > 0 && (
            <span className="text-emerald-400/80">¥{data.cost_cny.toFixed(2)}</span>
          )}
          {data.quality_score != null && (
            <span className={cn(
              "px-1.5 py-0.5 rounded",
              data.quality_score >= 8.5 ? "bg-emerald-500/20 text-emerald-300" :
              data.quality_score >= 7.5 ? "bg-blue-500/20 text-blue-300" :
              "bg-amber-500/20 text-amber-300"
            )}>
              {data.quality_score}
            </span>
          )}
        </div>
      )}

      {/* Gate specific */}
      {isGate && data.gate_feedback && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-muted-foreground truncate italic">
            &ldquo;{data.gate_feedback.slice(0, 30)}...&rdquo;
          </p>
        </div>
      )}

      {/* Batch stats for execution nodes */}
      {data.batch_stats && (
        <div className="px-3 pb-2 flex items-center gap-2 text-[10px]">
          <span className="text-emerald-400">{data.batch_stats.completed}/{data.batch_stats.total_shots}</span>
          {data.batch_stats.running > 0 && (
            <span className="text-blue-400 flex items-center gap-0.5">
              <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
              {data.batch_stats.running}
            </span>
          )}
          {data.batch_stats.retried > 0 && (
            <span className="text-amber-400">↻{data.batch_stats.retried}</span>
          )}
        </div>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  pipeline: PipelineNodeComponent,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 布局计算
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NODE_W = 160
const NODE_H = 100
const GATE_W = 200
const GAP_X = 50
const GAP_Y = 40
const STAGE_LABEL_W = 120

export function DagView({ nodes, edges, stages, selectedNodeId, onNodeSelect }: DagViewProps) {
  const { rfNodes, rfEdges } = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.node_id, n]))
    const rfNodes: Node[] = []
    let y = 20

    for (const stage of stages) {
      // Stage label
      rfNodes.push({
        id: `stage-${stage.stage}`,
        type: "default",
        position: { x: 0, y: y + NODE_H / 2 - 12 },
        data: { label: `Stage ${stage.stage}` },
        style: {
          background: "transparent",
          border: "none",
          color: "hsl(var(--muted-foreground))",
          fontSize: 10,
          fontWeight: 600,
          width: STAGE_LABEL_W - 20,
          padding: 0,
          textAlign: "right" as const,
        },
        draggable: false,
        selectable: false,
      })

      // Stage label subtitle
      rfNodes.push({
        id: `stage-label-${stage.stage}`,
        type: "default",
        position: { x: 0, y: y + NODE_H / 2 + 4 },
        data: { label: stage.label },
        style: {
          background: "transparent",
          border: "none",
          color: "hsl(var(--muted-foreground))",
          fontSize: 9,
          fontWeight: 400,
          width: STAGE_LABEL_W - 20,
          padding: 0,
          textAlign: "right" as const,
          opacity: 0.7,
        },
        draggable: false,
        selectable: false,
      })

      let x = STAGE_LABEL_W
      const hasParallel = stage.nodes.includes("N07b")
      let parallelOffset = 0

      for (const nodeId of stage.nodes) {
        const node = nodeMap.get(nodeId)
        if (!node) continue

        const isGate = node.is_gate
        const w = isGate ? GATE_W : NODE_W

        // Handle N07b parallel positioning
        if (nodeId === "N07b") {
          const n07Node = rfNodes.find(n => n.id === "N07")
          if (n07Node) {
            rfNodes.push({
              id: nodeId,
              type: "pipeline",
              position: { x: n07Node.position.x, y: y + NODE_H + GAP_Y * 0.6 },
              data: { ...node, selected: selectedNodeId === nodeId },
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            })
            parallelOffset = NODE_H + GAP_Y * 0.6
            continue
          }
        }

        rfNodes.push({
          id: nodeId,
          type: "pipeline",
          position: { x, y },
          data: { ...node, selected: selectedNodeId === nodeId },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        })

        x += w + GAP_X
      }

      y += NODE_H + GAP_Y + (hasParallel ? parallelOffset : 0)
    }

    // Build edges
    const rfEdges: Edge[] = edges.map((e, i) => {
      const fromNode = nodeMap.get(e.from)
      const isCompleted = fromNode?.status === "completed" || fromNode?.status === "gate_approved"
      const isRunning = fromNode?.status === "running"

      return {
        id: `e-${i}`,
        source: e.from,
        target: e.to,
        type: "default",
        animated: isRunning,
        style: {
          stroke: isCompleted ? "#10B981" : isRunning ? "#3B82F6" : e.type === "return" ? "#F59E0B" : "#374151",
          strokeWidth: 2,
          strokeDasharray: e.type === "return" ? "5,5" : e.type === "parallel" ? "3,3" : undefined,
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          width: 14, 
          height: 14, 
          color: isCompleted ? "#10B981" : isRunning ? "#3B82F6" : "#374151" 
        },
      }
    })

    return { rfNodes, rfEdges }
  }, [nodes, edges, stages, selectedNodeId])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("stage-")) return
    onNodeSelect(node.id)
  }, [onNodeSelect])

  return (
    <div className="w-full h-full bg-gradient-to-br from-background via-background to-secondary/20">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.25}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: "default" }}
      >
        <Background color="hsl(var(--border))" gap={40} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-card/80 !backdrop-blur !border-border/50 !shadow-xl [&>button]:!bg-card [&>button]:!border-border/50 [&>button]:!text-foreground [&>button:hover]:!bg-secondary"
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as TraceNode
            if (!data?.status) return "#374151"
            return data.status === "completed" || data.status === "gate_approved" ? "#10B981" :
                   data.status === "running" ? "#3B82F6" :
                   data.status === "failed" ? "#EF4444" : "#374151"
          }}
          maskColor="rgba(0,0,0,0.8)"
          className="!bg-card/80 !border-border/50"
        />
      </ReactFlow>
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
