"use client"

import { useState } from "react"
import {
  Image, Video, Sparkles, CheckCircle2, Loader2, Clock,
  ChevronDown, ChevronUp, Copy, Pencil, ImagePlus, Play, RefreshCw, Send, Check, Download, Upload, AtSign, Settings2, User, MapPin
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Shot, GenerationMode } from "@/lib/types"
import { toast } from "sonner"

// Image generation models
const IMAGE_MODELS = [
  { id: "z-image-turbo", name: "Z-Image-Turbo", desc: "快速高质量图像生成" },
  { id: "flux", name: "Flux", desc: "艺术风格图像生成" },
]

// Video generation models
const VIDEO_MODELS = [
  { id: "wan2.2", name: "Wan2.2", desc: "画面生动，动作流畅" },
  { id: "hunyuan1.5", name: "Hunyuan 1.5", desc: "更稳定真实" },
]

// Resolution options
const RESOLUTIONS = ["720P", "1080P"] as const

// Duration options
const DURATIONS = ["智能", "3s", "5s", "10s"] as const

// Mock characters for @ mention
const CHARACTERS = [
  { id: "char-1", name: "克莱尔-女佣装", avatar: "#8B5CF6" },
  { id: "char-2", name: "克莱尔-千金装", avatar: "#EC4899" },
  { id: "char-3", name: "维多利亚", avatar: "#F59E0B" },
  { id: "char-4", name: "马库斯", avatar: "#10B981" },
]

// Mock scenes for @ mention
const SCENES = [
  { id: "scene-1", name: "宴会大厅", avatar: "#6366F1" },
  { id: "scene-2", name: "走廊", avatar: "#8B5CF6" },
  { id: "scene-3", name: "花园", avatar: "#10B981" },
]

interface ShotDetailPanelProps {
  shot: Shot | null
  selectedGachaId?: string | null
  onApplyGacha?: (shotId: string, gachaId: string) => void
  onGenerate?: (shotId: string, mode: GenerationMode, prompt: string) => void
  onApproveShot?: (shotId: string) => void
}

