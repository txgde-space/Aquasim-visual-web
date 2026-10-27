/**
 * Unified rAF scheduling for canvas redraws.
 * Replaces the ~25 scattered `requestAnimationFrame(draw)` call sites:
 * requests are deduplicated so at most one frame is pending at a time.
 */
export const useCanvasLoop = (getDraw: () => (() => void), isActive: () => boolean = () => true) => {
  let rafId = 0

  const scheduleDraw = () => {
    if (rafId || !isActive()) return
    rafId = requestAnimationFrame(() => {
      rafId = 0
      if (isActive()) getDraw()()
    })
  }

  const cancelDraw = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  // A clock update already runs inside a browser frame. Once Vue has applied
  // its props, paint in that frame rather than queuing a second rAF: the next
  // clock callback can otherwise consume every other pending draw request.
  const flushDraw = () => {
    cancelDraw()
    if (isActive()) getDraw()()
  }

  return { scheduleDraw, flushDraw, cancelDraw, dispose: cancelDraw }
}

export type CanvasLoop = ReturnType<typeof useCanvasLoop>
