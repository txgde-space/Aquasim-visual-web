<script setup lang="ts">
import { computed } from 'vue'
import type { NodeVisual, Point3D, ReplayNode, ReplayPacket } from '@/shared/types/replay'
import { signalWindow } from './lib/signalTimeline'

const props = defineProps<{
  nodes: ReplayNode[]; bounds: Point3D[]; visuals: NodeVisual[]; packets: ReplayPacket[]
  currentTime: number; viewedNodeId: number | null
}>()
const emit = defineEmits<{ inspect: [node: ReplayNode] }>()
const visualById = computed(() => new Map(props.visuals.map(row => [row.node_id, row])))
const tone = (id: number) => {
  const visual = visualById.value.get(id)
  if (visual?.overlay || visual?.mode.startsWith('collision')) return 'bad'
  if (visual?.mode === 'tx') return 'tx'
  if (visual?.mode === 'rx' || visual?.mode === 'rx-done') return 'rx'
  return 'idle'
}
const projection = computed(() => {
  const points = props.bounds.length ? props.bounds : props.nodes
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const minX = xs.length ? Math.min(...xs) : 0, maxX = xs.length ? Math.max(...xs) : 0
  const minY = ys.length ? Math.min(...ys) : 0, maxY = ys.length ? Math.max(...ys) : 0
  const scale = Math.min(216 / Math.max(1, maxX-minX), 124 / Math.max(1, maxY-minY))
  const cx = (minX+maxX)/2, cy = (minY+maxY)/2
  return (p: Point3D) => ({ x: 130+(p.x-cx)*scale, y: 82-(p.y-cy)*scale })
})
const points = computed(() => props.nodes.map(node => ({ node, ...projection.value(node), tone: tone(node.node_id) })))
const pointById = computed(() => new Map(points.value.map(point => [point.node.node_id, point])))
const links = computed(() => props.packets.flatMap(packet => packet.receivers.flatMap(receiver => {
  const state = signalWindow(packet, receiver, props.currentTime)
  const source = pointById.value.get(packet.src), target = pointById.value.get(receiver.dst)
  if (!state.active || !source || !target) return []
  return [{ key: `${packet.eventId}:${receiver.dst}`, source, target,
    x: source.x+(target.x-source.x)*state.front, y: source.y+(target.y-source.y)*state.front }]
})))
</script>

<template>
  <section class="scene-overview" aria-label="全景节点图" @pointerdown.stop @click.stop @wheel.stop>
    <header><span>全景</span><span class="overview-axis">XY · {{ nodes.length }} 节点</span></header>
    <svg viewBox="0 0 260 170" aria-label="点击节点切换聚焦">
      <path class="overview-grid" d="M22 20H238M22 82H238M22 144H238M22 20V144M130 20V144M238 20V144" />
      <g v-for="link in links" :key="link.key" class="overview-link">
        <path :d="`M${link.source.x} ${link.source.y}L${link.target.x} ${link.target.y}`" />
        <circle :cx="link.x" :cy="link.y" r="2.5" />
      </g>
      <g v-for="point in points" :key="point.node.node_id" :transform="`translate(${point.x},${point.y})`"
        :class="['overview-node', point.tone]" role="button" tabindex="0"
        :aria-label="`聚焦 ${point.node.name}（${point.node.node_id}）`"
        @click="emit('inspect', point.node)" @keydown.enter.stop.prevent="emit('inspect', point.node)"
        @keydown.space.stop.prevent="emit('inspect', point.node)">
        <title>{{ point.node.name }} · ID {{ point.node.node_id }} · Z {{ Number(point.node.z ?? 0).toFixed(1) }} m</title>
        <circle v-if="point.node.node_id === viewedNodeId" class="overview-focus" r="14" />
        <circle class="overview-dot" r="6" />
        <text y="22">{{ point.node.node_id }}</text>
      </g>
    </svg>
    <footer><span class="tx">↗ 发射／传播</span><span class="rx">◎ 接收</span><span class="bad">× 碰撞／丢弃</span></footer>
  </section>
</template>

<style scoped>
.scene-overview { position:absolute; top:108px; right:40px; z-index:2; width:260px; border:1px solid var(--line); border-radius:var(--r-md); background:var(--panel); backdrop-filter:blur(10px); color:var(--text); overflow:hidden; }
header { display:flex; justify-content:space-between; padding:9px 12px 0; font-size:12px; }
.overview-axis { color:var(--muted); font:10px var(--font-mono); }
svg { display:block; width:100%; }
.overview-grid { fill:none; stroke:var(--line-strong); stroke-width:.5; }
.overview-link path { fill:none; stroke:var(--tx); stroke-width:1; opacity:.35; }
.overview-link circle { fill:var(--tx); }
.overview-node { cursor:pointer; color:var(--accent); outline:none; }
.overview-dot { fill:var(--panel-solid); stroke:currentColor; stroke-width:2; }
.overview-node:hover .overview-dot,.overview-node:focus-visible .overview-dot { fill:currentColor; }
.overview-focus { fill:none; stroke:var(--text); stroke-width:1; stroke-dasharray:3 3; }
text { fill:var(--text); font:10px var(--font-mono); text-anchor:middle; }
.tx { color:var(--tx); }.rx { color:var(--rx); }.bad { color:var(--bad); }
footer { display:flex; justify-content:space-between; padding:0 10px 9px; font-size:10px; gap:6px; }
@media(max-width:700px) { .scene-overview { width:190px; top:108px; } footer { flex-wrap:wrap; } }
</style>
