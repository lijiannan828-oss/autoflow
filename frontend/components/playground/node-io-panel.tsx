"use client"

import { cn } from "@/lib/utils"
import { NODE_SPECS, getCategoryColor, getCategoryLabel, type NodeSpec } from "@/lib/node-specs"
import type { PlaygroundNodeData } from "@/app/playground/page"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Play,
  FastForward,
  Check,
  Clock,
  DollarSign,
  Cpu,
  Star,
  Brain,
  ArrowRight,
  FileJson,
  Image,
  Video,
  Music,
  AlertCircle,
  User,
  RefreshCw,
} from "lucide-react"

interface NodeIOPanelProps {
  nodeId: string | null
  nodeData: PlaygroundNodeData | null
  nodeSpec: NodeSpec | null | undefined
  onRunNode: (nodeId: string) => void
  onRunFromNode: (nodeId: string) => void
  onApproveGate: (nodeId: string) => void
}

export function NodeIOPanel({
  nodeId,
  nodeData,
  nodeSpec,
  onRunNode,
  onRunFromNode,
  onApproveGate,
}: NodeIOPanelProps) {
  if (!nodeId || !nodeSpec) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">选择一个节点查看详情</p>
        </div>
      </div>
    )
  }

  const isRunning = nodeData?.status === "running"
  const isCompleted = nodeData?.status === "completed"
  const isGateWaiting = nodeData?.status === "gate_waiting"
  const isIdle = nodeData?.status === "idle"

  return (
    <div className="h-full flex flex-col">
      {/* Node header */}
      <div className="shrink-0 border-b border-border pb-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-mono text-muted-foreground">{nodeId}</span>
              <h2 className="text-xl font-semibold text-foreground">{nodeSpec.name}</h2>
              <Badge variant="outline" className={cn("text-[10px]", getCategoryColor(nodeSpec.category))}>
                {getCategoryLabel(nodeSpec.category)}
              </Badge>
              {nodeSpec.isGate && (
                <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/30">
                  <User className="w-3 h-3 mr-1" />
                  人工审核
                </Badge>
              )}
              {nodeSpec.isQC && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                  质检节点
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">{nodeSpec.description}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Agent: <span className="text-foreground">{nodeSpec.agentRole.replace(/_/g, " ")}</span>
              </span>
              {nodeSpec.model && (
                <span>
                  Model: <span className="text-foreground">{nodeSpec.model}</span>
                </span>
              )}
              <span>
                Stage: <span className="text-foreground">{nodeSpec.stage}</span>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isGateWaiting ? (
              <Button onClick={() => onApproveGate(nodeId)} className="gap-2">
                <Check className="w-4 h-4" />
                审核通过
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onRunNode(nodeId)}
                  disabled={isRunning}
                  className="gap-2"
                >
                  {isRunning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  单独运行
                </Button>
                <Button onClick={() => onRunFromNode(nodeId)} disabled={isRunning} className="gap-2">
                  <FastForward className="w-4 h-4" />
                  从此开始
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Metrics bar */}
        {(isRunning || isCompleted || isGateWaiting) && nodeData && (
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
            <MetricItem
              icon={Clock}
              label="执行时长"
              value={nodeData.durationMs ? `${(nodeData.durationMs / 1000).toFixed(1)}s` : "..."}
              loading={isRunning}
            />
            <MetricItem
              icon={DollarSign}
              label="费用"
              value={nodeData.costCny != null ? `¥${nodeData.costCny.toFixed(2)}` : "..."}
              loading={isRunning}
            />
            <MetricItem
              icon={Cpu}
              label="模型"
              value={nodeData.model || nodeSpec.model || "N/A"}
            />
            {nodeSpec.isQC && (
              <MetricItem
                icon={Star}
                label="质检分数"
                value={nodeData.qualityScore != null ? nodeData.qualityScore.toFixed(2) : "..."}
                loading={isRunning}
                valueColor={
                  nodeData.qualityScore != null
                    ? nodeData.qualityScore >= 9
                      ? "text-emerald-400"
                      : nodeData.qualityScore >= 8
                        ? "text-foreground"
                        : "text-amber-400"
                    : undefined
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Tabs content */}
      <Tabs defaultValue="thinking" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="thinking">
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            Agent 思考
          </TabsTrigger>
          <TabsTrigger value="input">
            <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
            输入
          </TabsTrigger>
          <TabsTrigger value="output">
            <ArrowRight className="w-3.5 h-3.5 mr-1.5 rotate-180" />
            输出
          </TabsTrigger>
          <TabsTrigger value="config">
            <Cpu className="w-3.5 h-3.5 mr-1.5" />
            配置
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 mt-4">
          <TabsContent value="thinking" className="h-full m-0">
            <ThinkingPanel nodeData={nodeData} nodeSpec={nodeSpec} />
          </TabsContent>
          <TabsContent value="input" className="h-full m-0">
            <IOPanel type="input" data={nodeData?.input} nodeSpec={nodeSpec} />
          </TabsContent>
          <TabsContent value="output" className="h-full m-0">
            <IOPanel type="output" data={nodeData?.output} nodeSpec={nodeSpec} />
          </TabsContent>
          <TabsContent value="config" className="h-full m-0">
            <ConfigPanel nodeSpec={nodeSpec} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function MetricItem({
  icon: Icon,
  label,
  value,
  loading,
  valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  loading?: boolean
  valueColor?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-4 w-12" />
        ) : (
          <p className={cn("text-sm font-medium", valueColor || "text-foreground")}>{value}</p>
        )}
      </div>
    </div>
  )
}

function ThinkingPanel({
  nodeData,
  nodeSpec,
}: {
  nodeData: PlaygroundNodeData | null
  nodeSpec: NodeSpec
}) {
  const isRunning = nodeData?.status === "running"

  if (!nodeData?.thinking && nodeData?.status === "idle") {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">运行节点后查看 Agent 思考过程</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-4">
        {/* System prompt */}
        {nodeSpec.systemPrompt && (
          <div className="bg-secondary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">System Prompt</span>
            </div>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {nodeSpec.systemPrompt.slice(0, 500)}
              {nodeSpec.systemPrompt.length > 500 && "..."}
            </pre>
          </div>
        )}

        {/* Thinking process */}
        {nodeData?.thinking && (
          <div className="bg-secondary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center",
                isRunning ? "bg-blue-500/20" : "bg-emerald-500/20"
              )}>
                <Brain className={cn(
                  "w-3.5 h-3.5",
                  isRunning ? "text-blue-400 animate-pulse" : "text-emerald-400"
                )} />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {isRunning ? "思考中..." : "推理过程"}
              </span>
            </div>
            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {nodeData.thinking}
            </pre>
          </div>
        )}

        {/* Decision summary */}
        {nodeData?.status === "completed" && nodeData.output && (
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">决策完成</span>
            </div>
            <p className="text-xs text-foreground">
              {nodeSpec.model && `使用模型: ${nodeSpec.model}`}
              {nodeData.qualityScore && ` · 质量评分: ${nodeData.qualityScore.toFixed(2)}`}
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function IOPanel({
  type,
  data,
  nodeSpec,
}: {
  type: "input" | "output"
  data?: Record<string, unknown>
  nodeSpec: NodeSpec
}) {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileJson className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {type === "input" ? "运行节点后查看输入数据" : "运行节点后查看输出数据"}
          </p>
        </div>
      </div>
    )
  }

  // Determine output type icons based on node category
  const getOutputTypeIcon = () => {
    if (nodeSpec.category === "comfyui") return <Image className="w-4 h-4 text-cyan-400" />
    if (nodeSpec.category === "audio") return <Music className="w-4 h-4 text-pink-400" />
    if (nodeSpec.category === "ffmpeg") return <Video className="w-4 h-4 text-sky-400" />
    return <FileJson className="w-4 h-4 text-amber-400" />
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-4">
        {/* Output type indicator */}
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-lg">
          {getOutputTypeIcon()}
          <span className="text-xs text-muted-foreground">
            {type === "input" ? "来自上游节点" : nodeSpec.outputScope === "episode" ? "集级输出" : nodeSpec.outputScope === "per_shot" ? "镜头级输出" : "资产级输出"}
          </span>
        </div>

        {/* JSON data display */}
        <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
          <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>

        {/* Visual preview placeholders for media outputs */}
        {type === "output" && nodeSpec.category === "comfyui" && (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-video bg-secondary/30 rounded-lg flex items-center justify-center border border-border"
              >
                <div className="text-center">
                  <Image className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">候选 {i}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function ConfigPanel({ nodeSpec }: { nodeSpec: NodeSpec }) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 pr-4">
        {/* Parameters */}
        {nodeSpec.params.length > 0 && (
          <div className="bg-secondary/20 rounded-lg p-4">
            <h4 className="text-xs font-medium text-foreground mb-3">参数配置</h4>
            <div className="space-y-3">
              {nodeSpec.params.map((param) => (
                <div key={param.key} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{param.label}</p>
                    <p className="text-[10px] text-muted-foreground">{param.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-foreground">
                      {String(param.defaultValue)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{param.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QC Config */}
        {nodeSpec.qcConfig && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-4">
            <h4 className="text-xs font-medium text-amber-400 mb-3">质检配置</h4>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">投票模型</p>
                <div className="flex flex-wrap gap-1">
                  {nodeSpec.qcConfig.votingModels.map((model) => (
                    <Badge key={model} variant="secondary" className="text-[9px]">
                      {model}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">
                  通过阈值: <span className="text-foreground">{nodeSpec.qcConfig.threshold}</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">评分维度</p>
                <div className="grid grid-cols-2 gap-2">
                  {nodeSpec.qcConfig.dimensions.map((dim) => (
                    <div key={dim.name} className="flex items-center justify-between text-[10px]">
                      <span className="text-foreground">{dim.label}</span>
                      <span className="text-muted-foreground">{(dim.weight * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dependencies */}
        <div className="bg-secondary/20 rounded-lg p-4">
          <h4 className="text-xs font-medium text-foreground mb-3">依赖关系</h4>
          <div className="flex flex-wrap gap-2">
            {nodeSpec.dependsOn.length > 0 ? (
              nodeSpec.dependsOn.map((dep) => (
                <Badge key={dep} variant="outline" className="text-[10px]">
                  {dep}
                </Badge>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground">无上游依赖（入口节点）</span>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
