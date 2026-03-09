"use client"

import { cn } from "@/lib/utils"
import type { FilterType } from "@/lib/admin-types"

interface FilterPillsProps {
  activeFilter: FilterType
  counts: Record<FilterType, number>
  onFilterChange: (filter: FilterType) => void
}

const filters: { id: FilterType; label: string; color: string; dotColor: string }[] = [
  { id: "all", label: "全部剧集", color: "bg-secondary hover:bg-secondary/80", dotColor: "" },
  { id: "waiting-human", label: "等待人类干预", color: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30", dotColor: "bg-amber-400" },
  { id: "running", label: "Agent 运行中", color: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30", dotColor: "bg-blue-400" },
  { id: "failed", label: "异常/打回重试", color: "bg-red-500/10 hover:bg-red-500/20 border-red-500/30", dotColor: "bg-red-400" },
  { id: "cost-overrun", label: "成本超标预警", color: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30", dotColor: "bg-orange-400" },
]

export function FilterPills({ activeFilter, counts, onFilterChange }: FilterPillsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id
        const count = counts[filter.id] || 0

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              filter.color,
              isActive && "ring-2 ring-primary/50"
            )}
          >
            {filter.dotColor && (
              <span className={cn("w-2 h-2 rounded-full", filter.dotColor)} />
            )}
            <span>{filter.label}</span>
            <span className="text-muted-foreground">({count})</span>
          </button>
        )
      })}
    </div>
  )
}
