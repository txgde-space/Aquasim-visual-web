import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import type { ReplayNode } from '../../../shared/types/replay'
import { experimentDraft } from './experimentDraft'
import { catalogItemById, type CatalogLayer } from '../lib/typeIdCatalog'
import { MAX_NODE_COUNT, nextAvailableNodeId, topologyIssues } from '../lib/experimentValidation'
import { normalizeNodeName } from '../../../shared/nodeName'
import { isNodeModelType, type NodeModelType } from '../../../shared/nodeModel'

/** Normalise any node-like object (replay node, canvas node) into a TopologyNode. */
export const cloneNode = (node: Partial<TopologyNode> & { node_id: number }): TopologyNode => ({
  node_id: Number(node.node_id),
  name: node.name || `Node-${node.node_id}`,
  x: Number(node.x) || 0,
  y: Number(node.y) || 0,
  z: Number(node.z) || 0,
  role: node.role || 'node',
  ...(node.modelType === undefined ? {} : { modelType: node.modelType }),
  ...(node.mobility === undefined ? {} : { mobility: { ...node.mobility } }),
  phyId: node.phyId || '',
  macId: node.macId || '',
  routingId: node.routingId || '',
  appId: node.appId || 'none',
  appAttrs: { ...node.appAttrs },
  appDestination: node.appDestination,
  ...(node.protocolAttributes === undefined ? {} : {
    protocolAttributes: Object.fromEntries(Object.entries(node.protocolAttributes).map(([typeId, attrs]) => [typeId, { ...attrs }])),
  }),
})

