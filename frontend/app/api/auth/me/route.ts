export const dynamic = "force-dynamic"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { runAuthApi } from "@/lib/python-auth-api"
import { TOKEN_COOKIE } from "@/lib/auth"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(TOKEN_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 })
  }

  // Try real backend first
  try {
    const result = await runAuthApi("me", [token])
    if (!result.error && result.id) {
      return NextResponse.json(result)
    }
  } catch {
    // Python bridge unavailable
  }

  // Fallback: decode mock token (Phase 0 test accounts)
  try {
    const payload = JSON.parse(Buffer.from(token, "base64url").toString())
    if (new Date(payload.exp) < new Date()) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 })
    }
    const name = payload.user_id?.replace("test-", "") || "unknown"
    return NextResponse.json({
      id: payload.user_id,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      role: payload.role,
      permissions: ["*"],
      home: "/pipeline/trace/demo",
      stats: { pending_tasks: 0, today_reviewed: 0, today_hours: 0 },
    })
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 })
  }
}
