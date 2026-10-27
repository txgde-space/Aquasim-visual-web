import type { ParsedLog } from './types/log'

export const MAX_LOG_FILE_BYTES = 12 * 1024 * 1024
export const MAX_LOG_FILES = 20
export const MAX_LOG_NODES = 4000
export const MAX_LOG_PACKETS = 30000
export const MAX_JSONL_LINES = 80000

const ALLOWED_LOG_EXT = new Set(['json', 'jsonl', 'log', 'txt'])

export type ValidationResult = { ok: true } | { ok: false; error: string }

export const sanitizeFileName = (name: unknown): string => {
  const base = String(name || 'log').replace(/^.*[/\\]/, '')
  const cleaned = base.replace(/[^\w.\-\u4e00-\u9fff]+/g, '_').slice(0, 80)
  return cleaned || 'imported.log'
}

export const sanitizeDisplayText = (value: unknown, maxLen = 180): string => {
  if (value == null) return ''
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value !== 'string') return ''

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g, '')
    .replace(/[<>`]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:\s*text\/html/gi, '')
    .slice(0, maxLen)
}

export const stripUnsafeKeys = <T>(obj: T): T => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue
    out[key] = value
  }
  return out as T
}

export const looksLikeMarkup = (text: unknown): boolean => (
  /<\s*(script|iframe|object|embed|svg|img|link|meta|form|base|html|body)\b/i.test(String(text).slice(0, 8000))
)

export const validateImportedFile = (file: Pick<File, 'name' | 'size'> | null | undefined): ValidationResult => {
  if (!file) return { ok: false, error: '未选择文件' }
  if (file.size > MAX_LOG_FILE_BYTES) return { ok: false, error: '文件过大，请导入不超过 12MB 的日志' }
  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_LOG_EXT.has(ext)) return { ok: false, error: '不支持的文件类型，请导入 .json / .jsonl / .log / .txt' }
  return { ok: true }
}

export const validateImportedText = (text: unknown): ValidationResult => {
  const raw = String(text ?? '')
  if (!raw.trim()) return { ok: false, error: '日志文件为空' }
  if (raw.length > MAX_LOG_FILE_BYTES) return { ok: false, error: '日志内容过大' }
  if (looksLikeMarkup(raw)) return { ok: false, error: '日志内容包含网页脚本标记，已拒绝导入' }
  return { ok: true }
}

export const capParsedLog = <T extends ParsedLog>(parsed: T): T => ({
  ...parsed,
  nodes: parsed.nodes.slice(0, MAX_LOG_NODES),
  packets: parsed.packets.slice(0, MAX_LOG_PACKETS),
  movements: parsed.movements.slice(0, MAX_LOG_PACKETS),
  nodeEvents: parsed.nodeEvents.slice(0, MAX_LOG_PACKETS),
  tx: parsed.tx.slice(0, MAX_LOG_PACKETS),
  rx: parsed.rx.slice(0, MAX_LOG_PACKETS),
  parseErrors: parsed.parseErrors.slice(0, 50).map((item) => sanitizeDisplayText(item, 80)),
})
