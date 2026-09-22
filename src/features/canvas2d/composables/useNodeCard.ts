import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { DRAG_THRESHOLD_PX_SQ } from './useCanvasView'

interface NodeCardDeps {
  nodeIds: () => number[]
  canvas: Ref<HTMLCanvasElement | null>
  element: Ref<HTMLElement | null>
  pick: (x: number, y: number) => { node_id: number } | null
  allowClick: () => boolean
}

/** Cards open on a node click and remain visible until explicitly dismissed. */
export const useNodeCard = ({ nodeIds, canvas, element, pick, allowClick }: NodeCardDeps) => {
  const nodeId = ref<number | null>(null)
  const pinned = computed(() => nodeId.value != null)
  const size = ref({ width: 360, height: 210 })
  let down: { id: number; x: number; y: number; pointerId: number } | null = null
  let observer: ResizeObserver | undefined
  const close = () => {
    down = null
    nodeId.value = null
  }
  watch(nodeIds, (ids) => { if (nodeId.value != null && !ids.includes(nodeId.value)) close() })
  watch(element, (el) => {
    observer?.disconnect()
    if (!el) return
    observer = new ResizeObserver(() => { size.value = { width: el.offsetWidth, height: el.offsetHeight } })
    observer.observe(el)
  })
  const beginClick = (event: PointerEvent) => {
    down = null
    if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || !allowClick()) return
    const rect = canvas.value?.getBoundingClientRect()
    if (!rect) return
    const node = pick(event.clientX - rect.left, event.clientY - rect.top)
    if (node) down = { id: node.node_id, x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  }
  const endClick = (event: PointerEvent) => {
    const start = down
    down = null
    if (!start || event.pointerId !== start.pointerId || event.type === 'pointercancel') return
    if ((event.clientX - start.x) ** 2 + (event.clientY - start.y) ** 2 > DRAG_THRESHOLD_PX_SQ) return
    const rect = canvas.value?.getBoundingClientRect()
    if (!rect || pick(event.clientX - rect.left, event.clientY - rect.top)?.node_id !== start.id) return
    nodeId.value = start.id
  }
  const outside = (event: PointerEvent) => {
    if (element.value?.contains(event.target as Node)) return
    close()
  }
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
  onMounted(() => {
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('pointerup', endClick)
    window.addEventListener('pointercancel', endClick)
    window.addEventListener('keydown', escape)
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    document.removeEventListener('pointerdown', outside, true)
    window.removeEventListener('pointerup', endClick)
    window.removeEventListener('pointercancel', endClick)
    window.removeEventListener('keydown', escape)
  })
  return { nodeId: computed(() => nodeId.value), pinned, size, close, beginClick }
}
