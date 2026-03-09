import { NextRequest, NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params

  try {
    return NextResponse.json(await runPythonReadApi("list-episodes", [episodeId]))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown list-episodes error"
    return NextResponse.json({ source: "error", episode_id: episodeId, versions: [], runs: [], node_runs: [], error: message }, { status: 200 })
  }
}
