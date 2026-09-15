import type { ParsedLog, ParsedNodeEventRecord, ParsedNodeRecord } from '@/shared/types/log'
import type { ReplayPacket } from '@/shared/types/replay'
import { capParsedLog } from '@/shared/logSafety'
import { normalizeTime } from './format'
import {
  buildPacketsFromLegacy,
  normalizeMovements,
  normalizeNodeRxEvent,
  normalizeNodeTxEvent,
  normalizePacket,
} from './logNormalize'
import { createEmptyParsedLog } from './logParser'

export const mergeParsedNodeLogs = (parsedLogs: ParsedLog[], fileNames: string[] = []): ParsedLog => {
  const merged = createEmptyParsedLog()
  const nodeById = new Map<number, ParsedNodeRecord>()
  const txEvents: Array<Record<string, unknown>> = []
  const rxEvents: Array<Record<string, unknown>> = []

  parsedLogs.forEach((parsed, fileIndex) => {
    Object.assign(merged.meta, parsed.meta || {})
    for (const node of parsed.nodes || []) {
      if (!Number.isFinite(Number(node.node_id))) continue
      const nodeId = Number(node.node_id)
      const existing = nodeById.get(nodeId)
      nodeById.set(nodeId, {
        ...(existing || {}),
        ...node,
        node_id: nodeId,
        movements: [
          ...(existing?.movements ?? []),
          ...(node.movements ?? []),
        ],
      })
    }
    for (const movement of parsed.movements || []) merged.movements.push({ ...movement })

    const sourceLabel = fileNames[fileIndex] || `node-log-${fileIndex + 1}`
    for (const event of parsed.nodeEvents || []) {
      const eventType = String(event.type === 'node_event' ? event.event : (event.type || event.event || '')).toLowerCase()
      const taggedEvent = { ...event, type: eventType, source_file: sourceLabel }
      if (eventType === 'tx' || eventType === 'tx_start' || eventType === 'tx_blocked') {
        txEvents.push(taggedEvent)
      } else if (eventType === 'rx' || eventType === 'rx_success' || eventType === 'drop' || eventType === 'rx_drop') {
        rxEvents.push(taggedEvent)
      }
    }
    for (const tx of parsed.tx || []) txEvents.push({ ...tx, type: 'tx', source_file: sourceLabel })
    for (const rx of parsed.rx || []) rxEvents.push({ ...rx, type: 'rx', source_file: sourceLabel })
    for (const packet of parsed.packets || []) merged.packets.push({ ...packet })
    for (const error of parsed.parseErrors || []) merged.parseErrors.push(`${sourceLabel}: ${error}`)
  })

  merged.nodes = [...nodeById.values()].sort((a, b) => a.node_id - b.node_id)
  merged.movements = normalizeMovements(merged.movements, merged.nodes)

  const packets = txEvents
    .map((event, index) => normalizeNodeTxEvent(event as unknown as ParsedNodeEventRecord, index))
    .filter((packet) => Number.isFinite(packet.src))
    .sort((a, b) => a.tx_start_us - b.tx_start_us)

  const packetsByTxKey = new Map<string, (typeof packets)[number]>(packets.map((packet) => [packet.event_id, packet]))
  const packetsByPacketId = new Map<string, Array<(typeof packets)[number]>>()
  for (const packet of packets) {
    const list = packetsByPacketId.get(packet.packet_id) || []
    list.push(packet)
    packetsByPacketId.set(packet.packet_id, list)
  }

  rxEvents
    .map((event, index) => normalizeNodeRxEvent(event as unknown as ParsedNodeEventRecord, index))
    .filter((receiver) => Number.isFinite(receiver.dst))
    .sort((a, b) => a.rx_start_us - b.rx_start_us)
    .forEach((receiver) => {
      const directPacket = receiver.tx_key ? packetsByTxKey.get(receiver.tx_key) : undefined
      const candidatePackets = receiver.packet_id ? (packetsByPacketId.get(receiver.packet_id) || []) : []
      const matchedPacket = directPacket || candidatePackets
        .filter((packet) => (!Number.isFinite(receiver.src) || packet.src === receiver.src) && packet.tx_start_us <= receiver.rx_start_us)
        .sort((a, b) => Math.abs(receiver.rx_start_us - a.tx_start_us) - Math.abs(receiver.rx_start_us - b.tx_start_us))[0]
        || candidatePackets[0]

      if (!matchedPacket) {
        const sourceLabel = receiver.source_file ? String(receiver.source_file) : 'node-log'
        merged.parseErrors.push(`${sourceLabel}: 未找到 ${receiver.packet_id} 的 TX 事件`)
        return
      }

      matchedPacket.receivers.push(receiver)
    })

  merged.packets.push(...packets.map((packet) => ({
    ...packet,
    receivers: packet.receivers.slice().sort((a, b) => a.rx_start_us - b.rx_start_us),
  })))

  merged.meta = {
    ...merged.meta,
    schema: 'uan-vis-merged-node-log/v1',
    source_schema: merged.meta.schema,
    log_scope: 'merged-node',
    node_log_count: parsedLogs.length,
    sim_end_us: Math.max(
      normalizeTime(merged.meta.sim_end_us),
      ...merged.packets.map((packet) => Math.max(
        normalizeTime(packet.tx_end_us ?? packet.end_us),
        ...((packet.receivers || []) as Array<Record<string, unknown>>).map((receiver) => normalizeTime(receiver.rx_start_us ?? receiver.start_us) + normalizeTime(receiver.rx_duration_us ?? receiver.duration_us)),
      )),
      ...merged.movements.map((movement) => normalizeTime(movement.end_us)),
    ),
  }

  return capParsedLog(merged)
}

export const normalizePacketsFromParsed = (parsed: ParsedLog, fallbackLogName: string): ReplayPacket[] => (
  (
    parsed.packets.length > 0
      ? parsed.packets
      : (parsed.nodeEvents?.length > 0
        ? mergeParsedNodeLogs([parsed], [fallbackLogName]).packets
        : buildPacketsFromLegacy(parsed.tx, parsed.rx))
  )
    .map((packet, index) => normalizePacket(packet, index))
)
