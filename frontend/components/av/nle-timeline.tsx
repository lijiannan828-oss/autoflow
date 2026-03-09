"use client"

import { useRef, useCallback, useMemo } from "react"
import { Volume2, VolumeX, Lock, Unlock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Track, VideoClip, AudioClip, SubtitleClip, SelectedItem } from "@/lib/av-types"

interface NLETimelineProps {
  tracks: Track[]
  videoClips: VideoClip[]
  audioClips: AudioClip[]
  subtitleClips: SubtitleClip[]
  currentTime: number
  totalDuration: number
  pixelsPerSecond: number
  selectedItem: SelectedItem
  onSeek: (time: number) => void
  onSelectItem: (item: SelectedItem) => void
  onToggleTrackMute: (trackId: string) => void
  onToggleTrackLock: (trackId: string) => void
}

export function NLETimeline({
  tracks,
  videoClips,
  audioClips,
  subtitleClips,
  currentTime,
  totalDuration,
  pixelsPerSecond,
  selectedItem,
  onSeek,
  onSelectItem,
  onToggleTrackMute,
  onToggleTrackLock,
}: NLETimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLDivElement>(null)

  const timelineWidth = totalDuration * pixelsPerSecond
  const playheadPosition = currentTime * pixelsPerSecond

  // Generate time ruler marks
  const rulerMarks = useMemo(() => {
    const marks: { time: number; label: string; major: boolean }[] = []
    const majorInterval = 5 // Every 5 seconds
    const minorInterval = 1 // Every 1 second

    for (let t = 0; t <= totalDuration; t += minorInterval) {
      const isMajor = t % majorInterval === 0
      const minutes = Math.floor(t / 60)
      const seconds = Math.floor(t % 60)
      marks.push({
        time: t,
        label: isMajor ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : "",
        major: isMajor,
      })
    }
    return marks
  }, [totalDuration])

  // Handle ruler click for seeking
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rulerRef.current) return
      const rect = rulerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + (rulerRef.current.scrollLeft || 0)
      const time = Math.max(0, Math.min(totalDuration, x / pixelsPerSecond))
      onSeek(time)
    },
    [totalDuration, pixelsPerSecond, onSeek]
  )

  // Track label width
  const trackLabelWidth = 100

  return (
    <div className="flex h-full flex-col bg-[#0d0d0d] border-t border-border/50">
      {/* Time ruler */}
      <div className="flex h-6 shrink-0 border-b border-border/30">
        {/* Empty space for track labels */}
        <div className="w-[100px] shrink-0 border-r border-border/30" />

        {/* Ruler */}
        <div
          ref={rulerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden cursor-pointer"
          onClick={handleRulerClick}
        >
          <div className="relative h-full" style={{ width: timelineWidth }}>
            {/* Ruler marks */}
            {rulerMarks.map((mark) => (
              <div
                key={mark.time}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: mark.time * pixelsPerSecond }}
              >
                <div
                  className={cn(
                    "w-px",
                    mark.major ? "h-4 bg-muted-foreground/50" : "h-2 bg-border/50"
                  )}
                />
                {mark.label && (
                  <span className="text-[9px] text-muted-foreground/70 mt-0.5">{mark.label}</span>
                )}
              </div>
            ))}

            {/* Playhead on ruler */}
            <div
              className="absolute top-0 h-full w-0.5 bg-red-500"
              style={{ left: playheadPosition, transform: "translateX(-50%)" }}
            >
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rounded-sm rotate-45" />
            </div>
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div ref={timelineRef} className="flex flex-1 overflow-y-auto">
        {/* Track labels column */}
        <div className="w-[100px] shrink-0 border-r border-border/30 bg-[#0a0a0a]">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center justify-between border-b border-border/20 px-2"
              style={{ height: track.height }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-sm"
                  style={{ backgroundColor: track.color }}
                />
                <span className="text-[10px] font-medium text-muted-foreground">{track.name}</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onToggleTrackMute(track.id)}
                  className={cn(
                    "p-0.5 rounded hover:bg-secondary/50 transition-colors",
                    track.muted ? "text-red-400" : "text-muted-foreground/50"
                  )}
                >
                  {track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => onToggleTrackLock(track.id)}
                  className={cn(
                    "p-0.5 rounded hover:bg-secondary/50 transition-colors",
                    track.locked ? "text-amber-400" : "text-muted-foreground/50"
                  )}
                >
                  {track.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Track content area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width: timelineWidth, minWidth: "100%" }}>
            {/* Tracks content */}
            {tracks.map((track) => (
              <div
                key={track.id}
                className="relative border-b border-border/20"
                style={{ height: track.height }}
              >
                {/* Track background grid */}
                <div className="absolute inset-0 timeline-grid opacity-30" />

                {/* Render clips based on track type */}
                {track.type === "subtitle" &&
                  subtitleClips.map((clip) => (
                    <SubtitleClipBlock
                      key={clip.id}
                      clip={clip}
                      pixelsPerSecond={pixelsPerSecond}
                      trackHeight={track.height}
                      isSelected={selectedItem?.type === "subtitle" && selectedItem.id === clip.id}
                      onSelect={() => onSelectItem({ type: "subtitle", id: clip.id })}
                    />
                  ))}

                {track.type === "video" &&
                  videoClips.map((clip) => (
                    <VideoClipBlock
                      key={clip.id}
                      clip={clip}
                      pixelsPerSecond={pixelsPerSecond}
                      trackHeight={track.height}
                      trackColor={track.color}
                      isSelected={selectedItem?.type === "video" && selectedItem.id === clip.id}
                      onSelect={() => onSelectItem({ type: "video", id: clip.id })}
                    />
                  ))}

                {track.type === "voiceover" &&
                  audioClips
                    .filter((c) => c.type === "voiceover")
                    .map((clip) => (
                      <AudioClipBlock
                        key={clip.id}
                        clip={clip}
                        pixelsPerSecond={pixelsPerSecond}
                        trackHeight={track.height}
                        trackColor={track.color}
                        isSelected={selectedItem?.type === "audio" && selectedItem.id === clip.id}
                        onSelect={() => onSelectItem({ type: "audio", id: clip.id })}
                      />
                    ))}

                {track.type === "sfx" &&
                  audioClips
                    .filter((c) => c.type === "sfx")
                    .map((clip) => (
                      <AudioClipBlock
                        key={clip.id}
                        clip={clip}
                        pixelsPerSecond={pixelsPerSecond}
                        trackHeight={track.height}
                        trackColor={track.color}
                        isSelected={selectedItem?.type === "audio" && selectedItem.id === clip.id}
                        onSelect={() => onSelectItem({ type: "audio", id: clip.id })}
                      />
                    ))}

                {track.type === "bgm" &&
                  audioClips
                    .filter((c) => c.type === "bgm")
                    .map((clip) => (
                      <AudioClipBlock
                        key={clip.id}
                        clip={clip}
                        pixelsPerSecond={pixelsPerSecond}
                        trackHeight={track.height}
                        trackColor={track.color}
                        isSelected={selectedItem?.type === "audio" && selectedItem.id === clip.id}
                        onSelect={() => onSelectItem({ type: "audio", id: clip.id })}
                      />
                    ))}
              </div>
            ))}

            {/* Playhead line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
              style={{ left: playheadPosition, transform: "translateX(-50%)" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Clip Components =====

interface VideoClipBlockProps {
  clip: VideoClip
  pixelsPerSecond: number
  trackHeight: number
  trackColor: string
  isSelected: boolean
  onSelect: () => void
}

function VideoClipBlock({ clip, pixelsPerSecond, trackHeight, trackColor, isSelected, onSelect }: VideoClipBlockProps) {
  const width = clip.duration * pixelsPerSecond
  const left = clip.startTime * pixelsPerSecond

  return (
    <div
      onClick={onSelect}
      className={cn(
        "absolute top-1 bottom-1 rounded cursor-pointer transition-all overflow-hidden group",
        isSelected ? "ring-2 ring-white/70" : "hover:ring-1 hover:ring-white/30"
      )}
      style={{
        left,
        width,
        backgroundColor: clip.thumbnailColor,
      }}
    >
      {/* Thumbnail strip simulation */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: Math.ceil(width / 40) }, (_, i) => (
          <div
            key={i}
            className="h-full w-10 shrink-0 border-r border-black/20"
            style={{ backgroundColor: `${clip.thumbnailColor}${i % 2 ? "cc" : ""}` }}
          />
        ))}
      </div>

      {/* Label */}
      <div className="absolute top-1 left-1.5 text-[9px] font-medium text-white drop-shadow-md">
        {clip.name}
      </div>

      {/* Trim handles */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/20 opacity-0 group-hover:opacity-100 cursor-ew-resize" />
      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/20 opacity-0 group-hover:opacity-100 cursor-ew-resize" />
    </div>
  )
}

