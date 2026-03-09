"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReviewStageInfo } from "@/lib/final-types"

interface ReviewProgressTrackerProps {
  stages: ReviewStageInfo[]
}

export function ReviewProgressTracker({ stages }: ReviewProgressTrackerProps) {
  return (
    <div className="flex items-center justify-center gap-0 py-3 bg-[#0d0d0d]/50">
      {stages.map((stage, i) => {
        const isCompleted = stage.status === "completed"
        const isCurrent = stage.status === "current"
        const isPending = stage.status === "pending"

        return (
          <div key={stage.id} className="flex items-center">
            {/* Stage node */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                  isCompleted && "bg-emerald-500 border-emerald-500",
                  isCurrent && "bg-transparent border-emerald-500",
                  isPending && "bg-transparent border-muted-foreground/40"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                ) : isCurrent ? (
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                ) : null}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCompleted && "text-emerald-500",
                  isCurrent && "text-emerald-400",
                  isPending && "text-muted-foreground/60"
                )}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector line */}
            {i < stages.length - 1 && (
              <div
                className={cn(
                  "mx-4 h-px w-16",
                  isCompleted ? "bg-emerald-500" : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
