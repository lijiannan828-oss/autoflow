"use client"

import { Clock, Cpu, DollarSign, Zap, Hash, RefreshCw, Play, Pause, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PipelineNode } from "@/lib/drama-detail-types"

interface NodeTelemetryPanelProps {
  node: PipelineNode | null
  onRetry?: () => void
  onPause?: () => void
  onResume?: () => void
}

export function NodeTelemetryPanel({
  node,
  onRetry,
  onPause,
  onResume,
}: NodeTelemetryPanelProps) {
  if (!node) {
    return (
      <div className="w-64 shrink-0 border-l border-border/50 bg-[#0a0a0a] p-4">
        <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-4">
          节点遥测
        </h3>
        <p className="text-xs text-muted-foreground">选择节点查看详情</p>
      </div>
    )
  }

  const telemetry = node.telemetry

  return (
    <div className="w-64 shrink-0 border-l border-border/50 bg-[#0a0a0a] p-4 overflow-y-auto">
      <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-4">
        节点遥测
      </h3>

      {/* Telemetry metrics */}
      <div className="space-y-3">
        {/* Duration */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">执行时长</span>
          </div>
          <span className={`text-xs font-mono ${
            node.status === "running" ? "text-blue-400" : "text-foreground"
          }`}>
            {telemetry.duration}
          </span>
        </div>

        {/* Model */}
        {telemetry.model && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Cpu className="h-3.5 w-3.5" />
              <span className="text-xs">模型</span>
            </div>
            <span className="text-xs font-medium text-foreground">
              {telemetry.model}
            </span>
          </div>
        )}

        {/* Cost */}
        {telemetry.cost !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-xs">费用</span>
            </div>
            <span className={`text-xs font-mono ${
              telemetry.cost > 1 ? "text-amber-400" : "text-foreground"
            }`}>
              ${telemetry.cost.toFixed(2)}
            </span>
          </div>
        )}

        {/* Tokens */}
        {telemetry.tokens !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              <span className="text-xs">Tokens</span>
            </div>
            <span className="text-xs font-mono text-foreground">
              {telemetry.tokens.toLocaleString()}
            </span>
          </div>
        )}

        {/* API Calls */}
        {telemetry.apiCalls !== undefined && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs">API调用</span>
            </div>
            <span className="text-xs font-mono text-foreground">
              {telemetry.apiCalls}次
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-4 h-px bg-border/30" />

      {/* Node status indicator */}
      <div className="mb-4">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          状态
        </span>
        <div className="mt-2">
          {node.status === "completed" && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-400">已完成</span>
            </div>
          )}
          {node.status === "running" && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-blue-500/10 border border-blue-500/30">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-blue-400">运行中</span>
            </div>
          )}
          {node.status === "failed" && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/30">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-red-400">失败</span>
            </div>
          )}
          {node.status === "pending" && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-secondary/30 border border-border/50">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
              <span className="text-xs text-muted-foreground">等待中</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          操作
        </span>
        
        <div className="mt-2 space-y-2">
          {node.status === "failed" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={onRetry}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重试节点
            </Button>
          )}
          
          {node.status === "running" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs gap-1.5"
              onClick={onPause}
            >
              <Pause className="h-3.5 w-3.5" />
              暂停
            </Button>
          )}

          {node.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs gap-1.5"
              onClick={onResume}
            >
              <Play className="h-3.5 w-3.5" />
              手动触发
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="w-full h-8 text-xs gap-1.5 text-muted-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新数据
          </Button>
        </div>
      </div>

      {/* Human node indicator */}
      {node.isHumanNode && (
        <>
          <div className="my-4 h-px bg-border/30" />
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mb-1">
              人工节点
            </p>
            <p className="text-xs text-amber-300/80">
              此节点需要人工审核和干预，系统将等待人类操作完成后继续流水线。
            </p>
          </div>
        </>
      )}
    </div>
  )
}
