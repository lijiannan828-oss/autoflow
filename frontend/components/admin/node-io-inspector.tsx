"use client"

import { useState } from "react"
import { ChevronDown, FileText, FileJson, Image, Video, Music, Layers, AlertCircle, Loader2 } from "lucide-react"
import type { PipelineNode, NodeIO, IOItem } from "@/lib/drama-detail-types"

interface NodeIOInspectorProps {
  node: PipelineNode | null
}

export function NodeIOInspector({ node }: NodeIOInspectorProps) {
  const [inputExpanded, setInputExpanded] = useState(true)
  const [outputExpanded, setOutputExpanded] = useState(true)

  if (!node) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d0d0d]">
        <div className="text-center text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">选择左侧节点查看详情</p>
        </div>
      </div>
    )
  }

  const getTypeIcon = (type: NodeIO["type"]) => {
    switch (type) {
      case "text": return <FileText className="h-3.5 w-3.5" />
      case "json": return <FileJson className="h-3.5 w-3.5" />
      case "image": return <Image className="h-3.5 w-3.5" />
      case "video": return <Video className="h-3.5 w-3.5" />
      case "audio": return <Music className="h-3.5 w-3.5" />
      case "mixed": return <Layers className="h-3.5 w-3.5" />
      default: return <FileText className="h-3.5 w-3.5" />
    }
  }

  const renderIOContent = (io: NodeIO) => {
    if (io.content === null && !io.items?.length) {
      return <p className="text-xs text-muted-foreground italic">暂无数据</p>
    }

    if (io.type === "text" && typeof io.content === "string") {
      return (
        <div className="bg-secondary/30 rounded-md p-3 text-xs text-foreground/90 whitespace-pre-wrap max-h-48 overflow-y-auto">
          {io.content}
        </div>
      )
    }

    if (io.type === "json" && io.content) {
      return (
        <pre className="bg-secondary/30 rounded-md p-3 text-xs text-emerald-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">
          {JSON.stringify(io.content, null, 2)}
        </pre>
      )
    }

    if (io.items && io.items.length > 0) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {io.items.map((item) => (
            <IOItemCard key={item.id} item={item} />
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0d0d0d] p-4">
      {/* Node header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground">节点 {node.nodeNumber}</span>
          {node.isHumanNode && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
              人工节点
            </span>
          )}
          {node.status === "running" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              运行中
            </span>
          )}
          {node.status === "failed" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 flex items-center gap-1">
              <AlertCircle className="h-2.5 w-2.5" />
              失败
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold text-foreground">{node.name}</h2>
      </div>

      {/* Error message if failed */}
      {node.status === "failed" && node.telemetry.errorMessage && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-400">错误信息</p>
              <p className="text-xs text-red-300/80 mt-1">{node.telemetry.errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input section */}
      <div className="mb-4">
        <button
          onClick={() => setInputExpanded(!inputExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            {getTypeIcon(node.input.type)}
            <span className="text-xs font-medium text-foreground">输入 (Input)</span>
            <span className="text-[10px] text-muted-foreground">{node.input.label}</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${inputExpanded ? "" : "-rotate-90"}`} />
        </button>
        {inputExpanded && (
          <div className="mt-2 pl-2">
            {renderIOContent(node.input)}
          </div>
        )}
      </div>

      {/* Output section */}
      <div>
        <button
          onClick={() => setOutputExpanded(!outputExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            {getTypeIcon(node.output.type)}
            <span className="text-xs font-medium text-foreground">输出 (Output)</span>
            <span className="text-[10px] text-muted-foreground">{node.output.label}</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${outputExpanded ? "" : "-rotate-90"}`} />
        </button>
        {outputExpanded && (
          <div className="mt-2 pl-2">
            {renderIOContent(node.output)}
          </div>
        )}
      </div>
    </div>
  )
}

// IO Item Card component
function IOItemCard({ item }: { item: IOItem }) {
  const getBgColor = () => {
    if (item.preview && item.preview.startsWith("#")) {
      return item.preview
    }
    switch (item.type) {
      case "image": return "#3d5a6b"
      case "video": return "#4a3d6b"
      case "audio": return "#6b5a3d"
      default: return "#3d3d3d"
    }
  }

  const getIcon = () => {
    switch (item.type) {
      case "image": return <Image className="h-6 w-6 text-white/60" />
      case "video": return <Video className="h-6 w-6 text-white/60" />
      case "audio": return <Music className="h-6 w-6 text-white/60" />
      case "json": return <FileJson className="h-6 w-6 text-white/60" />
      default: return <FileText className="h-6 w-6 text-white/60" />
    }
  }

  return (
    <div className="group relative rounded-lg overflow-hidden border border-border/50 hover:border-border transition-colors cursor-pointer">
      {/* Thumbnail */}
      <div 
        className="aspect-square flex items-center justify-center"
        style={{ backgroundColor: getBgColor() }}
      >
        {getIcon()}
      </div>
      {/* Label */}
      <div className="p-1.5 bg-background/80">
        <p className="text-[10px] text-foreground truncate">{item.label}</p>
      </div>
    </div>
  )
}
