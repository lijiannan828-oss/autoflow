"use client"

import { Clock, DollarSign, User, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PHASES, getPhaseProgress, getCurrentNodeInfo, formatDuration, formatCost } from "@/lib/admin-types"
import type { EpisodeTask } from "@/lib/admin-types"

interface EpisodeTaskCardProps {
  task: EpisodeTask
  onClick: () => void
}

export function EpisodeTaskCard({ task, onClick }: EpisodeTaskCardProps) {
  const currentNodeInfo = getCurrentNodeInfo(task)

  // Determine card border color based on status
  const borderColor = task.hasFailed
    ? "border-red-500/50"
    : task.isWaitingHuman
      ? "border-amber-500/50"
      : task.isCostOverrun
        ? "border-orange-500/50"
        : task.isRunning
          ? "border-blue-500/50"
          : "border-border/50"

  return (
    <div
      onClick={onClick}
      className={cn(
        "group cursor-pointer rounded-lg bg-card border p-4 transition-all hover:bg-card/80 hover:shadow-lg",
        borderColor
      )}
    >
      {/* Header: Cover + Title */}
      <div className="flex items-start gap-3">
        {/* Cover thumbnail */}
        <div
          className="w-12 h-16 rounded shrink-0"
          style={{ backgroundColor: task.coverColor }}
        />
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">
            {task.dramaTitle}
          </h3>
          <p className="text-xs text-muted-foreground">第{task.episodeNumber}集</p>
          
          {/* Status badges */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {task.isWaitingHuman && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-400">
                等待人工
              </span>
            )}
            {task.isRunning && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/20 text-blue-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                运行中
              </span>
            )}
            {task.hasFailed && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/20 text-red-400">
                异常
              </span>
            )}
            {task.isCostOverrun && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-500/20 text-orange-400 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                成本超标
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5-Phase Progress Bar */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-1">
          {PHASES.map((phase, idx) => {
            const progress = getPhaseProgress(task, phase.id)
            const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0
            const isActive = task.currentNodeId >= phase.nodeRange[0] && task.currentNodeId <= phase.nodeRange[1]
            
            return (
              <div key={phase.id} className="flex-1 flex flex-col gap-0.5">
                <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      percentage === 100 ? "bg-emerald-500" : isActive ? "bg-blue-500" : "bg-secondary"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                {idx < PHASES.length - 1 && <div className="h-0" />}
              </div>
            )
          })}
        </div>
        <div className="flex items-center justify-between">
          {PHASES.map((phase) => (
            <span key={phase.id} className="text-[8px] text-muted-foreground flex-1 text-center">
              {phase.name}
            </span>
          ))}
        </div>
      </div>

      {/* Current Node Status */}
      <div className="mt-3 px-2 py-1.5 rounded bg-secondary/30 border border-border/30">
        <p className="text-[10px] text-muted-foreground">当前节点</p>
        <p className="text-xs text-foreground font-medium truncate">
          {currentNodeInfo.display}
        </p>
        <p className="text-[9px] text-muted-foreground mt-0.5">
          后续还有 {currentNodeInfo.remaining} 个步骤
        </p>
      </div>

      {/* Telemetry Data */}
      <div className="mt-3 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{formatDuration(task.totalDuration)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <DollarSign className="w-3 h-3" />
          <span>{formatCost(task.computeCost)}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <User className="w-3 h-3" />
          <span>{formatDuration(task.humanTime)}</span>
        </div>
      </div>
    </div>
  )
}
