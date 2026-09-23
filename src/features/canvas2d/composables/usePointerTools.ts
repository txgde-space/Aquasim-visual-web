import { ref, watch, type Ref } from 'vue'
import { DRAG_THRESHOLD_PX_SQ, type CanvasView } from './useCanvasView'
import type { MeasureTool } from './useMeasureTool'

export const TOOL_MODES = Object.freeze({
  PAN: 'pan',
  MEASURE: 'measure',
  SELECT: 'select',
})

interface PointerToolsDeps {
  props: {
    editMode: boolean
    boxSelect: boolean
    nodes: Array<{ node_id: number; x: number; y: number }>
  }
  emit: (event: string, ...args: unknown[]) => void
  view: CanvasView
  measure: MeasureTool
  scheduleDraw: () => void
  getCanvasEl: () => HTMLCanvasElement | null
  pickNodeAt: (sx: number, sy: number) => { node_id: number; x: number; y: number } | null
  toWorld: (sx: number, sy: number) => { x: number; y: number }
  getSelectedIdSet: () => Set<number>
  getViewBounds: () => { minX: number; maxX: number; minY: number; maxY: number; spanX: number; spanY: number }
  setHoveredNodeId: (nodeId: number | null) => void
  setHoverCursor: (x: number, y: number) => void
  updateHoveredNode: (sx: number, sy: number) => void
  updateMeasureHover: (sx: number, sy: number) => void
}

/**
 * Pointer gesture state machine. onPointerDown dispatches by tool mode and
 * edit state; move/up handlers run on the window (registered by the component)
 * so drags continue outside the canvas.
 */
