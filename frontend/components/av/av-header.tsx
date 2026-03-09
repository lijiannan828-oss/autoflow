"use client"

import { ArrowLeft, Check, CheckCheck, FileDown, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { REVIEW_STEPS, type ReviewStep, type EpisodeSummary } from "@/lib/types"

interface AVHeaderProps {
  projectName: string
  episodeTitle: string
  currentStep: ReviewStep
  completedSteps: ReviewStep[]
  totalShots: number
  matchedSfx: number
  matchedBgm: number
  episodeSummary: EpisodeSummary
  onBack?: () => void
  onExportRough?: () => void
  onApproveAll?: () => void
}

export function AVHeader({
  projectName,
  episodeTitle,
  currentStep,
  completedSteps,
  totalShots,
  matchedSfx,
  matchedBgm,
  episodeSummary,
  onBack,
  onExportRough,
  onApproveAll,
}: AVHeaderProps) {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border/50 bg-[#0d0d0d] px-4">
      {/* Left: back + project title + episode */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回我的任务
        </Button>

        {/* Project title with dropdown */}
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-secondary/40 rounded px-2 py-1 transition-colors">
          <span className="text-sm font-medium text-foreground">{projectName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {/* Episode badge */}
        <div className="flex items-center gap-1.5 rounded-full bg-secondary/60 px-2.5 py-1">
          <span className="text-xs text-muted-foreground">{episodeTitle}</span>
        </div>

        {/* Episode summary stats */}
        <div className="hidden lg:flex items-center ml-2 text-[11px] text-muted-foreground">
          剧集共
          <span className="mx-0.5 font-medium text-foreground">{episodeSummary.total}</span>
          集，其中
          <span className="mx-0.5 font-medium text-score-green">{episodeSummary.approved}</span>
          集已通过，
          <span className="mx-0.5 font-medium text-score-yellow">{episodeSummary.inProgress}</span>
          集修改中，
          <span className="mx-0.5 font-medium text-muted-foreground">{episodeSummary.pending}</span>
          集待审阅
        </div>
      </div>

      {/* Center: step progress indicator */}
      <div className="flex items-center gap-0">
        {REVIEW_STEPS.map((step, i) => {
          const isCompleted = completedSteps.includes(step.id)
          const isCurrent = step.id === currentStep
          const isPending = !isCompleted && !isCurrent

          return (
            <div key={step.id} className="flex items-center">
              {/* Step */}
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                    isCompleted && "bg-emerald-500 text-white",
                    isCurrent && "bg-emerald-500 text-white ring-2 ring-emerald-500/30",
                    isPending && "bg-secondary text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium whitespace-nowrap",
                    isCompleted && "text-emerald-500",
                    isCurrent && "text-emerald-400",
                    isPending && "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {i < REVIEW_STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-px w-8",
                    isCompleted ? "bg-emerald-500/50" : "bg-border/50"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Right: progress stats + actions */}
      <div className="flex items-center gap-3">
        {/* Progress stats */}
        <div className="text-[11px] text-muted-foreground">
          本集共
          <span className="mx-0.5 font-medium text-foreground">{totalShots}</span>
          个分镜，匹配
          <span className="mx-0.5 font-medium text-emerald-400">{matchedSfx}</span>
          个音效、
          <span className="mx-0.5 font-medium text-purple-400">{matchedBgm}</span>
          段bgm
        </div>

        <div className="h-4 w-px bg-border/40" />

        {/* Export rough cut button */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs border-border/50 hover:bg-secondary/60"
          onClick={onExportRough}
        >
          <FileDown className="h-3.5 w-3.5" />
          导出粗剪
        </Button>

        {/* Approve all button */}
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-4"
          onClick={onApproveAll}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          本集通过
        </Button>

        {/* User identity badge */}
        <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-2.5 py-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
            Q
          </div>
          <span className="text-[11px] font-medium text-foreground">一级质检专员</span>
        </div>
      </div>
    </header>
  )
}
