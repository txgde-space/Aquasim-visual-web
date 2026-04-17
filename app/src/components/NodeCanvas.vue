<template>
  <div ref="containerEl" class="canvas-host" @wheel.prevent="onWheel">
    <div class="canvas-toolbar" @pointerdown.stop @contextmenu.prevent="cancelActiveTool">
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: toolMode === 'measure' }"
          @click="activateMeasureTool"
        >
          测距工具
        </button>
        <span class="toolbar-help">
          {{ toolMode === 'measure' ? (pendingMeasurePoint ? '点击第二点' : '先点起点') : '当前为拖拽模式' }}
        </span>
      </div>

      <div class="toolbar-group toolbar-group-history">
        <button class="toolbar-btn toolbar-btn-icon" :disabled="!canUndo" @click="undoMeasurement" aria-label="撤销" title="撤销">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 7 4 12l5 5" />
            <path d="M5 12h8a6 6 0 1 1 0 12" />
          </svg>
        </button>
        <button class="toolbar-btn toolbar-btn-icon" :disabled="!canRedo" @click="redoMeasurement" aria-label="重做" title="重做">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 7 5 5-5 5" />
            <path d="M19 12h-8a6 6 0 1 0 0 12" />
          </svg>
        </button>
        <button class="toolbar-btn toolbar-btn-icon danger" :disabled="!selectedMeasurementId" @click="deleteSelectedMeasurement" aria-label="删除选中" title="删除选中">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M7 7l1 13h8l1-13" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
        <button class="toolbar-btn toolbar-btn-icon" :disabled="!measurementLines.length" @click="clearMeasurements" aria-label="清除全部" title="清除全部">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M6 7l1.4 12h9.2L18 7" />
            <path d="M9.5 10.5 14.5 15.5" />
            <path d="M14.5 10.5 9.5 15.5" />
          </svg>
        </button>
      </div>
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

    <button class="canvas-reset-view" @click="resetView" title="回到默认位置" aria-label="回到默认位置">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v4" />
        <path d="M12 16v4" />
        <path d="M4 12h4" />
        <path d="M16 12h4" />
        <path d="M7.5 7.5l2.5 2.5" />
        <path d="M14 14l2.5 2.5" />
        <path d="M16.5 7.5 14 10" />
        <path d="M10 14l-2.5 2.5" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    </button>

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
      <p v-if="selectedNodeVisual" class="node-tooltip-state">状态：{{ selectedNodeVisual.statusText }}</p>
      <p v-if="selectedNodeVisual?.packetId" class="node-tooltip-state">关联包：{{ selectedNodeVisual.packetId }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  nodes: { type: Array, required: true },
  nodeVisuals: { type: Array, required: true },
  visiblePackets: { type: Array, default: () => [] },
  currentTime: { type: Number, required: true },
})

const TOOL_MODES = Object.freeze({
  PAN: 'pan',
  MEASURE: 'measure',
})

const NODE_RADIUS = 18
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
const measurementHistory = ref([[]])
const measurementHistoryIndex = ref(0)
const selectedMeasurementId = ref(null)
const padding = 44
const emit = defineEmits(['node-select', 'pause-request'])
let resizeObserver = null
let activePointerId = null

