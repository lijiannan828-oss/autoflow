"use client"

import { cn } from "@/lib/utils"
import type { TraceNode, DecisionLevel } from "./mock-data"
import { MOCK_N02_PLANNING, MOCK_N14_EXECUTION, MOCK_N11_QC, MOCK_N12_REVIEW } from "./mock-data"
import { 
  Clock, DollarSign, Cpu, Zap, ChevronDown, ChevronUp, X,
  Brain, ListChecks, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Database, Lightbulb, TrendingUp, Eye, MessageSquare, BarChart3,
  Play, Pause, RotateCcw, ArrowRight, FileText, Layers
} from "lucide-react"
import { useState } from "react"

interface NodeDetailPanelProps {
  node: TraceNode
  onClose: () => void
}

const LEVEL_CONFIG: Record<DecisionLevel, { label: string; color: string; bgColor: string; tabs: string[] }> = {
  planning: { 
    label: "集级策划", 
    color: "text-violet-300", 
    bgColor: "bg-violet-500/15 border-violet-500/30",
    tabs: ["五步决策链", "输入/输出", "遥测"] 
  },
  execution: { 
    label: "批量执行", 
    color: "text-blue-300", 
    bgColor: "bg-blue-500/15 border-blue-500/30",
    tabs: ["执行总览", "逐镜头详情", "遥测"] 
  },
  review: { 
    label: "质检/复盘", 
    color: "text-amber-300", 
    bgColor: "bg-amber-500/15 border-amber-500/30",
    tabs: ["检查报告", "维度分析", "遥测"] 
  },
  gate: { 
    label: "人工审核", 
    color: "text-pink-300", 
    bgColor: "bg-pink-500/15 border-pink-500/30",
    tabs: ["审核记录", "遥测"] 
  },
  freeze: { 
    label: "定稿操作", 
    color: "text-zinc-300", 
    bgColor: "bg-zinc-500/15 border-zinc-500/30",
    tabs: ["定稿记录", "遥测"] 
  },
  compose: { 
    label: "合成/分发", 
    color: "text-cyan-300", 
    bgColor: "bg-cyan-500/15 border-cyan-500/30",
    tabs: ["概览", "输入/输出", "遥测"] 
  },
}

