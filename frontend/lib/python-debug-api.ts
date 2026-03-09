/**
 * Direct Python execution for debug/playground.
 * Calls llm_client.call_llm() or call_llm_multi_vote() directly
 * without going through orchestrator_read_api.py.
 */
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

function getRepoRoot() {
  return path.resolve(process.cwd(), "..")
}

function getWorkspacePython(repoRoot = getRepoRoot()) {
  return path.join(repoRoot, ".venv-connectivity", "bin", "python")
}

export interface DebugRunNodeRequest {
  node_id: string
  system_prompt: string
  user_prompt: string
  params: Record<string, number | string | boolean>
  model?: string
  voting_models?: string[]
}

export async function runDebugNode(req: DebugRunNodeRequest) {
  const repoRoot = getRepoRoot()
  const pythonExecutable = getWorkspacePython(repoRoot)

  // Build inline Python script that imports and calls llm_client
  const isQC = req.voting_models && req.voting_models.length > 0
  const model = req.model || "gemini-2.0-flash" // cheap default for testing
  const temperature = typeof req.params.temperature === "number" ? req.params.temperature : 0.3
  const maxTokens = typeof req.params.max_tokens === "number" ? req.params.max_tokens : 8192
  const jsonMode = req.params.json_mode === true

  const pythonScript = isQC
    ? buildMultiVoteScript(req.voting_models!, req.system_prompt, req.user_prompt, temperature, maxTokens, jsonMode)
    : buildSingleCallScript(model, req.system_prompt, req.user_prompt, temperature, maxTokens, jsonMode)

  const { stdout } = await execFileAsync(pythonExecutable, ["-c", pythonScript], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 180_000, // 3 min timeout for LLM calls
    env: { ...process.env, PYTHONPATH: repoRoot },
  })

  return JSON.parse(stdout)
}

function escapeForPython(s: string): string {
  // Triple-quote safe escaping
  return s.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')
}

function buildSingleCallScript(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  jsonMode: boolean,
): string {
  const sp = escapeForPython(systemPrompt)
  const up = escapeForPython(userPrompt)
  return `
import json, sys, os
sys.path.insert(0, os.getcwd())
from backend.common.llm_client import call_llm, LLMError
try:
    resp = call_llm(
        ${JSON.stringify(model)},
        """${sp}""",
        """${up}""",
        temperature=${temperature},
        max_tokens=${maxTokens},
        json_mode=${jsonMode ? "True" : "False"},
        fallback=True,
    )
    result = {
        "status": "success",
        "content": resp.content,
        "parsed": resp.parsed,
        "model": resp.model,
        "usage": resp.usage,
        "cost_cny": resp.cost_cny,
        "duration_s": resp.duration_s,
    }
except LLMError as e:
    result = {"status": "error", "error": str(e), "status_code": e.status_code}
except Exception as e:
    result = {"status": "error", "error": str(e)}
print(json.dumps(result, ensure_ascii=False))
`
}

function buildMultiVoteScript(
  models: string[],
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  jsonMode: boolean,
): string {
  const sp = escapeForPython(systemPrompt)
  const up = escapeForPython(userPrompt)
  const modelsJson = JSON.stringify(models)
  return `
import json, sys, os
sys.path.insert(0, os.getcwd())
from backend.common.llm_client import call_llm_multi_vote, aggregate_llm_costs, LLMError
try:
    responses = call_llm_multi_vote(
        ${modelsJson},
        """${sp}""",
        """${up}""",
        temperature=${temperature},
        max_tokens=${maxTokens},
        json_mode=${jsonMode ? "True" : "False"},
        fallback=True,
    )
    agg = aggregate_llm_costs(responses)
    result = {
        "status": "success",
        "responses": [
            {
                "content": r.content,
                "parsed": r.parsed,
                "model": r.model,
                "usage": r.usage,
                "cost_cny": r.cost_cny,
                "duration_s": r.duration_s,
            }
            for r in responses
        ],
        "aggregate": agg,
    }
except LLMError as e:
    result = {"status": "error", "error": str(e), "status_code": getattr(e, 'status_code', None)}
except Exception as e:
    result = {"status": "error", "error": str(e)}
print(json.dumps(result, ensure_ascii=False))
`
}
