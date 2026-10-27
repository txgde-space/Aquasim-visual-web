import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import { buildExperimentSpec, createDefaultExperimentForm } from './experimentSpec'
import { catalogItemById, TYPEID_LAYERS, type CatalogLayer } from './typeIdCatalog'
import { isNodeId, MAX_NODE_COUNT, MAX_NODE_ID, MIN_NODE_ID, topologyIssues } from './experimentValidation'
import { legacyEnvironmentAttributes, legacyProtocolType, mergeProtocolAttributes, migrateLegacyApplications, migrateLegacyProtocolAttributes, readLegacyTrafficSettings } from './legacyExperiment'

export interface ExperimentDraftData {
  form: ExperimentForm
  nodes: TopologyNode[]
  selectedIds: number[]
  activeCatalogId: string
  aquaSimHome?: string
}

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象`)
  return value as Record<string, unknown>
}
const string = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new Error(`${label} 必须是字符串`)
  return value
}
const number = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} 必须是有效数字`)
  return value
}
const attributes = (value: unknown): Record<string, string> => Object.fromEntries(
  Object.entries(object(value ?? {}, '协议属性')).map(([key, value]) => {
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`属性 ${key} 必须是标量`)
    return [key, String(value)]
  }),
)
const protocolAttributes = (value: unknown) => Object.fromEntries(
  Object.entries(object(value ?? {}, 'protocolAttributes')).map(([key, value]) => [key, attributes(value)]),
)

/** Preserve inactive form settings as well as the executable v0 spec. */
export const serializeExperiment = (draft: ExperimentDraftData, layers: CatalogLayer[] = TYPEID_LAYERS): string => JSON.stringify({
  ...buildExperimentSpec(draft.form, draft.nodes, layers),
  editor: {
    version: 3,
    form: draft.form,
    // Retain editor identifiers and unrounded coordinates for a lossless round trip.
    nodes: draft.nodes,
    selectedIds: draft.selectedIds,
    activeCatalogId: draft.activeCatalogId,
    aquaSimHome: draft.aquaSimHome,
  },
}, null, 2)

