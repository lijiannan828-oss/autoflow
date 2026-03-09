"use client"

import { Clock, Calendar, Image, Headphones, Film } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  type DramaTask, 
  getStatusBadgeConfig, 
  formatDeadline,
} from "@/lib/task-types"

interface DramaTaskCardProps {
  task: DramaTask
  onStartReview: (taskId: string) => void
}

// Stage progress item
function StageProgressItem({ 
  icon: Icon, 
  current, 
  total, 
  label,
}: { 
  icon: React.ElementType
  current: number
  total: number
  label: string
}) {
  const isComplete = current >= total
  const hasProgress = current > 0
  
  return (
    <div 
      className={cn(
        "flex items-center gap-1 text-[10px]",
        isComplete ? "text-emerald-400" : hasProgress ? "text-blue-400" : "text-muted-foreground"
      )}
      title={label}
    >
      <Icon className="h-3 w-3" />
      <span>{current}/{total}</span>
    </div>
  )
}

export function DramaTaskCard({ task, onStartReview }: DramaTaskCardProps) {
  const statusConfig = getStatusBadgeConfig(task.status)
  const isGenerating = task.status === "generating"
  const isRejected = task.status === "rejected-partner" || task.status === "rejected-hub"
  
  const getButtonText = () => {
    if (isGenerating) return "生成中"
    if (task.status === "new") return "开始"
    if (isRejected) return "处理"
    return "继续"
  }

  return (
    <div
      className={cn(
        "relative flex gap-3 rounded-lg border bg-card p-3 transition-all",
        isGenerating && "opacity-60",
        isRejected && "ring-1",
        task.status === "rejected-partner" && "ring-red-500/40 border-red-500/30",
        task.status === "rejected-hub" && "ring-orange-500/40 border-orange-500/30",
        !isRejected && !isGenerating && "border-border/40 hover:border-border/70 hover:bg-card/80"
      )}
    >
      {/* Thumbnail */}
      <div 
        className="relative w-14 h-14 shrink-0 rounded-md overflow-hidden"
        style={{ backgroundColor: task.coverImage }}
      >
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="h-5 w-5 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Top row: title + status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm text-foreground truncate">{task.title}</h3>
          <span className={cn(
            "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium",
            statusConfig.bgColor,
            statusConfig.color
          )}>
            {statusConfig.label}
          </span>
        </div>

        {/* Middle row: deadline + episode count + urgent */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span className={cn(task.isUrgent && "text-red-400")}>{formatDeadline(task.deadline)}</span>
          </div>
          <span>·</span>
          <span>{task.episodeCount}集</span>
          {task.isUrgent && task.hoursRemaining !== undefined && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <Clock className="h-3 w-3" />
                剩{task.hoursRemaining}h
              </span>
            </>
          )}
        </div>

        {/* Bottom row: QA stage progress icons */}
        <div className="flex items-center gap-3">
          <StageProgressItem 
            icon={Image} 
            current={task.qaStageProgress.visual.current} 
            total={task.qaStageProgress.visual.total}
            label="视觉素材"
          />
          <StageProgressItem 
            icon={Headphones} 
            current={task.qaStageProgress.audiovisual.current} 
            total={task.qaStageProgress.audiovisual.total}
            label="视听整合"
          />
          <StageProgressItem 
            icon={Film} 
            current={task.qaStageProgress.final.current} 
            total={task.qaStageProgress.final.total}
            label="成片合成"
          />
        </div>

        {/* Triple review progress bars */}
        <div className="flex flex-col gap-1 mt-1">
          {/* QA */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground w-10 shrink-0">质检员</span>
            <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(task.progress.qa.current / task.progress.qa.total) * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground w-8 text-right">{task.progress.qa.current}/{task.progress.qa.total}</span>
          </div>
          {/* Hub */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground w-10 shrink-0">中台</span>
            <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(task.progress.hub.current / task.progress.hub.total) * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground w-8 text-right">{task.progress.hub.current}/{task.progress.hub.total}</span>
          </div>
          {/* Partner */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground w-10 shrink-0">合作方</span>
            <div className="flex-1 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${(task.progress.partner.current / task.progress.partner.total) * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground w-8 text-right">{task.progress.partner.current}/{task.progress.partner.total}</span>
          </div>
        </div>
      </div>

      {/* Action button */}
      <div className="shrink-0 flex items-center">
        <Button
          size="sm"
          className={cn(
            "h-7 px-3 text-xs",
            isRejected 
              ? "bg-red-600 hover:bg-red-700 text-white" 
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
          disabled={isGenerating}
          onClick={() => onStartReview(task.id)}
        >
          {getButtonText()}
        </Button>
      </div>
    </div>
  )
}
