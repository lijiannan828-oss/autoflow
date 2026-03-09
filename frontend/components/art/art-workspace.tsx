"use client"

import { useRef, useEffect, useCallback, useMemo } from "react"
import { Sparkles, Palette, Users, MapPin, Package, Lock, Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AssetCard } from "./asset-card"
import type { ArtAssetsData, ArtSection } from "@/lib/art-types"

interface ArtWorkspaceProps {
  data: ArtAssetsData
  onSectionChange: (section: ArtSection) => void
  onSelectAsset: (type: "style" | "character" | "scene" | "prop", id: string) => void
  onLockImage: (type: "character" | "scene" | "prop", entityId: string, imageId: string) => void
  onLockStyle: () => void
  onEditPrompt: (type: "character" | "scene" | "prop", entityId: string, imageId: string) => void
}

export function ArtWorkspace({
  data,
  onSectionChange,
  onSelectAsset,
  onLockImage,
  onLockStyle,
  onEditPrompt,
}: ArtWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<ArtSection, HTMLDivElement | null>>({
    highlights: null,
    style: null,
    characters: null,
    scenes: null,
    props: null,
  })

  // Track scroll position and update active section
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const scrollTop = container.scrollTop
    const sections: ArtSection[] = ["highlights", "style", "characters", "scenes", "props"]
    
    for (const section of sections) {
      const el = sectionRefs.current[section]
      if (el) {
        const { offsetTop, offsetHeight } = el
        if (scrollTop >= offsetTop - 100 && scrollTop < offsetTop + offsetHeight - 100) {
          onSectionChange(section)
          break
        }
      }
    }
  }, [onSectionChange])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll)
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  // Sort images by score (descending)
  const sortByScore = <T extends { score: number }>(images: T[]): T[] => {
    return [...images].sort((a, b) => b.score - a.score)
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-6 space-y-12">
      {/* Section 1: Script Highlights */}
      <section
        ref={(el) => { sectionRefs.current.highlights = el }}
        id="highlights"
        className="space-y-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">剧本亮点提炼</h2>
        </div>
        
        {/* Script summary */}
        <div className="p-4 rounded-lg bg-card/50 border border-border/30">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.scriptSummary}
          </p>
        </div>

        {/* 3 highlights */}
        <div className="space-y-4">
          {data.highlights.map((h) => (
            <div key={h.id} className="p-4 rounded-lg bg-card border border-border/30">
              <h3 className="text-sm font-semibold text-primary mb-2">{h.title}</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">{h.content}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Art Style / Mood - now selectable with lock button */}
      <section
        ref={(el) => { sectionRefs.current.style = el }}
        id="style"
        className="space-y-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">影调与氛围</h2>
        </div>

        <div 
          className="p-4 rounded-lg bg-card border border-border/30 space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => onSelectAsset("style", data.artStyle.id)}
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-foreground">{data.artStyle.baseStyle}</h3>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${data.artStyle.isLocked ? "text-score-green" : "text-muted-foreground"}`}
              onClick={(e) => {
                e.stopPropagation()
                onLockStyle()
              }}
            >
              {data.artStyle.isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.artStyle.visualDescription}
          </p>
        </div>
      </section>

      {/* Section 3: Characters */}
      <section
        ref={(el) => { sectionRefs.current.characters = el }}
        id="characters"
        className="space-y-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">核心人物</h2>
        </div>

        {/* Summary list */}
        <div className="p-4 rounded-lg bg-card/50 border border-border/30 space-y-2">
          {data.characters.map((char) => (
            <div key={char.id} className="flex items-start gap-2">
              <span className="text-sm font-medium text-foreground shrink-0">{char.name}：</span>
              <span className="text-sm text-muted-foreground">{char.description}</span>
            </div>
          ))}
        </div>

        {/* Character grids */}
        {data.characters.map((char) => (
          <div key={char.id} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{char.name}</h3>
            
            {/* Character image grid - 4 candidates sorted by score */}
            <div className="grid grid-cols-4 gap-3">
              {sortByScore(char.images).map((img) => (
                <AssetCard
                  key={img.id}
                  id={img.id}
                  name={char.name}
                  thumbnailColor={img.thumbnailColor}
                  prompt={char.prompt}
                  score={img.score}
                  isLocked={char.lockedImageId === img.id}
                  showAudioIcon={true}
                  onLock={(imageId) => onLockImage("character", char.id, imageId)}
                  onEditPrompt={(imageId) => onEditPrompt("character", char.id, imageId)}
                  onSelect={() => onSelectAsset("character", char.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Section 4: Scenes */}
      <section
        ref={(el) => { sectionRefs.current.scenes = el }}
        id="scenes"
        className="space-y-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">核心场景</h2>
        </div>

        {/* Summary list */}
        <div className="p-4 rounded-lg bg-card/50 border border-border/30 space-y-2">
          {data.scenes.map((scene) => (
            <div key={scene.id} className="flex items-start gap-2">
              <span className="text-sm font-medium text-foreground shrink-0">{scene.name}：</span>
              <span className="text-sm text-muted-foreground">{scene.description}</span>
            </div>
          ))}
        </div>

        {/* Scene grids */}
        {data.scenes.map((scene) => (
          <div key={scene.id} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{scene.name}</h3>
            
            {/* Scene image grid - 4 candidates sorted by score */}
            <div className="grid grid-cols-4 gap-3">
              {sortByScore(scene.images).map((img) => (
                <AssetCard
                  key={img.id}
                  id={img.id}
                  name={scene.name}
                  thumbnailColor={img.thumbnailColor}
                  prompt={scene.prompt}
                  score={img.score}
                  isLocked={scene.lockedImageId === img.id}
                  onLock={(imageId) => onLockImage("scene", scene.id, imageId)}
                  onEditPrompt={(imageId) => onEditPrompt("scene", scene.id, imageId)}
                  onSelect={() => onSelectAsset("scene", scene.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Section 5: Props */}
      <section
        ref={(el) => { sectionRefs.current.props = el }}
        id="props"
        className="space-y-6 pb-12"
      >
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">核心道具</h2>
        </div>

        {/* Summary list */}
        <div className="p-4 rounded-lg bg-card/50 border border-border/30 space-y-2">
          {data.props.map((prop) => (
            <div key={prop.id} className="flex items-start gap-2">
              <span className="text-sm font-medium text-foreground shrink-0">{prop.name}：</span>
              <span className="text-sm text-muted-foreground">{prop.description}</span>
            </div>
          ))}
        </div>

        {/* Prop grids */}
        {data.props.map((prop) => (
          <div key={prop.id} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{prop.name}</h3>
            
            {/* Prop image grid - 4 candidates sorted by score */}
            <div className="grid grid-cols-4 gap-3">
              {sortByScore(prop.images).map((img) => (
                <AssetCard
                  key={img.id}
                  id={img.id}
                  name={prop.name}
                  thumbnailColor={img.thumbnailColor}
                  prompt={prop.prompt}
                  score={img.score}
                  isLocked={prop.lockedImageId === img.id}
                  onLock={(imageId) => onLockImage("prop", prop.id, imageId)}
                  onEditPrompt={(imageId) => onEditPrompt("prop", prop.id, imageId)}
                  onSelect={() => onSelectAsset("prop", prop.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
