import type { Movement, ReplayNode, ReplayPacket } from './replay'

export interface LogMeta {
  [key: string]: unknown
  type: 'meta'
  schema: string
  time_unit: string
  distance_unit: string
  sim_end_us: number
}

/** Raw record as read from a structured log / JSONL line, before normalization. */
export type RawLogRecord = Record<string, unknown>

export interface ParsedNodeRecord extends ReplayNode {
  type: 'node'
  movements?: RawLogRecord[]
}

export interface ParsedMovementRecord extends Movement {
  [key: string]: unknown
}

export interface ParsedPacketRecord extends ReplayPacket {
  type: 'packet'
}

export interface ParsedNodeEventRecord {
  [key: string]: unknown
  type: string
}

/** Legacy tx/rx row from the pre-v1 schema (converted via buildPacketsFromLegacy). */
export interface ParsedTxRecord {
  [key: string]: unknown
  type: 'tx'
  tx_id?: unknown
  src?: unknown
}

export interface ParsedRxRecord {
  [key: string]: unknown
  type: 'rx'
  tx_id?: unknown
  dst?: unknown
  result?: unknown
}

export type LogRecord =
  | LogMeta
  | ParsedNodeRecord
  | ParsedMovementRecord
  | ParsedPacketRecord
  | ParsedNodeEventRecord
  | ParsedTxRecord
  | ParsedRxRecord

export interface ParsedLog {
  nodes: ParsedNodeRecord[]
  movements: ParsedMovementRecord[]
  packets: ParsedPacketRecord[]
  nodeEvents: ParsedNodeEventRecord[]
  tx: ParsedTxRecord[]
  rx: ParsedRxRecord[]
  parseErrors: string[]
  meta: LogMeta
}
