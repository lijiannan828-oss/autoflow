"use client"

import { cn } from "@/lib/utils"
import type { TraceNode, DecisionLevel } from "./mock-data"
import { MOCK_N02_PLANNING, MOCK_N14_EXECUTION, MOCK_N11_QC, MOCK_N12_REVIEW } from "./mock-data"
import { 
  Clock, DollarSign, Cpu, Zap, ChevronDown, ChevronUp, X,
  Brain, ListChecks, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Database, Lightbulb, Image, Video, Music, FileText, Layers,
  Play, ImageIcon
} from "lucide-react"
import { useState } from "react"

interface NodeDetailPanelProps {
  node: TraceNode
  onClose: () => void
}

const LEVEL_CONFIG: Record<DecisionLevel, { label: string; color: string; bgColor: string; tabs: string[] }> = {
  planning: { 
    label: "Planning", 
    color: "text-violet-300", 
    bgColor: "bg-violet-500/15 border-violet-500/30",
    tabs: ["Decision Chain", "Output", "Telemetry"] 
  },
  execution: { 
    label: "Execution", 
    color: "text-blue-300", 
    bgColor: "bg-blue-500/15 border-blue-500/30",
    tabs: ["Overview", "Shot Details", "Output", "Telemetry"] 
  },
  review: { 
    label: "QC/Review", 
    color: "text-amber-300", 
    bgColor: "bg-amber-500/15 border-amber-500/30",
    tabs: ["Report", "Dimensions", "Output", "Telemetry"] 
  },
  gate: { 
    label: "Gate", 
    color: "text-pink-300", 
    bgColor: "bg-pink-500/15 border-pink-500/30",
    tabs: ["Review Record", "Output", "Telemetry"] 
  },
  freeze: { 
    label: "Freeze", 
    color: "text-zinc-300", 
    bgColor: "bg-zinc-500/15 border-zinc-500/30",
    tabs: ["Freeze Record", "Output", "Telemetry"] 
  },
  compose: { 
    label: "Compose", 
    color: "text-cyan-300", 
    bgColor: "bg-cyan-500/15 border-cyan-500/30",
    tabs: ["Overview", "Output", "Telemetry"] 
  },
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const config = LEVEL_CONFIG[node.decision_level]
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30 bg-secondary/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-primary">{node.node_id}</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", config.bgColor, config.color)}>
              {config.label}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{node.node_name}</h3>
        <p className="text-[10px] text-muted-foreground">
          Agent: {node.agent_name.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
          {node.model && ` | Model: ${node.model}`}
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-4 py-2 flex items-center gap-1 border-b border-border/20 bg-secondary/10 overflow-x-auto">
        {config.tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
              i === activeTab 
                ? "bg-primary/20 text-primary border border-primary/30" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {renderTabContent(node, config.tabs[activeTab])}
      </div>
    </div>
  )
}