const bounds = computed(() => {
  if (!props.nodes.length) {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1, spanX: 1, spanY: 1 }
  }

  const xs = props.nodes.map((node) => node.x)
  const ys = props.nodes.map((node) => node.y)
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
const nodeVisualById = computed(() => new Map(props.nodeVisuals.map((visual) => [visual.node_id, visual])))
const nodeById = computed(() => new Map(props.nodes.map((node) => [node.node_id, node])))

const canvasCursorClass = computed(() => {
  if (toolMode.value !== TOOL_MODES.MEASURE) return ''
  return hoveredMeasureNode.value ? 'canvas-measure-hover' : 'canvas-measure'
})

const toScreen = (x, y) => {
  const base = bounds.value
  return {
    x: padding + ((x - base.minX) * effectiveScale.value) + pan.value.x,
    y: padding + ((y - base.minY) * effectiveScale.value) + pan.value.y,
  }
}

const toWorld = (x, y) => {
  const base = bounds.value
  const s = Math.max(effectiveScale.value, 1e-6)
  return {
    x: base.minX + ((x - padding - pan.value.x) / s),
    y: base.minY + ((y - padding - pan.value.y) / s),
  }
}

const pickNodeAt = (sx, sy) => {
  let picked = null
  let bestDist = Number.POSITIVE_INFINITY
  const thresholdSq = 22 * 22

  for (const node of props.nodes) {
    const p = toScreen(node.x, node.y)
    const dx = sx - p.x
    const dy = sy - p.y
    const d = (dx * dx) + (dy * dy)
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

const selectedNodeVisual = computed(() => {
  if (!selectedNode.value) return null
  return nodeVisualById.value.get(selectedNode.value.node_id) || null
})

const canUndo = computed(() => measurementHistoryIndex.value > 0)
const canRedo = computed(() => measurementHistoryIndex.value < (measurementHistory.value.length - 1))

const distanceByWorld = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

const cloneMeasurements = (items) => items.map((item) => ({
  id: item.id,
  start: { ...item.start },
  end: { ...item.end },
  distance: item.distance,
}))

const applyMeasurementState = (items) => {
  measurementLines.value = cloneMeasurements(items)
  if (selectedMeasurementId.value && !measurementLines.value.some((item) => item.id === selectedMeasurementId.value)) {
    selectedMeasurementId.value = null
  }
}

const commitMeasurementState = (items, nextSelectedId = selectedMeasurementId.value) => {
  const snapshot = cloneMeasurements(items)
  measurementHistory.value = measurementHistory.value.slice(0, measurementHistoryIndex.value + 1)
  measurementHistory.value.push(snapshot)
  measurementHistoryIndex.value = measurementHistory.value.length - 1
  measurementLines.value = cloneMeasurements(snapshot)
  selectedMeasurementId.value = nextSelectedId && measurementLines.value.some((item) => item.id === nextSelectedId)
    ? nextSelectedId
    : null
}

const selectMeasurementAt = (sx, sy) => {
  let picked = null
  let bestDist = Number.POSITIVE_INFINITY

  for (const item of measurementLines.value) {
    const a = toScreen(item.start.x, item.start.y)
    const b = toScreen(item.end.x, item.end.y)
    const abx = b.x - a.x
    const aby = b.y - a.y
    const ab2 = (abx * abx) + (aby * aby)
    if (ab2 < 1e-6) continue
    const t = Math.max(0, Math.min(1, (((sx - a.x) * abx) + ((sy - a.y) * aby)) / ab2))
    const px = a.x + (abx * t)
    const py = a.y + (aby * t)
    const dx = sx - px
    const dy = sy - py
    const dist = Math.hypot(dx, dy)
    if (dist <= 10 && dist < bestDist) {
      bestDist = dist
      picked = item
    }
  }

  return picked
}

const roundedRectPath = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

const fillCircle = (ctx, x, y, radius, fillStyle, alpha = 1) => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fillStyle
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const strokeCircle = (ctx, x, y, radius, strokeStyle, lineWidth, alpha = 1) => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

const packetSegmentColor = (packet, receiver, now) => {
  const txColor = 'rgba(245, 158, 11, 0.92)'
  const rxColor = 'rgba(34, 197, 94, 0.92)'
  const collisionColor = 'rgba(220, 38, 38, 0.94)'

  if (now < receiver.rx_start_us) {
    return txColor
  }

  if (receiver.status === 'ok') {
    return rxColor
  }

  if (receiver.reason === 'collision_rx_rx') {
    const collisionAt = receiver.collision_start_us ?? receiver.rx_start_us
    return now < collisionAt ? rxColor : collisionColor
  }

  if (receiver.reason === 'collision_rx_tx') {
    return now < receiver.rx_start_us ? txColor : collisionColor
  }

  return collisionColor
}

const drawPacketRect = (ctx, packet, receiver, now) => {
  const srcNode = nodeById.value.get(packet.src)
  const dstNode = nodeById.value.get(receiver.dst)
  if (!srcNode || !dstNode) return

  const src = toScreen(srcNode.x, srcNode.y)
  const dst = toScreen(dstNode.x, dstNode.y)
  const dx = dst.x - src.x
  const dy = dst.y - src.y
  const pathLength = Math.hypot(dx, dy)
  if (pathLength < 1) return

  const ux = dx / pathLength
  const uy = dy / pathLength
  const nx = -uy
  const ny = ux
  const pathDuration = Math.max(1, receiver.rx_start_us - packet.tx_start_us)
  const frontRatio = Math.max(0, Math.min(1, (now - packet.tx_start_us) / pathDuration))
  const tailRatio = Math.max(0, Math.min(1, (now - (packet.tx_start_us + packet.tx_duration_us)) / pathDuration))
  const startRatio = Math.min(tailRatio, frontRatio)
  const endRatio = Math.max(tailRatio, frontRatio)
  if (endRatio <= 0) return

  const segStartX = src.x + (dx * startRatio)
  const segStartY = src.y + (dy * startRatio)
  const segEndX = src.x + (dx * endRatio)
  const segEndY = src.y + (dy * endRatio)
  const halfWidth = 3
  const color = packetSegmentColor(packet, receiver, now)

  ctx.save()
  ctx.setLineDash([5, 6])
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.34)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(src.x, src.y)
  ctx.lineTo(dst.x, dst.y)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(segStartX + (nx * halfWidth), segStartY + (ny * halfWidth))
  ctx.lineTo(segEndX + (nx * halfWidth), segEndY + (ny * halfWidth))
  ctx.lineTo(segEndX - (nx * halfWidth), segEndY - (ny * halfWidth))
  ctx.lineTo(segStartX - (nx * halfWidth), segStartY - (ny * halfWidth))
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  if (now >= receiver.rx_start_us) {
    const linger = Math.max(0, 1 - ((now - receiver.rx_start_us) / Math.max(150_000, receiver.rx_duration_us * 0.75)))
    if (linger > 0) {
      fillCircle(ctx, dst.x, dst.y, 2.8, color, 0.45 + (linger * 0.3))
    }
  }
}

const drawVisiblePackets = (ctx) => {
  const now = props.currentTime
  for (const packet of props.visiblePackets) {
    for (const receiver of packet.receivers) {
      if (now < packet.tx_start_us || now > receiver.rx_end_us) continue
      drawPacketRect(ctx, packet, receiver, now)
    }
  }
}

const drawNode = (ctx, node, visual) => {
  const p = toScreen(node.x, node.y)
  const idleGradient = ctx.createRadialGradient(p.x - 5, p.y - 6, 2, p.x, p.y, NODE_RADIUS + 6)
  idleGradient.addColorStop(0, '#7dd3fc')
  idleGradient.addColorStop(1, '#1d4ed8')

  fillCircle(ctx, p.x, p.y, NODE_RADIUS, idleGradient, 0.92)
  strokeCircle(ctx, p.x, p.y, NODE_RADIUS, 'rgba(186, 230, 253, 0.6)', 1.4, 0.9)

  if (visual.mode === 'tx') {
    const progressRadius = 3 + ((NODE_RADIUS - 3) * visual.fillProgress)
    fillCircle(ctx, p.x, p.y, progressRadius, '#f59e0b', 0.98)

    if (visual.overlay?.kind === 'collision_rx_tx') {
      fillCircle(ctx, p.x, p.y, NODE_RADIUS * 0.8, '#dc2626', 0.78)
    }
  } else if (visual.mode === 'rx' || visual.mode === 'rx-done') {
    const progressRadius = visual.mode === 'rx-done'
      ? NODE_RADIUS
      : 3 + ((NODE_RADIUS - 3) * visual.fillProgress)
    fillCircle(ctx, p.x, p.y, progressRadius, '#22c55e', visual.fade ?? 1)
  } else if (visual.mode === 'collision' || visual.mode === 'collision-linger') {
    fillCircle(ctx, p.x, p.y, NODE_RADIUS, '#dc2626', visual.fade ?? 1)
  }

  ctx.save()
  ctx.fillStyle = '#f8fafc'
  ctx.font = '600 11px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(node.node_id), p.x, p.y + 0.5)
  ctx.restore()

  ctx.save()
  ctx.fillStyle = '#dbeafe'
  ctx.font = '12px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(node.name, p.x + NODE_RADIUS + 10, p.y + 2)
  ctx.fillStyle = 'rgba(191, 219, 254, 0.7)'
  ctx.font = '10px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(`z ${node.z ?? 0}m`, p.x + NODE_RADIUS + 10, p.y + 16)
  ctx.restore()
}

const drawMeasurementLines = (ctx) => {
  for (const item of measurementLines.value) {
    const p1 = toScreen(item.start.x, item.start.y)
    const p2 = toScreen(item.end.x, item.end.y)
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const angle = Math.atan2(dy, dx)
    const isSelected = selectedMeasurementId.value === item.id

    ctx.save()
    ctx.strokeStyle = isSelected ? 'rgba(251, 191, 36, 0.98)' : 'rgba(56, 189, 248, 0.94)'
    ctx.setLineDash([8, 8])
    ctx.lineWidth = isSelected ? 3 : 2.2
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
    ctx.restore()

    fillCircle(ctx, p1.x, p1.y, isSelected ? 5.5 : 4.5, isSelected ? 'rgba(251, 191, 36, 0.98)' : 'rgba(56, 189, 248, 0.95)')
    fillCircle(ctx, p2.x, p2.y, isSelected ? 5.5 : 4.5, isSelected ? 'rgba(251, 191, 36, 0.98)' : 'rgba(56, 189, 248, 0.95)')

    const labelText = `${item.distance.toFixed(0)} m`
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2
    ctx.save()
    ctx.font = '11px "IBM Plex Sans", "Segoe UI", sans-serif'
    const textWidth = ctx.measureText(labelText).width
    const boxX = midX - (textWidth / 2) - 6
    const boxY = midY - 19
    roundedRectPath(ctx, boxX, boxY, textWidth + 12, 18, 8)
    ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.92)' : 'rgba(8, 18, 34, 0.88)'
    ctx.fill()
    ctx.strokeStyle = isSelected ? 'rgba(251, 191, 36, 0.62)' : 'rgba(56, 189, 248, 0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelText, midX, boxY + 9.5)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#60a5fa'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(midX - 5, midY - 12)
    ctx.lineTo(midX + 5, midY - 12)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(midX - 5, midY - 12)
    ctx.lineTo(midX - 5 + (Math.cos(angle) * 10), midY - 12 + (Math.sin(angle) * 10))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(midX + 5, midY - 12)
    ctx.lineTo(midX + 5 + (Math.cos(angle) * 10), midY - 12 + (Math.sin(angle) * 10))
    ctx.stroke()
    ctx.restore()
  }

  if (toolMode.value === TOOL_MODES.MEASURE && pendingMeasurePoint.value) {
    const p = toScreen(pendingMeasurePoint.value.x, pendingMeasurePoint.value.y)
    ctx.save()
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
    ctx.fillStyle = 'rgba(251, 191, 36, 0.95)'
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p.y)
    ctx.lineTo(displayWidth.value, p.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(p.x, 0)
    ctx.lineTo(p.x, displayHeight.value)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '12px "IBM Plex Sans", "Segoe UI", sans-serif'
    ctx.fillText('起点', p.x + 10, p.y - 10)
    ctx.restore()
  }
}

const draw = () => {
  const canvas = canvasEl.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  if (
    canvas.width !== Math.floor(displayWidth.value * dpr)
    || canvas.height !== Math.floor(displayHeight.value * dpr)
  ) {
    canvas.width = Math.floor(displayWidth.value * dpr)
    canvas.height = Math.floor(displayHeight.value * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const w = displayWidth.value
  const h = displayHeight.value

  const background = ctx.createRadialGradient(w * 0.2, h * 0.18, 0, w * 0.2, h * 0.18, Math.max(w, h))
  background.addColorStop(0, '#16325d')
  background.addColorStop(0.45, '#0b1628')
  background.addColorStop(1, '#030711')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  drawVisiblePackets(ctx)

  for (const node of props.nodes) {
    const visual = nodeVisualById.value.get(node.node_id) || {
      node_id: node.node_id,
      mode: 'idle',
      fillProgress: 0,
      fade: 1,
      overlay: null,
      statusText: '空闲',
      packetId: null,
    }
    drawNode(ctx, node, visual)
  }

  ctx.save()
  ctx.fillStyle = '#bfdbfe'
  ctx.font = '12px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(`time: ${(props.currentTime / 1000).toFixed(1)} ms`, 18, 22)
  if (props.visiblePackets.length === 1) {
    ctx.fillStyle = '#7dd3fc'
    ctx.fillText(`focus: ${props.visiblePackets[0].packet_id}`, 18, 42)
  }
  ctx.restore()

  drawMeasurementLines(ctx)
}

const onPointerDown = (event) => {
  if (event.button !== undefined && event.button !== 0) return

  const canvas = canvasEl.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top

  if (toolMode.value === TOOL_MODES.MEASURE) {
    event.preventDefault()
    event.stopImmediatePropagation()
    const picked = pickNodeAt(sx, sy)
    const point = picked ? { x: picked.x, y: picked.y } : toWorld(sx, sy)

    if (!pendingMeasurePoint.value) {
      const pickedMeasurement = selectMeasurementAt(sx, sy)
      if (pickedMeasurement) {
        selectedMeasurementId.value = pickedMeasurement.id
        requestAnimationFrame(draw)
        return
      }
      pendingMeasurePoint.value = point
      selectedMeasurementId.value = null
      requestAnimationFrame(draw)
      return
    }

    const nextMeasurement = {
      id: `measure-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      start: pendingMeasurePoint.value,
      end: point,
      distance: distanceByWorld(point, pendingMeasurePoint.value),
    }
    commitMeasurementState([...measurementLines.value, nextMeasurement], nextMeasurement.id)
    pendingMeasurePoint.value = null
    requestAnimationFrame(draw)
    return
  }

  const pickedMeasurement = selectMeasurementAt(sx, sy)
  if (pickedMeasurement) {
    selectedMeasurementId.value = pickedMeasurement.id
    requestAnimationFrame(draw)
    return
  }

  selectedMeasurementId.value = null
  activePointerId = event.pointerId
  isPanning.value = true
  panStart.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
  panOffsetStart.value = { ...pan.value }
  hasDragged.value = false

  try {
    canvas.setPointerCapture(event.pointerId)
  } catch {
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
  const dx = x - panStart.value.x
  const dy = y - panStart.value.y

  if ((dx * dx) + (dy * dy) > 16) {
    hasDragged.value = true
  }

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
  updateMeasureHover(event.clientX - rect.left, event.clientY - rect.top)
  if (toolMode.value === TOOL_MODES.MEASURE) {
    requestAnimationFrame(draw)
  }
}

const onCanvasPointerLeave = () => {
  if (toolMode.value === TOOL_MODES.MEASURE) {
    hoveredMeasureNode.value = null
    requestAnimationFrame(draw)
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
    } catch {
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
    hoveredMeasureNode.value = null
  }
  emit('pause-request')
  requestAnimationFrame(draw)
}

const cancelActiveTool = () => {
  if (toolMode.value === TOOL_MODES.PAN && !pendingMeasurePoint.value) return
  toolMode.value = TOOL_MODES.PAN
  pendingMeasurePoint.value = null
  hoveredMeasureNode.value = null
  requestAnimationFrame(draw)
}

const clearMeasurements = () => {
  if (!measurementLines.value.length) return
  commitMeasurementState([], null)
  pendingMeasurePoint.value = null
  hoveredMeasureNode.value = null
  emit('pause-request')
  requestAnimationFrame(draw)
}

const resetView = () => {
  pan.value = { x: 0, y: 0 }
  zoom.value = 1
  selectedNode.value = null
  requestAnimationFrame(draw)
}

const undoMeasurement = () => {
  if (!canUndo.value) return
  measurementHistoryIndex.value -= 1
  applyMeasurementState(measurementHistory.value[measurementHistoryIndex.value])
  pendingMeasurePoint.value = null
  requestAnimationFrame(draw)
}

const redoMeasurement = () => {
  if (!canRedo.value) return
  measurementHistoryIndex.value += 1
  applyMeasurementState(measurementHistory.value[measurementHistoryIndex.value])
  pendingMeasurePoint.value = null
  requestAnimationFrame(draw)
}

const deleteSelectedMeasurement = () => {
  if (!selectedMeasurementId.value) return
  const nextItems = measurementLines.value.filter((item) => item.id !== selectedMeasurementId.value)
  commitMeasurementState(nextItems, null)
  pendingMeasurePoint.value = null
  requestAnimationFrame(draw)
}

const onWheel = (event) => {
  const canvas = canvasEl.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const cx = event.clientX - rect.left
  const cy = event.clientY - rect.top
  const beforeZoom = zoom.value
  const nextZoom = Math.max(0.25, Math.min(4, beforeZoom * (event.deltaY < 0 ? 1.12 : 0.9)))
  if (nextZoom === beforeZoom) return

  const anchorWorld = toWorld(cx, cy)
  zoom.value = nextZoom

  requestAnimationFrame(() => {
    const base = bounds.value
    const s = effectiveScale.value
    pan.value = {
      x: cx - ((anchorWorld.x - base.minX) * s) - padding,
      y: cy - ((anchorWorld.y - base.minY) * s) - padding,
    }
    requestAnimationFrame(draw)
  })
}

const updateViewport = () => {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  displayWidth.value = Math.max(320, rect.width - 2)
  displayHeight.value = Math.max(320, Math.round((rect.height || 0) - 2))
  requestAnimationFrame(draw)
}

watch(
  () => [props.currentTime, props.nodes, props.nodeVisuals, props.visiblePackets],
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
  bottom: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.canvas-reset-view {
  position: absolute;
  z-index: 4;
  top: 12px;
  right: 12px;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(12, 20, 37, 0.86);
  backdrop-filter: blur(6px);
  color: #dbeafe;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.canvas-reset-view svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 0.52rem;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  background: rgba(12, 20, 37, 0.86);
  backdrop-filter: blur(6px);
}

.toolbar-group-history {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(18, 25, 39, 0.9);
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

.toolbar-btn svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.toolbar-btn-icon {
  width: 34px;
  height: 34px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.toolbar-btn.active {
  border-color: rgba(56, 189, 248, 0.7);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.24) inset;
  color: #f8fafc;
}

.toolbar-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.toolbar-btn.danger {
  border-color: rgba(248, 113, 113, 0.34);
  color: #fecaca;
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
  background: rgba(8, 18, 34, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 10px;
  padding: 0.45rem 0.65rem;
  min-width: 200px;
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

.node-tooltip-pos,
.node-tooltip-state {
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
