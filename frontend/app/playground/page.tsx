"use client"

import { useState, useCallback } from "react"
import { NODE_SPECS, type NodeSpec } from "@/lib/node-specs"
import { PipelineOverviewHeader } from "@/components/playground/pipeline-overview-header"
import { NodeFlowSidebar } from "@/components/playground/node-flow-sidebar"
import { NodeIOPanel } from "@/components/playground/node-io-panel"
import { ScriptInputDialog } from "@/components/playground/script-input-dialog"

// Node execution status
export type PlaygroundNodeStatus = "idle" | "pending" | "running" | "completed" | "failed" | "paused" | "gate_waiting"

// Node execution data
export interface PlaygroundNodeData {
  nodeId: string
  status: PlaygroundNodeStatus
  startTime?: number
  endTime?: number
  durationMs?: number
  costCny?: number
  qualityScore?: number
  model?: string
  thinking?: string // Agent reasoning
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  retryCount?: number
  isConnectedToPrev?: boolean // Is connected to upstream
  isConnectedToNext?: boolean // Is connected to downstream
}

// Pipeline execution state
export interface PipelineExecutionState {
  isRunning: boolean
  isPaused: boolean
  scriptInput?: string
  currentNodeId?: string
  nodes: Record<string, PlaygroundNodeData>
  totalDurationMs: number
  totalCostCny: number
  avgQualityScore: number
  returnCount: number
  completedCount: number
}

// Initialize node data
function initializeNodes(): Record<string, PlaygroundNodeData> {
  const nodes: Record<string, PlaygroundNodeData> = {}
  NODE_SPECS.forEach((spec) => {
    nodes[spec.id] = {
      nodeId: spec.id,
      status: "idle",
      isConnectedToPrev: false, // Default disconnected
      isConnectedToNext: false,
    }
  })
  return nodes
}

