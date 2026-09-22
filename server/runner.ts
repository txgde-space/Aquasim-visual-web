import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'
import type { ExperimentSpec } from '../src/shared/types/experiment'
import { generateAquaVisualCc } from '../src/features/experiment/lib/generateScratch'
import { inspectSimulator } from './simulatorConfig'
import { checkProtocolRequirements } from './protocolRequirements'
import { cachedCatalog, catalogProbe, saveCatalog } from './protocolCatalog'

/** POST /api/run request body limit (1 MB). */
export const BODY_LIMIT_BYTES = 1_000_000
const RUN_TIMEOUT_MS = 180_000
const CONFIGURE_TIMEOUT_MS = 900_000
const BUILD_TIMEOUT_MS = 900_000
/** Grace period after SIGTERM before escalating to SIGKILL. */
const SIGKILL_GRACE_MS = 5_000
/** Keep at most the tail of child output to bound memory. */
const STDOUT_CAP_BYTES = 400_000

export interface RunOutcome {
  status: number
  payload: Record<string, unknown>
}

const isConfigured = (cwd: string): boolean => (
  fs.existsSync(path.join(cwd, 'cmake-cache'))
  || fs.existsSync(path.join(cwd, 'build', 'CMakeCache.txt'))
  || fs.existsSync(path.join(cwd, 'cmake-cache.txt'))
)

const warningsAsErrors = (cwd: string): boolean => {
  for (const relative of ['cmake-cache/CMakeCache.txt', 'build/CMakeCache.txt', 'cmake-cache.txt']) {
    try {
      const cache = fs.readFileSync(path.join(cwd, relative), 'utf8')
      return /^NS3_WARNINGS_AS_ERRORS:BOOL=(ON|TRUE|YES|1)\s*$/mi.test(cache)
    } catch {
      // Try the other cache locations supported by this runner.
    }
  }
  return false
}

/**
 * Collect net.* logs produced by THIS run only: files whose mtime is newer
 * than the run start. Falls back to nothing (instead of stale files) when
 * the simulation produced no fresh log.
 */
const collectRunLog = (cwd: string, sinceMs: number, fallbackName: string): { log: string | null; logName: string } => {
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
      if (entry.name.startsWith('net.aqua-visual-') && entry.name !== fallbackName) continue
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
  hits.sort((a, b) => Number(a.name === fallbackName) - Number(b.name === fallbackName) || b.mtimeMs - a.mtimeMs)
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
  child.on('error', (error) => {
    clearTimeout(termTimer)
    if (sigkillTimer) clearTimeout(sigkillTimer)
    resolve({ code: -1, stdout: `${stdout}\n${error.message}` })
  })

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
  const configured = isConfigured(cwd)
  if (configured && !warningsAsErrors(cwd)) return { ok: true, stdout: '' }
  const ns3 = path.join(cwd, 'ns3')
  const result = await runProcess(cwd, [
    ns3,
    'configure',
    // Existing checkouts keep their profile, modules, and other cached options.
    ...(!configured ? ['--build-profile=debug', '--enable-examples'] : []),
    '--disable-werror',
  ], CONFIGURE_TIMEOUT_MS)
  return {
    ok: result.code === 0 && isConfigured(cwd) && !warningsAsErrors(cwd),
    stdout: result.stdout,
  }
}

const runNs3 = async (cwd: string, program: string, sinceMs: number, logName: string) => {
  const ns3 = path.join(cwd, 'ns3')
  const result = await runProcess(cwd, [ns3, 'run', program], RUN_TIMEOUT_MS)
  const files = collectRunLog(cwd, sinceMs, logName)
  return {
    ok: result.code === 0,
    code: result.code,
    command: `./ns3 run ${program}`,
    stdout: result.stdout,
    ...files,
  }
}

let activeTask: Promise<RunOutcome> | null = null

