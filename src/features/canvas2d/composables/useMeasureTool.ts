import { computed, ref, type ComputedRef, type Ref } from 'vue'

export interface MeasurePoint {
  x: number
  y: number
  z?: number
  nodeId?: number | null
}

export interface MeasureLine {
  id: string
  start: MeasurePoint
  end: MeasurePoint
  distance: number
}

/** Pixel distance from a segment within which a measurement line is pickable. */
export const MEASURE_PICK_THRESHOLD_PX = 10

interface MeasureToolDeps {
  getNodeById: (nodeId: number) => { x: number; y: number; z?: number } | undefined
  pickNodeAtScreen: (sx: number, sy: number) => { node_id: number; x: number; y: number; z?: number } | null
  toWorldFn: (sx: number, sy: number) => { x: number; y: number }
  toScreenFn: (x: number, y: number) => { x: number; y: number }
  scheduleDraw: () => void
  onPauseRequest: () => void
}

export const useMeasureTool = ({
  getNodeById,
  pickNodeAtScreen,
  toWorldFn,
  toScreenFn,
  scheduleDraw,
  onPauseRequest,
}: MeasureToolDeps) => {
  const pendingMeasurePoint: Ref<MeasurePoint | null> = ref(null)
  const measurementLines: Ref<MeasureLine[]> = ref([])
  const measurementHistory: Ref<MeasureLine[][]> = ref([[]])
  const measurementHistoryIndex: Ref<number> = ref(0)
  const selectedMeasurementId: Ref<string | null> = ref(null)
  const hoveredMeasureNode: Ref<unknown | null> = ref(null)

  const canUndo: ComputedRef<boolean> = computed(() => measurementHistoryIndex.value > 0)
  const canRedo: ComputedRef<boolean> = computed(() => measurementHistoryIndex.value < (measurementHistory.value.length - 1))

  const cloneMeasurePoint = (point: MeasurePoint): MeasurePoint => ({
    x: point.x,
    y: point.y,
    ...(Number.isFinite(point.z) ? { z: point.z } : {}),
    ...(point.nodeId !== undefined && point.nodeId !== null ? { nodeId: point.nodeId } : {}),
  })

  /** Snap to the referenced node when it exists, else use stored world coords. */
  const resolveMeasurePoint = (point: MeasurePoint | null): { x: number; y: number; z: number } => {
    if (!point) return { x: 0, y: 0, z: 0 }
    if (point.nodeId !== undefined && point.nodeId !== null) {
      const node = getNodeById(point.nodeId)
      if (node) {
        return {
          x: node.x,
          y: node.y,
          z: node.z ?? 0,
        }
      }
    }
    return {
      x: point.x,
      y: point.y,
      z: point.z ?? 0,
    }
  }

  /** Pick a measure point at screen coords: snapped to a node when one is hit. */
  const createMeasurePoint = (sx: number, sy: number): MeasurePoint => {
    const picked = pickNodeAtScreen(sx, sy)
    if (picked) {
      return {
        nodeId: picked.node_id,
        x: picked.x,
        y: picked.y,
        z: picked.z ?? 0,
      }
    }
    return toWorldFn(sx, sy)
  }

  const distanceByMeasurePoints = (a: MeasurePoint, b: MeasurePoint): number => {
    const p1 = resolveMeasurePoint(a)
    const p2 = resolveMeasurePoint(b)
    return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z)
  }

  const cloneMeasurements = (items: MeasureLine[]): MeasureLine[] => items.map((item) => ({
    id: item.id,
    start: cloneMeasurePoint(item.start),
    end: cloneMeasurePoint(item.end),
    distance: distanceByMeasurePoints(item.start, item.end),
  }))

  const applyMeasurementState = (items: MeasureLine[]) => {
    measurementLines.value = cloneMeasurements(items)
    if (selectedMeasurementId.value && !measurementLines.value.some((item) => item.id === selectedMeasurementId.value)) {
      selectedMeasurementId.value = null
    }
  }

  /** Push a new undoable state; trims any redo branch first. */
  const commitMeasurementState = (items: MeasureLine[], nextSelectedId: string | null = selectedMeasurementId.value) => {
    const snapshot = cloneMeasurements(items)
    measurementHistory.value = measurementHistory.value.slice(0, measurementHistoryIndex.value + 1)
    measurementHistory.value.push(snapshot)
    measurementHistoryIndex.value = measurementHistory.value.length - 1
    measurementLines.value = cloneMeasurements(snapshot)
    selectedMeasurementId.value = nextSelectedId && measurementLines.value.some((item) => item.id === nextSelectedId)
      ? nextSelectedId
      : null
  }

  const selectMeasurementAt = (sx: number, sy: number): MeasureLine | null => {
    let picked: MeasureLine | null = null
    let bestDist = Number.POSITIVE_INFINITY

    for (const item of measurementLines.value) {
      const start = resolveMeasurePoint(item.start)
      const end = resolveMeasurePoint(item.end)
      const a = toScreenFn(start.x, start.y)
      const b = toScreenFn(end.x, end.y)
      const abx = b.x - a.x
      const aby = b.y - a.y
      const ab2 = (abx * abx) + (aby * aby)
      if (ab2 < 1e-6) continue
      const t = Math.max(0, Math.min(1, (((sx - a.x) * abx) + ((sy - a.y) * aby)) / ab2))
      const px = a.x + (abx * t)
      const py = a.y + (aby * t)
      const dist = Math.hypot(sx - px, sy - py)
      if (dist <= MEASURE_PICK_THRESHOLD_PX && dist < bestDist) {
        bestDist = dist
        picked = item
      }
    }

    return picked
  }

  const resetTransient = () => {
    pendingMeasurePoint.value = null
    hoveredMeasureNode.value = null
  }

  const undoMeasurement = () => {
    if (!canUndo.value) return
    measurementHistoryIndex.value -= 1
    applyMeasurementState(measurementHistory.value[measurementHistoryIndex.value])
    pendingMeasurePoint.value = null
    scheduleDraw()
  }

  const redoMeasurement = () => {
    if (!canRedo.value) return
    measurementHistoryIndex.value += 1
    applyMeasurementState(measurementHistory.value[measurementHistoryIndex.value])
    pendingMeasurePoint.value = null
    scheduleDraw()
  }

  const deleteSelectedMeasurement = () => {
    if (!selectedMeasurementId.value) return
    const nextItems = measurementLines.value.filter((item) => item.id !== selectedMeasurementId.value)
    commitMeasurementState(nextItems, null)
    pendingMeasurePoint.value = null
    scheduleDraw()
  }

  const clearMeasurements = () => {
    if (!measurementLines.value.length) return
    commitMeasurementState([], null)
    resetTransient()
    onPauseRequest()
    scheduleDraw()
  }

  return {
    pendingMeasurePoint,
    measurementLines,
    measurementHistory,
    measurementHistoryIndex,
    selectedMeasurementId,
    hoveredMeasureNode,
    canUndo,
    canRedo,
    resolveMeasurePoint,
    createMeasurePoint,
    distanceByMeasurePoints,
    commitMeasurementState,
    selectMeasurementAt,
    resetTransient,
    undoMeasurement,
    redoMeasurement,
    deleteSelectedMeasurement,
    clearMeasurements,
  }
}

export type MeasureTool = ReturnType<typeof useMeasureTool>
