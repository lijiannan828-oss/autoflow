"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Terminal, Play, Loader2, ChevronDown, ChevronUp } from "lucide-react"

const QUICK_SCENES = [
  { id: "palace_night", label: "宫殿夜宴", description: "古装宫廷 · 夜景 · 5角色", node: "N14" },
  { id: "garden_talk", label: "花园密谈", description: "古装花园 · 日景 · 2角色", node: "N14" },
  { id: "modern_office", label: "现代办公室", description: "都市 · 室内 · 3角色", node: "N14" },
  { id: "chase_scene", label: "追逐戏", description: "动作 · 外景 · 快节奏", node: "N14" },
]

export default function DebugPage() {
  const [selectedNode, setSelectedNode] = useState("N14")
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [promptText, setPromptText] = useState("")

  const handleRunNode = async (nodeId: string) => {
    setRunning(true)
    setOutput(null)
    try {
      const res = await fetch("/api/orchestrator/debug/run-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, input: { prompt: promptText || undefined } }),
      })
      const data = await res.json()
      setOutput(JSON.stringify(data, null, 2))
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-foreground">调试台</h1>
          <span className="text-xs text-muted-foreground">· 单节点运行 / Prompt Playground</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        {/* Quick scene templates */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2.5">快速场景模板</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {QUICK_SCENES.map(scene => (
              <button
                key={scene.id}
                onClick={() => { setSelectedNode(scene.node); setPromptText(`[${scene.label}] 场景模板测试`) }}
                className="bg-secondary/20 border border-border/30 rounded-lg p-3 text-left hover:bg-secondary/40 transition-colors"
              >
                <p className="text-xs font-medium text-foreground">{scene.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{scene.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">{scene.node}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Node selector + run */}
        <div className="bg-secondary/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">目标节点:</label>
            <select
              value={selectedNode}
              onChange={e => setSelectedNode(e.target.value)}
              className="bg-secondary/50 border border-border/30 rounded px-2 py-1 text-xs text-foreground"
            >
              {["N01","N02","N03","N04","N05","N06","N07","N07b","N08","N09","N10","N11","N12","N13","N14","N15","N16","N16b","N17","N18","N19","N20","N21","N22","N23","N24","N25","N26"].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              onClick={() => handleRunNode(selectedNode)}
              disabled={running}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                running ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {running ? "运行中..." : "运行节点"}
            </button>
          </div>

          {/* Prompt input */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Prompt / 输入覆写 (可选):</label>
            <textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder="输入自定义 prompt 或留空使用默认..."
              className="w-full h-24 bg-secondary/30 border border-border/30 rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* Output */}
        {output && (
          <div className="bg-secondary/20 rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">输出结果</p>
            <pre className="text-xs text-foreground/80 font-mono whitespace-pre-wrap overflow-auto max-h-[400px] bg-black/20 rounded p-3">
              {output}
            </pre>
          </div>
        )}

        {/* Placeholder for future features */}
        <div className="text-xs text-muted-foreground italic space-y-1">
          <p>链式运行 (run-chain) 和 对比模式将在后续版本中添加</p>
          <p>Prompt Playground (独立于节点的纯 LLM 调用) 将在后端接通后可用</p>
        </div>
      </div>
    </div>
  )
}
