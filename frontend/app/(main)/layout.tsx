"use client"

import { useEffect, useState, createContext, useContext } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Telescope,
  Bot,
  Wrench,
  LogOut,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuthUser, UserRole } from "@/lib/auth"
import { ROLE_LABELS } from "@/lib/auth"

// ── Auth Context ──────────────────────────────────────
const AuthContext = createContext<{ user: AuthUser | null; loading: boolean }>({ user: null, loading: true })
export function useAuth() { return useContext(AuthContext) }

// ── Nav items ─────────────────────────────────────────
const NAV_ITEMS = [
  { id: "pipeline", label: "管线", icon: Telescope, href: "/pipeline", roles: ["admin", "developer"] as UserRole[] },
  { id: "agents", label: "Agent", icon: Bot, href: "/agents", roles: ["admin", "developer"] as UserRole[] },
  { id: "debug", label: "调试", icon: Wrench, href: "/debug", roles: ["admin", "developer"] as UserRole[] },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          router.replace(`/login?from=${encodeURIComponent(pathname)}`)
        } else {
          setUser(data)
        }
      })
      .catch(() => {
        router.replace("/login")
      })
      .finally(() => setLoading(false))
  }, [router, pathname])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.replace("/login")
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  // Filter nav items by role
  const visibleNav = NAV_ITEMS.filter(
    item => user.role === "admin" || item.roles.includes(user.role)
  )

  const getIsActive = (href: string) => pathname.startsWith(href)

  return (
    <AuthContext value={{ user, loading }}>
      <div className="h-screen w-screen flex overflow-hidden">
        {/* ── Narrow sidebar (48px) ── */}
        <aside className="w-12 shrink-0 border-r border-border/50 bg-card/30 flex flex-col">
          {/* Logo */}
          <Link
            href={user.home || "/pipeline/trace/demo"}
            className="h-12 flex items-center justify-center border-b border-border/50 hover:bg-secondary/30 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
          </Link>

          {/* Nav items */}
          <nav className="flex-1 py-3 flex flex-col items-center gap-1">
            {visibleNav.map(item => {
              const active = getIsActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.id}
                  href={item.href === "/pipeline" ? "/pipeline/trace/demo" : item.href}
                  title={item.label}
                  className={cn(
                    "w-10 h-10 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[8px] font-medium leading-none">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User avatar */}
          <div className="py-3 border-t border-border/50 flex flex-col items-center relative">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title={`${user.name} (${ROLE_LABELS[user.role]})`}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </button>

            {/* User menu popover */}
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute bottom-12 left-1 z-50 w-40 bg-card border border-border rounded-lg shadow-xl p-2">
                  <div className="px-2 py-1.5 mb-1">
                    <p className="text-xs font-medium text-foreground">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[user.role]}</p>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors"
                  >
                    <LogOut className="w-3 h-3" />
                    登出
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AuthContext>
  )
}
