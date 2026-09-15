import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateAquaVisualCc } from '../src/generateScratch.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const resolveAquaHome = () => {
  const candidates = [
    process.env.AQUA_SIM_HOME,
    path.resolve(root, '../aqua-sim-dev'),
  ].filter(Boolean)
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'ns3'))) || null
}

const isConfigured = (cwd) => (
  fs.existsSync(path.join(cwd, 'cmake-cache'))
  || fs.existsSync(path.join(cwd, 'build', 'CMakeCache.txt'))
  || fs.existsSync(path.join(cwd, 'cmake-cache.txt'))
)

const writeScratch = (cwd, spec) => {
  const target = path.join(cwd, 'scratch', 'aqua-visual.cc')
  fs.writeFileSync(target, generateAquaVisualCc(spec))
  return 'scratch/aqua-visual.cc'
}

const readJsonBody = (req) => new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
    } catch (error) {
      reject(error)
    }
  })
  req.on('error', reject)
})

const runProcess = (cwd, argv, timeoutMs) => new Promise((resolve) => {
  const child = spawn(argv[0], argv.slice(1), { cwd, env: process.env })
  let stdout = ''
  const onData = (chunk) => {
    stdout += chunk.toString()
    if (stdout.length > 400_000) stdout = stdout.slice(-200_000)
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
  child.on('close', (code) => {
    clearTimeout(timer)
    resolve({ code, stdout })
  })
})

const collectLog = (cwd) => {
  const logCandidates = ['net.log', 'net.json', path.join('scratch', 'net.log')]
  for (const rel of logCandidates) {
    const full = path.join(cwd, rel)
    if (fs.existsSync(full)) {
      return { log: fs.readFileSync(full, 'utf8'), logName: path.basename(full) }
    }
  }
  return { log: null, logName: '' }
}

const ensureConfigured = async (cwd) => {
  if (isConfigured(cwd)) return { ok: true, stdout: '' }
  const ns3 = path.join(cwd, 'ns3')
  const result = await runProcess(cwd, [
    ns3,
    'configure',
    '--build-profile=debug',
    '--enable-examples',
  ], 900_000)
  return {
    ok: result.code === 0 && isConfigured(cwd),
    stdout: result.stdout,
  }
}

const runNs3 = async (cwd, program) => {
  const ns3 = path.join(cwd, 'ns3')
  const result = await runProcess(cwd, [ns3, 'run', program], 180_000)
  const files = collectLog(cwd)
  return {
    ok: result.code === 0,
    code: result.code,
    command: `./ns3 run ${program}`,
    scratch: 'scratch/aqua-visual.cc',
    stdout: result.stdout,
    ...files,
  }
}

export const ns3RunPlugin = () => ({
  name: 'ns3-run',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.method !== 'POST' || req.url !== '/api/run') {
        next()
        return
      }
      res.setHeader('Content-Type', 'application/json')
      try {
        const spec = await readJsonBody(req)
        const home = resolveAquaHome()
        if (!home) {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: '找不到 aqua-sim-dev' }))
          return
        }
        const scratch = writeScratch(home, spec)
        const setup = await ensureConfigured(home)
        if (!setup.ok) {
          res.statusCode = 500
          res.end(JSON.stringify({
            ok: false,
            phase: 'configure',
            scratch,
            stdout: setup.stdout || 'ns-3 configure 失败',
          }))
          return
        }
        const result = await runNs3(home, 'aqua-visual')
        res.statusCode = result.ok ? 200 : 500
        res.end(JSON.stringify({
          ...result,
          scratch,
          stdout: setup.stdout ? `${setup.stdout}\n${result.stdout}` : result.stdout,
        }))
      } catch (error) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: String(error?.message || error) }))
      }
    })
  },
})
