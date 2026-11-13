import { NODE_HIT_EXTRA_PX } from './coordinate'
import { nodeModelExtents } from './nodeModelGeometry'

/** Shared screen-space layout for model outlines, readable IDs and pointer targets. */
export function nodeSpriteLayout(radius: number, nodeId: number) {
  const { halfWidth, halfHeight } = nodeModelExtents(radius)
  const ringRadius = Math.hypot(halfWidth, halfHeight) + 2
  return {
    ringRadius,
    labelX: ringRadius + 10,
    idY: ringRadius + 11,
    idWidth: Math.max(20, String(nodeId).length * 7 + 10),
    idHeight: 16,
  }
}

export function hitNodeSprite(dx: number, dy: number, radius: number, nodeId: number): boolean {
  const layout = nodeSpriteLayout(radius, nodeId)
  if (Math.hypot(dx, dy) <= layout.ringRadius + NODE_HIT_EXTRA_PX) return true
  return Math.abs(dx) <= layout.idWidth / 2 + NODE_HIT_EXTRA_PX
    && Math.abs(dy - layout.idY) <= layout.idHeight / 2 + NODE_HIT_EXTRA_PX
}
