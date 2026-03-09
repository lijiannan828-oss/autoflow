"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  ListTodo,
  Palette,
  Eye,
  Film,
  Clapperboard,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    id: "admin",
    label: "管理",
    icon: LayoutDashboard,
    href: "/admin",
    matchPaths: ["/admin"],
  },
  {
    id: "tasks",
    label: "任务",
    icon: ListTodo,
    href: "/tasks",
    matchPaths: ["/tasks"],
  },
  {
    id: "art-assets",
    label: "美术",
    icon: Palette,
    href: "/review/art-assets",
    matchPaths: ["/review/art-assets"],
  },
  {
    id: "visual",
    label: "视觉",
    icon: Eye,
    href: "/review/visual",
    matchPaths: ["/review/visual"],
  },
  {
    id: "audiovisual",
    label: "视听",
    icon: Film,
    href: "/review/audiovisual",
    matchPaths: ["/review/audiovisual"],
  },
  {
    id: "final",
    label: "成片",
    icon: Clapperboard,
    href: "/review/final",
    matchPaths: ["/review/final"],
  },
]

export function GlobalNavSidebar() {
  const pathname = usePathname()

  const getIsActive = (item: (typeof navItems)[number]) => {
    return item.matchPaths.some((p) => pathname.startsWith(p))
  }

  return (
    <aside className="w-16 shrink-0 border-r border-border/50 bg-card/50 flex flex-col">
      {/* Logo */}
      <div className="h-12 flex items-center justify-center border-b border-border/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm italic">L</span>
        </div>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 py-4 flex flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = getIsActive(item)
          const Icon = item.icon

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "w-12 h-12 flex flex-col items-center justify-center gap-1 rounded-lg transition-colors",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom spacer */}
      <div className="py-4 border-t border-border/50" />
    </aside>
  )
}