function renderTabContent(node: TraceNode, tab: string) {
  if (tab === "Telemetry") return <TelemetryTab node={node} />
  if (tab === "Output") return <OutputTab node={node} />
  if (tab === "Decision Chain") return <PlanningDecisionChain node={node} />
  if (tab === "Overview") return node.decision_level === "execution" ? <ExecutionOverview node={node} /> : <ComposeOverviewTab node={node} />
  if (tab === "Shot Details") return <ShotDetailsTab node={node} />
  if (tab === "Report") return <ReviewReportTab node={node} />
  if (tab === "Dimensions") return <DimensionAnalysisTab node={node} />
  if (tab === "Review Record") return <GateRecordTab node={node} />
  if (tab === "Freeze Record") return <FreezeRecordTab node={node} />
  return <PlaceholderTab tab={tab} />
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 输出预览面板 - 根据节点类型展示不同内容
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function OutputTab({ node }: { node: TraceNode }) {
  // 根据节点类型和状态生成不同的输出预览
  const getOutputConfig = () => {
    switch (node.node_id) {
      case "N01": // 剧本解析
        return { type: "text", title: "Structured Script", count: 1 }
      case "N02": // 拆镜
        return { type: "text", title: "Shot List", count: 32 }
      case "N06": // 视觉策划
        return { type: "text", title: "Visual Strategy", count: 5 }
      case "N07": // 美术资产图
        return { type: "image", title: "Art Assets", count: 12 }
      case "N07b": // 音色
        return { type: "audio", title: "Voice Samples", count: 4 }
      case "N10": // 关键帧
        return { type: "image", title: "Keyframes", count: 32 }
      case "N14": // 视频
        return { type: "video", title: "Video Clips", count: 32 }
      case "N20": // 视听整合
        return { type: "video", title: "AV Integrated", count: 32 }
      case "N23": // 成片
        return { type: "video", title: "Final Cut", count: 1 }
      default:
        return { type: "text", title: "Output", count: 1 }
    }
  }

  const config = getOutputConfig()
  const isCompleted = node.status === "completed" || node.status === "gate_approved"
  const isRunning = node.status === "running"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {config.type === "image" && <ImageIcon className="w-4 h-4 text-primary" />}
          {config.type === "video" && <Video className="w-4 h-4 text-primary" />}
          {config.type === "audio" && <Music className="w-4 h-4 text-primary" />}
          {config.type === "text" && <FileText className="w-4 h-4 text-primary" />}
          <span className="text-sm font-medium">{config.title}</span>
        </div>
        <span className="text-xs text-muted-foreground">{config.count} items</span>
      </div>

      {/* 输出网格 */}
      <div className={cn(
        "grid gap-2",
        config.type === "image" || config.type === "video" ? "grid-cols-3" : "grid-cols-1"
      )}>
        {Array.from({ length: Math.min(config.count, 9) }).map((_, i) => {
          const itemCompleted = isCompleted || (isRunning && i < (node.batch_stats?.completed || 0))
          const itemRunning = isRunning && i >= (node.batch_stats?.completed || 0) && i < (node.batch_stats?.completed || 0) + (node.batch_stats?.running || 0)
          
          return (
            <OutputItem 
              key={i}
              index={i + 1}
              type={config.type}
              status={itemCompleted ? "completed" : itemRunning ? "running" : "pending"}
              nodeId={node.node_id}
            />
          )
        })}
      </div>

      {config.count > 9 && (
        <button className="w-full text-xs text-muted-foreground hover:text-foreground py-2 border border-dashed border-border/50 rounded-lg transition-colors">
          View all {config.count} items...
        </button>
      )}
    </div>
  )
}

