"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft, Check, Loader2, X, Clock, User, ChevronDown,
  FileText, FileJson, Image, Video, Music, Layers, AlertCircle,
  Cpu, DollarSign, Hash, Zap, RefreshCw, Play, Pause, RotateCcw,
  Eye, Terminal, BarChart3, Package, Info, Copy, ChevronRight,
} from "lucide-react"

import { AdminNavSidebar } from "@/components/admin/admin-nav-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { dramaDetailData, getPhasesForEpisode } from "@/lib/drama-detail-mock-data"
import type { PipelineMode, PipelineNode, EpisodeInstance, Phase, NodeStatus } from "@/lib/drama-detail-types"
import type { NodeTraceApiResponse, NodeRun } from "@/lib/orchestrator-contract-types"
import { NODE_SPECS, getNodeSpec, getCategoryLabel, getCategoryColor, STAGE_GROUPS } from "@/lib/node-specs"
import type { NodeSpec } from "@/lib/node-specs"

// ── Tab types ──
type NodeDetailTab = "overview" | "io" | "prompts" | "qc" | "telemetry"

function formatMetric(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  return value.toFixed(digits)
}

function getStatusIcon(status: NodeStatus, isHuman: boolean) {
  if (isHuman) return <User className="h-3 w-3" />
  switch (status) {
    case "completed": return <Check className="h-3 w-3" />
    case "running": return <Loader2 className="h-3 w-3 animate-spin" />
    case "failed": return <X className="h-3 w-3" />
    default: return <Clock className="h-3 w-3" />
  }
}

function getStatusColor(status: NodeStatus) {
  switch (status) {
    case "completed": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
    case "running": return "text-blue-500 bg-blue-500/10 border-blue-500/30"
    case "failed": return "text-red-500 bg-red-500/10 border-red-500/30"
    default: return "text-muted-foreground bg-secondary/30 border-border/50"
  }
}