export const usePointerTools = ({
  props,
  emit,
  view,
  measure,
  scheduleDraw,
  getCanvasEl,
  pickNodeAt,
  toWorld,
  getSelectedIdSet,
  getViewBounds,
  setHoveredNodeId,
  setHoverCursor,
  updateHoveredNode,
  updateMeasureHover,
}: PointerToolsDeps) => {
  const toolMode: Ref<string> = ref(TOOL_MODES.PAN)
  const spaceHeld: Ref<boolean> = ref(false)
  const marquee: Ref<{ x0: number; y0: number; x1: number; y1: number; additive: boolean } | null> = ref(null)
  const draggingNodeId: Ref<number | null> = ref(null)
  const dragGroup: Ref<{
    ids: number[]
    start: { x: number; y: number }
    origins: Map<number, { x: number; y: number }>
  } | null> = ref(null)
  let activePointerId: number | null = null

  const capturePointer = (pointerId: number) => {
    try {
      getCanvasEl()?.setPointerCapture(pointerId)
    } catch {
      // ignore
    }
  }

  const releasePointer = () => {
    if (getCanvasEl() && activePointerId !== null) {
      try {
        getCanvasEl()?.releasePointerCapture(activePointerId)
      } catch {
        // ignore
      }
    }
    activePointerId = null
  }

  const startPanGesture = (event: PointerEvent, sx: number, sy: number) => {
    activePointerId = event.pointerId
    view.isPanning.value = true
    setHoveredNodeId(null)
    view.beginPan(sx, sy)
    capturePointer(event.pointerId)
  }

  const nodesInMarquee = (box: { x0: number; y0: number; x1: number; y1: number }) => {
    const left = Math.min(box.x0, box.x1)
    const right = Math.max(box.x0, box.x1)
    const top = Math.min(box.y0, box.y1)
    const bottom = Math.max(box.y0, box.y1)
    return props.nodes.filter((node) => {
      // screen position comes from the component's projection; injected via pick trick is
      // overkill, so the component passes projected positions through props-independent helper
      return nodeScreenInBox(node, left, right, top, bottom)
    })
  }

  // Replaced at construction time by the component (needs its toScreen).
  let nodeScreenInBox: (node: { x: number; y: number }, left: number, right: number, top: number, bottom: number) => boolean = () => false

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== undefined && event.button !== 0 && event.button !== 1) return

    const canvas = getCanvasEl()
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top

    if (event.button === 1 || (spaceHeld.value && toolMode.value !== TOOL_MODES.MEASURE)) {
      startPanGesture(event, sx, sy)
      return
    }

    if (toolMode.value === TOOL_MODES.MEASURE) {
      event.preventDefault()
      event.stopImmediatePropagation()
      const point = measure.createMeasurePoint(sx, sy)

      if (!measure.pendingMeasurePoint.value) {
        const pickedMeasurement = measure.selectMeasurementAt(sx, sy)
        if (pickedMeasurement) {
          measure.selectedMeasurementId.value = pickedMeasurement.id
          scheduleDraw()
          return
        }
        measure.pendingMeasurePoint.value = point
        measure.selectedMeasurementId.value = null
        scheduleDraw()
        return
      }

      const nextMeasurement = {
        id: `measure-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        start: measure.pendingMeasurePoint.value,
        end: point,
        distance: measure.distanceByMeasurePoints(point, measure.pendingMeasurePoint.value),
      }
      measure.commitMeasurementState([...measure.measurementLines.value, nextMeasurement], nextMeasurement.id)
      measure.pendingMeasurePoint.value = null
      scheduleDraw()
      return
    }

    // event.button === 1 was already handled above (startPanGesture + return).
    const forcePan = spaceHeld.value || (props.boxSelect && toolMode.value === TOOL_MODES.PAN)

    if (props.editMode && toolMode.value !== TOOL_MODES.MEASURE && !forcePan) {
      const target = pickNodeAt(sx, sy)
      if (target) {
        event.preventDefault()
        const clickedId = Number(target.node_id)
        const currentIds = [...getSelectedIdSet()]
        let nextIds: number[]
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          nextIds = currentIds.includes(clickedId)
            ? currentIds.filter((id) => id !== clickedId)
            : [...currentIds, clickedId]
        } else if (currentIds.includes(clickedId)) {
          nextIds = currentIds
        } else {
          nextIds = [clickedId]
        }
        emit('selection-change', nextIds)
        emit('node-select', target)
        const origins = new Map<number, { x: number; y: number }>()
        for (const node of props.nodes) {
          if (nextIds.includes(Number(node.node_id))) {
            origins.set(Number(node.node_id), { x: node.x, y: node.y })
          }
        }
        dragGroup.value = {
          ids: nextIds,
          start: toWorld(sx, sy),
          origins,
        }
        draggingNodeId.value = target.node_id
        view.dragFrozenBounds.value = { ...getViewBounds() }
        activePointerId = event.pointerId
        view.hasDragged.value = false
        view.panStart.value = { x: sx, y: sy }
        emit('pause-request')
        capturePointer(event.pointerId)
        scheduleDraw()
        return
      }

      if (props.boxSelect && (event.shiftKey || event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        marquee.value = {
          x0: sx,
          y0: sy,
          x1: sx,
          y1: sy,
          additive: event.shiftKey && (event.ctrlKey || event.metaKey),
        }
        activePointerId = event.pointerId
        view.hasDragged.value = false
        emit('pause-request')
        capturePointer(event.pointerId)
        scheduleDraw()
        return
      }
    }

    const pickedMeasurement = measure.selectMeasurementAt(sx, sy)
    if (pickedMeasurement) {
      measure.selectedMeasurementId.value = pickedMeasurement.id
      scheduleDraw()
      return
    }

    measure.selectedMeasurementId.value = null
    startPanGesture(event, sx, sy)
  }

  const onPointerMove = (event: PointerEvent) => {
    const canvas = getCanvasEl()
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (marquee.value) {
      if ((x - marquee.value.x0) ** 2 + (y - marquee.value.y0) ** 2 > DRAG_THRESHOLD_PX_SQ) view.hasDragged.value = true
      marquee.value = { ...marquee.value, x1: x, y1: y }
      scheduleDraw()
      return
    }

    if (dragGroup.value) {
      if ((x - view.panStart.value.x) ** 2 + (y - view.panStart.value.y) ** 2 > DRAG_THRESHOLD_PX_SQ || view.hasDragged.value) {
        view.hasDragged.value = true
      }
      const world = toWorld(x, y)
      const dx = world.x - dragGroup.value.start.x
      const dy = world.y - dragGroup.value.start.y
      const moves = [...dragGroup.value.origins.entries()].map(([nodeId, origin]) => ({
        node_id: nodeId,
        x: origin.x + dx,
        y: origin.y + dy,
      }))
      emit('nodes-move', moves)
      if (moves.length === 1) {
        emit('node-move', moves[0])
      }
      scheduleDraw()
      return
    }

    if (draggingNodeId.value != null) {
      if ((x - view.panStart.value.x) ** 2 + (y - view.panStart.value.y) ** 2 > DRAG_THRESHOLD_PX_SQ || view.hasDragged.value) {
        view.hasDragged.value = true
      }
      const world = toWorld(x, y)
      emit('node-move', {
        node_id: draggingNodeId.value,
        x: world.x,
        y: world.y,
      })
      scheduleDraw()
      return
    }

    if (!view.isPanning.value) return

    view.updatePan(x, y)
    scheduleDraw()
  }

  const onCanvasPointerMove = (event: PointerEvent) => {
    const canvas = getCanvasEl()
    if (!canvas) return

    if (marquee.value || dragGroup.value || draggingNodeId.value != null) {
      onPointerMove(event)
      return
    }

    const rect = canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    setHoverCursor(sx, sy)
    updateMeasureHover(sx, sy)
    updateHoveredNode(sx, sy)
    if (toolMode.value === TOOL_MODES.MEASURE) {
      scheduleDraw()
    }
  }

  const onCanvasPointerLeave = () => {
    setHoveredNodeId(null)
    setHoverCursor(0, 0)
    if (toolMode.value === TOOL_MODES.MEASURE) {
      measure.hoveredMeasureNode.value = null
      scheduleDraw()
    }
  }

  const onPointerUp = (event: PointerEvent | null) => {
    if (marquee.value) {
      const box = marquee.value
      const picked = nodesInMarquee(box).map((node) => Number(node.node_id))
      let nextIds: number[]
      if (!view.hasDragged.value) {
        nextIds = []
      } else if (box.additive) {
        nextIds = [...new Set([...getSelectedIdSet(), ...picked])]
      } else {
        nextIds = picked
      }
      emit('selection-change', nextIds)
      if (nextIds.length === 1) {
        const node = props.nodes.find((item) => Number(item.node_id) === nextIds[0])
        if (node) emit('node-select', node)
      }
      marquee.value = null
      releasePointer()
      scheduleDraw()
      return
    }

    if (dragGroup.value || draggingNodeId.value != null) {
      emit('node-move-end')
      dragGroup.value = null
      draggingNodeId.value = null
      view.dragFrozenBounds.value = null
      releasePointer()
      scheduleDraw()
      return
    }

    if (!view.isPanning.value) return

    if (!view.hasDragged.value && event?.button === 0 && event.type !== 'pointercancel') {
      const canvas = getCanvasEl()
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const target = pickNodeAt(x, y)
        if (target) {
          emit('node-select', target)
        } else if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
          emit('selection-change', [])
          emit('node-select', null)
        }
      }
    }

    view.isPanning.value = false
    if (event && getCanvasEl()) {
      const rect = getCanvasEl()!.getBoundingClientRect()
      updateHoveredNode(event.clientX - rect.left, event.clientY - rect.top)
    }
    releasePointer()
  }

  const onDragOver = (event: DragEvent) => {
    if (!props.boxSelect && !props.editMode) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (event: DragEvent) => {
    const raw = event.dataTransfer?.getData('application/x-aqua-item')
      || event.dataTransfer?.getData('application/x-aqua-mac')
      || event.dataTransfer?.getData('text/plain')
    if (!raw) return
    let payload: Record<string, unknown> = { layer: 'mac', id: raw, typeId: raw, field: 'macId', scope: 'node' }
    try {
      payload = JSON.parse(raw)
    } catch {
      // keep the mac fallback payload
    }
    const canvas = getCanvasEl()
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const target = pickNodeAt(sx, sy)
    emit('protocol-drop', {
      ...payload,
      macId: (payload as { id?: string; macId?: string }).id || (payload as { macId?: string }).macId,
      nodeId: target ? Number(target.node_id) : null,
    })
  }

  const activateMeasureTool = () => {
    if (toolMode.value === TOOL_MODES.MEASURE) {
      toolMode.value = props.boxSelect ? TOOL_MODES.SELECT : TOOL_MODES.PAN
    } else {
      toolMode.value = TOOL_MODES.MEASURE
    }
    measure.resetTransient()
    emit('pause-request')
    scheduleDraw()
  }

  const cancelActiveTool = () => {
    if (dragGroup.value || draggingNodeId.value != null) emit('node-move-end')
    dragGroup.value = null
    draggingNodeId.value = null
    marquee.value = null
    view.dragFrozenBounds.value = null
    view.isPanning.value = false
    spaceHeld.value = false
    releasePointer()
    toolMode.value = props.boxSelect ? TOOL_MODES.SELECT : TOOL_MODES.PAN
    measure.resetTransient()
    scheduleDraw()
  }

  // Keep the tool mode in sync with boxSelect availability.
  watch(() => props.boxSelect, (enabled) => {
    if (enabled && (toolMode.value === TOOL_MODES.PAN || !toolMode.value)) {
      toolMode.value = TOOL_MODES.SELECT
    }
    if (!enabled && toolMode.value === TOOL_MODES.SELECT) {
      toolMode.value = TOOL_MODES.PAN
    }
  }, { immediate: true })

  return {
    toolMode,
    spaceHeld,
    marquee,
    draggingNodeId,
    dragGroup,
    setNodeScreenInBox: (fn: typeof nodeScreenInBox) => {
      nodeScreenInBox = fn
    },
    onPointerDown,
    onPointerMove,
    onCanvasPointerMove,
    onCanvasPointerLeave,
    onPointerUp,
    onDragOver,
    onDrop,
    activateMeasureTool,
    cancelActiveTool,
  }
}

export type PointerTools = ReturnType<typeof usePointerTools>