function OutputItem({ index, type, status, nodeId }: { 
  index: number
  type: string
  status: "completed" | "running" | "pending"
  nodeId: string
}) {
  if (type === "image" || type === "video") {
    return (
      <div className={cn(
        "aspect-[9/16] rounded-lg border-2 overflow-hidden relative",
        status === "completed" ? "border-emerald-500/30 bg-emerald-950/20" :
        status === "running" ? "border-blue-500/30 bg-blue-950/20 animate-pulse" :
        "border-border/30 bg-secondary/20 border-dashed"
      )}>
        {status === "completed" ? (
          <>
            {/* 模拟图片/视频内容 */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 to-blue-900/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              {type === "video" && <Play className="w-8 h-8 text-white/60" />}
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-[9px] text-white/80">
              Shot #{index} {type === "video" && "| 2.1s"}
            </div>
          </>
        ) : status === "running" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-blue-400">Generating...</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <div className="w-8 h-8 rounded-lg border border-dashed border-border/50 flex items-center justify-center">
              {type === "video" ? <Video className="w-4 h-4 text-muted-foreground/50" /> : <ImageIcon className="w-4 h-4 text-muted-foreground/50" />}
            </div>
            <span className="text-[9px] text-muted-foreground">#{index}</span>
          </div>
        )}
      </div>
    )
  }

  if (type === "audio") {
    return (
      <div className={cn(
        "h-16 rounded-lg border flex items-center gap-3 px-3",
        status === "completed" ? "border-emerald-500/30 bg-emerald-950/20" :
        status === "running" ? "border-blue-500/30 bg-blue-950/20" :
        "border-border/30 bg-secondary/20 border-dashed"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          status === "completed" ? "bg-emerald-500/20" : "bg-secondary/50"
        )}>
          {status === "completed" ? (
            <Play className="w-4 h-4 text-emerald-400" />
          ) : (
            <Music className="w-4 h-4 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">Voice Sample #{index}</p>
          <p className="text-[10px] text-muted-foreground">
            {status === "completed" ? "12.3s | 44.1kHz" : status === "running" ? "Generating..." : "Pending"}
          </p>
        </div>
        {status === "completed" && (
          <div className="flex-1 h-6 flex items-end gap-0.5">
            {Array.from({ length: 20 }).map((_, i) => (
              <div 
                key={i} 
                className="flex-1 bg-emerald-500/60 rounded-sm"
                style={{ height: `${Math.random() * 100}%` }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Text output
  return (
    <div className={cn(
      "p-3 rounded-lg border",
      status === "completed" ? "border-emerald-500/30 bg-emerald-950/10" :
      "border-border/30 bg-secondary/20 border-dashed"
    )}>
      {status === "completed" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Output #{index}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-3">
            {nodeId === "N02" 
              ? `Shot ${index}: 宫殿大厅夜景 | 中景 | 太后端坐凤椅，目光如炬...`
              : "Output data generated successfully."}
          </p>
        </div>
      ) : (
        <div className="text-center py-2 text-muted-foreground">
          <FileText className="w-5 h-5 mx-auto mb-1 opacity-50" />
          <span className="text-[10px]">Pending</span>
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 策划节点 - 五步决策链
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PlanningDecisionChain({ node }: { node: TraceNode }) {
  const data = MOCK_N02_PLANNING
  const [expandedStep, setExpandedStep] = useState<number | null>(1)
  
  return (
    <div className="space-y-3">
      {/* Step 1: 全集需求理解 */}
      <DecisionStep 
        step={1} 
        title="Context Understanding" 
        icon={Brain}
        status="completed"
        expanded={expandedStep === 1}
        onToggle={() => setExpandedStep(expandedStep === 1 ? null : 1)}
      >
        <div className="grid grid-cols-2 gap-2 mb-2">
          <MiniInfoCard label="Genre" value={data.context.genre} />
          <MiniInfoCard label="Shots" value={data.context.shot_count} />
          <MiniInfoCard label="Scenes" value={data.context.scene_count} />
          <MiniInfoCard label="Characters" value={data.context.character_count} />
        </div>
        <div className="text-[10px] text-muted-foreground">
          <span className="text-foreground/70">Emotion Arc:</span> {data.context.emotion_arc}
        </div>
      </DecisionStep>

      {/* Step 2: RAG 检索 */}
      <DecisionStep 
        step={2} 
        title="RAG Retrieval" 
        subtitle="By scene type"
        icon={Database}
        status="completed"
        expanded={expandedStep === 2}
        onToggle={() => setExpandedStep(expandedStep === 2 ? null : 2)}
      >
        <div className="space-y-1.5">
          {data.rag_by_scene.map((scene, i) => (
            <div key={i} className={cn(
              "flex items-center justify-between p-1.5 rounded text-[10px]",
              scene.has_gap ? "bg-amber-500/10 border border-amber-500/30" : "bg-secondary/30"
            )}>
              <span className="text-foreground/80 truncate max-w-[120px]">{scene.scene_type}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{scene.results_count > 0 ? `${scene.top_score}` : "N/A"}</span>
                {scene.has_gap && <AlertTriangle className="w-3 h-3 text-amber-400" />}
              </div>
            </div>
          ))}
        </div>
      </DecisionStep>

      {/* Step 3: 策略表 */}
      <DecisionStep 
        step={3} 
        title="Strategy Table" 
        icon={Layers}
        status="completed"
        expanded={expandedStep === 3}
        onToggle={() => setExpandedStep(expandedStep === 3 ? null : 3)}
      >
        <div className="space-y-1">
          {data.strategy_table.map((row, i) => (
            <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-border/10 last:border-0">
              <span className="text-foreground/80 truncate max-w-[100px]">{row.scene_type}</span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{row.shot_count} shots</span>
                <span className="text-emerald-400">CNY {row.budget_cny}</span>
              </div>
            </div>
          ))}
        </div>
      </DecisionStep>

      {/* Step 4: 生成配方 */}
      <DecisionStep 
        step={4} 
        title="Generation Recipes" 
        subtitle={`${data.shot_recipes.length} samples | Budget CNY ${data.total_budget_cny}`}
        icon={ListChecks}
        status="completed"
        expanded={expandedStep === 4}
        onToggle={() => setExpandedStep(expandedStep === 4 ? null : 4)}
      >
        <div className="space-y-1">
          {data.shot_recipes.slice(0, 4).map((shot, i) => (
            <div key={i} className={cn(
              "flex items-center justify-between text-[10px] py-1 px-1.5 rounded",
              shot.notes.includes("高潮") && "bg-violet-500/10"
            )}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary">#{shot.shot_number}</span>
                <span className="text-foreground/80">{shot.shot_type}</span>
                <DifficultyBadge difficulty={shot.difficulty} />
              </div>
              <span className="text-emerald-400">CNY {shot.budget_cny}</span>
            </div>
          ))}
          {data.shot_recipes.length > 4 && (
            <p className="text-[10px] text-muted-foreground text-center py-1">+{data.shot_recipes.length - 4} more...</p>
          )}
        </div>
      </DecisionStep>

      {/* Step 5: 自检 */}
      <DecisionStep 
        step={5} 
        title="Self-Check" 
        icon={CheckCircle2}
        status="completed"
        expanded={expandedStep === 5}
        onToggle={() => setExpandedStep(expandedStep === 5 ? null : 5)}
      >
        <div className="space-y-1">
          {data.self_check.checks.map((check, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              {check.passed 
                ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                : <XCircle className="w-3 h-3 text-red-400 shrink-0" />
              }
              <span className="text-foreground/80">{check.item}</span>
            </div>
          ))}
          {data.self_check.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] text-amber-400 mt-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="truncate">{w}</span>
            </div>
          ))}
        </div>
      </DecisionStep>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 执行节点 - 执行总览
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExecutionOverview({ node }: { node: TraceNode }) {
  const data = MOCK_N14_EXECUTION
  const summary = data.summary

  return (
    <div className="space-y-4">
      {/* 关键指标 */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total" value={summary.total_shots} />
        <StatCard label="Done" value={summary.completed} color="text-emerald-400" />
        <StatCard label="Running" value={summary.running} color="text-blue-400" />
        <StatCard label="Retried" value={summary.retried} color="text-amber-400" />
        <StatCard label="Pass Rate" value={`${(summary.one_pass_rate * 100).toFixed(0)}%`} color="text-emerald-400" />
        <StatCard label="Budget" value={`${(summary.budget_usage * 100).toFixed(0)}%`} color={summary.budget_usage > 0.9 ? "text-amber-400" : "text-emerald-400"} />
      </div>

      {/* 成本与质量 */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard icon={Clock} label="Duration" value={formatDuration(summary.total_duration_seconds)} />
        <MetricCard icon={DollarSign} label="Cost" value={`CNY ${summary.total_cost_cny}`} />
        <MetricCard icon={Zap} label="Avg Quality" value={summary.avg_quality_score.toString()} />
        <MetricCard icon={RefreshCw} label="Retries" value={summary.retried.toString()} />
      </div>

      {/* 简化的执行结果 */}
      <div>
        <h4 className="text-[10px] font-medium text-muted-foreground mb-2">Recent Results</h4>
        <div className="space-y-1">
          {data.shot_results.slice(0, 5).map((shot, i) => (
            <div key={i} className={cn(
              "flex items-center justify-between text-[10px] py-1.5 px-2 rounded",
              shot.retry_count > 0 ? "bg-amber-500/10" : shot.status === "running" ? "bg-blue-500/10" : "bg-secondary/30"
            )}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary">#{shot.shot_number}</span>
                <StatusBadge status={shot.status} />
              </div>
              <div className="flex items-center gap-2">
                {shot.quality_score && <span className={shot.quality_score >= 8 ? "text-emerald-400" : "text-amber-400"}>{shot.quality_score}</span>}
                {shot.retry_count > 0 && <span className="text-amber-400">+{shot.retry_count}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 执行节点 - 逐镜头详情
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ShotDetailsTab({ node }: { node: TraceNode }) {
  const data = MOCK_N14_EXECUTION
  const [expandedShot, setExpandedShot] = useState<number | null>(28)

  return (
    <div className="space-y-2">
      {data.shot_results.map((shot, i) => {
        const hasDetails = shot.has_adjustments || shot.retry_count > 0
        const isExpanded = expandedShot === shot.shot_number

        return (
          <div key={i} className={cn(
            "rounded-lg border transition-all",
            shot.retry_count > 0 ? "border-amber-500/30 bg-amber-500/5" :
            shot.has_adjustments ? "border-violet-500/30 bg-violet-500/5" :
            shot.status === "running" ? "border-blue-500/30 bg-blue-500/5" :
            "border-border/30 bg-secondary/10"
          )}>
            <div 
              className={cn("p-2 flex items-center justify-between", hasDetails && "cursor-pointer")}
              onClick={hasDetails ? () => setExpandedShot(isExpanded ? null : shot.shot_number) : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-primary">#{shot.shot_number}</span>
                <span className="text-[10px] text-foreground/80 truncate max-w-[80px]">{shot.scene}</span>
                <StatusBadge status={shot.status} />
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                {shot.quality_score && (
                  <span className={shot.quality_score >= 8.5 ? "text-emerald-400" : shot.quality_score >= 7.5 ? "text-foreground" : "text-amber-400"}>
                    {shot.quality_score}
                  </span>
                )}
                {shot.retry_count > 0 && <span className="text-amber-400">+{shot.retry_count}</span>}
                {hasDetails && (isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </div>
            </div>

            {isExpanded && hasDetails && (
              <div className="px-2 pb-2 border-t border-border/20 pt-2 space-y-2">
                {shot.adjustments && (
                  <div className="space-y-1">
                    <p className="text-[9px] text-muted-foreground font-medium">Adjustments:</p>
                    {shot.adjustments.map((adj, j) => (
                      <div key={j} className="text-[9px] flex items-center gap-1 text-violet-300">
                        <span className="font-mono">{adj.param}</span>
                        <span className="text-muted-foreground">{adj.from_value} → {adj.to_value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {shot.retries && (
                  <div className="space-y-1">
                    <p className="text-[9px] text-muted-foreground font-medium">Retries:</p>
                    {shot.retries.map((retry, j) => (
                      <div key={j} className="text-[9px] text-amber-300">
                        Attempt {retry.attempt}: {retry.score} - {retry.failure_reason}
                      </div>
                    ))}
                  </div>
                )}
                {shot.memory_written && (
                  <div className="text-[9px] text-cyan-400 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    Memory: {shot.memory_written}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 质检节点 - 检查报告
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ReviewReportTab({ node }: { node: TraceNode }) {
  const data = MOCK_N11_QC

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Pass Rate" value={`${(data.summary.pass_rate * 100).toFixed(0)}%`} color="text-emerald-400" />
        <StatCard label="Avg Score" value={data.summary.avg_score.toFixed(1)} />
        <StatCard label="Rejected" value={data.summary.rejected} color="text-red-400" />
      </div>

      <div>
        <h4 className="text-[10px] font-medium text-muted-foreground mb-2">Rejected Items</h4>
        <div className="space-y-1">
          {data.rejected_shots.map((shot, i) => (
            <div key={i} className="p-2 rounded bg-red-500/10 border border-red-500/30 text-[10px]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-primary">#{shot.shot_number}</span>
                <span className="text-red-400">{shot.final_score}</span>
              </div>
              <p className="text-muted-foreground">{shot.rejection_reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 质检节点 - 维度分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DimensionAnalysisTab({ node }: { node: TraceNode }) {
  const dimensions = [
    { name: "Composition", avg: 8.7, min: 7.2, max: 9.5 },
    { name: "Lighting", avg: 8.2, min: 5.8, max: 9.3 },
    { name: "Color", avg: 8.5, min: 7.5, max: 9.4 },
    { name: "Character", avg: 8.4, min: 6.8, max: 9.2 },
    { name: "Motion", avg: 7.9, min: 6.5, max: 9.0 },
    { name: "Continuity", avg: 8.1, min: 6.2, max: 9.1 },
  ]

  return (
    <div className="space-y-3">
      {dimensions.map((dim, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-foreground/80">{dim.name}</span>
            <span className={dim.avg >= 8 ? "text-emerald-400" : "text-amber-400"}>{dim.avg}</span>
          </div>
          <div className="h-2 bg-secondary/50 rounded-full overflow-hidden relative">
            <div 
              className={cn("h-full rounded-full", dim.avg >= 8 ? "bg-emerald-500/60" : "bg-amber-500/60")}
              style={{ width: `${dim.avg * 10}%` }}
            />
            <div 
              className="absolute top-0 w-0.5 h-full bg-red-400"
              style={{ left: `${dim.min * 10}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Min: {dim.min}</span>
            <span>Max: {dim.max}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Gate 节点 - 审核记录
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GateRecordTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg border border-border/30 bg-secondary/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Reviewer</span>
          <span className="text-xs text-foreground">{node.gate_reviewer_name || "Pending"}</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Decision</span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded",
            node.gate_decision === "approved" ? "bg-emerald-500/20 text-emerald-400" : 
            node.gate_decision === "rejected" ? "bg-red-500/20 text-red-400" : 
            "bg-amber-500/20 text-amber-400"
          )}>
            {node.gate_decision === "approved" ? "Approved" : 
             node.gate_decision === "rejected" ? "Rejected" : "Pending"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Duration</span>
          <span className="text-xs text-muted-foreground">{node.gate_duration_seconds ? formatDuration(node.gate_duration_seconds) : "-"}</span>
        </div>
      </div>

      {node.gate_feedback && (
        <div className="p-3 rounded-lg border border-border/30 bg-secondary/20">
          <p className="text-xs font-medium mb-2">Feedback</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{node.gate_feedback}</p>
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 定稿节点
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function FreezeRecordTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg border border-border/30 bg-secondary/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Status</span>
          <span className={cn(
            "text-xs px-2 py-0.5 rounded",
            node.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
          )}>
            {node.status === "completed" ? "Frozen" : "Pending"}
          </span>
        </div>
        {node.duration_seconds && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Duration</span>
            <span className="text-xs text-muted-foreground">{formatDuration(node.duration_seconds)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 合成节点
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ComposeOverviewTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard icon={Clock} label="Duration" value={node.duration_seconds ? formatDuration(node.duration_seconds) : "-"} />
        <MetricCard icon={DollarSign} label="Cost" value={node.cost_cny > 0 ? `CNY ${node.cost_cny}` : "-"} />
      </div>
      <div className="p-3 rounded-lg border border-border/30 bg-secondary/20">
        <p className="text-xs font-medium mb-2">Model</p>
        <p className="text-[11px] text-muted-foreground">{node.model || "N/A"}</p>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 遥测面板
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TelemetryTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard icon={Clock} label="Duration" value={node.duration_seconds ? formatDuration(node.duration_seconds) : "-"} />
        <MetricCard icon={DollarSign} label="Cost" value={node.cost_cny > 0 ? `CNY ${node.cost_cny.toFixed(3)}` : "-"} />
        <MetricCard icon={Cpu} label="Model" value={node.model || "N/A"} />
        <MetricCard icon={Zap} label="Quality" value={node.quality_score?.toString() || "-"} />
      </div>
    </div>
  )
}

function PlaceholderTab({ tab }: { tab: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p className="text-xs">{tab} content</p>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 辅助组件
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DecisionStep({ step, title, subtitle, icon: Icon, status, expanded, onToggle, children }: {
  step: number
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  status: "completed" | "running" | "pending"
  expanded?: boolean
  onToggle?: () => void
  children: React.ReactNode
}) {
  return (
    <div className={cn(
      "rounded-lg border transition-all",
      status === "completed" ? "border-emerald-500/30 bg-emerald-950/10" :
      status === "running" ? "border-blue-500/30 bg-blue-950/10" :
      "border-border/30 bg-secondary/10"
    )}>
      <div 
        className={cn("p-2 flex items-center justify-between", onToggle && "cursor-pointer")}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
            status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
            status === "running" ? "bg-blue-500/20 text-blue-400" :
            "bg-secondary/50 text-muted-foreground"
          )}>
            {step}
          </div>
          <Icon className={cn(
            "w-3.5 h-3.5",
            status === "completed" ? "text-emerald-400" :
            status === "running" ? "text-blue-400" :
            "text-muted-foreground"
          )} />
          <span className="text-xs font-medium text-foreground/90">{title}</span>
          {subtitle && <span className="text-[10px] text-muted-foreground">({subtitle})</span>}
        </div>
        <div className="flex items-center gap-1">
          {status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          {onToggle && (expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />)}
        </div>
      </div>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function MiniInfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-secondary/30 rounded px-2 py-1.5">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground">{value}</p>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-2 text-center">
      <p className="text-[9px] text-muted-foreground mb-0.5">{label}</p>
      <p className={cn("text-sm font-bold", color || "text-foreground")}>{value}</p>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="bg-secondary/30 rounded-lg p-2 flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[9px] text-muted-foreground">{label}</p>
        <p className="text-xs font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const config: Record<string, string> = {
    S0: "bg-emerald-500/20 text-emerald-400",
    S1: "bg-blue-500/20 text-blue-400",
    S2: "bg-amber-500/20 text-amber-400",
    S3: "bg-red-500/20 text-red-400",
  }
  return (
    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-mono", config[difficulty] || "bg-secondary/50 text-muted-foreground")}>
      {difficulty}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Done" },
    running: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Running" },
    pending: { bg: "bg-zinc-500/20", text: "text-zinc-400", label: "Pending" },
    failed: { bg: "bg-red-500/20", text: "text-red-400", label: "Failed" },
  }
  const c = config[status] || config.pending
  return (
    <span className={cn("text-[9px] px-1.5 py-0.5 rounded", c.bg, c.text)}>
      {c.label}
    </span>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const min = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  if (min < 60) return `${min}m${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h${min % 60}m`
}
