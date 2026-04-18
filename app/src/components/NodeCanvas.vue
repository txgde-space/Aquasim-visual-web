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
    <button
      class="canvas-audio-toggle"
      @click="emit('toggle-mute')"
      :title="props.isMuted ? '取消静音' : '静音'"
      :aria-label="props.isMuted ? '取消静音' : '静音'"
    >
      <svg v-if="props.isMuted" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10h4l5-4v12l-5-4H4z" />
        <path d="m19 9-4 6" />
        <path d="m15 9 4 6" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10h4l5-4v12l-5-4H4z" />
        <path d="M16 9a4 4 0 0 1 0 6" />
        <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
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
  themeKey: { type: String, default: 'ocean-sonar' },
  fxLevel: { type: String, default: 'standard' },
  underwaterDetail: { type: String, default: 'standard' },
  isMuted: { type: Boolean, default: false },
})

const TOOL_MODES = Object.freeze({
  PAN: 'pan',
  MEASURE: 'measure',
})

const NODE_RADIUS = 18
const THEME_PROFILES = Object.freeze({
  'ocean-sonar': {
    effect: 'sonar',
    bg: ['#16325d', '#0b1628', '#030711'],
    tx: '#f59e0b',
    rx: '#22c55e',
    bad: '#ef4444',
    idleInner: '#7dd3fc',
    idleOuter: '#1d4ed8',
    nodeStroke: 'rgba(186, 230, 253, 0.6)',
    lane: 'rgba(148, 163, 184, 0.3)',
    sweep: 'rgba(56, 189, 248, 0.08)',
    ring: 'rgba(56, 189, 248, 0.22)',
    particle: 'rgba(125, 211, 252, 0.5)',
    label: '#dbeafe',
    depth: 'rgba(191, 219, 254, 0.7)',
  },
  'research-lab': {
    effect: 'grid',
    bg: ['#1a2338', '#111827', '#0a0f1d'],
    tx: '#f59e0b',
    rx: '#34d399',
    bad: '#f87171',
    idleInner: '#a5b4fc',
    idleOuter: '#2563eb',
    nodeStroke: 'rgba(191, 219, 254, 0.52)',
    lane: 'rgba(148, 163, 184, 0.28)',
    sweep: 'rgba(96, 165, 250, 0.07)',
    ring: 'rgba(147, 197, 253, 0.22)',
    particle: 'rgba(191, 219, 254, 0.44)',
    label: '#dbeafe',
    depth: 'rgba(191, 219, 254, 0.68)',
  },
  'tactical-ops': {
    effect: 'radar',
    bg: ['#263a1d', '#121f12', '#090f0a'],
    tx: '#f59e0b',
    rx: '#4ade80',
    bad: '#ef4444',
    idleInner: '#a3e635',
    idleOuter: '#166534',
    nodeStroke: 'rgba(187, 247, 208, 0.5)',
    lane: 'rgba(163, 230, 53, 0.23)',
    sweep: 'rgba(132, 204, 22, 0.08)',
    ring: 'rgba(132, 204, 22, 0.24)',
    particle: 'rgba(190, 242, 100, 0.4)',
    label: '#dcfce7',
    depth: 'rgba(187, 247, 208, 0.66)',
  },
  'industrial-scada': {
    effect: 'scanline',
    bg: ['#1f2937', '#111827', '#0b1220'],
    tx: '#f97316',
    rx: '#14b8a6',
    bad: '#ef4444',
    idleInner: '#67e8f9',
    idleOuter: '#0369a1',
    nodeStroke: 'rgba(165, 243, 252, 0.5)',
    lane: 'rgba(148, 163, 184, 0.24)',
    sweep: 'rgba(45, 212, 191, 0.06)',
    ring: 'rgba(45, 212, 191, 0.22)',
    particle: 'rgba(153, 246, 228, 0.45)',
    label: '#ccfbf1',
    depth: 'rgba(153, 246, 228, 0.62)',
  },
  'cyber-neon': {
    effect: 'neon',
    bg: ['#2b1244', '#100b22', '#07060f'],
    tx: '#f97316',
    rx: '#2dd4bf',
    bad: '#fb7185',
    idleInner: '#22d3ee',
    idleOuter: '#c026d3',
    nodeStroke: 'rgba(217, 70, 239, 0.52)',
    lane: 'rgba(217, 70, 239, 0.26)',
    sweep: 'rgba(236, 72, 153, 0.08)',
    ring: 'rgba(244, 114, 182, 0.24)',
    particle: 'rgba(34, 211, 238, 0.42)',
    label: '#f5d0fe',
    depth: 'rgba(196, 181, 253, 0.68)',
  },
  'light-minimal': {
    effect: 'minimal',
    bg: ['#e8f1ff', '#dbeafe', '#cbd5e1'],
    tx: '#f97316',
    rx: '#16a34a',
    bad: '#dc2626',
    idleInner: '#93c5fd',
    idleOuter: '#2563eb',
    nodeStroke: 'rgba(59, 130, 246, 0.4)',
    lane: 'rgba(71, 85, 105, 0.24)',
    sweep: 'rgba(56, 189, 248, 0.08)',
    ring: 'rgba(59, 130, 246, 0.2)',
    particle: 'rgba(59, 130, 246, 0.36)',
    label: '#0f172a',
    depth: 'rgba(30, 41, 59, 0.7)',
  },
  'gis-map': {
    effect: 'terrain',
    bg: ['#27453c', '#132823', '#0b1714'],
    tx: '#f59e0b',
    rx: '#22c55e',
    bad: '#ef4444',
    idleInner: '#86efac',
    idleOuter: '#0f766e',
    nodeStroke: 'rgba(134, 239, 172, 0.46)',
    lane: 'rgba(110, 231, 183, 0.26)',
    sweep: 'rgba(34, 197, 94, 0.07)',
    ring: 'rgba(34, 197, 94, 0.24)',
    particle: 'rgba(110, 231, 183, 0.38)',
    label: '#dcfce7',
    depth: 'rgba(167, 243, 208, 0.64)',
  },
  'timeline-story': {
    effect: 'timeline',
    bg: ['#2f1a3d', '#171730', '#0c1221'],
    tx: '#f59e0b',
    rx: '#60a5fa',
    bad: '#f43f5e',
    idleInner: '#c4b5fd',
    idleOuter: '#4f46e5',
    nodeStroke: 'rgba(196, 181, 253, 0.48)',
    lane: 'rgba(167, 139, 250, 0.26)',
    sweep: 'rgba(196, 181, 253, 0.08)',
    ring: 'rgba(196, 181, 253, 0.22)',
    particle: 'rgba(221, 214, 254, 0.42)',
    label: '#ede9fe',
    depth: 'rgba(196, 181, 253, 0.66)',
  },
})

