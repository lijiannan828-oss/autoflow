import type { DramaDetailData, EpisodeInstance, PipelineNode, Phase, NodeStatus } from "./drama-detail-types"
import { PHASES, GLOBAL_NODES, EPISODE_NODES } from "./drama-detail-types"

// Generate episode instances
function generateEpisodes(count: number): EpisodeInstance[] {
  const episodes: EpisodeInstance[] = []
  for (let i = 1; i <= count; i++) {
    let status: EpisodeInstance["status"] = "queued"
    let currentNode: number | undefined
    let errorNode: number | undefined
    let progress = 0

    if (i <= 6) {
      status = "completed"
      progress = 100
    } else if (i === 7) {
      status = "running"
      currentNode = 13
      progress = 45
    } else if (i === 8) {
      status = "running"
      currentNode = 9
      progress = 25
    } else if (i === 14) {
      status = "failed"
      errorNode = 12
      progress = 35
    } else if (i <= 20) {
      status = "pending"
      progress = 0
    } else {
      status = "queued"
      progress = 0
    }

    episodes.push({
      id: `ep-${i}`,
      episodeNumber: i,
      status,
      currentNode,
      errorNode,
      progress,
    })
  }
  return episodes
}

// Generate nodes for a phase
function generateNodesForPhase(
  phaseId: string, 
  nodeNumbers: number[], 
  isGlobal: boolean,
  episodeStatus?: EpisodeInstance["status"],
  currentNode?: number,
  errorNode?: number
): PipelineNode[] {
  const nodeList = isGlobal ? GLOBAL_NODES : EPISODE_NODES
  
  return nodeNumbers.map((num) => {
    const nodeDef = nodeList.find(n => n.number === num)
    if (!nodeDef) return null

    let status: NodeStatus = "pending"
    
    if (isGlobal) {
      // Global nodes are all completed
      status = "completed"
    } else if (episodeStatus === "completed") {
      status = "completed"
    } else if (episodeStatus === "failed" && errorNode && num === errorNode) {
      status = "failed"
    } else if (episodeStatus === "failed" && errorNode && num < errorNode) {
      status = "completed"
    } else if (currentNode && num < currentNode) {
      status = "completed"
    } else if (currentNode && num === currentNode) {
      status = "running"
    }

    return {
      id: `node-${num}`,
      nodeNumber: num,
      name: nodeDef.name,
      isHumanNode: nodeDef.isHuman,
      status,
      input: generateNodeInput(num),
      output: generateNodeOutput(num, status),
      telemetry: generateNodeTelemetry(num, status),
    }
  }).filter(Boolean) as PipelineNode[]
}

// Generate node input based on node number
function generateNodeInput(nodeNumber: number): PipelineNode["input"] {
  const inputs: Record<number, PipelineNode["input"]> = {
    1: { type: "text", label: "剧本", content: "《万斯家族的回响》完整剧本文本..." },
    2: { type: "mixed", label: "美术资产", content: null, items: [
      { id: "i1", type: "image", label: "克莱尔-女佣装", preview: "#4a5568" },
      { id: "i2", type: "image", label: "克莱尔-千金装", preview: "#6b5b95" },
      { id: "i3", type: "image", label: "维多利亚", preview: "#d4af37" },
    ]},
    3: { type: "mixed", label: "人类建议", content: "维多利亚的服装需要更奢华..." },
    4: { type: "text", label: "剧本", content: "第7集剧本片段..." },
    5: { type: "json", label: "分集分镜JSON", content: { scenes: 45, shots: 128 } },
    6: { type: "json", label: "分镜多模型审核建议", content: { suggestions: ["场景3镜头过多", "节奏需要调整"] } },
    7: { type: "json", label: "分集分镜JSON", content: { scenes: 45, shots: 128 } },
    8: { type: "json", label: "分集分镜JSON + 镜头分级表", content: { S0: 12, S1: 45, S2: 71 } },
    9: { type: "mixed", label: "关键帧提示词 + 美术资产", content: null, items: [
      { id: "p1", type: "text", label: "S001提示词", preview: "写实。全景，正面拍摄..." },
      { id: "p2", type: "image", label: "克莱尔参考", preview: "#4a5568" },
    ]},
    10: { type: "mixed", label: "关键帧", content: null, items: [
      { id: "k1", type: "image", label: "S001-KF-V1", preview: "#3d5a6b" },
      { id: "k2", type: "image", label: "S001-KF-V2", preview: "#4a6b3d" },
      { id: "k3", type: "image", label: "S001-KF-V3", preview: "#6b3d5a" },
    ]},
    11: { type: "mixed", label: "最高分关键帧", content: null, items: [
      { id: "k1", type: "image", label: "S001-KF-V2 (92分)", preview: "#4a6b3d" },
    ]},
    12: { type: "mixed", label: "待修改关键帧 + 建议", content: null },
    13: { type: "mixed", label: "定稿关键帧 + 视频提示词", content: null, items: [
      { id: "v1", type: "image", label: "S001-KF定稿", preview: "#4a6b3d" },
      { id: "v2", type: "text", label: "视频提示词", preview: "镜头缓慢推进..." },
    ]},
    14: { type: "mixed", label: "视频素材", content: null, items: [
      { id: "v1", type: "video", label: "S001-V1", preview: "#3d5a6b" },
      { id: "v2", type: "video", label: "S001-V2", preview: "#4a6b3d" },
    ]},
    15: { type: "mixed", label: "最高分视频素材", content: null },
    16: { type: "mixed", label: "剧情检查建议 + 视频", content: null },
    17: { type: "mixed", label: "关键帧 + 视频素材", content: null },
    18: { type: "mixed", label: "人类检查建议", content: null },
    19: { type: "mixed", label: "视觉素材 + 台词剧本", content: null },
    20: { type: "mixed", label: "整合后的多轨素材", content: null },
    21: { type: "mixed", label: "多轨素材 + 人类建议", content: null },
    22: { type: "mixed", label: "视听多轨素材JSON", content: null },
    23: { type: "video", label: "合成后的成片", content: null },
    24: { type: "mixed", label: "人类检查建议 + 成片", content: null },
  }
  return inputs[nodeNumber] || { type: "text", label: "输入数据", content: null }
}

