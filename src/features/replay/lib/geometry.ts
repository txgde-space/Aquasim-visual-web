import { distanceMeters } from '@/shared/acousticSim'
import type { ReplayNode, ReplayPacket } from '@/shared/types/replay'

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
