interface Size { width: number; height: number }
interface ProjectedPoint { x: number; y: number; z: number }

/** Projected coordinates use CSS pixels, independently of the render buffer resolution. */
export const nodeCardPosition = (point: ProjectedPoint, viewport: Size, card: Size): { x: number; y: number } | null => {
  const { x, y, z } = point
  if (![x, y, z, viewport.width, viewport.height, card.width, card.height].every(Number.isFinite)
    || viewport.width <= 0 || viewport.height <= 0 || z < 0 || z > 1
    || x < 0 || x > viewport.width || y < 0 || y > viewport.height) return null
  const margin = 8, gap = 14
  const width = Math.min(card.width, Math.max(0, viewport.width - margin * 2))
  const height = Math.min(card.height, Math.max(0, viewport.height - margin * 2))
  const left = x + gap + width <= viewport.width - margin ? x + gap : x - gap - width
  return {
    x: Math.max(margin, Math.min(viewport.width - width - margin, left)),
    y: Math.max(margin, Math.min(viewport.height - height - margin, y - height / 2)),
  }
}
