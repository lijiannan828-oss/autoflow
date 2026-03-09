"use client"

import { Sparkles } from "lucide-react"

interface AIInsightsBannerProps {
  insight: string
}

export function AIInsightsBanner({ insight }: AIInsightsBannerProps) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
          <Sparkles className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-emerald-400">AI 数据诊断</span>
            <span className="text-[10px] text-muted-foreground">实时分析</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">{insight}</p>
        </div>
      </div>
    </div>
  )
}
