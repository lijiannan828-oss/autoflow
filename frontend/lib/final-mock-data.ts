import type {
  FinalEpisode,
  FinalCompositeData,
  ReviewStageInfo,
  RevisionEntry,
  HistoricalVideo,
  ReviewPoint,
} from "./final-types"

// Generate 30 episodes with various statuses
const episodeColors = [
  "#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6",
  "#EF4444", "#6366F1", "#14B8A6", "#F97316", "#84CC16",
]

function generateEpisodes(): FinalEpisode[] {
  return Array.from({ length: 30 }, (_, i) => {
    // Status distribution: 6 approved, 2 rejected, rest pending
    let status: FinalEpisode["status"] = "pending"
    if (i < 6) status = "approved"
    else if (i >= 6 && i < 8) status = "rejected"
    
    // First episode is revision (current working one)
    const isRevision = i === 0
    
    return {
      id: `ep-${i + 1}`,
      index: i + 1,
      title: `第${i + 1}集`,
      duration: 85 + Math.floor(Math.random() * 30), // 85-115 seconds each
      status,
      thumbnailColor: episodeColors[i % episodeColors.length],
      isRevision,
      revisionCount: isRevision ? 2 : 0,
    }
  })
}

const episodes = generateEpisodes()

// Review stages - currently at platform review
const reviewStages: ReviewStageInfo[] = [
  { id: "quality-check", label: "质检员审核", status: "completed" },
  { id: "platform-review", label: "中台审核", status: "current" },
  { id: "partner-review", label: "合作方审核", status: "pending" },
]

// Revision history for episode 1 (the revised one)
const revisionHistory: RevisionEntry[] = [
  {
    id: "rev-1",
    timestamp: "2024-01-15T10:30:00Z",
    summary: "根据上一轮审核建议进行了修改",
    changes: [
      {
        timeCode: "00:15",
        description: "重新生成了视觉素材（修复了人物手部变形问题）",
        type: "visual",
      },
      {
        timeCode: "00:45",
        description: "缩短了背景音乐的淡出时间，使转场更流畅",
        type: "audio",
      },
      {
        timeCode: "01:02",
        description: "调整了剪辑节奏，删除了冗余画面",
        type: "edit",
      },
    ],
  },
]

// Historical video versions
const historicalVideos: HistoricalVideo[] = [
  {
    id: "hist-1",
    version: 1,
    createdAt: "2024-01-14T08:00:00Z",
    thumbnailColor: "#6366F1",
    duration: 95,
  },
]

// Sample review points (empty initially, filled as reviewer adds them)
const reviewPoints: ReviewPoint[] = []

// Total series duration (sum of all episode durations)
const totalSeriesDuration = episodes.reduce((sum, ep) => sum + ep.duration, 0)

export const finalCompositeData: FinalCompositeData = {
  projectName: "万斯家的回响",
  totalSeriesDuration,
  currentEpisode: episodes[0], // Start with episode 1
  episodes,
  reviewStages,
  revisionHistory,
  historicalVideos,
  reviewPoints,
}
