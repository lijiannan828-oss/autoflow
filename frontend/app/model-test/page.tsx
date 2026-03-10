"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ALL_MODELS, MODEL_CATEGORIES, getModelById, type ModelSpec, type ParamSpec } from "@/lib/model-specs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Plus,
  X,
  Play,
  Square,
  Copy,
  Clock,
  DollarSign,
  Cpu,
  Image,
  Video,
  Music,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react"

// ============ 类型定义 ============

interface ModelTestConfig {
  id: string
  modelId: string
  params: Record<string, unknown>
}

interface SingleResult {
  index: number
  status: "pending" | "running" | "completed" | "error"
  output?: string | Record<string, unknown>
  duration?: number
  cost?: number
  error?: string
  seed?: number
}

interface ModelTestResult {
  modelConfigId: string
  results: SingleResult[]
  status: "idle" | "running" | "completed" | "error"
  startTime?: number
  endTime?: number
}

interface TestWindow {
  id: string
  name: string
  models: ModelTestConfig[]
  drawCount: number
  modelResults: Record<string, ModelTestResult>
  globalStatus: "idle" | "running" | "completed"
}

// ============ 工具函数 ============

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getDefaultParams(model: ModelSpec): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  model.params.forEach((p) => {
    if (p.default !== undefined) {
      params[p.key] = p.default
    } else if (p.type === "number") {
      params[p.key] = p.min ?? 0
    } else {
      params[p.key] = ""
    }
  })
  return params
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "llm": return MessageSquare
    case "image": return Image
    case "video": return Video
    case "audio": return Music
    default: return Cpu
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case "llm": return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    case "image": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    case "video": return "bg-purple-500/20 text-purple-400 border-purple-500/30"
    case "audio": return "bg-amber-500/20 text-amber-400 border-amber-500/30"
    default: return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${m}m ${rs.toFixed(0)}s`
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `¥${(cost * 100).toFixed(2)}分`
  return `¥${cost.toFixed(3)}`
}

function generateMockTextOutput(): string {
  const responses = [
    "这是一段模拟的 LLM 输出文本。在实际应用中，这里会显示模型生成的内容。",
    "根据您的输入，模型生成了以下回复：这是一个测试响应，用于验证接口的正确性。",
    "模型已成功处理您的请求。输出内容已按照指定的参数生成。",
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

// ============ 主组件 ============

export default function ModelTestPage() {
  const [windows, setWindows] = useState<TestWindow[]>([])
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const activeWindow = windows.find(w => w.id === activeWindowId)

  // 添加新窗口
  const addWindow = useCallback((modelId?: string) => {
    const model = modelId ? getModelById(modelId) : ALL_MODELS[0]
    if (!model) return

    const newWindow: TestWindow = {
      id: generateId(),
      name: `测试 ${windows.length + 1}`,
      models: [{
        id: generateId(),
        modelId: model.id,
        params: getDefaultParams(model),
      }],
      drawCount: 1,
      modelResults: {},
      globalStatus: "idle",
    }
    setWindows(prev => [...prev, newWindow])
    setActiveWindowId(newWindow.id)
  }, [windows.length])

  // 删除窗口
  const removeWindow = useCallback((windowId: string) => {
    setWindows(prev => {
      const newWindows = prev.filter(w => w.id !== windowId)
      if (activeWindowId === windowId) {
        setActiveWindowId(newWindows.length > 0 ? newWindows[0].id : null)
      }
      return newWindows
    })
  }, [activeWindowId])

  // 更新窗口
  const updateWindow = useCallback((windowId: string, updates: Partial<TestWindow>) => {
    setWindows(prev => prev.map(w => w.id === windowId ? { ...w, ...updates } : w))
  }, [])

  // 添加模型
  const addModel = useCallback((windowId: string, modelId: string) => {
    const model = getModelById(modelId)
    if (!model) return
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId || w.models.length >= 4) return w
      return {
        ...w,
        models: [...w.models, {
          id: generateId(),
          modelId: model.id,
          params: getDefaultParams(model),
        }],
      }
    }))
  }, [])

  // 移除模型
  const removeModel = useCallback((windowId: string, configId: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId || w.models.length <= 1) return w
      const newResults = { ...w.modelResults }
      delete newResults[configId]
      return {
        ...w,
        models: w.models.filter(m => m.id !== configId),
        modelResults: newResults,
      }
    }))
  }, [])

  // 切换模型
  const changeModel = useCallback((windowId: string, configId: string, newModelId: string) => {
    const model = getModelById(newModelId)
    if (!model) return
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId) return w
      const newResults = { ...w.modelResults }
      delete newResults[configId]
      return {
        ...w,
        models: w.models.map(m => 
          m.id === configId 
            ? { ...m, modelId: newModelId, params: getDefaultParams(model) }
            : m
        ),
        modelResults: newResults,
      }
    }))
  }, [])

  // 更新参数
  const updateParam = useCallback((windowId: string, configId: string, key: string, value: unknown) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId) return w
      return {
        ...w,
        models: w.models.map(m => 
          m.id === configId 
            ? { ...m, params: { ...m.params, [key]: value } }
            : m
        ),
      }
    }))
  }, [])

  // 运行测试
  const runTest = useCallback((windowId: string) => {
    const win = windows.find(w => w.id === windowId)
    if (!win) return

    // 初始化结果
    const initialResults: Record<string, ModelTestResult> = {}
    win.models.forEach(mc => {
      initialResults[mc.id] = {
        modelConfigId: mc.id,
        status: "running",
        results: Array.from({ length: win.drawCount }).map((_, i) => ({
          index: i,
          status: "pending",
        })),
        startTime: Date.now(),
      }
    })

    setWindows(prev => prev.map(w => 
      w.id === windowId ? { ...w, globalStatus: "running", modelResults: initialResults } : w
    ))

    // 并行执行每个模型
    win.models.forEach(mc => {
      const model = getModelById(mc.modelId)
      if (!model) return

      let currentIndex = 0
      const runNext = () => {
        if (currentIndex >= win.drawCount) {
          setWindows(prev => prev.map(w => {
            if (w.id !== windowId) return w
            const newResults = { ...w.modelResults }
            if (newResults[mc.id]) {
              newResults[mc.id] = { ...newResults[mc.id], status: "completed", endTime: Date.now() }
            }
            const allCompleted = Object.values(newResults).every(r => r.status === "completed" || r.status === "error")
            return { ...w, modelResults: newResults, globalStatus: allCompleted ? "completed" : w.globalStatus }
          }))
          return
        }

        setWindows(prev => prev.map(w => {
          if (w.id !== windowId) return w
          const newResults = { ...w.modelResults }
          if (newResults[mc.id]) {
            const results = [...newResults[mc.id].results]
            results[currentIndex] = { ...results[currentIndex], status: "running" }
            newResults[mc.id] = { ...newResults[mc.id], results }
          }
          return { ...w, modelResults: newResults }
        }))

        const duration = (model.estimatedDuration || 5) * 1000 * (0.5 + Math.random())
        const baseCost = model.costPerCall || 0.1
        const cost = baseCost * (0.8 + Math.random() * 0.4)

        setTimeout(() => {
          const isSuccess = Math.random() > 0.05
          setWindows(prev => prev.map(w => {
            if (w.id !== windowId) return w
            const newResults = { ...w.modelResults }
            if (newResults[mc.id]) {
              const results = [...newResults[mc.id].results]
              results[currentIndex] = {
                ...results[currentIndex],
                status: isSuccess ? "completed" : "error",
                duration,
                cost: isSuccess ? cost : 0,
                seed: Math.floor(Math.random() * 4294967295),
                output: isSuccess ? generateMockTextOutput() : undefined,
                error: isSuccess ? undefined : "API 调用失败",
              }
              newResults[mc.id] = { ...newResults[mc.id], results }
            }
            return { ...w, modelResults: newResults }
          }))
          currentIndex++
          runNext()
        }, Math.min(duration, 2000))
      }
      runNext()
    })
  }, [windows])

  // 停止测试
  const stopTest = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== windowId) return w
      const newResults = { ...w.modelResults }
      Object.keys(newResults).forEach(key => {
        newResults[key] = {
          ...newResults[key],
          status: "completed",
          endTime: Date.now(),
          results: newResults[key].results.map(r => 
            r.status === "pending" || r.status === "running"
              ? { ...r, status: "error" as const, error: "已停止" }
              : r
          ),
        }
      })
      return { ...w, globalStatus: "completed", modelResults: newResults }
    }))
  }, [])

  // 重置
  const resetTest = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w =>
      w.id === windowId ? { ...w, globalStatus: "idle", modelResults: {} } : w
    ))
  }, [])

  // 过滤模型
  const filteredModels = selectedCategory
    ? ALL_MODELS.filter(m => m.category === selectedCategory)
    : ALL_MODELS

  return (
    <div className="h-screen w-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-12 border-b border-border bg-card/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">模型接口测试</h1>
          
          {/* Window tabs */}
          <div className="flex items-center gap-1 ml-4">
            {windows.map(win => (
              <button
                key={win.id}
                onClick={() => setActiveWindowId(win.id)}
                className={cn(
                  "h-7 px-3 rounded text-xs flex items-center gap-2 transition-colors",
                  activeWindowId === win.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 hover:bg-secondary text-foreground"
                )}
              >
                {win.name}
                {win.globalStatus === "running" && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeWindow(win.id)
                  }}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => addWindow()}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1 bg-secondary/30 rounded-lg p-1">
          <Button
            variant={selectedCategory === null ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            全部
          </Button>
          {MODEL_CATEGORIES.map(cat => {
            const Icon = getCategoryIcon(cat.id)
            return (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedCategory(cat.id)}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {cat.label}
              </Button>
            )
          })}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {!activeWindow ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">点击上方 + 按钮添加测试窗口</p>
              <Button onClick={() => addWindow()}>
                <Plus className="w-4 h-4 mr-2" />
                添加第一个窗口
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Control bar */}
            <div className="h-12 px-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-card/30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">抽卡次数</Label>
                  <Slider
                    value={[activeWindow.drawCount]}
                    onValueChange={([v]) => updateWindow(activeWindow.id, { drawCount: v })}
                    min={1}
                    max={10}
                    step={1}
                    className="w-32"
                    disabled={activeWindow.globalStatus === "running"}
                  />
                  <span className="text-xs font-mono w-6">{activeWindow.drawCount}</span>
                </div>
                
                <div className="w-px h-6 bg-border" />
                
                <Badge variant="outline" className="text-[10px]">
                  {activeWindow.models.length}/4 模型
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {activeWindow.globalStatus === "running" ? (
                  <Button variant="destructive" size="sm" onClick={() => stopTest(activeWindow.id)}>
                    <Square className="w-3.5 h-3.5 mr-1" />
                    停止
                  </Button>
                ) : (
                  <>
                    {activeWindow.globalStatus === "completed" && (
                      <Button variant="outline" size="sm" onClick={() => resetTest(activeWindow.id)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        重置
                      </Button>
                    )}
                    <Button size="sm" onClick={() => runTest(activeWindow.id)}>
                      <Play className="w-3.5 h-3.5 mr-1" />
                      运行全部
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Models list - scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeWindow.models.map((mc, idx) => (
                <ModelTestRow
                  key={mc.id}
                  config={mc}
                  index={idx}
                  result={activeWindow.modelResults[mc.id]}
                  drawCount={activeWindow.drawCount}
                  isRunning={activeWindow.globalStatus === "running"}
                  canRemove={activeWindow.models.length > 1}
                  onRemove={() => removeModel(activeWindow.id, mc.id)}
                  onChangeModel={(modelId) => changeModel(activeWindow.id, mc.id, modelId)}
                  onUpdateParam={(key, value) => updateParam(activeWindow.id, mc.id, key, value)}
                />
              ))}

              {/* Add model button */}
              {activeWindow.models.length < 4 && (
                <div className="border-2 border-dashed border-border/50 rounded-lg p-6 hover:border-primary/50 transition-colors">
                  <Select
                    onValueChange={(v) => addModel(activeWindow.id, v)}
                    value=""
                    disabled={activeWindow.globalStatus === "running"}
                  >
                    <SelectTrigger className="w-full h-12 border-0 bg-transparent">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground w-full">
                        <Plus className="w-5 h-5" />
                        <span className="text-sm">添加对比模型 ({activeWindow.models.length}/4)</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredModels.map(m => {
                        const Icon = getCategoryIcon(m.category)
                        return (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {m.name}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============ 模型测试行 - 左参数右输出 ============

interface ModelTestRowProps {
  config: ModelTestConfig
  index: number
  result?: ModelTestResult
  drawCount: number
  isRunning: boolean
  canRemove: boolean
  onRemove: () => void
  onChangeModel: (modelId: string) => void
  onUpdateParam: (key: string, value: unknown) => void
}

function ModelTestRow({
  config,
  index,
  result,
  drawCount,
  isRunning,
  canRemove,
  onRemove,
  onChangeModel,
  onUpdateParam,
}: ModelTestRowProps) {
  const [showAllParams, setShowAllParams] = useState(false)
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null)
  
  const model = getModelById(config.modelId)
  if (!model) return null

  const CategoryIcon = getCategoryIcon(model.category)
  const results = result?.results || []
  const completedResults = results.filter(r => r.status === "completed")
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0)
  const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0)
  const selectedResult = selectedResultIndex !== null ? results[selectedResultIndex] : null

  const visibleParams = showAllParams ? model.params : model.params.slice(0, 4)
  const hiddenCount = model.params.length - 4

  const isMediaOutput = model.outputType === "image" || model.outputType === "video"

  return (
    <div className={cn(
      "border rounded-lg bg-card/50 overflow-hidden",
      result?.status === "running" && "border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.1)]"
    )}>
      {/* Header */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-border/50 bg-secondary/20">
        <div className="flex items-center gap-3">
          <Badge className={cn("text-[10px]", getCategoryColor(model.category))}>
            <CategoryIcon className="w-3 h-3 mr-1" />
            {index + 1}
          </Badge>
          <Select value={config.modelId} onValueChange={onChangeModel} disabled={isRunning}>
            <SelectTrigger className="h-7 w-[200px] text-xs border-0 bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_MODELS.map(m => {
                const Icon = getCategoryIcon(m.category)
                return (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" />
                      {m.name}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {result?.status === "running" && (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          )}
        </div>
        
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={isRunning}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content - left params, right output */}
      <div className="flex min-h-[300px]">
        {/* Left - Parameters */}
        <div className="w-1/2 border-r border-border/50 p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">参数配置</h4>
          <div className="space-y-3">
            {visibleParams.map(param => (
              <ParamInput
                key={param.key}
                param={param}
                value={config.params[param.key]}
                onChange={(v) => onUpdateParam(param.key, v)}
                disabled={isRunning}
              />
            ))}
            
            {hiddenCount > 0 && (
              <button
                type="button"
                className="w-full text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1 py-2 hover:bg-primary/5 rounded transition-colors border border-dashed border-primary/30"
                onClick={() => setShowAllParams(!showAllParams)}
              >
                {showAllParams ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    收起参数
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3.5 h-3.5" />
                    展开更多参数 (+{hiddenCount})
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right - Output */}
        <div className="w-1/2 p-4 flex flex-col">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">输出结果</h4>
          
          {results.length > 0 ? (
            <div className="flex-1 flex flex-col">
              {/* Output preview */}
              <div className={cn(
                "flex-1 rounded-lg border border-border/50 bg-black/20 flex items-center justify-center mb-3 min-h-[150px]",
                isMediaOutput && "aspect-video"
              )}>
                {selectedResult?.status === "completed" ? (
                  isMediaOutput ? (
                    <div className="text-center">
                      {model.outputType === "image" ? (
                        <>
                          <Image className="w-10 h-10 text-zinc-500 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">生成图片 #{(selectedResultIndex ?? 0) + 1}</p>
                          <p className="text-[10px] text-muted-foreground/60">1024 x 1024</p>
                        </>
                      ) : (
                        <>
                          <Video className="w-10 h-10 text-zinc-500 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">生成视频 #{(selectedResultIndex ?? 0) + 1}</p>
                          <p className="text-[10px] text-muted-foreground/60">832 x 480</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 text-xs text-foreground/80 leading-relaxed overflow-y-auto max-h-full w-full">
                      {typeof selectedResult.output === "string" 
                        ? selectedResult.output 
                        : JSON.stringify(selectedResult.output, null, 2)
                      }
                    </div>
                  )
                ) : selectedResult?.status === "running" ? (
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">生成中...</p>
                  </div>
                ) : selectedResult?.status === "error" ? (
                  <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-xs text-red-400">{selectedResult.error}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">点击下方选择查看结果</p>
                  </div>
                )}
              </div>

              {/* Results grid */}
              <div className={cn(
                "grid gap-2 mb-3",
                drawCount <= 5 ? "grid-cols-5" : "grid-cols-10"
              )}>
                {results.map((r, idx) => (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSelectedResultIndex(idx)}
                          className={cn(
                            "h-10 rounded flex items-center justify-center text-xs transition-all border",
                            r.status === "pending" && "bg-secondary/30 text-muted-foreground border-transparent",
                            r.status === "running" && "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse",
                            r.status === "completed" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20",
                            r.status === "error" && "bg-red-500/10 text-red-400 border-red-500/30",
                            selectedResultIndex === idx && "ring-2 ring-primary"
                          )}
                        >
                          {r.status === "pending" && `#${idx + 1}`}
                          {r.status === "running" && <Loader2 className="w-4 h-4 animate-spin" />}
                          {r.status === "completed" && <Check className="w-4 h-4" />}
                          {r.status === "error" && <AlertCircle className="w-4 h-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs space-y-1">
                          <p>#{idx + 1}</p>
                          {r.duration != null && <p>耗时: {formatDuration(r.duration)}</p>}
                          {r.cost != null && <p>成本: {formatCost(r.cost)}</p>}
                          {r.seed != null && <p>Seed: {r.seed}</p>}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>

              {/* Stats */}
              {completedResults.length > 0 && (
                <div className="grid grid-cols-4 gap-2 p-3 bg-secondary/20 rounded-lg text-[10px]">
                  <div>
                    <p className="text-muted-foreground">完成</p>
                    <p className="font-medium">{completedResults.length}/{results.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">总耗时</p>
                    <p className="font-medium">{formatDuration(totalDuration)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">总成本</p>
                    <p className="font-medium text-amber-400">{formatCost(totalCost)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">平均</p>
                    <p className="font-medium">{formatDuration(totalDuration / completedResults.length)}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={cn(
              "flex-1 flex items-center justify-center border border-dashed border-border/50 rounded-lg",
              isMediaOutput && "aspect-video"
            )}>
              <div className="text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">点击运行查看输出</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ 参数输入组件 ============

interface ParamInputProps {
  param: ParamSpec
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}

function ParamInput({ param, value, onChange, disabled }: ParamInputProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{param.label}</Label>
        {param.required && <span className="text-[9px] text-red-400">必填</span>}
      </div>
      
      {param.type === "text" && (
        <Input
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          className="h-8 text-xs"
          disabled={disabled}
        />
      )}
      
      {param.type === "textarea" && (
        <Textarea
          value={String(value || "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          className="text-xs min-h-[80px] resize-none"
          disabled={disabled}
        />
      )}
      
      {param.type === "number" && (
        <div className="flex items-center gap-2">
          <Slider
            value={[Number(value) || param.min || 0]}
            onValueChange={([v]) => onChange(v)}
            min={param.min}
            max={param.max}
            step={param.step}
            className="flex-1"
            disabled={disabled}
          />
          <span className="text-xs font-mono w-12 text-right">{Number(value).toFixed(param.step && param.step < 1 ? 2 : 0)}</span>
        </div>
      )}
      
      {param.type === "select" && param.options && (
        <Select value={String(value || "")} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="选择..." />
          </SelectTrigger>
          <SelectContent>
            {param.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      
      {param.type === "boolean" && (
        <Switch
          checked={Boolean(value)}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      )}
      
      {param.description && (
        <p className="text-[10px] text-muted-foreground">{param.description}</p>
      )}
    </div>
  )
}
