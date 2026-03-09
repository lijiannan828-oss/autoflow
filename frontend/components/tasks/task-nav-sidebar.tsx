"use client"

import { Flame, Clock, Sparkles, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TaskSwimlane } from "@/lib/task-types"

interface TaskNavSidebarProps {
  swimlanes: TaskSwimlane[]
  activeSection: string
  onNavigate: (sectionId: string) => void
}

const iconMap = {
  flame: Flame,
  clock: Clock,
  sparkles: Sparkles,
  bot: Bot,
}

const colorMap = {
  red: "text-red-400",
  emerald: "text-emerald-400", 
  blue: "text-blue-400",
  gray: "text-muted-foreground",
}

export function TaskNavSidebar({ swimlanes, activeSection, onNavigate }: TaskNavSidebarProps) {
  return (
    <aside className="w-48 shrink-0 border-r border-border/30 bg-[#0d0d0d]">
      <div className="sticky top-0 p-4">
        <h3 className="text-xs font-medium text-muted-foreground mb-3">任务分类</h3>
        <nav className="flex flex-col gap-1">
          {swimlanes.map((swimlane) => {
            const Icon = iconMap[swimlane.icon as keyof typeof iconMap] || Clock
            const iconColor = colorMap[swimlane.badgeColor as keyof typeof colorMap] || colorMap.gray
            const isActive = activeSection === swimlane.id
            const taskCount = swimlane.tasks.length

            if (taskCount === 0) return null

            return (
              <button
                key={swimlane.id}
                onClick={() => onNavigate(swimlane.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                  isActive 
                    ? "bg-secondary/60 text-foreground" 
                    : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", iconColor)} />
                <span className="flex-1 text-sm truncate">{swimlane.title}</span>
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                )}>
                  {taskCount}
                </span>
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
