"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Bot, Activity, DollarSign, Star, Shield, Zap, ArrowRight,
  TrendingUp, Clock, CheckCircle2, AlertTriangle, Cpu,
  Brain, Eye, Mic, Film, Sparkles, ClipboardCheck, Network
} from "lucide-react"

interface AgentCard {
  agent_name: string
  display_name: string
  role: string
  category: "production" | "supervisor" | "evolution"
  responsible_nodes: string[]
  status: "idle" | "working"
  health: "healthy" | "busy" | "degraded" | "error"
  stats: {
    total_tasks: number
    success_rate: number
    avg_quality_score: number | null
    total_cost_cny: number
    avg_duration_sec: number
  }
  supervisor_stats?: { checks_today: number; blocks_today: number }
  evolution_stats?: { current_mode: string; weekly_evolutions: number; rag_new_cases_today: number }
  last_active_at: string
}

const HEALTH_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  healthy: { label: "正常运行", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  busy: { label: "工作中", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  degraded: { label: "性能降级", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  error: { label: "异常", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
}

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  script_analyst: ClipboardCheck,
  shot_designer: Film,
  visual_director: Eye,
  audio_director: Mic,
  compositor: Sparkles,
  quality_inspector: CheckCircle2,
  review_dispatcher: Network,
  supervisor: Shield,
  evolution_engine: Brain,
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentCard[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/agents")
      .then(r => r.json())
      .then(data => setAgents(data.agents || data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
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

  const production = agents.filter(a => a.category === "production")
  const supervisorAgent = agents.find(a => a.category === "supervisor")
  const evolutionAgent = agents.find(a => a.category === "evolution")

  const totalTasks = agents.reduce((s, a) => s + a.stats.total_tasks, 0)
  const totalCost = agents.reduce((s, a) => s + a.stats.total_cost_cny, 0)
  const qualityAgents = agents.filter(a => a.stats.avg_quality_score != null)
  const avgQuality = qualityAgents.length > 0
    ? (qualityAgents.reduce((s, a) => s + (a.stats.avg_quality_score || 0), 0) / qualityAgents.length)
    : null
  const healthyCount = agents.filter(a => a.health === "healthy" || a.health === "busy").length
  const workingCount = agents.filter(a => a.status === "working").length

  return (
    <div className="h-full overflow-auto">
      {/* Hero Header */}
      <div className="relative border-b border-border/50 bg-gradient-to-b from-card/50 to-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="relative px-6 py-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Agent 中心</h1>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                监控和管理 {agents.length} 个 AI Agent 的运行状态。基于三层决策模型（策划-执行-复盘），实现高效的视频生产自动化。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                healthyCount === agents.length 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              )}>
                <span className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  healthyCount === agents.length ? "bg-emerald-500" : "bg-amber-500"
                )} />
                {healthyCount === agents.length ? "全部正常" : `${healthyCount}/${agents.length} 正常`}
              </div>
            </div>
          </div>

          {/* Global Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Activity}
              label="今日总任务"
              value={totalTasks.toLocaleString()}
              trend="+12%"
              trendUp
            />
            <MetricCard
              icon={DollarSign}
              label="今日成本"
              value={`¥${totalCost.toFixed(1)}`}
              subValue="预算 ¥30/min"
            />
            <MetricCard
              icon={Star}
              label="平均质量分"
              value={avgQuality ? avgQuality.toFixed(1) : "—"}
              trend={avgQuality && avgQuality >= 8.5 ? "优秀" : avgQuality && avgQuality >= 7.5 ? "良好" : "待提升"}
              trendUp={avgQuality ? avgQuality >= 8 : undefined}
            />
            <MetricCard
              icon={Cpu}
              label="活跃 Agent"
              value={`${workingCount}/${agents.length}`}
              subValue="正在工作"
            />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Three-Layer Model Explanation */}
        <div className="bg-card/30 border border-border/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">三层决策模型</span>
            <span className="text-xs text-muted-foreground ml-2">· 每集 LLM 调用从 60-120 次降至 3-5 次</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DecisionLayerCard
              layer="第一层"
              title="集级策划"
              description="产出全集作战计划，一次 LLM 调用覆盖 30-60 镜头"
              nodes={["N01", "N02", "N06", "N07b"]}
              color="blue"
            />
            <DecisionLayerCard
              layer="第二层"
              title="镜头级执行"
              description="零 LLM 调用，规则+记忆快查，confidence 低时降级"
              nodes={["N04", "N05", "N07", "N09", "..."]}
              color="emerald"
            />
            <DecisionLayerCard
              layer="第三层"
              title="批后复盘"
              description="多模态分析全集产物，沉淀经验到记忆库"
              nodes={["N03", "N11", "N12", "N15", "N16"]}
              color="purple"
            />
          </div>
        </div>

        {/* Production Agents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-foreground">生产线 Agent</h2>
              <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                {production.length} 个
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              负责剧本解析、分镜设计、视觉/音频生成、合成质检
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {production.map(agent => (
              <ProductionAgentCard
                key={agent.agent_name}
                agent={agent}
                onClick={() => router.push(`/agents/${agent.agent_name}`)}
              />
            ))}
          </div>
        </section>

        {/* Special Agents Row */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supervisor */}
          {supervisorAgent && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-medium text-foreground">横切守卫</h2>
                <span className="text-xs text-muted-foreground">· 成本+合规检查</span>
              </div>
              <SupervisorCard
                agent={supervisorAgent}
                onClick={() => router.push(`/agents/${supervisorAgent.agent_name}`)}
              />
            </div>
          )}

          {/* Evolution Engine */}
          {evolutionAgent && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-medium text-foreground">进化引擎</h2>
                <span className="text-xs text-muted-foreground">· 自我学习 + RAG 更新</span>
              </div>
              <EvolutionCard
                agent={evolutionAgent}
                onClick={() => router.push(`/agents/${evolutionAgent.agent_name}`)}
              />
            </div>
          )}
        </section>

        {/* Orchestrator Framework */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-medium text-foreground">编排框架</h2>
            <span className="text-xs text-muted-foreground">· LangGraph Orchestrator</span>
          </div>
          <div className="bg-card/30 border border-border/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">LangGraph 编排器</h3>
                  <p className="text-xs text-muted-foreground">
                    协调 {agents.length} 个 Agent 的任务分发与执行，管理 N01-N26 节点拓扑
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs">
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{totalTasks.toLocaleString()}</p>
                  <p className="text-muted-foreground">今日调度</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-emerald-400">26</p>
                  <p className="text-muted-foreground">活跃节点</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-medium">运行中</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
  subValue,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  trend?: string
  trendUp?: boolean
  subValue?: string
}) {
  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            trendUp === true && "bg-emerald-500/10 text-emerald-400",
            trendUp === false && "bg-red-500/10 text-red-400",
            trendUp === undefined && "bg-secondary/50 text-muted-foreground"
          )}>
            {trendUp === true && <TrendingUp className="w-3 h-3 inline mr-1" />}
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-foreground mb-1">{value}</p>
      <p className="text-xs text-muted-foreground">{subValue || label}</p>
    </div>
  )
}