export default function PlaygroundPage() {
  // Pipeline state
  const [state, setState] = useState<PipelineExecutionState>({
    isRunning: false,
    isPaused: false,
    nodes: initializeNodes(),
    totalDurationMs: 0,
    totalCostCny: 0,
    avgQualityScore: 0,
    returnCount: 0,
    completedCount: 0,
  })

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("N01")
  const [showScriptDialog, setShowScriptDialog] = useState(false)

  // Connect all nodes
  const connectAllNodes = useCallback(() => {
    setState((prev) => {
      const newNodes = { ...prev.nodes }
      Object.keys(newNodes).forEach((id) => {
        newNodes[id] = {
          ...newNodes[id],
          isConnectedToPrev: true,
          isConnectedToNext: true,
        }
      })
      return { ...prev, nodes: newNodes }
    })
  }, [])

  // Disconnect all nodes
  const disconnectAllNodes = useCallback(() => {
    setState((prev) => {
      const newNodes = { ...prev.nodes }
      Object.keys(newNodes).forEach((id) => {
        newNodes[id] = {
          ...newNodes[id],
          isConnectedToPrev: false,
          isConnectedToNext: false,
        }
      })
      return { ...prev, nodes: newNodes }
    })
  }, [])

  // Toggle single node connection
  const toggleNodeConnection = useCallback((nodeId: string, direction: "prev" | "next") => {
    setState((prev) => {
      const newNodes = { ...prev.nodes }
      if (direction === "prev") {
        newNodes[nodeId] = {
          ...newNodes[nodeId],
          isConnectedToPrev: !newNodes[nodeId].isConnectedToPrev,
        }
      } else {
        newNodes[nodeId] = {
          ...newNodes[nodeId],
          isConnectedToNext: !newNodes[nodeId].isConnectedToNext,
        }
      }
      return { ...prev, nodes: newNodes }
    })
  }, [])

  // Simulate node execution
  const simulateNodeExecution = useCallback(async (nodeId: string) => {
    const spec = NODE_SPECS.find((n) => n.id === nodeId)
    if (!spec) return

    // Set running
    setState((prev) => ({
      ...prev,
      isRunning: true,
      currentNodeId: nodeId,
      nodes: {
        ...prev.nodes,
        [nodeId]: {
          ...prev.nodes[nodeId],
          status: "running",
          startTime: Date.now(),
          thinking: generateThinking(spec),
          input: generateMockInput(spec),
        },
      },
    }))

    // Simulate execution time (1-5 seconds based on category)
    const execTime = getExecutionTime(spec.category)
    await new Promise((r) => setTimeout(r, execTime))

    // Check if gate node
    if (spec.isGate) {
      setState((prev) => ({
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: {
            ...prev.nodes[nodeId],
            status: "gate_waiting",
            durationMs: execTime,
          },
        },
      }))
      return
    }

    // Complete
    const cost = getMockCost(spec)
    const score = spec.isQC ? Math.random() * 2 + 8 : undefined

    setState((prev) => {
      const completedCount = prev.completedCount + 1
      const totalCost = prev.totalCostCny + cost
      const allScores = Object.values(prev.nodes)
        .filter((n) => n.qualityScore != null)
        .map((n) => n.qualityScore!)
      if (score) allScores.push(score)
      const avgScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0

      return {
        ...prev,
        isRunning: false,
        totalDurationMs: prev.totalDurationMs + execTime,
        totalCostCny: totalCost,
        avgQualityScore: avgScore,
        completedCount,
        nodes: {
          ...prev.nodes,
          [nodeId]: {
            ...prev.nodes[nodeId],
            status: "completed",
            endTime: Date.now(),
            durationMs: execTime,
            costCny: cost,
            qualityScore: score,
            model: spec.model || undefined,
            output: generateMockOutput(spec),
          },
        },
      }
    })
  }, [])

  // Run single node
  const runNode = useCallback(
    async (nodeId: string) => {
      await simulateNodeExecution(nodeId)
    },
    [simulateNodeExecution]
  )

  // Run from node (chain execution)
  const runFromNode = useCallback(
    async (startNodeId: string) => {
      const startIdx = NODE_SPECS.findIndex((n) => n.id === startNodeId)
      if (startIdx === -1) return

      for (let i = startIdx; i < NODE_SPECS.length; i++) {
        const nodeId = NODE_SPECS[i].id
        const node = state.nodes[nodeId]

        // Check if connected
        if (i > startIdx && !node.isConnectedToPrev) {
          break
        }

        // Check if paused
        if (state.isPaused) break

        await simulateNodeExecution(nodeId)

        // If gate, stop and wait
        if (state.nodes[nodeId]?.status === "gate_waiting") {
          break
        }
      }
    },
    [state.nodes, state.isPaused, simulateNodeExecution]
  )

  // Approve gate
  const approveGate = useCallback(
    async (nodeId: string) => {
      setState((prev) => ({
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: {
            ...prev.nodes[nodeId],
            status: "completed",
            output: { approved: true, reviewer: "测试用户", feedback: "模拟人审通过" },
          },
        },
        completedCount: prev.completedCount + 1,
      }))

      // Continue to next if connected
      const spec = NODE_SPECS.find((n) => n.id === nodeId)
      const nextIdx = NODE_SPECS.findIndex((n) => n.id === nodeId) + 1
      if (nextIdx < NODE_SPECS.length) {
        const nextNode = state.nodes[NODE_SPECS[nextIdx].id]
        if (nextNode.isConnectedToPrev) {
          await runFromNode(NODE_SPECS[nextIdx].id)
        }
      }
    },
    [state.nodes, runFromNode]
  )

  // Pause/Resume
  const togglePause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: !prev.isPaused }))
  }, [])

  // Reset
  const resetPipeline = useCallback(() => {
    setState({
      isRunning: false,
      isPaused: false,
      nodes: initializeNodes(),
      totalDurationMs: 0,
      totalCostCny: 0,
      avgQualityScore: 0,
      returnCount: 0,
      completedCount: 0,
    })
    setSelectedNodeId("N01")
  }, [])

  // Handle script input
  const handleScriptSubmit = useCallback(
    async (script: string) => {
      setState((prev) => ({ ...prev, scriptInput: script }))
      setShowScriptDialog(false)
      // Start execution from N01
      await runFromNode("N01")
    },
    [runFromNode]
  )

  // Selected node data
  const selectedNode = selectedNodeId ? state.nodes[selectedNodeId] : null
  const selectedSpec = selectedNodeId ? NODE_SPECS.find((n) => n.id === selectedNodeId) : null

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* Top overview header */}
      <PipelineOverviewHeader
        state={state}
        onInputScript={() => setShowScriptDialog(true)}
        onConnectAll={connectAllNodes}
        onDisconnectAll={disconnectAllNodes}
        onReset={resetPipeline}
        onPause={togglePause}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: IO Panel */}
        <div className="flex-1 overflow-auto p-4">
          <NodeIOPanel
            nodeId={selectedNodeId}
            nodeData={selectedNode}
            nodeSpec={selectedSpec}
            onRunNode={runNode}
            onRunFromNode={runFromNode}
            onApproveGate={approveGate}
          />
        </div>

        {/* Right: Node flow sidebar */}
        <NodeFlowSidebar
          nodes={state.nodes}
          selectedNodeId={selectedNodeId}
          currentNodeId={state.currentNodeId}
          onSelectNode={setSelectedNodeId}
          onToggleConnection={toggleNodeConnection}
        />
      </div>

      {/* Script input dialog */}
      <ScriptInputDialog
        open={showScriptDialog}
        onOpenChange={setShowScriptDialog}
        onSubmit={handleScriptSubmit}
      />
    </div>
  )
}

