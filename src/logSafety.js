export const MAX_LOG_FILE_BYTES = 12 * 1024 * 1024
export const MAX_LOG_FILES = 20
export const MAX_LOG_NODES = 4000
export const MAX_LOG_PACKETS = 30000
export const MAX_JSONL_LINES = 80000

const ALLOWED_LOG_EXT = new Set(['json', 'jsonl', 'log', 'txt'])

export const sanitizeFileName = (name) => {
  const base = String(name || 'log').replace(/^.*[/\\]/, '')
  const cleaned = base.replace(/[^\w.\-\u4e00-\u9fff]+/g, '_').slice(0, 80)
  return cleaned || 'imported.log'
}

export const sanitizeDisplayText = (value, maxLen = 180) => {
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

export const stripUnsafeKeys = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') continue
    out[key] = value
  }
  return out
}

export const looksLikeMarkup = (text) => (
  /<\s*(script|iframe|object|embed|svg|img|link|meta|form|base|html|body)\b/i.test(String(text).slice(0, 8000))
)

export const validateImportedFile = (file) => {
  if (!file) return { ok: false, error: '未选择文件' }
  if (file.size > MAX_LOG_FILE_BYTES) return { ok: false, error: '文件过大，请导入不超过 12MB 的日志' }
  const ext = String(file.name || '').split('.').pop().toLowerCase()
  if (!ALLOWED_LOG_EXT.has(ext)) return { ok: false, error: '不支持的文件类型，请导入 .json / .jsonl / .log / .txt' }
  return { ok: true }
}

export const validateImportedText = (text) => {
  const raw = String(text ?? '')
  if (!raw.trim()) return { ok: false, error: '日志文件为空' }
  if (raw.length > MAX_LOG_FILE_BYTES) return { ok: false, error: '日志内容过大' }
  if (looksLikeMarkup(raw)) return { ok: false, error: '日志内容包含网页脚本标记，已拒绝导入' }
  return { ok: true }
}

export const capParsedLog = (parsed) => {
  if (parsed.nodes.length > MAX_LOG_NODES) parsed.nodes.length = MAX_LOG_NODES
  if (parsed.packets.length > MAX_LOG_PACKETS) parsed.packets.length = MAX_LOG_PACKETS
  if (parsed.movements.length > MAX_LOG_PACKETS) parsed.movements.length = MAX_LOG_PACKETS
  if (parsed.nodeEvents.length > MAX_LOG_PACKETS) parsed.nodeEvents.length = MAX_LOG_PACKETS
  if (parsed.tx.length > MAX_LOG_PACKETS) parsed.tx.length = MAX_LOG_PACKETS
  if (parsed.rx.length > MAX_LOG_PACKETS) parsed.rx.length = MAX_LOG_PACKETS
  if (parsed.parseErrors.length > 50) parsed.parseErrors.length = 50
  parsed.parseErrors = parsed.parseErrors.map((item) => sanitizeDisplayText(item, 80))
  return parsed
}
