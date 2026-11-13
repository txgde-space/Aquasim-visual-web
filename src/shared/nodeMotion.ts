import type { Point3D } from './types/replay'

/** World-space heading; consumers map it to their own canvas or scene axes. */
export const motionAngles = (direction?: Point3D): { heading: number; pitch: number } | null => {
  if (!direction) return null
  const { x, y, z = 0 } = direction
  if (![x, y, z].every(Number.isFinite) || Math.hypot(x, y, z) <= 1e-9) return null
  return { heading: Math.atan2(y, x), pitch: Math.atan2(z, Math.hypot(x, y)) }
}
