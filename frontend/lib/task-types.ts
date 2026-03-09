// Task status types
export type TaskStatus = 
  | "rejected-partner"    // 合作方驳回 - highest priority
  | "rejected-hub"        // 中台驳回
  | "in-progress"         // 质检中
  | "new"                 // 新剧待检
  | "generating"          // Agent 生成中

// Review stage progress
export interface ReviewProgress {
  current: number
  total: number
}

// QA Inspector's stage-specific progress
export interface QAStageProgress {
  visual: ReviewProgress      // 视觉素材
  audiovisual: ReviewProgress // 视听整合
  final: ReviewProgress       // 成片合成
}

// Triple review progress (QA, Hub, Partner)
export interface TripleReviewProgress {
  qa: ReviewProgress       // 质检员
  hub: ReviewProgress      // 剪辑中台
  partner: ReviewProgress  // 合作方
}

// Drama task card data
export interface DramaTask {
  id: string
  title: string
  coverImage: string       // poster thumbnail color placeholder
  deadline: Date
  status: TaskStatus
  episodeCount: number
  estimatedMinutes: number // 预估处理时长（分钟）
  progress: TripleReviewProgress
  qaStageProgress: QAStageProgress // 质检员各环节进度
  isUrgent: boolean        // 今日截止
  hoursRemaining?: number  // 剩余小时数
}

// Task dashboard summary
export interface TaskDashboardSummary {
  totalDramas: number
  totalEpisodes: number
  dueToday: number
  agentGenerating: number
}

// Swimlane section
export interface TaskSwimlane {
  id: string
  title: string
  icon: string
  badgeColor: string
  tasks: DramaTask[]
}

// Helper function to get status badge config
export function getStatusBadgeConfig(status: TaskStatus): { 
  label: string
  color: string
  bgColor: string
  borderColor: string
} {
  switch (status) {
    case "rejected-partner":
      return {
        label: "合作方驳回",
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/50",
      }
    case "rejected-hub":
      return {
        label: "中台驳回",
        color: "text-orange-400",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/50",
      }
    case "in-progress":
      return {
        label: "质检中",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/30",
      }
    case "new":
      return {
        label: "新剧",
        color: "text-blue-400",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
      }
    case "generating":
      return {
        label: "生成中",
        color: "text-muted-foreground",
        bgColor: "bg-secondary/50",
        borderColor: "border-border/30",
      }
  }
}

// Helper to format deadline - pure function, no Date.now()
export function formatDeadline(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}月${day}日`
}
