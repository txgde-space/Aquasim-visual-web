import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const resolveSimulatorPath = (override: unknown = '') => {
  if (typeof override !== 'string') throw new Error('仿真目录必须是字符串')
  const explicit = override.trim()
  const env = process.env.AQUA_SIM_HOME?.trim()
  const source = explicit ? 'browser' : env ? 'environment' : 'default'
  const selected = explicit || env || '../aqua-sim-dev'
  const expanded = selected === '~' ? os.homedir()
    : selected.startsWith('~/') ? path.join(os.homedir(), selected.slice(2)) : selected
  const home = path.resolve(root, expanded)
  return { home, source }
}

/** Inspect only: checking a directory never configures or executes ns-3. */
export const inspectSimulator = (override: unknown = '') => {
  const { home, source } = resolveSimulatorPath(override)
  let error = ''
  try {
    if (!fs.statSync(home).isDirectory()) throw new Error('not a directory')
  } catch {
    error = `仿真目录不存在或无法访问：${home}`
  }
  if (!error) {
    try {
      const ns3 = path.join(home, 'ns3')
      if (!fs.statSync(ns3).isFile()) throw new Error('not a file')
      fs.accessSync(ns3, fs.constants.R_OK | fs.constants.X_OK)
    } catch {
      error = `目录内缺少可执行的 ns3 脚本：${home}`
    }
  }
  if (!error) {
    try {
      if (!fs.statSync(path.join(home, 'src/aqua-sim-tg')).isDirectory()) throw new Error('missing module')
    } catch {
      error = `目录内缺少 src/aqua-sim-tg 模块，请选择兼容的 aqua-sim-dev：${home}`
    }
  }
  return { ok: !error, home, source, error, defaultHome: resolveSimulatorPath().home }
}

/** List folders only; never read file contents or execute a selected script. */
export const browseSimulatorDirectories = async (override: unknown = '') => {
  const { home } = resolveSimulatorPath(override)
  try {
    const entries = await fs.promises.readdir(home, { withFileTypes: true })
    const directories = []
    for (const entry of entries) {
      const full = path.join(home, entry.name)
      let isDirectory = entry.isDirectory()
      if (entry.isSymbolicLink()) {
        try { isDirectory = (await fs.promises.stat(full)).isDirectory() } catch { continue }
      }
      if (isDirectory) directories.push({ name: entry.name, path: full })
    }
    directories.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
    const parent = path.dirname(home)
    return { ok: true, home, parent: parent === home ? null : parent, directories, simulator: inspectSimulator(home) }
  } catch {
    throw new Error(`无法浏览目录，请确认目录存在且有读取权限：${home}`)
  }
}
