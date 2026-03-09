import type { DramaTask, TaskDashboardSummary, TaskSwimlane } from "./task-types"

// Static dates to avoid hydration issues
const deadline1 = new Date("2026-03-06T18:00:00")
const deadline2 = new Date("2026-03-07T23:59:00")
const deadline3 = new Date("2026-03-06T20:00:00")
const deadline4 = new Date("2026-03-10T23:59:00")
const deadline5 = new Date("2026-03-08T23:59:00")
const deadline6 = new Date("2026-03-12T23:59:00")
const deadline7 = new Date("2026-03-15T23:59:00")
const deadline8 = new Date("2026-03-20T23:59:00")
const deadline9 = new Date("2026-03-22T23:59:00")

const rejectedPartnerTasks: DramaTask[] = [
  {
    id: "drama-1",
    title: "万斯家族的回响",
    coverImage: "#4a3f6b",
    deadline: deadline1,
    status: "rejected-partner",
    episodeCount: 30,
    estimatedMinutes: 25,
    progress: {
      qa: { current: 27, total: 30 },
      hub: { current: 27, total: 30 },
      partner: { current: 1, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 27, total: 27 },
      audiovisual: { current: 27, total: 27 },
      final: { current: 25, total: 27 },
    },
    isUrgent: true,
    hoursRemaining: 3,
  },
]

const rejectedHubTasks: DramaTask[] = [
  {
    id: "drama-2",
    title: "深渊之上",
    coverImage: "#3d5a6b",
    deadline: deadline2,
    status: "rejected-hub",
    episodeCount: 24,
    estimatedMinutes: 18,
    progress: {
      qa: { current: 20, total: 24 },
      hub: { current: 8, total: 24 },
      partner: { current: 0, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 20, total: 24 },
      audiovisual: { current: 18, total: 24 },
      final: { current: 12, total: 24 },
    },
    isUrgent: false,
  },
  {
    id: "drama-3",
    title: "逆流时光",
    coverImage: "#5a4a3d",
    deadline: deadline3,
    status: "rejected-hub",
    episodeCount: 18,
    estimatedMinutes: 14,
    progress: {
      qa: { current: 18, total: 18 },
      hub: { current: 12, total: 18 },
      partner: { current: 0, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 18, total: 18 },
      audiovisual: { current: 18, total: 18 },
      final: { current: 15, total: 18 },
    },
    isUrgent: true,
    hoursRemaining: 5,
  },
]

const inProgressTasks: DramaTask[] = [
  {
    id: "drama-4",
    title: "星际迷途",
    coverImage: "#2d4a5a",
    deadline: deadline4,
    status: "in-progress",
    episodeCount: 36,
    estimatedMinutes: 42,
    progress: {
      qa: { current: 12, total: 36 },
      hub: { current: 0, total: 36 },
      partner: { current: 0, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 18, total: 27 },
      audiovisual: { current: 8, total: 27 },
      final: { current: 3, total: 27 },
    },
    isUrgent: false,
  },
  {
    id: "drama-5",
    title: "暗夜玫瑰",
    coverImage: "#5a2d4a",
    deadline: deadline5,
    status: "in-progress",
    episodeCount: 28,
    estimatedMinutes: 35,
    progress: {
      qa: { current: 3, total: 28 },
      hub: { current: 0, total: 28 },
      partner: { current: 0, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 8, total: 28 },
      audiovisual: { current: 3, total: 28 },
      final: { current: 0, total: 28 },
    },
    isUrgent: false,
  },
]

const newTasks: DramaTask[] = [
  {
    id: "drama-6",
    title: "权力游戏：东方篇",
    coverImage: "#4a5a2d",
    deadline: deadline6,
    status: "new",
    episodeCount: 45,
    estimatedMinutes: 58,
    progress: {
      qa: { current: 0, total: 45 },
      hub: { current: 0, total: 45 },
      partner: { current: 0, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 0, total: 45 },
      audiovisual: { current: 0, total: 45 },
      final: { current: 0, total: 45 },
    },
    isUrgent: false,
  },
  {
    id: "drama-7",
    title: "都市猎人",
    coverImage: "#3a4a5a",
    deadline: deadline7,
    status: "new",
    episodeCount: 32,
    estimatedMinutes: 40,
    progress: {
      qa: { current: 0, total: 32 },
      hub: { current: 0, total: 32 },
      partner: { current: 0, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 0, total: 32 },
      audiovisual: { current: 0, total: 32 },
      final: { current: 0, total: 32 },
    },
    isUrgent: false,
  },
]

const generatingTasks: DramaTask[] = [
  {
    id: "drama-8",
    title: "穿越千年的爱恋",
    coverImage: "#4a4a4a",
    deadline: deadline8,
    status: "generating",
    episodeCount: 40,
    estimatedMinutes: 52,
    progress: {
      qa: { current: 0, total: 40 },
      hub: { current: 0, total: 40 },
      partner: { current: 0, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 0, total: 40 },
      audiovisual: { current: 0, total: 40 },
      final: { current: 0, total: 40 },
    },
    isUrgent: false,
  },
  {
    id: "drama-9",
    title: "商战风云",
    coverImage: "#3a3a4a",
    deadline: deadline9,
    status: "generating",
    episodeCount: 36,
    estimatedMinutes: 45,
    progress: {
      qa: { current: 0, total: 36 },
      hub: { current: 0, total: 36 },
      partner: { current: 0, total: 3 },
    },
    qaStageProgress: {
      visual: { current: 0, total: 36 },
      audiovisual: { current: 0, total: 36 },
      final: { current: 0, total: 36 },
    },
    isUrgent: false,
  },
]

// Task swimlanes
export const taskSwimlanes: TaskSwimlane[] = [
  {
    id: "rejected",
    title: "紧急驳回",
    icon: "flame",
    badgeColor: "red",
    tasks: [...rejectedPartnerTasks, ...rejectedHubTasks],
  },
  {
    id: "in-progress",
    title: "质检中",
    icon: "clock",
    badgeColor: "emerald",
    tasks: inProgressTasks,
  },
  {
    id: "new",
    title: "新剧待检",
    icon: "sparkles",
    badgeColor: "blue",
    tasks: newTasks,
  },
  {
    id: "generating",
    title: "Agent 生成中",
    icon: "bot",
    badgeColor: "gray",
    tasks: generatingTasks,
  },
]

// Dashboard summary
export const taskDashboardSummary: TaskDashboardSummary = {
  totalDramas: 9,
  totalEpisodes: 289,
  dueToday: 2,
  agentGenerating: 2,
}
