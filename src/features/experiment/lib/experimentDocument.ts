import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import { buildExperimentSpec, createDefaultExperimentForm } from './experimentSpec'
import { TYPEID_LAYERS, type CatalogLayer } from './typeIdCatalog'

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
    version: 2,
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
  const idFor = (layer: string, value: unknown) => {
    const typeId = string(value, `${layer} TypeId`)
    if (!typeId) return layer === 'app' ? 'none' : ''
    if (!/^ns3::[A-Za-z0-9_:]+$/.test(typeId)) throw new Error(`无效的 TypeId：${typeId}`)
    return layers.find((item) => item.id === layer)?.items.find((item) => item.typeId === typeId)?.id || typeId
  }
  const stack = object(doc.stack, 'stack')
  const phy = object(stack.phy, 'phy')
  const phyAttrs = object(phy.attrs ?? {}, 'phy.attrs')
  const mac = object(stack.mac, 'mac')
  const macAttrs = attributes(mac.attrs)
  const routing = object(stack.routing, 'routing')
  const channel = object(doc.channel, 'channel')
  let form: ExperimentForm = {
    ...createDefaultExperimentForm(),
    simStop: string(doc.simStop, 'simStop'),
    phyId: idFor('phy', phy.type), macId: idFor('mac', mac.type), routingId: idFor('routing', routing.type),
    channelId: idFor('channel', channel.type), propagationId: idFor('channel', channel.propagation),
    protocolAttributes: protocolAttributes(doc.protocolAttributes),
  }
  if (phyAttrs.transRange !== undefined) form.transRange = number(phyAttrs.transRange, 'transRange')
  if (phyAttrs.txPower !== undefined) form.txPower = number(phyAttrs.txPower, 'txPower')
  if (macAttrs.SlotNum !== undefined) form.slotNum = number(Number(macAttrs.SlotNum), 'SlotNum')
  if (macAttrs.SlotLen !== undefined) form.slotLen = macAttrs.SlotLen
  if (macAttrs.InitialRoundDelay !== undefined) form.initialRoundDelay = macAttrs.InitialRoundDelay
  // Keep all serialized MAC settings, including those without a shortcut in the form.
  form.protocolAttributes![String(mac.type)] = { ...macAttrs, ...form.protocolAttributes![String(mac.type)] }
  const traffic = object(doc.traffic, 'traffic')
  form.trafficId = string(traffic.preset, 'traffic.preset')
  if (!['none', 'periodic', 'onoff-to'].includes(form.trafficId)) throw new Error('不支持的流量模式')
  if (form.trafficId !== 'none') {
    form.trafficSrc = number(traffic.src, 'traffic.src'); form.trafficDst = number(traffic.dst, 'traffic.dst')
    form.trafficRateBps = number(traffic.rate_bps, 'traffic.rate_bps'); form.trafficPkt = number(traffic.pkt, 'traffic.pkt')
    form.trafficStart = string(traffic.start, 'traffic.start'); form.trafficStop = string(traffic.stop, 'traffic.stop')
  }
  const editor = doc.editor === undefined ? null : object(doc.editor, 'editor')
  if (editor) {
    if (editor.version !== 1 && editor.version !== 2) throw new Error('不支持的编辑器文件版本')
    const saved = object(editor.form, 'editor.form')
    const defaults = createDefaultExperimentForm()
    const fields = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key,
      saved[key] === undefined ? fallback : typeof fallback === 'number' ? number(saved[key], key) : string(saved[key], key),
    ]))
    form = { ...defaults, ...fields, protocolAttributes: protocolAttributes(saved.protocolAttributes) }
    if (!['none', 'periodic', 'onoff-to'].includes(form.trafficId)) throw new Error('不支持的流量模式')
  }
  const sourceNodes = editor?.nodes ?? doc.nodes
  if (!Array.isArray(sourceNodes) || sourceNodes.length > 64) throw new Error('nodes 必须是最多 64 个节点的数组')
  const nodes = sourceNodes.map((value): TopologyNode => {
    const node = object(value, '节点')
    const id = number(editor?.nodes ? node.node_id : node.id, '节点编号')
    if (!Number.isInteger(id) || id < 1 || id > 65534) throw new Error('节点编号必须是 1–65534 的整数')
    const appDestination = node.appDestination === undefined ? undefined : number(node.appDestination, '应用目的节点')
    if (appDestination !== undefined && (!Number.isInteger(appDestination) || appDestination < 1 || appDestination > 65534)) throw new Error('应用目的节点编号无效')
    return {
      ...(appDestination === undefined ? {} : { appDestination }),
      node_id: id, name: string(node.name ?? `Node-${id}`, '节点名称'), role: string(node.role ?? 'node', '节点角色'),
      x: number(node.x, 'x'), y: number(node.y, 'y'), z: number(node.z ?? 0, 'z'),
      phyId: editor?.nodes ? string(node.phyId ?? form.phyId, 'phyId') : form.phyId,
      macId: editor?.nodes ? string(node.macId ?? form.macId, 'macId') : form.macId,
      routingId: editor?.nodes ? string(node.routingId ?? form.routingId, 'routingId') : form.routingId,
      appId: editor?.nodes ? string(node.appId ?? 'none', 'appId') : idFor('app', node.app ?? ''),
      appAttrs: attributes(node.appAttrs),
    }
  })
  if (new Set(nodes.map((node) => node.node_id)).size !== nodes.length) throw new Error('节点编号不能重复')
  // Freeze the old global preset/defaults into each application before removing it.
  if (editor?.version !== 2) {
    const active = form.trafficId !== 'none'
    if (active && !nodes.some((node) => node.node_id === form.trafficSrc)) throw new Error('流量源不在拓扑中')
    const rate = Math.max(1, Math.round(active ? form.trafficRateBps : 80))
    const packetSize = Math.max(1, Math.round(active ? form.trafficPkt : 50))
    for (const node of nodes) {
      if ((!node.appId || node.appId === 'none') && active && node.node_id === form.trafficSrc) {
        node.appId = idFor('app', 'ns3::OnOffNDApplication')
      }
      if (!node.appId || node.appId === 'none') continue
      const typeId = layers.find((layer) => layer.id === 'app')?.items.find((item) => item.id === node.appId)?.typeId || node.appId
      const defaults: Record<string, string> = typeId === 'ns3::AquaSimTrafficGen'
        ? { Delay: String(packetSize * 8 / rate), PacketSize: String(packetSize) }
        : typeId === 'ns3::OnOffNDApplication'
          ? { DataRate: `${rate}bps`, PacketSize: String(packetSize), Nsend: String(nodes.length),
              traffic: String(rate / (packetSize * 8)), mode: active && form.trafficId === 'periodic' ? '0' : '1',
              OffTime: 'ns3::ConstantRandomVariable[Constant=0]' }
          : {}
      node.appAttrs = {
        ...defaults, StartTime: active ? form.trafficStart : '1s', StopTime: active ? form.trafficStop : form.simStop,
        ...form.protocolAttributes?.[typeId], ...node.appAttrs,
      }
      node.appDestination ??= active ? form.trafficDst : nodes[nodes.length - 1]?.node_id
    }
  }
  form.trafficId = 'none'
  const selected = editor?.selectedIds
  if (selected !== undefined && (!Array.isArray(selected) || selected.some((id) => typeof id !== 'number'))) throw new Error('选中节点格式错误')
  return {
    form, nodes,
    selectedIds: Array.isArray(selected) ? selected.filter((id) => nodes.some((node) => node.node_id === id)) : nodes.slice(0, 1).map((node) => node.node_id),
    activeCatalogId: editor?.activeCatalogId === undefined ? `mac:${form.macId}` : string(editor.activeCatalogId, 'activeCatalogId'),
    aquaSimHome: editor?.aquaSimHome === undefined ? undefined : string(editor.aquaSimHome, 'AQUA_SIM_HOME'),
  }
}
