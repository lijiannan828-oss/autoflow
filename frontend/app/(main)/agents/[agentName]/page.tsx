"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  ArrowLeft, Bot, ChevronRight, Clock, DollarSign,
  Star, TrendingUp, TrendingDown, Brain, Lightbulb, Settings, BarChart3,
  CheckCircle2, XCircle, RotateCcw, Zap, Database, GitBranch,
  Activity, Eye, Target, Layers, BookOpen, Cpu, AlertTriangle
} from "lucide-react"

interface AgentProfile {
  agent_name: string
  display_name: string
  description: string
  role: string
  category: string
  responsible_nodes: string[]
  primary_model: string
  status: string
  health: string
  current_task: string | null
  stats: {
    total_tasks: number
    completed_tasks: number
    failed_tasks: number
    avg_quality_score: number
    total_cost_cny: number
    avg_duration_sec: number
    success_rate: number
    return_rate: number
  }
  capabilities: {
    quality_trend: { date: string; score: number }[]
    speed_trend: { date: string; avg_sec: number }[]
    cost_trend: { date: string; cost_cny: number }[]
  }
  current_strategy: {
    active_prompt_version: string
    genre_adapters: { genre: string; adapter_id: string; status: string }[]
    rag_case_count: number
    rag_positive_count: number
    rag_negative_count: number
    rag_hit_rate: number
    rag_weekly_new: number
    ab_tests: { name: string; progress: string; status: string }[]
  }
  memories: { project: string; items: string[] }[]
  model_routing: { stage: string; primary: string; fallback: string | null }[]
  recent_decisions: { node_run_id: string; episode_title: string; node_id: string; decision_summary: string; quality_score: number; timestamp: string }[]
  today_summary: string
}

interface Decision {
  trace_group_id: string
  episode_title: string
  node_id: string
  timestamp: string
  decision_type: string
  steps: { step: string; content: string; tokens_used: number; duration_ms: number }[]
  outcome: { quality_score?: number; status: string }
}