function DecisionLayerCard({
  layer,
  title,
  description,
  nodes,
  color,
}: {
  layer: string
  title: string
  description: string
  nodes: string[]
  color: "blue" | "emerald" | "purple"
}) {
  const colors = {
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", dot: "bg-purple-500" },
  }
  const c = colors[color]

  return (
    <div className={cn("rounded-lg p-4 border", c.bg, c.border)}>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("w-2 h-2 rounded-full", c.dot)} />
        <span className={cn("text-xs font-medium", c.text)}>{layer}</span>
      </div>
      <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{description}</p>
      <div className="flex flex-wrap gap-1">
        {nodes.map(n => (
          <span key={n} className="text-[10px] font-mono bg-background/50 px-1.5 py-0.5 rounded text-muted-foreground">
            {n}
          </span>
        ))}
      </div>
    </div>
  )
}

function ProductionAgentCard({ agent, onClick }: { agent: AgentCard; onClick: () => void }) {
  const health = HEALTH_CONFIG[agent.health] || HEALTH_CONFIG.healthy
  const Icon = AGENT_ICONS[agent.agent_name] || Bot

  return (
    <div
      className={cn(
        "group relative bg-card/50 border rounded-xl p-4 cursor-pointer transition-all duration-200",
        "hover:bg-card hover:border-border hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5",
        health.border, "border-border/50"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", health.bg)}>
            <Icon className={cn("w-4 h-4", health.color)} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {agent.display_name}
            </h3>
            <p className="text-[11px] text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Status */}
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium mb-3",
        health.bg, health.color
      )}>
        <span className={cn("w-1.5 h-1.5 rounded-full", agent.status === "working" ? "animate-pulse" : "", health.color.replace("text-", "bg-"))} />
        {health.label}
      </div>

      {/* Nodes */}
      <p className="text-[10px] text-muted-foreground mb-3">
        {agent.responsible_nodes.length > 0 
          ? `负责节点: ${agent.responsible_nodes.slice(0, 4).join(", ")}${agent.responsible_nodes.length > 4 ? ` +${agent.responsible_nodes.length - 4}` : ""}`
          : "横切全节点"
        }
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{agent.stats.total_tasks}</p>
          <p className="text-[9px] text-muted-foreground">今日任务</p>
        </div>
        <div className="text-center">
          <p className={cn(
            "text-sm font-semibold",
            agent.stats.avg_quality_score && agent.stats.avg_quality_score >= 8.5 ? "text-emerald-400" :
            agent.stats.avg_quality_score && agent.stats.avg_quality_score >= 7.5 ? "text-foreground" : "text-amber-400"
          )}>
            {agent.stats.avg_quality_score?.toFixed(1) ?? "—"}
          </p>
          <p className="text-[9px] text-muted-foreground">质量分</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">¥{agent.stats.total_cost_cny}</p>
          <p className="text-[9px] text-muted-foreground">成本</p>
        </div>
      </div>
    </div>
  )
}

