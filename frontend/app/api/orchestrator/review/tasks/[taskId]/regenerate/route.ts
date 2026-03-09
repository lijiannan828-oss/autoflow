import { NextResponse } from "next/server"

import { runPythonWriteApi } from "@/lib/python-write-api"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  try {
    return NextResponse.json(await runPythonWriteApi("review-regenerate", taskId, body))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown regenerate error"
    return NextResponse.json({ error: message }, { status: 200 })
  }
}
