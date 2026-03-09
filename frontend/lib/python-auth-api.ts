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

export async function runAuthApi(command: string, args: string[] = []) {
  const repoRoot = getRepoRoot()
  const pythonExecutable = getWorkspacePython(repoRoot)
  const scriptPath = path.join(repoRoot, "backend/common/contracts/auth_api.py")

  const { stdout } = await execFileAsync(pythonExecutable, [scriptPath, command, ...args], {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  })

  return JSON.parse(stdout)
}
