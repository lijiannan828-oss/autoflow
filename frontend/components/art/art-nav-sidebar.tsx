"use client"

import { Sparkles, Palette, Users, MapPin, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ArtSection } from "@/lib/art-types"

const navItems: { id: ArtSection; label: string; icon: React.ElementType }[] = [
  { id: "highlights", label: "剧本亮点提炼", icon: Sparkles },
  { id: "style", label: "影调与氛围", icon: Palette },
  { id: "characters", label: "核心人物", icon: Users },
  { id: "scenes", label: "核心场景", icon: MapPin },
  { id: "props", label: "核心道具", icon: Package },
]

interface ArtNavSidebarProps {
  activeSection: ArtSection
  onNavigate: (section: ArtSection) => void
}

export function ArtNavSidebar({ activeSection, onNavigate }: ArtNavSidebarProps) {
  return (
    <aside className="w-48 shrink-0 border-r border-border/40 bg-sidebar p-3">
      {/* Logo */}
      <div className="flex items-center justify-center py-3 mb-4">
        <span className="text-2xl font-serif italic text-primary font-bold">L</span>
      </div>

      <div className="h-px bg-border/40 mb-4" />

      {/* Navigation items */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
