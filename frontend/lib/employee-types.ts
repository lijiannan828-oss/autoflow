// Employee management types

// Workload level
export type WorkloadLevel = "overloaded" | "busy" | "normal" | "idle"

// Employee role
export type EmployeeRole = "qa" | "hub-editor"

// Alert for overtime dramas
export interface OvertimeAlert {
  id: string
  dramaTitle: string
  daysOverdue: number
  currentHolder: string // 卡在谁手里
  currentStage: string
}

// Resource pool overview
export interface ResourcePoolOverview {
  activeQACount: number
  activeHubEditorCount: number
  totalDramas: number
  totalEpisodes: number
  periodDays: number
}

// Cycle time breakdown stage
export interface CycleStage {
  name: string
  hours: number
  color: string
}

// Cycle metrics
export interface CycleMetrics {
  avgQACycleHours: number // 平均成片质检完成周期
  avgTotalDeliveryHours: number // 总交付周期
  stages: CycleStage[]
}

// Employee performance data
export interface EmployeeData {
  id: string
  name: string
  role: EmployeeRole
  group: string // A组, B组 etc
  
  // 当前负荷
  workload: {
    level: WorkloadLevel
    pendingEpisodes: number
    pendingDramas: number
  }
  
  // 产出量
  volume: {
    processedDramas: number // 已处理剧集数
    processedEpisodes: number // 已处理分集数
  }
  
  // 效率指标
  speed: {
    avgMinutesPerEpisode: number // 平均每分钟成片质检耗时
    avgDramaCycleHours: number // 单部剧平均流转周期
  }
  
  // 质量指标
  quality: {
    aiRejections: number // 主动驳回AI次数
    downstreamRejections: number // 被下游退回次数
  }
  
  // 在线状态
  isOnline: boolean
}

// Global employee metrics
export interface GlobalEmployeeMetrics {
  alerts: OvertimeAlert[]
  resourcePool: ResourcePoolOverview
  cycleMetrics: CycleMetrics
  qaEmployees: EmployeeData[]
  hubEditors: EmployeeData[]
}
