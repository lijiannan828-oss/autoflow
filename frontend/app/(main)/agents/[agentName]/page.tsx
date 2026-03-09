"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  ArrowLeft, Bot, ChevronRight, Clock, DollarSign,
  Star, TrendingUp, Brain, Lightbulb, Settings, BarChart3,
  CheckCircle2, XCircle, RotateCcw
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

const HEALTH_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  healthy: { label: "正常", color: "text-emerald-400", dot: "bg-emerald-500" },
  busy: { label: "繁忙", color: "text-amber-400", dot: "bg-amber-500" },
  degraded: { label: "降级", color: "text-orange-400", dot: "bg-orange-500" },
  error: { label: "异常", color: "text-red-400", dot: "bg-red-500" },
}

const TABS = [
  { icon: BarChart3, label: "工作日报" },
  { icon: Brain, label: "决策日志" },
  { icon: TrendingUp, label: "成长曲线" },
  { icon: Lightbulb, label: "当前策略" },
  { icon: Settings, label: "配置" },
]

export default function AgentProfilePage({ params }: { params: Promise<{ agentName: string }> }) {
  const { agentName } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)

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
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const health = HEALTH_CONFIG[profile.health] || HEALTH_CONFIG.healthy

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-5 py-3">
        {/* Breadcrumb */}
        <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <button onClick={() => router.push("/agents")} className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" />
            Agent 中心
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground">{profile.display_name}</span>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-semibold text-foreground">{profile.display_name}</h1>
              <span className={cn("flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border", health.color, "border-current/20")}>
                <span className={cn("w-2 h-2 rounded-full", health.dot)} />
                {health.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-1">{profile.description}</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>负责节点: {profile.responsible_nodes.length > 0 ? profile.responsible_nodes.join(" ") : "横切全节点"}</span>
              <span>·</span>
              <span>核心模型: {profile.primary_model}</span>
              {profile.current_task && (
                <>
                  <span>·</span>
                  <span className="text-blue-400">当前任务: {profile.current_task}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {TABS.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(i)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
                i === activeTab ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-5">
        {activeTab === 0 && <DailyReportTab profile={profile} />}
        {activeTab === 1 && <DecisionLogTab decisions={decisions} />}
        {activeTab === 2 && <GrowthTab profile={profile} />}
        {activeTab === 3 && <StrategyTab profile={profile} />}
        {activeTab === 4 && <ConfigTab profile={profile} />}
      </div>
    </div>
  )
}

/* ── Tab 1: 工作日报 ── */
function DailyReportTab({ profile }: { profile: AgentProfile }) {
  const s = profile.stats
  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="总任务" value={s.total_tasks} icon={BarChart3} />
        <StatBox label="已完成" value={s.completed_tasks} icon={CheckCircle2} color="text-emerald-400" />
        <StatBox label="失败" value={s.failed_tasks} icon={XCircle} color={s.failed_tasks > 0 ? "text-red-400" : undefined} />
        <StatBox label="平均耗时" value={`${s.avg_duration_sec}s`} icon={Clock} />
        <StatBox label="总成本" value={`¥${s.total_cost_cny}`} icon={DollarSign} />
        <StatBox label="成功率" value={`${(s.success_rate * 100).toFixed(1)}%`} icon={CheckCircle2} />
        <StatBox label="平均质量" value={s.avg_quality_score?.toFixed(1) || "N/A"} icon={Star} color={s.avg_quality_score < 8 ? "text-amber-400" : "text-emerald-400"} />
        <StatBox label="下游打回率" value={`${(s.return_rate * 100).toFixed(1)}%`} icon={RotateCcw} color={s.return_rate > 0.1 ? "text-amber-400" : undefined} />
      </div>

      {/* Quality distribution */}
      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">质量分布</p>
        <div className="space-y-2">
          {[
            { range: "9.0+", pct: 45, color: "bg-emerald-500" },
            { range: "8.0-9.0", pct: 35, color: "bg-blue-500" },
            { range: "7.0-8.0", pct: 15, color: "bg-amber-500" },
            { range: "<7.0", pct: 5, color: "bg-red-500" },
          ].map(item => (
            <div key={item.range} className="flex items-center gap-3 text-xs">
              <span className="w-16 text-muted-foreground">{item.range}</span>
              <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.pct}%` }} />
              </div>
              <span className="w-8 text-right text-muted-foreground">{item.pct}%</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2">综合均值: <span className="text-foreground font-medium">{s.avg_quality_score?.toFixed(1)}</span></p>
        </div>
      </div>

      {/* Node distribution */}
      {profile.responsible_nodes.length > 0 && (
        <div className="bg-secondary/20 rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">按节点分布</p>
          <div className="space-y-1.5">
            {profile.responsible_nodes.map(nodeId => (
              <div key={nodeId} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
                <span className="font-mono text-muted-foreground w-10">{nodeId}</span>
                <span className="text-muted-foreground flex-1 mx-3">{Math.floor(Math.random() * 50 + 10)} 任务</span>
                <span className="text-muted-foreground">avg {(Math.random() * 15 + 3).toFixed(1)}s</span>
                <span className="text-muted-foreground ml-3">¥{(Math.random() * 10 + 0.5).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI summary */}
      {profile.today_summary && (
        <div className="bg-secondary/20 rounded-lg p-4 border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">今日思考总结 (Evolution Engine 自动生成)</p>
          </div>
          <div className="text-xs text-foreground/80 space-y-2 whitespace-pre-line leading-relaxed">
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

  const STEP_COLORS: Record<string, string> = {
    observe: "bg-blue-500/20 text-blue-300",
    retrieve: "bg-purple-500/20 text-purple-300",
    reason: "bg-amber-500/20 text-amber-300",
    act: "bg-emerald-500/20 text-emerald-300",
    reflect: "bg-cyan-500/20 text-cyan-300",
  }

  const scoreColor = (score?: number) => {
    if (!score) return "border-border/30"
    if (score >= 9) return "border-emerald-500/50"
    if (score >= 8) return "border-border/30"
    if (score >= 7) return "border-amber-500/50"
    return "border-red-500/50"
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">展示集级策划和批后复盘记录（非每镜头记录）</p>

      {decisions.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-8 text-center">暂无决策日志</p>
      )}

      {decisions.map(d => {
        const expanded = expandedId === d.trace_group_id
        const time = new Date(d.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
        return (
          <div key={d.trace_group_id} className={cn("bg-secondary/20 rounded-lg border", scoreColor(d.outcome.quality_score))}>
            <button
              className="w-full px-4 py-3 flex items-center justify-between text-left"
              onClick={() => setExpandedId(expanded ? null : d.trace_group_id)}
            >
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{time}</span>
                <span className="font-mono text-muted-foreground">{d.node_id}</span>
                <span className="text-foreground">{d.episode_title}</span>
                {d.outcome.quality_score != null && (
                  <span className={cn("text-xs font-medium", d.outcome.quality_score >= 9 ? "text-emerald-400" : d.outcome.quality_score >= 8 ? "text-foreground" : "text-amber-400")}>
                    均分 {d.outcome.quality_score}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{expanded ? "收起 ▲" : "展开 ▼"}</span>
            </button>

            {expanded && (
              <div className="px-4 pb-4 space-y-2">
                {d.steps.map((step, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", STEP_COLORS[step.step] || "bg-secondary text-foreground")}>
                        {step.step}
                      </span>
                      {i < d.steps.length - 1 && <div className="w-px flex-1 bg-border/30 my-1" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-foreground/80 leading-relaxed">{step.content}</p>
                      <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                        {step.tokens_used > 0 && <span>{step.tokens_used} tokens</span>}
                        <span>{step.duration_ms >= 1000 ? `${(step.duration_ms / 1000).toFixed(1)}s` : `${step.duration_ms}ms`}</span>
                      </div>
                    </div>
                  </div>
                ))}
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

  const maxScore = Math.max(...trend.map(t => t.score))
  const minScore = Math.min(...trend.map(t => t.score))
  const scoreRange = maxScore - minScore || 1

  return (
    <div className="space-y-5">
      <div className="flex gap-1">
        {([7, 30, 90] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn("text-xs px-3 py-1 rounded-md", range === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {r}天
          </button>
        ))}
      </div>

      {/* Quality trend bar chart */}
      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">平均质量分趋势</p>
        <div className="flex items-end gap-px h-32">
          {trend.map((t, i) => {
            const height = ((t.score - minScore) / scoreRange) * 100
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-primary/60 rounded-t-sm min-h-[2px] transition-colors group-hover:bg-primary"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                  <p>{t.date}</p>
                  <p className="font-medium">{t.score}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>{trend[0]?.date}</span>
          <span>{trend[trend.length - 1]?.date}</span>
        </div>
      </div>

      {/* Cost trend */}
      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">日成本趋势</p>
        <div className="flex items-end gap-px h-24">
          {profile.capabilities.cost_trend.slice(-range).map((t, i) => {
            const maxCost = Math.max(...profile.capabilities.cost_trend.slice(-range).map(x => x.cost_cny))
            const height = (t.cost_cny / (maxCost || 1)) * 100
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-amber-500/40 rounded-t-sm min-h-[2px] transition-colors group-hover:bg-amber-500/70"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-card border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10">
                  <p>{t.date}</p>
                  <p className="font-medium">¥{t.cost_cny}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Key evolution events */}
      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">关键进化事件</p>
        <div className="space-y-2">
          {[
            { day: 7, event: "Prompt v2上线", impact: "古装场景评分+0.3" },
            { day: 14, event: "RAG案例突破500条", impact: "RAG命中率72%→78%" },
            { day: 21, event: "LoRA首次微调生效", impact: "全场景评分+0.2" },
            { day: 25, event: "modern_urban适配器v1上线", impact: "现代场景+0.4" },
          ].map(e => (
            <div key={e.day} className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground w-14">Day {e.day}</span>
              <span className="text-foreground">{e.event}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-emerald-400">{e.impact}</span>
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
    <div className="space-y-5">
      {/* Active prompt */}
      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">活跃 Prompt 模板</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">母版:</span>
            <span className="font-mono text-foreground">{cs.active_prompt_version}</span>
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-3 mb-1.5">题材适配器:</p>
          {cs.genre_adapters.map(ga => (
            <div key={ga.adapter_id} className="flex items-center gap-3 text-xs">
              <span className="font-mono text-foreground w-40">{ga.adapter_id}</span>
              <span className="text-muted-foreground">({ga.genre})</span>
              <span className={ga.status === "stable" ? "text-emerald-400" : "text-amber-400"}>
                {ga.status === "stable" ? "运行稳定" : "构图偏低"}
              </span>
            </div>
          ))}
          {cs.ab_tests.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground mt-3 mb-1.5">A/B 测试中:</p>
              {cs.ab_tests.map(t => (
                <div key={t.name} className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-foreground">{t.name}</span>
                  <span className="text-muted-foreground">进行中 ({t.progress})</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* RAG */}
      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">RAG 经验库</p>
        <div className="flex gap-6 text-xs mb-3">
          <span className="text-muted-foreground">总案例: <span className="text-foreground font-medium">{cs.rag_case_count.toLocaleString()}</span></span>
          <span className="text-emerald-400">正向: {cs.rag_positive_count} ({((cs.rag_positive_count / cs.rag_case_count) * 100).toFixed(0)}%)</span>
          <span className="text-red-400">负向: {cs.rag_negative_count} ({((cs.rag_negative_count / cs.rag_case_count) * 100).toFixed(0)}%)</span>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mb-3">
          <span>本周新增: +{cs.rag_weekly_new}</span>
          <span>命中率: {(cs.rag_hit_rate * 100).toFixed(0)}%</span>
        </div>
        <div className="space-y-1.5">
          {[
            { genre: "古装", count: 820, warning: false },
            { genre: "言情", count: 450, warning: false },
            { genre: "现代", count: 120, warning: true },
            { genre: "悬疑", count: 80, warning: true },
          ].map(item => (
            <div key={item.genre} className="flex items-center gap-3 text-xs">
              <span className="w-10 text-muted-foreground">{item.genre}</span>
              <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(item.count / 1000) * 100}%` }} />
              </div>
              <span className={cn("w-12 text-right", item.warning ? "text-amber-400" : "text-muted-foreground")}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Memories */}
      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Agent 记忆 (项目级)</p>
        {profile.memories.map(mem => (
          <div key={mem.project} className="mb-3 last:mb-0">
            <p className="text-xs font-medium text-foreground mb-1">{mem.project}</p>
            <div className="space-y-0.5 pl-4">
              {mem.items.map((item, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">&ldquo;{item}&rdquo;</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Model routing */}
      {profile.model_routing.length > 0 && (
        <div className="bg-secondary/20 rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">模型路由</p>
          <div className="space-y-1.5">
            {profile.model_routing.map(mr => (
              <div key={mr.stage} className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground w-24">{mr.stage}</span>
                <span className="text-foreground">{mr.primary}</span>
                {mr.fallback && <span className="text-muted-foreground">{mr.fallback}(备)</span>}
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
    <div className="space-y-5">
      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">节点绑定</p>
        <div className="flex flex-wrap gap-2">
          {profile.responsible_nodes.map(n => (
            <span key={n} className="text-xs font-mono bg-secondary/50 px-2 py-1 rounded">{n}</span>
          ))}
          {profile.responsible_nodes.length === 0 && (
            <span className="text-xs text-muted-foreground">横切全节点（无固定绑定）</span>
          )}
        </div>
      </div>

      <div className="bg-secondary/20 rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Agent 元信息</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex gap-2"><span className="text-muted-foreground w-24">名称</span><span className="text-foreground font-mono">{profile.agent_name}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-24">显示名</span><span className="text-foreground">{profile.display_name}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-24">分类</span><span className="text-foreground">{profile.category}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-24">角色</span><span className="text-foreground">{profile.role}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-24">主模型</span><span className="text-foreground">{profile.primary_model}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground w-24">成功率</span><span className="text-foreground">{(profile.stats.success_rate * 100).toFixed(1)}%</span></div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">更多配置参数（QC阈值、重试策略等）将在后端 API 接通后展示</p>
    </div>
  )
}

/* ── Shared ── */
function StatBox({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color?: string }) {
  return (
    <div className="bg-secondary/20 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-sm font-semibold", color || "text-foreground")}>{value}</p>
    </div>
  )
}
