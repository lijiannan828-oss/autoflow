import { NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await runPythonReadApi("registry-validation"))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown registry validation error"
    return NextResponse.json(
      {
        expected_node_count: 26,
        actual_node_count: 0,
        is_seeded: false,
        blocking_issues: [message],
      },
      { status: 200 }
    )
  }
}
