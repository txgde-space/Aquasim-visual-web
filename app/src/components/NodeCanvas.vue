<template>
  <div ref="containerEl" class="canvas-host" @wheel.prevent="onWheel">
    <div class="canvas-toolbar" @pointerdown.stop>
      <button
        class="toolbar-btn"
        :class="{ active: toolMode === 'measure' }"
        @click="activateMeasureTool"
      >
        测距工具
      </button>
      <button
        class="toolbar-btn"
        @click="clearMeasurements"
      >
        清除工具痕迹
      </button>
      <span class="toolbar-help">
        {{ toolMode === 'measure' ? (pendingMeasurePoint ? '点击第二点' : '先点起点') : '当前为拖拽模式' }}
      </span>
    </div>
    <canvas
      ref="canvasEl"
      class="canvas"
      :class="canvasCursorClass"
      :aria-label="`acoustic-node-canvas-${Math.round(displayWidth)}x${Math.round(displayHeight)}`"
      @pointerdown="onPointerDown"
      @pointermove="onCanvasPointerMove"
      @pointerleave="onCanvasPointerLeave"
    />
    <div
      v-if="selectedNodePos && selectedNode"
      class="node-tooltip"
      :style="{ left: `${selectedNodePos.x}px`, top: `${selectedNodePos.y}px` }"
    >
      <p class="node-tooltip-title">
        {{ selectedNode.name }}（{{ selectedNode.node_id }}）
        <span class="node-tooltip-role">{{ selectedNode.role }}</span>
      </p>
      <p class="node-tooltip-pos">x: {{ selectedNode.x.toFixed(1) }}m, y: {{ selectedNode.y.toFixed(1) }}m, z: {{ selectedNode.z ?? 0 }}m</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  nodes: { type: Array, required: true },
  txs: { type: Array, required: true },
  rxs: { type: Array, required: true },
  currentTime: { type: Number, required: true },
})

const TOOL_MODES = Object.freeze({
  PAN: 'pan',
  MEASURE: 'measure',
})

const canvasEl = ref(null)
const containerEl = ref(null)
const displayWidth = ref(900)
const displayHeight = ref(520)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const panOffsetStart = ref({ x: 0, y: 0 })
const zoom = ref(1)
const hasDragged = ref(false)
const selectedNode = ref(null)
const hoveredMeasureNode = ref(null)
const toolMode = ref(TOOL_MODES.PAN)
const pendingMeasurePoint = ref(null)
const measurementLines = ref([])
const padding = 40
const emit = defineEmits(['node-select', 'pause-request'])
let resizeObserver = null
let activePointerId = null

const bounds = computed(() => {
  const nodes = props.nodes
  if (!nodes.length) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1, spanX: 1, spanY: 1 }
  }
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    minX,
    maxX,
    minY,
    maxY,
    spanX: Math.max(maxX - minX, 1),
    spanY: Math.max(maxY - minY, 1),
  }
})

const scale = computed(() => {
  const sx = (displayWidth.value - padding * 2) / bounds.value.spanX
  const sy = (displayHeight.value - padding * 2) / bounds.value.spanY
  return Math.min(sx, sy)
})

const effectiveScale = computed(() => scale.value * zoom.value)

const toScreen = (x, y) => {
  const b = bounds.value
  return {
    x: padding + (x - b.minX) * effectiveScale.value + pan.value.x,
    y: padding + (y - b.minY) * effectiveScale.value + pan.value.y,
  }
}

const toWorld = (x, y) => {
  const b = bounds.value
  const s = Math.max(effectiveScale.value, 1e-6)
  return {
    x: b.minX + (x - padding - pan.value.x) / s,
    y: b.minY + (y - padding - pan.value.y) / s,
  }
}

const pickNodeAt = (sx, sy) => {
  let picked = null
  let bestDist = Number.POSITIVE_INFINITY
  const thresholdSq = 20 * 20

  for (const node of props.nodes) {
    const p = toScreen(node.x, node.y)
    const dx = sx - p.x
    const dy = sy - p.y
    const d = dx * dx + dy * dy
    if (d < bestDist && d <= thresholdSq) {
      bestDist = d
      picked = node
    }
  }

  return picked
}

