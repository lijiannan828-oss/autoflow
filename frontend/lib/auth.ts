/** Auth utilities — token cookie management + role types */

export type UserRole = "admin" | "qc_inspector" | "middle_platform" | "partner" | "developer"

export interface AuthUser {
  id: string
  name: string
  role: UserRole
  avatar_url?: string
  permissions: string[]
  home: string
  stats?: {
    pending_tasks: number
    today_reviewed: number
    today_hours: number
  }
}

export const TOKEN_COOKIE = "autoflow_token"

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "管理员",
  qc_inspector: "质检专员",
  middle_platform: "剪辑中台",
  partner: "合作方",
  developer: "开发者",
}

/** Phase 0 test accounts (fallback when DB is empty) */
export const TEST_ACCOUNTS = [
  { username: "admin", password: "admin123", role: "admin" as const },
  { username: "dev", password: "dev123", role: "developer" as const },
  { username: "qc", password: "qc123", role: "qc_inspector" as const },
]

/** Routes accessible without login */
export const PUBLIC_ROUTES = ["/login", "/api/auth/login", "/health"]

/** Check if a path requires auth */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"))
}

/** Phase 0 home route per role */
export function getHomeRoute(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: "/pipeline/trace/demo",
    developer: "/debug",
    qc_inspector: "/tasks",
    middle_platform: "/tasks",
    partner: "/tasks",
  }
  return map[role] || "/tasks"
}
