import { computed, ref, watch } from 'vue'
import type { MeasureLine, MeasurePoint } from './useMeasureTool'
import { positionAtDistance } from '../lib/nodeDistance'
import { parseQuantity } from '@/shared/quantity'

interface Node { node_id: number; x: number; y: number; z?: number; name?: string }
export const useNodePositioning = ({ getNodes, editable, selectedLine, resolve, move, finish }: {
  getNodes: () => readonly Node[]
  editable: () => boolean
  selectedLine: () => MeasureLine | undefined
  resolve: (point: MeasurePoint) => {x: number; y: number; z: number}
  move: (node: {node_id: number; x: number; y: number}) => void
  finish: () => void
}) => {
  const lockedNodeIds = ref<number[]>([])
  const locked = computed(() => new Set(lockedNodeIds.value))
  const isLocked = (id: number) => locked.value.has(Number(id))
  const toggle = (id: number) => {
    if (!editable() || !getNodes().some(node=>node.node_id===id)) return
    lockedNodeIds.value = isLocked(id) ? lockedNodeIds.value.filter(item=>item!==id) : [...lockedNodeIds.value,id]
  }
  watch(() => editable() ? getNodes().map(node=>node.node_id) : null, ids => {
    if (!ids) return
    const existing = new Set(ids)
    if (lockedNodeIds.value.some(id=>!existing.has(id))) lockedNodeIds.value = lockedNodeIds.value.filter(id=>existing.has(id))
  })
  const options = computed(() => {
    const line = selectedLine(), nodes = getNodes()
    if (!line) return []
    const ids = new Set([line.start.nodeId,line.end.nodeId])
    return nodes.filter(node=>ids.has(node.node_id) && !isLocked(node.node_id)).map(node=>({id:node.node_id,label:`${node.name || '节点'} (${node.node_id})`}))
  })
  const movingId = ref<number | null>(null), input = ref(''), error = ref('')
  const distance = computed(() => {
    const line = selectedLine()
    if (!line) return 0
    const a=resolve(line.start), b=resolve(line.end)
    return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)
  })
  watch(() => [selectedLine()?.id, options.value.map(item=>item.id).join(',')], () => {
    if (!options.value.some(item=>item.id===movingId.value)) movingId.value = options.value.at(-1)?.id ?? null
    input.value = String(Number(distance.value.toFixed(2))) + 'm'; error.value = ''
  }, { immediate:true })
  const apply = () => {
    error.value = ''
    if (!editable()) return
    const line = selectedLine(), id = movingId.value
    if (!line || id==null || isLocked(id)) {error.value='请选择未固定的节点';return}
    const moving = getNodes().find(node=>node.node_id===id)
    if (!moving) return
    const start = line.start.nodeId===id
    if ((!start && line.end.nodeId!==id) || line.start.nodeId===line.end.nodeId) {error.value='请选择两个不同节点之间的测距线';return}
    try {
      const next=positionAtDistance(resolve(start?line.end:line.start),moving,parseQuantity(input.value,'m').value)
      move({node_id:id,x:next.x,y:next.y});finish()
    } catch(cause) {error.value=cause instanceof Error?cause.message:'无法设置距离'}
  }
  return {lockedNodeIds,isLocked,toggle,options,movingId,input,error,distance,apply}
}
