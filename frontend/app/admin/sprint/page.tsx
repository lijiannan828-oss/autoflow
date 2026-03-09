"use client"

import { useState, useMemo } from "react"
import { AdminNavSidebar } from "@/components/admin/admin-nav-sidebar"
import {
  agents,
  phases,
  integrationTasks,
  checkpoints,
  acceptanceRecords,
  getAgentProgress,
  getOverallProgress,
  getCurrentPhase,
} from "@/lib/sprint-data"
import type { AgentInfo, SprintTask, TaskStatus } from "@/lib/sprint-data"

// ─── Color maps ──────────────────────────────────────
const agentColors: Record<string, { bg: string; border: string; text: string; dot: string; line: string }> = {
  red:     { bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-400",     dot: "bg-red-500",     line: "bg-red-500/40" },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    dot: "bg-blue-500",    line: "bg-blue-500/40" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   dot: "bg-amber-500",   line: "bg-amber-500/40" },
  purple:  { bg: "bg-purple-500/10",  border: "border-purple-500/30",  text: "text-purple-400",  dot: "bg-purple-500",  line: "bg-purple-500/40" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-500", line: "bg-emerald-500/40" },
  cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    text: "text-cyan-400",    dot: "bg-cyan-500",    line: "bg-cyan-500/40" },
  pink:    { bg: "bg-pink-500/10",    border: "border-pink-500/30",    text: "text-pink-400",    dot: "bg-pink-500",    line: "bg-pink-500/40" },
  orange:  { bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-400",  dot: "bg-orange-500",  line: "bg-orange-500/40" },
}

const statusConfig: Record<TaskStatus, { label: string; class: string; icon: string }> = {
  pending:       { label: "待开始", class: "text-muted-foreground", icon: "○" },
  "in-progress": { label: "进行中", class: "text-yellow-400",      icon: "◑" },
  done:          { label: "完成",   class: "text-emerald-400",     icon: "●" },
  blocked:       { label: "阻塞",   class: "text-red-400",         icon: "✕" },
  skipped:       { label: "跳过",   class: "text-muted-foreground", icon: "–" },
}

// ─── Sub-components ──────────────────────────────────

function formatMin(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function OverallProgressBar() {
  const p = getOverallProgress()
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-3">
      <span className="text-sm font-medium">总体进度</span>
      {/* By task count */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground">按任务数</span>
          <span className="text-[11px] text-muted-foreground">{p.done}/{p.total} ({p.percent}%)</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${p.percent}%` }}
          />
        </div>
      </div>
      {/* By estimated time */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground">按预估工时</span>
          <span className="text-[11px] text-muted-foreground">{formatMin(p.doneMin)}/{formatMin(p.totalMin)} ({p.percentByTime}%)</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${p.percentByTime}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function PhaseTimeline() {
  const current = getCurrentPhase()
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-4">
      <h3 className="text-sm font-medium mb-3">阶段时间表</h3>
      <div className="flex items-center gap-0">
        {phases.map((phase, i) => {
          const isActive = phase.id === current
          const isDone = phase.id < current
          return (
            <div key={phase.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    isDone
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isActive
                        ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                        : "bg-secondary border-border text-muted-foreground"
                  }`}
                >
                  {isDone ? "✓" : phase.id}
                </div>
                <div className={`mt-1.5 text-[10px] font-medium text-center ${isActive ? "text-yellow-400" : isDone ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {phase.name}
                </div>
                <div className="text-[9px] text-muted-foreground text-center">{phase.timeframe}</div>
                <div className="text-[9px] text-muted-foreground/70 text-center">{phase.description}</div>
              </div>
              {i < phases.length - 1 && (
                <div className={`h-0.5 w-full min-w-4 -mt-6 ${isDone ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DependencyGraph() {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-4">
      <h3 className="text-sm font-medium mb-4">Agent 依赖关系</h3>
      <div className="flex flex-col items-center gap-2">
        {/* Row 1: α */}
        <AgentNode agent={agents.find(a => a.id === "α")!} />
        {/* Arrow down */}
        <div className="text-muted-foreground text-xs">▼</div>
        {/* Row 2: β γ δ ε ζ (parallel) */}
        <div className="flex items-start gap-3 flex-wrap justify-center">
          <AgentNode agent={agents.find(a => a.id === "β")!} />
          <AgentNode agent={agents.find(a => a.id === "γ")!} />
          <AgentNode agent={agents.find(a => a.id === "δ")!} />
          <AgentNode agent={agents.find(a => a.id === "ε")!} />
          <AgentNode agent={agents.find(a => a.id === "ζ")!} />
        </div>
        {/* Arrow down */}
        <div className="text-muted-foreground text-xs">▼</div>
        {/* Row 3: η θ (parallel frontend) */}
        <div className="flex items-start gap-3 flex-wrap justify-center">
          <AgentNode agent={agents.find(a => a.id === "η")!} />
          <AgentNode agent={agents.find(a => a.id === "θ")!} />
        </div>
        {/* Arrow down */}
        <div className="text-muted-foreground text-xs">▼</div>
        {/* Row 4: Integration */}
        <div className="rounded-md border border-border/50 bg-secondary/30 px-4 py-2 text-xs font-medium text-muted-foreground">
          Phase 3: 集成 E2E 贯通
        </div>
      </div>
    </div>
  )
}

function AgentNode({ agent }: { agent: AgentInfo }) {
  const p = getAgentProgress(agent)
  const c = agentColors[agent.color]
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} px-3 py-2 min-w-[130px] text-center`}>
      <div className={`text-xs font-bold ${c.text}`}>
        {agent.name}
        {agent.blockedByGPU && <span className="ml-1 text-[9px] text-red-400">GPU</span>}
      </div>
      <div className="text-[10px] text-muted-foreground">{agent.label}</div>
      <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${c.dot} transition-all duration-500`} style={{ width: `${p.percentByTime}%` }} />
      </div>
      <div className="text-[9px] text-muted-foreground mt-0.5">{p.done}/{p.total} · {formatMin(p.totalMin)}</div>
    </div>
  )
}

function AgentTaskCard({ agent }: { agent: AgentInfo }) {
  const p = getAgentProgress(agent)
  const c = agentColors[agent.color]

  return (
    <div className={`rounded-lg border ${c.border} bg-card/50 overflow-hidden`}>
      {/* Header */}
      <div className={`${c.bg} px-4 py-2.5 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className={`text-sm font-bold ${c.text}`}>{agent.name}</span>
          <span className="text-xs text-muted-foreground">({agent.label})</span>
          {agent.blockedByGPU && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">GPU 阻塞</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">{p.done}/{p.total} 任务</span>
          <span className="text-[10px] text-muted-foreground">{formatMin(p.doneMin)}/{formatMin(p.totalMin)}</span>
          <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full ${c.dot} transition-all`} style={{ width: `${p.percentByTime}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground">{p.percentByTime}%</span>
        </div>
      </div>
      {/* Tasks */}
      <div className="divide-y divide-border/30">
        {agent.tasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: SprintTask }) {
  const sc = statusConfig[task.status]
  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/20 transition-colors">
      <span className={`text-sm ${sc.class}`}>{sc.icon}</span>
      <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">{task.id}</span>
      <span className="text-sm flex-1">{task.title}</span>
      <span className="text-[10px] text-muted-foreground/60 font-mono w-10 shrink-0 text-right">{task.estimatedMin}m</span>
      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{task.detail}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${sc.class} bg-secondary/50`}>{sc.label}</span>
    </div>
  )
}

function IntegrationTasksCard() {
  const done = integrationTasks.filter(t => t.status === "done").length
  const total = integrationTasks.length
  return (
    <div className="rounded-lg border border-orange-500/30 bg-card/50 overflow-hidden">
      <div className="bg-orange-500/10 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-sm font-bold text-orange-400">Phase 3: 集成任务</span>
        </div>
        <span className="text-xs text-muted-foreground">{done}/{total}</span>
      </div>
      <div className="divide-y divide-border/30">
        {integrationTasks.map(task => (
          <TaskRow key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

function CheckpointCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {checkpoints.map(cp => {
        const passed = cp.items.filter(i => i.passed).length
        const total = cp.items.length
        return (
          <div key={cp.id} className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/30 flex items-center justify-between">
              <span className="text-sm font-medium">{cp.day}</span>
              <span className="text-xs text-muted-foreground">{passed}/{total} 通过</span>
            </div>
            <div className="p-3 space-y-2">
              {cp.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`text-xs mt-0.5 ${item.passed ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {item.passed ? "●" : "○"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{item.criteria}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Acceptance Tab ──────────────────────────────────

function AcceptanceTab() {
  if (acceptanceRecords.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        暂无验收记录
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {acceptanceRecords.map(record => (
        <div key={record.id} className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
          {/* Record header */}
          <div className="bg-emerald-500/10 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">
                ✓
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-400">{record.round}</div>
                <div className="text-[10px] text-muted-foreground">{record.completedAt} · {record.taskCount} 任务</div>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">已通过</span>
          </div>
          {/* Results */}
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              {record.results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-emerald-400 mt-0.5 shrink-0">●</span>
                  <span className="text-muted-foreground w-28 shrink-0">{r.task}</span>
                  <span className="text-foreground">{r.result}</span>
                </div>
              ))}
            </div>
            {/* Business value */}
            <div className="border-t border-border/30 pt-3">
              <div className="text-[10px] text-muted-foreground mb-1">业务价值</div>
              <div className="text-xs text-foreground leading-relaxed">{record.businessValue}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────

type TabId = "progress" | "acceptance"

export default function SprintDashboardPage() {
  const overall = useMemo(() => getOverallProgress(), [])
  const [activeTab, setActiveTab] = useState<TabId>("progress")

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AdminNavSidebar />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="shrink-0 border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="flex h-12 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">MVP-0 三日冲刺</span>
              <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                2026-03-08 ~ 03-10
              </span>
              {/* Tab switcher */}
              <div className="flex items-center gap-0.5 bg-secondary/50 rounded-md p-0.5 ml-2">
                {([
                  { id: "progress" as TabId, label: "进度" },
                  { id: "acceptance" as TabId, label: `验收 (${acceptanceRecords.length})` },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1 text-[11px] font-medium rounded transition-colors ${
                      activeTab === tab.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>任务 <span className="font-mono font-bold text-foreground">{overall.done}/{overall.total}</span></span>
              <span>工时 <span className="font-mono font-bold text-foreground">{formatMin(overall.doneMin)}/{formatMin(overall.totalMin)}</span></span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 space-y-6 overflow-y-auto">
          {activeTab === "progress" ? (
            <>
              {/* Row 1: Overall progress + Phase timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <OverallProgressBar />
                <PhaseTimeline />
              </div>

              {/* Row 2: Dependency graph */}
              <DependencyGraph />

              {/* Row 3: Agent task cards */}
              <div className="space-y-4">
                <h2 className="text-sm font-medium">各 Agent 任务明细</h2>
                {/* Phase 0 */}
                <AgentTaskCard agent={agents.find(a => a.id === "α")!} />
                {/* Phase 1 - parallel */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <AgentTaskCard agent={agents.find(a => a.id === "β")!} />
                  <AgentTaskCard agent={agents.find(a => a.id === "γ")!} />
                  <AgentTaskCard agent={agents.find(a => a.id === "ε")!} />
                  <AgentTaskCard agent={agents.find(a => a.id === "ζ")!} />
                </div>
                {/* Phase 2 */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <AgentTaskCard agent={agents.find(a => a.id === "δ")!} />
                  <AgentTaskCard agent={agents.find(a => a.id === "η")!} />
                  <AgentTaskCard agent={agents.find(a => a.id === "θ")!} />
                </div>
                {/* Phase 3 - Integration */}
                <IntegrationTasksCard />
              </div>

              {/* Row 4: Checkpoints */}
              <div className="space-y-3">
                <h2 className="text-sm font-medium">每日检查点</h2>
                <CheckpointCards />
              </div>
            </>
          ) : (
            <AcceptanceTab />
          )}
        </main>
      </div>
    </div>
  )
}
