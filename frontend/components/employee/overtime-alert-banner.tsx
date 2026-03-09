"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { OvertimeAlert } from "@/lib/employee-types"

interface OvertimeAlertBannerProps {
  alerts: OvertimeAlert[]
  onDrillDown?: (alert: OvertimeAlert) => void
}

export function OvertimeAlertBanner({ alerts, onDrillDown }: OvertimeAlertBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  if (alerts.length === 0 || isDismissed) return null

  return (
    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
      {/* Main alert row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-red-400">
              警告：当前有 {alerts.length} 部剧集整体质检周期已超过 7 天
            </p>
            <p className="text-xs text-red-400/70">
              请及时追溯延误节点，避免影响交付进度
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>点击追溯延误节点 <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-400/50 hover:text-red-400 hover:bg-red-500/20"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded detail list */}
      {isExpanded && (
        <div className="mt-3 space-y-2 border-t border-red-500/20 pt-3">
          {alerts.map((alert) => (
            <div 
              key={alert.id}
              className="flex items-center justify-between rounded-md bg-red-500/5 px-3 py-2 hover:bg-red-500/10 cursor-pointer transition-colors"
              onClick={() => onDrillDown?.(alert)}
            >
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-foreground">{alert.dramaTitle}</span>
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                  超时 {alert.daysOverdue} 天
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>当前环节：{alert.currentStage}</span>
                <span>负责人：<span className="text-foreground">{alert.currentHolder}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
