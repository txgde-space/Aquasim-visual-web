import { distanceMeters } from '@/shared/acousticSim'
import { MIN_NODE_GAP_M } from '@/shared/constants'
import type { ReplayNode, ReplayPacket } from '@/shared/types/replay'

export const enforceMinGap = (nodes: ReplayNode[]): ReplayNode[] => {
  if (nodes.length < 2) return nodes.map((node) => ({ ...node }))

  let minGap = Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]
      const b = nodes[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dz = (a.z ?? 0) - (b.z ?? 0)
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d > 0 && d < minGap) minGap = d
    }
  }

  if (!Number.isFinite(minGap) || minGap >= MIN_NODE_GAP_M || minGap <= 0) {
    return nodes.map((node) => ({ ...node }))
  }

  const cx = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length
  const cy = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length
  const scale = MIN_NODE_GAP_M / minGap

  return nodes.map((node) => ({
    ...node,
    x: cx + (node.x - cx) * scale,
    y: cy + (node.y - cy) * scale,
  }))
}

export interface PacketSummary {
  packetCount: number
  committedPacketCount: number
  blockedPacketCount: number
  okReceivers: number
  rxrxCollisions: number
  rxtxCollisions: number
}

export const summarizePackets = (rows: ReplayPacket[] | null | undefined): PacketSummary => {
  let committedPacketCount = 0
  let blockedPacketCount = 0
  let okReceivers = 0
  let rxrxCollisions = 0
  let rxtxCollisions = 0

  for (const packet of rows || []) {
    if (packet.tx_committed) committedPacketCount += 1
    else blockedPacketCount += 1
    for (const receiver of packet.receivers || []) {
      if (receiver.status === 'ok') okReceivers += 1
      if (receiver.reason === 'collision_rx_rx') rxrxCollisions += 1
      if (receiver.reason === 'collision_rx_tx') rxtxCollisions += 1
    }
  }

  return {
    packetCount: (rows || []).length,
    committedPacketCount,
    blockedPacketCount,
    okReceivers,
    rxrxCollisions,
    rxtxCollisions,
  }
}

export const earlierArrivalLate = (packet: ReplayPacket, packetRows: ReplayPacket[]): boolean => {
  let latestPriorEnd = 0
  for (const other of packetRows) {
    if (other.packet_id !== packet.packet_id || other.eventId === packet.eventId) continue
    if (other.tx_start_us >= packet.tx_start_us) continue
    for (const receiver of other.receivers || []) {
      if (receiver.status !== 'ok') continue
      latestPriorEnd = Math.max(latestPriorEnd, receiver.rx_end_us)
    }
  }
  return latestPriorEnd > packet.tx_start_us
}

export const formatNodeGap = (nodes: ReplayNode[]): string => {
  if (nodes.length < 2) return '1.00 km'

  let minGap = Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      minGap = Math.min(minGap, distanceMeters(nodes[i], nodes[j]))
    }
  }

  return `${(minGap / 1000).toFixed(2)} km`
}