/** Parse fully before changing the live draft. Accept legacy v0 specs without editor data. */
export const parseExperiment = (text: string, layers: CatalogLayer[] = TYPEID_LAYERS): ExperimentDraftData => {
  let parsed: unknown
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')) }
  catch { throw new Error('JSON 格式错误，未修改当前实验') }
  const doc = object(parsed, '实验文件')
  if (doc.schema !== 'aqua-sim-experiment/v0') throw new Error('不支持的实验格式，请导入 aqua-sim-experiment/v0 文件')
  const editor = doc.editor === undefined ? null : object(doc.editor, 'editor')
  if (editor && editor.version !== 1 && editor.version !== 2 && editor.version !== 3) throw new Error('不支持的编辑器文件版本')
  const idFor = (layer: string, value: unknown) => {
    const typeId = string(value, `${layer} TypeId`)
    if (!typeId) return layer === 'app' ? 'none' : ''
    const resolved = legacyProtocolType(layer, typeId, layers)
    if (resolved !== typeId || catalogItemById(layer, typeId, layers)) return resolved || 'none'
    // Editor documents also preserve unavailable selections for later correction.
    if (editor) return typeId
    if (!/^ns3::[A-Za-z0-9_:]+$/.test(typeId)) throw new Error(`无效的 TypeId：${typeId}`)
    return typeId
  }
  const stack = object(doc.stack, 'stack')
  const phy = object(stack.phy, 'phy')
  const phyAttrs = attributes(phy.attrs)
  const mac = object(stack.mac, 'mac')
  const macAttrs = attributes(mac.attrs)
  const routing = object(stack.routing, 'routing')
  const channel = object(doc.channel, 'channel')
  let form: ExperimentForm = {
    ...createDefaultExperimentForm(),
    simStop: string(doc.simStop, 'simStop'),
    phyId: idFor('phy', phy.type), macId: idFor('mac', mac.type), routingId: idFor('routing', routing.type),
    channelId: idFor('channel', channel.type), propagationId: idFor('channel', channel.propagation),
    protocolAttributes: mergeProtocolAttributes({
      [legacyProtocolType('phy', String(phy.type), layers)]: Object.fromEntries(Object.entries(phyAttrs).filter(([key]) => key !== 'txPower')),
      [legacyProtocolType('mac', String(mac.type), layers)]: macAttrs,
    }, protocolAttributes(doc.protocolAttributes)),
  }
  if (phyAttrs.txPower !== undefined) form.txPower = number(Number(phyAttrs.txPower), 'txPower')
  let legacyTraffic = readLegacyTrafficSettings(doc.traffic)
  if (editor) {
    const saved = object(editor.form, 'editor.form')
    legacyTraffic = readLegacyTrafficSettings(doc.traffic, saved)
    const defaults = createDefaultExperimentForm()
    const fields = Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== 'protocolAttributes').map(([key, fallback]) => [key,
      saved[key] === undefined ? fallback : typeof fallback === 'number' ? number(saved[key], key) : string(saved[key], key),
    ]))
    form = { ...defaults, ...fields, protocolAttributes: protocolAttributes(saved.protocolAttributes) }
    for (const [field, layer] of [['phyId', 'phy'], ['macId', 'mac'], ['routingId', 'routing'], ['channelId', 'channel'], ['propagationId', 'channel']] as const) {
      form[field] = legacyProtocolType(layer, form[field], layers)
    }
    if (editor.version !== 3) {
      const selectedPhyType = legacyProtocolType('phy', form.phyId, layers)
      const samePhy = selectedPhyType === legacyProtocolType('phy', String(phy.type), layers)
      if (samePhy) form.protocolAttributes = mergeProtocolAttributes({
        [selectedPhyType]: Object.fromEntries(Object.entries(phyAttrs).filter(([key]) => !['txPower', 'transRange'].includes(key))),
      }, form.protocolAttributes || {})
      const selectedMacType = legacyProtocolType('mac', form.macId, layers)
      const sameMac = selectedMacType === legacyProtocolType('mac', String(mac.type), layers)
      if (sameMac) form.protocolAttributes = mergeProtocolAttributes({
        [selectedMacType]: Object.fromEntries(Object.entries(macAttrs).filter(([key]) => !['SlotNum', 'SlotLen', 'InitialRoundDelay'].includes(key))),
      }, form.protocolAttributes || {})
      form.protocolAttributes = migrateLegacyProtocolAttributes(form, {
        ...saved,
        ...(saved.slotNum === undefined && sameMac && macAttrs.SlotNum !== undefined ? { slotNum: macAttrs.SlotNum } : {}),
        ...(saved.slotLen === undefined && sameMac && macAttrs.SlotLen !== undefined ? { slotLen: macAttrs.SlotLen } : {}),
        ...(saved.initialRoundDelay === undefined && sameMac && macAttrs.InitialRoundDelay !== undefined ? { initialRoundDelay: macAttrs.InitialRoundDelay } : {}),
        ...(saved.transRange === undefined && samePhy && phyAttrs.transRange !== undefined ? { transRange: phyAttrs.transRange } : {}),
      }, layers)
    } else {
      form.protocolAttributes = mergeProtocolAttributes(legacyEnvironmentAttributes(saved.environmentStacks, layers), form.protocolAttributes || {})
    }
  } else {
    form.protocolAttributes = migrateLegacyProtocolAttributes(form, {
      transRange: phyAttrs.transRange, slotNum: macAttrs.SlotNum,
      slotLen: macAttrs.SlotLen, initialRoundDelay: macAttrs.InitialRoundDelay,
    }, layers)
  }
  const sourceNodes = editor?.nodes ?? doc.nodes
  if (!Array.isArray(sourceNodes) || sourceNodes.length > MAX_NODE_COUNT) throw new Error(`nodes 必须是最多 ${MAX_NODE_COUNT} 个节点的数组`)
  let nodes = sourceNodes.map((value): TopologyNode => {
    const node = object(value, '节点')
    const id = number(editor?.nodes ? node.node_id : node.id, '节点编号')
    if (!isNodeId(id)) throw new Error(`节点编号必须是 ${MIN_NODE_ID}–${MAX_NODE_ID} 的整数`)
    const appDestination = node.appDestination === undefined ? undefined : number(node.appDestination, '应用目的节点')
    if (appDestination !== undefined && !isNodeId(appDestination)) throw new Error('应用目的节点编号无效')
    return {
      ...(appDestination === undefined ? {} : { appDestination }),
      node_id: id, name: string(node.name ?? `Node-${id}`, '节点名称'), role: string(node.role ?? 'node', '节点角色'),
      x: number(node.x, 'x'), y: number(node.y, 'y'), z: number(node.z ?? 0, 'z'),
      phyId: editor?.nodes ? string(node.phyId ?? form.phyId, 'phyId') : form.phyId,
      macId: editor?.nodes ? string(node.macId ?? form.macId, 'macId') : form.macId,
      routingId: editor?.nodes ? string(node.routingId ?? form.routingId, 'routingId') : form.routingId,
      appId: editor?.nodes ? legacyProtocolType('app', string(node.appId ?? 'none', 'appId'), layers) || 'none' : idFor('app', node.app ?? ''),
      appAttrs: attributes(node.appAttrs),
    }
  })
  const nodeIssues = topologyIssues(nodes.map((node) => ({ ...node, id: node.node_id })))
  if (nodeIssues.length) throw new Error(nodeIssues.join('；'))
  if (!editor || editor.version === 1) nodes = migrateLegacyApplications({ ...form, ...legacyTraffic }, nodes, layers)
  const selected = editor?.selectedIds
  if (selected !== undefined && (!Array.isArray(selected) || selected.some((id) => typeof id !== 'number'))) throw new Error('选中节点格式错误')
  return {
    form, nodes,
    selectedIds: Array.isArray(selected) ? selected.filter((id) => nodes.some((node) => node.node_id === id)) : nodes.slice(0, 1).map((node) => node.node_id),
    activeCatalogId: editor?.activeCatalogId === undefined ? `mac:${form.macId}` : string(editor.activeCatalogId, 'activeCatalogId'),
    aquaSimHome: editor?.aquaSimHome === undefined ? undefined : string(editor.aquaSimHome, 'AQUA_SIM_HOME'),
  }
}
