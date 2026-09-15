import { catalogItemById, TYPEID_LAYERS } from './typeIdCatalog.js'

export const PHY_TYPE = 'ns3::AquaSimPhyFDM'
export const ROUTING_TYPE = 'ns3::AquaSimStaticRouting'
export const CHANNEL_TYPE = 'ns3::AquaSimChannel'

export const MAC_PRESETS = Object.freeze(
  (TYPEID_LAYERS.find((layer) => layer.id === 'mac')?.items || []).map((item) => ({
    id: item.id,
    type: item.typeId,
    label: item.label,
    trafficDefault: item.id === 'swarm' ? 'none' : 'onoff-to',
  })),
)

export const TRAFFIC_PRESETS = Object.freeze([
  { id: 'none', label: '无' },
  { id: 'onoff-to', label: 'OnOff' },
  { id: 'periodic', label: '周期' },
])

export const createDefaultTopology = (count = 5, spacing = 1000) => (
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

export const macPresetById = (id) => (
  MAC_PRESETS.find((item) => item.id === id) || MAC_PRESETS[0]
)

export const createDefaultExperimentForm = () => ({
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

const roundCoord = (value) => Math.round((Number(value) || 0) * 100) / 100

export const macAttrsFor = (form, macId, nodeCount) => {
  const attrs = {}
  if (macId === 'swarm') {
    attrs.NodeCount = nodeCount
    attrs.InitialRoundDelay = form.initialRoundDelay
  }
  if (macId === 'tdma') {
    attrs.SlotNum = Number(form.slotNum) || 4
    attrs.SlotLen = form.slotLen
  }
  return attrs
}

const typeOf = (layerId, itemId, fallback) => catalogItemById(layerId, itemId)?.typeId || fallback

export const nodesToSpec = (nodes, form) => (
  (nodes || []).map((node) => ({
    id: Number(node.node_id),
    name: node.name || `Node-${node.node_id}`,
    x: roundCoord(node.x),
    y: roundCoord(node.y),
    z: roundCoord(node.z),
    role: node.role || 'node',
    app: typeOf('app', node.appId || 'none', ''),
  }))
)

export const buildExperimentSpec = (form, nodes) => {
  const nodeList = nodesToSpec(nodes, form)
  const macId = form.macId || 'swarm'
  const phyId = form.phyId || 'phy-fdm'
  const routingId = form.routingId || 'static'

  return {
    schema: 'aqua-sim-experiment/v0',
    simStop: form.simStop,
    channel: {
      type: typeOf('channel', form.channelId || 'channel', CHANNEL_TYPE),
      propagation: typeOf('channel', form.propagationId || 'range', 'ns3::AquaSimRangePropagation'),
    },
    stack: {
      phy: {
        type: typeOf('phy', phyId, PHY_TYPE),
        attrs: {
          transRange: Number(form.transRange) || 0,
          txPower: Number(form.txPower) || 0,
        },
      },
      mac: {
        type: typeOf('mac', macId, macPresetById(macId).type),
        attrs: macAttrsFor(form, macId, nodeList.length),
      },
      routing: { type: typeOf('routing', routingId, ROUTING_TYPE) },
    },
    nodes: nodeList,
    traffic: form.trafficId === 'none'
      ? { preset: 'none' }
      : {
          preset: form.trafficId,
          src: Number(form.trafficSrc) || 1,
          dst: Number(form.trafficDst) || 1,
          rate_bps: Number(form.trafficRateBps) || 80,
          pkt: Number(form.trafficPkt) || 50,
          start: form.trafficStart,
          stop: form.trafficStop,
        },
  }
}

export const validateExperiment = (spec) => {
  const warnings = []
  const nodes = spec.nodes || []
  const ids = nodes.map((node) => node.id)
  const macType = spec.stack?.mac?.type || ''

  if (nodes.length < 2) warnings.push('至少需要 2 个节点')
  if (new Set(ids).size !== ids.length) warnings.push('节点 id 有重复')

  if (/Swarm/i.test(macType) && nodes.some((node) => Math.abs(node.z) > 1e-6)) {
    warnings.push('Swarm z≠0')
  }

  if (/TDMA/i.test(macType)) {
    const slotNum = Number(spec.stack?.mac?.attrs?.SlotNum)
    if (slotNum < 1 || slotNum > 8) warnings.push('TDMA SlotNum 必须在 1–8')
  }

  const range = Number(spec.stack?.phy?.attrs?.transRange)
  if (!(range > 0)) warnings.push('transRange 必须大于 0')

  if (spec.traffic && spec.traffic.preset !== 'none') {
    const srcOk = ids.includes(Number(spec.traffic.src))
    const dstOk = spec.traffic.preset === 'periodic' || ids.includes(Number(spec.traffic.dst))
    if (!srcOk) warnings.push('流量源不在拓扑中')
    if (!dstOk) warnings.push('流量目的不在拓扑中')
  }

  return warnings
}
