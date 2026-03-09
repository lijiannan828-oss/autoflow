"use client"

import { ArrowLeft, Scissors, Grid3X3, FileDown, Check, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { REVIEW_STEPS, type ReviewStep, type EpisodeSummary } from "@/lib/types"

interface TopBarProps {
  projectName: string
  currentStep: ReviewStep
  completedSteps: ReviewStep[]
  episodeSummary: EpisodeSummary
  onBack?: () => void
  onExport?: () => void
  onApproveAll?: () => void
}

export function TopBar({
  projectName,
  currentStep,
  completedSteps,
  episodeSummary,
  onBack,
  onExport,
  onApproveAll,
}: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-[#0d0d0d] px-4">
      {/* Left: back + title */}
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
        <span className="text-sm font-medium text-foreground">{projectName}</span>
        
        {/* Divider */}
        <div className="h-4 w-px bg-border/40" />
        
        {/* Episode summary stats */}
        <div className="flex items-center text-[11px] text-muted-foreground">
          <span>剧集共</span>
          <span className="mx-0.5 font-medium text-foreground">{episodeSummary.total}</span>
          <span>集，其中</span>
          <span className="mx-0.5 font-medium text-score-green">{episodeSummary.approved}</span>
          <span>集已通过，</span>
          <span className="mx-0.5 font-medium text-score-yellow">{episodeSummary.inProgress}</span>
          <span>集修改中，</span>
          <span className="mx-0.5 font-medium text-muted-foreground">{episodeSummary.pending}</span>
          <span>集待审阅</span>
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
                    isCompleted && "bg-score-green text-background",
                    isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                    isPending && "bg-secondary text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium whitespace-nowrap",
                    isCompleted && "text-score-green",
                    isCurrent && "text-foreground",
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
                    isCompleted ? "bg-score-green/50" : "bg-border/50"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Right side: tool buttons + actions + user identity */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60">
          <Scissors className="h-3.5 w-3.5" />
          裁剪分镜
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60">
          <Grid3X3 className="h-3.5 w-3.5" />
          选帧生分镜
        </Button>

        <div className="mx-1 h-4 w-px bg-border/40" />

        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs bg-score-green text-background hover:bg-score-green/90 rounded-md px-4"
          onClick={onApproveAll}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          本集通过
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onExport}
        >
          <FileDown className="h-3.5 w-3.5" />
          导出
        </Button>

        <div className="mx-1 h-4 w-px bg-border/40" />

        {/* User identity badge */}
        <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-2.5 py-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            Q
          </div>
          <span className="text-[11px] font-medium text-foreground">一级质检专员</span>
        </div>
      </div>
    </header>
  )
}
