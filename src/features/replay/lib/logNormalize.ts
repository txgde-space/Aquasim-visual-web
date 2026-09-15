import type { ParsedNodeEventRecord, ParsedPacketRecord } from '@/shared/types/log'
import type { Movement, Point3D, ReceiverStatus, ReplayNode, ReplayPacket, ReplayReceiver } from '@/shared/types/replay'
import { sanitizeDisplayText } from '@/shared/logSafety'
import { clampRatio, normalizeTime } from './format'

/** `??`-style alias lookup: first key whose value is neither null nor undefined. */
export const pickAlias = (record: Record<string, unknown>, keys: readonly string[]): unknown => {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

/** `||`-style lookup for the first truthy string-ish value. */
export const pickTruthy = (record: Record<string, unknown>, keys: readonly string[]): unknown => {
  for (const key of keys) {
    const value = record[key]
    if (value) return value
  }
  return undefined
}

export const finiteOrNull = (value: unknown): number | null => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export const deriveReasonFromLegacy = (result: unknown): string => {
  if (result === 'collision') return 'collision_rx_rx'
  if (result === 'half_duplex_busy') return 'collision_rx_tx'
  if (result === 'below_snr' || result === 'out_of_range') return 'below_rx_thresh'
  return 'decode_error'
}

export const resolveNodePoint = (rawPoint: Record<string, unknown>, fallbackPoint: Point3D | null = null): Point3D => ({
  x: finiteOrNull(rawPoint.x) ?? fallbackPoint?.x ?? 0,
  y: finiteOrNull(rawPoint.y) ?? fallbackPoint?.y ?? 0,
  z: finiteOrNull(rawPoint.z) ?? fallbackPoint?.z ?? 0,
})

export const interpolateNodePoint = (start: Point3D, end: Point3D, ratio: number): Point3D => ({
  x: start.x + ((end.x - start.x) * ratio),
  y: start.y + ((end.y - start.y) * ratio),
  z: (start.z ?? 0) + (((end.z ?? 0) - (start.z ?? 0)) * ratio),
})

const MOVEMENT_START_KEYS = ['from_x', 'start_x'] as const
const MOVEMENT_END_KEYS = ['to_x', 'end_x', 'target_x'] as const

export const normalizeMovements = (movementRows: Array<Record<string, unknown>>, nodes: Array<ReplayNode>): Movement[] => {
  const nodeDefaults = new Map<number, Point3D>(nodes.map((node) => [node.node_id, { x: node.x, y: node.y, z: node.z ?? 0 }]))
  const lastNodePoint = new Map<number, Point3D>(nodeDefaults)

  return movementRows
    .filter((item) => Number.isFinite(Number(item.node_id)))
    .map((item, index): Record<string, unknown> => ({ ...item, node_id: Number(item.node_id), __index: index }))
    .sort((a, b) => normalizeTime(a.start_us) - normalizeTime(b.start_us) || (a.__index as number) - (b.__index as number))
    .map((item): Movement => {
      const nodeId = item.node_id as number
      const previousPoint = lastNodePoint.get(nodeId) || nodeDefaults.get(nodeId) || { x: 0, y: 0, z: 0 }
      const nestedStart = item.start as Record<string, unknown> | undefined
      const nestedEnd = item.end as Record<string, unknown> | undefined
      const start = resolveNodePoint({
        x: pickAlias(item, MOVEMENT_START_KEYS) ?? nestedStart?.x ?? item.x,
        y: pickAlias(item, ['from_y', 'start_y']) ?? nestedStart?.y ?? item.y,
        z: pickAlias(item, ['from_z', 'start_z']) ?? nestedStart?.z ?? item.z,
      }, previousPoint)
      const end = resolveNodePoint({
        x: pickAlias(item, MOVEMENT_END_KEYS) ?? nestedEnd?.x ?? item.x,
        y: pickAlias(item, ['to_y', 'end_y', 'target_y']) ?? nestedEnd?.y ?? item.y,
        z: pickAlias(item, ['to_z', 'end_z', 'target_z']) ?? nestedEnd?.z ?? item.z,
      }, start)
      const startUs = normalizeTime(item.start_us)
      const endUs = Math.max(startUs, normalizeTime(pickAlias(item, ['end_us', 'stop_us'])))
      const durationUs = Math.max(1, endUs - startUs)

      lastNodePoint.set(nodeId, end)

      return {
        ...item,
        type: 'movement',
        node_id: nodeId,
        x: end.x,
        y: end.y,
        z: end.z ?? 0,
        start,
        end,
        start_us: startUs,
        end_us: endUs,
        duration_us: durationUs,
      }
    })
}

export const resolveMovingNodes = (nodes: ReplayNode[], movements: Movement[], timeUs: number): ReplayNode[] => {
  const nodeMap = new Map<number, ReplayNode>(nodes.map((node) => [node.node_id, { ...node }]))

  for (const movement of movements) {
    const node = nodeMap.get(movement.node_id)
    if (!node || timeUs < movement.start_us) continue

    if (timeUs >= movement.end_us) {
      Object.assign(node, movement.end)
      continue
    }

    const ratio = clampRatio((timeUs - movement.start_us) / Math.max(1, movement.duration_us))
    Object.assign(node, interpolateNodePoint(movement.start, movement.end, ratio))
  }

  return [...nodeMap.values()]
}

export const normalizeReceiver = (
  packetId: string,
  receiver: Record<string, unknown>,
  index: number,
  fallbackDurationUs: number,
): ReplayReceiver => {
  const startUs = normalizeTime(pickAlias(receiver, ['rx_start_us', 'start_us']))
  const durationUs = Math.max(1, normalizeTime(pickAlias(receiver, ['rx_duration_us', 'duration_us']) ?? fallbackDurationUs))
  const rawStatus = receiver.status
  const status: ReceiverStatus = rawStatus === 'ok' || receiver.result === 'ok' ? 'ok' : 'fail'

  return {
    ...receiver,
    receiver_id: sanitizeDisplayText(receiver.receiver_id || `${packetId}-rx-${index + 1}`, 80),
    dst: Number(receiver.dst),
    status,
    reason: status === 'ok' ? null : sanitizeDisplayText(receiver.reason || deriveReasonFromLegacy(receiver.result), 80),
    with: Array.isArray(receiver.with)
      ? receiver.with.map((item) => sanitizeDisplayText(item, 80))
      : Array.isArray(receiver.collided_with)
        ? receiver.collided_with.map((item) => sanitizeDisplayText(item, 80))
        : [],
    rx_start_us: startUs,
    rx_duration_us: durationUs,
    rx_end_us: startUs + durationUs,
  }
}

export const normalizeCommitted = (value: unknown): boolean => !(value === false || value === 'false')

const PACKET_ID_KEYS = ['packet_id', 'tx_id'] as const

export const normalizePacket = (packet: Record<string, unknown>, index: number): ReplayPacket => {
  const packetId = sanitizeDisplayText(pickTruthy(packet, PACKET_ID_KEYS) || `pkt-${index + 1}`, 80)
  const eventId = sanitizeDisplayText(packet.event_id || packet.tx_id || `${packetId}-seg-${index + 1}`, 100)
  const txStartUs = normalizeTime(pickAlias(packet, ['tx_start_us', 'start_us']))
  const txCommitted = normalizeCommitted(packet.tx_committed)
  const txDurationRawUs = normalizeTime(pickAlias(packet, ['tx_duration_us', 'duration_us']))
  const txDurationUs = txCommitted ? Math.max(1, txDurationRawUs) : Math.max(0, txDurationRawUs)
  const txEndUs = normalizeTime(packet.tx_end_us ?? packet.end_us ?? (txStartUs + txDurationUs))
  const receivers = Array.isArray(packet.receivers)
    ? (packet.receivers as Array<Record<string, unknown>>)
      .map((receiver, receiverIndex) => normalizeReceiver(packetId, receiver, receiverIndex, txDurationUs))
      .filter((receiver) => Number.isFinite(receiver.dst))
      .sort((a, b) => a.rx_start_us - b.rx_start_us)
    : []

  const packetEndUs = Math.max(txEndUs, ...receivers.map((receiver) => receiver.rx_end_us))
  return {
    ...packet,
    type: 'packet',
    eventId,
    packet_id: packetId,
    src: Number(packet.src),
    tx_committed: txCommitted,
    tx_blocked_reason: txCommitted ? null : (packet.tx_blocked_reason ? sanitizeDisplayText(packet.tx_blocked_reason, 80) : null),
    tx_start_us: txStartUs,
    tx_duration_us: txDurationUs,
    tx_end_us: txEndUs,
    timeStart: txStartUs,
    timeEnd: packetEndUs,
    receivers,
  }
}

export const buildPacketsFromLegacy = (txRows: Array<Record<string, unknown>>, rxRows: Array<Record<string, unknown>>): ParsedPacketRecord[] => {
  const rxByTx = new Map<unknown, Array<Record<string, unknown>>>()
  for (const item of rxRows) {
    const list = rxByTx.get(item.tx_id) || []
    list.push(item)
    rxByTx.set(item.tx_id, list)
  }

  return txRows.map((txItem, index): ParsedPacketRecord => ({
    type: 'packet',
    event_id: String(txItem.tx_id || `tx-${index + 1}`),
    tx_id: String(txItem.tx_id || `tx-${index + 1}`),
    packet_id: String(txItem.packet_uid || txItem.tx_id || `pkt-${index + 1}`),
    src: Number(txItem.src),
    tx_start_us: normalizeTime(txItem.start_us),
    tx_duration_us: Math.max(1, normalizeTime(txItem.duration_us)),
    receivers: (rxByTx.get(txItem.tx_id) || []).map((rxItem) => ({
      receiver_id: String(rxItem.rx_id || `${txItem.tx_id || `tx-${index + 1}`}-rx-${rxItem.dst || 'x'}`),
      dst: Number(rxItem.dst),
      rx_start_us: normalizeTime(rxItem.start_us),
      rx_duration_us: Math.max(1, normalizeTime(rxItem.duration_us || txItem.duration_us)),
      status: rxItem.result === 'ok' ? 'ok' : 'fail',
      reason: rxItem.result === 'ok' ? null : deriveReasonFromLegacy(rxItem.result),
      with: Array.isArray(rxItem.collided_with) ? rxItem.collided_with.map(String) : [],
    })),
  }))
}

const EVENT_TIME_KEYS = ['time_us', 'tx_start_us', 'rx_start_us', 'start_us', 'local_time_us', 'utc_us'] as const

export const eventTimeUs = (event: Record<string, unknown>): number => normalizeTime(pickAlias(event, EVENT_TIME_KEYS))

export const nodeEventPacketId = (event: Record<string, unknown>, fallbackIndex: number): string => String(
  pickTruthy(event, ['packet_id', 'packet_uid', 'tx_id', 'seq', 'sequence'])
  || `node-event-${fallbackIndex + 1}`,
)

export const nodeEventTxKey = (event: Record<string, unknown>, fallbackIndex: number): string => String(
  event.event_id
  || event.tx_id
  || `${nodeEventPacketId(event, fallbackIndex)}-src-${event.src ?? event.node_id ?? 'x'}-t-${eventTimeUs(event)}`,
)

export interface MergedRxEvent {
  [key: string]: unknown
  packet_id: string
  tx_key: string | null
  src: number
  receiver_id: string
  dst: number
  rx_start_us: number
  rx_duration_us: number
  status: ReceiverStatus
  reason: string | null
  with: string[]
}

export interface MergedTxEvent {
  [key: string]: unknown
  type: 'packet'
  event_id: string
  packet_id: string
  src: number
  tx_start_us: number
  tx_duration_us: number
  tx_end_us: number
  tx_committed: boolean
  tx_blocked_reason: string | null
  receivers: MergedRxEvent[]
}

export const normalizeNodeTxEvent = (event: ParsedNodeEventRecord, index: number): MergedTxEvent => {
  const packetId = nodeEventPacketId(event, index)
  const txStartUs = normalizeTime(pickAlias(event, ['tx_start_us', 'start_us', 'time_us', 'utc_us']))
  const txDurationUs = Math.max(0, normalizeTime(pickAlias(event, ['tx_duration_us', 'duration_us'])))
  const txCommitted = event.type !== 'tx_blocked' && normalizeCommitted(event.tx_committed)

  return {
    ...event,
    type: 'packet',
    event_id: nodeEventTxKey(event, index),
    packet_id: packetId,
    src: Number(event.src ?? event.node_id),
    tx_start_us: txStartUs,
    tx_duration_us: txCommitted ? Math.max(1, txDurationUs) : txDurationUs,
    tx_end_us: normalizeTime(event.tx_end_us ?? event.end_us ?? (txStartUs + txDurationUs)),
    tx_committed: txCommitted,
    tx_blocked_reason: txCommitted ? null : String(event.tx_blocked_reason || event.reason || 'busy'),
    receivers: [],
  }
}

export const normalizeNodeRxEvent = (event: ParsedNodeEventRecord, index: number): MergedRxEvent => {
  const packetId = nodeEventPacketId(event, index)
  const rxStartUs = normalizeTime(pickAlias(event, ['rx_start_us', 'start_us', 'time_us', 'utc_us']))
  const rxDurationUs = Math.max(1, normalizeTime(pickAlias(event, ['rx_duration_us', 'duration_us'])))
  const status: ReceiverStatus = event.status === 'ok' || event.result === 'ok' ? 'ok' : 'fail'
  const rawTxKey = event.event_id || event.tx_id

  return {
    ...event,
    packet_id: packetId,
    tx_key: rawTxKey ? String(rawTxKey) : null,
    src: Number(event.src),
    receiver_id: String(event.receiver_id || event.rx_id || `${packetId}-node-rx-${index + 1}`),
    dst: Number(event.dst ?? event.node_id),
    rx_start_us: rxStartUs,
    rx_duration_us: rxDurationUs,
    status,
    reason: status === 'ok' ? null : String(event.reason || deriveReasonFromLegacy(event.result)),
    with: Array.isArray(event.with)
      ? event.with.map(String)
      : Array.isArray(event.collided_with)
        ? event.collided_with.map(String)
        : [],
  }
}
