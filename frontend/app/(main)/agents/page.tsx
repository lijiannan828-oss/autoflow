"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bot, Activity, DollarSign, Star, Shield, Zap, ArrowRight } from "lucide-react"

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

const HEALTH_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  healthy: { label: "正常", color: "text-emerald-400", dot: "bg-emerald-500" },
  busy: { label: "繁忙", color: "text-amber-400", dot: "bg-amber-500" },
  degraded: { label: "降级", color: "text-orange-400", dot: "bg-orange-500" },
  error: { label: "异常", color: "text-red-400", dot: "bg-red-500" },
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
      <div className="h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
    ? (qualityAgents.reduce((s, a) => s + (a.stats.avg_quality_score || 0), 0) / qualityAgents.length).toFixed(1)
    : "—"
  const allHealthy = agents.every(a => a.health === "healthy" || a.health === "busy")

  return (
    <div className="h-full overflow-auto p-5 space-y-5">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <Bot className="w-5 h-5 text-primary" />
        <h1 className="text-base font-semibold text-foreground">Agent 中心</h1>
        <span className="text-xs text-muted-foreground">· {agents.length} 个 Agent + 1 个框架</span>
      </div>

      {/* Global status bar */}
      <div className="flex items-center gap-4 bg-secondary/30 rounded-lg px-4 py-2.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", allHealthy ? "bg-emerald-500" : "bg-amber-500")} />
          <span className={allHealthy ? "text-emerald-400" : "text-amber-400"}>
            {allHealthy ? "全部正常" : "部分异常"}
          </span>
        </div>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">今日总任务: <span className="text-foreground font-medium">{totalTasks.toLocaleString()}</span></span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">今日总成本: <span className="text-foreground font-medium">¥{totalCost.toFixed(1)}</span></span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">平均质量: <span className="text-foreground font-medium">{avgQuality}</span></span>
      </div>

      {/* Production agents */}
      <div>
        <p className="text-xs text-muted-foreground mb-2.5">生产线 Agent</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {production.map(agent => (
            <AgentCardItem key={agent.agent_name} agent={agent} onClick={() => router.push(`/agents/${agent.agent_name}`)} />
          ))}
        </div>
      </div>

      {/* Supervisor + Evolution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {supervisorAgent && (
          <div>
            <p className="text-xs text-muted-foreground mb-2.5">横切守卫</p>
            <SupervisorCard agent={supervisorAgent} onClick={() => router.push(`/agents/${supervisorAgent.agent_name}`)} />
          </div>
        )}
        {evolutionAgent && (
          <div>
            <p className="text-xs text-muted-foreground mb-2.5">进化 Agent</p>
            <EvolutionCard agent={evolutionAgent} onClick={() => router.push(`/agents/${evolutionAgent.agent_name}`)} />
          </div>
        )}
      </div>

      {/* Framework bar */}
      <div>
        <p className="text-xs text-muted-foreground mb-2.5">框架</p>
        <div className="bg-secondary/20 rounded-lg px-4 py-3 flex items-center justify-between border border-border/30">
          <div className="flex items-center gap-3">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">LangGraph Orchestrator</span>
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              运行中
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            今日调度 {totalTasks.toLocaleString()} 次 · 无异常
          </span>
        </div>
      </div>
    </div>
  )
}

function AgentCardItem({ agent, onClick }: { agent: AgentCard; onClick: () => void }) {
  const health = HEALTH_CONFIG[agent.health] || HEALTH_CONFIG.healthy
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn(
        "group bg-card/60 border border-border/40 rounded-lg p-3.5 cursor-pointer transition-all",
        "hover:bg-card/80 hover:border-border/60 hover:-translate-y-0.5 hover:shadow-md"
      )}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-foreground">{agent.display_name}</p>
          <p className="text-[10px] text-muted-foreground">{agent.role}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", health.dot)} />
          <span className={cn("text-[10px]", health.color)}>{health.label}</span>
          {hovered && <ArrowRight className="w-3 h-3 text-muted-foreground ml-1" />}
        </div>
      </div>

      {/* Nodes */}
      <p className="text-[10px] text-muted-foreground mb-2.5 truncate">
        {agent.responsible_nodes.length > 0 ? agent.responsible_nodes.join(", ") : "横切全节点"}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs font-semibold text-foreground">{agent.stats.total_tasks}</p>
          <p className="text-[9px] text-muted-foreground">今日</p>
        </div>
        <div>
          <p className={cn("text-xs font-semibold", agent.stats.avg_quality_score && agent.stats.avg_quality_score < 8 ? "text-amber-400" : "text-foreground")}>
            {agent.stats.avg_quality_score ?? "N/A"}
          </p>
          <p className="text-[9px] text-muted-foreground">质量</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">¥{agent.stats.total_cost_cny}</p>
          <p className="text-[9px] text-muted-foreground">成本</p>
        </div>
      </div>
    </div>
  )
}

function SupervisorCard({ agent, onClick }: { agent: AgentCard; onClick: () => void }) {
  const health = HEALTH_CONFIG[agent.health] || HEALTH_CONFIG.healthy

  return (
    <div
      className="bg-card/60 border border-border/40 rounded-lg p-4 cursor-pointer transition-all hover:bg-card/80 hover:border-border/60 hover:-translate-y-0.5 hover:shadow-md"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium">{agent.display_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", health.dot)} />
          <span className={cn("text-[10px]", health.color)}>{health.label}</span>
        </div>
      </div>
      <div className="flex gap-6 text-xs">
        <div>
          <p className="text-muted-foreground">今日拦截</p>
          <p className={cn("text-lg font-semibold", (agent.supervisor_stats?.blocks_today || 0) > 0 ? "text-amber-400" : "text-foreground")}>
            {agent.supervisor_stats?.blocks_today || 0}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">成本校验</p>
          <p className="text-lg font-semibold text-foreground">{agent.supervisor_stats?.checks_today || 0}</p>
        </div>
        <div>
          <p className="text-muted-foreground">横切全节点</p>
          <p className="text-lg font-semibold text-foreground">26</p>
        </div>
      </div>
    </div>
  )
}

function EvolutionCard({ agent, onClick }: { agent: AgentCard; onClick: () => void }) {
  const health = HEALTH_CONFIG[agent.health] || HEALTH_CONFIG.healthy

  return (
    <div
      className="bg-card/60 border border-border/40 rounded-lg p-4 cursor-pointer transition-all hover:bg-card/80 hover:border-border/60 hover:-translate-y-0.5 hover:shadow-md"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium">{agent.display_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", health.dot)} />
          <span className={cn("text-[10px]", health.color)}>{health.label}</span>
        </div>
      </div>
      <div className="flex gap-6 text-xs">
        <div>
          <p className="text-muted-foreground">当前模式</p>
          <p className="text-sm font-semibold text-foreground">{agent.evolution_stats?.current_mode || "持续入库"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">本周进化</p>
          <p className="text-lg font-semibold text-foreground">{agent.evolution_stats?.weekly_evolutions || 0} 次</p>
        </div>
        <div>
          <p className="text-muted-foreground">RAG 新增</p>
          <p className="text-lg font-semibold text-foreground">+{agent.evolution_stats?.rag_new_cases_today || 0}</p>
        </div>
      </div>
    </div>
  )
}
