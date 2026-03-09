"use client"

import { ArrowLeft, Check, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AssetReviewSummary } from "@/lib/art-types"

// Review step indicator
const steps = [
  { id: 1, label: "美术资产" },
  { id: 2, label: "视觉素材" },
  { id: 3, label: "视听整合" },
  { id: 4, label: "成片合成" },
]

interface ArtHeaderProps {
  projectName: string
  summary: AssetReviewSummary
  onBack: () => void
  onApproveAll: () => void
}

export function ArtHeader({
  projectName,
  summary,
  onBack,
  onApproveAll,
}: ArtHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/40 bg-[#0d0d0d] px-4">
      {/* Left: back + project name */}
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

        <div className="h-4 w-px bg-border/40" />

        <h1 className="text-sm font-medium text-foreground">{projectName}</h1>

        {/* Asset review summary */}
        <span className="text-xs text-muted-foreground">
          已通过: <span className="text-score-green font-medium">{summary.approved}</span>
          <span className="mx-1">/</span>
          <span className="text-foreground">{summary.total}</span>
          <span className="mx-2">|</span>
          待审阅: <span className="text-muted-foreground">{summary.pending}</span>
        </span>
      </div>

      {/* Center: step indicator */}
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => {
          const isActive = step.id === 1
          const isCompleted = false // Step 1 is current, none completed yet

          return (
            <div key={step.id} className="flex items-center">
              {idx > 0 && <div className="w-8 h-px bg-border/50 mx-1" />}
              <div className="flex items-center gap-1.5">
                <div
                  className={`
                    flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
                    ${isCompleted
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-emerald-500 text-white"
                        : "bg-[#1a1a1a] border border-border/50 text-muted-foreground"
                    }
                  `}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : step.id}
                </div>
                <span
                  className={`text-[11px] ${
                    isActive || isCompleted ? "text-emerald-400 font-medium" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs bg-score-green text-background hover:bg-score-green/90 rounded-md px-4"
          onClick={onApproveAll}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          全部确认
        </Button>

        {/* User identity badge */}
        <div className="mx-1 h-4 w-px bg-border/40" />
        <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-2.5 py-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            M
          </div>
          <span className="text-[11px] font-medium text-foreground">中台剪辑</span>
        </div>
      </div>
    </header>
  )
}
