/** Shared drawing, picking and label envelope; model details never change topology coordinates. */
export const nodeModelExtents = (radius: number): { halfWidth: number; halfHeight: number } => {
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 0
  return { halfWidth: r * 1.55, halfHeight: r * 1.3 }
}
