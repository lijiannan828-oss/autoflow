"use client"

import { useCallback, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Position,
  MarkerType,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { TraceNode, TraceEdge, StageInfo } from "./trace-types"
import { PipelineNode } from "./pipeline-node"

interface DagFlowProps {
  traceNodes: TraceNode[]
  traceEdges: TraceEdge[]
  stages: StageInfo[]
  selectedNodeId: string | null
  onNodeSelect: (nodeId: string) => void
}

const nodeTypes: NodeTypes = {
  pipeline: PipelineNode,
}

const NODE_W = 160
const NODE_H = 80
const GAP_X = 40
const GAP_Y = 30
const STAGE_LABEL_W = 100

export function DagFlow({ traceNodes, traceEdges, stages, selectedNodeId, onNodeSelect }: DagFlowProps) {
  // Layout: nodes positioned by stage row and column
  const { rfNodes, rfEdges } = useMemo(() => {
    const nodeMap = new Map(traceNodes.map(n => [n.node_id, n]))

    const rfNodes: Node[] = []
    let y = 0

    for (const stage of stages) {
      // Stage label node
      rfNodes.push({
        id: `stage-${stage.stage}`,
        type: "default",
        position: { x: 0, y: y + NODE_H / 2 - 10 },
        data: { label: `Stage ${stage.stage} · ${stage.label}` },
        style: {
          background: "transparent",
          border: "none",
          color: "#6B7280",
          fontSize: 11,
          fontWeight: 500,
          width: STAGE_LABEL_W - 10,
          padding: 0,
          textAlign: "right" as const,
        },
        draggable: false,
        selectable: false,
      })

      let x = STAGE_LABEL_W
      // Handle N07/N07b parallel: place N07b below N07
      const isArtStage = stage.nodes.includes("N07b")

      for (const nodeId of stage.nodes) {
        const node = nodeMap.get(nodeId)
        if (!node) continue

        let posY = y
        if (nodeId === "N07b") {
          // Place below N07 in same X position as N07
          const n07Node = rfNodes.find(n => n.id === "N07")
          if (n07Node) {
            rfNodes.push({
              id: nodeId,
              type: "pipeline",
              position: { x: n07Node.position.x, y: y + NODE_H + GAP_Y },
              data: { ...node, selected: selectedNodeId === nodeId },
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
            })
            continue
          }
        }

        rfNodes.push({
          id: nodeId,
          type: "pipeline",
          position: { x, y: posY },
          data: { ...node, selected: selectedNodeId === nodeId },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        })

        x += NODE_W + GAP_X
      }

      y += (isArtStage ? 2 : 1) * (NODE_H + GAP_Y) + 10
    }

    // Build edges
    const rfEdges: Edge[] = traceEdges.map((e, i) => {
      const fromNode = nodeMap.get(e.from)
      const isCompleted = fromNode?.status === "completed"
      const isRunning = fromNode?.status === "running"

      return {
        id: `e-${i}`,
        source: e.from,
        target: e.to,
        type: "default",
        animated: isRunning,
        style: {
          stroke: isCompleted ? "#10B981" : isRunning ? "#3B82F6" : e.type === "return" ? "#F59E0B" : "#374151",
          strokeWidth: 1.5,
          strokeDasharray: e.type === "return" ? "5,5" : undefined,
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: isCompleted ? "#10B981" : "#374151" },
      }
    })

    return { rfNodes, rfEdges }
  }, [traceNodes, traceEdges, stages, selectedNodeId])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("stage-")) return
    onNodeSelect(node.id)
  }, [onNodeSelect])

  return (
    <div className="w-full h-full" style={{ minHeight: 300 }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: "default" }}
      >
        <Background color="#1F2937" gap={30} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border !shadow-xl [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-secondary"
        />
      </ReactFlow>
    </div>
  )
}
