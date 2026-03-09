import { NextRequest, NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") ?? "20"

  try {
    return NextResponse.json(await runPythonReadApi("review-tasks", [limit]))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown review task export error"
    return NextResponse.json({ source: "error", items: [], total: 0, error: message }, { status: 200 })
  }
}
