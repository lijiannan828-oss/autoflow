import { NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await runPythonReadApi("north-star-summary"))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown north star summary error"
    return NextResponse.json(
      {
        error: message,
      },
      { status: 200 }
    )
  }
}
