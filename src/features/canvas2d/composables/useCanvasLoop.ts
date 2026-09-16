/**
 * Unified rAF scheduling for canvas redraws.
 * Replaces the ~25 scattered `requestAnimationFrame(draw)` call sites:
 * requests are deduplicated so at most one frame is pending at a time.
 */
export const useCanvasLoop = (getDraw: () => (() => void)) => {
  let rafId = 0

  const scheduleDraw = () => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      getDraw()()
    })
  }

  const dispose = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  return { scheduleDraw, dispose }
}

export type CanvasLoop = ReturnType<typeof useCanvasLoop>
