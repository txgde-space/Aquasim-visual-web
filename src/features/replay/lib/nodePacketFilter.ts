import type { ReplayPacket } from '@/shared/types/replay'

/** Display scope only: keep outgoing events and the selected node's incoming branches. */
export const packetsForNode = (packets: ReplayPacket[], nodeId: number | null): ReplayPacket[] => {
  if (nodeId === null) return packets
  const selected: ReplayPacket[] = []
  for (const packet of packets) {
    if (packet.src === nodeId) {
      selected.push(packet)
      continue
    }
    const receivers = packet.receivers.filter((receiver) => receiver.dst === nodeId)
    if (!receivers.length) continue
    selected.push({ ...packet, receivers,
      timeEnd: receivers.reduce((end, receiver) => Math.max(end, receiver.rx_end_us), packet.tx_end_us),
    })
  }
  return selected
}
