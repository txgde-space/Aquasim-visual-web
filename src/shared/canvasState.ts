import type { CanvasMeasurePoint, CanvasNodeRange, CanvasState } from './types/canvas'

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('画布配置必须是对象')
  return value as Record<string, unknown>
}
const numeric = (value: unknown, label: string, min = -Infinity, max = Infinity): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`画布 ${label} 无效`)
  return value
}
const boolean = (value: unknown): boolean => {
  if (typeof value !== 'boolean') throw new Error('画布开关配置无效')
  return value
}
const point = (value: unknown): CanvasMeasurePoint => {
  const p = object(value)
  const nodeId = p.nodeId === undefined ? undefined : numeric(p.nodeId, '测距节点', 1, 65534)
  if (nodeId !== undefined && !Number.isInteger(nodeId)) throw new Error('画布测距节点编号无效')
  return { x: numeric(p.x, 'X'), y: numeric(p.y, 'Y'),
    ...(p.z === undefined ? {} : { z: numeric(p.z, 'Z') }), ...(nodeId === undefined ? {} : { nodeId }) }
}

/** Strict, side-effect-free import validation; copy only known fields and never mutate input. */
export const parseCanvasState = (value: unknown): CanvasState | undefined => {
  if (value === undefined) return undefined
  const s = object(value)
  if (s.version !== 1) throw new Error('不支持的画布配置版本')
  const viewport = object(s.viewport), view = object(s.view), bounds = object(view.bounds), center = object(view.center)
  const minX = numeric(bounds.minX, 'minX'), maxX = numeric(bounds.maxX, 'maxX')
  const minY = numeric(bounds.minY, 'minY'), maxY = numeric(bounds.maxY, 'maxY')
  if (minX > maxX || minY > maxY || !Number.isFinite(maxX - minX) || !Number.isFinite(maxY - minY)) throw new Error('画布范围无效')
  if (!Array.isArray(s.measurements) || s.measurements.length > 1000) throw new Error('画布测距最多 1000 条')
  const ids = new Set<string>()
  const measurements = s.measurements.map((value) => {
    const line = object(value)
    if (typeof line.id !== 'string' || !line.id || line.id.length > 128 || ids.has(line.id)) throw new Error('画布测距编号无效或重复')
    ids.add(line.id)
    return { id: line.id, start: point(line.start), end: point(line.end) }
  })
  const nodeRanges: Record<number, CanvasNodeRange> = {}
  const ranges = Object.entries(object(s.nodeRanges))
  if (ranges.length > 64) throw new Error('画布节点范围设置最多 64 项')
  for (const [key, value] of ranges) {
    if (!/^[1-9]\d*$/.test(key) || Number(key) > 65534) throw new Error('画布范围节点编号无效')
    const range = object(value)
    if (typeof range.radiusM !== 'string' || range.radiusM.length > 128) throw new Error('画布传播范围输入无效')
    nodeRanges[Number(key)] = { visible: boolean(range.visible), radiusM: range.radiusM,
      filled: boolean(range.filled), showLabel: boolean(range.showLabel), opacity: numeric(range.opacity, '透明度', 0, 1) }
  }
  let lockedNodeIds: number[] | undefined
  if (s.lockedNodeIds !== undefined) {
    if (!Array.isArray(s.lockedNodeIds) || s.lockedNodeIds.length > 65534) throw new Error('画布固定节点列表无效')
    lockedNodeIds = s.lockedNodeIds.map(id=>numeric(id,'固定节点',1,65534))
    if (lockedNodeIds.some(id=>!Number.isInteger(id)) || new Set(lockedNodeIds).size!==lockedNodeIds.length) throw new Error('画布固定节点编号无效或重复')
  }
  const snap = object(s.snapping)
  return {
    version: 1,
    viewport: { width: numeric(viewport.width, '宽度', 1), height: numeric(viewport.height, '高度', 1) },
    view: { bounds: { minX, maxX, minY, maxY }, center: { x: numeric(center.x, '中心 X'), y: numeric(center.y, '中心 Y') },
      scale: numeric(view.scale, '比例', Number.MIN_VALUE, 0.56), zoom: numeric(view.zoom, '缩放', Number.MIN_VALUE) },
    ...(lockedNodeIds === undefined ? {} : {lockedNodeIds}),
    nodeSize: numeric(s.nodeSize, '节点大小', 0.5, 2), measurements, nodeRanges,
    snapping: { enabled: boolean(snap.enabled), grid: boolean(snap.grid), alignment: boolean(snap.alignment), spacing: boolean(snap.spacing) },
  }
}
