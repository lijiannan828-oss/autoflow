import { NextRequest, NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const episodeId = request.nextUrl.searchParams.get("episode_id") ?? request.nextUrl.searchParams.get("episodeId")
  if (!episodeId) {
    return NextResponse.json({ error: "missing episode_id" }, { status: 400 })
  }

  try {
    return NextResponse.json(await runPythonReadApi("review-stage3-summary", [episodeId]))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown stage3 summary error"
    return NextResponse.json({ error: message }, { status: 200 })
  }
}
