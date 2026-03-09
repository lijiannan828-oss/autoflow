import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { getRepoRoot, getWorkspacePython } from "@/lib/python-read-api"

const execFileAsync = promisify(execFile)

export async function runPythonWriteApi(
  command: string,
  taskId?: string,
  payload?: Record<string, unknown>
) {
  const repoRoot = getRepoRoot()
  const pythonExecutable = getWorkspacePython(repoRoot)
  const scriptPath = path.join(repoRoot, "backend/common/contracts/orchestrator_write_api.py")
  const args = [scriptPath, command]

  if (taskId) {
    args.push(taskId)
  }

  if (payload) {
    if (!taskId) {
      args.push("")
    }
    args.push(JSON.stringify(payload))
  }

  const { stdout } = await execFileAsync(pythonExecutable, args, {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  })

  return JSON.parse(stdout)
}
