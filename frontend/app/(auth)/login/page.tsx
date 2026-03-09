"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get("from")

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "password", username, password }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error === "invalid_credentials" ? "账号或密码错误" : data.error || "登录失败")
        return
      }
      // Redirect to original page or role-based home
      router.push(from || data.user?.home || "/pipeline/trace/demo")
    } catch {
      setError("服务连接失败，请检查后端服务")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">AutoFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">AIGC 短剧生产管线</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-xl p-6">
          {/* Feishu SSO (placeholder) */}
          <button
            type="button"
            disabled
            className="w-full h-10 rounded-lg bg-secondary/50 text-muted-foreground text-sm flex items-center justify-center gap-2 cursor-not-allowed mb-5"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.025 4.5C5.025 4.5 8.15 8.55 9.825 11.025C11.025 12.825 11.925 14.25 11.925 14.25L19.5 7.125C19.5 7.125 14.775 3.375 11.475 2.4C9.075 1.65 5.025 4.5 5.025 4.5Z" />
              <path d="M2.625 10.65C2.625 10.65 5.325 14.025 7.425 16.125C9 17.7 10.725 18.975 10.725 18.975L11.925 14.25C11.925 14.25 9.675 11.025 8.1 9.075C6.525 7.125 2.625 10.65 2.625 10.65Z" opacity="0.6" />
              <path d="M10.725 18.975C10.725 18.975 14.175 20.775 16.8 21.225C19.425 21.675 21.375 19.5 21.375 19.5L11.925 14.25L10.725 18.975Z" opacity="0.3" />
            </svg>
            飞书账号登录（Phase 2 接入）
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">或</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Password form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">账号</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin / dev / qc"
                autoComplete="username"
                className="w-full h-10 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="admin123 / dev123 / qc123"
                autoComplete="current-password"
                className="w-full h-10 rounded-lg bg-secondary/50 border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "登录中..." : "登 录"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          v2.2 Phase 0 · 调试阶段
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  )
}