// Generate node output based on node number and status
function generateNodeOutput(nodeNumber: number, status: NodeStatus): PipelineNode["output"] {
  if (status === "pending" || status === "queued") {
    return { type: "text", label: "等待执行", content: null }
  }
  if (status === "running") {
    return { type: "text", label: "正在生成...", content: null }
  }
  if (status === "failed") {
    return { type: "text", label: "执行失败", content: "模型返回超时，请重试" }
  }

  const outputs: Record<number, PipelineNode["output"]> = {
    1: { type: "json", label: "内容提炼结果", content: {
      summary: "克莱尔隐姓埋名潜入仇人家族...",
      highlights: ["红酒泼身", "降维打击", "复仇宣战"],
      characters: 6,
      scenes: 5,
      props: 3,
    }},
    2: { type: "text", label: "人类建议", content: "维多利亚的礼服需要更加奢华，建议添加珠宝配饰..." },
    3: { type: "mixed", label: "定稿美术资产", content: null, items: [
      { id: "o1", type: "image", label: "克莱尔-女佣装 (定稿)", preview: "#4a5568" },
      { id: "o2", type: "image", label: "克莱尔-千金装 (定稿)", preview: "#6b5b95" },
    ]},
    4: { type: "json", label: "分镜JSON", content: { scenes: 45, shots: 128, duration: "52min" } },
    5: { type: "json", label: "审核建议", content: { passed: true, suggestions: ["场景3可优化"] } },
    6: { type: "json", label: "分镜定稿", content: { scenes: 44, shots: 125, version: "final" } },
    7: { type: "json", label: "镜头分级表", content: { S0: 12, S1: 45, S2: 68, total: 125 } },
    8: { type: "json", label: "提示词包", content: {
      S0_keyframes: "每镜头3版",
      S0_videos: "每镜头2版",
      S1_keyframes: "每镜头2版",
      S1_videos: "每镜头1版",
      S2_keyframes: "每镜头1版",
      S2_videos: "每镜头1版",
    }},
    9: { type: "mixed", label: "关键帧", content: null, items: [
      { id: "o1", type: "image", label: "S001-KF-V1 (85分)", preview: "#3d5a6b" },
      { id: "o2", type: "image", label: "S001-KF-V2 (92分)", preview: "#4a6b3d" },
      { id: "o3", type: "image", label: "S001-KF-V3 (78分)", preview: "#6b3d5a" },
    ]},
    10: { type: "json", label: "多模型打分", content: {
      scores: [
        { model: "GPT-4o", score: 92, deductions: [] },
        { model: "Claude", score: 89, deductions: ["光影略暗"] },
        { model: "Gemini", score: 88, deductions: ["构图偏左"] },
      ],
      winner: "S001-KF-V2",
    }},
    11: { type: "json", label: "剧情检查结果", content: {
      passed: true,
      continuityIssues: [],
      suggestions: ["S015需要调整表情"],
    }},
    12: { type: "mixed", label: "定稿关键帧", content: null },
    13: { type: "mixed", label: "视频素材", content: null, items: [
      { id: "o1", type: "video", label: "S001-V1 (87分)", preview: "#3d5a6b" },
      { id: "o2", type: "video", label: "S001-V2 (91分)", preview: "#4a6b3d" },
    ]},
    14: { type: "json", label: "多模型打分", content: { winner: "S001-V2", avgScore: 89 } },
    15: { type: "json", label: "剧情节奏检查", content: { passed: true } },
    16: { type: "mixed", label: "定稿视频素材", content: null },
    17: { type: "text", label: "人类修改建议", content: "S023的过渡镜头需要延长0.5秒..." },
    18: { type: "mixed", label: "视觉素材定稿", content: null },
    19: { type: "mixed", label: "视听整合结果", content: null, items: [
      { id: "o1", type: "audio", label: "TTS对白轨道", preview: "audio" },
      { id: "o2", type: "json", label: "SFX时间轴", preview: "json" },
      { id: "o3", type: "json", label: "BGM时间轴", preview: "json" },
    ]},
    20: { type: "text", label: "人类修改建议", content: "BGM入点需要提前2秒..." },
    21: { type: "mixed", label: "视听定稿", content: null },
    22: { type: "video", label: "合成成片", content: null },
    23: { type: "text", label: "人类检查建议", content: "12:34处对白音量偏低..." },
    24: { type: "video", label: "成片定稿", content: null },
  }
  return outputs[nodeNumber] || { type: "text", label: "输出数据", content: null }
}

