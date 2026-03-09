"use client"

import { forwardRef } from "react"
import { Flame, Clock, Sparkles, Bot } from "lucide-react"
import { DramaTaskCard } from "./drama-task-card"
import { cn } from "@/lib/utils"
import type { TaskSwimlane as TaskSwimlaneType } from "@/lib/task-types"

interface TaskSwimlaneProps {
  swimlane: TaskSwimlaneType
  onStartReview: (taskId: string) => void
}

const iconMap = {
  flame: Flame,
  clock: Clock,
  sparkles: Sparkles,
  bot: Bot,
}

const colorMap = {
  red: {
    icon: "text-red-400",
    badge: "bg-red-500/10 text-red-400",
    border: "border-red-500/20",
  },
  emerald: {
    icon: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400",
    border: "border-emerald-500/20",
  },
  blue: {
    icon: "text-blue-400",
    badge: "bg-blue-500/10 text-blue-400",
    border: "border-blue-500/20",
  },
  gray: {
    icon: "text-muted-foreground",
    badge: "bg-secondary/50 text-muted-foreground",
    border: "border-border/30",
  },
}

export const TaskSwimlane = forwardRef<HTMLDivElement, TaskSwimlaneProps>(
  function TaskSwimlane({ swimlane, onStartReview }, ref) {
    const Icon = iconMap[swimlane.icon as keyof typeof iconMap] || Clock
    const colors = colorMap[swimlane.badgeColor as keyof typeof colorMap] || colorMap.gray

    if (swimlane.tasks.length === 0) return null

    // Calculate swimlane stats
    const dramaCount = swimlane.tasks.length
    const episodeCount = swimlane.tasks.reduce((sum, t) => sum + t.episodeCount, 0)
    const totalMinutes = swimlane.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0)

    return (
      <div ref={ref} id={swimlane.id} className="flex flex-col gap-3">
        {/* Section header with stats */}
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg", colors.badge)}>
            <Icon className={cn("h-4 w-4", colors.icon)} />
            <span className="text-sm font-medium">{swimlane.title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{dramaCount}部</span>
            <span className="text-border">|</span>
            <span>{episodeCount}集</span>
            <span className="text-border">|</span>
            <span>预估{totalMinutes}分钟</span>
          </div>
          <div className="flex-1 h-px bg-border/30" />
        </div>

        {/* Task cards - vertical list for compact layout */}
        <div className="flex flex-col gap-2">
          {swimlane.tasks.map((task) => (
            <DramaTaskCard 
              key={task.id} 
              task={task} 
              onStartReview={onStartReview}
            />
          ))}
        </div>
      </div>
    )
  }
)
