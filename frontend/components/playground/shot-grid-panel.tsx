"use client"

import { cn } from "@/lib/utils"
import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Image,
  Video,
  Check,
  X,
  Star,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Sparkles,
  Zap,
  Crown,
} from "lucide-react"

// 难度等级定义
export const DIFFICULTY_LEVELS = {
  S0: { label: "S0 简单", color: "bg-emerald-500", textColor: "text-emerald-400", candidates: 2, keyframes: 1 },
  S1: { label: "S1 中等", color: "bg-blue-500", textColor: "text-blue-400", candidates: 4, keyframes: 2 },
  S2: { label: "S2 困难", color: "bg-amber-500", textColor: "text-amber-400", candidates: 6, keyframes: 3 },
} as const

export type DifficultyLevel = keyof typeof DIFFICULTY_LEVELS

// 镜头数据类型
export interface ShotData {
  shotId: string
  shotIndex: number
  difficulty: DifficultyLevel
  prompt: string
  duration: number // 秒
  cameraMovement: string
  characterCount: number
  // 关键帧数据
  keyframes?: KeyframeData[]
  // 视频数据
  videos?: VideoData[]
  // 选中的候选
  selectedKeyframe?: number
  selectedVideo?: number
  // 质检状态
  qcStatus?: "pending" | "passed" | "failed" | "reviewing"
}

// 关键帧数据
export interface KeyframeData {
  index: number
  candidateIndex: number
  url?: string
  prompt: string
  qcScores?: QCScore[]
  isSelected?: boolean
}

// 视频数据
export interface VideoData {
  index: number
  candidateIndex: number
  url?: string
  duration: number
  qcScores?: QCScore[]
  isSelected?: boolean
}

// 质检评分
export interface QCScore {
  model: string
  score: number
  reason: string
  dimensions?: { name: string; score: number }[]
}

interface ShotGridPanelProps {
  shots: ShotData[]
  type: "keyframe" | "video"
  isRunning?: boolean
  currentShotIndex?: number
  onSelectCandidate?: (shotId: string, candidateIndex: number) => void
}