// Generate telemetry data
function generateNodeTelemetry(nodeNumber: number, status: NodeStatus): PipelineNode["telemetry"] {
  if (status === "pending" || status === "queued") {
    return { duration: "-" }
  }
  if (status === "running") {
    return { duration: "运行中...", model: getModelForNode(nodeNumber) }
  }
  if (status === "failed") {
    return { 
      duration: "1m 24s", 
      model: getModelForNode(nodeNumber),
      errorMessage: "API调用超时，已重试3次" 
    }
  }

  const baseTelemetry: Record<number, PipelineNode["telemetry"]> = {
    1: { duration: "45s", model: "GPT-4o", tokens: 12500, cost: 0.15 },
    2: { duration: "8m 32s", cost: 0 }, // Human node
    3: { duration: "12s", model: "Internal", cost: 0.01 },
    4: { duration: "2m 15s", model: "GPT-4o", tokens: 28000, cost: 0.35 },
    5: { duration: "1m 8s", model: "Multi-Model", apiCalls: 3, cost: 0.25 },
    6: { duration: "8s", model: "Internal", cost: 0.01 },
    7: { duration: "32s", model: "GPT-4o", tokens: 8500, cost: 0.10 },
    8: { duration: "3m 45s", model: "GPT-4o", tokens: 45000, cost: 0.55 },
    9: { duration: "12m 30s", model: "FLUX Pro", apiCalls: 128, cost: 2.50 },
    10: { duration: "2m 15s", model: "Multi-Model", apiCalls: 384, cost: 0.95 },
    11: { duration: "1m 45s", model: "GPT-4o", tokens: 18000, cost: 0.22 },
    12: { duration: "15s", model: "Internal", cost: 0.02 },
    13: { duration: "28m 15s", model: "Wan 2.6", apiCalls: 125, cost: 8.50 },
    14: { duration: "3m 30s", model: "Multi-Model", apiCalls: 375, cost: 1.25 },
    15: { duration: "2m 10s", model: "GPT-4o", tokens: 22000, cost: 0.28 },
    16: { duration: "18s", model: "Internal", cost: 0.02 },
    17: { duration: "15m 45s", cost: 0 }, // Human node
    18: { duration: "12s", model: "Internal", cost: 0.01 },
    19: { duration: "8m 20s", model: "TTS + Audio", apiCalls: 45, cost: 1.80 },
    20: { duration: "12m 30s", cost: 0 }, // Human node
    21: { duration: "15s", model: "Internal", cost: 0.01 },
    22: { duration: "5m 45s", model: "FFmpeg", cost: 0.15 },
    23: { duration: "18m 20s", cost: 0 }, // Human node
    24: { duration: "8s", model: "Internal", cost: 0.01 },
  }
  return baseTelemetry[nodeNumber] || { duration: "1m 0s" }
}

function getModelForNode(nodeNumber: number): string | undefined {
  const models: Record<number, string> = {
    1: "GPT-4o", 4: "GPT-4o", 5: "Multi-Model", 7: "GPT-4o", 8: "GPT-4o",
    9: "FLUX Pro", 10: "Multi-Model", 11: "GPT-4o", 13: "Wan 2.6",
    14: "Multi-Model", 15: "GPT-4o", 19: "TTS + Audio", 22: "FFmpeg"
  }
  return models[nodeNumber]
}

// Generate phases with nodes
function generatePhases(
  isGlobal: boolean, 
  episodeStatus?: EpisodeInstance["status"],
  currentNode?: number,
  errorNode?: number
): Phase[] {
  if (isGlobal) {
    // Only return the first phase for global mode
    return [{
      id: "script-assets",
      name: "剧本与资产",
      nodeRange: "节点 1-3",
      nodes: generateNodesForPhase("script-assets", [1, 2, 3], true),
    }]
  }

  return PHASES.slice(1).map(phase => ({
    id: phase.id,
    name: phase.name,
    nodeRange: phase.nodeRange,
    nodes: generateNodesForPhase(phase.id, phase.nodeNumbers, false, episodeStatus, currentNode, errorNode),
  }))
}

// Main mock data
export const dramaDetailData: DramaDetailData = {
  id: "drama-1",
  title: "万斯家族的回响",
  totalEpisodes: 30,
  totalDuration: "45h 32m",
  totalCost: 1250.50,
  completedEpisodes: 6,
  episodes: generateEpisodes(30),
  globalPhases: generatePhases(true),
  episodePhases: generatePhases(false, "running", 13),
}

// Get phases for a specific episode
export function getPhasesForEpisode(episode: EpisodeInstance): Phase[] {
  return generatePhases(false, episode.status, episode.currentNode, episode.errorNode)
}
