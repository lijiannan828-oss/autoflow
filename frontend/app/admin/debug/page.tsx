"use client"

import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Play, Copy, ChevronDown, ChevronRight, Loader2, RotateCcw,
  Terminal, Settings2, Zap, AlertCircle, Check, Search,
} from "lucide-react"

import { AdminNavSidebar } from "@/components/admin/admin-nav-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { NODE_SPECS, getCategoryLabel, getCategoryColor, STAGE_GROUPS, STAGE_NAMES } from "@/lib/node-specs"
import type { NodeSpec, NodeParam } from "@/lib/node-specs"

// ── Types ──
interface NodeDebugState {
  params: Record<string, number | string | boolean>
  systemPrompt: string
  userPrompt: string
  isRunning: boolean
  response: string | null
  error: string | null
  elapsed: number | null
}

function buildInitialState(spec: NodeSpec): NodeDebugState {
  const params: Record<string, number | string | boolean> = {}
  for (const p of spec.params) {
    params[p.key] = p.defaultValue
  }
  return {
    params,
    systemPrompt: spec.systemPrompt ?? "",
    userPrompt: spec.userPromptTemplate ?? "",
    isRunning: false,
    response: null,
    error: null,
    elapsed: null,
  }
}

export default function DebugPlaygroundPage() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [nodeStates, setNodeStates] = useState<Record<string, NodeDebugState>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")

  const getOrInit = useCallback((spec: NodeSpec): NodeDebugState => {
    if (nodeStates[spec.id]) return nodeStates[spec.id]
    return buildInitialState(spec)
  }, [nodeStates])

  const updateNodeState = useCallback((nodeId: string, updates: Partial<NodeDebugState>) => {
    setNodeStates(prev => ({
      ...prev,
      [nodeId]: { ...getOrInit(NODE_SPECS.find(n => n.id === nodeId)!), ...prev[nodeId], ...updates },
    }))
  }, [getOrInit])

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
    // Initialize state if needed
    const spec = NODE_SPECS.find(n => n.id === nodeId)
    if (spec && !nodeStates[nodeId]) {
      setNodeStates(prev => ({ ...prev, [nodeId]: buildInitialState(spec) }))
    }
  }

  const expandAll = () => setExpandedNodes(new Set(NODE_SPECS.map(n => n.id)))
  const collapseAll = () => setExpandedNodes(new Set())

  const handleRun = useCallback(async (spec: NodeSpec) => {
    const state = getOrInit(spec)
    updateNodeState(spec.id, { isRunning: true, response: null, error: null, elapsed: null })

    const start = Date.now()

    try {
      // Call backend debug endpoint
      const res = await fetch("/api/orchestrator/debug/run-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: spec.id,
          system_prompt: state.systemPrompt,
          user_prompt: state.userPrompt,
          params: state.params,
        }),
      })
      const elapsed = (Date.now() - start) / 1000
      const data = await res.json()

      if (res.ok) {
        updateNodeState(spec.id, {
          isRunning: false,
          response: JSON.stringify(data, null, 2),
          elapsed,
        })
        toast.success(`${spec.id} 执行完成 (${elapsed.toFixed(1)}s)`)
      } else {
        updateNodeState(spec.id, {
          isRunning: false,
          error: data.error || `HTTP ${res.status}`,
          elapsed,
        })
        toast.error(`${spec.id} 执行失败`)
      }
    } catch (err) {
      const elapsed = (Date.now() - start) / 1000
      updateNodeState(spec.id, {
        isRunning: false,
        error: err instanceof Error ? err.message : "网络错误",
        elapsed,
      })
      toast.error(`${spec.id} 执行异常`)
    }
  }, [getOrInit, updateNodeState])

  const handleReset = useCallback((spec: NodeSpec) => {
    setNodeStates(prev => ({ ...prev, [spec.id]: buildInitialState(spec) }))
    toast.success(`${spec.id} 已重置为默认值`)
  }, [])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("已复制")
  }, [])

  // Filter nodes
  const filteredSpecs = NODE_SPECS.filter(spec => {
    if (filterCategory !== "all" && spec.category !== filterCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return spec.id.toLowerCase().includes(q) || spec.name.includes(searchQuery) || spec.description.includes(searchQuery)
    }
    return true
  })

  // Group by stage
  const groupedSpecs = [1, 2, 3, 4].map(stage => ({
    stage,
    name: STAGE_NAMES[stage],
    nodes: filteredSpecs.filter(s => s.stage === stage),
  })).filter(g => g.nodes.length > 0)

  return (
    <div className="flex h-screen bg-background">
      <AdminNavSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── Header ── */}
        <header className="shrink-0 border-b border-border/50 bg-background px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="h-5 w-5 text-emerald-500" />
              <h1 className="text-lg font-semibold">节点调试面板</h1>
              <Badge variant="outline" className="text-[10px]">26 节点</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={expandAll}>全部展开</Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={collapseAll}>全部折叠</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            修改提示词和参数 → 单独执行节点 → 查看输出 → 迭代调优。所有节点平铺展示，不自动运行。
          </p>

          {/* Search & Filter */}
          <div className="flex items-center gap-3 mt-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索节点 ID、名称或描述..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border/50 bg-secondary/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {["all", "llm", "qc", "comfyui", "freeze", "gate", "audio", "ffmpeg", "logic"].map(cat => (
                <button key={cat} onClick={() => setFilterCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors
                    ${filterCategory === cat
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
                  {cat === "all" ? "全部" : getCategoryLabel(cat as NodeSpec["category"])}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ── Node list ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {groupedSpecs.map(group => (
            <div key={group.stage}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-foreground">Stage {group.stage}: {group.name}</h2>
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[10px] text-muted-foreground">{group.nodes.length} 个节点</span>
              </div>

              <div className="space-y-2">
                {group.nodes.map(spec => {
                  const isExpanded = expandedNodes.has(spec.id)
                  const state = nodeStates[spec.id]

                  return (
                    <div key={spec.id} className="border border-border/50 rounded-lg overflow-hidden bg-[#0d0d0d]">
                      {/* Node header row */}
                      <button onClick={() => toggleNode(spec.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="text-sm font-mono font-bold text-foreground w-10 shrink-0">{spec.id}</span>
                        <span className="text-sm text-foreground">{spec.name}</span>
                        <Badge variant="outline" className={`text-[9px] shrink-0 ${getCategoryColor(spec.category)}`}>
                          {getCategoryLabel(spec.category)}
                        </Badge>
                        {spec.model && (
                          <span className="text-[10px] text-muted-foreground shrink-0">{spec.model}</span>
                        )}
                        <span className="flex-1" />
                        {state?.isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
                        {state?.response && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        {state?.error && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="border-t border-border/30 px-4 py-4">
                          <p className="text-xs text-muted-foreground mb-4">{spec.description}</p>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left column: Prompts */}
                            <div className="space-y-4">
                              {/* System Prompt */}
                              {(spec.systemPrompt !== null) && (
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-violet-400">System Prompt</label>
                                    <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1 px-1.5"
                                      onClick={() => copyToClipboard(state?.systemPrompt || spec.systemPrompt || "")}>
                                      <Copy className="h-2.5 w-2.5" /> 复制
                                    </Button>
                                  </div>
                                  <textarea
                                    className="w-full h-40 p-3 text-xs font-mono rounded-md border border-violet-500/20 bg-violet-500/5 text-foreground/90 resize-y focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                                    value={state?.systemPrompt ?? spec.systemPrompt ?? ""}
                                    onChange={e => updateNodeState(spec.id, { systemPrompt: e.target.value })}
                                  />
                                </div>
                              )}

                              {/* User Prompt */}
                              {(spec.userPromptTemplate !== null) && (
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-sky-400">User Prompt</label>
                                    <div className="flex gap-1">
                                      {(spec.userPromptTemplate?.match(/\{\{(\w+)\}\}/g) || []).map((v, i) => (
                                        <code key={i} className="text-[9px] px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                          {v}
                                        </code>
                                      ))}
                                    </div>
                                  </div>
                                  <textarea
                                    className="w-full h-40 p-3 text-xs font-mono rounded-md border border-sky-500/20 bg-sky-500/5 text-foreground/90 resize-y focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                                    value={state?.userPrompt ?? spec.userPromptTemplate ?? ""}
                                    onChange={e => updateNodeState(spec.id, { userPrompt: e.target.value })}
                                    placeholder="将模板变量 {{xxx}} 替换为实际值后运行"
                                  />
                                </div>
                              )}

                              {/* For non-prompt nodes, show description */}
                              {spec.systemPrompt === null && spec.userPromptTemplate === null && (
                                <div className="p-4 rounded-md border border-border/50 bg-secondary/10">
                                  <p className="text-xs text-muted-foreground">
                                    此节点不使用 LLM 提示词（类型：{getCategoryLabel(spec.category)}）。
                                    {spec.isGate && " 这是一个人工审核 Gate 节点，需要人工操作。"}
                                    {spec.category === "comfyui" && " 通过 ComfyUI workflow JSON 驱动图像/视频生成。"}
                                    {spec.category === "freeze" && " 读取上游产物 → 固化到 TOS。"}
                                    {spec.category === "ffmpeg" && " 通过 FFmpeg 命令行进行视频处理。"}
                                    {spec.category === "audio" && " 通过 kie.ai API 代理调用音频服务。"}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Right column: Parameters + Output */}
                            <div className="space-y-4">
                              {/* Parameters */}
                              {spec.params.length > 0 && (
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    <label className="text-xs font-medium">参数配置</label>
                                  </div>
                                  <div className="space-y-2 p-3 rounded-md border border-border/50 bg-secondary/10">
                                    {spec.params.map(p => (
                                      <ParamInput key={p.key} param={p}
                                        value={state?.params[p.key] ?? p.defaultValue}
                                        onChange={(v) => {
                                          const currentState = nodeStates[spec.id] || buildInitialState(spec)
                                          updateNodeState(spec.id, {
                                            params: { ...currentState.params, [p.key]: v },
                                          })
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* QC Config */}
                              {spec.qcConfig && (
                                <div>
                                  <label className="text-xs font-medium text-amber-400 mb-2 block">质检配置</label>
                                  <div className="p-3 rounded-md border border-amber-500/20 bg-amber-500/5 space-y-2 text-xs">
                                    <div>
                                      <span className="text-muted-foreground">投票模型:</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {spec.qcConfig.votingModels.map(m => (
                                          <code key={m} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px]">{m}</code>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex gap-4">
                                      <span><span className="text-muted-foreground">阈值:</span> <span className="font-bold">{spec.qcConfig.threshold}</span></span>
                                      {spec.qcConfig.singleDimFloor && (
                                        <span><span className="text-muted-foreground">单维下限:</span> <span className="font-bold text-red-400">{spec.qcConfig.singleDimFloor}</span></span>
                                      )}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">评分维度:</span>
                                      <div className="mt-1 space-y-0.5">
                                        {spec.qcConfig.dimensions.map(d => (
                                          <div key={d.name} className="flex items-center justify-between">
                                            <span>{d.label}</span>
                                            <span className="text-muted-foreground">×{d.weight}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  disabled={state?.isRunning}
                                  onClick={() => handleRun(spec)}>
                                  {state?.isRunning ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 运行中...</>
                                  ) : (
                                    <><Play className="h-3.5 w-3.5" /> 运行节点</>
                                  )}
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleReset(spec)}>
                                  <RotateCcw className="h-3.5 w-3.5" /> 重置
                                </Button>
                                {state?.elapsed !== null && (
                                  <span className="text-[10px] text-muted-foreground">
                                    耗时 {state.elapsed.toFixed(1)}s
                                  </span>
                                )}
                              </div>

                              {/* Output */}
                              {state?.response && (
                                <div>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-emerald-400">输出结果</label>
                                    <Button variant="ghost" size="sm" className="h-5 text-[9px] gap-1 px-1.5"
                                      onClick={() => copyToClipboard(state.response!)}>
                                      <Copy className="h-2.5 w-2.5" /> 复制
                                    </Button>
                                  </div>
                                  <pre className="p-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-xs font-mono text-emerald-300 max-h-64 overflow-auto whitespace-pre-wrap">
                                    {state.response}
                                  </pre>
                                </div>
                              )}

                              {state?.error && (
                                <div className="p-3 rounded-md border border-red-500/30 bg-red-500/10">
                                  <div className="flex items-center gap-2 mb-1">
                                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                                    <span className="text-xs font-medium text-red-400">执行错误</span>
                                  </div>
                                  <p className="text-xs text-red-300/80">{state.error}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Parameter Input Component ──
function ParamInput({ param, value, onChange }: { param: NodeParam; value: number | string | boolean; onChange: (v: number | string | boolean) => void }) {
  if (param.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium">{param.label}</span>
          <span className="text-[10px] text-muted-foreground ml-2">{param.description}</span>
        </div>
        <button
          onClick={() => onChange(!value)}
          className={`w-9 h-5 rounded-full transition-colors relative ${value ? "bg-emerald-500" : "bg-secondary/50"}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>
    )
  }

  if (param.type === "select") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium">{param.label}</span>
          <span className="text-[10px] text-muted-foreground ml-2">{param.description}</span>
        </div>
        <select
          className="h-7 px-2 text-[11px] rounded border border-border/50 bg-secondary/30 text-foreground"
          value={String(value)}
          onChange={e => onChange(e.target.value)}>
          {param.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (param.type === "number") {
    return (
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium">{param.label}</span>
          <span className="text-[10px] text-muted-foreground ml-2">{param.description}</span>
        </div>
        <input
          type="number"
          className="w-24 h-7 px-2 text-[11px] text-right rounded border border-border/50 bg-secondary/30 text-foreground font-mono"
          value={Number(value)}
          step={param.key === "temperature" ? 0.1 : 1}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
        />
      </div>
    )
  }

  // string
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs font-medium">{param.label}</span>
        <span className="text-[10px] text-muted-foreground ml-2">{param.description}</span>
      </div>
      <input
        type="text"
        className="w-40 h-7 px-2 text-[11px] rounded border border-border/50 bg-secondary/30 text-foreground font-mono"
        value={String(value)}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
