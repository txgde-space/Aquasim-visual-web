/** Optional visualization data, independent of the executable ns-3 experiment. */
export interface CanvasMeasurePoint { x: number; y: number; z?: number; nodeId?: number }
export interface CanvasMeasurement { id: string; start: CanvasMeasurePoint; end: CanvasMeasurePoint }
export interface CanvasNodeRange {
  visible: boolean
  radiusM: string
  filled: boolean
  showLabel: boolean
  opacity: number
}
export interface CanvasState {
  version: 1
  viewport: { width: number; height: number }
  view: {
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
    center: { x: number; y: number }
    /** Pixels per meter; window size may differ when reopening an experiment. */
    scale: number
    zoom: number
  }
  /** Editor position locks; never passed to the simulator. */
  lockedNodeIds?: number[]
  nodeSize: number
  measurements: CanvasMeasurement[]
  nodeRanges: Record<number, CanvasNodeRange>
  snapping: { enabled: boolean; grid: boolean; alignment: boolean; spacing: boolean }
}
