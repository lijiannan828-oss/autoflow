import { NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await runPythonReadApi("node-trace"))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown node trace error"
    return NextResponse.json(
      {
        source: "error",
        core_counts: {},
        focus_run_id: null,
        real_runs: [],
        real_node_runs: [],
        real_return_tickets: [],
        north_star_summary: undefined,
        compat_projection: null,
        registry_validation: {
          expected_node_count: 26,
          actual_node_count: 0,
          is_seeded: false,
          blocking_issues: [message],
        },
      },
      { status: 200 }
    )
  }
}
