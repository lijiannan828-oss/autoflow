"use client"

import { useState, useEffect } from "react"
import { Volume2, Clock } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SelectedItem, AudioClip, VideoClip, SubtitleClip } from "@/lib/av-types"

interface PropertiesPanelProps {
  selectedItem: SelectedItem
  audioClips: AudioClip[]
  videoClips: VideoClip[]
  subtitleClips: SubtitleClip[]
  onVolumeChange: (clipId: string, volume: number) => void
  onFadeChange: (clipId: string, fadeIn: number, fadeOut: number) => void
}

export function PropertiesPanel({
  selectedItem,
  audioClips,
  videoClips,
  subtitleClips,
  onVolumeChange,
  onFadeChange,
}: PropertiesPanelProps) {
  const selectedAudio = selectedItem?.type === "audio" 
    ? audioClips.find((c) => c.id === selectedItem.id) 
    : null
  const selectedVideo = selectedItem?.type === "video"
    ? videoClips.find((c) => c.id === selectedItem.id)
    : null
  const selectedSubtitle = selectedItem?.type === "subtitle"
    ? subtitleClips.find((c) => c.id === selectedItem.id)
    : null

  const [localVolume, setLocalVolume] = useState(selectedAudio?.volume ?? 100)
  const [localFadeIn, setLocalFadeIn] = useState(selectedAudio?.fadeIn ?? 0)
  const [localFadeOut, setLocalFadeOut] = useState(selectedAudio?.fadeOut ?? 0)

  // Update local state when selection changes
  useEffect(() => {
    if (selectedAudio) {
      setLocalVolume(selectedAudio.volume)
      setLocalFadeIn(selectedAudio.fadeIn)
      setLocalFadeOut(selectedAudio.fadeOut)
    }
  }, [selectedAudio])

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-border/50 bg-[#121212]">
      {/* Header */}
      <div className="flex h-11 items-center border-b border-border/50 px-4">
        <h3 className="text-sm font-medium">属性面板</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedItem ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <div className="text-muted-foreground text-sm">
              选择时间轴上的片段<br />以查看和编辑属性
            </div>
          </div>
        ) : selectedAudio ? (
          <div className="space-y-5">
            {/* Clip info */}
            <div className="p-3 rounded-lg bg-card border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: selectedAudio.waveformColor }}
                />
                <span className="text-sm font-medium">{selectedAudio.name}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>类型: {selectedAudio.type === "voiceover" ? "配音" : selectedAudio.type === "sfx" ? "音效" : "音乐"}</div>
                <div>时长: {selectedAudio.duration.toFixed(2)}s</div>
                {selectedAudio.character && <div>角色: {selectedAudio.character}</div>}
              </div>
            </div>

            {/* Volume */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5" />
                  音量
                </Label>
                <span className="text-xs text-muted-foreground">{localVolume}%</span>
              </div>
              <Slider
                value={[localVolume]}
                onValueChange={([v]) => setLocalVolume(v)}
                onValueCommit={([v]) => onVolumeChange(selectedAudio.id, v)}
                max={150}
                step={1}
                className="w-full"
              />
            </div>

            {/* Fade controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">淡入 (s)</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={localFadeIn}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0
                    setLocalFadeIn(v)
                    onFadeChange(selectedAudio.id, v, localFadeOut)
                  }}
                  className="h-8 bg-card border-border/50 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">淡出 (s)</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={localFadeOut}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0
                    setLocalFadeOut(v)
                    onFadeChange(selectedAudio.id, localFadeIn, v)
                  }}
                  className="h-8 bg-card border-border/50 text-sm"
                />
              </div>
            </div>
          </div>
        ) : selectedVideo ? (
          <div className="space-y-4">
            {/* Video clip info */}
            <div className="p-3 rounded-lg bg-card border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-3 w-3 rounded"
                  style={{ backgroundColor: selectedVideo.thumbnailColor }}
                />
                <span className="text-sm font-medium">{selectedVideo.name}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>时长: {selectedVideo.duration.toFixed(2)}s</div>
                <div>入点: {selectedVideo.inPoint.toFixed(2)}s</div>
                <div>出点: {selectedVideo.outPoint.toFixed(2)}s</div>
              </div>
            </div>
          </div>
        ) : selectedSubtitle ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-card border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-sm font-medium">字幕</span>
              </div>
              <p className="text-sm text-foreground mb-2">{selectedSubtitle.text}</p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div>时长: {selectedSubtitle.duration.toFixed(2)}s</div>
                {selectedSubtitle.speaker && <div>角色: {selectedSubtitle.speaker}</div>}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
