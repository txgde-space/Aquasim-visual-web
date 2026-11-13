import type { ExperimentSpec } from '../../../shared/types/experiment'
import { TYPEID_LAYERS, type CatalogItem, type CatalogLayer } from './typeIdCatalog'
import { deviceProtocolConfigurations } from './protocolConfiguration'
import { parseQuantity, canonicalUnit } from '../../../shared/quantity'
import { nonBlankAttributes } from './protocolUnits'
import { isNodeModelType } from '../../../shared/nodeModel'

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
  modelType?: unknown
}

/** Drafts may be empty; only execution requires MIN_NODE_COUNT. */
export const topologyIssues = (nodes: readonly NodeGeometry[], minimum = 0): string[] => {
  const issues: string[] = []
  if (nodes.length < minimum) issues.push(`至少需要 ${minimum} 个节点`)
  if (nodes.length > MAX_NODE_COUNT) issues.push(`最多支持 ${MAX_NODE_COUNT} 个节点`)
  const ids = nodes.map((node) => node?.id)
  if (ids.some((id) => !isNodeId(id))) issues.push(`节点编号必须是 ${MIN_NODE_ID}–${MAX_NODE_ID} 的整数`)
  if (new Set(ids).size !== ids.length) issues.push('节点编号不能重复')
  for (const node of nodes) {
    if (node?.modelType !== undefined && !isNodeModelType(node.modelType)) issues.push(`节点 ${node?.id} 的模型类型 modelType 无效`)
  }
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

// Generated programs use ns-3's default signed 64-bit nanosecond clock.
const MAX_TIME_SECONDS = 9_223_372_036

export const parseExperimentTime = (value: unknown, label: string, allowNegative = false): { literal: string; seconds: number } => {
  let seconds: number
  try { seconds = parseQuantity(value, 's').value }
  catch (error) { throw new Error(`${label}：${error instanceof Error ? error.message : String(error)}`) }
  const match = String(value).trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµμ]*)$/i)!
  const unit = canonicalUnit((match[2] || 's').toLowerCase()) || 's'
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
    for (const [name, value] of Object.entries(nonBlankAttributes(values))) {
      if (isTimeAttribute(item, name)) check(() => parseExperimentTime(value, `${label}.${name}`, true))
    }
  }
  for (const node of spec.nodes.length ? spec.nodes : [undefined]) {
    for (const config of deviceProtocolConfigurations(spec, node)) {
      if (config.typeId) attributes(config.typeId, config.attributes, node ? `节点 ${node.id} 的 ${config.typeId}` : config.typeId)
    }
  }
  for (const typeId of [spec.channel?.type, spec.channel?.propagation]) {
    if (typeId) attributes(typeId, extras[typeId] || {})
  }
  for (const node of spec.nodes || []) {
    if (node.app) attributes(node.app, node.appAttrs || {}, `节点 ${node.id} 的 ${node.app}`)
    if (node.mobility?.type) attributes(node.mobility.type, node.protocolAttributes?.[node.mobility.type] || {}, `节点 ${node.id} 的 ${node.mobility.type}`)
  }
  return issues
}