/** Import the recorded initial topology, retaining node-owned configuration. */
export const nodesFromReplay = (nodes: ReplayNode[], form: ExperimentForm): TopologyNode[] => nodes.map((node) => cloneNode({
  ...node,
  phyId: form.phyId,
  macId: form.macId,
  routingId: form.routingId,
}))

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
  const { nodes: editNodes, selectedIds, form: experimentForm, activeCatalogId, canvas } = experimentDraft
  const topologyError = ref('')
  const isPositionLocked = (id: number) => canvas.value?.lockedNodeIds?.includes(Number(id)) ?? false
  const canAddNode = computed(() => editNodes.value.length < MAX_NODE_COUNT)

  const selectedNodes: ComputedRef<TopologyNode[]> = computed(() => (
    editNodes.value.filter((node) => selectedIds.value.includes(Number(node.node_id)))
  ))
  const selectedEditNode: ComputedRef<TopologyNode | null> = computed(() => (
    selectedNodes.value.length === 1 ? selectedNodes.value[0] : null
  ))
  const selectedMacId: ComputedRef<string> = computed(() => experimentForm.value.macId)
  const selectedSummary = computed(() =>
    selectedNodes.value.length ? `已选 ${selectedNodes.value.length} 个节点` : '未选中节点',
  )

  /** Nodes handed to the canvas: form-level protocol fields merged in. */
  const canvasNodes = computed(() => editNodes.value.map((node) => ({
    ...node,
    macId: experimentForm.value.macId,
    phyId: experimentForm.value.phyId,
    routingId: experimentForm.value.routingId,
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
      name: item?.label || (itemId ? `${itemId}（待校验）` : '未选择'),
      typeId: (item?.typeId || itemId || '—').replace(/^ns3::/, ''),
      source: item?.source || '',
    }
  }

  const protocolStack = computed(() => {
    const form = experimentForm.value
    const channel = stackLayer('channel', form.channelId)
    const prop = stackLayer('channel', form.propagationId)
    return [
      { key: 'routing', layer: '路由', ...stackLayer('routing', form.routingId) },
      { key: 'mac', layer: 'MAC', ...stackLayer('mac', form.macId) },
      { key: 'phy', layer: '物理层', ...stackLayer('phy', form.phyId) },
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
      if (!next || isPositionLocked(node.node_id)) return node
      return {
        ...node,
        x: round2(next.x),
        y: round2(next.y),
      }
    })
  }

  const onNodeMove = (payload: { node_id: number; x: number; y: number } | null) => {
    if (!payload || !Number.isFinite(Number(payload.node_id))) return
    if (selectedIds.value.length > 1 || isPositionLocked(payload.node_id)) return
    editNodes.value = editNodes.value.map((node) => (
      node.node_id === payload.node_id
        ? { ...node, x: round2(payload.x), y: round2(payload.y) }
        : node
    ))
  }

  const onNodeCoordinate = ({ node_id, axis, value }: { node_id: number; axis: 'x' | 'y' | 'z'; value: number }) => {
    if (!['x', 'y', 'z'].includes(axis) || !Number.isFinite(value) || isPositionLocked(node_id)) return
    editNodes.value = editNodes.value.map((node) => (
      node.node_id === node_id ? { ...node, [axis]: round2(value) } : node
    ))
  }

  const addNode = (point?: { x: unknown; y: unknown; z?: unknown } | null) => {
    if (!canAddNode.value) {
      topologyError.value = `最多支持 ${MAX_NODE_COUNT} 个节点`
      return false
    }
    const nodeId = nextAvailableNodeId(editNodes.value.map((node) => node.node_id))
    if (nodeId === null) {
      topologyError.value = '没有可用的节点编号'
      return false
    }
    const xs = editNodes.value.map((node) => Number(node.x) || 0)
    const ys = editNodes.value.map((node) => Number(node.y) || 0)
    const zs = editNodes.value.map((node) => Number(node.z) || 0)
    const spacing = xs.length >= 2
      ? Math.max(400, (Math.max(...xs) - Math.min(...xs)) / Math.max(xs.length - 1, 1))
      : 1000
    const placed = point && typeof point === 'object' && !('target' in point) && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))
    const x = placed ? Number(point.x) : (xs.length ? Math.max(...xs) + spacing : 0)
    const y = placed ? Number(point.y) : (ys.length ? ys.reduce((sum, value) => sum + value, 0) / ys.length : 0)
    const z = placed && point?.z !== undefined && point.z !== '' && Number.isFinite(Number(point.z))
      ? Number(point.z)
      : (zs.length ? zs.reduce((sum, value) => sum + value, 0) / zs.length : 0)
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
        modelType: 'auv',
        phyId: experimentForm.value.phyId,
        macId: experimentForm.value.macId,
        routingId: experimentForm.value.routingId,
        appId: sample?.appId || 'none',
      },
    ]
    selectedIds.value = [nodeId]
    topologyError.value = ''
    return true
  }

  const removeSelected = () => {
    if (!selectedIds.value.length) return
    const drop = new Set(selectedIds.value.map(Number))
    editNodes.value = editNodes.value.filter((node) => !drop.has(Number(node.node_id)))
    selectedIds.value = []
    topologyError.value = ''
  }

  const assignItem = (payload: AssignPayload | null, ids: number[] = selectedIds.value) => {
    if (!payload) return
    const layer = payload.layer || 'mac'
    const itemId = payload.id || payload.macId
    if (!itemId) return
    const layerDefinition = layers.value.find((entry) => entry.id === layer)
    const item = catalogItemById(layer, itemId, layers.value)
    const field = item?.field || layerDefinition?.field
    if (!item || !field) return
    activeCatalogId.value = `${layer}:${itemId}`
    if (field === 'appId') {
      if (!ids.length) return
      const idSet = new Set(ids.map(Number))
      editNodes.value = editNodes.value.map((node) => (
        idSet.has(Number(node.node_id)) ? { ...node, appId: itemId, appAttrs: {} } : node
      ))
      return
    }

    // Node-owned selections are edited by their own card, never the unified stack.
    if (layerDefinition?.scope === 'node') return

    experimentForm.value = { ...experimentForm.value, [field]: itemId }
    if (layerDefinition?.scope !== 'scene') editNodes.value = editNodes.value.map((node) => ({ ...node, [field]: itemId }))
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

  const onNodeRename = ({ node_id, name }: { node_id: number; name: string }) => {
    editNodes.value = editNodes.value.map((node) => node.node_id === node_id
      ? { ...node, name: normalizeNodeName(name, node_id) } : node)
  }

  const onNodeModelChange = ({ node_id, modelType }: { node_id: number; modelType: NodeModelType }) => {
    if (!isNodeModelType(modelType)) return
    editNodes.value = editNodes.value.map((node) => node.node_id === node_id
      ? { ...node, modelType } : node)
  }

  const setNodeMobility = (nodeId: number, typeId: string) => {
    editNodes.value = editNodes.value.map((node) => {
      if (node.node_id !== nodeId) return node
      if (typeId) return { ...node, mobility: { type: typeId } }
      const { mobility: _mobility, ...fixed } = node
      return fixed
    })
  }

  const setNodeProtocolAttribute = (typeId: string, name: string, value: string, nodeIds = selectedIds.value) => {
    const ids = new Set(nodeIds)
    editNodes.value = editNodes.value.map((node) => {
      if (!ids.has(node.node_id)) return node
      const attrs = { ...node.protocolAttributes?.[typeId] }
      if (value === '') delete attrs[name]
      else attrs[name] = value
      return { ...node, protocolAttributes: { ...node.protocolAttributes, [typeId]: attrs } }
    })
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
    const replacement = nodes.map((node) => cloneNode(node))
    const issues = topologyIssues(replacement.map((node) => ({ ...node, id: node.node_id })))
    if (issues.length) {
      topologyError.value = issues.join('；')
      return false
    }
    editNodes.value = replacement
    selectedIds.value = editNodes.value[0] ? [Number(editNodes.value[0].node_id)] : []
    topologyError.value = ''
    return true
  }

  const setField = (key: keyof ExperimentForm, value: unknown) => {
    experimentForm.value = { ...experimentForm.value, [key]: value }
  }

  return {
    editNodes,
    canvas,
    canAddNode,
    topologyError,
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
    onNodeCoordinate,
    addNode,
    removeSelected,
    assignItem,
    onProtocolDrop,
    replaceTopology,
    setField,
    setProtocolAttribute,
    setNodeDestination,
    onNodeRename,
    onNodeModelChange,
    setNodeMobility,
    setNodeProtocolAttribute,
  }
}

export type TopologyEditor = ReturnType<typeof useTopologyEditor>
