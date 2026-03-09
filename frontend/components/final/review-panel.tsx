"use client"

import { useState } from "react"
import { MapPin, ChevronLeft, ChevronRight, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { REVIEW_CATEGORIES, formatLongTimecode } from "@/lib/final-types"
import type { ReviewPoint, ReviewCategory } from "@/lib/final-types"

interface ReviewPanelProps {
  currentTimestamp: number
  isPaused: boolean
  reviewPoints: ReviewPoint[]
  onAddReviewPoint: (point: Omit<ReviewPoint, "id" | "createdAt">) => void
}

export function ReviewPanel({
  currentTimestamp,
  isPaused,
  reviewPoints,
  onAddReviewPoint,
}: ReviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [comment, setComment] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<ReviewCategory[]>([])

  const handleCategoryToggle = (category: ReviewCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    )
  }

  const handleSubmit = () => {
    if (!comment.trim() || selectedCategories.length === 0) return

    onAddReviewPoint({
      timestamp: currentTimestamp,
      timecode: formatLongTimecode(currentTimestamp),
      comment: comment.trim(),
      categories: selectedCategories,
    })

    setComment("")
    setSelectedCategories([])
  }

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-l border-border/50 bg-[#0d0d0d] transition-all duration-300",
        isExpanded ? "w-[320px]" : "w-10"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex h-10 items-center justify-center border-b border-border/30 hover:bg-secondary/40 transition-colors"
      >
        {isExpanded ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <>
          {/* Review input area */}
          <div className="p-3 border-b border-border/30 space-y-3">
            {/* Timestamp capture */}
            <div className="flex items-center gap-2 rounded bg-secondary/60 px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-score-yellow shrink-0" />
              <span className="text-xs text-muted-foreground">审阅打点：</span>
              <span className="text-xs font-mono text-foreground">
                {formatLongTimecode(currentTimestamp)}
              </span>
              {isPaused && (
                <span className="ml-auto text-[10px] text-score-green">(已暂停)</span>
              )}
            </div>

            {/* Comment input */}
            <Textarea
              placeholder="输入修改意见，如：这里的转场太生硬，且BGM没有卡上点"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px] text-xs resize-none bg-secondary/40 border-border/50"
            />

            {/* Category selector */}
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">
                问题分类（用于分配给对应处理模块）
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {REVIEW_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <Checkbox
                      id={cat.id}
                      checked={selectedCategories.includes(cat.id)}
                      onCheckedChange={() => handleCategoryToggle(cat.id)}
                      className="h-3.5 w-3.5"
                    />
                    <Label
                      htmlFor={cat.id}
                      className="text-[11px] text-foreground cursor-pointer"
                    >
                      {cat.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <Button
              size="sm"
              className="w-full h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={!comment.trim() || selectedCategories.length === 0}
            >
              <Send className="h-3 w-3" />
              添加审阅打点
            </Button>
          </div>

          {/* Review points list */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-muted-foreground">已添加的打点</span>
                <span className="text-[10px] text-muted-foreground">
                  {reviewPoints.length} 个
                </span>
              </div>

              {reviewPoints.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MapPin className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    暂无打点记录
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    暂停视频后添加审阅意见
                  </p>
                </div>
              ) : (
                reviewPoints.map((point) => (
                  <div
                    key={point.id}
                    className="rounded-lg bg-secondary/40 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-score-yellow">
                        {point.timecode}
                      </span>
                      <div className="flex gap-1">
                        {point.categories.map((cat) => (
                          <span
                            key={cat}
                            className="px-1.5 py-0.5 rounded text-[9px] bg-primary/20 text-primary"
                          >
                            {REVIEW_CATEGORIES.find((c) => c.id === cat)?.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-foreground leading-relaxed">
                      {point.comment}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  )
}
