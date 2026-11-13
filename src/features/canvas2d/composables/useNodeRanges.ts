import { computed, ref, watch } from 'vue'
import { DEFAULT_NODE_RANGE, rangeRadius, type NodeRangeSettings } from '../lib/nodeRange'

interface RangeNode { node_id: number; x: number; y: number }

/** Display-only settings belong to the current topology, never to simulation attributes. */
export const useNodeRanges = (nodes: () => RangeNode[], automatic: (node: RangeNode) => number | null, active: () => boolean, scope: () => unknown) => {
  const settings = ref<Record<number, NodeRangeSettings>>({})
  const settingsFor = (id: number): Readonly<NodeRangeSettings> => settings.value[id] || DEFAULT_NODE_RANGE
  const update = (id: number, patch: Partial<NodeRangeSettings>) => {
    if (!nodes().some((node) => node.node_id === id)) return
    settings.value = { ...settings.value, [id]: { ...settingsFor(id), ...patch } }
  }
  watch(scope, () => { settings.value = {} })
  watch(() => active() ? nodes().map((node) => node.node_id) : null, (ids) => {
    if (!ids) return
    const present = new Set(ids)
    const retained = Object.entries(settings.value).filter(([id]) => present.has(Number(id)))
    if (retained.length !== Object.keys(settings.value).length) settings.value = Object.fromEntries(retained)
  })
  const ranges = computed(() => active() ? nodes().flatMap((node) => {
    const value = settingsFor(node.node_id)
    const radius = rangeRadius(value.radiusM, automatic(node))
    return value.visible && radius !== null ? [{ node, settings: value, radius }] : []
  }) : [])
  return { settings, settingsFor, update, ranges }
}
