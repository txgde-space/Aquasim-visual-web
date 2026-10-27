import { computed, nextTick, onScopeDispose, ref, watch, type Ref } from 'vue'
import { RowHeightIndex, virtualListRange } from '../lib/virtualList'

interface VirtualLogListOptions<T> {
  list: Ref<HTMLElement | null>
  getItems: () => T[]
  isActive?: () => boolean
  threshold?: number
  estimatedRowHeight?: number
  overscan?: number
}

/**
 * Rows carry data-virtual-index and are surrounded by plain height spacers.
 * Measure only mounted rows. Retain the viewport's first row while estimates
 * change, and discard every measurement when content or panel width changes.
 */
export const useVirtualLogList = <T>(options: VirtualLogListOptions<T>) => {
  const estimate = options.estimatedRowHeight ?? 128
  const active = options.isActive ?? (() => true)
  const virtual = computed(() => options.getItems().length > (options.threshold ?? 300))
  const scrollTop = ref(0)
  const viewportHeight = ref(0)
  const leadingOffset = ref(0)
  const revision = ref(0)
  let heights = new RowHeightIndex(0, estimate)
  let host: HTMLElement | null = null
  let width = 0
  let observer: ResizeObserver | null = null
  let frame = 0
  let disposed = false
  let navigation = 0
  let originalOverflowAnchor = ''
  let pendingResizeAnchor: { index: number; inset: number } | null = null
  const observedRows = new Set<HTMLElement>()

  const range = computed(() => {
    revision.value
    if (!virtual.value) return { start: 0, end: options.getItems().length, top: 0, bottom: 0 }
    return virtualListRange(heights, scrollTop.value - leadingOffset.value, viewportHeight.value, options.overscan ?? 6)
  })
  const startIndex = computed(() => range.value.start)
  const topPadding = computed(() => range.value.top)
  const bottomPadding = computed(() => range.value.bottom)
  let previousItems: T[] | null = null
  let previousStart = -1
  let previousEnd = -1
  const windowItems = computed<T[]>((previous) => {
    const items = options.getItems()
    const { start, end } = range.value
    if (previous && previousItems === items && previousStart === start && previousEnd === end) return previous
    previousItems = items
    previousStart = start
    previousEnd = end
    return virtual.value ? items.slice(start, end) : items
  })

  const anchor = () => {
    // Estimates can differ substantially before the first measurement. Prefer
    // the row actually at the viewport edge rather than its estimated index.
    if (host) {
      const top = host.getBoundingClientRect().top + host.clientTop
      for (const row of mountedRows()) {
        const rect = row.getBoundingClientRect()
        if (rect.bottom > top) return { index: Number(row.dataset.virtualIndex), inset: top - rect.top }
      }
    }
    const relative = scrollTop.value - leadingOffset.value
    const index = heights.indexAt(Math.max(0, relative))
    return { index, inset: relative - heights.offset(index) }
  }
  const setScrollTop = (top: number) => {
    const value = Math.max(0, top)
    scrollTop.value = value
    if (host && Math.abs(host.scrollTop - value) > 0.5) host.scrollTop = value
    // A changed spacer can increase the scroll range. Retry after DOM patching
    // if the browser initially clamped against the preceding, shorter range.
    void nextTick(() => {
      if (!disposed && host && scrollTop.value === value && Math.abs(host.scrollTop - value) > 0.5) host.scrollTop = value
    })
  }
  const restoreAnchor = (saved: { index: number; inset: number }) => {
    setScrollTop(leadingOffset.value + heights.offset(saved.index) + Math.min(saved.inset, Math.max(0, heights.height(saved.index) - 1)))
  }

  const readViewport = () => {
    if (!host) return
    viewportHeight.value = host.clientHeight
    const nextWidth = host.clientWidth
    if (nextWidth > 0 && width > 0 && nextWidth !== width && virtual.value) {
      const saved = anchor()
      heights = new RowHeightIndex(options.getItems().length, estimate)
      pendingResizeAnchor = saved
      revision.value++
      restoreAnchor(saved)
    }
    if (nextWidth > 0) width = nextWidth
  }

  const mountedRows = () => host
    ? [...host.querySelectorAll<HTMLElement>('[data-virtual-index]')]
    : []

  const measureRows = () => {
    if (!host || !virtual.value || host.clientWidth <= 0) return
    const rows = mountedRows()
    if (!rows.length) return
    // This also accounts for the parse-error row before the leading spacer.
    const firstIndex = Number(rows[0].dataset.virtualIndex)
    const hostTop = host.getBoundingClientRect().top + host.clientTop
    const prefix = rows[0].getBoundingClientRect().top - hostTop + host.scrollTop - heights.offset(firstIndex)
    if (Number.isFinite(prefix) && Math.abs(prefix - leadingOffset.value) > 0.5) leadingOffset.value = Math.max(0, prefix)
    const saved = pendingResizeAnchor ?? anchor()
    pendingResizeAnchor = null
    let changed = false
    for (const row of rows) changed = heights.set(Number(row.dataset.virtualIndex), row.getBoundingClientRect().height) || changed
    if (changed) revision.value++
    restoreAnchor(saved)
  }

  const observeRows = () => {
    const rows = new Set(virtual.value ? mountedRows() : [])
    for (const row of observedRows) {
      if (!rows.has(row)) { observer?.unobserve(row); observedRows.delete(row) }
    }
    for (const row of rows) {
      if (!observedRows.has(row)) { observedRows.add(row); observer?.observe(row) }
    }
  }

  const refresh = () => {
    if (disposed || !host) return
    readViewport()
    // Width changes invalidate the spacer heights; read row positions only after
    // Vue has applied those heights, otherwise the old spacer looks like a header.
    void nextTick(() => {
      if (disposed || !host) return
      observeRows()
      measureRows()
    })
  }
  const onScroll = () => {
    if (frame || disposed) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (!host) return
      scrollTop.value = host.scrollTop
      refresh()
    })
  }
  const cancelNavigation = () => { navigation++ }
  const detach = () => {
    observer?.disconnect()
    observer = null
    observedRows.clear()
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    if (host) {
      host.removeEventListener('scroll', onScroll)
      host.removeEventListener('wheel', cancelNavigation)
      host.removeEventListener('pointerdown', cancelNavigation)
      host.removeEventListener('touchstart', cancelNavigation)
      host.style.overflowAnchor = originalOverflowAnchor
    }
    host = null
  }

  watch(options.getItems, (items) => {
    navigation++
    heights = new RowHeightIndex(items.length, estimate)
    pendingResizeAnchor = null
    revision.value++
    leadingOffset.value = 0
    setScrollTop(0)
  }, { immediate: true, flush: 'sync' })

  watch([options.list, virtual], ([list, enabled]) => {
    navigation++
    detach()
    host = list
    if (!host) return
    originalOverflowAnchor = host.style.overflowAnchor
    if (enabled) host.style.overflowAnchor = 'none'
    host.addEventListener('scroll', onScroll, { passive: true })
    host.addEventListener('wheel', cancelNavigation, { passive: true })
    host.addEventListener('pointerdown', cancelNavigation, { passive: true })
    host.addEventListener('touchstart', cancelNavigation, { passive: true })
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(refresh)
      observer.observe(host)
    }
    setScrollTop(scrollTop.value)
    refresh()
  }, { immediate: true, flush: 'post' })

  watch([windowItems, startIndex, active], () => {
    if (!active()) navigation++
    refresh()
  }, { flush: 'post' })

  const ensureVisible = async (requestedIndex: number): Promise<void> => {
    const token = ++navigation
    const items = options.getItems()
    const index = Math.floor(requestedIndex)
    if (!Number.isFinite(index) || index < 0 || index >= items.length) return
    const valid = () => !disposed && token === navigation && items === options.getItems() && active() && !!host
    // An arbitrary seek may start far outside the mounted window. First render
    // the estimate, then use actual borders; subsequent measurements stay anchored.
    for (let pass = 0; pass < 6; pass++) {
      await nextTick()
      if (!valid()) return
      readViewport()
      const list = host!
      const row = list.querySelector<HTMLElement>(`[data-virtual-index="${index}"]`)
      if (row) {
        const viewportTop = list.getBoundingClientRect().top + list.clientTop
        const rect = row.getBoundingClientRect()
        const above = rect.top - viewportTop
        const below = rect.bottom - viewportTop - list.clientHeight
        if (above < -0.5 || rect.height > list.clientHeight) {
          if (Math.abs(above) < 0.5) return
          setScrollTop(list.scrollTop + above)
        } else if (below > 0.5) setScrollTop(list.scrollTop + below)
        else return
      } else if (virtual.value) {
        const top = leadingOffset.value + heights.offset(index)
        const bottom = top + heights.height(index)
        setScrollTop(top < scrollTop.value ? top : Math.max(top, bottom - list.clientHeight))
      } else return
      await nextTick()
      if (!valid()) return
      observeRows()
      measureRows()
    }
  }

  onScopeDispose(() => {
    disposed = true
    navigation++
    detach()
  })

  return { windowItems, startIndex, topPadding, bottomPadding, virtual, ensureVisible, refresh }
}
