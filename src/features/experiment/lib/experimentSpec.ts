import type {
  ExperimentForm,
  ExperimentNodeSpec,
  ExperimentSpec,
  ExperimentTraffic,
  TopologyNode,
  ValidationWarning,
} from '../../../shared/types/experiment'
import { catalogItemById, TYPEID_LAYERS, type CatalogLayer } from './typeIdCatalog'

type ActiveTraffic = Exclude<ExperimentTraffic, { preset: 'none' }>

const isActiveTraffic = (traffic: ExperimentTraffic | null | undefined): traffic is ActiveTraffic => (
  !!traffic && traffic.preset !== 'none'
)

export const PHY_TYPE = 'ns3::AquaSimPhyFDM'
export const ROUTING_TYPE = 'ns3::AquaSimStaticRouting'
export const CHANNEL_TYPE = 'ns3::AquaSimChannel'

/** A run needs at least this many nodes to be valid. */
export const MIN_NODE_COUNT = 2

export interface MacPreset {
  id: string
  type: string
  label: string
}

export const MAC_PRESETS: MacPreset[] = (TYPEID_LAYERS.find((layer) => layer.id === 'mac')?.items || []).map((item) => ({
  id: item.id,
  type: item.typeId,
  label: item.label,
}))

export const createDefaultTopology = (count = 5, spacing = 1000): TopologyNode[] => (
  Array.from({ length: count }, (_, index) => ({
    node_id: index + 1,
    name: `Node-${index + 1}`,
    x: spacing * index,
    y: 0,
    z: 0,
    role: 'node',
    phyId: 'phy-fdm',
    macId: 'swarm',
    routingId: 'static',
    appId: 'none',
  }))
)

export const macPresetById = (id: string): MacPreset => (
  MAC_PRESETS.find((item) => item.id === id) || MAC_PRESETS[0]
)

export const createDefaultExperimentForm = (): ExperimentForm => ({
  macId: 'swarm',
  phyId: 'phy-fdm',
  routingId: 'static',
  channelId: 'channel',
  propagationId: 'range',
  simStop: '30s',
  transRange: 1200,
  txPower: 1.1,
  slotNum: 4,
  slotLen: '5s',
  initialRoundDelay: '1s',
  trafficId: 'none',
  trafficSrc: 1,
  trafficDst: 2,
  trafficRateBps: 80,
  trafficPkt: 50,
  trafficStart: '5s',
  trafficStop: '100s',
})

const roundCoord = (value: unknown): number => Math.round((Number(value) || 0) * 100) / 100

export const macAttrsFor = (form: ExperimentForm, macId: string, nodeCount: number): Record<string, unknown> => {
  const attrs: Record<string, unknown> = {}
  if (macId === 'swarm' || /Swar[mM]/.test(macId)) {
    attrs.NodeCount = nodeCount
    attrs.InitialRoundDelay = form.initialRoundDelay
  }
  if (macId === 'tdma') {
    attrs.SlotNum = Number(form.slotNum) || 4
    attrs.SlotLen = form.slotLen
  }
  return attrs
}

const typeOf = (layerId: string, itemId: string, fallback: string, layers = TYPEID_LAYERS): string =>
  catalogItemById(layerId, itemId, layers)?.typeId ?? fallback

export const nodesToSpec = (nodes: TopologyNode[] | undefined, layers = TYPEID_LAYERS): ExperimentNodeSpec[] => (
  (nodes || []).map((node) => ({
    id: Number(node.node_id),
    name: node.name || `Node-${node.node_id}`,
    x: roundCoord(node.x),
    y: roundCoord(node.y),
    z: roundCoord(node.z),
    role: node.role || 'node',
    app: typeOf('app', node.appId || 'none', node.appId || '', layers),
    appAttrs: node.appAttrs,
    appDestination: node.appDestination,
  }))
)

export const buildExperimentSpec = (form: ExperimentForm, nodes: TopologyNode[], layers: CatalogLayer[] = TYPEID_LAYERS): ExperimentSpec => {
  const nodeList = nodesToSpec(nodes, layers)
  const macId = form.macId || 'swarm'
  const phyId = form.phyId || 'phy-fdm'
  const routingId = form.routingId || 'static'

  return {
    schema: 'aqua-sim-experiment/v0',
    protocolAttributes: form.protocolAttributes || {},
    simStop: form.simStop,
    channel: {
      type: typeOf('channel', form.channelId || 'channel', form.channelId.startsWith('ns3::') ? form.channelId : CHANNEL_TYPE, layers),
      propagation: typeOf('channel', form.propagationId || 'range', form.propagationId.startsWith('ns3::') ? form.propagationId : 'ns3::AquaSimRangePropagation', layers),
    },
    stack: {
      phy: {
        type: typeOf('phy', phyId, phyId.startsWith('ns3::') ? phyId : PHY_TYPE, layers),
        attrs: {
          transRange: Number(form.transRange) || 0,
          txPower: Number(form.txPower) || 0,
        },
      },
      mac: {
        type: typeOf('mac', macId, macId.startsWith('ns3::') ? macId : macPresetById(macId).type, layers),
        attrs: macAttrsFor(form, macId, nodeList.length),
      },
      routing: { type: typeOf('routing', routingId, routingId.startsWith('ns3::') ? routingId : ROUTING_TYPE, layers) },
    },
    nodes: nodeList,
    traffic: { preset: 'none' },
  }
}

export const validateExperiment = (spec: ExperimentSpec): ValidationWarning[] => {
  const warnings: ValidationWarning[] = []
  const nodes = spec.nodes || []
  const ids = nodes.map((node) => node.id)
  const macType = spec.stack?.mac?.type || ''

  if (nodes.length < MIN_NODE_COUNT) warnings.push(`至少需要 ${MIN_NODE_COUNT} 个节点`)
  if (new Set(ids).size !== ids.length) warnings.push('节点 id 有重复')

  if (/Swarm/i.test(macType) && nodes.some((node) => Math.abs(node.z ?? 0) > 1e-6)) {
    warnings.push('Swarm z≠0')
  }

  if (/TDMA/i.test(macType)) {
    const slotNum = Number(spec.stack?.mac?.attrs?.SlotNum)
    if (slotNum < 1 || slotNum > 8) warnings.push('TDMA SlotNum 必须在 1–8')
  }

  const range = Number(spec.stack?.phy?.attrs?.transRange)
  if (!(range > 0)) warnings.push('transRange 必须大于 0')

  const traffic = spec.traffic
  const active = isActiveTraffic(traffic)
  if (active && !ids.includes(Number(traffic.src))) warnings.push('流量源不在拓扑中')
  const defaultDestination = active ? Number(traffic.dst) : undefined
  for (const node of nodes) {
    if (!node.app && !(active && node.id === Number(traffic.src))) continue
    const destination = node.appDestination ?? defaultDestination
    if (destination === undefined) warnings.push(`请为节点 ${node.id} 的应用选择目的节点`)
    else if (!ids.includes(destination)) warnings.push(`节点 ${node.id} 的应用目的节点不在拓扑中`)
  }

  return warnings
}
