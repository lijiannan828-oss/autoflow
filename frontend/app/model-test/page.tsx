"use client"

import { useState, useCallback, useRef } from "react"
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
  Trash2,
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

interface TestWindow {
  id: string
  modelId: string
  params: Record<string, unknown>
  drawCount: number // 抽卡次数 1-10
  status: "idle" | "running" | "completed" | "error"
  results: TestResult[]
  startTime?: number
  endTime?: number
  isExpanded: boolean
  isMinimized: boolean
}

interface TestResult {
  index: number
  status: "pending" | "running" | "completed" | "error"
  output?: string | Record<string, unknown>
  duration?: number // 毫秒
  cost?: number // 元
  error?: string
  seed?: number
}

// ============ 工具函数 ============

function generateId() {
  return `win_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
  if (ms < 1000) return `${ms}ms`
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
  const windowIdRef = useRef(0)

  // 添加新窗口
  const addWindow = useCallback((modelId?: string) => {
    const model = modelId ? getModelById(modelId) : ALL_MODELS[0]
    if (!model) return

    const newWindow: TestWindow = {
      id: generateId(),
      modelId: model.id,
      params: getDefaultParams(model),
      drawCount: 1,
      status: "idle",
      results: [],
      isExpanded: true,
      isMinimized: false,
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
        status: "idle",
        results: [],
        startTime: undefined,
        endTime: undefined,
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

  // 更新窗口参数
  const updateWindowParam = useCallback(
    (windowId: string, key: string, value: unknown) => {
      setWindows((prev) =>
        prev.map((w) =>
          w.id === windowId ? { ...w, params: { ...w.params, [key]: value } } : w
        )
      )
    },
    []
  )

  // 切换模型
  const changeModel = useCallback((windowId: string, modelId: string) => {
    const model = getModelById(modelId)
    if (!model) return
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId
          ? { ...w, modelId, params: getDefaultParams(model), results: [], status: "idle" }
          : w
      )
    )
  }, [])

  // 运行测试（模拟）
  const runTest = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w
        const model = getModelById(w.modelId)
        if (!model) return w

        // 初始化结果
        const results: TestResult[] = Array.from({ length: w.drawCount }).map((_, i) => ({
          index: i,
          status: "pending",
        }))

        return {
          ...w,
          status: "running",
          results,
          startTime: Date.now(),
          endTime: undefined,
        }
      })
    )

    // 模拟逐个执行
    const win = windows.find((w) => w.id === windowId)
    if (!win) return
    const model = getModelById(win.modelId)
    if (!model) return

    let currentIndex = 0
    const runNext = () => {
      if (currentIndex >= win.drawCount) {
        // 完成
        setWindows((prev) =>
          prev.map((w) =>
            w.id === windowId ? { ...w, status: "completed", endTime: Date.now() } : w
          )
        )
        return
      }

      // 开始当前项
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== windowId) return w
          const newResults = [...w.results]
          newResults[currentIndex] = { ...newResults[currentIndex], status: "running" }
          return { ...w, results: newResults }
        })
      )

      // 模拟执行时间
      const duration = (model.estimatedDuration || 5) * 1000 * (0.5 + Math.random())
      const baseCost = model.costPerCall || 0.1
      const cost = baseCost * (0.8 + Math.random() * 0.4)

      setTimeout(() => {
        const isSuccess = Math.random() > 0.05 // 95% 成功率

        setWindows((prev) =>
          prev.map((w) => {
            if (w.id !== windowId) return w
            const newResults = [...w.results]
            newResults[currentIndex] = {
              ...newResults[currentIndex],
              status: isSuccess ? "completed" : "error",
              duration,
              cost: isSuccess ? cost : 0,
              seed: Math.floor(Math.random() * 4294967295),
              output: isSuccess
                ? model.outputType === "text"
                  ? generateMockTextOutput(model)
                  : generateMockMediaOutput(model)
                : undefined,
              error: isSuccess ? undefined : "API 调用失败：超时",
            }
            return { ...w, results: newResults }
          })
        )

        currentIndex++
        runNext()
      }, Math.min(duration, 3000)) // 最多模拟 3 秒
    }

    runNext()
  }, [windows])

  // 停止测试
  const stopTest = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== windowId) return w
        // 将 pending 状态改为 idle
        const newResults = w.results.map((r) =>
          r.status === "pending" || r.status === "running"
            ? { ...r, status: "error" as const, error: "已停止" }
            : r
        )
        return { ...w, status: "completed", results: newResults, endTime: Date.now() }
      })
    )
  }, [])

  // 重置窗口
  const resetWindow = useCallback((windowId: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId
          ? { ...w, status: "idle", results: [], startTime: undefined, endTime: undefined }
          : w
      )
    )
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
          <div className="flex items-center gap-1">
            <Button
              variant={selectedCategory === null ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedCategory(null)}
            >
              全部
            </Button>
            {MODEL_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
          <div className="w-px h-6 bg-border mx-2" />
          {/* 快速添加 */}
          <Select onValueChange={(v) => addWindow(v)}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="选择模型添加窗口..." />
            </SelectTrigger>
            <SelectContent>
              {filteredModels.map((model) => (
                <SelectItem key={model.id} value={model.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        model.category === "llm" && "bg-blue-500",
                        model.category === "image" && "bg-emerald-500",
                        model.category === "video" && "bg-purple-500",
                        model.category === "audio" && "bg-amber-500"
                      )}
                    />
                    {model.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={() => addWindow()}>
            <Plus className="w-4 h-4 mr-1" />
            新建窗口
          </Button>
        </div>
      </header>

      {/* Main content - Windows grid */}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 auto-rows-min">
            {windows.map((win) => (
              <TestWindowCard
                key={win.id}
                window={win}
                onUpdate={(updates) => updateWindow(win.id, updates)}
                onUpdateParam={(key, value) => updateWindowParam(win.id, key, value)}
                onChangeModel={(modelId) => changeModel(win.id, modelId)}
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
  onUpdate: (updates: Partial<TestWindow>) => void
  onUpdateParam: (key: string, value: unknown) => void
  onChangeModel: (modelId: string) => void
  onRun: () => void
  onStop: () => void
  onReset: () => void
  onDuplicate: () => void
  onRemove: () => void
}

function TestWindowCard({
  window: win,
  onUpdate,
  onUpdateParam,
  onChangeModel,
  onRun,
  onStop,
  onReset,
  onDuplicate,
  onRemove,
}: TestWindowCardProps) {
  const model = getModelById(win.modelId)
  if (!model) return null

  const isRunning = win.status === "running"
  const isCompleted = win.status === "completed"
  const CategoryIcon = getCategoryIcon(model.category)

  // 统计
  const completedCount = win.results.filter((r) => r.status === "completed").length
  const totalDuration = win.results.reduce((sum, r) => sum + (r.duration || 0), 0)
  const totalCost = win.results.reduce((sum, r) => sum + (r.cost || 0), 0)

  if (win.isMinimized) {
    return (
      <div className="border border-border rounded-lg bg-card/50 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{model.name}</span>
          {isRunning && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
          {isCompleted && (
            <Badge variant="outline" className="text-[10px]">
              {completedCount}/{win.drawCount}
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
        "border rounded-lg bg-card/50 flex flex-col",
        isRunning && "border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)]",
        isCompleted && completedCount === win.drawCount && "border-emerald-500/50",
        isCompleted && completedCount < win.drawCount && "border-amber-500/50"
      )}
    >
      {/* Window header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px]", getCategoryColor(model.category))}>
            <CategoryIcon className="w-3 h-3 mr-1" />
            {model.category.toUpperCase()}
          </Badge>
          <span className="text-xs font-medium truncate max-w-[150px]">{model.name}</span>
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

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Model selector & draw count */}
        <div className="p-3 border-b border-border/50 space-y-3">
          <div className="flex items-center gap-2">
            <Select value={win.modelId} onValueChange={onChangeModel} disabled={isRunning}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          m.category === "llm" && "bg-blue-500",
                          m.category === "image" && "bg-emerald-500",
                          m.category === "video" && "bg-purple-500",
                          m.category === "audio" && "bg-amber-500"
                        )}
                      />
                      {m.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Draw count slider */}
          <div className="flex items-center gap-3">
            <Label className="text-[10px] text-muted-foreground shrink-0">抽卡次数</Label>
            <Slider
              value={[win.drawCount]}
              onValueChange={([v]) => onUpdate({ drawCount: v })}
              min={1}
              max={10}
              step={1}
              disabled={isRunning}
              className="flex-1"
            />
            <span className="text-xs font-mono w-6 text-center">{win.drawCount}</span>
          </div>

          {/* Model info */}
          <p className="text-[10px] text-muted-foreground line-clamp-1">
            {model.description}
            {model.vram && <span className="ml-2 text-zinc-500">VRAM: {model.vram}</span>}
          </p>
        </div>

        {/* Parameters */}
        <div
          className={cn(
            "border-b border-border/50 overflow-hidden transition-all",
            win.isExpanded ? "max-h-[300px]" : "max-h-0"
          )}
        >
          <ScrollArea className="h-full max-h-[300px]">
            <div className="p-3 space-y-3">
              {model.params.map((param) => (
                <ParamInput
                  key={param.key}
                  param={param}
                  value={win.params[param.key]}
                  onChange={(v) => onUpdateParam(param.key, v)}
                  disabled={isRunning}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Expand/collapse toggle */}
        <button
          className="h-6 flex items-center justify-center text-[10px] text-muted-foreground hover:bg-secondary/30 transition-colors"
          onClick={() => onUpdate({ isExpanded: !win.isExpanded })}
        >
          {win.isExpanded ? (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              收起参数
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3 mr-1" />
              展开参数 ({model.params.length})
            </>
          )}
        </button>

        {/* Results */}
        {win.results.length > 0 && (
          <div className="border-t border-border/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">结果</span>
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
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {win.results.map((result, idx) => (
                <TooltipProvider key={idx}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "h-8 rounded flex items-center justify-center text-[10px] transition-all",
                          result.status === "pending" && "bg-secondary/30 text-muted-foreground",
                          result.status === "running" &&
                            "bg-blue-500/20 text-blue-400 animate-pulse",
                          result.status === "completed" && "bg-emerald-500/20 text-emerald-400",
                          result.status === "error" && "bg-red-500/20 text-red-400"
                        )}
                      >
                        {result.status === "pending" && <span>#{idx + 1}</span>}
                        {result.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {result.status === "completed" && <Check className="w-3.5 h-3.5" />}
                        {result.status === "error" && <AlertCircle className="w-3.5 h-3.5" />}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      <div className="text-[10px] space-y-1">
                        <p>#{idx + 1} - {result.status}</p>
                        {result.duration && <p>耗时: {formatDuration(result.duration)}</p>}
                        {result.cost && <p>成本: {formatCost(result.cost)}</p>}
                        {result.seed && <p>Seed: {result.seed}</p>}
                        {result.error && <p className="text-red-400">{result.error}</p>}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-3 border-t border-border/50 flex items-center gap-2">
          {isRunning ? (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 h-8"
              onClick={onStop}
            >
              <Square className="w-3.5 h-3.5 mr-1.5" />
              停止
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                className="flex-1 h-8"
                onClick={onRun}
                disabled={isRunning}
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                运行 ({win.drawCount}x)
              </Button>
              {isCompleted && (
                <Button variant="outline" size="sm" className="h-8" onClick={onReset}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
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
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">
          {param.label}
          {param.required && <span className="text-red-400 ml-0.5">*</span>}
        </Label>
        {param.description && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className="text-[9px] text-muted-foreground/60 hover:text-muted-foreground cursor-help">
                  ?
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] text-[10px]">
                {param.description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {param.type === "string" && (
        <Input
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          disabled={disabled}
          className="h-7 text-xs"
        />
      )}

      {param.type === "textarea" && (
        <Textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          disabled={disabled}
          className="text-xs min-h-[60px] resize-none"
          rows={3}
        />
      )}

      {param.type === "number" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={value as number}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={param.min}
            max={param.max}
            step={param.step}
            disabled={disabled}
            className="h-7 text-xs flex-1"
          />
          {param.min !== undefined && param.max !== undefined && (
            <span className="text-[9px] text-muted-foreground shrink-0">
              [{param.min}-{param.max}]
            </span>
          )}
        </div>
      )}

      {param.type === "select" && param.options && (
        <Select
          value={String(value)}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger className="h-7 text-xs">
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
        <div className="flex items-center gap-2">
          <Input
            type="file"
            disabled={disabled}
            className="h-7 text-xs flex-1 file:mr-2 file:py-0 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-secondary file:text-secondary-foreground"
          />
        </div>
      )}
    </div>
  )
}

// ============ Mock 输出生成 ============

function generateMockTextOutput(model: ModelSpec): string {
  const samples = [
    "这是一段由 AI 生成的测试文本。根据您的输入，系统已成功处理并返回结果。",
    "分析完成。检测到 5 个场景，12 个角色，预计生成时间约 45 秒。建议优化：减少复杂镜头数量以降低成本。",
    '{"status": "success", "analysis": {"scenes": 5, "characters": 12, "estimated_duration": 45}, "recommendations": ["优化镜头数量", "简化过渡效果"]}',
  ]
  return samples[Math.floor(Math.random() * samples.length)]
}

function generateMockMediaOutput(model: ModelSpec): Record<string, unknown> {
  if (model.outputType === "image") {
    return {
      type: "image",
      url: `/placeholder.svg?w=512&h=512&text=Generated+Image`,
      width: 1024,
      height: 1024,
      format: "PNG",
    }
  }
  if (model.outputType === "video") {
    return {
      type: "video",
      url: `/placeholder-video.mp4`,
      width: 832,
      height: 480,
      duration: 5.0,
      fps: 16,
      format: "MP4",
    }
  }
  if (model.outputType === "audio") {
    return {
      type: "audio",
      url: `/placeholder-audio.wav`,
      duration: 10.0,
      sampleRate: 44100,
      format: "WAV",
    }
  }
  return { type: "unknown" }
}
