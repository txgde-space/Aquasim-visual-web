import type { ExperimentSpec } from '../../../shared/types/experiment'
import type { CatalogItem, CatalogLayer, ProtocolAttribute } from './typeIdCatalog'

/** Public socket-application contract, identified from registered attributes rather than class names. */
export const hasSocketInterface = (item: CatalogItem | undefined): boolean => (
  !!item?.attributes?.some((attr) => attr.name === 'Protocol' && attr.valueType === 'ns3::TypeIdValue' && attr.constructible !== false)
  && !!item.attributes.some((attr) => attr.name === 'Remote' && attr.valueType === 'ns3::AddressValue' && attr.constructible !== false)
)

export const attributeEditState = (item: CatalogItem, attr: ProtocolAttribute, layerId?: string): {
  editable: boolean; managed: boolean; reason: string
} => {
  if (hasSocketInterface(item) && ['Protocol', 'Remote'].includes(attr.name)) {
    return { editable: false, managed: true, reason: '由节点目的地址与公共 Socket 接口连接' }
  }
  if (layerId === 'channel' && item.field !== 'propagationId' && attr.pointeeTypeId === 'ns3::AquaSimPropagation') {
    return { editable: false, managed: true, reason: '由已选择的传播模型连接' }
  }
  if (['phy', 'mac', 'routing'].includes(layerId || '') && attr.name === 'SetDevice' && attr.valueType === 'ns3::PointerValue') {
    return { editable: false, managed: true, reason: '由所在节点的公共设备接口连接' }
  }
  if (attr.constructible === false) return { editable: false, managed: false, reason: '注册接口不允许在构造时配置' }
  if (['ns3::ObjectVectorValue', 'ns3::ObjectMapValue'].includes(attr.valueType)) {
    return { editable: false, managed: false, reason: '对象容器暂不支持文本配置' }
  }
  return { editable: true, managed: false, reason: '' }
}

/** Reflect interface availability and ownership; numeric/type constraints are checked by ns-3 itself. */
export const protocolMetadataIssues = (spec: ExperimentSpec, layers: CatalogLayer[]): string[] => {
  const issues: string[] = []
  const extras = spec.protocolAttributes || {}
  const itemFor = (layerId: string, typeId: string, propagation = false) => layers.find((layer) => layer.id === layerId)?.items.find((item) => (
    item.typeId === typeId && (layerId !== 'channel' || (item.field === 'propagationId') === propagation)
  ))
  const check = (layerId: string, typeId: string, attrs: Record<string, unknown>, label = typeId, propagation = false) => {
    const item = itemFor(layerId, typeId, propagation)
    if (!item) { issues.push(`${layerId} 未注册协议：${typeId}，请先预编译`); return }
    if (!item.attributes) { issues.push(`${typeId} 缺少注册属性信息，请先预编译`); return }
    for (const [name, value] of Object.entries(attrs)) {
      const attr = item.attributes.find((entry) => entry.name === name)
      if (!attr) { issues.push(`${label} 没有属性 ${name}`); continue }
      const state = attributeEditState(item, attr, layerId)
      if (!state.editable) issues.push(`${label}.${name}：${state.reason}`)
      if (!['string', 'number', 'boolean'].includes(typeof value)) issues.push(`${label}.${name} 必须是标量属性值`)
    }
  }
  const phyAttrs = { ...spec.stack?.phy?.attrs }
  delete phyAttrs.txPower // Unused historical shortcut; explicit protocol values retain their meaning.
  check('phy', spec.stack?.phy?.type, { ...phyAttrs, ...extras[spec.stack?.phy?.type] })
  check('mac', spec.stack?.mac?.type, { ...spec.stack?.mac?.attrs, ...extras[spec.stack?.mac?.type] })
  check('routing', spec.stack?.routing?.type, extras[spec.stack?.routing?.type] || {})
  check('channel', spec.channel?.type, extras[spec.channel?.type] || {})
  check('channel', spec.channel?.propagation, extras[spec.channel?.propagation] || {}, spec.channel?.propagation, true)
  const ids = new Set(spec.nodes.map((node) => node.id))
  for (const node of spec.nodes) {
    if (!node.app) continue
    check('app', node.app, node.appAttrs || {}, `节点 ${node.id} 的 ${node.app}`)
    if (hasSocketInterface(itemFor('app', node.app))) {
      if (node.appDestination === undefined) issues.push(`请为节点 ${node.id} 的应用选择目的节点`)
      else if (!ids.has(node.appDestination)) issues.push(`节点 ${node.id} 的应用目的节点不在拓扑中`)
    }
  }
  return issues
}