const HEALTH_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  healthy: { label: "正常运行", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  busy: { label: "工作中", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  degraded: { label: "性能降级", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  error: { label: "异常", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
}

const TABS = [
  { icon: BarChart3, label: "工作日报", id: "report" },
  { icon: Brain, label: "决策日志", id: "decisions" },
  { icon: TrendingUp, label: "成长曲线", id: "growth" },
  { icon: Lightbulb, label: "当前策略", id: "strategy" },
  { icon: Settings, label: "配置", id: "config" },
]

export default function AgentProfilePage({ params }: { params: Promise<{ agentName: string }> }) {
  const { agentName } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("report")

  useEffect(() => {
    Promise.all([
      fetch(`/api/agents/${agentName}/profile`).then(r => r.json()),
      fetch(`/api/agents/${agentName}/decisions`).then(r => r.json()),
    ])
      .then(([profileData, decisionsData]) => {
        setProfile(profileData)
        setDecisions(decisionsData.decisions || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [agentName])

  if (loading || !profile) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-primary/20 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">正在加载 Agent 数据...</p>
        </div>
      </div>
    )
  }

  const health = HEALTH_CONFIG[profile.health] || HEALTH_CONFIG.healthy

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border/50 bg-gradient-to-b from-card/50 to-background">
        <div className="px-6 py-5">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <button 
              onClick={() => router.push("/agents")} 
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Agent 中心
            </button>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-foreground font-medium">{profile.display_name}</span>
          </nav>

          {/* Title row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className={cn("p-3 rounded-xl", health.bg, health.border, "border")}>
                <Bot className={cn("w-6 h-6", health.color)} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-semibold text-foreground">{profile.display_name}</h1>
                  <span className={cn(
                    "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium",
                    health.bg, health.color, health.border
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", profile.status === "working" ? "animate-pulse" : "", health.color.replace("text-", "bg-"))} />
                    {health.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2 max-w-2xl">{profile.description}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {profile.responsible_nodes.length > 0 
                      ? `${profile.responsible_nodes.length} 个节点`
                      : "横切全节点"
                    }
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    {profile.primary_model}
                  </span>
                  {profile.current_task && (
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <Activity className="w-3.5 h-3.5 animate-pulse" />
                      正在执行: {profile.current_task}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border/50 -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative",
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-auto p-6">
        {activeTab === "report" && <DailyReportTab profile={profile} />}
        {activeTab === "decisions" && <DecisionLogTab decisions={decisions} />}
        {activeTab === "growth" && <GrowthTab profile={profile} />}
        {activeTab === "strategy" && <StrategyTab profile={profile} />}
        {activeTab === "config" && <ConfigTab profile={profile} />}
      </main>
    </div>
  )
}

/* ── Tab 1: 工作日报 ── */
function DailyReportTab({ profile }: { profile: AgentProfile }) {
  const s = profile.stats
  const qualityColor = s.avg_quality_score >= 8.5 ? "text-emerald-400" : s.avg_quality_score >= 7.5 ? "text-foreground" : "text-amber-400"

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          icon={BarChart3} 
          label="总任务" 
          value={s.total_tasks} 
          subLabel="今日处理"
        />
        <MetricCard 
          icon={CheckCircle2} 
          label="已完成" 
          value={s.completed_tasks} 
          valueColor="text-emerald-400"
          subLabel={`成功率 ${(s.success_rate * 100).toFixed(1)}%`}
        />
        <MetricCard 
          icon={XCircle} 
          label="失败" 
          value={s.failed_tasks} 
          valueColor={s.failed_tasks > 0 ? "text-red-400" : undefined}
          subLabel="需要重试"
        />
        <MetricCard 
          icon={Clock} 
          label="平均耗时" 
          value={`${s.avg_duration_sec}s`} 
          subLabel="每任务"
        />
        <MetricCard 
          icon={DollarSign} 
          label="总成本" 
          value={`¥${s.total_cost_cny}`} 
          subLabel="今日消耗"
        />
        <MetricCard 
          icon={Star} 
          label="平均质量" 
          value={s.avg_quality_score?.toFixed(1) || "—"} 
          valueColor={qualityColor}
          subLabel={s.avg_quality_score >= 8.5 ? "优秀" : s.avg_quality_score >= 7.5 ? "良好" : "待提升"}
        />
        <MetricCard 
          icon={RotateCcw} 
          label="打回率" 
          value={`${(s.return_rate * 100).toFixed(1)}%`} 
          valueColor={s.return_rate > 0.1 ? "text-amber-400" : undefined}
          subLabel="下游返工"
        />
        <MetricCard 
          icon={Target} 
          label="完成率" 
          value={`${((s.completed_tasks / (s.total_tasks || 1)) * 100).toFixed(0)}%`} 
          valueColor="text-emerald-400"
          subLabel="任务完成"
        />
      </div>

      {/* Quality Distribution */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">质量分布</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            综合均值: <span className={cn("font-medium", qualityColor)}>{s.avg_quality_score?.toFixed(1)}</span>
          </span>
        </div>
        <div className="space-y-3">
          {[
            { range: "9.0+", pct: 45, color: "bg-emerald-500", label: "优秀" },
            { range: "8.0-9.0", pct: 35, color: "bg-blue-500", label: "良好" },
            { range: "7.0-8.0", pct: 15, color: "bg-amber-500", label: "合格" },
            { range: "<7.0", pct: 5, color: "bg-red-500", label: "待改进" },
          ].map(item => (
            <div key={item.range} className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-16">{item.range}</span>
              <div className="flex-1 h-2.5 bg-secondary/50 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-500", item.color)} 
                  style={{ width: `${item.pct}%` }} 
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">{item.pct}%</span>
              <span className="text-[10px] text-muted-foreground w-12">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Node Distribution */}
      {profile.responsible_nodes.length > 0 && (
        <div className="bg-card/50 border border-border/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">节点分布</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {profile.responsible_nodes.map(nodeId => (
              <div key={nodeId} className="flex items-center justify-between bg-secondary/30 rounded-lg px-4 py-3">
                <span className="font-mono text-sm text-primary">{nodeId}</span>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{Math.floor(Math.random() * 50 + 10)} 任务</span>
                  <span className="text-foreground">{(Math.random() * 15 + 3).toFixed(1)}s</span>
                  <span>¥{(Math.random() * 10 + 0.5).toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      {profile.today_summary && (
        <div className="bg-gradient-to-br from-primary/5 to-card/50 border border-primary/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground">今日思考总结</h3>
            <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
              Evolution Engine 自动生成
            </span>
          </div>
          <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {profile.today_summary}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab 2: 决策日志 ── */
function DecisionLogTab({ decisions }: { decisions: Decision[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const STEP_CONFIG: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
    observe: { bg: "bg-blue-500/10", text: "text-blue-400", icon: Eye },
    retrieve: { bg: "bg-purple-500/10", text: "text-purple-400", icon: Database },
    reason: { bg: "bg-amber-500/10", text: "text-amber-400", icon: Brain },
    act: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: Zap },
    reflect: { bg: "bg-cyan-500/10", text: "text-cyan-400", icon: BookOpen },
  }

  const getScoreBorder = (score?: number) => {
    if (!score) return "border-border/50"
    if (score >= 9) return "border-emerald-500/30"
    if (score >= 8) return "border-blue-500/30"
    if (score >= 7) return "border-amber-500/30"
    return "border-red-500/30"
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          展示集级策划和批后复盘记录（非每镜头记录）
        </p>
        <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
          {decisions.length} 条记录
        </span>
      </div>

      {decisions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-card/30 rounded-xl border border-border/50">
          <Brain className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">暂无决策日志</p>
        </div>
      )}

      {decisions.map(d => {
        const expanded = expandedId === d.trace_group_id
        const time = new Date(d.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
        const date = new Date(d.timestamp).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })

        return (
          <div 
            key={d.trace_group_id} 
            className={cn(
              "bg-card/50 rounded-xl border transition-all",
              getScoreBorder(d.outcome.quality_score),
              expanded && "ring-1 ring-primary/20"
            )}
          >
            <button
              className="w-full px-5 py-4 flex items-center justify-between text-left"
              onClick={() => setExpandedId(expanded ? null : d.trace_group_id)}
            >
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{date}</p>
                  <p className="text-sm font-medium text-foreground">{time}</p>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs bg-secondary/50 px-2 py-0.5 rounded text-primary">{d.node_id}</span>
                    <span className="text-sm text-foreground">{d.episode_title}</span>
                  </div>
                  {d.outcome.quality_score != null && (
                    <span className={cn(
                      "text-xs font-medium",
                      d.outcome.quality_score >= 9 ? "text-emerald-400" : 
                      d.outcome.quality_score >= 8 ? "text-blue-400" : 
                      d.outcome.quality_score >= 7 ? "text-amber-400" : "text-red-400"
                    )}>
                      质量分: {d.outcome.quality_score}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                expanded && "rotate-90"
              )} />
            </button>

            {expanded && (
              <div className="px-5 pb-5 space-y-3 border-t border-border/30 pt-4">
                {d.steps.map((step, i) => {
                  const config = STEP_CONFIG[step.step] || STEP_CONFIG.act
                  const StepIcon = config.icon
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn("p-2 rounded-lg", config.bg)}>
                          <StepIcon className={cn("w-4 h-4", config.text)} />
                        </div>
                        {i < d.steps.length - 1 && <div className="w-px flex-1 bg-border/30 my-2" />}
                      </div>
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("text-xs font-medium", config.text)}>{step.step.toUpperCase()}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {step.tokens_used > 0 && `${step.tokens_used} tokens · `}
                            {step.duration_ms >= 1000 ? `${(step.duration_ms / 1000).toFixed(1)}s` : `${step.duration_ms}ms`}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{step.content}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Tab 3: 成长曲线 ── */
function GrowthTab({ profile }: { profile: AgentProfile }) {
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const trend = profile.capabilities.quality_trend.slice(-range)
  const costTrend = profile.capabilities.cost_trend.slice(-range)

  const maxScore = Math.max(...trend.map(t => t.score))
  const minScore = Math.min(...trend.map(t => t.score))
  const scoreRange = maxScore - minScore || 1

  const maxCost = Math.max(...costTrend.map(t => t.cost_cny))

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        {([7, 30, 90] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              range === r 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            {r} 天
          </button>
        ))}
      </div>

      {/* Quality Trend */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-medium text-foreground">质量分趋势</h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>最高: <span className="text-emerald-400 font-medium">{maxScore.toFixed(1)}</span></span>
            <span>最低: <span className="text-amber-400 font-medium">{minScore.toFixed(1)}</span></span>
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-40">
          {trend.map((t, i) => {
            const height = ((t.score - minScore) / scoreRange) * 100
            const isHigh = t.score >= 8.5
            const isLow = t.score < 7.5
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className={cn(
                    "w-full rounded-t transition-all duration-200 group-hover:opacity-80",
                    isHigh ? "bg-emerald-500" : isLow ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-card border border-border rounded-lg px-3 py-2 shadow-lg z-10 whitespace-nowrap">
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                  <p className={cn("text-sm font-semibold", isHigh ? "text-emerald-400" : isLow ? "text-amber-400" : "text-foreground")}>
                    {t.score}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
          <span>{trend[0]?.date}</span>
          <span>{trend[trend.length - 1]?.date}</span>
        </div>
      </div>

      {/* Cost Trend */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-medium text-foreground">日成本趋势</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            峰值: <span className="text-amber-400 font-medium">¥{maxCost.toFixed(1)}</span>
          </span>
        </div>
        <div className="flex items-end gap-0.5 h-28">
          {costTrend.map((t, i) => {
            const height = (t.cost_cny / (maxCost || 1)) * 100
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-amber-500/60 rounded-t transition-all duration-200 group-hover:bg-amber-500"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-card border border-border rounded-lg px-3 py-2 shadow-lg z-10 whitespace-nowrap">
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                  <p className="text-sm font-semibold text-amber-400">¥{t.cost_cny}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Evolution Events */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-medium text-foreground">关键进化事件</h3>
        </div>
        <div className="space-y-3">
          {[
            { day: 7, event: "Prompt v2 上线", impact: "古装场景评分 +0.3", type: "prompt" },
            { day: 14, event: "RAG 案例突破 500 条", impact: "命中率 72% → 78%", type: "rag" },
            { day: 21, event: "LoRA 首次微调生效", impact: "全场景评分 +0.2", type: "lora" },
            { day: 25, event: "modern_urban 适配器 v1 上线", impact: "现代场景 +0.4", type: "adapter" },
          ].map(e => (
            <div key={e.day} className="flex items-center gap-4 py-2 border-b border-border/30 last:border-0">
              <span className="text-xs text-muted-foreground w-14">Day {e.day}</span>
              <div className="flex-1">
                <p className="text-sm text-foreground">{e.event}</p>
              </div>
              <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                {e.impact}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Tab 4: 当前策略 ── */
function StrategyTab({ profile }: { profile: AgentProfile }) {
  const cs = profile.current_strategy

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Active Prompt */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">活跃 Prompt 模板</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-secondary/30 rounded-lg px-4 py-3">
            <span className="text-xs text-muted-foreground">母版:</span>
            <span className="font-mono text-sm text-primary">{cs.active_prompt_version}</span>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-3">题材适配器:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cs.genre_adapters.map(ga => (
                <div key={ga.adapter_id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-4 py-3">
                  <div>
                    <span className="font-mono text-sm text-foreground">{ga.adapter_id}</span>
                    <span className="text-xs text-muted-foreground ml-2">({ga.genre})</span>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    ga.status === "stable" 
                      ? "bg-emerald-500/10 text-emerald-400" 
                      : "bg-amber-500/10 text-amber-400"
                  )}>
                    {ga.status === "stable" ? "稳定运行" : "待优化"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {cs.ab_tests.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">A/B 测试中:</p>
              <div className="space-y-2">
                {cs.ab_tests.map(t => (
                  <div key={t.name} className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                    <span className="font-mono text-sm text-foreground">{t.name}</span>
                    <span className="text-xs text-blue-400">进行中 ({t.progress})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RAG */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-medium text-foreground">RAG 经验库</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            命中率: <span className="text-purple-400 font-medium">{(cs.rag_hit_rate * 100).toFixed(0)}%</span>
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="text-xl font-semibold text-foreground">{cs.rag_case_count.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">总案例</p>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-3 text-center">
            <p className="text-xl font-semibold text-emerald-400">{cs.rag_positive_count}</p>
            <p className="text-xs text-muted-foreground">正向案例</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 text-center">
            <p className="text-xl font-semibold text-red-400">{cs.rag_negative_count}</p>
            <p className="text-xs text-muted-foreground">负向案例</p>
          </div>
          <div className="bg-cyan-500/10 rounded-lg p-3 text-center">
            <p className="text-xl font-semibold text-cyan-400">+{cs.rag_weekly_new}</p>
            <p className="text-xs text-muted-foreground">本周新增</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { genre: "古装", count: 820 },
            { genre: "言情", count: 450 },
            { genre: "现代", count: 120, warning: true },
            { genre: "悬疑", count: 80, warning: true },
          ].map(item => (
            <div key={item.genre} className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-12">{item.genre}</span>
              <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${(item.count / 1000) * 100}%` }} />
              </div>
              <span className={cn("text-xs w-12 text-right", item.warning ? "text-amber-400" : "text-muted-foreground")}>
                {item.count}
              </span>
              {item.warning && <AlertTriangle className="w-3 h-3 text-amber-400" />}
            </div>
          ))}
        </div>
      </div>

      {/* Memories */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-medium text-foreground">Agent 记忆 (项目级)</h3>
        </div>
        {profile.memories.map(mem => (
          <div key={mem.project} className="mb-4 last:mb-0">
            <p className="text-sm font-medium text-foreground mb-2">{mem.project}</p>
            <div className="space-y-1 pl-4 border-l-2 border-cyan-500/30">
              {mem.items.map((item, i) => (
                <p key={i} className="text-xs text-muted-foreground italic">&ldquo;{item}&rdquo;</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Model Routing */}
      {profile.model_routing.length > 0 && (
        <div className="bg-card/50 border border-border/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-medium text-foreground">模型路由</h3>
          </div>
          <div className="space-y-2">
            {profile.model_routing.map(mr => (
              <div key={mr.stage} className="flex items-center gap-4 bg-secondary/30 rounded-lg px-4 py-3">
                <span className="text-xs text-muted-foreground w-24">{mr.stage}</span>
                <span className="text-sm text-foreground font-medium">{mr.primary}</span>
                {mr.fallback && (
                  <span className="text-xs text-muted-foreground">
                    <span className="text-foreground/60">Fallback:</span> {mr.fallback}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Tab 5: 配置 ── */
function ConfigTab({ profile }: { profile: AgentProfile }) {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Node Binding */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">节点绑定</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.responsible_nodes.length > 0 ? (
            profile.responsible_nodes.map(n => (
              <span key={n} className="font-mono text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20">
                {n}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">横切全节点（无固定绑定）</span>
          )}
        </div>
      </div>

      {/* Meta Info */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Agent 元信息</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "名称", value: profile.agent_name, mono: true },
            { label: "显示名", value: profile.display_name },
            { label: "分类", value: profile.category },
            { label: "角色", value: profile.role },
            { label: "主模型", value: profile.primary_model },
            { label: "成功率", value: `${(profile.stats.success_rate * 100).toFixed(1)}%` },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-4 bg-secondary/30 rounded-lg px-4 py-3">
              <span className="text-xs text-muted-foreground w-16">{item.label}</span>
              <span className={cn("text-sm text-foreground", item.mono && "font-mono")}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic text-center py-4">
        更多配置参数（QC 阈值、重试策略、降级规则等）将在后端 API 完善后展示
      </p>
    </div>
  )
}

/* ── Shared Components ── */
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subLabel,
  valueColor 
}: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  subLabel?: string
  valueColor?: string
}) {
  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-2xl font-semibold", valueColor || "text-foreground")}>{value}</p>
      {subLabel && <p className="text-xs text-muted-foreground mt-1">{subLabel}</p>}
    </div>
  )
}