function SupervisorCard({ agent, onClick }: { agent: AgentCard; onClick: () => void }) {
  const health = HEALTH_CONFIG[agent.health] || HEALTH_CONFIG.healthy
  const hasBlocks = (agent.supervisor_stats?.blocks_today || 0) > 0

  return (
    <div
      className={cn(
        "group relative bg-gradient-to-br from-purple-500/5 to-card/50 border rounded-xl p-5 cursor-pointer transition-all duration-200",
        "hover:from-purple-500/10 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5",
        "border-purple-500/20"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-medium text-foreground group-hover:text-purple-400 transition-colors">
              {agent.display_name}
            </h3>
            <p className="text-xs text-muted-foreground">成本预算 + 合规检查 + 预警广播</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", health.bg, health.color)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", health.color.replace("text-", "bg-"))} />
          {health.label}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-background/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">今日拦截</p>
          <p className={cn("text-xl font-semibold", hasBlocks ? "text-amber-400" : "text-foreground")}>
            {agent.supervisor_stats?.blocks_today || 0}
          </p>
          {hasBlocks && <p className="text-[10px] text-amber-400 mt-1">存在风险任务</p>}
        </div>
        <div className="bg-background/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">成本校验</p>
          <p className="text-xl font-semibold text-foreground">{agent.supervisor_stats?.checks_today || 0}</p>
        </div>
        <div className="bg-background/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">检查点</p>
          <p className="text-xl font-semibold text-foreground">6</p>
          <p className="text-[10px] text-muted-foreground mt-1">N02,N05,N09...</p>
        </div>
      </div>
    </div>
  )
}

function EvolutionCard({ agent, onClick }: { agent: AgentCard; onClick: () => void }) {
  const health = HEALTH_CONFIG[agent.health] || HEALTH_CONFIG.healthy

  return (
    <div
      className={cn(
        "group relative bg-gradient-to-br from-cyan-500/5 to-card/50 border rounded-xl p-5 cursor-pointer transition-all duration-200",
        "hover:from-cyan-500/10 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5",
        "border-cyan-500/20"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-medium text-foreground group-hover:text-cyan-400 transition-colors">
              {agent.display_name}
            </h3>
            <p className="text-xs text-muted-foreground">Prompt 优化 + RAG 入库 + 经验沉淀</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", health.bg, health.color)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", health.color.replace("text-", "bg-"))} />
          {health.label}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-background/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">当前模式</p>
          <p className="text-sm font-semibold text-foreground truncate">
            {agent.evolution_stats?.current_mode || "持续入库"}
          </p>
        </div>
        <div className="bg-background/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">本周进化</p>
          <p className="text-xl font-semibold text-foreground">
            {agent.evolution_stats?.weekly_evolutions || 0}
          </p>
        </div>
        <div className="bg-background/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">RAG 新增</p>
          <p className="text-xl font-semibold text-cyan-400">
            +{agent.evolution_stats?.rag_new_cases_today || 0}
          </p>
        </div>
      </div>
    </div>
  )
}
