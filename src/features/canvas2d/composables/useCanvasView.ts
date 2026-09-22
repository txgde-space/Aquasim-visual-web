import { ref, type Ref } from 'vue'
import { MAX_VIEW_SCALE, toWorldPoint, type Projection } from '../lib/coordinate'

export const ZOOM_MIN = 0.25
/** Exponential zoom factor per wheel delta unit. */
export const ZOOM_WHEEL_SENSITIVITY = 0.0015
/** Squared pixel distance before a press counts as a drag. */
export const DRAG_THRESHOLD_PX_SQ = 16

export interface CanvasViewOptions {
  getProjection: () => Projection
  getBaseScale: () => number
  getDraw: () => (() => void)
  getCanvasEl: () => HTMLCanvasElement | null
}

/**
 * Pan/zoom view state plus the two "frozen bounds" patches:
 * - dragFrozenBounds: pinned while a node drag is in progress so the scale
 *   does not jitter as dragged nodes move the live bounds.
 * - sessionFrozenBounds: pinned for the whole edit session so the view stays
 *   stable while the user rearranges the topology.
 */
export const useCanvasView = ({ getProjection, getBaseScale, getDraw, getCanvasEl }: CanvasViewOptions) => {
  const pan: Ref<{ x: number; y: number }> = ref({ x: 0, y: 0 })
  const isPanning: Ref<boolean> = ref(false)
  const panStart: Ref<{ x: number; y: number }> = ref({ x: 0, y: 0 })
  const panOffsetStart: Ref<{ x: number; y: number }> = ref({ x: 0, y: 0 })
  const zoom: Ref<number> = ref(1)
  const hasDragged: Ref<boolean> = ref(false)

  const dragFrozenBounds: Ref<{ minX: number; maxX: number; minY: number; maxY: number; spanX: number; spanY: number } | null> = ref(null)
  const sessionFrozenBounds: Ref<{ minX: number; maxX: number; minY: number; maxY: number; spanX: number; spanY: number } | null> = ref(null)

  const beginPan = (sx: number, sy: number) => {
    panStart.value = { x: sx, y: sy }
    panOffsetStart.value = { ...pan.value }
    hasDragged.value = false
  }

  const updatePan = (sx: number, sy: number) => {
    const dx = sx - panStart.value.x
    const dy = sy - panStart.value.y
    if ((dx * dx) + (dy * dy) > DRAG_THRESHOLD_PX_SQ) {
      hasDragged.value = true
    }
    pan.value = {
      x: panOffsetStart.value.x + dx,
      y: panOffsetStart.value.y + dy,
    }
  }

  const resetView = () => {
    pan.value = { x: 0, y: 0 }
    zoom.value = 1
  }

  /** Wheel and slider share the same limits and screen anchor calculation. */
  const setZoomAt = (value: number, cx: number, cy: number) => {
    if (!Number.isFinite(value)) return
    const maxZoom = MAX_VIEW_SCALE / getBaseScale()
    const nextZoom = Math.max(ZOOM_MIN, Math.min(maxZoom, value))
    if (nextZoom === zoom.value) return

    const anchorWorld = toWorldPoint(cx, cy, getProjection())
    zoom.value = nextZoom

    // Apply scale and anchor together, including consecutive wheel events in one frame.
    const proj = getProjection()
    pan.value = {
      x: cx - ((anchorWorld.x - proj.bounds.minX) * proj.scale) - proj.origin.x,
      y: cy - ((proj.bounds.maxY - anchorWorld.y) * proj.scale) - proj.origin.y,
    }
    requestAnimationFrame(() => getDraw()())
  }

  const onWheel = (event: WheelEvent) => {
    const canvas = getCanvasEl()
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const currentZoom = Math.min(zoom.value, MAX_VIEW_SCALE / getBaseScale())
    setZoomAt(currentZoom * Math.exp(-event.deltaY * ZOOM_WHEEL_SENSITIVITY), event.clientX - rect.left, event.clientY - rect.top)
  }

  return {
    pan,
    isPanning,
    panStart,
    panOffsetStart,
    zoom,
    hasDragged,
    dragFrozenBounds,
    sessionFrozenBounds,
    beginPan,
    updatePan,
    resetView,
    setZoomAt,
    onWheel,
  }
}

export type CanvasView = ReturnType<typeof useCanvasView>
