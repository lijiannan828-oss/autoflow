export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { runPythonReadApi } from "@/lib/python-read-api"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await context.params

  try {
    const result = await runPythonReadApi("get-episode-trace", [episodeId])
    if (result?.nodes && result.nodes.length > 0) {
      return NextResponse.json(result)
    }
  } catch {
    // Python bridge unavailable
  }

  // Fallback mock trace data for Phase 0
  return NextResponse.json(buildMockTrace(episodeId))
}

function buildMockTrace(episodeId: string) {
  const STAGES = [
    { stage: 1, label: "Script", nodes: ["N01", "N02", "N03", "N04", "N05"] },
    { stage: 2, label: "Art", nodes: ["N06", "N07", "N07b", "N08", "N09"] },
    { stage: 3, label: "Keyframe", nodes: ["N10", "N11", "N12", "N13"] },
    { stage: 4, label: "Video", nodes: ["N14", "N15", "N16", "N16b", "N17", "N18", "N19"] },
    { stage: 5, label: "AV", nodes: ["N20", "N21", "N22"] },
    { stage: 6, label: "Final", nodes: ["N23", "N24", "N25", "N26"] },
  ]

  const NODE_META: Record<string, { name: string; agent: string; category: string; decision_level: string; is_gate?: boolean }> = {
    N01: { name: "剧本解析", agent: "script_analyst", category: "llm", decision_level: "planning" },
    N02: { name: "拆集拆镜", agent: "shot_designer", category: "llm", decision_level: "planning" },
    N03: { name: "分镜质检", agent: "quality_inspector", category: "qc", decision_level: "review" },
    N04: { name: "分镜定稿", agent: "shot_designer", category: "freeze", decision_level: "freeze" },
    N05: { name: "镜头分级", agent: "shot_designer", category: "llm", decision_level: "planning" },
    N06: { name: "视觉策划", agent: "visual_director", category: "llm", decision_level: "planning" },
    N07: { name: "美术生成", agent: "visual_director", category: "comfyui", decision_level: "execution" },
    N07b: { name: "音色生成", agent: "audio_director", category: "comfyui", decision_level: "execution" },
    N08: { name: "Gate1·美术审核", agent: "review_dispatcher", category: "gate", decision_level: "gate", is_gate: true },
    N09: { name: "美术定稿", agent: "visual_director", category: "freeze", decision_level: "freeze" },
    N10: { name: "关键帧生成", agent: "visual_director", category: "comfyui", decision_level: "execution" },
    N11: { name: "关键帧质检", agent: "quality_inspector", category: "qc", decision_level: "review" },
    N12: { name: "连续性检查", agent: "quality_inspector", category: "llm", decision_level: "review" },
    N13: { name: "关键帧定稿", agent: "visual_director", category: "freeze", decision_level: "freeze" },
    N14: { name: "视频生成", agent: "visual_director", category: "comfyui", decision_level: "execution" },
    N15: { name: "视频质检", agent: "quality_inspector", category: "qc", decision_level: "review" },
    N16: { name: "节奏检查", agent: "shot_designer", category: "llm", decision_level: "review" },
    N16b: { name: "影调调整", agent: "compositor", category: "ffmpeg", decision_level: "execution" },
    N17: { name: "视频定稿", agent: "visual_director", category: "freeze", decision_level: "freeze" },
    N18: { name: "Gate2·视觉审核", agent: "review_dispatcher", category: "gate", decision_level: "gate", is_gate: true },
    N19: { name: "视觉定稿", agent: "visual_director", category: "freeze", decision_level: "freeze" },
    N20: { name: "视听整合", agent: "audio_director", category: "comfyui", decision_level: "execution" },
    N21: { name: "Gate3·视听审核", agent: "review_dispatcher", category: "gate", decision_level: "gate", is_gate: true },
    N22: { name: "视听定稿", agent: "audio_director", category: "freeze", decision_level: "freeze" },
    N23: { name: "成片合成", agent: "compositor", category: "ffmpeg", decision_level: "compose" },
    N24: { name: "Gate4·成片终审", agent: "review_dispatcher", category: "gate", decision_level: "gate", is_gate: true },
    N25: { name: "成片定稿", agent: "compositor", category: "freeze", decision_level: "freeze" },
    N26: { name: "分发推送", agent: "compositor", category: "api", decision_level: "compose" },
  }

  const allNodeIds = STAGES.flatMap(s => s.nodes)
  const completedCount = Math.floor(allNodeIds.length * 0.65)

  const nodes = allNodeIds.map((nodeId, i) => {
    const meta = NODE_META[nodeId] || { name: nodeId, agent: "unknown", category: "other", decision_level: "execution" }
    const stage = STAGES.find(s => s.nodes.includes(nodeId))!.stage
    let status: string
    if (i < completedCount) status = "completed"
    else if (i === completedCount) status = "running"
    else status = "pending"
    if (meta.is_gate && status === "completed") status = "completed"

    return {
      node_id: nodeId,
      node_name: meta.name,
      stage,
      category: meta.category,
      agent_name: meta.agent,
      status,
      decision_level: meta.decision_level,
      duration_seconds: status === "completed" ? Math.floor(Math.random() * 30) + 2 : null,
      cost_cny: status === "completed" ? +(Math.random() * 2).toFixed(2) : 0,
      quality_score: status === "completed" && ["qc", "comfyui"].includes(meta.category) ? +(7.5 + Math.random() * 2).toFixed(1) : null,
      model: meta.category === "llm" ? "Gemini 3.1" : meta.category === "comfyui" ? "FLUX.2 / LTX-2.3" : null,
      is_gate: !!meta.is_gate,
      version_no: 1,
    }
  })

  // Build edges
  const edges: { from: string; to: string; type: string }[] = []
  for (const stageInfo of STAGES) {
    for (let i = 0; i < stageInfo.nodes.length - 1; i++) {
      const fromNode = stageInfo.nodes[i]
      const toNode = stageInfo.nodes[i + 1]
      // N07 and N07b are parallel
      if (fromNode === "N07" && toNode === "N07b") continue
      if (fromNode === "N07b") {
        edges.push({ from: "N07b", to: "N08", type: "parallel" })
        continue
      }
      edges.push({ from: fromNode, to: toNode, type: "normal" })
    }
  }
  // N06 → N07b (parallel branch)
  edges.push({ from: "N06", to: "N07b", type: "parallel" })
  // Cross-stage edges
  edges.push({ from: "N05", to: "N06", type: "normal" })
  edges.push({ from: "N09", to: "N10", type: "normal" })
  edges.push({ from: "N13", to: "N14", type: "normal" })
  edges.push({ from: "N19", to: "N20", type: "normal" })
  edges.push({ from: "N22", to: "N23", type: "normal" })

  const completedNodes = nodes.filter(n => n.status === "completed")
  return {
    episode_id: episodeId,
    project_name: "万斯家的回响",
    episode_number: 3,
    versions: [{ version_no: 1, status: "running", is_current: true, created_at: new Date().toISOString() }],
    summary: {
      total_duration_seconds: completedNodes.reduce((s, n) => s + (n.duration_seconds || 0), 0),
      total_cost_cny: +completedNodes.reduce((s, n) => s + n.cost_cny, 0).toFixed(2),
      avg_quality_score: +(completedNodes.filter(n => n.quality_score).reduce((s, n) => s + (n.quality_score || 0), 0) / Math.max(1, completedNodes.filter(n => n.quality_score).length)).toFixed(1),
      completed_nodes: completedCount,
      total_nodes: allNodeIds.length,
      return_ticket_count: 0,
    },
    nodes,
    edges,
    stages: STAGES,
  }
}
