"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ALL_MODELS, MODEL_CATEGORIES, getModelById, type ModelSpec, type ParamSpec } from "@/lib/model-specs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
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
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
} from "lucide-react"

// ============ 类型定义 ============

// 单个模型的测试配置
interface ModelTestConfig {
  id: string
  modelId: string
  params: Record<string, unknown>
}

// 单个模型的测试结果
interface ModelTestResult {
  modelId: string
  results: SingleResult[]
  status: "idle" | "running" | "completed" | "error"
  startTime?: number
  endTime?: number
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

interface TestWindow {
  id: string
  models: ModelTestConfig[] // 最多 4 个模型
  drawCount: number
  modelResults: Record<string, ModelTestResult> // modelConfigId -> result
  isExpanded: boolean
  isMinimized: boolean
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

// ============ 主组件 ============

export default function ModelTestPage() {
  const [windows, setWindows] = useState<TestWindow[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // 添加新窗口
  const addWindow = useCallback((modelId?: string) => {
    const model = modelId ? getModelById(modelId) : ALL_MODELS[0]
    if (!model) return

    const newWindow: TestWindow = {
      id: generateId(),
      models: [{
        id: generateId(),
        modelId: model.id,
        params: getDefaultParams(model),
      }],
      drawCount: 1,
      modelResults: {},
      isExpanded: true,
      isMinimized: false,
      globalStatus: "idle",
    }
    setWindows((prev) => [...prev, newWindow])
  }, [])

  // 复制窗口
  const duplicateWindow = useCallback((windowId: string) => {
    setWindows((prev) => {
      const win = prev.find((w) => w.id === windowId)
      if (!win) return prev
      const newWindow: TestWindow = {
        ...win,
        id: generateId(),
        models: win.models.map(m => ({ ...m, id: generateId(), params: { ...m.params } })),
        modelResults: {},
        globalStatus: "idle",
      }
      return [...prev, newWindow]
    })
  }, [])

  // 删除窗口
  const removeWindow = useCallback((windowId: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== windowId))
  }, [])

