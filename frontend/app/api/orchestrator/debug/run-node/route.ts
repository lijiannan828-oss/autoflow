export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { runDebugNode } from "@/lib/python-debug-api"
import { NODE_SPECS } from "@/lib/node-specs"

/**
 * POST /api/orchestrator/debug/run-node
 *
 * Executes a single LLM call via llm_client.py with custom prompts/params.
 * For QC nodes, runs multi-model voting via call_llm_multi_vote().
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { node_id, system_prompt, user_prompt, params } = body

    if (!node_id) {
      return NextResponse.json({ error: "node_id is required" }, { status: 400 })
    }

    if (!system_prompt && !user_prompt) {
      return NextResponse.json({ error: "system_prompt or user_prompt is required" }, { status: 400 })
    }

    // Look up node spec to determine model and whether it's QC
    const spec = NODE_SPECS.find(n => n.id === node_id)

    const result = await runDebugNode({
      node_id,
      system_prompt: system_prompt || "",
      user_prompt: user_prompt || "",
      params: params || {},
      model: spec?.model || params?.model || "gemini-2.0-flash",
      voting_models: spec?.qcConfig ? spec.qcConfig.votingModels : undefined,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"

    // If it's an exec error (Python not found, etc), provide helpful context
    if (message.includes("ENOENT") || message.includes("spawn")) {
      return NextResponse.json({
        status: "error",
        error: "Python 虚拟环境未找到。请确认 .venv-connectivity 已创建。",
        detail: message,
      }, { status: 500 })
    }

    return NextResponse.json({
      status: "error",
      error: message,
    }, { status: 500 })
  }
}
