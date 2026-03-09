import { NextRequest, NextResponse } from "next/server"

import { runPythonReadApi } from "@/lib/python-read-api"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const tosUrl = request.nextUrl.searchParams.get("tos_url")
  if (!tosUrl) {
    return NextResponse.json({ error: "missing tos_url" }, { status: 400 })
  }

  try {
    return NextResponse.json(await runPythonReadApi("tos-presigned-url", [tosUrl]))
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown presigned URL error"
    return NextResponse.json({ tos_url: tosUrl, http_url: null, error: message }, { status: 200 })
  }
}
