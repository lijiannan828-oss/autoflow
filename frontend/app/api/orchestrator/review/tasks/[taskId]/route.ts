import { NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params

  try {
    return NextResponse.json(await runPythonReadApi("review-task-detail", [taskId]))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown review task detail error"
    return NextResponse.json({ error: message }, { status: 200 })
  }
}
