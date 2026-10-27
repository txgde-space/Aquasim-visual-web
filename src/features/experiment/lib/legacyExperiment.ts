/** Historical document/API conversion only. Current drafts and protocol execution use registered metadata. */
import type { ExperimentForm, ExperimentSpec, TopologyNode } from '../../../shared/types/experiment'
import { catalogItemById, type CatalogLayer } from './typeIdCatalog'

const ALIASES: Record<string, Record<string, string>> = {
  phy: { 'phy-fdm': 'ns3::AquaSimPhyFDM', 'phy-cmn': 'ns3::AquaSimPhyCmn', 'phy-radio': 'ns3::AquaSimRadioPhy' },
  mac: { swarm: 'ns3::AquaSimSwarm', tdma: 'ns3::AquaSimTDMA', broadcast: 'ns3::AquaSimBroadcastMac', aloha: 'ns3::AquaSimPAloha' },
  routing: { static: 'ns3::AquaSimStaticRouting' },
  app: { none: '', onoff: 'ns3::OnOffNDApplication', 'traffic-gen': 'ns3::AquaSimTrafficGen' },
  channel: { channel: 'ns3::AquaSimChannel', range: 'ns3::AquaSimRangePropagation', simple: 'ns3::AquaSimSimplePropagation',
    bellhop: 'ns3::AquaSimBellhopPropagation', 'radio-channel': 'ns3::AquaSimRadioChannel', 'radio-propagation': 'ns3::AquaSimRadioPropagation' },
}
const RADIO_TYPES = new Set(['ns3::AquaSimRadioPhy', 'ns3::AquaSimRadioChannel', 'ns3::AquaSimRadioPropagation'])

export const legacyProtocolType = (layer: string, id: string, layers: CatalogLayer[]): string => (
  catalogItemById(layer, id, layers)?.typeId ?? ALIASES[layer]?.[id] ?? id
)

const object = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是对象`)
  return value as Record<string, unknown>
}
const string = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new Error(`${label} 必须是字符串`)
  return value
}
const scalar = (value: unknown, label: string): string => {
  if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`属性 ${label} 必须是标量`)
  return String(value)
}
export const mergeProtocolAttributes = (
  base: NonNullable<ExperimentForm['protocolAttributes']>, overrides: NonNullable<ExperimentForm['protocolAttributes']>,
): NonNullable<ExperimentForm['protocolAttributes']> => {
  const merged = { ...base }
  for (const [typeId, attrs] of Object.entries(overrides)) merged[typeId] = { ...merged[typeId], ...attrs }
  return merged
}

/** Retain explicit ranges from old environment caches without retaining their switching behavior. */
export const legacyEnvironmentAttributes = (saved: unknown, layers: CatalogLayer[]): NonNullable<ExperimentForm['protocolAttributes']> => {
  if (saved === undefined) return {}
  const result: NonNullable<ExperimentForm['protocolAttributes']> = {}
  for (const [environment, value] of Object.entries(object(saved, 'environmentStacks'))) {
    if (environment !== 'acoustic' && environment !== 'radio') throw new Error('不支持的传播环境')
    const stack = object(value, `${environment} 环境配置`)
    const typeId = legacyProtocolType('phy', string(stack.phyId, '环境 phyId'), layers)
    string(stack.channelId, '环境 channelId'); string(stack.propagationId, '环境 propagationId')
    if (stack.transRange !== undefined) result[typeId] = { transRange: scalar(stack.transRange, 'transRange') }
  }
  return result
}

/** Freeze removed v0–v2 shortcuts into visible attributes, including inactive legacy choices. */
export const migrateLegacyProtocolAttributes = (
  form: ExperimentForm, saved: Record<string, unknown>, layers: CatalogLayer[],
): NonNullable<ExperimentForm['protocolAttributes']> => {
  const value = (name: string, fallback: string | number) => scalar(saved[name] === undefined ? fallback : saved[name], name)
  const range = value('transRange', 1200)
  const migrated: NonNullable<ExperimentForm['protocolAttributes']> = {}
  const rangeTypes = new Set([
    ...Object.values(ALIASES.phy!),
    ...(layers.find((layer) => layer.id === 'phy')?.items || []).filter((item) => item.attributes?.some((attr) => attr.name === 'transRange')).map((item) => item.typeId),
  ])
  const setRange = (range: string, environment?: string) => {
    for (const typeId of rangeTypes) {
      if (environment && (RADIO_TYPES.has(typeId) ? 'radio' : 'acoustic') !== environment) continue
      migrated[typeId] = { ...migrated[typeId], transRange: range }
    }
  }
  setRange(range)
  if (saved.environmentStacks !== undefined) {
    for (const [environment, value] of Object.entries(object(saved.environmentStacks, 'environmentStacks'))) {
      if (environment !== 'acoustic' && environment !== 'radio') throw new Error('不支持的传播环境')
      const stack = object(value, `${environment} 环境配置`)
      const typeId = legacyProtocolType('phy', string(stack.phyId, '环境 phyId'), layers)
      string(stack.channelId, '环境 channelId'); string(stack.propagationId, '环境 propagationId')
      if (stack.transRange !== undefined) {
        const savedRange = scalar(stack.transRange, 'transRange')
        setRange(savedRange, environment)
        migrated[typeId] = { ...migrated[typeId], transRange: savedRange }
      }
    }
  }
  const phyType = legacyProtocolType('phy', form.phyId, layers)
  const activeRadio = [phyType, legacyProtocolType('channel', form.channelId, layers), legacyProtocolType('channel', form.propagationId, layers)].some((typeId) => RADIO_TYPES.has(typeId))
  setRange(range, activeRadio ? 'radio' : 'acoustic')
  if (saved.transRange !== undefined) migrated[phyType] = { ...migrated[phyType], transRange: range }
  migrated['ns3::AquaSimTDMA'] = { SlotNum: value('slotNum', 4), SlotLen: value('slotLen', '5s') }
  for (const typeId of ['ns3::AquaSimSwarm', 'ns3::AquaSimSwarM']) migrated[typeId] = { InitialRoundDelay: value('initialRoundDelay', '1s') }
  return mergeProtocolAttributes(migrated, form.protocolAttributes || {})
}

interface LegacyTrafficSettings {
  trafficId: string
  trafficSrc: number
  trafficDst: number
  trafficRateBps: number
  trafficPkt: number
  trafficStart: string
  trafficStop: string
}

/** Removed global form values exist only while importing historical documents. */
export const readLegacyTrafficSettings = (input: unknown, saved?: Record<string, unknown>): LegacyTrafficSettings => {
  const finite = (value: unknown, name: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} 必须是有效数字`)
    return value
  }
  const defaults: LegacyTrafficSettings = {
    trafficId: 'none', trafficSrc: 1, trafficDst: 2, trafficRateBps: 80, trafficPkt: 50, trafficStart: '5s', trafficStop: '100s',
  }
  const traffic = object(input, 'traffic')
  const preset = string(traffic.preset, 'traffic.preset')
  if (!['none', 'periodic', 'onoff-to'].includes(preset)) throw new Error('不支持的流量模式')
  let values = { ...defaults, trafficId: preset }
  if (preset !== 'none') values = { ...values,
    trafficSrc: finite(traffic.src, 'traffic.src'), trafficDst: finite(traffic.dst, 'traffic.dst'),
    trafficRateBps: finite(traffic.rate_bps, 'traffic.rate_bps'), trafficPkt: finite(traffic.pkt, 'traffic.pkt'),
    trafficStart: string(traffic.start, 'traffic.start'), trafficStop: string(traffic.stop, 'traffic.stop'),
  }
  if (saved) {
    values = { ...defaults }
    for (const key of ['trafficId', 'trafficStart', 'trafficStop'] as const) {
      if (saved[key] !== undefined) values[key] = string(saved[key], key)
    }
    for (const key of ['trafficSrc', 'trafficDst', 'trafficRateBps', 'trafficPkt'] as const) {
      if (saved[key] !== undefined) values[key] = finite(saved[key], key)
    }
    if (!['none', 'periodic', 'onoff-to'].includes(values.trafficId)) throw new Error('不支持的流量模式')
  }
  return values
}

