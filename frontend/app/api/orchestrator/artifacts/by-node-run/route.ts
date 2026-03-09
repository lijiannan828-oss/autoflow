import { NextRequest, NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const nodeRunId = request.nextUrl.searchParams.get("node_run_id")
  if (!nodeRunId) {
    return NextResponse.json({ error: "missing node_run_id" }, { status: 400 })
  }

  try {
    return NextResponse.json(await runPythonReadApi("artifacts-by-node-run", [nodeRunId]))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown artifacts error"
    return NextResponse.json({ source: "error", items: [], total: 0, error: message }, { status: 200 })
  }
}