export default function DramaDetailPage() {
  const router = useRouter()
  const [nodeTraceSnapshot, setNodeTraceSnapshot] = useState<NodeTraceApiResponse | null>(null)
  const [mode, setMode] = useState<PipelineMode>("episode")
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeInstance | null>(
    dramaDetailData.episodes.find(e => e.status === "running") || dramaDetailData.episodes[0]
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("N01")
  const [activeTab, setActiveTab] = useState<NodeDetailTab>("overview")
  const [expandedGroups, setExpandedGroups] = useState<string[]>(STAGE_GROUPS.map(g => g.id))

  // Get phases for the selected episode to derive node statuses
  const phases = useMemo<Phase[]>(() => {
    if (mode === "global") return dramaDetailData.globalPhases
    if (selectedEpisode) return getPhasesForEpisode(selectedEpisode)
    return []
  }, [mode, selectedEpisode])

  // Build a map of nodeId → status, preferring real node_run data over mock
  const nodeStatusMap = useMemo(() => {
    const map: Record<string, NodeStatus> = {}
    // Start with mock statuses
    for (const phase of phases) {
      for (const node of phase.nodes) {
        map[`N${String(node.nodeNumber).padStart(2, "0")}`] = node.status
      }
    }
    // Override with real node_run statuses when available
    if (nodeTraceSnapshot?.real_node_runs) {
      for (const nr of nodeTraceSnapshot.real_node_runs) {
        const statusMap: Record<string, NodeStatus> = {
          succeeded: "completed",
          failed: "failed",
          running: "running",
          retrying: "running",
          pending: "pending",
          skipped: "skipped",
          auto_rejected: "failed",
          partial: "running",
          canceled: "failed",
        }
        map[nr.node_id] = statusMap[nr.status] || "pending"
      }
    }
    return map
  }, [phases, nodeTraceSnapshot])

  // Find real node_run for selected node
  const selectedNodeRun = useMemo<NodeRun | null>(() => {
    if (!nodeTraceSnapshot?.real_node_runs || !selectedNodeId) return null
    return nodeTraceSnapshot.real_node_runs.find(nr => nr.node_id === selectedNodeId) ?? null
  }, [nodeTraceSnapshot, selectedNodeId])

  const selectedSpec = useMemo(() => selectedNodeId ? getNodeSpec(selectedNodeId) : null, [selectedNodeId])

  // Get PipelineNode mock data for the selected node
  const selectedMockNode = useMemo<PipelineNode | null>(() => {
    if (!selectedNodeId) return null
    for (const phase of phases) {
      const found = phase.nodes.find(n => `N${String(n.nodeNumber).padStart(2, "0")}` === selectedNodeId)
      if (found) return found
    }
    return null
  }, [selectedNodeId, phases])

  // Fetch real node trace data
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const response = await fetch("/api/orchestrator/node-trace", { cache: "no-store" })
        const payload = (await response.json()) as NodeTraceApiResponse
        if (!disposed) setNodeTraceSnapshot(payload)
      } catch {
        if (!disposed) setNodeTraceSnapshot(null)
      }
    }
    void load()
    return () => { disposed = true }
  }, [])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    )
  }

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("已复制到剪贴板")
  }, [])

  // ── Tab definitions ──
  const tabs: { id: NodeDetailTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { id: "overview", label: "概览", icon: <Info className="h-3.5 w-3.5" />, show: true },
    { id: "io", label: "输入/输出", icon: <Eye className="h-3.5 w-3.5" />, show: true },
    { id: "prompts", label: "提示词", icon: <Terminal className="h-3.5 w-3.5" />, show: !!selectedSpec?.systemPrompt },
    { id: "qc", label: "质检分数", icon: <BarChart3 className="h-3.5 w-3.5" />, show: !!selectedSpec?.isQC },
    { id: "telemetry", label: "遥测", icon: <Cpu className="h-3.5 w-3.5" />, show: true },
  ]

  return (
    <div className="flex h-screen bg-background">
      <AdminNavSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── Header ── */}
        <header className="shrink-0 border-b border-border/50 bg-background">
          <div className="flex h-12 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => router.push("/admin")}>
                <ArrowLeft className="h-3.5 w-3.5" /> 返回
              </Button>
              <div className="h-4 w-px bg-border/40" />
              <span className="text-sm font-semibold">{dramaDetailData.title}</span>
              <Badge variant="outline" className="text-[10px]">
                {nodeTraceSnapshot?.source ?? "loading"}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>已完成 {dramaDetailData.completedEpisodes}/{dramaDetailData.totalEpisodes}</span>
              <span>总成本 ¥{dramaDetailData.totalCost.toFixed(2)}</span>
            </div>
          </div>
        </header>

        {/* ── Episode strip ── */}
        <div className="shrink-0 border-b border-border/50 bg-[#0d0d0d] px-4 py-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {dramaDetailData.episodes.map((ep) => {
              const isSelected = ep.id === selectedEpisode?.id
              const statusBorder = isSelected ? "border-white" :
                ep.status === "completed" ? "border-emerald-500/50" :
                ep.status === "running" ? "border-blue-500/50" :
                ep.status === "failed" ? "border-red-500/50" : "border-border/50"
              return (
                <button key={ep.id} onClick={() => { setSelectedEpisode(ep); setSelectedNodeId("N01") }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium shrink-0 transition-all
                    ${statusBorder} ${isSelected ? "bg-white/10 ring-1 ring-white/30" : "hover:bg-secondary/50"}`}>
                  <span className={isSelected ? "text-foreground" : "text-muted-foreground"}>
                    第{ep.episodeNumber}集
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left: Node list sidebar ── */}
          <div className="w-60 shrink-0 border-r border-border/50 bg-[#0a0a0a] overflow-y-auto">
            <div className="p-3">
              <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                26 节点流程
              </h3>
              <div className="space-y-1">
                {STAGE_GROUPS.map((group) => {
                  const isExpanded = expandedGroups.includes(group.id)
                  const nodes = group.nodeIds.map(id => NODE_SPECS.find(n => n.id === id)!).filter(Boolean)
                  const completedCount = nodes.filter(n => {
                    const status = nodeStatusMap[n.id]
                    return status === "completed"
                  }).length

                  return (
                    <div key={group.id}>
                      <button onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/50 transition-colors">
                        <span className="flex-1 text-left text-xs font-medium text-foreground">
                          {group.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{completedCount}/{nodes.length}</span>
                        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
                      </button>

                      {isExpanded && (
                        <div className="ml-2 mt-1 space-y-0.5 border-l border-border/30 pl-2">
                          {nodes.map((spec) => {
                            const nodeStatus = nodeStatusMap[spec.id] || "pending"
                            const isSelected = spec.id === selectedNodeId
                            const hasRealData = nodeTraceSnapshot?.real_node_runs?.some(nr => nr.node_id === spec.id)

                            return (
                              <button key={spec.id}
                                onClick={() => { setSelectedNodeId(spec.id); setActiveTab("overview") }}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors
                                  ${isSelected ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-secondary/50"}`}>
                                <div className={`flex h-5 w-5 items-center justify-center rounded border text-[10px] ${getStatusColor(nodeStatus)}`}>
                                  {getStatusIcon(nodeStatus, spec.isGate)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">{spec.id}</span>
                                    <span className={`text-[11px] truncate ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                                      {spec.name}
                                    </span>
                                  </div>
                                </div>
                                {hasRealData && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="有真实数据" />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Center: Node detail with tabs ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d0d]">
            {selectedSpec ? (
              <>
                {/* Node header + category badge */}
                <div className="shrink-0 border-b border-border/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">{selectedSpec.id}</span>
                    <span className="text-sm text-muted-foreground">{selectedSpec.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${getCategoryColor(selectedSpec.category)}`}>
                      {getCategoryLabel(selectedSpec.category)}
                    </Badge>
                    {selectedSpec.model && (
                      <Badge variant="outline" className="text-[10px] border-violet-500/30 bg-violet-500/10 text-violet-400">
                        {selectedSpec.model}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{selectedSpec.description}</p>
                  {selectedSpec.dependsOn.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <span>依赖:</span>
                      {selectedSpec.dependsOn.map(d => (
                        <button key={d} onClick={() => setSelectedNodeId(d)}
                          className="px-1.5 py-0.5 rounded bg-secondary/30 hover:bg-secondary/50 text-foreground">
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="shrink-0 border-b border-border/50 px-4 flex gap-1">
                  {tabs.filter(t => t.show).map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors
                        ${activeTab === tab.id
                          ? "border-emerald-500 text-emerald-400"
                          : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {activeTab === "overview" && <OverviewTab spec={selectedSpec} nodeRun={selectedNodeRun} mockNode={selectedMockNode} />}
                  {activeTab === "io" && <IOTab spec={selectedSpec} nodeRun={selectedNodeRun} mockNode={selectedMockNode} />}
                  {activeTab === "prompts" && <PromptsTab spec={selectedSpec} onCopy={copyToClipboard} />}
                  {activeTab === "qc" && <QCTab spec={selectedSpec} />}
                  {activeTab === "telemetry" && <TelemetryTab spec={selectedSpec} nodeRun={selectedNodeRun} mockNode={selectedMockNode} />}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">选择左侧节点查看详情</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Real node_runs quick panel ── */}
          <div className="w-72 shrink-0 border-l border-border/50 bg-[#0a0a0a] overflow-y-auto p-3">
            <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              真实 Node Runs
            </h3>
            {nodeTraceSnapshot?.real_node_runs && nodeTraceSnapshot.real_node_runs.length > 0 ? (
              <div className="space-y-2">
                {nodeTraceSnapshot.real_node_runs.map((nr) => (
                  <button key={nr.id} onClick={() => { setSelectedNodeId(nr.node_id); setActiveTab("telemetry") }}
                    className={`w-full text-left p-2 rounded-lg border transition-colors
                      ${nr.node_id === selectedNodeId ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50 hover:border-border"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{nr.node_id}</span>
                      <Badge variant="outline" className={`text-[9px] ${
                        nr.status === "succeeded" ? "text-emerald-400 border-emerald-500/30" :
                        nr.status === "failed" ? "text-red-400 border-red-500/30" :
                        nr.status === "running" ? "text-blue-400 border-blue-500/30" :
                        "text-muted-foreground"
                      }`}>{nr.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                      <span>费用: ¥{nr.cost_cny.toFixed(3)}</span>
                      <span>耗时: {nr.duration_s ? `${nr.duration_s.toFixed(1)}s` : "-"}</span>
                      {nr.model_provider && <span className="col-span-2 truncate">模型: {nr.model_provider}</span>}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无真实 node_runs 数据</p>
            )}

            {/* North Star Summary */}
            {nodeTraceSnapshot?.north_star_summary && (
              <>
                <div className="my-3 h-px bg-border/30" />
                <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  北极星指标
                </h3>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总成本</span>
                    <span className="text-foreground">¥{formatMetric(nodeTraceSnapshot.north_star_summary.cost.total_cost_cny, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平均质量分</span>
                    <span className="text-foreground">{formatMetric(nodeTraceSnapshot.north_star_summary.quality.avg_quality_score, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">待审核任务</span>
                    <span className="text-foreground">{nodeTraceSnapshot.north_star_summary.throughput.pending_review_tasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">退回票/审核点</span>
                    <span className="text-foreground">
                      {nodeTraceSnapshot.north_star_summary.feedback.total_return_tickets} / {nodeTraceSnapshot.north_star_summary.feedback.review_points}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Overview Tab ──
function OverviewTab({ spec, nodeRun, mockNode }: { spec: NodeSpec; nodeRun: NodeRun | null; mockNode: PipelineNode | null }) {
  return (
    <div className="space-y-4 max-w-3xl">
      {/* Node metadata card */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">节点信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Stage</span>
              <p className="font-medium mt-0.5">Stage {spec.stage}</p>
            </div>
            <div>
              <span className="text-muted-foreground">分组</span>
              <p className="font-medium mt-0.5">{spec.stageGroup}</p>
            </div>
            <div>
              <span className="text-muted-foreground">类型</span>
              <p className="font-medium mt-0.5">{getCategoryLabel(spec.category)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">输出粒度</span>
              <p className="font-medium mt-0.5">{spec.outputScope}</p>
            </div>
            <div>
              <span className="text-muted-foreground">主模型</span>
              <p className="font-medium mt-0.5">{spec.model || "无"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">降级模型</span>
              <p className="font-medium mt-0.5">{spec.fallbackModels.length > 0 ? spec.fallbackModels.join(", ") : "无"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Agent 角色</span>
              <p className="font-medium mt-0.5">{spec.agentRole}</p>
            </div>
            <div>
              <span className="text-muted-foreground">依赖节点</span>
              <p className="font-medium mt-0.5">{spec.dependsOn.length > 0 ? spec.dependsOn.join(" → ") : "无（起始节点）"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real node_run data if available */}
      {nodeRun && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              真实执行数据
              <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">{nodeRun.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-muted-foreground">费用</span><p className="font-medium mt-0.5">¥{nodeRun.cost_cny.toFixed(3)}</p></div>
              <div><span className="text-muted-foreground">耗时</span><p className="font-medium mt-0.5">{nodeRun.duration_s ? `${nodeRun.duration_s.toFixed(1)}s` : "-"}</p></div>
              <div><span className="text-muted-foreground">Token In/Out</span><p className="font-medium mt-0.5">{nodeRun.token_in}/{nodeRun.token_out}</p></div>
              <div><span className="text-muted-foreground">GPU 秒</span><p className="font-medium mt-0.5">{nodeRun.gpu_seconds}</p></div>
              <div><span className="text-muted-foreground">API 调用</span><p className="font-medium mt-0.5">{nodeRun.api_calls}</p></div>
              <div><span className="text-muted-foreground">质量分</span><p className="font-medium mt-0.5">{nodeRun.quality_score ?? "-"}</p></div>
              {nodeRun.model_provider && (
                <div className="col-span-3"><span className="text-muted-foreground">模型</span><p className="font-medium mt-0.5">{nodeRun.model_provider} / {nodeRun.model_endpoint}</p></div>
              )}
              {nodeRun.error_code && (
                <div className="col-span-3">
                  <span className="text-red-400">错误</span>
                  <p className="font-medium mt-0.5 text-red-300">{nodeRun.error_code}: {nodeRun.error_message}</p>
                </div>
              )}
              {nodeRun.input_ref && (
                <div className="col-span-3"><span className="text-muted-foreground">Input Ref</span><p className="font-mono mt-0.5 text-[10px] break-all">{nodeRun.input_ref}</p></div>
              )}
              {nodeRun.output_ref && (
                <div className="col-span-3"><span className="text-muted-foreground">Output Ref</span><p className="font-mono mt-0.5 text-[10px] break-all">{nodeRun.output_ref}</p></div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parameters */}
      {spec.params.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">默认参数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {spec.params.map(p => (
                <div key={p.key} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground ml-2">{p.description}</span>
                  </div>
                  <code className="px-2 py-0.5 rounded bg-secondary/50 text-emerald-400 font-mono text-[11px]">
                    {String(p.defaultValue)}
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── I/O Tab ──
interface ArtifactItem {
  id: string
  artifact_type: string
  anchor_type: string
  anchor_id: string | null
  resource_url: string
  preview_url: string | null
  meta_json: Record<string, unknown>
  created_at: string
  http_url?: string | null
}

function IOTab({ spec, nodeRun, mockNode }: { spec: NodeSpec; nodeRun: NodeRun | null; mockNode: PipelineNode | null }) {
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([])
  const [artifactsLoading, setArtifactsLoading] = useState(false)
  const [artifactsError, setArtifactsError] = useState<string | null>(null)
  const [resolvedRefs, setResolvedRefs] = useState<{ input?: string | null; output?: string | null }>({})

  // Fetch real artifacts when nodeRun changes
  useEffect(() => {
    if (!nodeRun?.id) { setArtifacts([]); setArtifactsError(null); return }
    let disposed = false
    const load = async () => {
      setArtifactsLoading(true)
      setArtifactsError(null)
      try {
        const res = await fetch(`/api/orchestrator/artifacts/by-node-run?node_run_id=${nodeRun.id}`, { cache: "no-store" })
        const data = await res.json()
        if (disposed) return
        if (data.error) { setArtifactsError(data.error); setArtifacts([]); return }
        const items: ArtifactItem[] = data.items ?? []
        // Resolve TOS presigned URLs for items with tos:// resource_url
        const resolved = await Promise.all(
          items.map(async (item) => {
            if (item.resource_url?.startsWith("tos://")) {
              try {
                const urlRes = await fetch(`/api/orchestrator/tos/presigned-url?tos_url=${encodeURIComponent(item.resource_url)}`)
                const urlData = await urlRes.json()
                return { ...item, http_url: urlData.http_url ?? null }
              } catch { return { ...item, http_url: null } }
            }
            return item
          })
        )
        if (!disposed) setArtifacts(resolved)
      } catch (e) {
        if (!disposed) setArtifactsError(e instanceof Error ? e.message : "fetch error")
      } finally {
        if (!disposed) setArtifactsLoading(false)
      }
    }
    load()
    return () => { disposed = true }
  }, [nodeRun?.id])

  // Resolve TOS presigned URLs for input_ref / output_ref
  useEffect(() => {
    if (!nodeRun) { setResolvedRefs({}); return }
    let disposed = false
    const resolve = async (url: string | null) => {
      if (!url?.startsWith("tos://")) return url
      try {
        const res = await fetch(`/api/orchestrator/tos/presigned-url?tos_url=${encodeURIComponent(url)}`)
        const data = await res.json()
        return data.http_url ?? url
      } catch { return url }
    }
    Promise.all([resolve(nodeRun.input_ref), resolve(nodeRun.output_ref)]).then(([inp, out]) => {
      if (!disposed) setResolvedRefs({ input: inp, output: out })
    })
    return () => { disposed = true }
  }, [nodeRun?.input_ref, nodeRun?.output_ref])

  const getArtifactIcon = (type: string) => {
    if (type.includes("image") || type.includes("keyframe")) return <Image className="h-4 w-4 text-blue-400" />
    if (type.includes("video")) return <Video className="h-4 w-4 text-purple-400" />
    if (type.includes("audio") || type.includes("bgm") || type.includes("sfx")) return <Music className="h-4 w-4 text-green-400" />
    if (type.includes("json") || type.includes("prompt") || type.includes("script")) return <FileJson className="h-4 w-4 text-amber-400" />
    return <Package className="h-4 w-4 text-muted-foreground" />
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Real artifacts from DB */}
      {nodeRun && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              真实产物 (Artifacts)
              {artifactsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {artifacts.length > 0 && <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">{artifacts.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {artifactsError && <p className="text-xs text-amber-400">API 错误: {artifactsError}（回退至 mock 数据）</p>}
            {!artifactsLoading && artifacts.length === 0 && !artifactsError && (
              <p className="text-xs text-muted-foreground italic">暂无产物记录</p>
            )}
            {artifacts.length > 0 && (
              <div className="space-y-2">
                {artifacts.map((art) => (
                  <div key={art.id} className="flex items-start gap-3 p-2 rounded bg-secondary/20 border border-border/30">
                    <div className="mt-0.5">{getArtifactIcon(art.artifact_type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{art.artifact_type}</span>
                        {art.anchor_type && <Badge variant="outline" className="text-[9px]">{art.anchor_type}{art.anchor_id ? `:${art.anchor_id}` : ""}</Badge>}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground break-all mt-0.5">{art.resource_url}</p>
                      {art.http_url && (
                        <a href={art.http_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-400 hover:underline mt-0.5 inline-block">
                          预览/下载
                        </a>
                      )}
                      {Object.keys(art.meta_json).length > 0 && (
                        <pre className="mt-1 text-[9px] text-muted-foreground bg-secondary/30 rounded p-1 max-h-20 overflow-auto">
                          {JSON.stringify(art.meta_json, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Real refs with resolved URLs */}
      {nodeRun && (nodeRun.input_ref || nodeRun.output_ref) && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">I/O 引用 (TOS)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nodeRun.input_ref && (
              <div>
                <span className="text-xs text-muted-foreground">Input Ref</span>
                <pre className="mt-1 p-2 rounded bg-secondary/30 text-[10px] font-mono text-foreground break-all whitespace-pre-wrap">
                  {nodeRun.input_ref}
                </pre>
                {resolvedRefs.input && resolvedRefs.input !== nodeRun.input_ref && (
                  <a href={resolvedRefs.input} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-400 hover:underline mt-1 inline-block">
                    查看 Input 内容
                  </a>
                )}
              </div>
            )}
            {nodeRun.output_ref && (
              <div>
                <span className="text-xs text-muted-foreground">Output Ref</span>
                <pre className="mt-1 p-2 rounded bg-secondary/30 text-[10px] font-mono text-foreground break-all whitespace-pre-wrap">
                  {nodeRun.output_ref}
                </pre>
                {resolvedRefs.output && resolvedRefs.output !== nodeRun.output_ref && (
                  <a href={resolvedRefs.output} target="_blank" rel="noopener noreferrer" className="text-[10px] text-sky-400 hover:underline mt-1 inline-block">
                    查看 Output 内容
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mock I/O preview (fallback when no real data) */}
      {(!nodeRun || artifacts.length === 0) && mockNode && (
        <>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                输入 (Input)
                <Badge variant="outline" className="text-[9px]">{mockNode.input.type}</Badge>
                {!nodeRun && <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30">mock</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IOContentRenderer io={mockNode.input} />
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                输出 (Output)
                <Badge variant="outline" className="text-[9px]">{mockNode.output.type}</Badge>
                {!nodeRun && <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-500/30">mock</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IOContentRenderer io={mockNode.output} />
            </CardContent>
          </Card>
        </>
      )}

      {/* User prompt template showing expected I/O format */}
      {spec.userPromptTemplate && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">输入模板变量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {(spec.userPromptTemplate.match(/\{\{(\w+)\}\}/g) || []).map((match, i) => (
                <code key={i} className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[10px] font-mono border border-violet-500/20">
                  {match}
                </code>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function IOContentRenderer({ io }: { io: PipelineNode["input"] }) {
  if (io.content === null && !io.items?.length) {
    return <p className="text-xs text-muted-foreground italic">暂无数据</p>
  }
  if (io.type === "text" && typeof io.content === "string") {
    return <div className="bg-secondary/30 rounded-md p-3 text-xs text-foreground/90 whitespace-pre-wrap max-h-48 overflow-y-auto">{io.content}</div>
  }
  if (io.type === "json" && io.content) {
    return <pre className="bg-secondary/30 rounded-md p-3 text-xs text-emerald-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">{JSON.stringify(io.content, null, 2)}</pre>
  }
  if (io.items && io.items.length > 0) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {io.items.map((item) => (
          <div key={item.id} className="rounded-lg overflow-hidden border border-border/50">
            <div className="aspect-square flex items-center justify-center bg-secondary/30">
              {item.type === "image" ? <Image className="h-6 w-6 text-white/40" /> :
               item.type === "video" ? <Video className="h-6 w-6 text-white/40" /> :
               item.type === "audio" ? <Music className="h-6 w-6 text-white/40" /> :
               <FileText className="h-6 w-6 text-white/40" />}
            </div>
            <div className="p-1.5 bg-background/80">
              <p className="text-[10px] truncate">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// ── Prompts Tab ──
function PromptsTab({ spec, onCopy }: { spec: NodeSpec; onCopy: (text: string) => void }) {
  return (
    <div className="space-y-4 max-w-3xl">
      {spec.systemPrompt && (
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">System Prompt</CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => onCopy(spec.systemPrompt!)}>
                <Copy className="h-3 w-3" /> 复制
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-secondary/30 rounded-md p-4 text-xs text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
              {spec.systemPrompt}
            </pre>
          </CardContent>
        </Card>
      )}

      {spec.userPromptTemplate && (
        <Card className="border-sky-500/20 bg-sky-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">User Prompt Template</CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => onCopy(spec.userPromptTemplate!)}>
                <Copy className="h-3 w-3" /> 复制
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-secondary/30 rounded-md p-4 text-xs text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
              {spec.userPromptTemplate}
            </pre>
            <div className="mt-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">模板变量</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(spec.userPromptTemplate.match(/\{\{(\w+)\}\}/g) || []).map((match, i) => (
                  <code key={i} className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-mono border border-sky-500/20">
                    {match}
                  </code>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QC voting models */}
      {spec.qcConfig && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">投票模型配置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">投票模型:</span>
                <div className="flex gap-1">
                  {spec.qcConfig.votingModels.map(m => (
                    <code key={m} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px]">{m}</code>
                  ))}
                </div>
              </div>
              <div><span className="text-muted-foreground">通过阈值:</span> <span className="font-medium">{spec.qcConfig.threshold}</span></div>
              {spec.qcConfig.singleDimFloor && (
                <div><span className="text-muted-foreground">单维下限:</span> <span className="font-medium text-red-400">{spec.qcConfig.singleDimFloor}</span></div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── QC Tab ──
function QCTab({ spec }: { spec: NodeSpec }) {
  if (!spec.qcConfig) return <p className="text-sm text-muted-foreground">此节点无质检配置</p>

  // Mock QC scores for demonstration
  const mockScores = spec.qcConfig.votingModels.map((model) => ({
    model,
    dimensions: spec.qcConfig!.dimensions.map(d => ({
      ...d,
      score: 6.5 + Math.random() * 3.5, // 6.5 - 10
    })),
  }))

  const getScoreColor = (score: number, threshold: number) => {
    if (score >= threshold) return "text-emerald-400"
    if (score >= threshold - 1) return "text-amber-400"
    return "text-red-400"
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Threshold info */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-6 text-xs">
            <div><span className="text-muted-foreground">通过阈值:</span> <span className="font-bold text-amber-400">{spec.qcConfig.threshold}</span></div>
            {spec.qcConfig.singleDimFloor && (
              <div><span className="text-muted-foreground">单维下限:</span> <span className="font-bold text-red-400">{spec.qcConfig.singleDimFloor}</span></div>
            )}
            <div><span className="text-muted-foreground">投票策略:</span> <span className="font-medium">去极值取平均</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Per-model scores */}
      {mockScores.map((ms) => {
        const weightedAvg = ms.dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
        return (
          <Card key={ms.model} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{ms.model}</CardTitle>
                <span className={`text-lg font-bold ${getScoreColor(weightedAvg, spec.qcConfig!.threshold)}`}>
                  {weightedAvg.toFixed(1)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ms.dimensions.map(d => (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">{d.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-secondary/30 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.score >= spec.qcConfig!.threshold ? "bg-emerald-500" :
                          d.score >= (spec.qcConfig!.singleDimFloor || 5) ? "bg-amber-500" :
                          "bg-red-500"
                        }`}
                        style={{ width: `${d.score * 10}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-10 text-right ${getScoreColor(d.score, spec.qcConfig!.threshold)}`}>
                      {d.score.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-muted-foreground w-8">×{d.weight}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// ── Telemetry Tab ──
function TelemetryTab({ spec, nodeRun, mockNode }: { spec: NodeSpec; nodeRun: NodeRun | null; mockNode: PipelineNode | null }) {
  return (
    <div className="space-y-4 max-w-3xl">
      {/* Real telemetry */}
      {nodeRun && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">真实执行遥测</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <TelemetryRow icon={<Clock className="h-3.5 w-3.5" />} label="执行时长" value={nodeRun.duration_s ? `${nodeRun.duration_s.toFixed(1)}s` : "-"} />
              <TelemetryRow icon={<DollarSign className="h-3.5 w-3.5" />} label="费用" value={`¥${nodeRun.cost_cny.toFixed(3)}`} highlight={nodeRun.cost_cny > 0.5} />
              <TelemetryRow icon={<Hash className="h-3.5 w-3.5" />} label="Token In" value={nodeRun.token_in.toLocaleString()} />
              <TelemetryRow icon={<Hash className="h-3.5 w-3.5" />} label="Token Out" value={nodeRun.token_out.toLocaleString()} />
              <TelemetryRow icon={<Zap className="h-3.5 w-3.5" />} label="API 调用" value={`${nodeRun.api_calls}次`} />
              <TelemetryRow icon={<Cpu className="h-3.5 w-3.5" />} label="GPU 秒" value={`${nodeRun.gpu_seconds}s`} />
              {nodeRun.model_provider && (
                <div className="col-span-2">
                  <TelemetryRow icon={<Cpu className="h-3.5 w-3.5" />} label="模型" value={`${nodeRun.model_provider} / ${nodeRun.model_endpoint ?? ""}`} />
                </div>
              )}
              {nodeRun.quality_score !== null && (
                <TelemetryRow icon={<BarChart3 className="h-3.5 w-3.5" />} label="质量分" value={nodeRun.quality_score.toFixed(2)} />
              )}
              <TelemetryRow icon={<RefreshCw className="h-3.5 w-3.5" />} label="重试/打回" value={`${nodeRun.retry_count} / ${nodeRun.auto_reject_count}`} />
            </div>
            {nodeRun.error_code && (
              <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-400 font-medium">{nodeRun.error_code}</p>
                <p className="text-[10px] text-red-300/80 mt-0.5">{nodeRun.error_message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mock telemetry fallback */}
      {!nodeRun && mockNode && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">模拟遥测数据</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs">
              <TelemetryRow icon={<Clock className="h-3.5 w-3.5" />} label="执行时长" value={mockNode.telemetry.duration} />
              {mockNode.telemetry.model && <TelemetryRow icon={<Cpu className="h-3.5 w-3.5" />} label="模型" value={mockNode.telemetry.model} />}
              {mockNode.telemetry.cost !== undefined && <TelemetryRow icon={<DollarSign className="h-3.5 w-3.5" />} label="费用" value={`$${mockNode.telemetry.cost.toFixed(2)}`} />}
              {mockNode.telemetry.tokens !== undefined && <TelemetryRow icon={<Hash className="h-3.5 w-3.5" />} label="Tokens" value={mockNode.telemetry.tokens.toLocaleString()} />}
              {mockNode.telemetry.apiCalls !== undefined && <TelemetryRow icon={<Zap className="h-3.5 w-3.5" />} label="API调用" value={`${mockNode.telemetry.apiCalls}次`} />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parameters reference */}
      {spec.params.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">运行参数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {spec.params.map(p => (
                <div key={p.key} className="flex items-center justify-between text-xs border-b border-border/20 pb-1.5 last:border-0">
                  <span className="text-muted-foreground">{p.label}</span>
                  <code className="font-mono text-[11px] text-emerald-400">{String(p.defaultValue)}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TelemetryRow({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`font-mono ${highlight ? "text-amber-400" : "text-foreground"}`}>{value}</span>
    </div>
  )
}
