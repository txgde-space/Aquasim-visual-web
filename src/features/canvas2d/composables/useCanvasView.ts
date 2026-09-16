import { ref, type Ref } from 'vue'
import { toWorldPoint, type Projection } from '../lib/coordinate'

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
/** Exponential zoom factor per wheel delta unit. */
export const ZOOM_WHEEL_SENSITIVITY = 0.0015
/** Squared pixel distance before a press counts as a drag. */
export const DRAG_THRESHOLD_PX_SQ = 16

export interface CanvasViewOptions {
  getProjection: () => Projection
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
export const useCanvasView = ({ getProjection, getDraw, getCanvasEl }: CanvasViewOptions) => {
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

  /** Zoom keeping the world point under the cursor anchored on screen. */
  const onWheel = (event: WheelEvent) => {
    const canvas = getCanvasEl()
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    const beforeZoom = zoom.value
    const zoomFactor = Math.exp(-event.deltaY * ZOOM_WHEEL_SENSITIVITY)
    const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, beforeZoom * zoomFactor))
    if (nextZoom === beforeZoom) return

    const anchorWorld = toWorldPoint(cx, cy, getProjection())
    zoom.value = nextZoom

    requestAnimationFrame(() => {
      const proj = getProjection()
      pan.value = {
        x: cx - ((anchorWorld.x - proj.bounds.minX) * proj.scale) - proj.origin.x,
        y: cy - ((proj.bounds.maxY - anchorWorld.y) * proj.scale) - proj.origin.y,
      }
      requestAnimationFrame(() => getDraw()())
    })
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
    onWheel,
  }
}

export type CanvasView = ReturnType<typeof useCanvasView>
