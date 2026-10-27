interface ScenePoint {
  x: number
  y: number
  z?: number
}

export interface WorldAxisBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  span: number
}

/** Babylon coordinates use planar y as Z and scaled depth as negative Y. */
export const worldAxisBounds = (nodes: ScenePoint[], depthScale: number): WorldAxisBounds | null => {
  if (!nodes.length) return null
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const node of nodes) {
    const depth = -(node.z ?? 0) * depthScale
    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x)
    minY = Math.min(minY, depth)
    maxY = Math.max(maxY, depth)
    minZ = Math.min(minZ, node.y)
    maxZ = Math.max(maxZ, node.y)
  }
  return { minX, maxX, minY, maxY, minZ, maxZ, span: Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1) }
}

/** Compare against the last drawn bounds so small movements accumulate. */
export const worldAxesNeedRefresh = (previous: WorldAxisBounds | null, next: WorldAxisBounds | null): boolean => {
  if (!previous || !next) return previous !== next
  // The axes have 8% padding (at least 220 units), exceeding this tolerance.
  const tolerance = Math.max(previous.span * 0.05, 10)
  return Math.max(
    Math.abs(next.minX - previous.minX), Math.abs(next.maxX - previous.maxX),
    Math.abs(next.minY - previous.minY), Math.abs(next.maxY - previous.maxY),
    Math.abs(next.minZ - previous.minZ), Math.abs(next.maxZ - previous.maxZ),
  ) >= tolerance
}

interface PacketIdentity {
  eventId?: string
  packet_id: string | number
  src: number
  tx_start_us: number
}

/** A packet UID may have several simultaneous forwarding/retry events. */
export const packetPathKey = (packet: PacketIdentity, destination: number): string => JSON.stringify([
  packet.eventId ?? [packet.packet_id, packet.src, packet.tx_start_us],
  destination,
])
