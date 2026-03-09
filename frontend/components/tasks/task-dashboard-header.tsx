"use client"

import { Search, SlidersHorizontal, Flame, Clock, Bot } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TaskDashboardSummary } from "@/lib/task-types"

interface TaskDashboardHeaderProps {
  summary: TaskDashboardSummary
  searchQuery: string
  onSearchChange: (query: string) => void
  sortBy: "priority" | "deadline"
  onSortChange: (sort: "priority" | "deadline") => void
}

export function TaskDashboardHeader({
  summary,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}: TaskDashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/40 bg-background px-6 py-4">
      {/* Top row: Breadcrumb + User */}
      <div className="flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">工作台</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium text-foreground">我的任务</span>
        </div>

        {/* User identity badge */}
        <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-2.5 py-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            Q
          </div>
          <span className="text-[11px] font-medium text-foreground">一级质检专员</span>
        </div>
      </div>

      {/* Data summary bar */}
      <div className="flex items-center justify-between">
        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">{summary.totalDramas}</span>
            <span className="text-sm text-muted-foreground">部待审</span>
          </div>
          
          <div className="h-6 w-px bg-border/50" />
          
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-semibold text-foreground">{summary.totalEpisodes}</span>
            <span className="text-sm text-muted-foreground">集</span>
          </div>

          <div className="h-6 w-px bg-border/50" />

          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-red-400" />
            <span className="text-sm">
              <span className="font-semibold text-red-400">{summary.dueToday}</span>
              <span className="text-muted-foreground ml-1">集今日截止</span>
            </span>
          </div>

          <div className="h-6 w-px bg-border/50" />

          <div className="flex items-center gap-1.5">
            <Bot className="h-4 w-4 text-blue-400" />
            <span className="text-sm">
              <span className="font-semibold text-blue-400">{summary.agentGenerating}</span>
              <span className="text-muted-foreground ml-1">集生成中</span>
            </span>
          </div>
        </div>

        {/* Search and filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索剧名..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 w-48 pl-8 text-sm bg-secondary/30 border-border/40"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-border/40">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {sortBy === "priority" ? "按优先级" : "按截止日期"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSortChange("priority")}>
                <Flame className="h-4 w-4 mr-2 text-red-400" />
                按优先级
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange("deadline")}>
                <Clock className="h-4 w-4 mr-2 text-orange-400" />
                按截止日期
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
