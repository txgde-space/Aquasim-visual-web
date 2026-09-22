import type { ReplayNode } from '@/shared/types/replay'

export interface ViewInsets {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  spanX: number
  spanY: number
}

/** Complete world -> screen projection context. */
export interface Projection {
  bounds: Bounds
  origin: { x: number; y: number }
  /** Effective scale (fit scale * zoom). */
  scale: number
  pan: { x: number; y: number }
}

export const NODE_RADIUS_BASE = 18

/** Fraction of the fitted viewport actually used, leaving breathing room. */
export const SCALE_FIT_FACTOR = 0.86

/** At maximum magnification, a 100 m grid cell occupies 56 screen pixels. */
export const MIN_GRID_STEP_METERS = 100
export const GRID_TARGET_PX = 56
export const MAX_VIEW_SCALE = GRID_TARGET_PX / MIN_GRID_STEP_METERS

/** Smallest canvas edge that still counts as a roomy layout. */
export const COMPACT_VIEWPORT_THRESHOLD_PX = 640

/** Extra pixels beyond the node radius within which a node is pickable. */
export const NODE_HIT_EXTRA_PX = 4

const MIN_NODE_RADIUS_PX = 11

export const viewInsetsFor = (width: number, height: number): ViewInsets => {
  const shortest = Math.min(width, height)
  const compact = shortest < COMPACT_VIEWPORT_THRESHOLD_PX
  const base = compact ? 22 : 44
  return {
    left: base + 6,
    top: compact ? 26 : 40,
    right: compact ? 42 : 56,
    bottom: compact ? 62 : 76,
  }
}

export const nodeRadiusFor = (shortestEdge: number): number => {
  if (shortestEdge >= COMPACT_VIEWPORT_THRESHOLD_PX) return NODE_RADIUS_BASE
  return Math.max(MIN_NODE_RADIUS_PX, Math.round(11 + (((shortestEdge - 280) * (NODE_RADIUS_BASE - 11)) / 360)))
}

export const computeBounds = (nodes: Array<Pick<ReplayNode, 'x' | 'y'>>): Bounds => {
  if (!nodes.length) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1, spanX: 1, spanY: 1 }
  }

  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    spanX: Math.max(maxX - minX, 1),
    spanY: Math.max(maxY - minY, 1),
  }
}

/** A blank or single-node editor needs room to place nodes without refitting. */
export const computeEditBounds = (nodes: Array<Pick<ReplayNode, 'x' | 'y'>>): Bounds => {
  if (nodes.length > 1) return computeBounds(nodes)
  const { x = 0, y = 0 } = nodes[0] ?? {}
  return {
    minX: x - 2000,
    maxX: x + 2000,
    minY: y - 2000,
    maxY: y + 2000,
    spanX: 4000,
    spanY: 4000,
  }
}

export const computeScale = (
  width: number,
  height: number,
  insets: ViewInsets,
  bounds: Bounds,
): number => {
  const availW = Math.max(1, width - insets.left - insets.right)
  const availH = Math.max(1, height - insets.top - insets.bottom)
  const sx = availW / bounds.spanX
  const sy = availH / bounds.spanY
  return Math.min(Math.min(sx, sy) * SCALE_FIT_FACTOR, MAX_VIEW_SCALE)
}

export const computeContentOrigin = (
  width: number,
  height: number,
  insets: ViewInsets,
  bounds: Bounds,
  scale: number,
): { x: number; y: number } => {
  const contentW = bounds.spanX * scale
  const contentH = bounds.spanY * scale
  const availW = width - insets.left - insets.right
  const availH = height - insets.top - insets.bottom
  return {
    x: insets.left + (availW - contentW) / 2,
    y: insets.top + (availH - contentH) / 2,
  }
}

export const toScreenPoint = (x: number, y: number, proj: Projection): { x: number; y: number } => ({
  x: proj.origin.x + ((x - proj.bounds.minX) * proj.scale) + proj.pan.x,
  y: proj.origin.y + ((proj.bounds.maxY - y) * proj.scale) + proj.pan.y,
})

export const toWorldPoint = (x: number, y: number, proj: Projection): { x: number; y: number } => {
  const s = Math.max(proj.scale, 1e-6)
  return {
    x: proj.bounds.minX + ((x - proj.origin.x - proj.pan.x) / s),
    y: proj.bounds.maxY - ((y - proj.origin.y - proj.pan.y) / s),
  }
}
