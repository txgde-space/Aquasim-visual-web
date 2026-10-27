import fs from 'node:fs'
import path from 'node:path'
import { inspectSimulator } from './simulatorConfig'
import { BUILTIN_PROTOCOL_SOURCES } from '../src/features/experiment/lib/builtinProtocols'

const MODULE_PATH = 'src/aqua-sim-tg'
const MAX_FILE_BYTES = 1_000_000
const MAX_SCAN_BYTES = 32_000_000
const MAX_ENTRIES = 4096
const IMPLEMENTATION = /\.(?:cc|cpp|cxx)$/i

class SourceError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

const inside = (root: string, file: string) => {
  const relative = path.relative(root, file)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

// Ignore commented examples and raw strings before looking for TypeId constructors.
const registeredTypes = (code: string): string[] => {
  const declarations = code.replace(
    /R"([^\s()\\]{0,16})\([\s\S]*?\)\1"|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (token) => token.startsWith('"') ? token : ' ',
  )
  return Array.from(declarations.matchAll(/\bTypeId\b\s*(?:[A-Za-z_]\w*\s*)?[({]\s*"(ns3::[A-Za-z0-9_:]+)"\s*[)}]/g), (match) => match[1])
}

interface SourceRequest { aquaSimHome?: unknown; typeId?: unknown; path?: unknown }
interface SourceFile { path: string; language: 'cpp' }
type SourcePayload = { ok: true; typeId: string; files: SourceFile[]; selectedPath: string; code: string }
  | { ok: false; error: string }

/** Read only protocol implementation/header files; never configure or execute ns-3. */
export const readProtocolSource = async (request: SourceRequest): Promise<{ status: number; payload: SourcePayload }> => {
  try {
    if (typeof request.typeId !== 'string' || request.typeId.length > 256 || !/^ns3::[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/.test(request.typeId)) {
      throw new SourceError(400, '缺少有效的协议 TypeId')
    }
    const typeId = request.typeId
    if (request.path !== undefined && typeof request.path !== 'string') throw new SourceError(400, '源码路径必须是字符串')
    const selected = request.path as string | undefined
    const builtin = BUILTIN_PROTOCOL_SOURCES.find((source) => registeredTypes(source.code).includes(typeId))
    if (selected !== undefined && (builtin ? selected !== builtin.path : (!selected.startsWith(`${MODULE_PATH}/`) || selected.includes('\\') || selected.includes('\0') || selected.length > 1024 || path.posix.normalize(selected) !== selected))) {
      throw new SourceError(403, '只能查看当前协议关联的源码文件')
    }
    if (request.aquaSimHome !== undefined && typeof request.aquaSimHome !== 'string') throw new SourceError(400, '仿真目录必须是字符串')
    const config = inspectSimulator(request.aquaSimHome)
    if (!config.ok) throw new SourceError(400, config.error)
    if (builtin) {
      return { status: 200, payload: { ok: true, typeId,
        files: [{ path: builtin.path, language: 'cpp' }], selectedPath: builtin.path, code: builtin.code } }
    }
    const home = await fs.promises.realpath(config.home)
    for (const directory of [path.join(home, 'src'), path.join(home, MODULE_PATH)]) {
      if ((await fs.promises.lstat(directory)).isSymbolicLink()) throw new SourceError(403, '协议源码目录不能使用符号链接')
    }
    const moduleRoot = await fs.promises.realpath(path.join(home, MODULE_PATH))
    if (!inside(home, moduleRoot)) throw new SourceError(403, '协议源码目录不能通过符号链接指向仿真目录之外')
    let scannedBytes = 0
    let entries = 0
    const implementations: string[] = []
    const sourceCodes = new Map<string, string>()

    const readSource = async (file: string): Promise<string> => {
      const real = await fs.promises.realpath(file)
      if (!inside(moduleRoot, real)) throw new SourceError(403, '源码文件不能通过符号链接越过协议目录')
      // Do not follow final-component symlinks; check again after opening to bound
      // reads even when a file changes between directory traversal and open.
      const handle = await fs.promises.open(real, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
      try {
        const stat = await handle.stat()
        if (!stat.isFile()) throw new SourceError(403, '只能查看普通源码文件')
        if (stat.size > MAX_FILE_BYTES) throw new SourceError(413, '源码文件超过 1 MB，无法在面板中查看')
        if (scannedBytes + stat.size > MAX_SCAN_BYTES) throw new SourceError(413, '协议源码总量过大，无法完成检索')
        const buffer = Buffer.alloc(MAX_FILE_BYTES + 1)
        let bytes = 0
        while (bytes < buffer.length) {
          const result = await handle.read(buffer, bytes, buffer.length - bytes, null)
          if (result.bytesRead === 0) break
          bytes += result.bytesRead
        }
        if (bytes > MAX_FILE_BYTES) throw new SourceError(413, '源码文件超过 1 MB，无法在面板中查看')
        scannedBytes += bytes
        if (scannedBytes > MAX_SCAN_BYTES) throw new SourceError(413, '协议源码总量过大，无法完成检索')
        return buffer.subarray(0, bytes).toString('utf8')
      } finally { await handle.close() }
    }

    const scan = async (directory: string, depth = 0): Promise<void> => {
      if (depth > 32) throw new SourceError(413, '协议源码目录层级过深，无法完成检索')
      const real = await fs.promises.realpath(directory)
      if (!inside(moduleRoot, real)) throw new SourceError(403, '源码目录不能通过符号链接越过协议目录')
      for await (const entry of await fs.promises.opendir(directory)) {
        if (++entries > MAX_ENTRIES) throw new SourceError(413, '协议源码文件过多，无法完成检索')
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) await scan(file, depth + 1)
        // Symlinked files/directories are deliberately excluded from discovery.
        else if (entry.isFile() && IMPLEMENTATION.test(entry.name)) {
          const code = await readSource(file)
          if (registeredTypes(code).includes(typeId)) {
            implementations.push(file)
            sourceCodes.set(file, code)
          }
        }
      }
    }
    await scan(moduleRoot)
    if (!implementations.length) throw new SourceError(404, `未在所选仿真目录中找到 ${typeId} 的实现源码`)
    implementations.sort()
    const candidates = [...implementations]
    for (const implementation of implementations) {
      for (const extension of ['.h', '.hpp', '.hxx']) {
        const header = implementation.replace(IMPLEMENTATION, extension)
        try {
          const stat = await fs.promises.lstat(header)
          if (stat.isFile()) candidates.push(header)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
    }
    const paths = new Map(candidates.map((file) => [`${MODULE_PATH}/${path.relative(moduleRoot, file).split(path.sep).join('/')}`, file]))
    const selectedPath = selected ?? paths.keys().next().value!
    const file = paths.get(selectedPath)
    if (!file) throw new SourceError(403, '只能查看当前协议关联的源码文件')
    const code = sourceCodes.get(file) ?? await readSource(file)
    return { status: 200, payload: { ok: true, typeId, files: [...paths.keys()].map((item) => ({ path: item, language: 'cpp' })), selectedPath, code } }
  } catch (error) {
    if (error instanceof SourceError) return { status: error.status, payload: { ok: false, error: error.message } }
    const code = (error as NodeJS.ErrnoException).code
    const status = code === 'ENOENT' ? 404 : code === 'EACCES' || code === 'EPERM' || code === 'ELOOP' ? 403 : 500
    return { status, payload: { ok: false, error: status === 404 ? '源码文件不存在，请刷新后重试' : status === 403 ? '无权访问该源码文件' : '读取协议源码失败，请检查仿真目录' } }
  }
}
