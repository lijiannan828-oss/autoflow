"use client"

import { FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { TimeRange } from "@/lib/data-center-types"

interface DataFilterBarProps {
  timeRange: TimeRange
  selectedDrama: string
  dramaOptions: { id: string; name: string }[]
  onTimeRangeChange: (range: TimeRange) => void
  onDramaChange: (dramaId: string) => void
  onExport: () => void
}

export function DataFilterBar({
  timeRange,
  selectedDrama,
  dramaOptions,
  onTimeRangeChange,
  onDramaChange,
  onExport,
}: DataFilterBarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Time range selector */}
        <Select value={timeRange} onValueChange={(v) => onTimeRangeChange(v as TimeRange)}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">最近 7 天</SelectItem>
            <SelectItem value="14d">最近 14 天</SelectItem>
            <SelectItem value="30d">最近 30 天</SelectItem>
            <SelectItem value="90d">最近 90 天</SelectItem>
          </SelectContent>
        </Select>

        {/* Drama selector */}
        <Select value={selectedDrama} onValueChange={onDramaChange}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dramaOptions.map((drama) => (
              <SelectItem key={drama.id} value={drama.id}>
                {drama.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Export button */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 text-sm"
        onClick={onExport}
      >
        <FileDown className="h-4 w-4" />
        导出报表
      </Button>
    </div>
  )
}