export function ShotGridPanel({
  shots,
  type,
  isRunning,
  currentShotIndex,
  onSelectCandidate,
}: ShotGridPanelProps) {
  const [expandedShots, setExpandedShots] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<"grid" | "qc">("grid")

  const toggleExpand = (shotId: string) => {
    setExpandedShots((prev) => {
      const next = new Set(prev)
      if (next.has(shotId)) {
        next.delete(shotId)
      } else {
        next.add(shotId)
      }
      return next
    })
  }

  // 按难度分组统计
  const stats = useMemo(() => {
    const result = { S0: 0, S1: 0, S2: 0, total: shots.length, completed: 0 }
    shots.forEach((shot) => {
      result[shot.difficulty]++
      if (shot.qcStatus === "passed") result.completed++
    })
    return result
  }, [shots])

  return (
    <div className="space-y-4">
      {/* 顶部统计 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground">
            {type === "keyframe" ? "关键帧生成" : "视频生成"} ({stats.completed}/{stats.total})
          </h3>
          <div className="flex items-center gap-2">
            {Object.entries(DIFFICULTY_LEVELS).map(([key, level]) => (
              <Badge
                key={key}
                variant="outline"
                className={cn("text-[10px]", level.textColor, `border-current/30`)}
              >
                {key}: {stats[key as DifficultyLevel]}
              </Badge>
            ))}
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "grid" | "qc")}>
          <TabsList className="h-7">
            <TabsTrigger value="grid" className="text-[10px] h-5 px-2">
              生成视图
            </TabsTrigger>
            <TabsTrigger value="qc" className="text-[10px] h-5 px-2">
              质检视图
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 镜头列表 */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-4">
          {shots.map((shot, idx) => (
            <ShotRow
              key={shot.shotId}
              shot={shot}
              type={type}
              isExpanded={expandedShots.has(shot.shotId)}
              onToggleExpand={() => toggleExpand(shot.shotId)}
              isRunning={isRunning && currentShotIndex === idx}
              showQC={activeTab === "qc"}
              onSelectCandidate={onSelectCandidate}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// 单个镜头行
function ShotRow({
  shot,
  type,
  isExpanded,
  onToggleExpand,
  isRunning,
  showQC,
  onSelectCandidate,
}: {
  shot: ShotData
  type: "keyframe" | "video"
  isExpanded: boolean
  onToggleExpand: () => void
  isRunning?: boolean
  showQC?: boolean
  onSelectCandidate?: (shotId: string, candidateIndex: number) => void
}) {
  const diffConfig = DIFFICULTY_LEVELS[shot.difficulty]
  const candidates = type === "keyframe" ? shot.keyframes : shot.videos
  const candidateCount = diffConfig.candidates
  const keyframeCount = type === "keyframe" ? diffConfig.keyframes : 1

  return (
    <div
      className={cn(
        "border rounded-lg transition-all",
        isRunning ? "border-blue-500/50 bg-blue-500/5" : "border-border bg-secondary/20",
        shot.qcStatus === "passed" && "border-emerald-500/30",
        shot.qcStatus === "failed" && "border-red-500/30"
      )}
    >
      {/* 镜头头部 */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors"
      >
        {/* 展开图标 */}
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}

        {/* 镜号 */}
        <div className="flex items-center gap-2 w-20 shrink-0">
          <span className="text-xs font-mono text-foreground">{shot.shotId}</span>
          {isRunning && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
        </div>

        {/* 难度标签 */}
        <Badge
          variant="outline"
          className={cn("text-[9px] shrink-0", diffConfig.textColor, "border-current/30")}
        >
          {diffConfig.label}
        </Badge>

        {/* 候选数/关键帧数 */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          <span>{candidateCount} 候选</span>
          {type === "keyframe" && <span>{keyframeCount} 关键帧</span>}
          <span>{shot.duration}s</span>
        </div>

        {/* Prompt 预览 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1 text-left text-[10px] text-muted-foreground truncate">
                {shot.prompt}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-md">
              <p className="text-xs">{shot.prompt}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 状态图标 */}
        <div className="shrink-0 flex items-center gap-1">
          {isRunning && (
            <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse">
              生成中
            </Badge>
          )}
          {shot.qcStatus === "passed" && <Check className="w-4 h-4 text-emerald-400" />}
          {shot.qcStatus === "failed" && <X className="w-4 h-4 text-red-400" />}
          {shot.qcStatus === "reviewing" && <Star className="w-4 h-4 text-amber-400" />}
        </div>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          {showQC ? (
            <QCDetailView shot={shot} type={type} />
          ) : (
            <CandidateGridView
              shot={shot}
              type={type}
              candidateCount={candidateCount}
              keyframeCount={keyframeCount}
              onSelectCandidate={onSelectCandidate}
            />
          )}
        </div>
      )}
    </div>
  )
}

// 候选网格视图
function CandidateGridView({
  shot,
  type,
  candidateCount,
  keyframeCount,
  onSelectCandidate,
}: {
  shot: ShotData
  type: "keyframe" | "video"
  candidateCount: number
  keyframeCount: number
  onSelectCandidate?: (shotId: string, candidateIndex: number) => void
}) {
  const [hoveredCandidate, setHoveredCandidate] = useState<number | null>(null)

  if (type === "keyframe") {
    // 关键帧：行=keyframe_index, 列=candidate_index
    return (
      <div className="space-y-3">
        {Array.from({ length: keyframeCount }).map((_, kfIdx) => (
          <div key={kfIdx} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                关键帧 {kfIdx + 1}
              </span>
              <ScrollArea className="flex-1">
                <div className="flex gap-2 pb-2">
                  {Array.from({ length: candidateCount }).map((_, candIdx) => {
                    const kf = shot.keyframes?.find(
                      (k) => k.index === kfIdx && k.candidateIndex === candIdx
                    )
                    const isSelected = shot.selectedKeyframe === candIdx && kfIdx === 0
                    const isHovered = hoveredCandidate === candIdx

                    return (
                      <TooltipProvider key={candIdx}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                    "w-24 h-16 rounded-lg border-2 transition-all shrink-0 relative overflow-hidden group",
                                "bg-gradient-to-br from-zinc-800 to-zinc-900",
                                isSelected
                                  ? "border-emerald-500 ring-2 ring-emerald-500/30 score-excellent"
                                  : "border-zinc-700 hover:border-primary/50",
                                !kf?.url && "generating-placeholder generating-border"
                              )}
                              onClick={() => onSelectCandidate?.(shot.shotId, candIdx)}
                              onMouseEnter={() => setHoveredCandidate(candIdx)}
                              onMouseLeave={() => setHoveredCandidate(null)}
                            >
                              {kf?.url ? (
                                <img
                                  src={kf.url}
                                  alt={`候选 ${candIdx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Image className="w-5 h-5 text-zinc-600" />
                                </div>
                              )}
                              {/* 候选编号 + 质检分数 */}
                              <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                                <span className="text-[9px] bg-black/60 px-1 rounded">
                                  #{candIdx + 1}
                                </span>
                                {/* 每个关键帧的质检分数 */}
                                {kf?.qcScores && kf.qcScores.length > 0 && (
                                  <span className={cn(
                                    "text-[9px] px-1 rounded font-medium",
                                    kf.qcScores[0].score >= 8.5 
                                      ? "bg-emerald-500/80 text-white" 
                                      : kf.qcScores[0].score >= 7.5 
                                        ? "bg-blue-500/80 text-white"
                                        : "bg-amber-500/80 text-white"
                                  )}>
                                    {kf.qcScores[0].score.toFixed(1)}
                                  </span>
                                )}
                              </div>
                              {/* 选中标记 */}
                              {isSelected && (
                                <div className="absolute top-1 right-1">
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                </div>
                              )}
                              {/* 悬停时显示三模型评分 */}
                              {kf?.qcScores && kf.qcScores.length > 0 && (
                                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-0.5 p-1">
                                  {kf.qcScores.map((qc, qcIdx) => (
                                    <div key={qcIdx} className="flex items-center gap-1 text-[8px]">
                                      <span className="text-muted-foreground truncate max-w-[40px]">{qc.model.split(' ')[0]}</span>
                                      <span className={cn(
                                        "font-mono font-medium",
                                        qc.score >= 8.5 ? "text-emerald-400" : qc.score >= 7.5 ? "text-blue-400" : "text-amber-400"
                                      )}>
                                        {qc.score.toFixed(1)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-[10px] font-medium mb-1">Prompt:</p>
                            <p className="text-[10px] text-muted-foreground">
                              {kf?.prompt || shot.prompt}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 视频候选
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-2">
        {Array.from({ length: candidateCount }).map((_, candIdx) => {
          const video = shot.videos?.find((v) => v.candidateIndex === candIdx)
          const isSelected = shot.selectedVideo === candIdx

          return (
            <TooltipProvider key={candIdx}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "w-40 h-24 rounded-lg border-2 transition-all shrink-0 relative overflow-hidden group",
                      "bg-gradient-to-br from-zinc-800 to-zinc-900",
                      isSelected
                        ? "border-emerald-500 ring-2 ring-emerald-500/30"
                        : "border-zinc-700 hover:border-primary/50"
                    )}
                    onClick={() => onSelectCandidate?.(shot.shotId, candIdx)}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-6 h-6 text-zinc-600" />
                    </div>
                    {/* 候选编号 + 质检分数 */}
                    <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                      <span className="text-[9px] bg-black/60 px-1 rounded">
                        #{candIdx + 1}
                      </span>
                      {/* 每个视频的质检分数 */}
                      {video?.qcScores && video.qcScores.length > 0 && (
                        <span className={cn(
                          "text-[9px] px-1 rounded font-medium",
                          video.qcScores[0].score >= 8.5 
                            ? "bg-emerald-500/80 text-white" 
                            : video.qcScores[0].score >= 7.5 
                              ? "bg-blue-500/80 text-white"
                              : "bg-amber-500/80 text-white"
                        )}>
                          {video.qcScores[0].score.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {/* 时长 */}
                    <span className="absolute top-1 left-1 text-[9px] bg-black/60 px-1 rounded">
                      {video?.duration || shot.duration}s
                    </span>
                    {/* 选中标记 */}
                    {isSelected && (
                      <div className="absolute top-1 right-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    )}
                    {/* 悬停时显示三模型评分 */}
                    {video?.qcScores && video.qcScores.length > 0 && (
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-1 p-2">
                        {video.qcScores.map((qc, qcIdx) => (
                          <div key={qcIdx} className="flex items-center gap-2 text-[9px]">
                            <span className="text-muted-foreground w-16 truncate">{qc.model}</span>
                            <span className={cn(
                              "font-mono font-medium",
                              qc.score >= 8.5 ? "text-emerald-400" : qc.score >= 7.5 ? "text-blue-400" : "text-amber-400"
                            )}>
                              {qc.score.toFixed(1)}
                            </span>
                          </div>
                        ))}
                        <p className="text-[8px] text-muted-foreground mt-1 text-center line-clamp-2">
                          {video.qcScores[0].reason}
                        </p>
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-[10px] font-medium mb-1">Prompt:</p>
                  <p className="text-[10px] text-muted-foreground">{shot.prompt}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

// 质检详情视图
function QCDetailView({ shot, type }: { shot: ShotData; type: "keyframe" | "video" }) {
  const candidates = type === "keyframe" ? shot.keyframes : shot.videos
  const selected = type === "keyframe" ? shot.selectedKeyframe : shot.selectedVideo

  // Mock QC scores
  const mockQCScores: QCScore[] = [
    {
      model: "Gemini 3.1",
      score: 8.5 + Math.random(),
      reason: "角色一致性良好，构图合理，光影自然",
      dimensions: [
        { name: "角色一致性", score: 8.8 },
        { name: "构图", score: 8.3 },
        { name: "光影", score: 8.6 },
      ],
    },
    {
      model: "Claude Opus",
      score: 8.3 + Math.random(),
      reason: "人物姿态准确，场景细节丰富",
      dimensions: [
        { name: "角色一致性", score: 8.5 },
        { name: "构图", score: 8.2 },
        { name: "光影", score: 8.4 },
      ],
    },
    {
      model: "GPT-5.4",
      score: 8.4 + Math.random(),
      reason: "整体质量优秀，符合剧本描述",
      dimensions: [
        { name: "角色一致性", score: 8.6 },
        { name: "构图", score: 8.4 },
        { name: "光影", score: 8.3 },
      ],
    },
  ]

  const avgScore = mockQCScores.reduce((acc, s) => acc + s.score, 0) / mockQCScores.length

  return (
    <div className="space-y-3">
      {/* 综合评分 */}
      <div className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
              avgScore >= 9
                ? "bg-emerald-500/20 text-emerald-400"
                : avgScore >= 8
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-amber-500/20 text-amber-400"
            )}
          >
            {avgScore.toFixed(1)}
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">综合评分</p>
            <p className="text-[10px] text-muted-foreground">3 模型投票</p>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-2">
          {shot.qcStatus === "passed" && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <Check className="w-3 h-3 mr-1" /> 通过
            </Badge>
          )}
          {shot.qcStatus === "failed" && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              <X className="w-3 h-3 mr-1" /> 未通过
            </Badge>
          )}
          {shot.qcStatus === "reviewing" && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              <AlertTriangle className="w-3 h-3 mr-1" /> 待复核
            </Badge>
          )}
        </div>
      </div>

      {/* 三模型评分详情 */}
      <div className="grid grid-cols-3 gap-2">
        {mockQCScores.map((qc, idx) => (
          <div key={idx} className="border border-border rounded-lg p-2.5 bg-secondary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-foreground">{qc.model}</span>
              <span
                className={cn(
                  "text-sm font-bold",
                  qc.score >= 9
                    ? "text-emerald-400"
                    : qc.score >= 8
                      ? "text-blue-400"
                      : "text-amber-400"
                )}
              >
                {qc.score.toFixed(1)}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground mb-2 line-clamp-2">{qc.reason}</p>
            {/* 维度分数 */}
            <div className="space-y-1">
              {qc.dimensions?.map((dim, dIdx) => (
                <div key={dIdx} className="flex items-center justify-between text-[9px]">
                  <span className="text-muted-foreground">{dim.name}</span>
                  <span className="font-mono text-foreground">{dim.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 生成 mock 镜头数据
export function generateMockShots(count: number = 45): ShotData[] {
  const difficulties: DifficultyLevel[] = ["S0", "S1", "S2"]
  const cameraMovements = ["固定", "推", "拉", "摇", "移", "跟", "升降"]
  const prompts = [
    "林晓站在咖啡馆门口，阳光从身后照来，面带微笑看向远方",
    "张伟推开办公室的门，手里拿着文件，表情严肃",
    "两人在公园长椅上并肩而坐，落叶飘落",
    "夜晚的城市街道，霓虹灯闪烁，林晓独自行走",
    "会议室里，众人围坐讨论，气氛紧张",
    "咖啡厅内景，温暖的灯光，林晓翻看手机",
    "雨中的街道，张伟撑伞等待，若有所思",
    "办公室窗前，林晓望向窗外的城市天际线",
  ]

  return Array.from({ length: count }).map((_, idx) => {
    const difficulty = difficulties[Math.floor(Math.random() * 3)] as DifficultyLevel
    const diffConfig = DIFFICULTY_LEVELS[difficulty]

    return {
      shotId: `shot_${String(idx + 1).padStart(3, "0")}`,
      shotIndex: idx,
      difficulty,
      prompt: prompts[idx % prompts.length],
      duration: Math.floor(Math.random() * 3) + 2,
      cameraMovement: cameraMovements[Math.floor(Math.random() * cameraMovements.length)],
      characterCount: Math.floor(Math.random() * 3) + 1,
      keyframes: Array.from({ length: diffConfig.keyframes * diffConfig.candidates }).map(
        (_, kfIdx) => ({
          index: Math.floor(kfIdx / diffConfig.candidates),
          candidateIndex: kfIdx % diffConfig.candidates,
          prompt: prompts[idx % prompts.length],
          // 每个关键帧的三模型质检分数
          qcScores: [
            {
              model: "Gemini 3.1",
              score: 7.5 + Math.random() * 2,
              reason: "角色一致性良好，构图合理",
              dimensions: [
                { name: "角色一致性", score: 7.5 + Math.random() * 2 },
                { name: "构图", score: 7.5 + Math.random() * 2 },
                { name: "光影", score: 7.5 + Math.random() * 2 },
              ],
            },
            {
              model: "Claude Opus",
              score: 7.5 + Math.random() * 2,
              reason: "人物姿态准确，场景细节丰富",
              dimensions: [
                { name: "角色一致性", score: 7.5 + Math.random() * 2 },
                { name: "构图", score: 7.5 + Math.random() * 2 },
                { name: "光影", score: 7.5 + Math.random() * 2 },
              ],
            },
            {
              model: "GPT-5.4",
              score: 7.5 + Math.random() * 2,
              reason: "整体质量优秀，符合剧本描述",
              dimensions: [
                { name: "角色一致性", score: 7.5 + Math.random() * 2 },
                { name: "构图", score: 7.5 + Math.random() * 2 },
                { name: "光影", score: 7.5 + Math.random() * 2 },
              ],
            },
          ],
        })
      ),
      videos: Array.from({ length: diffConfig.candidates }).map((_, vIdx) => ({
        index: 0,
        candidateIndex: vIdx,
        duration: Math.floor(Math.random() * 3) + 2,
        // 每个视频候选的三模型质检分数
        qcScores: [
          {
            model: "Gemini 3.1",
            score: 7.5 + Math.random() * 2,
            reason: "运动流畅，时长适当",
            dimensions: [
              { name: "运动流畅度", score: 7.5 + Math.random() * 2 },
              { name: "时长准确度", score: 7.5 + Math.random() * 2 },
              { name: "画面稳定性", score: 7.5 + Math.random() * 2 },
            ],
          },
          {
            model: "Claude Opus",
            score: 7.5 + Math.random() * 2,
            reason: "角色动作自然，转场平滑",
            dimensions: [
              { name: "运动流畅度", score: 7.5 + Math.random() * 2 },
              { name: "时长准确度", score: 7.5 + Math.random() * 2 },
              { name: "画面稳定性", score: 7.5 + Math.random() * 2 },
            ],
          },
          {
            model: "GPT-5.4",
            score: 7.5 + Math.random() * 2,
            reason: "整体效果符合预期",
            dimensions: [
              { name: "运动流畅度", score: 7.5 + Math.random() * 2 },
              { name: "时长准确度", score: 7.5 + Math.random() * 2 },
              { name: "画面稳定性", score: 7.5 + Math.random() * 2 },
            ],
          },
        ],
      })),
      selectedKeyframe: Math.random() > 0.5 ? Math.floor(Math.random() * diffConfig.candidates) : undefined,
      selectedVideo: Math.random() > 0.5 ? Math.floor(Math.random() * diffConfig.candidates) : undefined,
      qcStatus: ["pending", "passed", "failed", "reviewing"][Math.floor(Math.random() * 4)] as ShotData["qcStatus"],
    }
  })
}
