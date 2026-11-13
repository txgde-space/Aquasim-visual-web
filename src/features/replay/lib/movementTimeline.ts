import type { Movement, Point3D, ReplayNode } from '@/shared/types/replay'
import { interpolateNodePoint } from './logNormalize'

interface MotionSegment {
  movement: Movement
  direction?: Point3D
}

export type MovementIndex = ReadonlyMap<number, readonly MotionSegment[]>

/** Static display extents cover the entire recorded path without refitting per frame. */
export const movementViewBounds = (nodes: readonly Point3D[], movements: readonly Movement[]): Point3D[] => {
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  const include = (point: Point3D) => {
    const { x, y, z = 0 } = point
    if (![x, y, z].every(Number.isFinite)) return
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
  }
  nodes.forEach(include)
  for (const movement of movements) { include(movement.start); include(movement.end) }
  return Number.isFinite(minX) ? [{ x: minX, y: minY, z: minZ }, { x: maxX, y: maxY, z: maxZ }] : []
}

/** Built once per imported trajectory; playback only searches each node's timeline. */
export const indexMovements = (movements: readonly Movement[]): MovementIndex => {
  const byNode = new Map<number, MotionSegment[]>()
  // The parser already orders these. Stable sorting also makes direct callers safe.
  for (const movement of [...movements].sort((a, b) => a.start_us - b.start_us)) {
    const rows = byNode.get(movement.node_id) ?? []
    const direction = {
      x: movement.end.x - movement.start.x,
      y: movement.end.y - movement.start.y,
      z: (movement.end.z ?? 0) - (movement.start.z ?? 0),
    }
    const moving = Math.hypot(direction.x, direction.y, direction.z) > 1e-9
    rows.push({ movement, direction: moving ? direction : rows.at(-1)?.direction })
    byNode.set(movement.node_id, rows)
  }
  return byNode
}

/** Exact positions from the trace, with display-only heading independent of frame order. */
export const movingNodesAt = (nodes: ReplayNode[], index: MovementIndex, timeUs: number): ReplayNode[] => {
  if (!index.size) return nodes
  return nodes.map((node) => {
    const rows = index.get(node.node_id)
    if (!rows?.length || timeUs < rows[0]!.movement.start_us) return node
    let lo = 0, hi = rows.length
    while (lo < hi) {
      const middle = (lo + hi) >>> 1
      if (rows[middle]!.movement.start_us <= timeUs) lo = middle + 1
      else hi = middle
    }
    const { movement, direction } = rows[lo - 1]!
    const position = timeUs >= movement.end_us ? movement.end : interpolateNodePoint(
      movement.start, movement.end, Math.max(0, Math.min(1, (timeUs - movement.start_us) / Math.max(1, movement.duration_us))),
    )
    return { ...node, ...position, ...(direction ? { motionDirection: direction } : {}) }
  })
}
