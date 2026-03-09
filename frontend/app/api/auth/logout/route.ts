export const dynamic = "force-dynamic"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { runAuthApi } from "@/lib/python-auth-api"
import { TOKEN_COOKIE } from "@/lib/auth"

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(TOKEN_COOKIE)?.value

  if (token) {
    try {
      await runAuthApi("logout", [token])
    } catch {
      // ignore — best effort
    }
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete(TOKEN_COOKIE)
  return response
}
