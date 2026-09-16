import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage } from 'node:http'
import type { ExperimentSpec } from '../src/shared/types/experiment'
import { generateAquaVisualCc } from '../src/features/experiment/lib/generateScratch'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** POST /api/run request body limit (1 MB). */
export const BODY_LIMIT_BYTES = 1_000_000
const RUN_TIMEOUT_MS = 180_000
const CONFIGURE_TIMEOUT_MS = 900_000
/** Grace period after SIGTERM before escalating to SIGKILL. */
const SIGKILL_GRACE_MS = 5_000
/** Keep at most the tail of child output to bound memory. */
const STDOUT_CAP_BYTES = 400_000

export interface RunOutcome {
  status: number
  payload: Record<string, unknown>
}

export const resolveAquaHome = (): string | null => {
  const candidates = [
    process.env.AQUA_SIM_HOME,
    path.resolve(root, '../aqua-sim-dev'),
  ].filter((dir): dir is string => Boolean(dir))
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'ns3'))) || null
}

const isConfigured = (cwd: string): boolean => (
  fs.existsSync(path.join(cwd, 'cmake-cache'))
  || fs.existsSync(path.join(cwd, 'build', 'CMakeCache.txt'))
  || fs.existsSync(path.join(cwd, 'cmake-cache.txt'))
)

/**
 * Collect net.* logs produced by THIS run only: files whose mtime is newer
 * than the run start. Falls back to nothing (instead of stale files) when
 * the simulation produced no fresh log.
 */
const collectRunLog = (cwd: string, sinceMs: number): { log: string | null; logName: string } => {
  const hits: Array<{ full: string; name: string; mtimeMs: number }> = []
  for (const dir of [cwd, path.join(cwd, 'scratch')]) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile() || !/^net\..+/.test(entry.name)) continue
      const full = path.join(dir, entry.name)
      let mtimeMs: number
      try {
        mtimeMs = fs.statSync(full).mtimeMs
      } catch {
        continue
      }
      if (mtimeMs <= sinceMs) continue
      hits.push({ full, name: entry.name, mtimeMs })
    }
  }
  if (!hits.length) return { log: null, logName: '' }
  hits.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return { log: fs.readFileSync(hits[0].full, 'utf8'), logName: hits[0].name }
}

const runProcess = (
  cwd: string,
  argv: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string }> => new Promise((resolve) => {
  const child = spawn(argv[0], argv.slice(1), { cwd, env: process.env })
  let stdout = ''
  const onData = (chunk: Buffer) => {
    stdout += chunk.toString()
    if (stdout.length > STDOUT_CAP_BYTES) stdout = stdout.slice(-STDOUT_CAP_BYTES / 2)
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)

  let sigkillTimer: NodeJS.Timeout | null = null
  const termTimer = setTimeout(() => {
    child.kill('SIGTERM')
    sigkillTimer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }, SIGKILL_GRACE_MS)
  }, timeoutMs)

  child.on('close', (code) => {
    clearTimeout(termTimer)
    if (sigkillTimer) clearTimeout(sigkillTimer)
    resolve({ code, stdout })
  })
})

const ensureConfigured = async (cwd: string): Promise<{ ok: boolean; stdout: string }> => {
  if (isConfigured(cwd)) return { ok: true, stdout: '' }
  const ns3 = path.join(cwd, 'ns3')
  const result = await runProcess(cwd, [
    ns3,
    'configure',
    '--build-profile=debug',
    '--enable-examples',
  ], CONFIGURE_TIMEOUT_MS)
  return {
    ok: result.code === 0 && isConfigured(cwd),
    stdout: result.stdout,
  }
}

const runNs3 = async (cwd: string, program: string, sinceMs: number) => {
  const ns3 = path.join(cwd, 'ns3')
  const result = await runProcess(cwd, [ns3, 'run', program], RUN_TIMEOUT_MS)
  const files = collectRunLog(cwd, sinceMs)
  return {
    ok: result.code === 0,
    code: result.code,
    command: `./ns3 run ${program}`,
    stdout: result.stdout,
    ...files,
  }
}

let activeRun: Promise<RunOutcome> | null = null

const doRunExperiment = async (spec: unknown): Promise<RunOutcome> => {
  const home = resolveAquaHome()
  if (!home) {
    return { status: 400, payload: { ok: false, error: '找不到 aqua-sim-dev' } }
  }

  // Per-run scratch file: concurrent/extra runs can no longer overwrite each
  // other's aqua-visual.cc or pick up each other's logs.
  const runId = randomUUID().slice(0, 8)
  const scratchName = `aqua-visual-${runId}`
  const scratchRel = path.join('scratch', `${scratchName}.cc`)
  const scratchAbs = path.join(home, scratchRel)
  const startedAt = Date.now()

  try {
    fs.mkdirSync(path.dirname(scratchAbs), { recursive: true })
    fs.writeFileSync(scratchAbs, generateAquaVisualCc(spec as ExperimentSpec))

    const setup = await ensureConfigured(home)
    if (!setup.ok) {
      return {
        status: 500,
        payload: {
          ok: false,
          phase: 'configure',
          scratch: scratchRel,
          stdout: setup.stdout || 'ns-3 configure 失败',
        },
      }
    }

    const result = await runNs3(home, scratchName, startedAt)
    let stdout = setup.stdout ? `${setup.stdout}\n${result.stdout}` : result.stdout
    const payload: Record<string, unknown> = { ...result, scratch: scratchRel }
    if (result.ok && !result.log) {
      stdout += '\n[警告] 仿真成功但未找到本次运行新生成的 net.* 日志文件，请检查仿真配置'
      payload.stdout = stdout
    }
    return { status: result.ok ? 200 : 500, payload }
  } catch (error) {
    return { status: 500, payload: { ok: false, error: String((error as { message?: unknown })?.message || error) } }
  } finally {
    try {
      fs.unlinkSync(scratchAbs)
    } catch {
      // scratch cleanup is best-effort
    }
  }
}

/**
 * Single-flight guard: only one /api/run at a time. A second request while a
 * run is in flight gets 409 instead of queueing onto the same scratch file.
 */
export const runExperimentGuarded = (spec: unknown): Promise<RunOutcome> => {
  if (activeRun) {
    return Promise.resolve({
      status: 409,
      payload: { ok: false, error: '已有仿真任务进行中，请等待当前任务完成后再试' },
    })
  }
  const task = doRunExperiment(spec)
  activeRun = task
  task
    .catch(() => {})
    .finally(() => {
      if (activeRun === task) activeRun = null
    })
  return task
}

/** Read a JSON request body, rejecting payloads over the size limit. */
export const readJsonBody = (req: IncomingMessage, limit = BODY_LIMIT_BYTES): Promise<unknown> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = []
  let size = 0
  let settled = false
  req.on('data', (chunk: Buffer) => {
    if (settled) return
    size += chunk.length
    if (size > limit) {
      settled = true
      reject(new Error(`请求体超过 ${Math.round(limit / 1024)}KB 限制`))
      req.destroy()
      return
    }
    chunks.push(chunk)
  })
  req.on('end', () => {
    if (settled) return
    settled = true
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
    } catch (error) {
      reject(error)
    }
  })
  req.on('error', (error) => {
    if (settled) return
    settled = true
    reject(error)
  })
})
