import type { PacketEntry, ReplayPacket } from '@/shared/types/replay'

export interface PacketIntervalIndex {
  packets: PacketEntry[]
  maxEndThrough: number[]
}

/** Entries are already sorted by TX start; retain their order for equal times. */
export const indexPacketIntervals = (packets: PacketEntry[]): PacketIntervalIndex => {
  let maxEnd = -Infinity
  return {
    packets,
    maxEndThrough: packets.map((packet) => {
      maxEnd = Math.max(maxEnd, packet.endUs)
      return maxEnd
    }),
  }
}

const upperPacketStart = (index: PacketIntervalIndex, timeUs: number): number => {
  let low = 0
  let high = index.packets.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (index.packets[mid].startUs <= timeUs) low = mid + 1
    else high = mid
  }
  return low
}

/** Inclusive endpoints match the replay visuals, including backwards seeks. */
export const activePacketsAt = (index: PacketIntervalIndex, timeUs: number): PacketEntry[] => {
  const end = upperPacketStart(index, timeUs)
  const active: PacketEntry[] = []
  for (let i = end - 1; i >= 0 && index.maxEndThrough[i] >= timeUs; i--) {
    if (index.packets[i].endUs >= timeUs) active.push(index.packets[i])
  }
  return active.reverse()
}

/**
 * Potentially changed progress/active rows, without visiting every log entry.
 * Include either endpoint's active set and starts crossed in either direction.
 * Progress uses max(1, duration), so its tail may extend 1 us beyond a zero-length
 * or sub-microsecond event. Widening the start window by 1 us covers that tail
 * without changing the actual inclusive active-interval semantics.
 */
export const changedPacketsBetween = (index: PacketIntervalIndex, previousTime: number, time: number): PacketEntry[] => {
  if (previousTime === time) return []
  const candidates = new Set(activePacketsAt(index, previousTime))
  for (const packet of activePacketsAt(index, time)) candidates.add(packet)
  const start = upperPacketStart(index, Math.min(previousTime, time) - 1)
  const end = upperPacketStart(index, Math.max(previousTime, time))
  for (let i = start; i < end; i++) candidates.add(index.packets[i])
  return [...candidates]
}

export const packetTimingKey = (packet: ReplayPacket): string => JSON.stringify([
  packet.packet_id, packet.eventId, packet.tx_start_us,
])

interface PriorReception { eventId: string; end: number }

/**
 * Index the same predicate as earlierArrivalLate without scanning every packet
 * for every segment. Equal-time sends are not prior events; duplicate event IDs
 * must also be excluded, so keep the largest RX end for two distinct event IDs.
 */
export const indexTimingWarnings = (packets: ReplayPacket[]): Map<string, boolean> => {
  const byPacketId = new Map<string, ReplayPacket[]>()
  for (const packet of packets) {
    const group = byPacketId.get(packet.packet_id) || []
    group.push(packet)
    byPacketId.set(packet.packet_id, group)
  }
  const warnings = new Map<string, boolean>()
  for (const group of byPacketId.values()) {
    const ordered = group.slice().sort((a, b) => a.tx_start_us - b.tx_start_us)
    const latest: { first: PriorReception | null; second: PriorReception | null } = { first: null, second: null }
    for (let start = 0; start < ordered.length;) {
      let end = start + 1
      while (end < ordered.length && ordered[end].tx_start_us === ordered[start].tx_start_us) end++
      for (let i = start; i < end; i++) {
        const packet = ordered[i]
        const prior = latest.first?.eventId === packet.eventId ? latest.second : latest.first
        warnings.set(packetTimingKey(packet), (prior?.end ?? 0) > packet.tx_start_us)
      }
      for (let i = start; i < end; i++) {
        const packet = ordered[i]
        const rxEnd = packet.receivers.reduce((maxEnd, receiver) => receiver.status === 'ok'
          ? Math.max(maxEnd, receiver.rx_end_us) : maxEnd, 0)
        if (latest.first?.eventId === packet.eventId) {
          latest.first.end = Math.max(latest.first.end, rxEnd)
        } else if (latest.second?.eventId === packet.eventId) {
          latest.second.end = Math.max(latest.second.end, rxEnd)
          if (latest.first && latest.second.end > latest.first.end) [latest.first, latest.second] = [latest.second, latest.first]
        } else if (!latest.first || rxEnd > latest.first.end) {
          latest.second = latest.first
          latest.first = { eventId: packet.eventId, end: rxEnd }
        } else if (!latest.second || rxEnd > latest.second.end) {
          latest.second = { eventId: packet.eventId, end: rxEnd }
        }
      }
      start = end
    }
  }
  return warnings
}