export function NodeDetailPanel({ node, onClose }: NodeDetailPanelProps) {
  const config = LEVEL_CONFIG[node.decision_level]
  const [activeTab, setActiveTab] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={cn(
      "border-t border-border/50 bg-card/95 backdrop-blur-xl transition-all duration-300",
      collapsed ? "h-12" : "min-h-[320px] max-h-[60vh]"
    )}>
      {/* Header bar */}
      <div 
        className="h-12 px-5 flex items-center justify-between border-b border-border/30 cursor-pointer hover:bg-secondary/30 transition-colors" 
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-primary">{node.node_id}</span>
            <span className="text-sm font-medium text-foreground">{node.node_name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {node.agent_name.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
          </span>
          <span className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium", config.bgColor, config.color)}>
            {config.label}
          </span>
          {node.model && (
            <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
              {node.model}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={e => { e.stopPropagation(); onClose() }} 
            className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {collapsed ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Tabs */}
          <div className="h-10 px-5 flex items-center gap-1 border-b border-border/20 bg-secondary/20">
            {config.tabs.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
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
          <div className="p-5 overflow-auto" style={{ maxHeight: "calc(60vh - 90px)" }}>
            {renderTabContent(node, config.tabs[activeTab])}
          </div>
        </>
      )}
    </div>
  )
}

function renderTabContent(node: TraceNode, tab: string) {
  if (tab === "遥测") return <TelemetryTab node={node} />
  if (tab === "五步决策链") return <PlanningDecisionChain node={node} />
  if (tab === "执行总览") return <ExecutionOverview node={node} />
  if (tab === "逐镜头详情") return <ShotDetailsTab node={node} />
  if (tab === "检查报告") return <ReviewReportTab node={node} />
  if (tab === "维度分析") return <DimensionAnalysisTab node={node} />
  if (tab === "审核记录") return <GateRecordTab node={node} />
  if (tab === "定稿记录") return <FreezeRecordTab node={node} />
  if (tab === "概览") return <ComposeOverviewTab node={node} />
  return <PlaceholderTab tab={tab} />
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 策划节点 - 五步决策链
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PlanningDecisionChain({ node }: { node: TraceNode }) {
  const data = MOCK_N02_PLANNING
  
  return (
    <div className="space-y-4">
      {/* Step 1: 全集需求理解 */}
      <DecisionStep 
        step={1} 
        title="全集需求理解" 
        icon={Brain}
        status="completed"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <MiniInfoCard label="题材" value={data.context.genre} />
          <MiniInfoCard label="场景数" value={data.context.scene_count} />
          <MiniInfoCard label="角色数" value={data.context.character_count} />
          <MiniInfoCard label="镜头数" value={data.context.shot_count} />
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          <span className="text-foreground/70">情绪弧线：</span> {data.context.emotion_arc}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.context.project_constraints.map((c, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 bg-secondary/50 rounded-full text-muted-foreground">{c}</span>
          ))}
        </div>
      </DecisionStep>

      {/* Step 2: RAG 检索 */}
      <DecisionStep 
        step={2} 
        title="场景级 RAG 检索" 
        subtitle="按场景类型批量检索，非逐镜头"
        icon={Database}
        status="completed"
      >
        <div className="space-y-2">
          {data.rag_by_scene.map((scene, i) => (
            <div key={i} className={cn(
              "flex items-center justify-between p-2 rounded-lg text-xs",
              scene.has_gap ? "bg-amber-500/10 border border-amber-500/30" : "bg-secondary/30"
            )}>
              <span className="font-medium text-foreground/90">{scene.scene_type}</span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">
                  {scene.results_count > 0 ? `TOP-3 最高 ${scene.top_score}` : "无案例"}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded",
                  scene.has_gap ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                )}>
                  {scene.recommended_strategy}
                </span>
                {scene.has_gap && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              </div>
            </div>
          ))}
        </div>
      </DecisionStep>

      {/* Step 3: 策略表 */}
      <DecisionStep 
        step={3} 
        title="全集视觉策略表" 
        icon={Layers}
        status="completed"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 text-muted-foreground font-medium">场景</th>
                <th className="text-center py-2 text-muted-foreground font-medium">镜头数</th>
                <th className="text-center py-2 text-muted-foreground font-medium">难度分布</th>
                <th className="text-right py-2 text-muted-foreground font-medium">预算</th>
              </tr>
            </thead>
            <tbody>
              {data.strategy_table.map((row, i) => (
                <tr key={i} className="border-b border-border/10">
                  <td className="py-2 font-medium text-foreground/90">{row.scene_type}</td>
                  <td className="py-2 text-center text-muted-foreground">{row.shot_count}</td>
                  <td className="py-2 text-center text-muted-foreground">{row.difficulty_distribution}</td>
                  <td className="py-2 text-right text-emerald-400">¥{row.budget_cny}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DecisionStep>

      {/* Step 4: 生成配方 */}
      <DecisionStep 
        step={4} 
        title="生成配方总览" 
        subtitle={`${data.shot_recipes.length} 个镜头配方示例 · 总预算 ¥${data.total_budget_cny}`}
        icon={ListChecks}
        status="completed"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 text-muted-foreground font-medium">#</th>
                <th className="text-left py-2 text-muted-foreground font-medium">场景</th>
                <th className="text-center py-2 text-muted-foreground font-medium">景别</th>
                <th className="text-center py-2 text-muted-foreground font-medium">难度</th>
                <th className="text-center py-2 text-muted-foreground font-medium">候选</th>
                <th className="text-right py-2 text-muted-foreground font-medium">预算</th>
                <th className="text-left py-2 text-muted-foreground font-medium pl-3">备注</th>
              </tr>
            </thead>
            <tbody>
              {data.shot_recipes.map((shot, i) => (
                <tr key={i} className={cn(
                  "border-b border-border/10",
                  shot.notes.includes("高潮") && "bg-violet-500/10"
                )}>
                  <td className="py-1.5 font-mono text-foreground/70">{shot.shot_number}</td>
                  <td className="py-1.5 text-foreground/90">{shot.scene}</td>
                  <td className="py-1.5 text-center text-muted-foreground">{shot.shot_type}</td>
                  <td className="py-1.5 text-center">
                    <DifficultyBadge difficulty={shot.difficulty} />
                  </td>
                  <td className="py-1.5 text-center text-muted-foreground">{shot.candidate_count}</td>
                  <td className="py-1.5 text-right text-emerald-400">¥{shot.budget_cny}</td>
                  <td className="py-1.5 pl-3 text-muted-foreground text-[10px]">{shot.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DecisionStep>

      {/* Step 5: 自检 */}
      <DecisionStep 
        step={5} 
        title="自检" 
        icon={CheckCircle2}
        status="completed"
      >
        <div className="space-y-2">
          {data.self_check.checks.map((check, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {check.passed 
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                : <XCircle className="w-3.5 h-3.5 text-red-400" />
              }
              <span className="text-foreground/90">{check.item}：</span>
              <span className="text-muted-foreground">{check.detail}</span>
            </div>
          ))}
          {data.self_check.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-400 mt-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{w}</span>
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
    <div className="space-y-5">
      {/* 关键指标 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="总镜头" value={summary.total_shots} />
        <StatCard label="已完成" value={summary.completed} color="text-emerald-400" />
        <StatCard label="运行中" value={summary.running} color="text-blue-400" icon={<div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />} />
        <StatCard label="重试" value={summary.retried} color="text-amber-400" />
        <StatCard label="一次通过率" value={`${(summary.one_pass_rate * 100).toFixed(1)}%`} color="text-emerald-400" />
        <StatCard label="预算使用" value={`${(summary.budget_usage * 100).toFixed(0)}%`} color={summary.budget_usage > 0.9 ? "text-amber-400" : "text-emerald-400"} />
      </div>

      {/* 成本与质量 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Clock} label="总耗时" value={formatDuration(summary.total_duration_seconds)} />
        <MetricCard icon={DollarSign} label="总成本" value={`¥${summary.total_cost_cny}`} subtitle={`预算 ¥${summary.budget_cny}`} />
        <MetricCard icon={Zap} label="平均质量" value={summary.avg_quality_score.toString()} />
        <MetricCard icon={BarChart3} label="质量分布" value="7.1 - 9.5" subtitle="最低 - 最高" />
      </div>

      {/* 执行结果表 */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-2">执行结果（显示异常项优先）</h4>
        <div className="overflow-x-auto rounded-lg border border-border/30">
          <table className="w-full text-xs">
            <thead className="bg-secondary/30">
              <tr>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">#</th>
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">场景</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">状态</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">评分</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">耗时</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">成本</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">微调</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">重试</th>
              </tr>
            </thead>
            <tbody>
              {data.shot_results.map((shot, i) => (
                <tr key={i} className={cn(
                  "border-t border-border/10",
                  shot.retry_count > 0 && "bg-amber-500/5",
                  shot.status === "running" && "bg-blue-500/5"
                )}>
                  <td className="py-2 px-3 font-mono text-foreground/70">{shot.shot_number}</td>
                  <td className="py-2 px-3 text-foreground/90">{shot.scene}</td>
                  <td className="py-2 px-3 text-center">
                    <StatusBadge status={shot.status} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    {shot.quality_score ? (
                      <span className={cn(
                        shot.quality_score >= 8.5 ? "text-emerald-400" :
                        shot.quality_score >= 7.5 ? "text-foreground" : "text-amber-400"
                      )}>
                        {shot.quality_score}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2 px-3 text-center text-muted-foreground">
                    {shot.duration_seconds ? `${shot.duration_seconds}s` : "—"}
                  </td>
                  <td className="py-2 px-3 text-right text-emerald-400">
                    {shot.cost_cny > 0 ? `¥${shot.cost_cny}` : "—"}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {shot.has_adjustments && <span className="text-violet-400">📌</span>}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {shot.retry_count > 0 && (
                      <span className="text-amber-400 flex items-center justify-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        {shot.retry_count}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

  const shot28 = data.shot_results.find(s => s.shot_number === 28)
  const shot12 = data.shot_results.find(s => s.shot_number === 12)

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-4">点击展开查看镜头级执行详情和微调记录</p>
      
      {/* 正常镜头（无微调） */}
      <ShotDetailCard 
        shot={data.shot_results[1]!} 
        expanded={false}
        onToggle={() => {}}
      />

      {/* 有微调的镜头 */}
      <ShotDetailCard 
        shot={shot12!} 
        expanded={expandedShot === 12}
        onToggle={() => setExpandedShot(expandedShot === 12 ? null : 12)}
      />

      {/* 有重试的镜头（展开） */}
      <ShotDetailCard 
        shot={shot28!} 
        expanded={expandedShot === 28}
        onToggle={() => setExpandedShot(expandedShot === 28 ? null : 28)}
      />
    </div>
  )
}

function ShotDetailCard({ shot, expanded, onToggle }: { 
  shot: typeof MOCK_N14_EXECUTION.shot_results[0]
  expanded: boolean
  onToggle: () => void 
}) {
  const hasDetails = shot.has_adjustments || shot.retry_count > 0

  return (
    <div className={cn(
      "rounded-lg border transition-all",
      shot.retry_count > 0 ? "border-amber-500/30 bg-amber-500/5" :
      shot.has_adjustments ? "border-violet-500/30 bg-violet-500/5" :
      "border-border/30 bg-secondary/20"
    )}>
      <div 
        className={cn("p-3 flex items-center justify-between", hasDetails && "cursor-pointer")}
        onClick={hasDetails ? onToggle : undefined}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-primary">#{shot.shot_number}</span>
          <span className="text-xs text-foreground/90">{shot.scene}</span>
          <span className="text-[10px] text-muted-foreground">{shot.shot_type}</span>
          <StatusBadge status={shot.status} />
        </div>
        <div className="flex items-center gap-4 text-xs">
          {shot.quality_score && (
            <span className={cn(
              shot.quality_score >= 8.5 ? "text-emerald-400" : 
              shot.quality_score >= 7.5 ? "text-foreground" : "text-amber-400"
            )}>
              {shot.quality_score}
            </span>
          )}
          {shot.has_adjustments && <span className="text-violet-400 text-[10px]">有微调</span>}
          {shot.retry_count > 0 && <span className="text-amber-400 text-[10px]">重试{shot.retry_count}次</span>}
          {hasDetails && (expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
        </div>
      </div>

      {expanded && hasDetails && (
        <div className="px-3 pb-3 pt-0 border-t border-border/20 space-y-3">
          {/* 微调记录 */}
          {shot.adjustments && shot.adjustments.length > 0 && (
            <div>
              <p className="text-[10px] text-violet-400 font-medium mb-1.5 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> 执行时微调（规则+记忆，未调 LLM）
              </p>
              {shot.adjustments.map((adj, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground ml-4">
                  <span className="font-mono text-foreground/70">{adj.param}:</span>
                  <span>{adj.from_value}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="text-violet-300">{adj.to_value}</span>
                  <span className="text-[10px] text-muted-foreground">({adj.reason})</span>
                </div>
              ))}
            </div>
          )}

          {/* 重试记录 */}
          {shot.retries && shot.retries.length > 0 && (
            <div>
              <p className="text-[10px] text-amber-400 font-medium mb-1.5 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> 重试链
              </p>
              {shot.retries.map((retry, i) => (
                <div key={i} className="flex items-center gap-2 text-xs ml-4 mb-1">
                  <span className="text-muted-foreground">第{retry.attempt}次:</span>
                  <span className="text-red-400">{retry.score} ❌</span>
                  <span className="text-[10px] text-muted-foreground">({retry.failure_reason})</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-amber-300">{retry.adjustment_made}</span>
                </div>
              ))}
            </div>
          )}

          {/* 记忆写入 */}
          {(shot as any).memory_written && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Database className="w-3 h-3" />
              <span>写入记忆: {(shot as any).memory_written}</span>
            </div>
          )}
          {(shot as any).evolution_reported && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <TrendingUp className="w-3 h-3" />
              <span>上报 Evolution: {(shot as any).evolution_reported}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 质检节点 - 检查报告
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ReviewReportTab({ node }: { node: TraceNode }) {
  // 区分质检（N03, N11, N15）和复盘（N12, N16）
  const isQC = ["N03", "N11", "N15"].includes(node.node_id)
  
  if (isQC) {
    const data = MOCK_N11_QC
    return (
      <div className="space-y-5">
        {/* 总览 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="总镜头" value={data.summary.total_shots} />
          <StatCard label="通过" value={data.summary.passed} color="text-emerald-400" />
          <StatCard label="打回" value={data.summary.rejected} color="text-red-400" />
          <StatCard label="通过率" value={`${(data.summary.pass_rate * 100).toFixed(1)}%`} color="text-emerald-400" />
          <StatCard label="平均分" value={data.summary.avg_score.toString()} />
        </div>

        {/* 打回项 */}
        {data.rejected_items.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> 打回项（{data.rejected_items.length}）
            </h4>
            <div className="space-y-2">
              {data.rejected_items.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-foreground">#{item.shot_number}</span>
                    <span className="text-red-400">{item.score}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {item.failed_dimension}: <span className="text-red-400">{item.failed_score}</span> &lt; 阈值
                  </div>
                  <div className="text-amber-400 mt-1">{item.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 模型投票 */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">三模型投票结果（去极值取平均）</h4>
          <div className="flex gap-3">
            {data.model_votes.map((vote, i) => (
              <div key={i} className="flex-1 p-3 rounded-lg bg-secondary/30 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{vote.model}</p>
                <p className="text-lg font-semibold text-foreground">{vote.avg_score}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  } else {
    // 复盘节点（N12, N16）
    const data = MOCK_N12_REVIEW
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-bold text-foreground">{data.overall_score}</div>
          <div className="text-xs text-muted-foreground">整体连续性评分</div>
        </div>

        {/* 问题 */}
        {data.issues.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> 发现问题（{data.issues.length}）
            </h4>
            <div className="space-y-2">
              {data.issues.map((issue, i) => (
                <div key={i} className={cn(
                  "p-3 rounded-lg text-xs",
                  issue.severity === "critical" ? "bg-red-500/10 border border-red-500/30" : "bg-amber-500/10 border border-amber-500/30"
                )}>
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-foreground">{issue.description}</span>
                    <span className="text-muted-foreground text-[10px]">#{issue.affected_shots.join(", #")}</span>
                  </div>
                  <div className="text-muted-foreground mb-1">{issue.suggestion}</div>
                  <div className="flex gap-2">
                    {issue.memory_written && <span className="text-violet-400 text-[10px]">✓ 写入记忆</span>}
                    {issue.evolution_reported && <span className="text-cyan-400 text-[10px]">✓ 上报 Evolution</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 亮点 */}
        {data.highlights.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 亮点（{data.highlights.length}）
            </h4>
            <div className="space-y-2">
              {data.highlights.map((h, i) => (
                <div key={i} className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between">
                  <span className="text-foreground">{h.description}</span>
                  <span className="text-emerald-400 font-medium">{h.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 质检节点 - 维度分析
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DimensionAnalysisTab({ node }: { node: TraceNode }) {
  const data = MOCK_N11_QC

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">8 维度评分权重及本批次平均得分</p>
      <div className="space-y-2">
        {data.dimensions.map((dim, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 text-xs text-muted-foreground">{dim.label}</div>
            <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  dim.avg_score >= 8.5 ? "bg-emerald-500" :
                  dim.avg_score >= 7.5 ? "bg-blue-500" : "bg-amber-500"
                )}
                style={{ width: `${dim.avg_score * 10}%` }}
              />
            </div>
            <div className="w-10 text-xs text-right font-medium">{dim.avg_score}</div>
            <div className="w-12 text-[10px] text-muted-foreground text-right">{(dim.weight * 100).toFixed(0)}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Gate 节点 - 审核记录
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GateRecordTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-xl",
          node.gate_decision === "approved" ? "bg-emerald-500/20 text-emerald-400" :
          node.gate_decision === "rejected" ? "bg-amber-500/20 text-amber-400" :
          "bg-pink-500/20 text-pink-400"
        )}>
          {node.gate_decision === "approved" ? "✓" : node.gate_decision === "rejected" ? "↩" : "⏳"}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {node.gate_decision === "approved" ? "审核通过" : 
             node.gate_decision === "rejected" ? "审核打回" : "等待审核"}
          </p>
          <p className="text-xs text-muted-foreground">
            {node.gate_reviewer_name || "待分配审核人"}
            {node.gate_duration_seconds && ` · 耗时 ${formatDuration(node.gate_duration_seconds)}`}
          </p>
        </div>
      </div>

      {node.gate_feedback && (
        <div className="p-4 rounded-lg bg-secondary/30 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> 审核批注
          </p>
          <p className="text-sm text-foreground">&ldquo;{node.gate_feedback}&rdquo;</p>
        </div>
      )}

      {node.gate_decision === "approved" && node.node_id === "N08" && (
        <div className="text-xs text-muted-foreground">
          <p className="mb-2">资产确认情况：</p>
          <div className="space-y-1 ml-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>女主角（克莱尔）- 候选 #3 选定</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>太后 - 候选 #2 选定，发型需微调</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>宫殿大厅场景 - 候选 #1 选定</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>太后音色 - 样本 #2 选定</span>
            </div>
          </div>
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
      {node.status === "completed" ? (
        <>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">已固化</span>
          </div>
          <p className="text-xs text-muted-foreground">
            产物已锁定，不可修改。任何后续修改需创建新版本。
          </p>
          {node.model && (
            <div className="p-3 rounded-lg bg-secondary/30 text-xs">
              <p className="text-muted-foreground mb-1">固化工具</p>
              <p className="text-foreground">{node.model}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">等待上游节点完成后执行定稿操作</p>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 合成节点
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ComposeOverviewTab({ node }: { node: TraceNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {node.node_id === "N23" && "FFmpeg 多轨合成：视频 + TTS + BGM + SFX → 成片"}
        {node.node_id === "N16b" && "影调一致化 + 节奏调整 + 转场处理"}
        {node.node_id === "N26" && "按配置自动推送至 TikTok / YouTube / 飞书"}
      </p>
      {node.status === "pending" && (
        <p className="text-xs text-muted-foreground italic">等待上游节点完成</p>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 遥测 Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TelemetryTab({ node }: { node: TraceNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <MetricCard icon={Clock} label="执行时长" value={node.duration_seconds != null ? formatDuration(node.duration_seconds) : "—"} />
      <MetricCard icon={DollarSign} label="费用" value={`¥${node.cost_cny.toFixed(3)}`} />
      <MetricCard icon={Cpu} label="模型" value={node.model || "N/A"} />
      <MetricCard icon={Zap} label="质量均分" value={node.quality_score != null ? node.quality_score.toString() : "N/A"} />
    </div>
  )
}

function PlaceholderTab({ tab }: { tab: string }) {
  return <p className="text-xs text-muted-foreground italic">{tab} — 后端 API 接通后展示完整数据</p>
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 共享子组件
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DecisionStep({ step, title, subtitle, icon: Icon, status, children }: {
  step: number
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  status: "completed" | "running" | "pending"
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-secondary/10 overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/30 border-b border-border/20 flex items-center gap-3">
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
          status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground"
        )}>
          {step}
        </div>
        <Icon className="w-4 h-4 text-muted-foreground" />
        <div>
          <span className="text-xs font-medium text-foreground">{title}</span>
          {subtitle && <span className="text-[10px] text-muted-foreground ml-2">{subtitle}</span>}
        </div>
        {status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, subtitle }: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 border border-border/20">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  )
}

function StatCard({ label, value, color, icon }: { 
  label: string
  value: string | number
  color?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="text-center p-3 bg-secondary/20 rounded-lg border border-border/20">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <p className={cn("text-xl font-bold", color || "text-foreground")}>{value}</p>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function MiniInfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-2.5 border border-border/20">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  return (
    <span className={cn(
      "text-[10px] px-2 py-0.5 rounded font-medium",
      difficulty === "S0" ? "bg-zinc-500/20 text-zinc-300" :
      difficulty === "S1" ? "bg-blue-500/20 text-blue-300" :
      "bg-violet-500/20 text-violet-300"
    )}>
      {difficulty}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "text-[10px] px-2 py-0.5 rounded flex items-center gap-1",
      status === "completed" ? "bg-emerald-500/20 text-emerald-300" :
      status === "running" ? "bg-blue-500/20 text-blue-300" :
      status === "failed" ? "bg-red-500/20 text-red-300" :
      "bg-zinc-500/20 text-zinc-300"
    )}>
      {status === "running" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
      {status === "completed" ? "完成" : status === "running" ? "运行中" : status === "failed" ? "失败" : "等待"}
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