const legacyAppDefaults = (typeId: string, rate: number, packetSize: number, count: number, periodic: boolean): Record<string, string> => (
  typeId === 'ns3::AquaSimTrafficGen' ? { Delay: String(packetSize * 8 / rate), PacketSize: String(packetSize) }
    : typeId === 'ns3::OnOffNDApplication' ? {
        DataRate: `${rate}bps`, PacketSize: String(packetSize), Nsend: String(count), traffic: String(rate / (packetSize * 8)),
        mode: periodic ? '0' : '1', OffTime: 'ns3::ConstantRandomVariable[Constant=0]',
      } : {}
)

/** Legacy v0/v1 documents stored global application defaults; later documents already own node attributes. */
export const migrateLegacyApplications = (form: Pick<ExperimentForm, 'simStop' | 'protocolAttributes'> & LegacyTrafficSettings, nodes: TopologyNode[], layers: CatalogLayer[]): TopologyNode[] => {
  const active = form.trafficId !== 'none'
  if (active && !nodes.some((node) => node.node_id === form.trafficSrc)) throw new Error('流量源不在拓扑中')
  const rate = Math.max(1, Math.round(active ? form.trafficRateBps : 80))
  const packetSize = Math.max(1, Math.round(active ? form.trafficPkt : 50))
  return nodes.map((node) => {
    const typeId = legacyProtocolType('app', node.appId || 'none', layers)
      || (active && node.node_id === form.trafficSrc ? 'ns3::OnOffNDApplication' : '')
    if (!typeId) return node
    return { ...node, appId: typeId, appDestination: node.appDestination ?? (active ? form.trafficDst : nodes[nodes.length - 1]?.node_id),
      appAttrs: { ...legacyAppDefaults(typeId, rate, packetSize, nodes.length, active && form.trafficId === 'periodic'),
        StartTime: active ? form.trafficStart : '1s', StopTime: active ? form.trafficStop : form.simStop,
        ...form.protocolAttributes?.[typeId], ...node.appAttrs } }
  })
}

/** Compatibility boundary for old API callers. New node applications never pass through preset logic. */
export const normalizeLegacyTrafficSpec = (spec: ExperimentSpec): ExperimentSpec => {
  const traffic = spec.traffic
  if (!traffic || traffic.preset === 'none' || !('src' in traffic)) return spec
  if (!spec.nodes.some((node) => node.id === Number(traffic.src))) throw new Error('流量源不在拓扑中')
  const rate = Math.max(1, Math.round(Number(traffic.rate_bps) || 80))
  const packetSize = Math.max(1, Math.round(Number(traffic.pkt) || 50))
  return { ...spec, traffic: { preset: 'none' }, nodes: spec.nodes.map((node) => {
    const app = node.app || (node.id === Number(traffic.src) ? 'ns3::OnOffNDApplication' : '')
    if (!app) return node
    return { ...node, app, appDestination: node.appDestination ?? Number(traffic.dst), appAttrs: {
      ...legacyAppDefaults(app, rate, packetSize, spec.nodes.length, traffic.preset === 'periodic'),
      StartTime: traffic.start || '1s', StopTime: traffic.stop || spec.simStop,
      ...spec.protocolAttributes?.[app], ...node.appAttrs,
    } }
  }) }
}
