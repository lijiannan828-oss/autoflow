"use client"

import { History, RotateCcw, FileVideo } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { RevisionEntry, HistoricalVideo } from "@/lib/final-types"

interface RevisionPanelProps {
  revisionHistory: RevisionEntry[]
  historicalVideos: HistoricalVideo[]
  onRevertToVersion: (videoId: string) => void
}

export function RevisionPanel({
  revisionHistory,
  historicalVideos,
  onRevertToVersion,
}: RevisionPanelProps) {
  if (revisionHistory.length === 0 && historicalVideos.length === 0) {
    return null
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-border/50 bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex h-10 items-center gap-2 border-b border-border/30 px-3">
        <History className="h-3.5 w-3.5 text-score-yellow" />
        <span className="text-xs font-medium text-foreground">修改记录</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Revision history */}
          {revisionHistory.map((rev) => (
            <div key={rev.id} className="space-y-2">
              <p className="text-xs text-muted-foreground">{rev.summary}</p>
              <div className="space-y-1.5">
                {rev.changes.map((change, i) => (
                  <div
                    key={i}
                    className="flex gap-2 rounded bg-secondary/40 p-2"
                  >
                    <span className="shrink-0 text-[10px] font-mono text-score-yellow">
                      {change.timeCode}
                    </span>
                    <p className="text-[11px] text-foreground leading-relaxed">
                      {change.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Historical videos */}
          {historicalVideos.length > 0 && (
            <div className="pt-3 border-t border-border/30">
              <div className="flex items-center gap-2 mb-3">
                <FileVideo className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">历史版本</span>
              </div>
              <div className="space-y-2">
                {historicalVideos.map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center gap-3 rounded-lg bg-secondary/40 p-2"
                  >
                    {/* Thumbnail */}
                    <div
                      className="h-10 w-16 rounded shrink-0"
                      style={{ backgroundColor: video.thumbnailColor }}
                    />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground">
                        版本 {video.version}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(video.createdAt).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    {/* Revert button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => onRevertToVersion(video.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      应用
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
