"use client"

import { useState } from "react"
import { Check, Pencil, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AssetCardProps {
  id: string
  name: string
  thumbnailColor: string
  prompt: string
  score: number
  isLocked: boolean
  showAudioIcon?: boolean
  onLock: (id: string) => void
  onEditPrompt: (id: string) => void
  onSelect: (id: string) => void
}

export function AssetCard({
  id,
  name,
  thumbnailColor,
  prompt,
  score,
  isLocked,
  showAudioIcon = false,
  onLock,
  onEditPrompt,
  onSelect,
}: AssetCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg overflow-hidden bg-card border-2 transition-all cursor-pointer",
        isLocked ? "border-score-green" : "border-transparent hover:border-primary/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(id)}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-square"
        style={{ backgroundColor: thumbnailColor }}
      >
        {/* Locked indicator */}
        {isLocked && (
          <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-score-green">
            <Check className="h-3 w-3 text-background" />
          </div>
        )}

        {/* Score badge */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-medium text-white">
          {score.toFixed(1)}
        </div>

        {/* Hover overlay with action buttons */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-3 gap-2">
            <Button
              size="sm"
              variant="secondary"
              className={cn(
                "h-7 gap-1 text-[10px]",
                isLocked && "bg-score-green/20 text-score-green border border-score-green/50"
              )}
              onClick={(e) => {
                e.stopPropagation()
                onLock(id)
              }}
            >
              <Check className="h-3 w-3" />
              {isLocked ? "已锁定" : "锁定"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 gap-1 text-[10px]"
              onClick={(e) => {
                e.stopPropagation()
                onEditPrompt(id)
              }}
            >
              <Pencil className="h-3 w-3" />
              修改
            </Button>
          </div>
        )}
      </div>

      {/* Name label */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-card">
        <span className="text-xs font-medium text-foreground truncate">{name}</span>
        {showAudioIcon && (
          <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Hover tooltip showing prompt - appears on top left */}
      {isHovered && (
        <div className="absolute left-0 top-0 -translate-y-full mb-2 w-64 p-3 rounded-lg bg-popover border border-border shadow-xl z-50 pointer-events-none">
          <h4 className="text-sm font-semibold text-foreground mb-2">{name}</h4>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">提示词：</span>
            <p className="text-xs text-foreground/80 leading-relaxed">
              {prompt}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