export function ShotDetailPanel({
  shot,
  selectedGachaId,
  onApplyGacha,
  onGenerate,
  onApproveShot,
}: ShotDetailPanelProps) {
  const [genMode, setGenMode] = useState<GenerationMode>("video-gen")
  const [inputText, setInputText] = useState("")
  const [isImagePromptExpanded, setIsImagePromptExpanded] = useState(true)
  const [isVideoPromptExpanded, setIsVideoPromptExpanded] = useState(true)
  
  // Model/settings states
  const [selectedImageModel, setSelectedImageModel] = useState("z-image-turbo")
  const [selectedVideoModel, setSelectedVideoModel] = useState("wan2.2")
  const [selectedResolution, setSelectedResolution] = useState<typeof RESOLUTIONS[number]>("720P")
  const [selectedDuration, setSelectedDuration] = useState<typeof DURATIONS[number]>("智能")
  const [trimToAudio, setTrimToAudio] = useState(false)
  
  // @ mention states
  const [mentionTab, setMentionTab] = useState<"角色" | "场景">("角色")

  if (!shot) {
    return (
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-border/50 bg-[#141414]">
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-muted-foreground">选择一个分镜查看详情</span>
        </div>
      </aside>
    )
  }

  const statusConfig = {
    pending: { label: "待审", icon: Clock, color: "text-muted-foreground", bg: "bg-secondary" },
    approved: { label: "已通过", icon: CheckCircle2, color: "text-score-green", bg: "bg-score-green/10" },
    rejected: { label: "已驳回", icon: Loader2, color: "text-score-red", bg: "bg-score-red/10" },
    generating: { label: "生成中", icon: Loader2, color: "text-score-yellow", bg: "bg-score-yellow/10" },
  }
  const st = statusConfig[shot.status]
  const StatusIcon = st.icon

  // Find selected gacha result - default to first keyframe
  const selectedGacha = selectedGachaId
    ? shot.gachaGroups.flatMap(g => [g.keyframe, ...g.videos]).find(r => r.id === selectedGachaId)
    : shot.gachaGroups[0]?.keyframe

  const modeLabels: Record<GenerationMode, string> = {
    "dialog-edit": "对话改图",
    "image-gen": "图片生成",
    "video-gen": "视频生成",
  }

  const modeIcons: Record<GenerationMode, React.ReactNode> = {
    "dialog-edit": <Sparkles className="h-3.5 w-3.5" />,
    "image-gen": <ImagePlus className="h-3.5 w-3.5" />,
    "video-gen": <Play className="h-3.5 w-3.5" />,
  }

  const handleGenerate = () => {
    if (!inputText.trim()) {
      toast.error("请输入提示词")
      return
    }
    onGenerate?.(shot.id, genMode, inputText)
    toast.success(`已提交${modeLabels[genMode]}任务`)
    setInputText("")
  }

  const handleCopyPrompt = (prompt: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    navigator.clipboard.writeText(prompt)
    toast.success("已复制提示词")
  }

  const handleEditPrompt = (type: "image" | "video", e?: React.MouseEvent) => {
    e?.stopPropagation()
    toast.info(`编辑${type === "image" ? "图片" : "视频"}提示词`)
  }

  const handleDownload = (type: "image" | "video") => {
    toast.success(`已开始下载${type === "image" ? "图片" : "视频"}`)
  }

  const handleRegenerate = (type: "image" | "video") => {
    toast.success(`已提交${type === "image" ? "图片" : "视频"}重新生成任务`)
  }

  const handleApply = (type: "image" | "video") => {
    if (selectedGacha) {
      onApplyGacha?.(shot.id, selectedGacha.id)
      toast.success(`已应用${type === "image" ? "图片" : "视频"}到时间轴`)
    }
  }

  const handleQuoteImage = () => {
    toast.info("已引用图片到对话")
  }

  const handleImageToVideo = () => {
    toast.success("已提交图片转视频任务")
  }
  
  const handleMention = (type: "角色" | "场景", item: { id: string; name: string }) => {
    setInputText(prev => prev + `@${item.name} `)
    toast.info(`已添加 @${item.name}`)
  }
  
  const handleApproveThisShot = () => {
    onApproveShot?.(shot.id)
    toast.success("本分镜已通过审核")
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-border/50 bg-[#141414]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-foreground/10">
            <Video className="h-3 w-3 text-foreground/60" />
          </div>
          <span className="text-sm font-medium text-foreground">{shot.label}</span>
          <Badge variant="secondary" className={`text-[10px] ${st.color} ${st.bg} border-0`}>
            <StatusIcon className={`h-3 w-3 mr-1 ${shot.status === "generating" ? "animate-spin" : ""}`} />
            {st.label}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{shot.estimatedDuration.toFixed(1)}s</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* === Image Prompt Section === */}
          <section className="rounded-lg bg-[#1a1a1a] overflow-hidden">
            <button
              className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-[#222] transition-colors"
              onClick={() => setIsImagePromptExpanded(!isImagePromptExpanded)}
            >
              <div className="flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">图片提示词</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="p-1 hover:bg-secondary/50 rounded transition-colors"
                  onClick={(e) => handleEditPrompt("image", e)}
                  title="编辑"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  className="p-1 hover:bg-secondary/50 rounded transition-colors"
                  onClick={(e) => handleCopyPrompt(shot.imagePrompt, e)}
                  title="复制"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
                {isImagePromptExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </button>
            {isImagePromptExpanded && (
              <div className="px-3 pb-3">
                <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-line">
                  {shot.imagePrompt}
                </p>
              </div>
            )}
          </section>

          {/* Generated Image with Actions */}
          <div className="relative overflow-hidden rounded-lg group">
            <div
              className="aspect-video w-full"
              style={{ backgroundColor: shot.referenceImageColor }}
            />
            {/* Top right action buttons (always visible on hover) */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="p-1.5 rounded bg-black/60 hover:bg-black/80 transition-colors"
                onClick={() => handleDownload("image")}
                title="下载"
              >
                <Download className="h-3.5 w-3.5 text-white" />
              </button>
              <button
                className="p-1.5 rounded bg-black/60 hover:bg-black/80 transition-colors"
                onClick={() => handleApply("image")}
                title="应用"
              >
                <Upload className="h-3.5 w-3.5 text-white" />
              </button>
              <button
                className="p-1.5 rounded bg-black/60 hover:bg-black/80 transition-colors"
                onClick={() => handleRegenerate("image")}
                title="重新生成"
              >
                <RefreshCw className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            {/* Bottom action buttons */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-[11px] gap-1.5 bg-[#2a2a2a]/90 hover:bg-[#333] border-border/30"
                onClick={handleQuoteImage}
              >
                <ImagePlus className="h-3 w-3" />
                引用图片
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 text-[11px] gap-1.5 bg-[#2a2a2a]/90 hover:bg-[#333] border-border/30"
                onClick={handleImageToVideo}
              >
                <Play className="h-3 w-3" />
                转视频
              </Button>
            </div>
          </div>

          {/* Image to Video button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-[#2a2a2a] hover:bg-[#333] text-foreground"
              onClick={handleImageToVideo}
            >
              图片生成视频
            </Button>
          </div>

          <Separator className="bg-border/30" />

          {/* === Model Label === */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium text-foreground">Luxi</span>
          </div>

          {/* === Video Prompt Section === */}
          <section className="rounded-lg bg-[#1a1a1a] overflow-hidden">
            <button
              className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-[#222] transition-colors"
              onClick={() => setIsVideoPromptExpanded(!isVideoPromptExpanded)}
            >
              <div className="flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">视频提示词</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="p-1 hover:bg-secondary/50 rounded transition-colors"
                  onClick={(e) => handleEditPrompt("video", e)}
                  title="编辑"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  className="p-1 hover:bg-secondary/50 rounded transition-colors"
                  onClick={(e) => handleCopyPrompt(shot.videoPrompt, e)}
                  title="复制"
                >
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
                {isVideoPromptExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </button>
            {isVideoPromptExpanded && (
              <div className="px-3 pb-3">
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {shot.videoPrompt}
                </p>
              </div>
            )}
          </section>

          {/* Generated Video Preview */}
          <div className="relative overflow-hidden rounded-lg group">
            {/* Smart selection badge */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded bg-primary/80 text-[10px] text-primary-foreground font-medium">
              <Sparkles className="h-2.5 w-2.5" />
              智能选择
            </div>
            {/* Top right action buttons */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className="p-1.5 rounded bg-black/60 hover:bg-black/80 transition-colors"
                onClick={() => handleDownload("video")}
                title="下载"
              >
                <Download className="h-3.5 w-3.5 text-white" />
              </button>
              <button
                className="p-1.5 rounded bg-black/60 hover:bg-black/80 transition-colors"
                onClick={() => handleApply("video")}
                title="应用"
              >
                <Upload className="h-3.5 w-3.5 text-white" />
              </button>
              <button
                className="p-1.5 rounded bg-black/60 hover:bg-black/80 transition-colors"
                onClick={() => handleRegenerate("video")}
                title="重新生成"
              >
                <RefreshCw className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            {/* Video thumbnail */}
            <div
              className="aspect-video w-full"
              style={{ backgroundColor: shot.gachaGroups[0]?.videos[0]?.thumbnailColor || "#2a2a2a" }}
            />
            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center">
                <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
              </div>
            </div>
          </div>

          <Separator className="bg-border/30" />

          {/* === Chat Input Section === */}
          <section className="space-y-2">
            <Textarea
              placeholder="结合图片，描述你想生成的角色动作和画面动态"
              className="min-h-[80px] bg-[#1a1a1a] border-border/30 text-sm resize-none focus-visible:ring-1 focus-visible:ring-primary/50"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {/* Generation mode dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs bg-[#1a1a1a] border-border/30 hover:bg-[#222]"
                    >
                      {modeIcons[genMode]}
                      {modeLabels[genMode]}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-36">
                    <DropdownMenuItem onClick={() => setGenMode("dialog-edit")} className="gap-2 text-xs">
                      <Sparkles className="h-3.5 w-3.5" />
                      对话改图
                      {genMode === "dialog-edit" && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setGenMode("image-gen")} className="gap-2 text-xs">
                      <ImagePlus className="h-3.5 w-3.5" />
                      图片生成
                      {genMode === "image-gen" && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setGenMode("video-gen")} className="gap-2 text-xs">
                      <Play className="h-3.5 w-3.5" />
                      视频生成
                      {genMode === "video-gen" && <Check className="h-3 w-3 ml-auto text-primary" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Regenerate button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => handleRegenerate(genMode === "image-gen" ? "image" : "video")}
                  title="重新生成"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                
                {/* @ Mention button - only for image-gen */}
                {genMode === "image-gen" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="@角色/场景"
                      >
                        <AtSign className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-52 p-0">
                      {/* Tabs */}
                      <div className="flex border-b border-border/50">
                        <button
                          className={`flex-1 py-2 text-xs font-medium transition-colors ${mentionTab === "角色" ? "text-foreground bg-secondary/50" : "text-muted-foreground hover:text-foreground"}`}
                          onClick={() => setMentionTab("角色")}
                        >
                          角色
                        </button>
                        <button
                          className={`flex-1 py-2 text-xs font-medium transition-colors ${mentionTab === "场景" ? "text-foreground bg-secondary/50" : "text-muted-foreground hover:text-foreground"}`}
                          onClick={() => setMentionTab("场景")}
                        >
                          场景
                        </button>
                      </div>
                      <div className="p-2 space-y-1">
                        {(mentionTab === "角色" ? CHARACTERS : SCENES).map((item) => (
                          <button
                            key={item.id}
                            className="flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors"
                            onClick={() => handleMention(mentionTab, item)}
                          >
                            <div
                              className="h-6 w-6 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: item.avatar }}
                            >
                              {mentionTab === "角色" ? (
                                <User className="h-3 w-3 text-white" />
                              ) : (
                                <MapPin className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="text-xs text-foreground">{item.name}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                
                {/* Model selection button - for image-gen */}
                {genMode === "image-gen" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="选择模型"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">选用模型</DropdownMenuLabel>
                      {IMAGE_MODELS.map((model) => (
                        <DropdownMenuItem
                          key={model.id}
                          onClick={() => setSelectedImageModel(model.id)}
                          className="flex flex-col items-start gap-0.5"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="text-xs font-medium">{model.name}</span>
                            {selectedImageModel === model.id && <Check className="h-3 w-3 text-primary" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{model.desc}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                {/* Video settings button - for video-gen */}
                {genMode === "video-gen" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="视频设置"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-3 space-y-3">
                      {/* Resolution */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">分辨率</span>
                        <div className="flex items-center gap-1 bg-secondary/50 rounded p-0.5">
                          {RESOLUTIONS.map((res) => (
                            <button
                              key={res}
                              className={`px-2 py-1 text-[10px] rounded transition-colors ${selectedResolution === res ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                              onClick={() => setSelectedResolution(res)}
                            >
                              {res}
                              {res === "1080P" && <span className="ml-0.5 text-score-yellow">★</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Model */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">选用模型</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-secondary/50">
                              {VIDEO_MODELS.find(m => m.id === selectedVideoModel)?.name || "智能选择"}
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {VIDEO_MODELS.map((model) => (
                              <DropdownMenuItem
                                key={model.id}
                                onClick={() => setSelectedVideoModel(model.id)}
                                className="flex flex-col items-start gap-0.5"
                              >
                                <div className="flex w-full items-center justify-between">
                                  <span className="text-xs font-medium">{model.name}</span>
                                  {selectedVideoModel === model.id && <Check className="h-3 w-3 text-primary" />}
                                </div>
                                <span className="text-[10px] text-muted-foreground">{model.desc}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {/* Duration */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">视频时长</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-secondary/50">
                              {selectedDuration}
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {DURATIONS.map((dur) => (
                              <DropdownMenuItem
                                key={dur}
                                onClick={() => setSelectedDuration(dur)}
                                className="text-xs"
                              >
                                {dur}
                                {selectedDuration === dur && <Check className="h-3 w-3 ml-auto text-primary" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      {/* Trim to audio */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">裁剪至配音时长</span>
                        <Switch
                          checked={trimToAudio}
                          onCheckedChange={setTrimToAudio}
                          className="scale-75"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Credits indicator */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  <span>10</span>
                </div>

                {/* Send button */}
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90"
                  onClick={handleGenerate}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </section>

          {/* Tags */}
          {shot.tags.length > 0 && (
            <>
              <Separator className="bg-border/30" />
              <div className="flex flex-wrap gap-1">
                {shot.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] bg-secondary/50 text-muted-foreground">{tag}</Badge>
                ))}
              </div>
            </>
          )}
          
          <Separator className="bg-border/30" />
          
          {/* Approve Shot Button */}
          <Button
            className="w-full h-9 text-sm bg-score-green hover:bg-score-green/90 text-background font-medium"
            onClick={handleApproveThisShot}
            disabled={shot.status === "approved"}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {shot.status === "approved" ? "已通过" : "审核通过"}
          </Button>
        </div>
      </ScrollArea>
    </aside>
  )
}
