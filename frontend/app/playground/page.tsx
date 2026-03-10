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
  processData?: Record<string, unknown> // Process metadata
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
    const processData = generateMockProcessData(spec)

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
            processData: processData,
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

  // Pause/Resume global
  const togglePause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: !prev.isPaused }))
  }, [])

  // Pause single node
  const pauseNode = useCallback((nodeId: string) => {
    setState((prev) => ({
      ...prev,
      nodes: {
        ...prev.nodes,
        [nodeId]: {
          ...prev.nodes[nodeId],
          status: "paused",
        },
      },
    }))
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
      <div className="flex-1 flex min-h-0">
        {/* Left: IO Panel */}
        <div className="flex-1 overflow-y-auto p-4">
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
          onRunNode={runNode}
          onPauseNode={pauseNode}
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
  const mockInputs: Record<string, Record<string, unknown>> = {
    N01: {
      file_name: "都市情缘_完整剧本.txt",
      file_size: "52.3 KB",
      upload_time: new Date().toLocaleString("zh-CN"),
    },
    N02: {
      episode_number: 1,
      parsed_script_summary: "角色数: 5, 场景数: 8",
    },
    N03: {
      shot_count: 45,
    },
    N04: {
      qc_result_summary: "通过质检，加权分数 8.65",
      issue_count: 2,
    },
    N05: {
      frozen_shot_count: 45,
    },
    N06: {
      character_count: 5,
      location_count: 8,
      prop_count: 12,
    },
    N07: {
      art_plan_summary: "5 角色 × 4 候选 + 8 场景 × 3 变体 + 12 道具",
    },
    N07b: {
      character_count: 5,
      voice_requirements: "中文普通话，年轻都市风格",
    },
    N08: {
      pending_assets_count: 44,
    },
    N10: {
      shot_count: 45,
      difficulty_distribution: "S0: 15, S1: 25, S2: 5",
      current_shot: "shot_001",
      visual_prompt: "林晓站在咖啡馆门口，阳光从身后照来...",
      frozen_asset_refs: ["角色基线图", "场景参考图"],
    },
    N14: {
      frozen_keyframes: ["kf_001", "kf_002", "kf_003"],
      shot_spec_summary: "时长: 3.5s, 运镜: 推镜头",
    },
    N20: {
      frozen_video_count: 45,
      dialogue_line_count: 120,
      bgm_requirements: "都市轻快风格",
    },
    N23: {
      av_multitrack: "5轨音视频数据",
      shot_data: { total: 45, duration: "62s" },
    },
    N26: {
      final_episode: { id: "ep_001", duration: "62s" },
      distribution_config: { platforms: ["TikTok", "Feishu"] },
    },
  }
  return mockInputs[spec.id] || { upstream_output: `来自 ${spec.dependsOn.join(", ")} 的输出` }
}

function generateMockOutput(spec: NodeSpec): Record<string, unknown> {
  const mockOutputs: Record<string, Record<string, unknown>> = {
    N01: {
      world_setting: { genre: "都市爱情", era: "现代", style: "写实" },
      character_registry: [
        { 角色名: "林晓", 外貌描述: "25岁，长发，清秀" },
        { 角色名: "张伟", 外貌描述: "28岁，短发，帅气" },
        { 角色名: "李芳", 外貌描述: "26岁，职业装，干练" },
      ],
      location_registry: [
        { 场景名: "咖啡馆", 描述: "现代简约风格的咖啡厅" },
        { 场景名: "办公室", 描述: "明亮的开放式办公区" },
      ],
      episode_skeletons: "共 30 集",
    },
    N02: {
      shot_count: 45,
      total_duration: "62 秒",
      shot_list: Array.from({ length: 5 }).map((_, i) => ({
        shot_id: `shot_${String(i + 1).padStart(3, "0")}`,
        shot_type: ["特写", "中景", "全景"][i % 3],
        camera_movement: ["固定", "推", "拉"][i % 3],
        duration_sec: (Math.random() * 2 + 1).toFixed(1),
        visual_prompt: "林晓站在咖啡馆门口...",
        角色数: Math.floor(Math.random() * 3) + 1,
      })),
      keyframe_specs_count: 90,
      motion_segments_count: 45,
    },
    N03: {
      radar_scores: { weighted_score: 8.65 },
      weighted_score: 8.65,
      decision: ["PASS", "质检通过"],
      issues: [
        { 维度: "连贯性", 问题描述: "第3镜与第4镜转场略显突兀", 严重程度: "低" },
      ],
      model_comparison: [
        { 模型: "Gemini 3.1", 分数: 8.7 },
        { 模型: "Claude Opus", 分数: 8.5 },
        { 模型: "GPT-5.4", 分数: 8.7 },
      ],
    },
    N04: {
      frozen_fields: ["shot_list", "keyframe_specs", "motion_segments"],
      diff: { before: "原始分镜", after: "修正后分镜" },
    },
    N05: {
      difficulty_distribution: { S0: 15, S1: 25, S2: 5 },
      qc_tier_distribution: { T1: 10, T2: 25, T3: 10 },
      keyframe_budget: "共 90 关键帧",
      shot_tier_list: Array.from({ length: 5 }).map((_, i) => ({
        shot_id: `shot_${String(i + 1).padStart(3, "0")}`,
        difficulty: ["S0", "S1", "S2"][i % 3],
        qc_tier: ["T1", "T2", "T3"][i % 3],
        keyframe_count: [1, 2, 3][i % 3],
        candidate_count: [2, 4, 6][i % 3],
        reason: "基于场景复杂度评估",
      })),
    },
    N06: {
      character_plan: [
        { name: "林晓", base_prompt: "年轻女性，长发，清秀面容", reference_strategy: "角色基线图", candidate_count: 4, resolution: "1024x1024" },
        { name: "张伟", base_prompt: "年轻男性，短发，帅气", reference_strategy: "角色基线图", candidate_count: 4, resolution: "1024x1024" },
      ],
      location_plan: [
        { location_id: "咖啡馆", time_variants: ["日间", "夜间"], candidate_count: 3 },
        { location_id: "办公室", time_variants: ["日间"], candidate_count: 3 },
      ],
      prop_plan: [
        { prop_id: "咖啡杯", prompt: "白色陶瓷咖啡杯", candidate_count: 2 },
      ],
      total_images: 44,
    },
    N07: {
      image_grid: ["角色候选图1", "角色候选图2", "场景候选图1"],
      generation_progress: 85,
    },
    N07b: {
      audio_cards: [
        { name: "林晓", samples: 3 },
        { name: "张伟", samples: 3 },
      ],
    },
    N08: {
      review_decisions: [
        { 资产ID: "林晓", 选定候选: 2, 反馈: "表情自然" },
        { 资产ID: "张伟", 选定候选: 1, 反馈: "形象符合" },
      ],
      rejected_assets: ["道具-杂志"],
    },
    N09: {
      frozen_art_grid: ["冻结资产1", "冻结资产2"],
      firered_comparison: { before: "原始", after: "FireRed增强" },
    },
    N10: {
      phase1_keyframes: Array.from({ length: 5 }).map((_, i) => ({
        shot_id: `shot_${String(i + 1).padStart(3, "0")}`,
        kf_index: 0,
        timestamp: "0:00",
        prompt: "林晓站在咖啡馆门口，阳光从身后照来...",
      })),
      motion_script: "匀速推镜头，3秒",
      phase2_images: ["关键帧图1", "关键帧图2", "关键帧图3"],
      generation_progress: 72,
    },
    N11: {
      radar_scores: { weighted_score: 8.5 },
      model_comparison: [
        { 模型: "Gemini 3.1", 分数: 8.6 },
        { 模型: "Claude Opus", 分数: 8.4 },
        { 模型: "GPT-5.4", 分数: 8.5 },
      ],
      selected_candidate: "候选 2",
      decision: ["PASS"],
      issues: [],
    },
    N12: {
      overall_score: 8.7,
      issues: [
        { severity: "低", shot_id: "shot_012", 问题描述: "光线不一致", 修复建议: "调整曝光" },
      ],
    },
    N13: {
      frozen_keyframes: ["冻结关键帧1", "冻结关键帧2"],
      adjustment_comparison: { before: "调整前", after: "调整后" },
    },
    N14: {
      video_grid: ["视频候选1", "视频候选2"],
      generation_progress: 65,
    },
    N15: {
      radar_scores: { weighted_score: 8.4 },
      model_comparison: [
        { 模型: "Gemini 3.1", 分数: 8.5 },
        { 模型: "Claude Opus", 分数: 8.3 },
        { 模型: "GPT-5.4", 分数: 8.4 },
      ],
      selected_candidate: "候选 1",
      decision: ["PASS"],
      special_rules: "所有维度 >= 5.0",
    },
    N16: {
      overall_rhythm_score: 8.6,
      duration_deviation: "+2.3s",
      shot_rhythm_table: [
        { shot_id: "shot_001", planned: "2.5s", actual: "2.8s", judgment: "略长", trim_suggestion: "-0.3s" },
      ],
      transition_analysis: "转场流畅",
    },
    N16b: {
      adjustment_list: [
        { shot_id: "shot_001", 调整类型: "裁剪", 参数: "-0.3s", 时长变化: "2.8s -> 2.5s" },
      ],
      video_comparison: ["调整前", "调整后"],
    },
    N17: {
      frozen_videos: ["冻结视频1", "冻结视频2"],
      file_size_stats: "总计 128MB",
    },
    N18: {
      review_results: [
        { shot_id: "shot_001", 决策: "通过", 反馈: "质量良好" },
        { shot_id: "shot_002", 决策: "通过", 反馈: "符合要求" },
      ],
    },
    N19: {
      frozen_status: "已冻结",
    },
    N20: {
      multitrack_timeline: "5轨时间线",
      substep_progress: [
        { label: "TTS", status: "completed" },
        { label: "STT对齐", status: "completed" },
        { label: "唇形同步", status: "completed" },
        { label: "BGM", status: "completed" },
        { label: "SFX", status: "completed" },
        { label: "混音", status: "completed" },
      ],
    },
    N21: {
      review_decision: "通过",
      feedback: "音视频同步良好，整体效果符合预期",
    },
    N22: {
      frozen_status: "已冻结",
    },
    N23: {
      final_video: ["最终成片预览"],
      metadata: {
        duration: "62s",
        resolution: "1920x1080",
        fps: 30,
        codec: "H.264",
      },
      highlight_shots: ["shot_005", "shot_023", "shot_041"],
    },
    N24: {
      review_status: [
        { label: "技术审核", status: "completed" },
        { label: "内容审核", status: "completed" },
        { label: "最终确认", status: "completed" },
      ],
      step_decisions: [
        { 步骤: "技术审核", 决策: "通过", 反馈: "画质达标" },
        { 步骤: "内容审核", 决策: "通过", 反馈: "内容合规" },
        { 步骤: "最终确认", 决策: "通过", 反馈: "准予发布" },
      ],
    },
    N25: {
      delivered_status: "已交付",
      archive_policy: "保留30天后归档",
    },
    N26: {
      platform_status: [
        { label: "TikTok", status: "completed" },
        { label: "Feishu", status: "completed" },
      ],
      external_links: ["https://tiktok.com/...", "https://feishu.cn/..."],
    },
  }

  if (spec.isQC) {
    return {
      weighted_score: (Math.random() * 2 + 8).toFixed(2),
      dimensions: spec.qcConfig?.dimensions.map((d) => ({
        name: d.name,
        label: d.label,
        score: (Math.random() * 2 + 7.5).toFixed(1),
      })),
      passed: true,
      ...mockOutputs[spec.id],
    }
  }

  return mockOutputs[spec.id] || {
    success: true,
    artifacts_count: Math.floor(Math.random() * 10) + 1,
  }
}

function generateMockProcessData(spec: NodeSpec): Record<string, unknown> {
  const baseData: Record<string, Record<string, unknown>> = {
    N01: {
      model: "gemini-3.1-pro-preview",
      token_in: 52000,
      token_out: 8500,
      duration_s: 12.5,
      cost_cny: 0.85,
    },
    N02: {
      model: "claude-opus-4-6",
      tokens: 35000,
      duration_s: 8.3,
      cost_cny: 1.2,
    },
    N03: {
      voting_models: ["gemini-3.1-pro", "claude-opus-4-6", "gpt-5.4"],
      duration_s: 15.2,
      cost_cny: 2.1,
      reject_count: 0,
    },
    N04: {
      conditional_llm: "否",
      duration_s: 0.5,
      cost_cny: 0,
    },
    N05: {
      model: "gemini-3.1-flash",
      duration_s: 3.2,
      cost_cny: 0.15,
    },
    N06: {
      model: "claude-opus-4-6",
      duration_s: 6.8,
      cost_cny: 0.95,
    },
    N07: {
      comfyui_workflow_id: "wf_art_gen_v3",
      total_gpu_seconds: 180,
      cost_cny: 3.6,
      resolution: "1024x1024",
    },
    N07b: {
      voice_engine: "ElevenLabs",
      duration_s: 25.0,
      cost_cny: 1.5,
    },
    N10: {
      llm_model: "claude-opus-4-6",
      prompt_source: ["RAG检索", "模板填充"],
      llm_duration_s: 5.2,
      llm_cost_cny: 0.7,
      comfyui_model: "FLUX.2 Dev",
      total_gpu_seconds: 420,
      gpu_cost_cny: 8.4,
      resolution: "1920x1080",
      controlnet_type: "Canny",
    },
    N11: {
      qc_tier: "T2",
      voting_models: ["gemini-3.1-pro", "claude-opus-4-6"],
      weighted_score: 8.65,
      threshold: 8.0,
      duration_s: 12.5,
      cost_cny: 1.8,
    },
    N12: {
      model: "gemini-3.1-pro-vision",
      images_analyzed: 45,
      duration_s: 18.3,
      cost_cny: 2.5,
    },
    N13: {
      adjusted_count: 3,
      firered_edits: 2,
      duration_s: 8.5,
      cost_cny: 1.2,
    },
    N14: {
      model: ["LTX-2.3", "Kling-1.6"],
      keyframe_count: 90,
      num_frames: 121,
      resolution: "1920x1080",
      gpu_seconds: 1800,
      cost_cny: 36.0,
    },
    N15: {
      qc_tier: "T2",
      voting_models: ["gemini-3.1-pro", "claude-opus-4-6", "gpt-5.4"],
      weighted_score: 8.45,
      threshold: 8.0,
      duration_s: 25.0,
      cost_cny: 3.5,
    },
    N16: {
      model: "gemini-3.1-pro-vision",
      duration_s: 8.2,
      cost_cny: 1.1,
    },
    N16b: {
      adjustments_count: 5,
      ffmpeg_ops: ["trim", "speed"],
      duration_s: 12.0,
    },
    N17: {
      total_size_mb: 128,
      upscaled: "否",
      codec: "H.264",
      duration_s: 15.0,
    },
    N20: {
      tts_engine: "ElevenLabs",
      tts_lines: 120,
      lipsync_applied: "是",
      bgm_model: "Suno",
      duration_s: 45.0,
      cost_cny: 8.5,
    },
    N23: {
      codec: "H.264",
      file_size_mb: 45.2,
      resolution: "1920x1080",
      fps: 30,
      duration_s: 18.0,
      cost_cny: 0.5,
    },
    N26: {
      platforms: ["TikTok", "Feishu"],
      publish_status: "已发布",
      duration_s: 5.0,
    },
  }

  return baseData[spec.id] || {
    duration_s: (Math.random() * 10 + 2).toFixed(1),
    cost_cny: (Math.random() * 2).toFixed(2),
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