const discoverCatalog = async (home: string) => {
  const name = `aqua-visual-catalog-${randomUUID().slice(0, 8)}`
  const scratch = path.join(home, 'scratch', `${name}.cc`)
  try {
    fs.mkdirSync(path.dirname(scratch), { recursive: true })
    fs.writeFileSync(scratch, catalogProbe)
    const result = await runProcess(home, [path.join(home, 'ns3'), 'run', name], BUILD_TIMEOUT_MS)
    if (result.code !== 0) throw new Error(`读取注册协议失败：\n${result.stdout}`)
    return saveCatalog(home, result.stdout)
  } finally {
    fs.rmSync(scratch, { force: true })
  }
}

const doPrecompile = async (aquaSimHome: unknown): Promise<RunOutcome> => {
  const config = inspectSimulator(aquaSimHome)
  if (!config.ok) return { status: 400, payload: config }
  const setup = await ensureConfigured(config.home)
  if (!setup.ok) {
    return {
      status: 500,
      payload: { ok: false, phase: 'configure', error: '预编译配置失败', stdout: setup.stdout, home: config.home },
    }
  }
  const build = await runProcess(config.home, [path.join(config.home, 'ns3'), 'build'], BUILD_TIMEOUT_MS)
  const ok = build.code === 0
  let catalog
  if (ok) {
    try { catalog = await discoverCatalog(config.home) }
    catch (error) { return { status: 500, payload: { ok: false, phase: 'catalog', error: String(error), stdout: build.stdout } } }
  }
  return {
    status: ok ? 200 : 500,
    payload: {
      ok, phase: 'build', home: config.home, code: build.code,
      command: './ns3 build',
      catalog,
      error: ok ? '' : '预编译失败，请查看编译输出',
      stdout: [setup.stdout, build.stdout].filter(Boolean).join('\n'),
    },
  }
}

const doRunExperiment = async (spec: unknown, aquaSimHome: unknown): Promise<RunOutcome> => {
  const config = inspectSimulator(aquaSimHome)
  if (!config.ok) {
    return { status: 400, payload: config }
  }
  const home = config.home

  // Per-run scratch file: concurrent/extra runs can no longer overwrite each
  // other's aqua-visual.cc or pick up each other's logs.
  const runId = randomUUID().slice(0, 8)
  const scratchName = `aqua-visual-${runId}`
  const scratchRel = path.join('scratch', `${scratchName}.cc`)
  const scratchAbs = path.join(home, scratchRel)
  const fallbackLog = `net.aqua-visual-${runId}.json`
  const startedAt = Date.now()

  try {
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

    const catalog = cachedCatalog(home) || await discoverCatalog(home)
    fs.mkdirSync(path.dirname(scratchAbs), { recursive: true })
    const code = generateAquaVisualCc(spec as ExperimentSpec, catalog, fallbackLog)
    checkProtocolRequirements(home, spec as ExperimentSpec)
    fs.writeFileSync(scratchAbs, code)

    const result = await runNs3(home, scratchName, startedAt, fallbackLog)
    let stdout = setup.stdout ? `${setup.stdout}\n${result.stdout}` : result.stdout
    const payload: Record<string, unknown> = { ...result, stdout, scratch: scratchRel }
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
    fs.rmSync(path.join(home, fallbackLog), { force: true })
  }
}

/**
 * Precompilation and simulation share a lock because both mutate the ns-3 build tree.
 */
const runExclusive = (start: () => Promise<RunOutcome>): Promise<RunOutcome> => {
  if (activeTask) {
    return Promise.resolve({
      status: 409,
      payload: { ok: false, error: '已有预编译或仿真任务进行中，请等待当前任务完成后再试' },
    })
  }
  const task = start()
  activeTask = task
  task
    .catch(() => {})
    .finally(() => {
      if (activeTask === task) activeTask = null
    })
  return task
}

export const runExperimentGuarded = (spec: unknown, aquaSimHome: unknown = ''): Promise<RunOutcome> =>
  runExclusive(() => doRunExperiment(spec, aquaSimHome))

export const precompileSimulatorGuarded = (aquaSimHome: unknown = ''): Promise<RunOutcome> =>
  runExclusive(() => doPrecompile(aquaSimHome))

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
