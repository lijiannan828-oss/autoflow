import type { 
  GlobalEmployeeMetrics, 
  OvertimeAlert, 
  ResourcePoolOverview, 
  CycleMetrics,
  EmployeeData 
} from "./employee-types"

// Overtime alerts
const overtimeAlerts: OvertimeAlert[] = [
  { id: "alert-1", dramaTitle: "星际迷途", daysOverdue: 9, currentHolder: "张明", currentStage: "质检员审核" },
  { id: "alert-2", dramaTitle: "暗夜玫瑰", daysOverdue: 8, currentHolder: "李华", currentStage: "中台复核" },
  { id: "alert-3", dramaTitle: "都市猎人", daysOverdue: 7, currentHolder: "王芳", currentStage: "质检员审核" },
]

// Resource pool overview
const resourcePool: ResourcePoolOverview = {
  activeQACount: 32,
  activeHubEditorCount: 4,
  totalDramas: 58,
  totalEpisodes: 2045,
  periodDays: 7,
}

// Cycle metrics
const cycleMetrics: CycleMetrics = {
  avgQACycleHours: 74,
  avgTotalDeliveryHours: 89,
  stages: [
    { name: "生产", hours: 15, color: "#6b7280" },
    { name: "质检员", hours: 54, color: "#10b981" },
    { name: "剪辑中台", hours: 18, color: "#3b82f6" },
    { name: "TikTok合作方抽检", hours: 12, color: "#8b5cf6" },
  ],
}

// QA employees
const qaEmployees: EmployeeData[] = [
  {
    id: "qa-1", name: "张明", role: "qa", group: "A组",
    workload: { level: "overloaded", pendingEpisodes: 45, pendingDramas: 3 },
    volume: { processedDramas: 12, processedEpisodes: 340 },
    speed: { avgMinutesPerEpisode: 22, avgDramaCycleHours: 68 },
    quality: { aiRejections: 156, downstreamRejections: 5 },
    isOnline: true,
  },
  {
    id: "qa-2", name: "李华", role: "qa", group: "A组",
    workload: { level: "busy", pendingEpisodes: 28, pendingDramas: 2 },
    volume: { processedDramas: 15, processedEpisodes: 420 },
    speed: { avgMinutesPerEpisode: 18, avgDramaCycleHours: 52 },
    quality: { aiRejections: 203, downstreamRejections: 2 },
    isOnline: true,
  },
  {
    id: "qa-3", name: "王芳", role: "qa", group: "B组",
    workload: { level: "normal", pendingEpisodes: 15, pendingDramas: 1 },
    volume: { processedDramas: 18, processedEpisodes: 510 },
    speed: { avgMinutesPerEpisode: 15, avgDramaCycleHours: 45 },
    quality: { aiRejections: 245, downstreamRejections: 1 },
    isOnline: true,
  },
  {
    id: "qa-4", name: "赵强", role: "qa", group: "B组",
    workload: { level: "idle", pendingEpisodes: 2, pendingDramas: 0 },
    volume: { processedDramas: 8, processedEpisodes: 220 },
    speed: { avgMinutesPerEpisode: 20, avgDramaCycleHours: 58 },
    quality: { aiRejections: 98, downstreamRejections: 0 },
    isOnline: false,
  },
  {
    id: "qa-5", name: "陈静", role: "qa", group: "A组",
    workload: { level: "busy", pendingEpisodes: 32, pendingDramas: 2 },
    volume: { processedDramas: 14, processedEpisodes: 385 },
    speed: { avgMinutesPerEpisode: 17, avgDramaCycleHours: 50 },
    quality: { aiRejections: 178, downstreamRejections: 3 },
    isOnline: true,
  },
  {
    id: "qa-6", name: "刘洋", role: "qa", group: "C组",
    workload: { level: "overloaded", pendingEpisodes: 52, pendingDramas: 4 },
    volume: { processedDramas: 10, processedEpisodes: 280 },
    speed: { avgMinutesPerEpisode: 24, avgDramaCycleHours: 72 },
    quality: { aiRejections: 125, downstreamRejections: 8 },
    isOnline: true,
  },
  {
    id: "qa-7", name: "周敏", role: "qa", group: "C组",
    workload: { level: "normal", pendingEpisodes: 18, pendingDramas: 1 },
    volume: { processedDramas: 16, processedEpisodes: 445 },
    speed: { avgMinutesPerEpisode: 16, avgDramaCycleHours: 48 },
    quality: { aiRejections: 210, downstreamRejections: 1 },
    isOnline: true,
  },
  {
    id: "qa-8", name: "吴磊", role: "qa", group: "B组",
    workload: { level: "idle", pendingEpisodes: 5, pendingDramas: 0 },
    volume: { processedDramas: 6, processedEpisodes: 165 },
    speed: { avgMinutesPerEpisode: 19, avgDramaCycleHours: 55 },
    quality: { aiRejections: 72, downstreamRejections: 0 },
    isOnline: false,
  },
]

// Hub editors
const hubEditors: EmployeeData[] = [
  {
    id: "hub-1", name: "孙涛", role: "hub-editor", group: "中台组",
    workload: { level: "busy", pendingEpisodes: 85, pendingDramas: 6 },
    volume: { processedDramas: 28, processedEpisodes: 780 },
    speed: { avgMinutesPerEpisode: 8, avgDramaCycleHours: 18 },
    quality: { aiRejections: 45, downstreamRejections: 2 },
    isOnline: true,
  },
  {
    id: "hub-2", name: "郑欣", role: "hub-editor", group: "中台组",
    workload: { level: "normal", pendingEpisodes: 42, pendingDramas: 3 },
    volume: { processedDramas: 32, processedEpisodes: 920 },
    speed: { avgMinutesPerEpisode: 6, avgDramaCycleHours: 15 },
    quality: { aiRejections: 58, downstreamRejections: 1 },
    isOnline: true,
  },
  {
    id: "hub-3", name: "何伟", role: "hub-editor", group: "中台组",
    workload: { level: "overloaded", pendingEpisodes: 120, pendingDramas: 8 },
    volume: { processedDramas: 22, processedEpisodes: 610 },
    speed: { avgMinutesPerEpisode: 10, avgDramaCycleHours: 22 },
    quality: { aiRejections: 38, downstreamRejections: 4 },
    isOnline: true,
  },
  {
    id: "hub-4", name: "林雪", role: "hub-editor", group: "中台组",
    workload: { level: "idle", pendingEpisodes: 15, pendingDramas: 1 },
    volume: { processedDramas: 35, processedEpisodes: 1020 },
    speed: { avgMinutesPerEpisode: 5, avgDramaCycleHours: 12 },
    quality: { aiRejections: 62, downstreamRejections: 0 },
    isOnline: false,
  },
]

// Export all data
export const employeeMetrics: GlobalEmployeeMetrics = {
  alerts: overtimeAlerts,
  resourcePool,
  cycleMetrics,
  qaEmployees,
  hubEditors,
}
