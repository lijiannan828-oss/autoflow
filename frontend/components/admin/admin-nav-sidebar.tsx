"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Film, ListTodo, BarChart3, Users, GitBranch, Rocket, Bug, Palette, Eye, Clapperboard } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  {
    id: "dramas",
    label: "剧集",
    icon: Film,
    href: "/admin",
  },
  {
    id: "tasks",
    label: "任务",
    icon: ListTodo,
    href: "/tasks",
  },
  {
    id: "data",
    label: "数据",
    icon: BarChart3,
    href: "/admin/data",
  },
  {
    id: "staff",
    label: "员工",
    icon: Users,
    href: "/admin/employees",
  },
  {
    id: "acceptance",
    label: "验收",
    icon: GitBranch,
    href: "/admin/orchestrator/acceptance",
  },
  {
    id: "sprint",
    label: "冲刺",
    icon: Rocket,
    href: "/admin/sprint",
  },
  {
    id: "debug",
    label: "调试",
    icon: Bug,
    href: "/admin/debug",
  },
]

const reviewItems = [
  {
    id: "art-assets",
    label: "美术",
    icon: Palette,
    href: "/review/art-assets",
  },
  {
    id: "visual",
    label: "视觉",
    icon: Eye,
    href: "/review/visual",
  },
  {
    id: "audiovisual",
    label: "视听",
    icon: Film,
    href: "/review/audiovisual",
  },
  {
    id: "final",
    label: "成片",
    icon: Clapperboard,
    href: "/review/final",
  },
]

export function AdminNavSidebar() {
  const pathname = usePathname()

  // Determine active item based on current path
  const getIsActive = (href: string) => {
    if (href === "/admin") {
      // "剧集" tab is active for /admin and /admin/drama/* paths
      return pathname === "/admin" || pathname.startsWith("/admin/drama")
    }
    return pathname.startsWith(href)
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
      <nav className="flex-1 py-4 flex flex-col items-center gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = getIsActive(item.href)
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

        {/* Divider */}
        <div className="w-8 h-px bg-border/50 my-2" />

        {/* Review page links */}
        {reviewItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
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
