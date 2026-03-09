"use client"

import { Video, Image, Check, Sparkles } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import type { Shot, GachaGroup, GachaResult } from "@/lib/types"
import { getScoreColor } from "@/lib/score-utils"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface AltPanelProps {
  shot: Shot | null
  selectedGachaId?: string | null
  onSelectGacha?: (shotId: string, gachaId: string) => void
  onApplyGacha?: (shotId: string, gachaId: string) => void
}

export function AltPanel({
  shot,
  selectedGachaId,
  onSelectGacha,
  onApplyGacha,
}: AltPanelProps) {
  if (!shot || shot.gachaGroups.length === 0) {
    return (
      <div className="flex w-[140px] shrink-0 flex-col items-center justify-center bg-[#0a0a0a] border-l border-border/30">
        <span className="text-[10px] text-muted-foreground/50 text-center px-2">无抽卡结果</span>
      </div>
    )
  }

  const { keyframeCount, videoCount } = shot.gachaStats

  const handleApply = (gachaId: string) => {
    onApplyGacha?.(shot.id, gachaId)
    toast.success("已应用到时间轴")
  }

  return (
    <div className="flex w-[140px] shrink-0 flex-col bg-[#0a0a0a] border-l border-border/30">
      {/* Header with stats */}
      <div className="border-b border-border/20 px-2 py-2">
        <div className="text-[10px] text-muted-foreground mb-1">抽卡结果</div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-0.5">
            <Image className="h-2.5 w-2.5 text-primary" />
            <span className="text-primary font-medium">{keyframeCount}</span>
            <span className="text-muted-foreground">次</span>
          </span>
          <span className="flex items-center gap-0.5">
            <Video className="h-2.5 w-2.5 text-score-green" />
            <span className="text-score-green font-medium">{videoCount}</span>
            <span className="text-muted-foreground">次</span>
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-2">
          {shot.gachaGroups.map((group, groupIndex) => (
            <GachaGroupCard
              key={group.id}
              group={group}
              groupIndex={groupIndex}
              shotId={shot.id}
              selectedGachaId={selectedGachaId}
              onSelect={onSelectGacha}
              onApply={handleApply}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ===== Gacha Group Card =====
function GachaGroupCard({
  group,
  groupIndex,
  shotId,
  selectedGachaId,
  onSelect,
  onApply,
}: {
  group: GachaGroup
  groupIndex: number
  shotId: string
  selectedGachaId?: string | null
  onSelect?: (shotId: string, gachaId: string) => void
  onApply?: (gachaId: string) => void
}) {
  const isGroupSelected = group.isSelected

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden border transition-colors",
        isGroupSelected
          ? "border-primary/60 bg-primary/5"
          : "border-border/20 bg-[#111]"
      )}
    >
      {/* Group header */}
      {isGroupSelected && (
        <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 border-b border-primary/20">
          <Check className="h-2.5 w-2.5 text-primary" />
          <span className="text-[9px] text-primary font-medium">当前选中</span>
        </div>
      )}

      {/* Keyframe */}
      <GachaResultItem
        result={group.keyframe}
        shotId={shotId}
        isSelected={selectedGachaId === group.keyframe.id}
        showApply={true}
        onSelect={onSelect}
        onApply={onApply}
      />

      {/* Videos */}
      <div className="space-y-0.5 p-1 pt-0">
        {group.videos.map((video) => (
          <GachaResultItem
            key={video.id}
            result={video}
            shotId={shotId}
            isSelected={selectedGachaId === video.id}
            showApply={true}
            isSmall={true}
            onSelect={onSelect}
            onApply={onApply}
          />
        ))}
      </div>
    </div>
  )
}

// ===== Single Gacha Result Item =====
function GachaResultItem({
  result,
  shotId,
  isSelected,
  showApply,
  isSmall,
  onSelect,
  onApply,
}: {
  result: GachaResult
  shotId: string
  isSelected: boolean
  showApply?: boolean
  isSmall?: boolean
  onSelect?: (shotId: string, gachaId: string) => void
  onApply?: (gachaId: string) => void
}) {
  const scoreColor = getScoreColor(result.score)

  return (
    <div
      className={cn(
        "relative group rounded overflow-hidden cursor-pointer transition-all",
        isSelected && "ring-1 ring-primary/60",
        isSmall ? "mx-1" : "m-1"
      )}
      onClick={() => onSelect?.(shotId, result.id)}
    >
      {/* Thumbnail */}
      <div
        className={cn("w-full", isSmall ? "aspect-[16/9]" : "aspect-video")}
        style={{ backgroundColor: result.thumbnailColor }}
      />

      {/* Type icon overlay */}
      <div className="absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/60 text-[8px]">
        {result.type === "video" ? (
          <Video className="h-2.5 w-2.5 text-foreground/80" />
        ) : (
          <Image className="h-2.5 w-2.5 text-foreground/80" />
        )}
      </div>

      {/* Score badge */}
      <div className="absolute top-1 right-1">
        <span className={cn("text-[9px] font-mono font-bold px-1 py-0.5 rounded bg-black/60", scoreColor)}>
          {result.score.toFixed(1)}
        </span>
      </div>

      {/* Model label at bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-[8px] text-foreground/70">{result.model}</span>
      </div>

      {/* Selected indicator */}
      {result.isSelected && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary text-[8px] text-primary-foreground font-medium">
          <Sparkles className="h-2 w-2" />
          已选
        </div>
      )}

      {/* Hover overlay with Apply button */}
      {showApply && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button
            size="sm"
            className="h-5 text-[9px] px-2 bg-primary/90 hover:bg-primary text-primary-foreground"
            onClick={(e) => {
              e.stopPropagation()
              onApply?.(result.id)
            }}
          >
            应用
          </Button>
        </div>
      )}
    </div>
  )
}