// Helper functions
function generateThinking(spec: NodeSpec): string {
  const thinkings: Record<string, string> = {
    llm: `正在分析输入数据...
检索相关记忆库案例...
选择模型: ${spec.model}
设置参数: temperature=${spec.params.find((p) => p.key === "temperature")?.defaultValue || 0.5}
开始推理生成...`,
    qc: `启动多模型质检投票...
模型1: gemini-3.1-pro-preview
模型2: claude-opus-4-6
模型3: gpt-5.4
正在评估 ${spec.qcConfig?.dimensions.length || 6} 个维度...`,
    comfyui: `加载 ComfyUI 工作流...
模型: ${spec.model}
分辨率: ${spec.params.find((p) => p.key === "resolution")?.defaultValue || "1920x1080"}
开始生成...`,
    gate: `等待人工审核...`,
    freeze: `验证上游产物完整性...
生成快照...
标记为已冻结...`,
    audio: `初始化音频处理...
TTS: ElevenLabs
BGM: Suno
混音中...`,
    ffmpeg: `FFmpeg 合成中...
CRF: ${spec.params.find((p) => p.key === "crf")?.defaultValue || 23}
编码预设: ${spec.params.find((p) => p.key === "preset")?.defaultValue || "fast"}`,
    logic: `执行逻辑处理...`,
  }
  return thinkings[spec.category] || "执行中..."
}

function generateMockInput(spec: NodeSpec): Record<string, unknown> {
  if (spec.id === "N01") {
    return {
      script_text: "[剧本文本 - 约5万字]",
      narrative_arc: "三幕结构",
      character_presets: "主角: 林晓, 配角: 张伟, 李芳",
    }
  }
  if (spec.id === "N02") {
    return {
      parsed_script: { characters: 5, locations: 8, episodes: 30 },
      episode_number: 1,
    }
  }
  return {
    upstream_output: `来自 ${spec.dependsOn.join(", ")} 的输出`,
  }
}

function generateMockOutput(spec: NodeSpec): Record<string, unknown> {
  if (spec.isQC) {
    return {
      weighted_score: (Math.random() * 2 + 8).toFixed(2),
      dimensions: spec.qcConfig?.dimensions.map((d) => ({
        name: d.name,
        label: d.label,
        score: (Math.random() * 2 + 7.5).toFixed(1),
      })),
      passed: true,
    }
  }
  if (spec.category === "comfyui") {
    return {
      generated_count: Math.floor(Math.random() * 5) + 1,
      artifacts: ["artifact_001.png", "artifact_002.png"],
      workflow_id: "wf_" + Math.random().toString(36).substr(2, 9),
    }
  }
  return {
    success: true,
    artifacts_count: Math.floor(Math.random() * 10) + 1,
  }
}

function getExecutionTime(category: string): number {
  const times: Record<string, number> = {
    llm: 2000,
    qc: 3000,
    comfyui: 4000,
    gate: 500,
    freeze: 1000,
    audio: 3500,
    ffmpeg: 2500,
    logic: 500,
  }
  return times[category] || 1500
}

function getMockCost(spec: NodeSpec): number {
  const costs: Record<string, number> = {
    llm: 0.5,
    qc: 1.5,
    comfyui: 2.0,
    gate: 0,
    freeze: 0.1,
    audio: 1.0,
    ffmpeg: 0.2,
    logic: 0,
  }
  return costs[spec.category] || 0.1
}
