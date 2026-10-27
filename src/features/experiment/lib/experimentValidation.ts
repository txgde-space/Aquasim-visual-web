import type { ExperimentSpec } from '../../../shared/types/experiment'
import { TYPEID_LAYERS, type CatalogItem, type CatalogLayer } from './typeIdCatalog'

export const MIN_NODE_COUNT = 2
export const MAX_NODE_COUNT = 64
export const MIN_NODE_ID = 1
export const MAX_NODE_ID = 65534

export const isNodeId = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= MIN_NODE_ID && value <= MAX_NODE_ID
)

interface NodeGeometry {
  id: unknown
  x: unknown
  y: unknown
  z?: unknown
}

/** Drafts may be empty; only execution requires MIN_NODE_COUNT. */
export const topologyIssues = (nodes: readonly NodeGeometry[], minimum = 0): string[] => {
  const issues: string[] = []
  if (nodes.length < minimum) issues.push(`至少需要 ${minimum} 个节点`)
  if (nodes.length > MAX_NODE_COUNT) issues.push(`最多支持 ${MAX_NODE_COUNT} 个节点`)
  const ids = nodes.map((node) => node?.id)
  if (ids.some((id) => !isNodeId(id))) issues.push(`节点编号必须是 ${MIN_NODE_ID}–${MAX_NODE_ID} 的整数`)
  if (new Set(ids).size !== ids.length) issues.push('节点编号不能重复')
  if (nodes.some((node) => [node?.x, node?.y, node?.z === undefined ? 0 : node.z].some((value) => typeof value !== 'number' || !Number.isFinite(value)))) {
    issues.push('节点坐标必须是有效数字')
  }
  return issues
}

/** Prefer increasing IDs, then reuse a gap when the highest address is occupied. */
export const nextAvailableNodeId = (ids: readonly number[]): number | null => {
  const occupied = new Set(ids.filter(isNodeId))
  const next = occupied.size ? Math.max(...occupied) + 1 : MIN_NODE_ID
  if (next <= MAX_NODE_ID) return next
  for (let id = MIN_NODE_ID; id <= MAX_NODE_ID; id++) {
    if (!occupied.has(id)) return id
  }
  return null
}

const TIME_UNITS: Record<string, number> = {
  fs: 1e-15, ps: 1e-12, ns: 1e-9, us: 1e-6, ms: 1e-3,
  s: 1, min: 60, h: 3600, d: 86400, y: 365 * 86400,
}
const TIME_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(fs|ps|ns|us|ms|s|min|h|d|y)$/i
// Generated programs use ns-3's default signed 64-bit nanosecond clock.
const MAX_TIME_SECONDS = 9_223_372_036

export const parseExperimentTime = (value: unknown, label: string, allowNegative = false): { literal: string; seconds: number } => {
  const match = typeof value === 'string' ? value.trim().match(TIME_PATTERN) : null
  if (!match) throw new Error(`${label} 必须是带单位的时间，例如 30s 或 500ms`)
  const unit = match[2].toLowerCase()
  const seconds = Number(match[1]) * TIME_UNITS[unit]
  if (!Number.isFinite(seconds) || (!allowNegative && seconds < 0)) {
    throw new Error(`${label} 必须是${allowNegative ? '' : '非负的'}有效时间`)
  }
  if (Math.abs(seconds) > MAX_TIME_SECONDS) throw new Error(`${label} 超出仿真时钟可表示的范围`)
  return { literal: `${match[1].toLowerCase()}${unit}`, seconds }
}

/** Missing optional application times use defaults; invalid supplied values never do. */
export const experimentTimeLiteral = (value: unknown, label: string, fallback?: string): string => {
  const missing = value === undefined || (typeof value === 'string' && !value.trim())
  return parseExperimentTime(missing && fallback !== undefined ? fallback : value, label).literal
}

export const isTimeAttribute = (item: CatalogItem | undefined, name: string): boolean => (
  !!item?.attributes?.some((attribute) => attribute.name === name && attribute.valueType === 'ns3::TimeValue')
)

export const timeAttributeLiteral = (item: CatalogItem, name: string, value: unknown): string => (
  parseExperimentTime(value, `${item.typeId}.${name}`, true).literal
)

/** Validate only actual TimeValue attributes; checker-specific ranges belong to ns-3. */
export const experimentTimeIssues = (spec: ExperimentSpec, layers: CatalogLayer[] = TYPEID_LAYERS): string[] => {
  const issues: string[] = []
  const check = (action: () => unknown) => {
    try { action() } catch (error) { issues.push(error instanceof Error ? error.message : String(error)) }
  }
  check(() => experimentTimeLiteral(spec.simStop, '仿真时长 simStop'))
  const extras = spec.protocolAttributes || {}
  const find = (typeId: string) => layers.flatMap((layer) => layer.items).find((item) => item.typeId === typeId)
  const attributes = (typeId: string, values: Record<string, unknown>, label = typeId) => {
    const item = find(typeId)
    for (const [name, value] of Object.entries(values)) {
      if (isTimeAttribute(item, name)) check(() => parseExperimentTime(value, `${label}.${name}`, true))
    }
  }
  const phy = spec.stack?.phy
  if (phy?.type) attributes(phy.type, { ...phy.attrs, ...extras[phy.type] })
  const mac = spec.stack?.mac
  if (mac?.type) attributes(mac.type, { ...mac.attrs, ...extras[mac.type] })
  for (const typeId of [spec.stack?.routing?.type, spec.channel?.type, spec.channel?.propagation]) {
    if (typeId) attributes(typeId, extras[typeId] || {})
  }
  for (const node of spec.nodes || []) {
    if (node.app) attributes(node.app, node.appAttrs || {}, `节点 ${node.id} 的 ${node.app}`)
  }
  return issues
}
