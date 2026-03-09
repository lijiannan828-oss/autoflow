import { NextRequest, NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const episodeId = request.nextUrl.searchParams.get("episode_id") ?? null
  const status = request.nextUrl.searchParams.get("status") ?? null
  const limit = request.nextUrl.searchParams.get("limit") ?? "50"

  const args: string[] = []
  args.push(episodeId ?? "")
  args.push(status ?? "")
  args.push(limit)

  try {
    return NextResponse.json(await runPythonReadApi("return-tickets", args))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown return-tickets error"
    return NextResponse.json({ error: message }, { status: 200 })
  }
}
