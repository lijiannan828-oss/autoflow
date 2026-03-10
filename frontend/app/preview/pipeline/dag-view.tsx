"use client"

import { useCallback, useMemo } from "react"
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
  Handle,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { cn } from "@/lib/utils"
import type { TraceNode, TraceEdge, StageInfo, NodeStatus, DecisionLevel } from "./mock-data"
import { 
  CheckCircle2, Play, Clock, XCircle, User, RotateCcw,
  Brain, Cpu, Shield, Layers, FileText
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

  return (
    <div 
      className={cn(
        "rounded-lg border-2 backdrop-blur-sm transition-all duration-200 cursor-pointer overflow-hidden relative",
        config.bg,
        config.border,
        data.selected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 shadow-lg shadow-primary/20"
      )}
      style={{ width: 180, minHeight: 90 }}
    >
      {/* 连接点 */}
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border !border-none" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border !border-none" />

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
      </div>

      {/* Metrics */}
      <div className="px-3 py-2 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1">
          {data.status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
          <span className={cn(
            data.status === "completed" || data.status === "gate_approved" ? "text-emerald-400" :
            data.status === "running" ? "text-blue-400" :
            data.status === "failed" || data.status === "gate_rejected" ? "text-red-400" :
            "text-muted-foreground"
          )}>
            {data.status === "completed" ? "完成" :
             data.status === "running" ? "运行中" :
             data.status === "failed" ? "失败" :
             data.status === "gate_waiting" ? "待审" :
             data.status === "gate_approved" ? "通过" :
             data.status === "gate_rejected" ? "打回" :
             "等待"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data.cost_cny > 0 && (
            <span className="text-emerald-400/80">¥{data.cost_cny.toFixed(2)}</span>
          )}
          {data.quality_score != null && (
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[9px]",
              data.quality_score >= 8.5 ? "bg-emerald-500/20 text-emerald-300" :
              data.quality_score >= 7.5 ? "bg-blue-500/20 text-blue-300" :
              "bg-amber-500/20 text-amber-300"
            )}>
              {data.quality_score}
            </span>
          )}
        </div>
      </div>

      {/* Batch stats for execution nodes */}
      {data.batch_stats && (
        <div className="px-3 pb-2 flex items-center gap-2 text-[10px]">
          <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500/60 rounded-full transition-all duration-500"
              style={{ width: `${(data.batch_stats.completed / data.batch_stats.total_shots) * 100}%` }}
            />
          </div>
          <span className="text-muted-foreground">{data.batch_stats.completed}/{data.batch_stats.total_shots}</span>
        </div>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  pipeline: PipelineNodeComponent,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 布局计算 - 水平流式布局
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NODE_W = 180
const NODE_H = 100
const GAP_X = 80  // 增加水平间距
const GAP_Y = 60  // 增加垂直间距
const STAGE_GAP = 100 // Stage 之间的额外间距
const PARALLEL_OFFSET_Y = 120 // 并行节点的垂直偏移

export function DagView({ nodes, edges, stages, selectedNodeId, onNodeSelect }: DagViewProps) {
  const { rfNodes, rfEdges } = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.node_id, n]))
    const rfNodes: Node[] = []
    const nodePositions = new Map<string, { x: number; y: number }>()
    
    let x = 40
    const baseY = 200

    // 遍历所有 stage 计算节点位置
    for (const stage of stages) {
      // Stage 标签
      rfNodes.push({
        id: `stage-label-${stage.stage}`,
        type: "default",
        position: { x, y: 40 },
        data: { label: `Stage ${stage.stage}: ${stage.label}` },
        style: {
          background: "hsl(var(--secondary) / 0.3)",
          border: "1px solid hsl(var(--border) / 0.3)",
          color: "hsl(var(--muted-foreground))",
          fontSize: 11,
          fontWeight: 500,
          padding: "4px 12px",
          borderRadius: 6,
        },
        draggable: false,
        selectable: false,
      })

      // 计算 stage 内节点
      for (const nodeId of stage.nodes) {
        const node = nodeMap.get(nodeId)
        if (!node) continue

        // 处理并行节点 (N07b 与 N07 并行)
        if (nodeId === "N07b") {
          const n07Pos = nodePositions.get("N07")
          if (n07Pos) {
            const pos = { x: n07Pos.x, y: n07Pos.y + PARALLEL_OFFSET_Y }
            nodePositions.set(nodeId, pos)
            rfNodes.push({
              id: nodeId,
              type: "pipeline",
              position: pos,
              data: { ...node, selected: selectedNodeId === nodeId },
            })
            continue
          }
        }

        const pos = { x, y: baseY }
        nodePositions.set(nodeId, pos)
        
        rfNodes.push({
          id: nodeId,
          type: "pipeline",
          position: pos,
          data: { ...node, selected: selectedNodeId === nodeId },
        })

        x += NODE_W + GAP_X
      }

      // Stage 结束后增加额外间距
      x += STAGE_GAP - GAP_X
    }

    // 构建边
    const rfEdges: Edge[] = edges.map((e, i) => {
      const fromNode = nodeMap.get(e.from)
      const toNode = nodeMap.get(e.to)
      const isCompleted = fromNode?.status === "completed" || fromNode?.status === "gate_approved"
      const isRunning = fromNode?.status === "running"
      const isParallel = e.type === "parallel"
      const isReturn = e.type === "return"

      // 判断是否需要弯曲的边（跨行）
      const fromPos = nodePositions.get(e.from)
      const toPos = nodePositions.get(e.to)
      const needsCurve = fromPos && toPos && Math.abs(fromPos.y - toPos.y) > 50

      return {
        id: `e-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        type: needsCurve ? "smoothstep" : "default",
        animated: isRunning,
        style: {
          stroke: isCompleted ? "#10B981" : isRunning ? "#3B82F6" : isReturn ? "#F59E0B" : "#52525b",
          strokeWidth: isRunning ? 2.5 : 2,
          strokeDasharray: isReturn ? "8,4" : isParallel ? "4,4" : undefined,
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed, 
          width: 16, 
          height: 16, 
          color: isCompleted ? "#10B981" : isRunning ? "#3B82F6" : isReturn ? "#F59E0B" : "#52525b",
        },
        label: isParallel ? "并行" : undefined,
        labelStyle: { fontSize: 9, fill: "#71717a" },
        labelBgStyle: { fill: "hsl(var(--background))", fillOpacity: 0.8 },
      }
    })

    return { rfNodes, rfEdges }
  }, [nodes, edges, stages, selectedNodeId])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("stage-")) return
    onNodeSelect(node.id)
  }, [onNodeSelect])

  return (
    <div className="w-full h-full bg-gradient-to-br from-background via-background to-secondary/10">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: "default" }}
      >
        <Background color="hsl(var(--border) / 0.3)" gap={50} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-card/90 !backdrop-blur !border-border/50 !shadow-xl [&>button]:!bg-card [&>button]:!border-border/50 [&>button]:!text-foreground [&>button:hover]:!bg-secondary"
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as TraceNode
            if (!data?.status) return "#374151"
            return data.status === "completed" || data.status === "gate_approved" ? "#10B981" :
                   data.status === "running" ? "#3B82F6" :
                   data.status === "failed" ? "#EF4444" : "#52525b"
          }}
          maskColor="rgba(0,0,0,0.85)"
          className="!bg-card/90 !border-border/50"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}
