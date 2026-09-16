import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import {
  MIN_NODE_COUNT,
  createDefaultExperimentForm,
  createDefaultTopology,
  macPresetById,
} from '../lib/experimentSpec'
import { catalogItemById } from '../lib/typeIdCatalog'

/** Normalise any node-like object (replay node, canvas node) into a TopologyNode. */
export const cloneNode = (node: Partial<TopologyNode> & { node_id: number }): TopologyNode => ({
  node_id: Number(node.node_id),
  name: node.name || `Node-${node.node_id}`,
  x: Number(node.x) || 0,
  y: Number(node.y) || 0,
  z: Number(node.z) || 0,
  role: node.role || 'node',
  phyId: node.phyId || 'phy-fdm',
  macId: node.macId || 'swarm',
  routingId: node.routingId || 'static',
  appId: node.appId || 'none',
})

export interface AssignPayload {
  layer?: string
  id?: string
  typeId?: string
  field?: string
  scope?: string
  macId?: string
  nodeId?: number | null
}

const round2 = (value: unknown): number => Math.round((Number(value) || 0) * 100) / 100

export const useTopologyEditor = () => {
  const editNodes: Ref<TopologyNode[]> = ref(createDefaultTopology())
  const selectedIds: Ref<number[]> = ref([1])
  const experimentForm: Ref<ExperimentForm> = ref(createDefaultExperimentForm())
  const activeCatalogId: Ref<string> = ref('mac:swarm')

  const selectedNodes: ComputedRef<TopologyNode[]> = computed(() => (
    editNodes.value.filter((node) => selectedIds.value.includes(Number(node.node_id)))
  ))
  const selectedEditNode: ComputedRef<TopologyNode | null> = computed(() => (
    selectedNodes.value.length === 1 ? selectedNodes.value[0] : null
  ))
  const selectedMacId: ComputedRef<string> = computed(() => experimentForm.value.macId || 'swarm')
  const selectedSummary = computed(() =>
    selectedNodes.value.length ? `已选 ${selectedNodes.value.length} 个节点` : '未选中节点',
  )

  /** Nodes handed to the canvas: form-level protocol fields merged in. */
  const canvasNodes = computed(() => editNodes.value.map((node) => ({
    ...node,
    macId: experimentForm.value.macId || 'swarm',
    phyId: experimentForm.value.phyId || 'phy-fdm',
    routingId: experimentForm.value.routingId || 'static',
  })))
  const nodeVisuals = computed(() => canvasNodes.value.map((node) => ({
    ...node,
    mode: 'idle',
    fillProgress: 0,
    fade: 1,
    statusText: macPresetById(experimentForm.value.macId || 'swarm').label,
    packetId: null,
  })))

  const stackLayer = (layerId: string, itemId: string) => {
    const item = catalogItemById(layerId, itemId)
    return {
      name: item?.label || itemId || '—',
      typeId: item?.typeId ? item.typeId.replace(/^ns3::/, '') : '—',
      source: item?.source || '',
    }
  }

  const protocolStack = computed(() => {
    const form = experimentForm.value
    const appIds = [...new Set(editNodes.value.map((node) => node.appId || 'none'))]
    const apps = appIds.map((id) => stackLayer('app', id))
    const appName = apps.map((item) => item.name).join(' / ')
    const appType = [...new Set(apps.map((item) => item.typeId))].join(' / ')
    const channel = stackLayer('channel', form.channelId || 'channel')
    const prop = stackLayer('channel', form.propagationId || 'range')
    return [
      { key: 'app', layer: '应用层', name: appName, typeId: appType, source: [...new Set(apps.map((item) => item.source).filter(Boolean))].join('\n') },
      { key: 'routing', layer: '路由', ...stackLayer('routing', form.routingId || 'static') },
      { key: 'mac', layer: 'MAC', ...stackLayer('mac', form.macId || 'swarm') },
      { key: 'phy', layer: '物理层', ...stackLayer('phy', form.phyId || 'phy-fdm') },
      {
        key: 'channel',
        layer: '信道',
        name: `${channel.name} · ${prop.name}`,
        typeId: `${channel.typeId} · ${prop.typeId}`,
        source: [channel.source, prop.source].filter(Boolean).join('\n'),
      },
    ]
  })

  const stackBrief = computed(() => protocolStack.value
    .filter((row) => row.key !== 'app' && row.key !== 'channel')
    .map((row) => row.name)
    .join(' · '))

  const onSelectionChange = (ids: Array<number | string>) => {
    selectedIds.value = (ids || []).map((id) => Number(id))
  }

  const onNodeSelect = (node: TopologyNode | null) => {
    if (!node) return
    const id = Number(node.node_id)
    if (!selectedIds.value.includes(id)) selectedIds.value = [id]
  }

  const onNodesMove = (moves: Array<{ node_id: number; x: number; y: number }>) => {
    if (!Array.isArray(moves) || !moves.length) return
    const byId = new Map(moves.map((item) => [Number(item.node_id), item]))
    editNodes.value = editNodes.value.map((node) => {
      const next = byId.get(Number(node.node_id))
      if (!next) return node
      return {
        ...node,
        x: round2(next.x),
        y: round2(next.y),
      }
    })
  }

  const onNodeMove = (payload: { node_id: number; x: number; y: number } | null) => {
    if (!payload || !Number.isFinite(Number(payload.node_id))) return
    if (selectedIds.value.length > 1) return
    editNodes.value = editNodes.value.map((node) => (
      node.node_id === payload.node_id
        ? { ...node, x: round2(payload.x), y: round2(payload.y) }
        : node
    ))
  }

  const onCoordChange = (axis: 'x' | 'y' | 'z', event: Event) => {
    const node = selectedEditNode.value
    if (!node) return
    const next = Number((event.target as HTMLInputElement).value)
    if (!Number.isFinite(next)) return
    editNodes.value = editNodes.value.map((item) => (
      item.node_id === node.node_id ? { ...item, [axis]: round2(next) } : item
    ))
  }

  const nextNodeId = () => {
    const ids = editNodes.value.map((node) => Number(node.node_id)).filter(Number.isFinite)
    return ids.length ? Math.max(...ids) + 1 : 1
  }

  const addNode = (point?: { x: unknown; y: unknown } | null) => {
    const nodeId = nextNodeId()
    const xs = editNodes.value.map((node) => Number(node.x) || 0)
    const ys = editNodes.value.map((node) => Number(node.y) || 0)
    const zs = editNodes.value.map((node) => Number(node.z) || 0)
    const spacing = xs.length >= 2
      ? Math.max(400, (Math.max(...xs) - Math.min(...xs)) / Math.max(xs.length - 1, 1))
      : 1000
    const placed = point && typeof point === 'object' && !('target' in point) && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))
    const x = placed ? Number(point.x) : (xs.length ? Math.max(...xs) + spacing : 0)
    const y = placed ? Number(point.y) : (ys.length ? ys.reduce((sum, value) => sum + value, 0) / ys.length : 0)
    const z = zs.length ? zs.reduce((sum, value) => sum + value, 0) / zs.length : 0
    const sample = selectedEditNode.value || editNodes.value[0]
    editNodes.value = [
      ...editNodes.value,
      {
        node_id: nodeId,
        name: `Node-${nodeId}`,
        x: round2(x),
        y: round2(y),
        z: round2(z),
        role: 'node',
        phyId: sample?.phyId || 'phy-fdm',
        macId: selectedMacId.value || sample?.macId || 'swarm',
        routingId: sample?.routingId || 'static',
        appId: sample?.appId || 'none',
      },
    ]
    selectedIds.value = [nodeId]
  }

  const removeSelected = () => {
    const remaining = editNodes.value.length - selectedIds.value.length
    if (remaining < MIN_NODE_COUNT || !selectedIds.value.length) return
    const drop = new Set(selectedIds.value.map(Number))
    editNodes.value = editNodes.value.filter((node) => !drop.has(Number(node.node_id)))
    selectedIds.value = editNodes.value[0] ? [Number(editNodes.value[0].node_id)] : []
  }

  const assignItem = (payload: AssignPayload | null, ids: number[] = selectedIds.value) => {
    if (!payload) return
    const layer = payload.layer || 'mac'
    const itemId = payload.id || payload.macId
    if (!itemId) return
    activeCatalogId.value = `${layer}:${itemId}`

    if (layer === 'channel' || payload.scope === 'scene') {
      if (itemId === 'channel') experimentForm.value = { ...experimentForm.value, channelId: itemId }
      else experimentForm.value = { ...experimentForm.value, propagationId: itemId }
      return
    }

    const field = payload.field || (layer === 'phy' ? 'phyId' : layer === 'routing' ? 'routingId' : layer === 'app' ? 'appId' : 'macId')
    if (field === 'appId') {
      if (!ids.length) return
      const idSet = new Set(ids.map(Number))
      editNodes.value = editNodes.value.map((node) => (
        idSet.has(Number(node.node_id)) ? { ...node, appId: itemId } : node
      ))
      return
    }

    const nextForm = { ...experimentForm.value, [field]: itemId }
    if (field === 'macId') {
      const preset = macPresetById(itemId)
      if (preset && nextForm.trafficId === 'none') nextForm.trafficId = preset.trafficDefault
      if (itemId === 'tdma') nextForm.slotNum = Math.min(8, Math.max(nextForm.slotNum || 4, editNodes.value.length))
    }
    experimentForm.value = nextForm
    editNodes.value = editNodes.value.map((node) => ({ ...node, [field]: itemId }))
  }

  const onProtocolDrop = (payload: AssignPayload) => {
    if (payload?.nodeId != null && Number.isFinite(Number(payload.nodeId))) {
      const id = Number(payload.nodeId)
      const ids = selectedIds.value.includes(id) && selectedIds.value.length > 1
        ? selectedIds.value
        : [id]
      if (!selectedIds.value.includes(id)) selectedIds.value = [id]
      assignItem(payload, ids)
      return
    }
    assignItem(payload, selectedIds.value)
  }

  const replaceTopology = (nodes: TopologyNode[]) => {
    editNodes.value = nodes.map((node) => cloneNode(node))
    selectedIds.value = editNodes.value[0] ? [Number(editNodes.value[0].node_id)] : []
  }

  const setField = (key: keyof ExperimentForm, value: unknown) => {
    experimentForm.value = { ...experimentForm.value, [key]: value }
  }

  return {
    editNodes,
    selectedIds,
    experimentForm,
    activeCatalogId,
    selectedNodes,
    selectedEditNode,
    selectedMacId,
    selectedSummary,
    canvasNodes,
    nodeVisuals,
    protocolStack,
    stackBrief,
    onSelectionChange,
    onNodeSelect,
    onNodesMove,
    onNodeMove,
    onCoordChange,
    addNode,
    removeSelected,
    assignItem,
    onProtocolDrop,
    replaceTopology,
    setField,
  }
}

export type TopologyEditor = ReturnType<typeof useTopologyEditor>
