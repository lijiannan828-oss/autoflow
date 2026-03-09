export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { runAuthApi } from "@/lib/python-auth-api"
import { TOKEN_COOKIE, type AuthUser, TEST_ACCOUNTS, getHomeRoute } from "@/lib/auth"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))

  // Try real backend first
  let realResult: { token?: string; user?: AuthUser; error?: string } | null = null
  try {
    realResult = await runAuthApi("login", [JSON.stringify(body)])
  } catch {
    // Python bridge unavailable — will use mock
  }

  // Real backend succeeded with token
  if (realResult?.token && !realResult.error) {
    const response = NextResponse.json(realResult)
    response.cookies.set(TOKEN_COOKIE, realResult.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24h
    })
    return response
  }

  // Fallback: Phase 0 test accounts (DB empty or credentials mismatch in DB)
  const { username, password } = body
  const account = TEST_ACCOUNTS.find(a => a.username === username && a.password === password)
  if (!account) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 })
  }

  const mockUser: AuthUser = {
    id: `test-${account.username}`,
    name: account.username === "admin" ? "Admin" : account.username === "dev" ? "Developer" : "QC Inspector",
    role: account.role,
    permissions: ["*"],
    home: getHomeRoute(account.role),
  }
  const mockToken = Buffer.from(JSON.stringify({ user_id: mockUser.id, role: account.role, exp: new Date(Date.now() + 86400000).toISOString() })).toString("base64url")

  const response = NextResponse.json({ token: mockToken, user: mockUser })
  response.cookies.set(TOKEN_COOKIE, mockToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  })
  return response
}
