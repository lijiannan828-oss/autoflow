import { NextRequest, NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") ?? "50"

  try {
    return NextResponse.json(await runPythonReadApi("list-dramas", [limit]))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown list-dramas error"
    return NextResponse.json({ source: "error", items: [], total: 0, error: message }, { status: 200 })
  }
}
