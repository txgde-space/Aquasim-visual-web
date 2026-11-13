import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import type { CatalogLayer } from '../src/features/experiment/lib/typeIdCatalog'
import { catalogProbe, catalogSignature, restoreCatalog } from './protocolCatalog'

const cacheRoot = fileURLToPath(new URL('../node_modules/.cache/aquasim-build/', import.meta.url))
interface Snapshot { version: 1; home: string; input: string; output: string; catalog: CatalogLayer[] }
const cachePath = (home: string) => path.join(cacheRoot, `${createHash('sha256').update(home).digest('hex')}.json`)
const ignoredDirectories = new Set(['.git', '__pycache__', 'node_modules'])

/** Content-based inputs: a touched but unchanged source file can still reuse its build. */
export const simulatorInputSignature = (selectedHome: string): string | null => {
  try {
    const home = fs.realpathSync(selectedHome)
    const hash = createHash('sha256').update(catalogProbe)
    const visit = (file: string, ancestors = new Set<string>()) => {
      hash.update(file).update('\0')
      if (!fs.existsSync(file)) { hash.update('missing\0'); return }
      const real = fs.realpathSync(file), stat = fs.statSync(real)
      hash.update(real).update('\0')
      if (stat.isDirectory()) {
        if (ancestors.has(real)) throw new Error('cyclic build input')
        const next = new Set(ancestors).add(real)
        for (const name of fs.readdirSync(real).sort()) {
          if (ignoredDirectories.has(name)) continue
          // Ephemeral programs belong to runs/probes, not the simulator source baseline.
          if (path.dirname(file) === home && path.basename(file) === 'scratch' && /^aqua-visual-.*\.cc$/.test(name)) continue
          visit(path.join(file, name), next)
        }
      } else if (stat.isFile()) hash.update(fs.readFileSync(real)).update('\0')
    }
    for (const entry of ['ns3', 'CMakeLists.txt', 'VERSION', '.ns3rc', 'src', 'contrib', 'scratch', 'examples', 'utils', 'bindings', 'build-support']) visit(path.join(home, entry))
    let configured = false
    for (const entry of fs.readdirSync(home).sort()) {
      if (entry.startsWith('.')) continue
      const file = path.join(home, entry, 'CMakeCache.txt')
      if (!fs.existsSync(file)) continue
      const content = fs.readFileSync(file, 'utf8')
      if (!/^build_profile:INTERNAL=\S.*$/m.test(content) || !/^CMAKE_GENERATOR:[^=]+=\S.*$/m.test(content)) continue
      if (/^NS3_WARNINGS_AS_ERRORS:BOOL=(ON|TRUE|YES|1)\s*$/mi.test(content)) return null
      configured = true; visit(file)
      for (const [, tool] of content.matchAll(/^CMAKE_(?:C|CXX)_COMPILER:FILEPATH=(.+)$/gm)) {
        const real = fs.realpathSync(tool!.trim()), stat = fs.statSync(real, { bigint: true })
        hash.update(`${real}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`)
      }
      for (const [, toolchain] of content.matchAll(/^CMAKE_TOOLCHAIN_FILE:FILEPATH=(.+)$/gm)) visit(path.resolve(home, toolchain!.trim()))
    }
    if (!configured) return null
    for (const name of ['PATH', 'CC', 'CXX', 'CFLAGS', 'CXXFLAGS', 'CPPFLAGS', 'LDFLAGS', 'SDKROOT', 'DEVELOPER_DIR', 'CMAKE_PREFIX_PATH']) hash.update(`${name}=${process.env[name] ?? ''}\0`)
    // /usr/bin/c++ is a stable launcher on macOS; detect changes to the selected Xcode toolchain too.
    if (process.platform === 'darwin') {
      for (const selected of ['/var/db/xcode_select_link', process.env.DEVELOPER_DIR].filter((v): v is string => !!v)) {
        if (!fs.existsSync(selected)) continue
        const developer = fs.realpathSync(selected)
        hash.update(developer)
        for (const relative of ['usr/bin/clang', 'Toolchains/XcodeDefault.xctoolchain/usr/bin/clang']) {
          const compiler = path.join(developer, relative)
          if (!fs.existsSync(compiler)) continue
          const stat = fs.statSync(compiler, { bigint: true })
          hash.update(`${compiler}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`)
        }
      }
    }
    return hash.digest('hex')
  } catch { return null }
}

const outputSignature = (home: string) => {
  try {
    if (!fs.readdirSync(path.join(home, 'build/lib')).some(name => /\.(?:a|dylib|dll|so(?:\.\d+)*)$/.test(name))) return null
    return catalogSignature(home)
  } catch { return null }
}
const validCatalog = (value: unknown): value is CatalogLayer[] => Array.isArray(value)
  && value.every(layer => layer && typeof layer.id === 'string' && Array.isArray(layer.items)
    && layer.items.every((item: { id?: unknown; typeId?: unknown; attributes?: unknown }) => typeof item.id === 'string' && typeof item.typeId === 'string' && (item.attributes === undefined || Array.isArray(item.attributes))))
  && value.some(layer => layer.id === 'mac' && layer.items.length > 0)

/** Called only after a successful build + real catalog probe. Never invent a catalog from source. */
export const rememberSimulatorBuild = (selectedHome: string, before: string | null, catalog: CatalogLayer[]) => {
  let temporary = ''
  try {
    const home = fs.realpathSync(selectedHome), input = simulatorInputSignature(home), output = outputSignature(home)
    if (!before || before !== input || !output) return
    const snapshot: Snapshot = { version: 1, home, input, output, catalog }
    fs.mkdirSync(cacheRoot, { recursive: true })
    temporary = `${cachePath(home)}.${randomUUID()}.tmp`
    fs.writeFileSync(temporary, JSON.stringify(snapshot))
    fs.renameSync(temporary, cachePath(home))
  } catch { /* A non-writable cache must never turn a successful build into a failure. */ }
  finally { if (temporary) { try { fs.rmSync(temporary, { force: true }) } catch { /* best effort */ } } }
}
export const forgetSimulatorBuild = (selectedHome: string) => {
  try { fs.rmSync(cachePath(fs.realpathSync(selectedHome)), { force: true }) } catch { /* no saved build */ }
}
export const reusableSimulatorCatalog = (selectedHome: string): CatalogLayer[] | null => {
  try {
    const home = fs.realpathSync(selectedHome)
    const saved: Snapshot = JSON.parse(fs.readFileSync(cachePath(home), 'utf8'))
    if (saved.version !== 1 || saved.home !== home || !validCatalog(saved.catalog)
      || saved.output !== outputSignature(home) || saved.input !== simulatorInputSignature(home)) return null
    restoreCatalog(home, saved.catalog)
    return saved.catalog
  } catch { return null }
}
