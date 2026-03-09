"use client"

import { useState } from "react"
import { Search, UserCheck, Film, AlertTriangle, ExternalLink, Circle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EmployeeData, WorkloadLevel } from "@/lib/employee-types"

interface EmployeePerformanceTableProps {
  qaEmployees: EmployeeData[]
  hubEditors: EmployeeData[]
  onViewLogs?: (employee: EmployeeData) => void
}

// Workload badge component
function WorkloadBadge({ level, pendingEpisodes }: { level: WorkloadLevel; pendingEpisodes: number }) {
  const config = {
    overloaded: { bg: "bg-red-500/20", text: "text-red-400", label: "超负荷" },
    busy: { bg: "bg-amber-500/20", text: "text-amber-400", label: "繁忙" },
    normal: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "正常" },
    idle: { bg: "bg-gray-500/20", text: "text-gray-400", label: "空闲" },
  }
  const c = config[level]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.bg} ${c.text}`}>
      <Circle className="h-1.5 w-1.5 fill-current" />
      {c.label} (待审{pendingEpisodes}集)
    </span>
  )
}

// Online status indicator
function OnlineStatus({ isOnline }: { isOnline: boolean }) {
  return (
    <span className={`inline-flex h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-gray-500"}`} />
  )
}

export function EmployeePerformanceTable({ 
  qaEmployees, 
  hubEditors,
  onViewLogs,
}: EmployeePerformanceTableProps) {
  const [activeTab, setActiveTab] = useState<"qa" | "hub">("qa")
  const [searchQuery, setSearchQuery] = useState("")

  const employees = activeTab === "qa" ? qaEmployees : hubEditors

  // Filter by search
  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.group.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="rounded-lg border border-border/50 bg-card">
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("qa")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "qa"
                ? "bg-emerald-500/20 text-emerald-400"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <UserCheck className="h-4 w-4" />
            质检员 ({qaEmployees.length})
          </button>
          <button
            onClick={() => setActiveTab("hub")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "hub"
                ? "bg-blue-500/20 text-blue-400"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <Film className="h-4 w-4" />
            剪辑中台专家 ({hubEditors.length})
          </button>
        </div>

        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索员工姓名或组别..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[120px]">员工</TableHead>
              <TableHead className="w-[80px]">组别</TableHead>
              <TableHead className="w-[150px]">当前负荷</TableHead>
              <TableHead className="w-[120px] text-center">产出量</TableHead>
              <TableHead className="w-[150px] text-center">效率指标</TableHead>
              <TableHead className="w-[120px] text-center">质量指标</TableHead>
              <TableHead className="w-[100px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((emp) => (
              <TableRow key={emp.id} className="group">
                {/* Employee name with online status */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <OnlineStatus isOnline={emp.isOnline} />
                    <span className="font-medium text-foreground">{emp.name}</span>
                  </div>
                </TableCell>

                {/* Group */}
                <TableCell>
                  <span className="text-sm text-muted-foreground">{emp.group}</span>
                </TableCell>

                {/* Workload */}
                <TableCell>
                  <WorkloadBadge level={emp.workload.level} pendingEpisodes={emp.workload.pendingEpisodes} />
                </TableCell>

                {/* Volume */}
                <TableCell className="text-center">
                  <div className="text-sm">
                    <span className="text-foreground font-medium">{emp.volume.processedDramas}</span>
                    <span className="text-muted-foreground"> 部 / </span>
                    <span className="text-foreground font-medium">{emp.volume.processedEpisodes}</span>
                    <span className="text-muted-foreground"> 集</span>
                  </div>
                </TableCell>

                {/* Speed */}
                <TableCell className="text-center">
                  <div className="space-y-0.5">
                    <div className="text-xs">
                      <span className="text-foreground font-medium">{emp.speed.avgMinutesPerEpisode}</span>
                      <span className="text-muted-foreground"> min/成片分钟</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">周期 </span>
                      <span className="text-foreground font-medium">{emp.speed.avgDramaCycleHours}h</span>
                      <span className="text-muted-foreground">/部</span>
                    </div>
                  </div>
                </TableCell>

                {/* Quality */}
                <TableCell className="text-center">
                  <div className="space-y-0.5">
                    <div className="text-xs">
                      <span className="text-emerald-400 font-medium">{emp.quality.aiRejections}</span>
                      <span className="text-muted-foreground"> 次驳回AI</span>
                    </div>
                    {emp.quality.downstreamRejections > 0 ? (
                      <div className="text-xs flex items-center justify-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                        <span className="text-amber-400 font-medium">{emp.quality.downstreamRejections}</span>
                        <span className="text-muted-foreground">次被退回</span>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">无退回记录</div>
                    )}
                  </div>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onViewLogs?.(emp)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    查看日志
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Empty state */}
      {filteredEmployees.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          没有找到匹配的员工
        </div>
      )}
    </div>
  )
}
