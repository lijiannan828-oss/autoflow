import { NextResponse } from "next/server"
import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await runPythonReadApi("acceptance"))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown acceptance export error"
    return NextResponse.json(
      {
        taskTabs: [],
        error: message,
      },
      { status: 200 }
    )
  }
}
