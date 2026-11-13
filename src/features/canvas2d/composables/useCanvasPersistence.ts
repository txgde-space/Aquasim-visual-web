import { onMounted, watch } from 'vue'
import { parseCanvasState } from '../../../shared/canvasState'
import type { CanvasState } from '../../../shared/types/canvas'

interface CanvasPersistenceOptions {
  enabled: () => boolean
  active: () => boolean
  initial: () => unknown
  capture: () => CanvasState
  restore: (state: CanvasState) => void
  emit: (state: CanvasState) => void
}

/** Restore once per canvas mount; emitted snapshots never feed back into the live view. */
export const useCanvasPersistence = (options: CanvasPersistenceOptions) => {
  let mounted = false
  let previous = ''
  const publish = (snapshot: CanvasState) => {
    // A parent render may replace equal layout props after storing this event.
    // Only publish a changed value, so saving cannot trigger a render feedback loop.
    const encoded = JSON.stringify(snapshot)
    if (encoded === previous) return
    previous = encoded
    options.emit(snapshot)
  }
  onMounted(() => {
    if (options.enabled()) {
      const saved = parseCanvasState(options.initial())
      if (saved) options.restore(saved)
    }
    mounted = true
    if (options.enabled() && options.active()) publish(options.capture())
  })
  watch(() => options.enabled() && options.active() ? options.capture() : null, (snapshot) => {
    if (mounted && snapshot) publish(snapshot)
  }, { deep: true, flush: 'post' })
}
