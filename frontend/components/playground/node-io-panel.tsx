"use client"

import { cn } from "@/lib/utils"
import { NODE_SPECS, getCategoryColor, getCategoryLabel, type NodeSpec } from "@/lib/node-specs"
import { getNodeIOSpec, type IOFieldSpec } from "@/lib/node-io-specs"
import type { PlaygroundNodeData } from "@/app/playground/page"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { ShotGridPanel, generateMockShots } from "./shot-grid-panel"
import { MultiTrackTimeline, generateMockTracks } from "./multi-track-timeline"
import {
  Play,
  FastForward,
  Check,
  Clock,
  DollarSign,
  Cpu,
  Star,
  Brain,
  ArrowRight,
  FileJson,
  Image,
  Video,
  Music,
  User,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Volume2,
  ExternalLink,
} from "lucide-react"
import { useState, useMemo } from "react"

interface NodeIOPanelProps {
  nodeId: string | null
  nodeData: PlaygroundNodeData | null
  nodeSpec: NodeSpec | null | undefined
  onRunNode: (nodeId: string) => void
  onRunFromNode: (nodeId: string) => void
  onApproveGate: (nodeId: string) => void
}

export function NodeIOPanel({
  nodeId,
  nodeData,
  nodeSpec,
  onRunNode,
  onRunFromNode,
  onApproveGate,
}: NodeIOPanelProps) {
  if (!nodeId || !nodeSpec) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">选择一个节点查看详情</p>
        </div>
      </div>
    )
  }

  const isRunning = nodeData?.status === "running"
  const isCompleted = nodeData?.status === "completed"
  const isGateWaiting = nodeData?.status === "gate_waiting"
  const ioSpec = getNodeIOSpec(nodeId)

  // 特殊节点判断
  const isKeyframeNode = ["N10", "N11", "N12", "N13"].includes(nodeId)
  const isVideoNode = ["N14", "N15", "N16", "N16b", "N17"].includes(nodeId)
  const isAVIntegrationNode = nodeId === "N20" || nodeId === "N21" || nodeId === "N23"

  // Mock 数据
  const mockShots = useMemo(() => generateMockShots(45), [])
  const mockTracks = useMemo(() => generateMockTracks(62), [])
  const [timelineTime, setTimelineTime] = useState(0)
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false)

  return (
    <div className="h-full flex flex-col">
      {/* Node header */}
      <div className="shrink-0 border-b border-border pb-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-mono text-muted-foreground">{nodeId}</span>
              <h2 className="text-xl font-semibold text-foreground">{nodeSpec.name}</h2>
              <Badge variant="outline" className={cn("text-[10px]", getCategoryColor(nodeSpec.category))}>
                {getCategoryLabel(nodeSpec.category)}
              </Badge>
              {nodeSpec.isGate && (
                <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                  <User className="w-3 h-3 mr-1" />
                  人工审核
                </Badge>
              )}
              {nodeSpec.isQC && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                  质检节点
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">{nodeSpec.description}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Agent: <span className="text-foreground">{nodeSpec.agentRole.replace(/_/g, " ")}</span>
              </span>
              {nodeSpec.model && (
                <span>
                  Model: <span className="text-foreground">{nodeSpec.model}</span>
                </span>
              )}
              <span>
                Stage: <span className="text-foreground">{nodeSpec.stage}</span>
              </span>
            </div>
          </div>

          {/* Actions - only "从此开始" and gate approval */}
          <div className="flex items-center gap-2">
            {isGateWaiting ? (
              <Button onClick={() => onApproveGate(nodeId)} className="gap-2">
                <Check className="w-4 h-4" />
                审核通过
              </Button>
            ) : (
              <Button onClick={() => onRunFromNode(nodeId)} disabled={isRunning} className="gap-2">
                <FastForward className="w-4 h-4" />
                从此开始
              </Button>
            )}
          </div>
        </div>

        {/* Metrics bar */}
        {(isRunning || isCompleted || isGateWaiting) && nodeData && (
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
            <MetricItem
              icon={Clock}
              label="执行时长"
              value={nodeData.durationMs ? `${(nodeData.durationMs / 1000).toFixed(1)}s` : "..."}
              loading={isRunning}
            />
            <MetricItem
              icon={DollarSign}
              label="费用"
              value={nodeData.costCny != null ? `¥${nodeData.costCny.toFixed(2)}` : "..."}
              loading={isRunning}
            />
            <MetricItem
              icon={Cpu}
              label="模型"
              value={nodeData.model || nodeSpec.model || "N/A"}
            />
            {nodeSpec.isQC && (
              <MetricItem
                icon={Star}
                label="质检分数"
                value={nodeData.qualityScore != null ? nodeData.qualityScore.toFixed(2) : "..."}
                loading={isRunning}
                valueColor={
                  nodeData.qualityScore != null
                    ? nodeData.qualityScore >= 9
                      ? "text-emerald-400"
                      : nodeData.qualityScore >= 8
                        ? "text-foreground"
                        : "text-amber-400"
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Tabs content */}
      <Tabs defaultValue="input" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="input">
            <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
            输入
          </TabsTrigger>
          <TabsTrigger value="output">
            <ArrowRight className="w-3.5 h-3.5 mr-1.5 rotate-180" />
            输出
          </TabsTrigger>
          <TabsTrigger value="thinking">
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            Agent 思考
          </TabsTrigger>
          <TabsTrigger value="config">
            <Cpu className="w-3.5 h-3.5 mr-1.5" />
            配置
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 mt-4">
          <TabsContent value="input" className="h-full m-0">
            <IOContentPanel 
              type="input" 
              data={nodeData?.input} 
              ioSpec={ioSpec?.input}
              nodeSpec={nodeSpec}
              isRunning={isRunning}
            />
          </TabsContent>
          <TabsContent value="output" className="h-full m-0">
            {/* 关键帧节点特殊渲染 */}
            {isKeyframeNode ? (
              <ScrollArea className="h-full">
                <div className="pr-4 space-y-4">
                  <ShotGridPanel
                    shots={mockShots}
                    type="keyframe"
                    isRunning={isRunning}
                    currentShotIndex={isRunning ? Math.floor(Math.random() * 45) : undefined}
                  />
                  {/* 过程数据 */}
                  {ioSpec?.processData && ioSpec.processData.length > 0 && (
                    <ProcessDataSection 
                      processData={ioSpec.processData} 
                      values={nodeData?.processData}
                      isRunning={isRunning}
                    />
                  )}
                </div>
              </ScrollArea>
            ) : isVideoNode ? (
              <ScrollArea className="h-full">
                <div className="pr-4 space-y-4">
                  <ShotGridPanel
                    shots={mockShots}
                    type="video"
                    isRunning={isRunning}
                    currentShotIndex={isRunning ? Math.floor(Math.random() * 45) : undefined}
                  />
                  {/* 过程数据 */}
                  {ioSpec?.processData && ioSpec.processData.length > 0 && (
                    <ProcessDataSection 
                      processData={ioSpec.processData} 
                      values={nodeData?.processData}
                      isRunning={isRunning}
                    />
                  )}
                </div>
              </ScrollArea>
            ) : isAVIntegrationNode ? (
              <div className="h-full overflow-y-auto">
                <div className="pr-4 space-y-4">
                  <div className="rounded-lg overflow-hidden">
                    <MultiTrackTimeline
                      tracks={mockTracks}
                      totalDuration={62}
                      currentTime={timelineTime}
                      isPlaying={isTimelinePlaying}
                      onTimeChange={setTimelineTime}
                      onPlayPause={() => setIsTimelinePlaying(!isTimelinePlaying)}
                    />
                  </div>
                  {/* 过程数据 */}
                  {ioSpec?.processData && ioSpec.processData.length > 0 && (
                    <ProcessDataSection 
                      processData={ioSpec.processData} 
                      values={nodeData?.processData}
                      isRunning={isRunning}
                    />
                  )}
                </div>
              </ScrollArea>
            ) : (
              <IOContentPanel 
                type="output" 
                data={nodeData?.output} 
                ioSpec={ioSpec?.output}
                nodeSpec={nodeSpec}
                isRunning={isRunning}
                processData={ioSpec?.processData}
                processDataValues={nodeData?.processData}
              />
            )}
          </TabsContent>
          <TabsContent value="thinking" className="h-full m-0">
            <ThinkingPanel nodeData={nodeData} nodeSpec={nodeSpec} />
          </TabsContent>
          <TabsContent value="config" className="h-full m-0">
            <ConfigPanel nodeSpec={nodeSpec} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function MetricItem({
  icon: Icon,
  label,
  value,
  loading,
  valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  loading?: boolean
  valueColor?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-4 w-12" />
        ) : (
          <p className={cn("text-sm font-medium", valueColor || "text-foreground")}>{value}</p>
        )}
      </div>
    </div>
  )
}

// Process Data Section component
function ProcessDataSection({
  processData,
  values,
  isRunning,
}: {
  processData: IOFieldSpec[]
  values?: Record<string, unknown>
  isRunning?: boolean
}) {
  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <h4 className="text-xs font-medium text-muted-foreground mb-3">过程数据</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {processData.map((field) => (
          <div key={field.key} className="bg-secondary/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{field.label}</p>
            <p className="text-xs font-medium text-foreground">
              {values?.[field.key] != null 
                ? String(values[field.key])
                : isRunning ? <Skeleton className="h-4 w-16" /> : "—"
              }
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// IO Content Panel with typed rendering
function IOContentPanel({
  type,
  data,
  ioSpec,
  nodeSpec,
  isRunning,
  processData,
  processDataValues,
}: {
  type: "input" | "output"
  data?: Record<string, unknown>
  ioSpec?: IOFieldSpec[]
  nodeSpec: NodeSpec
  isRunning?: boolean
  processData?: IOFieldSpec[]
  processDataValues?: Record<string, unknown>
}) {
  if (!ioSpec || ioSpec.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileJson className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {type === "input" ? "此节点无特定输入规格" : "此节点无特定输出规格"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-4">
        {/* Render each field based on its type */}
        {ioSpec.map((field) => (
          <FieldRenderer 
            key={field.key} 
            field={field} 
            value={data?.[field.key]}
            isRunning={isRunning}
            nodeSpec={nodeSpec}
          />
        ))}

        {/* Process data (only for output tab) */}
        {type === "output" && processData && processData.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border/50">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">过程数据</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {processData.map((field) => (
                <div key={field.key} className="bg-secondary/20 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">{field.label}</p>
                  <p className="text-xs font-medium text-foreground">
                    {processDataValues?.[field.key] != null 
                      ? String(processDataValues[field.key])
                      : isRunning ? <Skeleton className="h-4 w-16" /> : "—"
                    }
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

// Field renderer based on type
function FieldRenderer({
  field,
  value,
  isRunning,
  nodeSpec,
}: {
  field: IOFieldSpec
  value: unknown
  isRunning?: boolean
  nodeSpec: NodeSpec
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Render loading skeleton for running state
  if (isRunning && value === undefined) {
    return (
      <div className="bg-secondary/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-medium text-foreground">{field.label}</p>
          {field.description && (
            <span className="text-[10px] text-muted-foreground">({field.description})</span>
          )}
        </div>
        <FieldSkeleton type={field.type} />
      </div>
    )
  }

  // Render placeholder for empty state
  if (value === undefined || value === null) {
    return (
      <div className="bg-secondary/20 rounded-lg p-4 border border-dashed border-border">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
          {field.description && (
            <span className="text-[10px] text-muted-foreground/70">({field.description})</span>
          )}
        </div>
        <FieldPlaceholder type={field.type} />
      </div>
    )
  }

  // Render actual content based on type
  return (
    <div className="bg-secondary/20 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-foreground">{field.label}</p>
          {field.description && (
            <span className="text-[10px] text-muted-foreground">({field.description})</span>
          )}
        </div>
        {(field.type === "json" || field.type === "table") && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {isExpanded ? "收起" : "展开"}
          </button>
        )}
      </div>
      
      {/* Render based on type */}
      {field.type === "text" && <TextDisplay value={value} truncate={field.truncate} />}
      {field.type === "number" && <NumberDisplay value={value} />}
      {field.type === "json" && <JsonDisplay value={value} expanded={isExpanded} />}
      {field.type === "table" && <TableDisplay value={value} columns={field.columns} expanded={isExpanded} truncate={field.truncate} />}
      {field.type === "image_grid" && <ImageGridDisplay value={value} />}
      {field.type === "video_grid" && <VideoGridDisplay value={value} />}
      {field.type === "audio_list" && <AudioListDisplay value={value} />}
      {field.type === "radar_chart" && <RadarChartDisplay value={value} dimensions={field.dimensions} />}
      {field.type === "pie_chart" && <PieChartDisplay value={value} />}
      {field.type === "timeline" && <TimelineDisplay value={value} />}
      {field.type === "diff" && <DiffDisplay value={value} />}
      {field.type === "progress" && <ProgressDisplay value={value} />}
      {field.type === "status_list" && <StatusListDisplay value={value} />}
      {field.type === "badge_list" && <BadgeListDisplay value={value} />}
      {field.type === "file_info" && <FileInfoDisplay value={value} />}
    </div>
  )
}

// Skeleton components for loading state
function FieldSkeleton({ type }: { type: IOFieldSpec["type"] }) {
  switch (type) {
    case "image_grid":
      return (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      )
    case "video_grid":
      return (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      )
    case "radar_chart":
      return <Skeleton className="h-40 w-40 rounded-full mx-auto" />
    case "table":
      return (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      )
    case "progress":
      return <Skeleton className="h-4 w-full" />
    default:
      return <Skeleton className="h-6 w-32" />
  }
}

// Placeholder components for empty state
function FieldPlaceholder({ type }: { type: IOFieldSpec["type"] }) {
  switch (type) {
    case "image_grid":
      return (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-video bg-zinc-800/50 rounded-lg flex items-center justify-center border border-dashed border-zinc-700">
              <Image className="w-5 h-5 text-zinc-600" />
            </div>
          ))}
        </div>
      )
    case "video_grid":
      return (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="aspect-video bg-zinc-800/50 rounded-lg flex items-center justify-center border border-dashed border-zinc-700">
              <Video className="w-5 h-5 text-zinc-600" />
            </div>
          ))}
        </div>
      )
    case "audio_list":
      return (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-zinc-800/50 rounded-lg flex items-center justify-center border border-dashed border-zinc-700">
              <Volume2 className="w-4 h-4 text-zinc-600 mr-2" />
              <span className="text-[10px] text-zinc-600">等待生成音频</span>
            </div>
          ))}
        </div>
      )
    case "radar_chart":
      return (
        <div className="h-40 w-40 mx-auto border border-dashed border-zinc-700 rounded-full flex items-center justify-center">
          <span className="text-[10px] text-zinc-600">等待评分数据</span>
        </div>
      )
    case "pie_chart":
      return (
        <div className="h-32 w-32 mx-auto border border-dashed border-zinc-700 rounded-full flex items-center justify-center">
          <span className="text-[10px] text-zinc-600">等待分布数据</span>
        </div>
      )
    case "timeline":
      return (
        <div className="h-24 bg-zinc-800/50 rounded-lg flex items-center justify-center border border-dashed border-zinc-700">
          <span className="text-[10px] text-zinc-600">等待时间线数据</span>
        </div>
      )
    case "table":
      return (
        <div className="text-[10px] text-zinc-500 text-center py-4">
          等待数据...
        </div>
      )
    default:
      return <span className="text-xs text-zinc-500">等待数据...</span>
  }
}

// Display components
function TextDisplay({ value, truncate }: { value: unknown; truncate?: number }) {
  const text = String(value)
  const displayText = truncate && text.length > truncate ? text.slice(0, truncate) + "..." : text
  return <p className="text-xs text-foreground">{displayText}</p>
}

function NumberDisplay({ value }: { value: unknown }) {
  return <p className="text-lg font-mono font-semibold text-foreground">{String(value)}</p>
}

function JsonDisplay({ value, expanded }: { value: unknown; expanded: boolean }) {
  if (!expanded) {
    return (
      <p className="text-[10px] text-muted-foreground font-mono">
        {JSON.stringify(value).slice(0, 100)}...
      </p>
    )
  }
  return (
    <pre className="text-[10px] text-foreground font-mono bg-zinc-900/50 p-3 rounded-lg overflow-auto max-h-60">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function TableDisplay({ 
  value, 
  columns, 
  expanded,
  truncate 
}: { 
  value: unknown
  columns?: string[]
  expanded: boolean
  truncate?: number
}) {
  if (!Array.isArray(value)) {
    return <p className="text-[10px] text-muted-foreground">无效的表格数据</p>
  }

  const displayData = expanded ? value : value.slice(0, 5)
  const cols = columns || (value[0] ? Object.keys(value[0]) : [])

  return (
    <div className="overflow-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b border-border/50">
            {cols.map((col) => (
              <th key={col} className="px-2 py-1.5 text-left text-muted-foreground font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, idx) => (
            <tr key={idx} className="border-b border-border/30 hover:bg-secondary/30">
              {cols.map((col) => {
                const cellValue = (row as Record<string, unknown>)[col]
                const text = String(cellValue ?? "")
                const displayText = truncate && text.length > truncate ? text.slice(0, truncate) + "..." : text
                return (
                  <td key={col} className="px-2 py-1.5 text-foreground">
                    {displayText}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!expanded && value.length > 5 && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          还有 {value.length - 5} 行...
        </p>
      )}
    </div>
  )
}

function ImageGridDisplay({ value }: { value: unknown }) {
  // Mock image grid
  const items = Array.isArray(value) ? value : [1, 2, 3, 4]
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.slice(0, 8).map((item, idx) => (
        <div 
          key={idx} 
          className="aspect-square bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-lg flex items-center justify-center border border-zinc-700 group hover:border-primary/50 cursor-pointer transition-all"
        >
          <div className="text-center">
            <Image className="w-5 h-5 text-zinc-500 mx-auto mb-1 group-hover:text-primary/70 transition-colors" />
            <span className="text-[9px] text-zinc-500">候选 {idx + 1}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function VideoGridDisplay({ value }: { value: unknown }) {
  const items = Array.isArray(value) ? value : [1, 2]
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.slice(0, 4).map((item, idx) => (
        <div 
          key={idx} 
          className="aspect-video bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-lg flex items-center justify-center border border-zinc-700 group hover:border-primary/50 cursor-pointer transition-all relative"
        >
          <div className="text-center">
            <Video className="w-6 h-6 text-zinc-500 mx-auto mb-1 group-hover:text-primary/70 transition-colors" />
            <span className="text-[9px] text-zinc-500">视频 {idx + 1}</span>
          </div>
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AudioListDisplay({ value }: { value: unknown }) {
  const items = Array.isArray(value) ? value : [{ name: "角色1", samples: 3 }, { name: "角色2", samples: 3 }]
  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item, idx) => (
        <div key={idx} className="flex items-center gap-3 bg-zinc-800/50 rounded-lg p-3 hover:bg-zinc-800/70 transition-colors">
          <button className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center hover:bg-pink-500/30 transition-colors">
            <Play className="w-4 h-4 text-pink-400 ml-0.5" />
          </button>
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">{(item as any).name || `音频 ${idx + 1}`}</p>
            <p className="text-[10px] text-muted-foreground">{(item as any).samples || 3} 个样本</p>
          </div>
          {/* Waveform placeholder */}
          <div className="flex-1 h-6 flex items-center gap-px">
            {Array.from({ length: 30 }).map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-pink-500/40 rounded-full"
                style={{ height: `${Math.random() * 100}%` }}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">0:03</span>
        </div>
      ))}
    </div>
  )
}

function RadarChartDisplay({ value, dimensions }: { value: unknown; dimensions?: string[] }) {
  // Mock radar chart visualization
  const dims = dimensions || ["维度1", "维度2", "维度3", "维度4", "维度5", "维度6"]
  const scores = Array.isArray(value) ? value : dims.map(() => (Math.random() * 2 + 8).toFixed(1))
  
  return (
    <div className="flex items-start gap-6">
      {/* Simple radar visualization */}
      <div className="relative w-40 h-40">
        <div className="absolute inset-0 border border-zinc-700/50 rounded-full" />
        <div className="absolute inset-4 border border-zinc-700/30 rounded-full" />
        <div className="absolute inset-8 border border-zinc-700/20 rounded-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-emerald-400">
            {typeof value === "object" && (value as any)?.weighted_score 
              ? (value as any).weighted_score 
              : "8.5"}
          </span>
        </div>
      </div>
      {/* Dimension scores */}
      <div className="flex-1 grid grid-cols-2 gap-2">
        {dims.map((dim, idx) => (
          <div key={dim} className="flex items-center justify-between text-[10px] bg-secondary/30 rounded px-2 py-1">
            <span className="text-muted-foreground truncate max-w-20">{dim}</span>
            <span className={cn(
              "font-mono font-medium",
              Number(scores[idx]) >= 9 ? "text-emerald-400" : 
              Number(scores[idx]) >= 8 ? "text-foreground" : "text-amber-400"
            )}>
              {scores[idx]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PieChartDisplay({ value }: { value: unknown }) {
  // Mock pie chart
  const data = typeof value === "object" && value !== null ? value : {
    S0: 15,
    S1: 25,
    S2: 10
  }
  const total = Object.values(data).reduce((a: number, b) => a + (Number(b) || 0), 0)
  const colors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-purple-500"]
  
  return (
    <div className="flex items-center gap-6">
      {/* Simple pie representation */}
      <div className="w-24 h-24 rounded-full bg-gradient-conic relative overflow-hidden">
        <div className="absolute inset-2 bg-secondary rounded-full flex items-center justify-center">
          <span className="text-lg font-bold text-foreground">{total}</span>
        </div>
      </div>
      {/* Legend */}
      <div className="space-y-2">
        {Object.entries(data).map(([key, val], idx) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <div className={cn("w-3 h-3 rounded", colors[idx % colors.length])} />
            <span className="text-muted-foreground">{key}:</span>
            <span className="font-medium text-foreground">{String(val)}</span>
            <span className="text-muted-foreground">({((Number(val) / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineDisplay({ value }: { value: unknown }) {
  // Mock multi-track timeline
  const tracks = ["视频轨", "TTS轨", "BGM轨", "SFX轨", "字幕轨"]
  return (
    <div className="space-y-1">
      {tracks.map((track) => (
        <div key={track} className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground w-12 shrink-0">{track}</span>
          <div className="flex-1 h-5 bg-zinc-800/50 rounded relative overflow-hidden">
            {/* Random blocks to simulate content */}
            {Array.from({ length: Math.floor(Math.random() * 5) + 2 }).map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "absolute top-0.5 bottom-0.5 rounded",
                  track === "视频轨" ? "bg-blue-500/60" :
                  track === "TTS轨" ? "bg-emerald-500/60" :
                  track === "BGM轨" ? "bg-purple-500/60" :
                  track === "SFX轨" ? "bg-amber-500/60" : "bg-pink-500/60"
                )}
                style={{
                  left: `${idx * 20 + Math.random() * 5}%`,
                  width: `${10 + Math.random() * 15}%`
                }}
              />
            ))}
          </div>
        </div>
      ))}
      {/* Time markers */}
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1 ml-14">
        <span>0:00</span>
        <span>0:15</span>
        <span>0:30</span>
        <span>0:45</span>
        <span>1:00</span>
      </div>
    </div>
  )
}

function DiffDisplay({ value }: { value: unknown }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-3">
        <p className="text-[10px] text-red-400 mb-2">修改前</p>
        <div className="aspect-video bg-zinc-800/50 rounded flex items-center justify-center">
          <span className="text-[10px] text-zinc-500">原始内容</span>
        </div>
      </div>
      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3">
        <p className="text-[10px] text-emerald-400 mb-2">修改后</p>
        <div className="aspect-video bg-zinc-800/50 rounded flex items-center justify-center">
          <span className="text-[10px] text-zinc-500">更新内容</span>
        </div>
      </div>
    </div>
  )
}

function ProgressDisplay({ value }: { value: unknown }) {
  const progress = typeof value === "number" ? value : 65
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">生成进度</span>
        <span className="text-foreground font-medium">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-[10px] text-muted-foreground">已完成 13/20 张</p>
    </div>
  )
}

function StatusListDisplay({ value }: { value: unknown }) {
  const items = Array.isArray(value) ? value : [
    { label: "TTS", status: "completed" },
    { label: "STT对齐", status: "completed" },
    { label: "唇形同步", status: "running" },
    { label: "BGM", status: "pending" },
    { label: "SFX", status: "pending" },
    { label: "混音", status: "pending" },
  ]
  
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => {
        const status = (item as any).status || "pending"
        return (
          <div 
            key={idx}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px]",
              status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
              status === "running" ? "bg-blue-500/20 text-blue-400" :
              "bg-zinc-700/50 text-zinc-400"
            )}
          >
            {status === "completed" && <CheckCircle2 className="w-3 h-3" />}
            {status === "running" && <RefreshCw className="w-3 h-3 animate-spin" />}
            {status === "pending" && <Clock className="w-3 h-3" />}
            {status === "failed" && <XCircle className="w-3 h-3" />}
            <span>{(item as any).label || `步骤 ${idx + 1}`}</span>
          </div>
        )
      })}
    </div>
  )
}

function BadgeListDisplay({ value }: { value: unknown }) {
  const items = Array.isArray(value) ? value : ["item1", "item2", "item3"]
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, idx) => (
        <Badge key={idx} variant="secondary" className="text-[10px]">
          {String(item)}
        </Badge>
      ))}
    </div>
  )
}

function FileInfoDisplay({ value }: { value: unknown }) {
  const info = typeof value === "object" && value !== null ? value : {
    name: "script.txt",
    size: "52.3 KB",
    time: "2024-01-15 14:30"
  }
  return (
    <div className="flex items-center gap-3 bg-secondary/30 rounded-lg p-3">
      <FileJson className="w-8 h-8 text-blue-400" />
      <div>
        <p className="text-xs font-medium text-foreground">{(info as any).name}</p>
        <p className="text-[10px] text-muted-foreground">
          {(info as any).size} · {(info as any).time}
        </p>
      </div>
    </div>
  )
}

function ThinkingPanel({
  nodeData,
  nodeSpec,
}: {
  nodeData: PlaygroundNodeData | null
  nodeSpec: NodeSpec
}) {
  const isRunning = nodeData?.status === "running"

  if (!nodeData?.thinking && nodeData?.status === "idle") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">运行节点后查看 Agent 思考过程</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-4">
        {/* System prompt */}
        {nodeSpec.systemPrompt && (
          <div className="bg-secondary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">System Prompt</span>
            </div>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {nodeSpec.systemPrompt.slice(0, 500)}
              {nodeSpec.systemPrompt.length > 500 && "..."}
            </pre>
          </div>
        )}

        {/* Thinking process */}
        {nodeData?.thinking && (
          <div className="bg-secondary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                isRunning ? "bg-blue-500/20" : "bg-emerald-500/20"
              )}>
                <Brain className={cn(
                  "w-3.5 h-3.5",
                  isRunning ? "text-blue-400 animate-pulse" : "text-emerald-400"
                )} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {isRunning ? "思考中..." : "推理过程"}
              </span>
            </div>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {nodeData.thinking}
            </pre>
          </div>
        )}

        {/* Decision summary */}
        {nodeData?.status === "completed" && nodeData.output && (
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">决策完成</span>
            </div>
            <p className="text-xs text-foreground">
              {nodeSpec.model && `使用模型: ${nodeSpec.model}`}
              {nodeData.qualityScore && ` · 质量评分: ${nodeData.qualityScore.toFixed(2)}`}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function ConfigPanel({ nodeSpec }: { nodeSpec: NodeSpec }) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-4">
        {/* Parameters */}
        {nodeSpec.params.length > 0 && (
          <div className="bg-secondary/20 rounded-lg p-4">
            <h4 className="text-xs font-medium text-foreground mb-3">参数配置</h4>
            <div className="space-y-3">
              {nodeSpec.params.map((param) => (
                <div key={param.key} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{param.label}</p>
                    <p className="text-[10px] text-muted-foreground">{param.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-foreground">
                      {String(param.defaultValue)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{param.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QC Config */}
        {nodeSpec.qcConfig && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-4">
            <h4 className="text-xs font-medium text-amber-400 mb-3">质检配置</h4>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">投票模型</p>
                <div className="flex flex-wrap gap-1">
                  {nodeSpec.qcConfig.votingModels.map((model) => (
                    <Badge key={model} variant="secondary" className="text-[9px]">
                      {model}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">
                  通过阈值: <span className="text-foreground">{nodeSpec.qcConfig.threshold}</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">评分维度</p>
                <div className="grid grid-cols-2 gap-2">
                  {nodeSpec.qcConfig.dimensions.map((dim) => (
                    <div key={dim.name} className="flex items-center justify-between text-[10px]">
                      <span className="text-foreground">{dim.label}</span>
                      <span className="text-muted-foreground">{(dim.weight * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dependencies */}
        <div className="bg-secondary/20 rounded-lg p-4">
          <h4 className="text-xs font-medium text-foreground mb-3">依赖关系</h4>
          <div className="flex flex-wrap gap-2">
            {nodeSpec.dependsOn.length > 0 ? (
              nodeSpec.dependsOn.map((dep) => (
                <Badge key={dep} variant="outline" className="text-[10px]">
                  {dep}
                </Badge>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground">无上游依赖（入口节点）</span>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
