import type {
  LogMeta,
  ParsedLog,
  RawLogRecord,
} from '@/shared/types/log'
import {
  MAX_JSONL_LINES,
  capParsedLog,
  sanitizeDisplayText,
  stripUnsafeKeys,
} from '@/shared/logSafety'
import { normalizeMovements } from './logNormalize'

export const createEmptyParsedLog = (): ParsedLog => ({
  nodes: [],
  movements: [],
  packets: [],
  nodeEvents: [],
  tx: [],
  rx: [],
  parseErrors: [],
  meta: {
    type: 'meta',
    schema: 'uan-vis-packet-log/v1',
    time_unit: 'us',
    distance_unit: 'm',
    sim_end_us: 0,
  },
})

const appendParsedObject = (raw: unknown, parsed: ParsedLog): void => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
  const obj = stripUnsafeKeys(raw as RawLogRecord)

  if (obj.type === 'meta') {
    const meta = stripUnsafeKeys(obj) as LogMeta & Record<string, unknown>
    parsed.meta = {
      ...parsed.meta,
      schema: sanitizeDisplayText(meta.schema || parsed.meta.schema, 80),
      time_unit: sanitizeDisplayText(meta.time_unit || parsed.meta.time_unit, 16),
      distance_unit: sanitizeDisplayText(meta.distance_unit || parsed.meta.distance_unit, 16),
      sim_end_us: Number(meta.sim_end_us ?? parsed.meta.sim_end_us) || 0,
    }
  } else if (obj.type === 'node' && Number.isFinite(Number(obj.node_id))) {
    const nodeId = Number(obj.node_id)
    parsed.nodes.push({
      ...obj,
      type: 'node',
      node_id: nodeId,
      name: sanitizeDisplayText(obj.name, 80) || `Node-${nodeId}`,
      role: sanitizeDisplayText(obj.role, 32) || 'node',
      x: Number(obj.x ?? 0),
      y: Number(obj.y ?? 0),
      z: Number(obj.z ?? 0),
    })
    if (Array.isArray(obj.movements)) {
      for (const movement of obj.movements as RawLogRecord[]) {
        parsed.movements.push({
          ...movement,
          node_id: nodeId,
        })
      }
    }
  } else if (obj.type === 'movement') {
    parsed.movements.push({ ...obj })
  } else if (obj.type === 'packet' && Number.isFinite(Number(obj.src))) {
    parsed.packets.push({ ...obj, type: 'packet' })
  } else if (
    obj.type === 'tx_blocked'
    || obj.type === 'tx_start'
    || obj.type === 'rx_success'
    || obj.type === 'rx_drop'
    || obj.type === 'drop'
    || obj.type === 'node_event'
  ) {
    parsed.nodeEvents.push({ ...obj, type: String(obj.type) })
  } else if (obj.type === 'tx') {
    parsed.tx.push({ ...obj, type: 'tx' })
  } else if (obj.type === 'rx') {
    parsed.rx.push({ ...obj, type: 'rx' })
  }
}

const finalizeParsedLog = (parsed: ParsedLog): ParsedLog => capParsedLog({
  ...parsed,
  movements: normalizeMovements(parsed.movements, parsed.nodes),
})

export const parseStructuredLog = (raw: unknown): ParsedLog => {
  const parsed = createEmptyParsedLog()
  const data: unknown = JSON.parse(String(raw))

  if (Array.isArray(data)) {
    for (const entry of data) appendParsedObject(entry, parsed)
    return finalizeParsedLog(parsed)
  }

  if (!data || typeof data !== 'object') {
    throw new Error('invalid structured log')
  }

  const record = data as RawLogRecord
  if (record.meta && typeof record.meta === 'object') {
    appendParsedObject({ ...(record.meta as RawLogRecord), type: 'meta' }, parsed)
  }
  if (Array.isArray(record.nodes)) {
    for (const entry of record.nodes as RawLogRecord[]) appendParsedObject({ ...entry, type: 'node' }, parsed)
  }
  if (Array.isArray(record.movements)) {
    for (const entry of record.movements as RawLogRecord[]) appendParsedObject({ ...entry, type: 'movement' }, parsed)
  }
  if (Array.isArray(record.packets)) {
    for (const entry of record.packets as RawLogRecord[]) appendParsedObject({ ...entry, type: 'packet' }, parsed)
  }
  if (Array.isArray(record.events)) {
    for (const entry of record.events as RawLogRecord[]) parsed.nodeEvents.push({ ...entry, type: String(entry.type ?? '') })
  }
  if (Array.isArray(record.tx)) {
    for (const entry of record.tx as RawLogRecord[]) appendParsedObject({ ...entry, type: 'tx' }, parsed)
  }
  if (Array.isArray(record.rx)) {
    for (const entry of record.rx as RawLogRecord[]) appendParsedObject({ ...entry, type: 'rx' }, parsed)
  }

  return finalizeParsedLog(parsed)
}

export const parseJsonLinesLog = (raw: unknown): ParsedLog => {
  const lines = String(raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_JSONL_LINES)

  const parsed = createEmptyParsedLog()

  for (const line of lines) {
    try {
      appendParsedObject(JSON.parse(line), parsed)
    } catch {
      parsed.parseErrors.push('invalid-json-line')
    }
  }

  return capParsedLog({
    ...parsed,
    movements: normalizeMovements(parsed.movements, parsed.nodes),
  })
}

export const parseLog = (raw: unknown): ParsedLog => {
  const text = String(raw ?? '').trim()
  if (!text) return createEmptyParsedLog()

  try {
    return parseStructuredLog(text)
  } catch {
    return parseJsonLinesLog(text)
  }
}