const selectedNodePos = computed(() => {
  if (!selectedNode.value) return null
  return toScreen(selectedNode.value.x, selectedNode.value.y)
})

const distanceByWorld = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

const canvasCursorClass = computed(() => {
  if (toolMode.value !== TOOL_MODES.MEASURE) return ''
  return hoveredMeasureNode.value ? 'canvas-measure-hover' : 'canvas-measure'
})

const colorFor = (result) => {
  if (result === 'ok') return '#22c55e'
  if (result == null || result === '') return '#22c55e'
  return '#ef4444'
}

const roleColor = (role) => {
  if (role === 'sink') return '#60a5fa'
  if (role === 'relay') return '#a78bfa'
  if (role === 'gateway') return '#22d3ee'
  if (role === 'auv') return '#f87171'
  return '#34d399'
}

const draw = () => {
  const canvas = canvasEl.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  if (canvas.width !== Math.floor(displayWidth.value * dpr) || canvas.height !== Math.floor(displayHeight.value * dpr)) {
    canvas.width = Math.floor(displayWidth.value * dpr)
    canvas.height = Math.floor(displayHeight.value * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const w = displayWidth.value
  const h = displayHeight.value

  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h))
  grd.addColorStop(0, '#14213d')
  grd.addColorStop(1, '#0b1320')
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, w, h)

  // 链路 + 传播粒子
  for (const rx of props.rxs) {
    const src = toScreen(rx.srcPos.x, rx.srcPos.y)
    const dst = toScreen(rx.dstPos.x, rx.dstPos.y)
    const pos = toScreen(rx.travelX, rx.travelY)
    const c = colorFor(rx.result)

    ctx.strokeStyle = c
    ctx.globalAlpha = 0.45
    ctx.setLineDash([6, 6])
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(src.x, src.y)
    ctx.lineTo(dst.x, dst.y)
    ctx.stroke()

    ctx.setLineDash([])
    ctx.fillStyle = c
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2)
    ctx.fill()
  }

  // 广播波纹
  for (const tx of props.txs) {
    const c = tx.source
    if (!c) continue
    const p = toScreen(c.x, c.y)

    ctx.strokeStyle = 'rgba(56,189,248,0.85)'
    ctx.lineWidth = 2.5
    ctx.globalAlpha = tx.opacity
    ctx.beginPath()
    ctx.arc(p.x, p.y, tx.radius, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(96,165,250,0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(tx.radius * 0.62, 12), 0, Math.PI * 2)
    ctx.stroke()

    ctx.globalAlpha = 1
    ctx.fillStyle = '#67e8f9'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#dbeafe'
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.fillText(tx.tx_id, p.x + 12, p.y - 14)
  }

  // 节点
  for (const node of props.nodes) {
    const p = toScreen(node.x, node.y)
    ctx.fillStyle = roleColor(node.role)
    ctx.strokeStyle = '#e2e8f0'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#dbeafe'
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.fillText(`${node.name} (${node.node_id})`, p.x + 12, p.y + 18)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(`z ${node.z ?? 0}m`, p.x + 12, p.y + 32)
  }

  // 当前位置显示
  ctx.fillStyle = '#93c5fd'
  ctx.font = '12px Inter, system-ui, sans-serif'
  ctx.fillText(`time: ${(props.currentTime / 1000).toFixed(1)} ms`, 18, 22)
  ctx.globalAlpha = 1

  for (const item of measurementLines.value) {
    const p1 = toScreen(item.start.x, item.start.y)
    const p2 = toScreen(item.end.x, item.end.y)
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const angle = Math.atan2(dy, dx)

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.94)'
    ctx.setLineDash([8, 8])
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()

    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(56, 189, 248, 0.95)'
    ctx.beginPath()
    ctx.arc(p1.x, p1.y, 4.5, 0, Math.PI * 2)
    ctx.arc(p2.x, p2.y, 4.5, 0, Math.PI * 2)
    ctx.fill()

    const labelText = `${item.distance.toFixed(2)} m`
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2
    ctx.fillStyle = 'rgba(226, 232, 240, 0.95)'
    ctx.font = '11px Inter, system-ui, sans-serif'
    const textWidth = ctx.measureText(labelText).width
    const boxX = midX - textWidth / 2 - 5
    const boxY = midY - 18
    const boxW = textWidth + 10
    const boxH = 16
    ctx.fillStyle = 'rgba(8, 18, 34, 0.85)'
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'
    ctx.lineWidth = 1
    ctx.fillRect(boxX, boxY, boxW, boxH)
    ctx.strokeRect(boxX, boxY, boxW, boxH)
    ctx.fillStyle = '#e2e8f0'
    ctx.fillText(labelText, midX - textWidth / 2, midY - 6)

    ctx.strokeStyle = '#60a5fa'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(midX - 5, midY - 12)
    ctx.lineTo(midX + 5, midY - 12)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(midX - 5, midY - 12)
    ctx.lineTo(midX - 5 + Math.cos(angle) * 10, midY - 12 + Math.sin(angle) * 10)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(midX + 5, midY - 12)
    ctx.lineTo(midX + 5 + Math.cos(angle) * 10, midY - 12 + Math.sin(angle) * 10)
    ctx.stroke()
  }

  if (toolMode.value === TOOL_MODES.MEASURE && pendingMeasurePoint.value) {
    const p = toScreen(pendingMeasurePoint.value.x, pendingMeasurePoint.value.y)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
    ctx.fillStyle = 'rgba(251, 191, 36, 0.95)'
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(8, 18, 34, 0.9)'
    ctx.fillText('起点', p.x + 10, p.y - 10)
    ctx.beginPath()
    ctx.moveTo(0, p.y)
    ctx.lineTo(displayWidth.value, p.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(p.x, 0)
    ctx.lineTo(p.x, displayHeight.value)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

const onPointerDown = (event) => {
  if (event.button !== undefined && event.button !== 0) return

  const canvas = canvasEl.value
  if (!canvas) return

  if (toolMode.value === TOOL_MODES.MEASURE) {
    event.preventDefault()
    event.stopImmediatePropagation()

    const rect = canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const picked = pickNodeAt(sx, sy)
    const point = picked ? { x: picked.x, y: picked.y } : toWorld(sx, sy)

    if (!pendingMeasurePoint.value) {
      pendingMeasurePoint.value = point
      return
    }

    const distance = distanceByWorld(point, pendingMeasurePoint.value)
    measurementLines.value.push({
      start: pendingMeasurePoint.value,
      end: point,
      distance,
    })
    pendingMeasurePoint.value = null
    requestAnimationFrame(draw)
    return
  }

  activePointerId = event.pointerId
  const rect = canvas.getBoundingClientRect()

  isPanning.value = true
  panStart.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
  panOffsetStart.value = { ...pan.value }
  hasDragged.value = false

  try {
    canvas.setPointerCapture(event.pointerId)
  } catch (e) {
    // ignore
  }
}

const onPointerMove = (event) => {
  if (!isPanning.value) return

  const canvas = canvasEl.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const dxMove = x - panStart.value.x
  const dyMove = y - panStart.value.y
  if (dxMove * dxMove + dyMove * dyMove > 16) {
    hasDragged.value = true
  }
  const dx = x - panStart.value.x
  const dy = y - panStart.value.y
  pan.value = {
    x: panOffsetStart.value.x + dx,
    y: panOffsetStart.value.y + dy,
  }
  requestAnimationFrame(draw)
}

const updateMeasureHover = (sx, sy) => {
  if (toolMode.value !== TOOL_MODES.MEASURE) {
    hoveredMeasureNode.value = null
    return
  }
  hoveredMeasureNode.value = pickNodeAt(sx, sy)
}

const onCanvasPointerMove = (event) => {
  const canvas = canvasEl.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top

  updateMeasureHover(sx, sy)
}

const onCanvasPointerLeave = () => {
  if (toolMode.value === TOOL_MODES.MEASURE) {
    hoveredMeasureNode.value = null
  }
}

const onPointerUp = (event) => {
  if (!isPanning.value) return

  if (!hasDragged.value && event) {
    const canvas = canvasEl.value
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const target = pickNodeAt(x, y)
      if (target) {
        selectedNode.value = target
        emit('node-select', target)
      } else {
        selectedNode.value = null
      }
    }
  }

  isPanning.value = false
  if (canvasEl.value && activePointerId !== null) {
    try {
      canvasEl.value.releasePointerCapture(activePointerId)
    } catch (e) {
      // ignore
    }
  }
  activePointerId = null
}

const activateMeasureTool = () => {
  if (toolMode.value === TOOL_MODES.MEASURE) {
    toolMode.value = TOOL_MODES.PAN
    pendingMeasurePoint.value = null
    hoveredMeasureNode.value = null
  } else {
    toolMode.value = TOOL_MODES.MEASURE
    pendingMeasurePoint.value = null
    if (canvasEl.value) {
      hoveredMeasureNode.value = null
    }
  }
  emit('pause-request')
  requestAnimationFrame(draw)
}

const clearMeasurements = () => {
  measurementLines.value = []
  pendingMeasurePoint.value = null
  hoveredMeasureNode.value = null
  emit('pause-request')
  requestAnimationFrame(draw)
}

const onWheel = (event) => {
  const canvas = canvasEl.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const cx = event.clientX - rect.left
  const cy = event.clientY - rect.top
  const preZoom = zoom.value
  const nextZoom = Math.max(0.25, Math.min(4, preZoom * (event.deltaY < 0 ? 1.12 : 0.9)))
  if (nextZoom === preZoom) return

  const anchorWorld = toWorld(cx, cy)
  zoom.value = nextZoom
  requestAnimationFrame(() => {
    const b = bounds.value
    const s = effectiveScale.value
    pan.value = {
      x: cx - (anchorWorld.x - b.minX) * s - padding,
      y: cy - (anchorWorld.y - b.minY) * s - padding,
    }
    requestAnimationFrame(draw)
  })
}

const updateViewport = () => {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  const clampedWidth = Math.max(320, rect.width - 2)
  const clampedHeight = Math.max(320, Math.round((rect.height || 0) - 2))
  displayWidth.value = clampedWidth
  displayHeight.value = clampedHeight
  requestAnimationFrame(draw)
}

watch(
  () => [props.currentTime, props.nodes, props.txs, props.rxs],
  () => {
    requestAnimationFrame(draw)
  },
  { deep: true, immediate: true },
)

onMounted(() => {
  updateViewport()
  resizeObserver = new ResizeObserver(() => {
    updateViewport()
  })
  if (containerEl.value) {
    resizeObserver.observe(containerEl.value)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('resize', updateViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('resize', updateViewport)
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<style scoped>
.canvas-host {
  position: relative;
  width: 100%;
  height: 100%;
  touch-action: none;
  overflow: hidden;
}

.canvas-toolbar {
  position: absolute;
  z-index: 4;
  top: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 0.52rem;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(12, 20, 37, 0.86);
  backdrop-filter: blur(6px);
}

.toolbar-btn {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.42);
  color: #e2e8f0;
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
  padding: 0.3rem 0.68rem;
  font-size: 0.76rem;
  cursor: pointer;
  font-family: inherit;
}

.toolbar-btn.active {
  border-color: rgba(56, 189, 248, 0.7);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.24) inset;
  color: #f8fafc;
}

.toolbar-help {
  color: #93c5fd;
  font-size: 0.75rem;
  white-space: nowrap;
}

.node-tooltip {
  position: absolute;
  transform: translate(16px, -50%);
  z-index: 2;
  background: rgba(8, 18, 34, 0.93);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 10px;
  padding: 0.4rem 0.6rem;
  min-width: 180px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32);
  pointer-events: none;
}

.node-tooltip-title {
  margin: 0;
  font-size: 0.9rem;
  color: #e2e8f0;
  font-weight: 700;
}

.node-tooltip-role {
  color: #38bdf8;
  margin-left: 0.4rem;
  font-size: 0.78rem;
  font-weight: 500;
}

.node-tooltip-pos {
  margin: 0.25rem 0 0;
  color: #93c5fd;
  font-size: 0.76rem;
  white-space: nowrap;
}

.canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}

.canvas-measure {
  cursor: crosshair;
}

.canvas-measure-hover {
  cursor: pointer;
}

.canvas:active {
  cursor: grabbing;
}
</style>
