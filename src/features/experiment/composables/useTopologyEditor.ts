import { computed, type ComputedRef, type Ref } from 'vue'
import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import { experimentDraft } from './experimentDraft'
import { catalogItemById, type CatalogLayer } from '../lib/typeIdCatalog'

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
  appAttrs: { ...node.appAttrs },
  appDestination: node.appDestination,
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

export const useTopologyEditor = (layers: Ref<CatalogLayer[]>) => {
  const { nodes: editNodes, selectedIds, form: experimentForm, activeCatalogId } = experimentDraft

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
    statusText: catalogItemById('mac', experimentForm.value.macId, layers.value)?.label || experimentForm.value.macId,
    packetId: null,
  })))

  const stackLayer = (layerId: string, itemId: string) => {
    const item = catalogItemById(layerId, itemId, layers.value)
    return {
      name: item?.label || itemId || '—',
      typeId: item?.typeId ? item.typeId.replace(/^ns3::/, '') : '—',
      source: item?.source || '',
    }
  }

  const protocolStack = computed(() => {
    const form = experimentForm.value
    const channel = stackLayer('channel', form.channelId || 'channel')
    const prop = stackLayer('channel', form.propagationId || 'range')
    return [
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
    if (!node) {
      selectedIds.value = []
      return
    }
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
    if (remaining < 0 || !selectedIds.value.length) return
    const drop = new Set(selectedIds.value.map(Number))
    editNodes.value = editNodes.value.filter((node) => !drop.has(Number(node.node_id)))
    selectedIds.value = editNodes.value[0] ? [Number(editNodes.value[0].node_id)] : []
  }

  const assignItem = (payload: AssignPayload | null, ids: number[] = selectedIds.value) => {
    if (!payload) return
    const layer = payload.layer || 'mac'
    const itemId = payload.id || payload.macId
    if (!itemId) return
    const item = catalogItemById(layer, itemId, layers.value)
    if (!item) return
    activeCatalogId.value = `${layer}:${itemId}`

    if (layer === 'channel' || payload.scope === 'scene') {
      if ((item.field || 'channelId') === 'channelId') experimentForm.value = { ...experimentForm.value, channelId: itemId }
      else experimentForm.value = { ...experimentForm.value, propagationId: itemId }
      return
    }

    const field = payload.field || (layer === 'phy' ? 'phyId' : layer === 'routing' ? 'routingId' : layer === 'app' ? 'appId' : 'macId')
    if (field === 'appId') {
      if (!ids.length) return
      const idSet = new Set(ids.map(Number))
      editNodes.value = editNodes.value.map((node) => (
        idSet.has(Number(node.node_id)) ? { ...node, appId: itemId, appAttrs: {} } : node
      ))
      return
    }

    const nextForm = { ...experimentForm.value, [field]: itemId }
    if (field === 'macId') {
      if (itemId === 'tdma') nextForm.slotNum = Math.min(8, Math.max(nextForm.slotNum || 4, editNodes.value.length))
    }
    experimentForm.value = nextForm
    editNodes.value = editNodes.value.map((node) => ({ ...node, [field]: itemId }))
  }

  const setProtocolAttribute = (typeId: string, name: string, value: string, nodeId?: number) => {
    const update = (attrs: Record<string, string> = {}) => {
      const next = { ...attrs }
      if (value === '') delete next[name]
      else next[name] = value
      return next
    }
    if (nodeId !== undefined) {
      editNodes.value = editNodes.value.map((node) => node.node_id === nodeId ? { ...node, appAttrs: update(node.appAttrs) } : node)
    } else {
      const attrs = experimentForm.value.protocolAttributes || {}
      experimentForm.value = { ...experimentForm.value, protocolAttributes: { ...attrs, [typeId]: update(attrs[typeId]) } }
    }
  }

  const setNodeDestination = (nodeId: number, destination?: number) => {
    editNodes.value = editNodes.value.map((node) => node.node_id === nodeId ? { ...node, appDestination: destination } : node)
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
    setProtocolAttribute,
    setNodeDestination,
  }
}

export type TopologyEditor = ReturnType<typeof useTopologyEditor>