const themeProfile = computed(() => THEME_PROFILES[props.themeKey] || THEME_PROFILES['ocean-sonar'])
const fxIntensity = computed(() => (props.fxLevel === 'extreme' ? 2.2 : 1))
const underwaterDetailProfile = computed(() => {
  if (props.underwaterDetail === 'low') {
    return {
      flowLines: 4,
      reefCount: 4,
      fishSchools: 2,
      fishBaseCount: 6,
      bubbleCount: 20,
      hazeLayers: 2,
    }
  }
  if (props.underwaterDetail === 'cinematic') {
    return {
      flowLines: 9,
      reefCount: 10,
      fishSchools: 6,
      fishBaseCount: 11,
      bubbleCount: 68,
      hazeLayers: 4,
    }
  }
  return {
    flowLines: 6,
    reefCount: 7,
    fishSchools: 4,
    fishBaseCount: 9,
    bubbleCount: 42,
    hazeLayers: 3,
  }
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
const measurementHistory = ref([[]])
const measurementHistoryIndex = ref(0)
const selectedMeasurementId = ref(null)
const padding = 44
const emit = defineEmits(['node-select', 'pause-request', 'toggle-mute'])
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

const drawPlanePulse = (ctx, x, y, angle, color, size, alpha = 1) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(size * 1.2, 0)
  ctx.lineTo(-size * 0.55, size * 0.4)
  ctx.lineTo(-size * 0.2, 0)
  ctx.lineTo(-size * 0.55, -size * 0.4)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(-size * 0.2, 0)
  ctx.lineTo(-size * 0.9, size * 0.65)
  ctx.lineTo(-size * 0.72, 0)
  ctx.lineTo(-size * 0.9, -size * 0.65)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

const drawShellBurst = (ctx, x, y, color, phase, power = 1) => {
  const pulse = 0.5 + (Math.sin(phase * 18) * 0.5)
  const r = (16 + (pulse * 12)) * power
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.1)
  glow.addColorStop(0, color)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, r * 2.1, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  for (let i = 0; i < 3; i += 1) {
    ctx.globalAlpha = 0.58 - (i * 0.16)
    ctx.beginPath()
    ctx.arc(x, y, r + (i * 8), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

const drawSubmarineNode = (ctx, p, fillColor, strokeColor, profile, pulse) => {
  const hullW = 38
  const hullH = 16
  roundedRectPath(ctx, p.x - (hullW / 2), p.y - (hullH / 2), hullW, hullH, 8)
  ctx.fillStyle = fillColor
  ctx.shadowColor = profile.ring
  ctx.shadowBlur = 12 + (pulse * 5)
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.4
  ctx.stroke()

  roundedRectPath(ctx, p.x - 6, p.y - 16, 12, 8, 3)
  ctx.fillStyle = colorMix(fillColor, '#ffffff', 0.15)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(p.x - 19, p.y)
  ctx.lineTo(p.x - 26, p.y - 5)
  ctx.lineTo(p.x - 26, p.y + 5)
  ctx.closePath()
  ctx.fillStyle = strokeColor
  ctx.fill()

  ctx.beginPath()
  ctx.arc(p.x + 8, p.y, 2.2, 0, Math.PI * 2)
  ctx.fillStyle = '#dbeafe'
  ctx.fill()
}

const drawCarrierNode = (ctx, p, fillColor, strokeColor, profile, phase) => {
  const deckW = 56
  const deckH = 20
  roundedRectPath(ctx, p.x - (deckW / 2), p.y - (deckH / 2), deckW, deckH, 6)
  ctx.fillStyle = fillColor
  ctx.shadowColor = profile.ring
  ctx.shadowBlur = 16
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.8
  ctx.stroke()

  roundedRectPath(ctx, p.x - 6, p.y - 18, 18, 9, 3)
  ctx.fillStyle = colorMix(fillColor, '#ffffff', 0.22)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(p.x - 22, p.y)
  ctx.lineTo(p.x + 22, p.y)
  ctx.strokeStyle = '#f8fafc'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  ctx.stroke()
  ctx.setLineDash([])

  const pulse = 0.45 + (Math.sin((phase * 6) + (p.x * 0.01)) * 0.2)
  strokeCircle(ctx, p.x, p.y, 18 + (pulse * 10), profile.ring, 1.2, 0.34)
}

const colorMix = (hexA, hexB, ratio = 0.5) => {
  const parse = (hex) => {
    const clean = hex.replace('#', '')
    const expanded = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean
    const num = parseInt(expanded, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }
  try {
    const a = parse(hexA)
    const b = parse(hexB)
    const m = a.map((v, i) => Math.round((v * (1 - ratio)) + (b[i] * ratio)))
    return `rgb(${m[0]} ${m[1]} ${m[2]})`
  } catch {
    return hexA
  }
}

const packetSegmentColor = (packet, receiver, now, profile) => {
  const txColor = profile.tx
  const rxColor = profile.rx
  const collisionColor = profile.bad

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

const drawPacketRect = (ctx, packet, receiver, now, profile, phase, fx) => {
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
  const pulse = 0.7 + (Math.sin((phase * (8 + fx)) + (packet.tx_start_us * 0.000001)) * 0.3)
  const halfWidth = (2.6 + (pulse * 1.6)) * (fx > 1 ? 1.26 : 1)
  const color = packetSegmentColor(packet, receiver, now, profile)
  const angle = Math.atan2(dy, dx)

  ctx.save()
  if (profile.effect === 'minimal') ctx.setLineDash([2, 5])
  else if (profile.effect === 'timeline') ctx.setLineDash([10, 7])
  else if (profile.effect === 'neon') ctx.setLineDash([4, 4])
  else ctx.setLineDash([5, 6])
  ctx.strokeStyle = profile.lane
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(src.x, src.y)
  ctx.lineTo(dst.x, dst.y)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = (8 + (pulse * 10)) * (fx > 1 ? 1.8 : 1)
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

  const headRatio = Math.max(0, Math.min(1, frontRatio))
  const headX = src.x + (dx * headRatio)
  const headY = src.y + (dy * headRatio)
  fillCircle(ctx, headX, headY, (1.5 + (pulse * 1.8)) * (fx > 1 ? 1.6 : 1), color, fx > 1 ? 0.95 : 0.85)

  if (fx > 1) {
    const trailCount = 3
    for (let i = 1; i <= trailCount; i += 1) {
      const t = Math.max(0, headRatio - (i * 0.05))
      const tx = src.x + (dx * t)
      const ty = src.y + (dy * t)
      fillCircle(ctx, tx, ty, Math.max(1.2, (2.8 - (i * 0.65))), color, 0.3 - (i * 0.07))
    }

    drawPlanePulse(ctx, headX, headY, angle, color, 5.5 + (pulse * 1.6), 0.92)

    if (receiver.status !== 'ok') {
      const collisionAt = receiver.collision_start_us ?? receiver.rx_start_us
      if (now >= collisionAt) {
        const impactRatio = Math.max(0, Math.min(1, (now - collisionAt) / Math.max(1, receiver.rx_duration_us)))
        const shellX = src.x + (dx * (0.72 + (impactRatio * 0.28)))
        const shellY = src.y + (dy * (0.72 + (impactRatio * 0.28)))
        fillCircle(ctx, shellX, shellY, 3.6, '#fb923c', 0.92)
        fillCircle(ctx, shellX - (ux * 8), shellY - (uy * 8), 2.2, '#fdba74', 0.5)
        drawShellBurst(ctx, dst.x, dst.y, '#ef4444', phase + impactRatio, 1.05)
      }
    }
  }
}

const drawVisiblePackets = (ctx, profile, phase, fx) => {
  const now = props.currentTime
  for (const packet of props.visiblePackets) {
    for (const receiver of packet.receivers) {
      if (now < packet.tx_start_us || now > receiver.rx_end_us) continue
      drawPacketRect(ctx, packet, receiver, now, profile, phase, fx)
    }
  }
}

const drawNode = (ctx, node, visual, profile, phase, fx) => {
  const p = toScreen(node.x, node.y)
  const idleGradient = ctx.createRadialGradient(p.x - 5, p.y - 6, 2, p.x, p.y, NODE_RADIUS + 6)
  idleGradient.addColorStop(0, profile.idleInner)
  idleGradient.addColorStop(1, profile.idleOuter)

  const isSink = node.role === 'sink' || /sink/i.test(String(node.name || ''))
  fillCircle(ctx, p.x, p.y, NODE_RADIUS, idleGradient, 0.92)
  strokeCircle(ctx, p.x, p.y, NODE_RADIUS, profile.nodeStroke, 1.4, 0.9)

  const pulse = 0.5 + (Math.sin((phase * (4.2 + (fx * 0.8))) + (node.node_id * 0.6)) * 0.5)
  strokeCircle(ctx, p.x, p.y, NODE_RADIUS + 4 + (pulse * 3), profile.ring, 1, 0.35 + (pulse * 0.3))
  if (fx > 1) {
    strokeCircle(ctx, p.x, p.y, NODE_RADIUS + 10 + (pulse * 6), profile.ring, 1.2, 0.3)
  }

  if (visual.mode === 'tx') {
    const progressRadius = 3 + ((NODE_RADIUS - 3) * visual.fillProgress)
    fillCircle(ctx, p.x, p.y, progressRadius, profile.tx, 0.98)
    strokeCircle(ctx, p.x, p.y, NODE_RADIUS + 8 + (pulse * 5), profile.tx, 1.2, 0.35)

    if (visual.overlay?.kind === 'collision_rx_tx') {
      fillCircle(ctx, p.x, p.y, NODE_RADIUS * 0.8, profile.bad, 0.78)
    }
  } else if (visual.mode === 'rx' || visual.mode === 'rx-done') {
    const progressRadius = visual.mode === 'rx-done'
      ? NODE_RADIUS
      : 3 + ((NODE_RADIUS - 3) * visual.fillProgress)
    fillCircle(ctx, p.x, p.y, progressRadius, profile.rx, visual.fade ?? 1)
    strokeCircle(ctx, p.x, p.y, NODE_RADIUS + 7 + (pulse * 4), profile.rx, 1, 0.28)
  } else if (visual.mode === 'collision' || visual.mode === 'collision-linger') {
    fillCircle(ctx, p.x, p.y, NODE_RADIUS, profile.bad, visual.fade ?? 1)
    strokeCircle(ctx, p.x, p.y, NODE_RADIUS + 10 + (pulse * 4), profile.bad, 1.6, 0.5)
    if (fx > 1) {
      for (let i = 0; i < 3; i += 1) {
        const rr = NODE_RADIUS + 13 + (i * 7) + (((phase * 42) + (i * 8)) % 10)
        strokeCircle(ctx, p.x, p.y, rr, profile.bad, 1.1, 0.22 - (i * 0.05))
      }
    }
  }

  if (fx > 1) {
    const baseColor = visual.mode === 'collision' || visual.mode === 'collision-linger'
      ? profile.bad
      : visual.mode === 'tx'
        ? profile.tx
        : visual.mode === 'rx' || visual.mode === 'rx-done'
          ? profile.rx
          : profile.idleInner
    const strokeColor = colorMix(baseColor, '#ffffff', 0.32)
    ctx.save()
    if (isSink) drawCarrierNode(ctx, p, baseColor, strokeColor, profile, phase)
    else drawSubmarineNode(ctx, p, baseColor, strokeColor, profile, pulse)
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = '#f8fafc'
  ctx.font = fx > 1 ? '700 10px "IBM Plex Sans", "Segoe UI", sans-serif' : '600 11px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(node.node_id), p.x, p.y + (fx > 1 ? 20 : 0.5))
  ctx.restore()

  ctx.save()
  ctx.fillStyle = profile.label
  ctx.font = '12px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const labelOffset = fx > 1 ? NODE_RADIUS + 14 : NODE_RADIUS + 10
  ctx.fillText(node.name, p.x + labelOffset, p.y + 2)
  ctx.fillStyle = profile.depth
  ctx.font = '10px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(`z ${node.z ?? 0}m`, p.x + labelOffset, p.y + 16)
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

const hashNoise = (seed) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const drawUnderwaterBackdrop = (ctx, w, h, profile, phase, detail) => {
  ctx.save()

  const seabedTop = h * 0.78
  const seabedGradient = ctx.createLinearGradient(0, seabedTop, 0, h)
  seabedGradient.addColorStop(0, 'rgba(10, 39, 57, 0.42)')
  seabedGradient.addColorStop(1, 'rgba(10, 22, 35, 0.84)')
  ctx.fillStyle = seabedGradient
  ctx.fillRect(0, seabedTop, w, h - seabedTop)

  ctx.strokeStyle = 'rgba(120, 210, 255, 0.14)'
  ctx.lineWidth = 1.1
  for (let r = 0; r < detail.flowLines; r += 1) {
    const yBase = (h * 0.16) + (r * h * 0.1)
    ctx.beginPath()
    for (let x = 0; x <= w; x += 14) {
      const y = yBase + (Math.sin((x * 0.013) + (phase * (0.8 + (r * 0.12)))) * (8 + r))
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  const reefCount = detail.reefCount
  for (let i = 0; i < reefCount; i += 1) {
    const n = hashNoise(i * 17.3)
    const x = (i / (reefCount - 1)) * w
    const baseY = h * (0.81 + (hashNoise(i * 9.1) * 0.07))
    const width = 55 + (n * 120)
    const height = 26 + (hashNoise(i * 23.7) * 78)
    const drift = Math.sin((phase * 0.4) + i) * 2.6
    const grad = ctx.createLinearGradient(x, baseY - height, x, baseY + 2)
    grad.addColorStop(0, 'rgba(26, 64, 87, 0.55)')
    grad.addColorStop(1, 'rgba(8, 24, 39, 0.86)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x - width + drift, baseY)
    ctx.quadraticCurveTo(x - (width * 0.34) + drift, baseY - height, x + drift, baseY - (height * 0.38))
    ctx.quadraticCurveTo(x + (width * 0.35) + drift, baseY - (height * 1.06), x + width + drift, baseY)
    ctx.closePath()
    ctx.fill()
  }

  const fishSchools = detail.fishSchools
  for (let s = 0; s < fishSchools; s += 1) {
    const fishCount = detail.fishBaseCount + (s * 2)
    const yBase = h * (0.22 + (s * 0.12))
    const dir = s % 2 === 0 ? 1 : -1
    for (let i = 0; i < fishCount; i += 1) {
      const offset = i / fishCount
      const travel = ((phase * (44 + (s * 8))) + (offset * w * 1.2)) % (w + 180)
      const x = dir > 0 ? (travel - 90) : (w - travel + 90)
      const y = yBase
        + (Math.sin((phase * 1.3) + (i * 0.8) + s) * 8)
        + (Math.sin((phase * 3.2) + (i * 0.2)) * 3)
      const size = 3.6 + ((i % 4) * 0.55)
      const angle = dir > 0 ? 0 : Math.PI
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(angle)
      ctx.globalAlpha = 0.26 + ((i % 3) * 0.1)
      ctx.fillStyle = profile.particle
      ctx.beginPath()
      ctx.moveTo(size * 1.2, 0)
      ctx.lineTo(-size * 0.4, size * 0.5)
      ctx.lineTo(-size * 0.1, 0)
      ctx.lineTo(-size * 0.4, -size * 0.5)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  }

  const bubbleCount = detail.bubbleCount
  for (let i = 0; i < bubbleCount; i += 1) {
    const col = i % 7
    const columnX = ((col + 0.5) / 7) * w
    const wobble = Math.sin((phase * 1.8) + i) * (4 + (i % 5))
    const speed = 26 + ((i % 6) * 7)
    const y = h - (((phase * speed) + (i * 29)) % (h + 120))
    const x = columnX + wobble
    const radius = 1.2 + ((i % 4) * 0.58)
    strokeCircle(ctx, x, y, radius, 'rgba(186, 230, 253, 0.34)', 1, 0.8)
  }

  for (let i = 0; i < detail.hazeLayers; i += 1) {
    const fog = ctx.createLinearGradient(0, 0, 0, h)
    fog.addColorStop(0, `rgba(125, 211, 252, ${0.03 + (i * 0.008)})`)
    fog.addColorStop(0.55, `rgba(2, 14, 28, ${0.08 + (i * 0.03)})`)
    fog.addColorStop(1, `rgba(2, 10, 20, ${0.2 + (i * 0.05)})`)
    ctx.fillStyle = fog
    ctx.fillRect(0, 0, w, h)
  }

  ctx.restore()
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))

const drawBetaTelemetry = (ctx, w, h, profile, phase) => {
  const txCount = props.nodeVisuals.filter((item) => item.mode === 'tx').length
  const rxCount = props.nodeVisuals.filter((item) => item.mode === 'rx' || item.mode === 'rx-done').length
  const collisionCount = props.nodeVisuals.filter((item) => item.mode === 'collision' || item.mode === 'collision-linger').length
  const activePackets = props.visiblePackets.length
  const totalNodes = Math.max(1, props.nodes.length)

  const load = clamp01((txCount + rxCount + (activePackets * 1.8)) / (totalNodes * 1.9))
  const risk = clamp01((collisionCount * 1.4) / totalNodes)
  const spread = clamp01(activePackets / Math.max(1, totalNodes / 2))
  const linkQuality = clamp01(1 - (risk * 0.92))
  const energy = clamp01(0.42 + (Math.sin((phase * 0.9) + (load * 2.4)) * 0.2) + (load * 0.25))
  const stability = clamp01((linkQuality * 0.65) + ((1 - load) * 0.35))

  const panelW = 230
  const panelH = 86
  const panelX = 14
  const panelY = h - panelH - 56
  roundedRectPath(ctx, panelX, panelY, panelW, panelH, 11)
  ctx.fillStyle = 'rgba(8, 23, 39, 0.72)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)'
  ctx.lineWidth = 1
  ctx.stroke()

  const graphX = panelX + 10
  const graphY = panelY + 14
  const graphW = panelW - 20
  const graphH = panelH - 26

  ctx.save()
  ctx.beginPath()
  ctx.rect(graphX, graphY, graphW, graphH)
  ctx.clip()

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.16)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i += 1) {
    const y = graphY + ((graphH / 4) * i)
    ctx.beginPath()
    ctx.moveTo(graphX, y)
    ctx.lineTo(graphX + graphW, y)
    ctx.stroke()
  }

  const samples = 84
  ctx.beginPath()
  for (let i = 0; i < samples; i += 1) {
    const t = (i / (samples - 1))
    const x = graphX + (t * graphW)
    const moving = ((phase * 0.9) + (t * 6.2))
    const yNorm = clamp01((0.36 + (Math.sin(moving * 2.6) * 0.22) + (Math.sin(moving * 6.4) * 0.08) + (load * 0.18) - (risk * 0.24)))
    const y = graphY + ((1 - yNorm) * graphH)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = profile.idleInner
  ctx.lineWidth = 1.8
  ctx.shadowColor = profile.idleInner
  ctx.shadowBlur = 10
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.font = '600 10px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillStyle = 'rgba(191, 219, 254, 0.88)'
  ctx.fillText(`Signal Flux ${Math.round((load * 100))}%`, panelX + 12, panelY + panelH - 8)
  ctx.restore()

  const radarSize = 120
  const radarX = w - radarSize - 124
  const radarY = 16
  roundedRectPath(ctx, radarX, radarY, radarSize, radarSize, 12)
  ctx.fillStyle = 'rgba(8, 23, 39, 0.72)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.24)'
  ctx.lineWidth = 1
  ctx.stroke()

  const cx = radarX + (radarSize / 2)
  const cy = radarY + (radarSize / 2) + 2
  const radius = 40
  const dims = [
    { label: 'TX', value: load },
    { label: 'RX', value: clamp01(rxCount / totalNodes) },
    { label: 'RISK', value: risk },
    { label: 'SPREAD', value: spread },
    { label: 'LINK', value: linkQuality },
    { label: 'ENG', value: energy },
  ]

  ctx.save()
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.18)'
  ctx.lineWidth = 1
  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath()
    ctx.arc(cx, cy, (radius / 4) * ring, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (let i = 0; i < dims.length; i += 1) {
    const ang = -Math.PI / 2 + ((Math.PI * 2 * i) / dims.length)
    const ax = cx + (Math.cos(ang) * radius)
    const ay = cy + (Math.sin(ang) * radius)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ax, ay)
    ctx.stroke()
  }

  ctx.beginPath()
  for (let i = 0; i < dims.length; i += 1) {
    const ang = -Math.PI / 2 + ((Math.PI * 2 * i) / dims.length)
    const r = radius * dims[i].value
    const px = cx + (Math.cos(ang) * r)
    const py = cy + (Math.sin(ang) * r)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(56, 189, 248, 0.22)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.86)'
  ctx.lineWidth = 1.6
  ctx.stroke()

  const sweepAngle = (phase * 1.2) % (Math.PI * 2)
  ctx.strokeStyle = 'rgba(96, 250, 255, 0.8)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + (Math.cos(sweepAngle) * radius), cy + (Math.sin(sweepAngle) * radius))
  ctx.stroke()

  ctx.font = '600 9px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillStyle = 'rgba(191, 219, 254, 0.78)'
  ctx.textAlign = 'center'
  for (let i = 0; i < dims.length; i += 1) {
    const ang = -Math.PI / 2 + ((Math.PI * 2 * i) / dims.length)
    const lx = cx + (Math.cos(ang) * (radius + 11))
    const ly = cy + (Math.sin(ang) * (radius + 11)) + 3
    ctx.fillText(dims[i].label, lx, ly)
  }
  ctx.restore()

  const badgeW = 124
  roundedRectPath(ctx, w - badgeW - 16, h - 42, badgeW, 26, 999)
  ctx.fillStyle = 'rgba(11, 33, 54, 0.82)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)'
  ctx.stroke()
  ctx.fillStyle = 'rgba(191, 219, 254, 0.92)'
  ctx.font = '600 10px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(`Stability ${Math.round(stability * 100)}%`, w - badgeW + 10, h - 24)
}

const drawThemeAmbient = (ctx, w, h, profile, phase, fx) => {
  if (fx <= 1) {
    const sweep = ((phase * 0.07) % 1) * w
    const sweepGradient = ctx.createLinearGradient(sweep - 240, 0, sweep + 240, 0)
    sweepGradient.addColorStop(0, 'rgba(0,0,0,0)')
    sweepGradient.addColorStop(0.5, profile.sweep)
    sweepGradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sweepGradient
    ctx.fillRect(0, 0, w, h)
  }

  if (profile.effect === 'sonar' || profile.effect === 'radar') {
    ctx.save()
    ctx.strokeStyle = profile.ring
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i += 1) {
      const r = ((phase * (36 + (fx * 8))) + (i * 95)) % Math.max(w, h)
      ctx.beginPath()
      ctx.arc(w * (profile.effect === 'radar' ? 0.2 : 0.12), h * 0.2, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  if (profile.effect === 'grid' || profile.effect === 'timeline') {
    ctx.save()
    ctx.strokeStyle = profile.ring
    ctx.lineWidth = 0.6
    const spacing = profile.effect === 'grid' ? 44 : 56
    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath()
      ctx.moveTo(x + ((phase * (5 + fx)) % spacing), 0)
      ctx.lineTo(x + ((phase * (5 + fx)) % spacing), h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += spacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  if (profile.effect === 'scanline' && fx <= 1) {
    ctx.save()
    const y = (phase * (45 + (fx * 14))) % h
    const line = ctx.createLinearGradient(0, y - 80, 0, y + 80)
    line.addColorStop(0, 'rgba(0,0,0,0)')
    line.addColorStop(0.5, profile.sweep)
    line.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = line
    ctx.fillRect(0, y - 80, w, 160)
    ctx.restore()
  }

  if (profile.effect === 'neon' || profile.effect === 'terrain' || profile.effect === 'minimal') {
    ctx.save()
    const waveCount = profile.effect === 'minimal' ? 2 : (fx > 1 ? 6 : 4)
    ctx.strokeStyle = profile.ring
    ctx.lineWidth = profile.effect === 'minimal' ? 0.8 : 1.2
    for (let i = 0; i < waveCount; i += 1) {
      const y0 = h * (0.2 + (i * 0.18))
      ctx.beginPath()
      for (let x = 0; x <= w; x += 18) {
        const y = y0 + Math.sin((x * 0.008) + (phase * ((1.2 + (i * 0.2)) * (1 + (fx * 0.18))))) * (6 + (i * 2) + (fx > 1 ? 3 : 0))
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.save()
  const particles = fx > 1 ? 52 : 26
  for (let i = 0; i < particles; i += 1) {
    const px = ((i * 213) + (phase * (9 + (i % 5)))) % w
    const py = (((i * 127) % h) + (Math.sin((phase * 0.8) + i) * 14))
    fillCircle(ctx, px, py, 1.2 + ((i % 3) * 0.3), profile.particle, 0.25 + ((i % 4) * 0.09))
  }
  ctx.restore()

  if (fx > 1) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 3; i += 1) {
      const cx = w * (0.2 + (i * 0.28))
      const cy = h * (0.22 + (Math.sin((phase * 0.7) + i) * 0.06))
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.35)
      g.addColorStop(0, profile.sweep)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
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
  const profile = themeProfile.value
  const fx = fxIntensity.value
  const underwaterDetail = underwaterDetailProfile.value
  const phase = props.currentTime / 1_000_000

  const background = ctx.createRadialGradient(w * 0.2, h * 0.18, 0, w * 0.2, h * 0.18, Math.max(w, h))
  background.addColorStop(0, profile.bg[0])
  background.addColorStop(0.45, profile.bg[1])
  background.addColorStop(1, profile.bg[2])
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  if (fx > 1) {
    drawUnderwaterBackdrop(ctx, w, h, profile, phase, underwaterDetail)
  }

  drawThemeAmbient(ctx, w, h, profile, phase, fx)
  drawVisiblePackets(ctx, profile, phase, fx)

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
    drawNode(ctx, node, visual, profile, phase, fx)
  }

  if (fx > 1) {
    drawBetaTelemetry(ctx, w, h, profile, phase)
  }

  ctx.save()
  ctx.fillStyle = profile.label
  ctx.font = '12px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(`time: ${(props.currentTime / 1000).toFixed(1)} ms`, 18, 22)
  if (props.visiblePackets.length === 1) {
    ctx.fillStyle = profile.idleInner
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
  () => [props.currentTime, props.nodes, props.nodeVisuals, props.visiblePackets, props.themeKey, props.fxLevel, props.underwaterDetail],
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
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 26%, transparent);
  background: color-mix(in srgb, var(--card, #0b1a2d) 86%, #020617 14%);
  backdrop-filter: blur(6px);
  color: var(--accent-soft, #dbeafe);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 130ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 160ms ease;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 5px 14px rgba(2, 8, 20, 0.26);
}

.canvas-audio-toggle {
  position: absolute;
  z-index: 4;
  top: 12px;
  right: 56px;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 26%, transparent);
  background: color-mix(in srgb, var(--card, #0b1a2d) 86%, #020617 14%);
  backdrop-filter: blur(6px);
  color: var(--accent-soft, #dbeafe);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 130ms ease, box-shadow 180ms ease, border-color 180ms ease, filter 160ms ease;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 5px 14px rgba(2, 8, 20, 0.26);
}

.canvas-reset-view:hover,
.canvas-audio-toggle:hover {
  border-color: color-mix(in srgb, var(--accent-soft, #93c5fd) 48%, transparent);
  filter: brightness(1.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 18px color-mix(in srgb, var(--accent, #38bdf8) 22%, transparent);
}

.canvas-reset-view:active,
.canvas-audio-toggle:active {
  transform: translateY(1.5px) scale(0.96);
  box-shadow:
    inset 0 3px 9px rgba(2, 8, 20, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 2px 6px rgba(2, 8, 20, 0.22);
}

.canvas-audio-toggle svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 1.8;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
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
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 24%, transparent);
  background: color-mix(in srgb, var(--card, #0b1a2d) 90%, #020617 10%);
  backdrop-filter: blur(6px);
}

.toolbar-group-history {
  border-color: color-mix(in srgb, var(--warn, #f59e0b) 30%, transparent);
  background: color-mix(in srgb, var(--card, #0b1a2d) 92%, #020617 8%);
}

.toolbar-btn {
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 28%, transparent);
  color: var(--text, #e2e8f0);
  background: linear-gradient(180deg, color-mix(in srgb, var(--btn-top, #1c2a46) 92%, transparent), color-mix(in srgb, var(--btn-bottom, #151f34) 94%, transparent));
  padding: 0.3rem 0.68rem;
  font-size: 0.76rem;
  cursor: pointer;
  font-family: inherit;
  transition: transform 120ms ease, box-shadow 170ms ease, border-color 180ms ease, filter 150ms ease;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 4px 10px rgba(2, 8, 20, 0.23);
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
  border-color: color-mix(in srgb, var(--accent, #38bdf8) 68%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent, #38bdf8) 26%, transparent) inset;
  color: #f8fafc;
}

.toolbar-btn:hover:not(:disabled) {
  filter: brightness(1.07);
  border-color: color-mix(in srgb, var(--accent-soft, #93c5fd) 44%, transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 7px 14px color-mix(in srgb, var(--accent, #38bdf8) 18%, transparent);
}

.toolbar-btn:active:not(:disabled) {
  transform: translateY(1.2px) scale(0.97);
  box-shadow:
    inset 0 3px 8px rgba(2, 8, 20, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 2px 6px rgba(2, 8, 20, 0.2);
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
  color: var(--accent-soft, #93c5fd);
  font-size: 0.75rem;
  white-space: nowrap;
}

.node-tooltip {
  position: absolute;
  transform: translate(16px, -50%);
  z-index: 2;
  background: color-mix(in srgb, var(--card, #0b1a2d) 94%, #020617 6%);
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 26%, transparent);
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