  // 更新窗口
  const updateWindow = useCallback((windowId: string, updates: Partial<TestWindow>) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, ...updates } : w))
    )
  }, [])

  // 添加模型到窗口
  const addModelToWindow = useCallback((windowId: string, modelId: string) => {
    const model = getModelById(modelId)
    if (!model) return
    
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w
        if (w.models.length >= 4) return w // 最多 4 个
        return {
          ...w,
          models: [...w.models, {
            id: generateId(),
            modelId: model.id,
            params: getDefaultParams(model),
          }],
        }
      })
    )
  }, [])

  // 从窗口移除模型
  const removeModelFromWindow = useCallback((windowId: string, modelConfigId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w
        if (w.models.length <= 1) return w // 至少保留 1 个
        const newResults = { ...w.modelResults }
        delete newResults[modelConfigId]
        return {
          ...w,
          models: w.models.filter(m => m.id !== modelConfigId),
          modelResults: newResults,
        }
      })
    )
  }, [])

  // 更新模型配置
  const updateModelConfig = useCallback((windowId: string, modelConfigId: string, updates: Partial<ModelTestConfig>) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w
        return {
          ...w,
          models: w.models.map(m => m.id === modelConfigId ? { ...m, ...updates } : m),
        }
      })
    )
  }, [])

  // 切换模型
  const changeModel = useCallback((windowId: string, modelConfigId: string, newModelId: string) => {
    const model = getModelById(newModelId)
    if (!model) return
    
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w
        const newResults = { ...w.modelResults }
        delete newResults[modelConfigId]
        return {
          ...w,
          models: w.models.map(m => 
            m.id === modelConfigId 
              ? { ...m, modelId: newModelId, params: getDefaultParams(model) }
              : m
          ),
          modelResults: newResults,
        }
      })
    )
  }, [])

  // 更新参数
  const updateParam = useCallback((windowId: string, modelConfigId: string, key: string, value: unknown) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w
        return {
          ...w,
          models: w.models.map(m => 
            m.id === modelConfigId 
              ? { ...m, params: { ...m.params, [key]: value } }
              : m
          ),
        }
      })
    )
  }, [])

  // 运行测试
  const runTest = useCallback((windowId: string) => {
    const win = windows.find(w => w.id === windowId)
    if (!win) return

    // 初始化所有模型的结果
    const initialResults: Record<string, ModelTestResult> = {}
    win.models.forEach(mc => {
      initialResults[mc.id] = {
        modelId: mc.modelId,
        status: "running",
        results: Array.from({ length: win.drawCount }).map((_, i) => ({
          index: i,
          status: "pending",
        })),
        startTime: Date.now(),
      }
    })

    setWindows(prev => prev.map(w => 
      w.id === windowId 
        ? { ...w, globalStatus: "running", modelResults: initialResults }
        : w
    ))

    // 为每个模型并行执行测试
    win.models.forEach(mc => {
      const model = getModelById(mc.modelId)
      if (!model) return

      let currentIndex = 0
      const runNext = () => {
        if (currentIndex >= win.drawCount) {
          // 该模型完成
          setWindows(prev => prev.map(w => {
            if (w.id !== windowId) return w
            const newResults = { ...w.modelResults }
            if (newResults[mc.id]) {
              newResults[mc.id] = { ...newResults[mc.id], status: "completed", endTime: Date.now() }
            }
            // 检查是否所有模型都完成
            const allCompleted = Object.values(newResults).every(r => r.status === "completed" || r.status === "error")
            return { 
              ...w, 
              modelResults: newResults,
              globalStatus: allCompleted ? "completed" : w.globalStatus,
            }
          }))
          return
        }

        // 开始当前项
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

        // 模拟执行
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
                output: isSuccess
                  ? model.outputType === "text"
                    ? generateMockTextOutput(model)
                    : generateMockMediaOutput(model)
                  : undefined,
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

  // 重置窗口
  const resetWindow = useCallback((windowId: string) => {
    setWindows(prev => prev.map(w =>
      w.id === windowId
        ? { ...w, globalStatus: "idle", modelResults: {} }
        : w
    ))
  }, [])

  // 过滤模型
  const filteredModels = selectedCategory
    ? ALL_MODELS.filter((m) => m.category === selectedCategory)
    : ALL_MODELS

  return (
    <div className="h-screen w-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-12 border-b border-border bg-card/50 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">模型接口测试</h1>
          <Badge variant="outline" className="text-[10px]">
            {windows.length} 个窗口
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* 分类筛选 */}
          <div className="flex items-center gap-1 bg-secondary/30 rounded-lg p-1">
            <Button
              variant={selectedCategory === null ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedCategory(null)}
            >
              全部
            </Button>
            {MODEL_CATEGORIES.map((cat) => {
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
          <div className="w-px h-6 bg-border mx-2" />
          {/* 快速添加 */}
          <Select onValueChange={(v) => addWindow(v)} value="">
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="选择模型添加窗口..." />
            </SelectTrigger>
            <SelectContent>
              {filteredModels.map((model) => {
                const Icon = getCategoryIcon(model.category)
                return (
                  <SelectItem key={model.id} value={model.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" />
                      {model.name}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={() => addWindow()}>
            <Plus className="w-4 h-4 mr-1" />
            新建窗口
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {windows.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Sparkles className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                点击上方按钮添加测试窗口
              </p>
              <Button onClick={() => addWindow()}>
                <Plus className="w-4 h-4 mr-2" />
                添加第一个窗口
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {windows.map((win) => (
              <TestWindowCard
                key={win.id}
                window={win}
                filteredModels={filteredModels}
                onUpdate={(updates) => updateWindow(win.id, updates)}
                onAddModel={(modelId) => addModelToWindow(win.id, modelId)}
                onRemoveModel={(configId) => removeModelFromWindow(win.id, configId)}
                onChangeModel={(configId, modelId) => changeModel(win.id, configId, modelId)}
                onUpdateParam={(configId, key, value) => updateParam(win.id, configId, key, value)}
                onRun={() => runTest(win.id)}
                onStop={() => stopTest(win.id)}
                onReset={() => resetWindow(win.id)}
                onDuplicate={() => duplicateWindow(win.id)}
                onRemove={() => removeWindow(win.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ 测试窗口卡片 ============

interface TestWindowCardProps {
  window: TestWindow
  filteredModels: ModelSpec[]
  onUpdate: (updates: Partial<TestWindow>) => void
  onAddModel: (modelId: string) => void
  onRemoveModel: (configId: string) => void
  onChangeModel: (configId: string, modelId: string) => void
  onUpdateParam: (configId: string, key: string, value: unknown) => void
  onRun: () => void
  onStop: () => void
  onReset: () => void
  onDuplicate: () => void
  onRemove: () => void
}

function TestWindowCard({
  window: win,
  filteredModels,
  onUpdate,
  onAddModel,
  onRemoveModel,
  onChangeModel,
  onUpdateParam,
  onRun,
  onStop,
  onReset,
  onDuplicate,
  onRemove,
}: TestWindowCardProps) {
  const isRunning = win.globalStatus === "running"
  const isCompleted = win.globalStatus === "completed"

  // 统计
  const totalDuration = Object.values(win.modelResults).reduce((sum, mr) => 
    sum + mr.results.reduce((s, r) => s + (r.duration || 0), 0), 0)
  const totalCost = Object.values(win.modelResults).reduce((sum, mr) => 
    sum + mr.results.reduce((s, r) => s + (r.cost || 0), 0), 0)
  const completedCount = Object.values(win.modelResults).reduce((sum, mr) => 
    sum + mr.results.filter(r => r.status === "completed").length, 0)
  const totalCount = win.models.length * win.drawCount

  if (win.isMinimized) {
    return (
      <div className="border border-border rounded-lg bg-card/50 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{win.models.length} 个模型对比</span>
          {isRunning && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
          {isCompleted && (
            <Badge variant="outline" className="text-[10px]">
              {completedCount}/{totalCount}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onUpdate({ isMinimized: false })}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "border rounded-lg bg-card/50 flex flex-col min-h-[400px]",
        isRunning && "border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)]",
        isCompleted && "border-emerald-500/30"
      )}
    >
      {/* Window header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">模型对比测试</span>
          <Badge variant="outline" className="text-[10px]">
            {win.models.length}/4 模型
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制窗口</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onUpdate({ isMinimized: true })}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Draw count & Actions */}
      <div className="px-3 py-2 border-b border-border/50 flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Label className="text-[10px] text-muted-foreground shrink-0">抽卡次数</Label>
          <Slider
            value={[win.drawCount]}
            onValueChange={([v]) => onUpdate({ drawCount: v })}
            min={1}
            max={10}
            step={1}
            disabled={isRunning}
            className="flex-1 max-w-[150px]"
          />
          <span className="text-xs font-mono w-6 text-center">{win.drawCount}</span>
        </div>

        {isCompleted && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatDuration(totalDuration)}
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <DollarSign className="w-3 h-3" />
              {formatCost(totalCost)}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="destructive" size="sm" className="h-7" onClick={onStop}>
              <Square className="w-3 h-3 mr-1" />
              停止
            </Button>
          ) : (
            <>
              <Button size="sm" className="h-7" onClick={onRun}>
                <Play className="w-3 h-3 mr-1" />
                运行 ({win.models.length}x{win.drawCount})
              </Button>
              {isCompleted && (
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={onReset}>
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Models grid - Input area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Expand/collapse toggle */}
        <button
          className="h-7 flex items-center justify-center text-[10px] text-muted-foreground hover:bg-secondary/30 transition-colors border-b border-border/50"
          onClick={() => onUpdate({ isExpanded: !win.isExpanded })}
        >
          {win.isExpanded ? (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              收起输入参数
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3 mr-1" />
              展开输入参数
            </>
          )}
        </button>

        {/* Models input section */}
        {win.isExpanded && (
          <div className="border-b border-border/50">
            <ScrollArea className="max-h-[280px]">
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {win.models.map((mc, idx) => {
                  const model = getModelById(mc.modelId)
                  if (!model) return null
                  const CategoryIcon = getCategoryIcon(model.category)
                  
                  return (
                    <div key={mc.id} className="border border-border/50 rounded-lg p-3 bg-secondary/10">
                      {/* Model header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-[9px]", getCategoryColor(model.category))}>
                            <CategoryIcon className="w-2.5 h-2.5 mr-0.5" />
                            {idx + 1}
                          </Badge>
                        </div>
                        {win.models.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => onRemoveModel(mc.id)}
                            disabled={isRunning}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      {/* Model selector */}
                      <Select 
                        value={mc.modelId} 
                        onValueChange={(v) => onChangeModel(mc.id, v)} 
                        disabled={isRunning}
                      >
                        <SelectTrigger className="h-7 text-xs mb-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_MODELS.map((m) => {
                            const Icon = getCategoryIcon(m.category)
                            return (
                              <SelectItem key={m.id} value={m.id} className="text-xs">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-3 h-3" />
                                  {m.name}
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>

                      {/* Params */}
                      <div className="space-y-2">
                        {model.params.slice(0, 3).map((param) => (
                          <ParamInput
                            key={param.key}
                            param={param}
                            value={mc.params[param.key]}
                            onChange={(v) => onUpdateParam(mc.id, param.key, v)}
                            disabled={isRunning}
                            compact
                          />
                        ))}
                        {model.params.length > 3 && (
                          <p className="text-[9px] text-muted-foreground">
                            +{model.params.length - 3} 更多参数...
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Add model button */}
                {win.models.length < 4 && (
                  <Select onValueChange={onAddModel} value="" disabled={isRunning}>
                    <SelectTrigger className="h-full min-h-[120px] border-dashed">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Plus className="w-5 h-5" />
                        <span className="text-xs">添加模型对比</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredModels.map((m) => {
                        const Icon = getCategoryIcon(m.category)
                        return (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3 h-3" />
                              {m.name}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Output section */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full max-h-[300px]">
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {win.models.map((mc) => {
                const model = getModelById(mc.modelId)
                if (!model) return null
                const result = win.modelResults[mc.id]
                const CategoryIcon = getCategoryIcon(model.category)

                return (
                  <ModelOutputCard
                    key={mc.id}
                    model={model}
                    result={result}
                    drawCount={win.drawCount}
                  />
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

// ============ 模型输出卡片 ============

interface ModelOutputCardProps {
  model: ModelSpec
  result?: ModelTestResult
  drawCount: number
}

function ModelOutputCard({ model, result, drawCount }: ModelOutputCardProps) {
  const CategoryIcon = getCategoryIcon(model.category)
  const results = result?.results || []
  const completedCount = results.filter(r => r.status === "completed").length
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0)
  const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0)

  return (
    <div className="border border-border/50 rounded-lg p-3 bg-secondary/5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[9px]", getCategoryColor(model.category))}>
            <CategoryIcon className="w-2.5 h-2.5 mr-0.5" />
            {model.category.toUpperCase()}
          </Badge>
          <span className="text-[10px] font-medium truncate max-w-[100px]">{model.name}</span>
        </div>
        {result && (
          <div className="flex items-center gap-2 text-[9px]">
            {result.status === "running" && (
              <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
            )}
            {result.status === "completed" && (
              <>
                <span className="text-muted-foreground">{formatDuration(totalDuration)}</span>
                <span className="text-amber-400">{formatCost(totalCost)}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Results grid */}
      {results.length > 0 ? (
        <div className="grid grid-cols-5 gap-1">
          {results.map((r, idx) => (
            <TooltipProvider key={idx}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-7 rounded flex items-center justify-center text-[9px] transition-all",
                      r.status === "pending" && "bg-secondary/30 text-muted-foreground",
                      r.status === "running" && "bg-blue-500/20 text-blue-400 animate-pulse",
                      r.status === "completed" && "bg-emerald-500/20 text-emerald-400",
                      r.status === "error" && "bg-red-500/20 text-red-400"
                    )}
                  >
                    {r.status === "pending" && <span>#{idx + 1}</span>}
                    {r.status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
                    {r.status === "completed" && <Check className="w-3 h-3" />}
                    {r.status === "error" && <AlertCircle className="w-3 h-3" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <div className="text-[10px] space-y-1">
                    <p>#{idx + 1} - {r.status}</p>
                    {r.duration && <p>耗时: {formatDuration(r.duration)}</p>}
                    {r.cost && <p>成本: {formatCost(r.cost)}</p>}
                    {r.seed && <p>Seed: {r.seed}</p>}
                    {r.error && <p className="text-red-400">{r.error}</p>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      ) : (
        <div className="h-16 flex items-center justify-center text-[10px] text-muted-foreground border border-dashed border-border/50 rounded">
          点击运行查看输出
        </div>
      )}
    </div>
  )
}

// ============ 参数输入组件 ============

interface ParamInputProps {
  param: ParamSpec
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
  compact?: boolean
}

function ParamInput({ param, value, onChange, disabled, compact }: ParamInputProps) {
  return (
    <div className={cn("space-y-1", compact && "space-y-0.5")}>
      <div className="flex items-center justify-between">
        <Label className={cn("text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
          {param.label}
          {param.required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
      </div>

      {param.type === "string" && (
        <Input
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          disabled={disabled}
          className={cn(compact ? "h-6 text-[10px]" : "h-7 text-xs")}
        />
      )}

      {param.type === "textarea" && (
        <Textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          disabled={disabled}
          className={cn(compact ? "text-[10px] min-h-[40px]" : "text-xs min-h-[60px]", "resize-none")}
          rows={compact ? 2 : 3}
        />
      )}

      {param.type === "number" && (
        <Input
          type="number"
          value={value as number}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={param.min}
          max={param.max}
          step={param.step}
          disabled={disabled}
          className={cn(compact ? "h-6 text-[10px]" : "h-7 text-xs")}
        />
      )}

      {param.type === "select" && param.options && (
        <Select
          value={String(value)}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger className={cn(compact ? "h-6 text-[10px]" : "h-7 text-xs")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {param.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {param.type === "file" && (
        <Input
          type="file"
          disabled={disabled}
          className={cn(compact ? "h-6 text-[10px]" : "h-7 text-xs", "file:mr-2 file:py-0 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-secondary file:text-secondary-foreground")}
        />
      )}
    </div>
  )
}

// ============ Mock 输出生成 ============

function generateMockTextOutput(model: ModelSpec): string {
  const samples = [
    "这是一段由 AI 生成的测试文本。根据您的输入，系统已成功处理并返回结果。",
    "分析完成。检测到 5 个场景，12 个角色，预计生成时间约 45 秒。",
    '{"status": "success", "scenes": 5, "characters": 12}',
  ]
  return samples[Math.floor(Math.random() * samples.length)]
}

function generateMockMediaOutput(model: ModelSpec): Record<string, unknown> {
  if (model.outputType === "image") {
    return { type: "image", width: 1024, height: 1024, format: "PNG" }
  }
  if (model.outputType === "video") {
    return { type: "video", width: 832, height: 480, duration: 5.0, fps: 16 }
  }
  if (model.outputType === "audio") {
    return { type: "audio", duration: 10.0, sampleRate: 44100 }
  }
  return { type: "unknown" }
}
