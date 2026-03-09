import type { EpisodeTask, GlobalMetrics, PipelineNodeState } from "./admin-types"

// Helper to generate node states up to a certain point
function generateNodeStates(currentNode: number, failedNode?: number): PipelineNodeState[] {
  const states: PipelineNodeState[] = []
  
  for (let i = 1; i <= 24; i++) {
    if (i < currentNode) {
      states.push({
        nodeId: i,
        status: i === failedNode ? "failed" : "completed",
        startTime: "2026-03-06T10:00:00",
        endTime: "2026-03-06T10:02:30",
        duration: Math.floor(Math.random() * 180) + 30,
        inputSummary: "输入数据已处理",
        outputSummary: "输出结果已生成",
        scores: i % 3 === 0 ? [
          { model: "GPT-4", score: 0.92 },
          { model: "Claude", score: 0.89 },
        ] : undefined,
        failReason: i === failedNode ? "质量分数低于阈值，需要重新生成" : undefined,
      })
    } else if (i === currentNode) {
      states.push({
        nodeId: i,
        status: "running",
        startTime: "2026-03-06T10:15:00",
        assignee: [2, 17, 20, 23].includes(i) ? "张三 (质检员)" : undefined,
      })
    } else {
      states.push({
        nodeId: i,
        status: "pending",
      })
    }
  }
  
  return states
}

// Sample episode tasks
export const episodeTasks: EpisodeTask[] = [
  {
    id: "ep-1",
    dramaTitle: "万斯家族的回响",
    episodeNumber: 1,
    coverColor: "#4a3f6b",
    currentNodeId: 10,
    nodeStates: generateNodeStates(10),
    totalDuration: 860,
    computeCost: 18.5,
    humanTime: 300,
    isWaitingHuman: false,
    isRunning: true,
    hasFailed: false,
    isCostOverrun: false,
  },
  {
    id: "ep-2",
    dramaTitle: "万斯家族的回响",
    episodeNumber: 2,
    coverColor: "#4a3f6b",
    currentNodeId: 17,
    nodeStates: generateNodeStates(17),
    totalDuration: 1240,
    computeCost: 32.0,
    humanTime: 420,
    isWaitingHuman: true,
    isRunning: false,
    hasFailed: false,
    isCostOverrun: false,
  },
  {
    id: "ep-3",
    dramaTitle: "深渊之上",
    episodeNumber: 5,
    coverColor: "#3d5a6b",
    currentNodeId: 8,
    nodeStates: generateNodeStates(8, 7),
    totalDuration: 520,
    computeCost: 12.3,
    humanTime: 180,
    isWaitingHuman: false,
    isRunning: false,
    hasFailed: true,
    isCostOverrun: false,
  },
  {
    id: "ep-4",
    dramaTitle: "逆流时光",
    episodeNumber: 3,
    coverColor: "#5a4a3d",
    currentNodeId: 20,
    nodeStates: generateNodeStates(20),
    totalDuration: 1580,
    computeCost: 48.5,
    humanTime: 600,
    isWaitingHuman: true,
    isRunning: false,
    hasFailed: false,
    isCostOverrun: true,
  },
  {
    id: "ep-5",
    dramaTitle: "星际迷途",
    episodeNumber: 1,
    coverColor: "#2d4a5a",
    currentNodeId: 4,
    nodeStates: generateNodeStates(4),
    totalDuration: 180,
    computeCost: 5.2,
    humanTime: 60,
    isWaitingHuman: false,
    isRunning: true,
    hasFailed: false,
    isCostOverrun: false,
  },
  {
    id: "ep-6",
    dramaTitle: "暗夜玫瑰",
    episodeNumber: 8,
    coverColor: "#5a2d4a",
    currentNodeId: 2,
    nodeStates: generateNodeStates(2),
    totalDuration: 45,
    computeCost: 1.8,
    humanTime: 0,
    isWaitingHuman: true,
    isRunning: false,
    hasFailed: false,
    isCostOverrun: false,
  },
  {
    id: "ep-7",
    dramaTitle: "权力游戏：东方篇",
    episodeNumber: 12,
    coverColor: "#4a5a2d",
    currentNodeId: 15,
    nodeStates: generateNodeStates(15),
    totalDuration: 1120,
    computeCost: 28.6,
    humanTime: 480,
    isWaitingHuman: false,
    isRunning: true,
    hasFailed: false,
    isCostOverrun: false,
  },
  {
    id: "ep-8",
    dramaTitle: "都市猎人",
    episodeNumber: 4,
    coverColor: "#3a4a5a",
    currentNodeId: 22,
    nodeStates: generateNodeStates(22),
    totalDuration: 1680,
    computeCost: 42.0,
    humanTime: 720,
    isWaitingHuman: false,
    isRunning: true,
    hasFailed: false,
    isCostOverrun: false,
  },
  {
    id: "ep-9",
    dramaTitle: "穿越千年的爱恋",
    episodeNumber: 6,
    coverColor: "#4a4a4a",
    currentNodeId: 13,
    nodeStates: generateNodeStates(13, 12),
    totalDuration: 980,
    computeCost: 55.2,
    humanTime: 360,
    isWaitingHuman: false,
    isRunning: false,
    hasFailed: true,
    isCostOverrun: true,
  },
  {
    id: "ep-10",
    dramaTitle: "商战风云",
    episodeNumber: 2,
    coverColor: "#3a3a4a",
    currentNodeId: 6,
    nodeStates: generateNodeStates(6),
    totalDuration: 320,
    computeCost: 8.5,
    humanTime: 120,
    isWaitingHuman: false,
    isRunning: true,
    hasFailed: false,
    isCostOverrun: false,
  },
]

// Global metrics
export const globalMetrics: GlobalMetrics = {
  totalProductions: 180,
  inQC: 65,
  pendingQC: 36,
  pendingAssets: 79,
  avgProductionTime: 25,
  avgComputeCost: 36,
  avgHumanTime: 23,
  productionTimeTrend: -8.5,
  computeCostTrend: -12.3,
  humanTimeTrend: -5.2,
}

// Filter counts
export const filterCounts = {
  all: episodeTasks.length,
  "waiting-human": episodeTasks.filter(t => t.isWaitingHuman).length,
  running: episodeTasks.filter(t => t.isRunning).length,
  failed: episodeTasks.filter(t => t.hasFailed).length,
  "cost-overrun": episodeTasks.filter(t => t.isCostOverrun).length,
}