interface AudioClipBlockProps {
  clip: AudioClip
  pixelsPerSecond: number
  trackHeight: number
  trackColor: string
  isSelected: boolean
  onSelect: () => void
}

function AudioClipBlock({ clip, pixelsPerSecond, trackHeight, trackColor, isSelected, onSelect }: AudioClipBlockProps) {
  const width = clip.duration * pixelsPerSecond
  const left = clip.startTime * pixelsPerSecond

  // Generate waveform bars
  const barCount = Math.max(8, Math.floor(width / 4))

  return (
    <div
      onClick={onSelect}
      className={cn(
        "absolute top-1 bottom-1 rounded cursor-pointer transition-all overflow-hidden",
        isSelected ? "ring-2 ring-white/70" : "hover:ring-1 hover:ring-white/30"
      )}
      style={{
        left,
        width,
        backgroundColor: `${trackColor}40`,
      }}
    >
      {/* Waveform visualization */}
      <div className="absolute inset-0 flex items-center justify-around px-1 gap-px">
        {Array.from({ length: barCount }, (_, i) => {
          const height = 20 + Math.random() * 60
          return (
            <div
              key={i}
              className="w-0.5 rounded-full"
              style={{
                height: `${height}%`,
                backgroundColor: trackColor,
                opacity: 0.7,
              }}
            />
          )
        })}
      </div>

      {/* Label */}
      {width > 50 && (
        <div className="absolute top-0.5 left-1.5 text-[8px] font-medium text-white drop-shadow-md truncate max-w-[90%]">
          {clip.name}
        </div>
      )}
    </div>
  )
}

interface SubtitleClipBlockProps {
  clip: SubtitleClip
  pixelsPerSecond: number
  trackHeight: number
  isSelected: boolean
  onSelect: () => void
}

function SubtitleClipBlock({ clip, pixelsPerSecond, trackHeight, isSelected, onSelect }: SubtitleClipBlockProps) {
  const width = clip.duration * pixelsPerSecond
  const left = clip.startTime * pixelsPerSecond

  return (
    <div
      onClick={onSelect}
      className={cn(
        "absolute top-0.5 bottom-0.5 rounded cursor-pointer transition-all overflow-hidden",
        isSelected ? "ring-2 ring-white/70 bg-slate-500/50" : "bg-slate-600/40 hover:ring-1 hover:ring-white/30"
      )}
      style={{ left, width }}
    >
      <div className="h-full px-1.5 flex items-center">
        <span className="text-[8px] text-white truncate">{clip.text}</span>
      </div>
    </div>
  )
}
