"use client"

import { useState } from "react"
import { ArrowUpDown, Film, Bot, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { EpisodeDataRow, ModelConsumptionData } from "@/lib/data-center-types"

interface GranularDataTablesProps {
  episodeData: EpisodeDataRow[]
  modelData: ModelConsumptionData
}

function StatusBadge({ status }: { status: EpisodeDataRow["status"] }) {
  const config = {
    completed: { label: "已完成", className: "bg-emerald-500/20 text-emerald-400" },
    "in-progress": { label: "进行中", className: "bg-blue-500/20 text-blue-400" },
    failed: { label: "失败", className: "bg-red-500/20 text-red-400" },
  }
  const { label, className } = config[status]
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {label}
    </span>
  )
}

// Phase colors
const PHASE_COLORS = ["text-blue-400", "text-purple-400", "text-amber-400", "text-emerald-400", "text-pink-400"]

// Expandable row component
function EpisodeRow({ row, isExpanded, onToggle }: { row: EpisodeDataRow; isExpanded: boolean; onToggle: () => void }) {
  return (
    <>
      <TableRow className="text-sm cursor-pointer hover:bg-secondary/30" onClick={onToggle}>
        <TableCell className="w-8">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{row.dramaTitle}</TableCell>
        <TableCell>第{row.episodeNumber}集</TableCell>
        <TableCell>{row.totalDuration} 分钟</TableCell>
        <TableCell className={row.totalCost > 200 ? "text-red-400 font-medium" : ""}>
          {row.totalCost} 元
          {row.totalCost > 200 && <span className="ml-1 text-[10px]">超标</span>}
        </TableCell>
        <TableCell>{row.humanEdits} 次</TableCell>
        <TableCell><StatusBadge status={row.status} /></TableCell>
      </TableRow>
      
      {/* Expanded phase details */}
      {isExpanded && (
        <TableRow className="bg-secondary/10 hover:bg-secondary/10">
          <TableCell colSpan={7} className="p-0">
            <div className="px-8 py-3">
              <div className="grid grid-cols-5 gap-2">
                {row.phaseDetails.map((phase, idx) => (
                  <div 
                    key={phase.phase} 
                    className="rounded-md border border-border/30 bg-card/50 p-3"
                  >
                    <div className={`text-xs font-medium mb-2 ${PHASE_COLORS[idx]}`}>
                      {phase.phase}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">耗时</span>
                        <span className="text-foreground">{phase.duration} 分钟</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">成本</span>
                        <span className="text-foreground">{phase.cost} 元</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">修改</span>
                        <span className="text-foreground">{phase.revisions} 次</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function GranularDataTables({ episodeData, modelData }: GranularDataTablesProps) {
  const [sortBy, setSortBy] = useState<"cost" | "time">("cost")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const sortedEpisodeData = [...episodeData].sort((a, b) => {
    const multiplier = sortOrder === "desc" ? -1 : 1
    if (sortBy === "cost") return (a.totalCost - b.totalCost) * multiplier
    return (a.totalDuration - b.totalDuration) * multiplier
  })

  const toggleSort = (field: "cost" | "time") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card">
      <Tabs defaultValue="episodes" className="w-full">
        <div className="border-b border-border/50 px-4 pt-4">
          <TabsList className="h-9 bg-secondary/30">
            <TabsTrigger value="episodes" className="gap-1.5 text-xs">
              <Film className="h-3.5 w-3.5" />
              分剧集/分集数据
            </TabsTrigger>
            <TabsTrigger value="models" className="gap-1.5 text-xs">
              <Bot className="h-3.5 w-3.5" />
              分模型消耗数据
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Episode Data Tab */}
        <TabsContent value="episodes" className="m-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8 text-xs"></TableHead>
                  <TableHead className="text-xs">剧名</TableHead>
                  <TableHead className="text-xs">集数</TableHead>
                  <TableHead className="text-xs">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 gap-1 p-0 text-xs font-medium hover:bg-transparent"
                      onClick={() => toggleSort("time")}
                    >
                      总耗时
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-xs">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 gap-1 p-0 text-xs font-medium hover:bg-transparent"
                      onClick={() => toggleSort("cost")}
                    >
                      总成本
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-xs">人工修改</TableHead>
                  <TableHead className="text-xs">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEpisodeData.map((row) => (
                  <EpisodeRow 
                    key={row.id} 
                    row={row} 
                    isExpanded={expandedRows.has(row.id)}
                    onToggle={() => toggleRow(row.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-2 border-t border-border/30 text-[10px] text-muted-foreground">
            点击行展开查看五阶段明细（耗时、成本、修改次数）
          </div>
        </TabsContent>

        {/* Model Consumption Tab */}
        <TabsContent value="models" className="m-0 p-4 space-y-6">
          {/* LLM */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">LLM 消耗</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">模型</TableHead>
                    <TableHead className="text-xs text-right">Token 消耗</TableHead>
                    <TableHead className="text-xs text-right">成本 (USD)</TableHead>
                    <TableHead className="text-xs text-right">成本 (CNY)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelData.llm.map((row) => (
                    <TableRow key={row.model} className="text-sm">
                      <TableCell className="font-medium">{row.model}</TableCell>
                      <TableCell className="text-right">{(row.tokenCount / 1000000).toFixed(1)}M</TableCell>
                      <TableCell className="text-right">${row.costUSD.toFixed(2)}</TableCell>
                      <TableCell className="text-right">¥{row.costCNY.toFixed(0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Image Models */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">图像模型消耗</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">模型</TableHead>
                    <TableHead className="text-xs text-right">生成数量</TableHead>
                    <TableHead className="text-xs text-right">成本 (CNY)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelData.image.map((row) => (
                    <TableRow key={row.model} className="text-sm">
                      <TableCell className="font-medium">{row.model}</TableCell>
                      <TableCell className="text-right">{row.generations.toLocaleString()}</TableCell>
                      <TableCell className="text-right">¥{row.costCNY.toFixed(0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Video Models */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">视频模型消耗</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">模型</TableHead>
                    <TableHead className="text-xs">类型</TableHead>
                    <TableHead className="text-xs text-right">调用次数</TableHead>
                    <TableHead className="text-xs text-right">时长 (秒)</TableHead>
                    <TableHead className="text-xs text-right">成本 (CNY)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelData.video.map((row) => (
                    <TableRow key={row.model} className="text-sm">
                      <TableCell className="font-medium">{row.model}</TableCell>
                      <TableCell>
                        <span className={`text-xs ${row.type === "api" ? "text-amber-400" : "text-blue-400"}`}>
                          {row.type === "api" ? "API" : "自部署"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{row.calls.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{row.duration?.toLocaleString() || "-"}</TableCell>
                      <TableCell className="text-right">¥{row.costCNY.toFixed(0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Audio Models */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-foreground">音频模型消耗</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">模型</TableHead>
                    <TableHead className="text-xs text-right">字符数/生成数</TableHead>
                    <TableHead className="text-xs text-right">成本 (CNY)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelData.audio.map((row) => (
                    <TableRow key={row.model} className="text-sm">
                      <TableCell className="font-medium">{row.model}</TableCell>
                      <TableCell className="text-right">
                        {row.characters 
                          ? `${(row.characters / 1000000).toFixed(1)}M 字符` 
                          : `${row.generations} 首`}
                      </TableCell>
                      <TableCell className="text-right">¥{row.costCNY.toFixed(0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
