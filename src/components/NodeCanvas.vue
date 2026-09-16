<template>
  <div
    ref="containerEl"
    class="canvas-host"
    :class="{ 'canvas-host-edit': editMode }"
    @wheel.prevent="onWheel"
    @dragover.prevent="onDragOver"
    @drop.prevent="onDrop"
  >
    <div class="canvas-toolbar" @pointerdown.stop @contextmenu.prevent="cancelActiveTool">
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: toolMode === 'measure' }"
          @click="activateMeasureTool"
        >
          测距工具
        </button>
        <button
          v-if="allowPlaceNode"
          class="toolbar-btn"
          :class="{ active: toolMode === 'place' }"
          @click="activatePlaceTool"
        >
          添加
        </button>


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
      @pointerup="onPointerUp"
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
      v-if="hoveredNodePos && hoveredNode && hoveredNodeStats"
      class="node-tooltip"
      :style="hoveredTooltipStyle"
    >
      <div class="node-tooltip-head">
        <p class="node-tooltip-title">
          {{ nodeTitle(hoveredNode) }}
          <span class="node-tooltip-role">{{ hoveredNode.role || 'relay' }}</span>
        </p>
        <span class="node-tooltip-chip">{{ hoveredNodeStats.modeLabel }}</span>
      </div>

      <div class="node-tooltip-grid">
        <p class="node-tooltip-item"><span>坐标</span><strong>x {{ hoveredNode.x.toFixed(2) }} / y {{ hoveredNode.y.toFixed(2) }} / z {{ Number(hoveredNode.z ?? 0).toFixed(2) }} m</strong></p>
        <p class="node-tooltip-item"><span>仿真时刻</span><strong>{{ (props.currentTime / 1000).toFixed(1) }} ms</strong></p>
        <p class="node-tooltip-item"><span>最近关联包</span><strong>{{ hoveredNodeStats.packetText }}</strong></p>
        <p class="node-tooltip-item"><span>活跃方向</span><strong>TX {{ hoveredNodeStats.txLinks }} / RX {{ hoveredNodeStats.rxLinks }}</strong></p>
      </div>

      <div class="node-tooltip-strip">
        <span class="tooltip-pill ok">接收成功 {{ hoveredNodeStats.okCount }}</span>
        <span class="tooltip-pill bad">rx-rx {{ hoveredNodeStats.collisionRxRxCount }}</span>
        <span class="tooltip-pill warn">rx-tx {{ hoveredNodeStats.collisionRxTxCount }}</span>
        <span class="tooltip-pill mute">失败 {{ hoveredNodeStats.failCount }}</span>
      </div>

      <div class="node-tooltip-grid node-tooltip-grid-compact">
        <p class="node-tooltip-item"><span>活跃包列表</span><strong>{{ hoveredNodeStats.packetListText }}</strong></p>
        <p class="node-tooltip-item"><span>冲突成因</span><strong>{{ hoveredNodeStats.reasonText }}</strong></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { THEME_PROFILES } from '@/features/canvas2d/lib/themes'
import {
  computeBounds,
  computeContentOrigin,
  computeScale,
  nodeRadiusFor,
  toScreenPoint,
  toWorldPoint,
  viewInsetsFor,
} from '@/features/canvas2d/lib/coordinate'
import {
  colorMix,
  fillCircle,
  strokeCircle,
} from '@/features/canvas2d/lib/draw/primitives'
import {
  drawCarrierNode,
  drawSubmarineNode,
} from '@/features/canvas2d/lib/draw/nodes'
import { drawPacketRect } from '@/features/canvas2d/lib/draw/packets'
import { drawWorldGrid } from '@/features/canvas2d/lib/draw/grid'
import { drawMeasurementLines as drawMeasureLinesView } from '@/features/canvas2d/lib/draw/measure'

const props = defineProps({
  nodes: { type: Array, required: true },
  nodeVisuals: { type: Array, required: true },
  visiblePackets: { type: Array, default: () => [] },
  currentTime: { type: Number, required: true },
  themeKey: { type: String, default: 'ocean-sonar' },
  fxLevel: { type: String, default: 'standard' },
  editMode: { type: Boolean, default: false },
  allowPlaceNode: { type: Boolean, default: false },
  boxSelect: { type: Boolean, default: false },
  originalPositions: { type: Array, default: () => [] },
  selectedNodeId: { type: [Number, String], default: null },
  selectedNodeIds: { type: Array, default: () => [] },
  soundSpeedMps: { type: Number, default: 1500 },
})

const TOOL_MODES = Object.freeze({
  PAN: 'pan',
  MEASURE: 'measure',
  PLACE: 'place',
  SELECT: 'select',
})


const themeProfile = computed(() => THEME_PROFILES[props.themeKey] || THEME_PROFILES['ocean-sonar'])
const fxIntensity = computed(() => {
  if (props.fxLevel === 'extreme') return 2.2
  return 1
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
const hoveredNodeId = ref(null)
const hoverCursor = ref({ x: 0, y: 0 })
const hoveredMeasureNode = ref(null)
const toolMode = ref(TOOL_MODES.PAN)
const pendingMeasurePoint = ref(null)
const measurementLines = ref([])
const measurementHistory = ref([[]])
const measurementHistoryIndex = ref(0)
const selectedMeasurementId = ref(null)
const viewInsets = computed(() => viewInsetsFor(displayWidth.value, displayHeight.value))
const nodeRadius = computed(() => nodeRadiusFor(Math.min(displayWidth.value, displayHeight.value)))
const emit = defineEmits([
  'node-select',
  'pause-request',
  'node-move',
  'node-move-end',
  'node-place',
  'selection-change',
  'nodes-move',
  'protocol-drop',
])
const draggingNodeId = ref(null)
const dragGroup = ref(null)
const marquee = ref(null)
const spaceHeld = ref(false)
const dragFrozenBounds = ref(null)
const sessionFrozenBounds = ref(null)
let resizeObserver = null
let activePointerId = null

const liveBounds = computed(() => computeBounds(props.nodes))
const bounds = computed(() => dragFrozenBounds.value || sessionFrozenBounds.value || liveBounds.value)

const scale = computed(() => computeScale(displayWidth.value, displayHeight.value, viewInsets.value, bounds.value))

const effectiveScale = computed(() => scale.value * zoom.value)

const contentOrigin = computed(() => computeContentOrigin(displayWidth.value, displayHeight.value, viewInsets.value, bounds.value, scale.value))

const projection = computed(() => ({
  bounds: bounds.value,
  origin: contentOrigin.value,
  scale: effectiveScale.value,
  pan: pan.value,
}))
const nodeVisualById = computed(() => new Map(props.nodeVisuals.map((visual) => [visual.node_id, visual])))
const nodeById = computed(() => new Map(props.nodes.map((node) => [node.node_id, node])))
const originalPoseById = computed(() => new Map((props.originalPositions || []).map((item) => [item.node_id, item])))

const selectedIdSet = computed(() => new Set((props.selectedNodeIds || []).map((id) => Number(id))))

const canvasCursorClass = computed(() => {
  if (toolMode.value === TOOL_MODES.MEASURE) {
    return hoveredMeasureNode.value ? 'canvas-measure-hover' : 'canvas-measure'
  }
  if (toolMode.value === TOOL_MODES.PLACE) {
    return hoveredNodeId.value != null ? 'canvas-edit-hover' : 'canvas-place'
  }
  if (marquee.value) return 'canvas-marquee'
  if (props.editMode) {
    if (draggingNodeId.value || dragGroup.value) return 'canvas-edit-dragging'
    if (hoveredNodeId.value != null) return 'canvas-edit-hover'
    return 'canvas-edit'
  }
  return ''
})

const toScreen = (x, y) => toScreenPoint(x, y, projection.value)

const toWorld = (x, y) => toWorldPoint(x, y, projection.value)

const pickNodeAt = (sx, sy) => {
  let picked = null
  let bestDist = Number.POSITIVE_INFINITY
  const hit = nodeRadius.value + 4
  const thresholdSq = hit * hit

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

const hoveredNode = computed(() => {
  if (!hoveredNodeId.value) return null
  return nodeById.value.get(hoveredNodeId.value) || null
})

const hoveredNodePos = computed(() => {
  if (!hoveredNode.value) return null
  return toScreen(hoveredNode.value.x, hoveredNode.value.y)
})

const hoveredNodeVisual = computed(() => {
  if (!hoveredNode.value) return null
  return nodeVisualById.value.get(hoveredNode.value.node_id) || null
})

const nodeLabel = (node) => `Node ${node.node_id}`
const nodeTitle = (node) => node.name ? `${nodeLabel(node)} · ${node.name}` : nodeLabel(node)

const hoveredNodeStats = computed(() => {
  const node = hoveredNode.value
  if (!node) return null
  const visual = hoveredNodeVisual.value

  let txLinks = 0
  let rxLinks = 0
  let okCount = 0
  let collisionRxRxCount = 0
  let collisionRxTxCount = 0
  let failCount = 0
  const packetIds = new Set()
  const reasonSet = new Set()

  for (const packet of props.visiblePackets) {
    if (packet.src === node.node_id) {
      txLinks += packet.receivers.length
      packetIds.add(packet.packet_id)
    }
    for (const receiver of packet.receivers) {
      if (receiver.dst !== node.node_id) continue
      rxLinks += 1
      packetIds.add(packet.packet_id)
      if (receiver.status === 'ok') okCount += 1
      else {
        failCount += 1
        if (receiver.reason === 'collision_rx_rx') collisionRxRxCount += 1
        else if (receiver.reason === 'collision_rx_tx') collisionRxTxCount += 1
        if (receiver.reason) reasonSet.add(receiver.reason)
      }
    }
  }

  const modeLabelMap = {
    idle: 'IDLE',
    tx: 'TX',
    rx: 'RX',
    'rx-done': 'RX-DONE',
    collision: 'COLLISION',
    'collision-linger': 'COLLISION',
  }

  const packetList = [...packetIds]
  const reasonText = reasonSet.size ? [...reasonSet].join(' / ') : '无'
  return {
    modeLabel: modeLabelMap[visual?.mode] || 'IDLE',
    packetText: visual?.packetId || '无',
    txLinks,
    rxLinks,
    okCount,
    collisionRxRxCount,
    collisionRxTxCount,
    failCount,
    packetListText: packetList.length ? packetList.join(', ') : '无',
    reasonText,
  }
})

const hoveredTooltipStyle = computed(() => {
  if (!hoveredNodePos.value) return null
  const compact = displayWidth.value < 720 || displayHeight.value < 520
  const estimatedWidth = compact ? 280 : 360
  const estimatedHeight = compact ? 180 : 210
  const margin = 8
  const gap = 16
  const cursorX = hoverCursor.value.x
  const cursorY = hoverCursor.value.y
  let x = cursorX + gap
  let y = cursorY - (estimatedHeight * 0.46)

  if (x + estimatedWidth > (displayWidth.value - margin)) {
    x = cursorX - estimatedWidth - gap
  }
  if (x < margin) {
    x = margin
  }
  if (y + estimatedHeight > (displayHeight.value - margin)) {
    y = displayHeight.value - estimatedHeight - margin
  }
  if (y < margin) {
    y = margin
  }

  return {
    left: `${x}px`,
    top: `${y}px`,
  }
})

const canUndo = computed(() => measurementHistoryIndex.value > 0)
const canRedo = computed(() => measurementHistoryIndex.value < (measurementHistory.value.length - 1))

const cloneMeasurePoint = (point) => ({
  x: point.x,
  y: point.y,
  ...(Number.isFinite(point.z) ? { z: point.z } : {}),
  ...(point.nodeId !== undefined && point.nodeId !== null ? { nodeId: point.nodeId } : {}),
})

const resolveMeasurePoint = (point) => {
  if (!point) return { x: 0, y: 0, z: 0 }
  if (point.nodeId !== undefined && point.nodeId !== null) {
    const node = nodeById.value.get(point.nodeId)
    if (node) {
      return {
        x: node.x,
        y: node.y,
        z: node.z ?? 0,
      }
    }
  }
  return {
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
  }
}

const createMeasurePoint = (sx, sy) => {
  const picked = pickNodeAt(sx, sy)
  if (picked) {
    return {
      nodeId: picked.node_id,
      x: picked.x,
      y: picked.y,
      z: picked.z ?? 0,
    }
  }
  return toWorld(sx, sy)
}

const distanceByMeasurePoints = (a, b) => {
  const p1 = resolveMeasurePoint(a)
  const p2 = resolveMeasurePoint(b)
  return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z)
}

const cloneMeasurements = (items) => items.map((item) => ({
  id: item.id,
  start: cloneMeasurePoint(item.start),
  end: cloneMeasurePoint(item.end),
  distance: distanceByMeasurePoints(item.start, item.end),
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
    const start = resolveMeasurePoint(item.start)
    const end = resolveMeasurePoint(item.end)
    const a = toScreen(start.x, start.y)
    const b = toScreen(end.x, end.y)
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

const drawVisiblePackets = (ctx, profile, phase, fx) => {
  const now = props.currentTime
  for (const packet of props.visiblePackets) {
    for (const receiver of packet.receivers) {
      if (now < packet.tx_start_us || now > receiver.rx_end_us) continue
      const srcNode = nodeById.value.get(packet.src)
      const dstNode = nodeById.value.get(receiver.dst)
      if (!srcNode || !dstNode) continue
      drawPacketRect(
        ctx,
        { src: toScreen(srcNode.x, srcNode.y), dst: toScreen(dstNode.x, dstNode.y) },
        packet,
        receiver,
        now,
        profile,
        phase,
        fx,
      )
    }
  }
}

const paintMeasurements = (ctx) => {
  const lines = measurementLines.value.map((item) => {
    const start = resolveMeasurePoint(item.start)
    const end = resolveMeasurePoint(item.end)
    return {
      id: item.id,
      start: toScreen(start.x, start.y),
      end: toScreen(end.x, end.y),
      distanceText: `${distanceByMeasurePoints(item.start, item.end).toFixed(0)} m`,
      isSelected: selectedMeasurementId.value === item.id,
    }
  })
  let pendingPoint = null
  if (toolMode.value === TOOL_MODES.MEASURE && pendingMeasurePoint.value) {
    const pending = resolveMeasurePoint(pendingMeasurePoint.value)
    pendingPoint = toScreen(pending.x, pending.y)
  }
  drawMeasureLinesView(ctx, lines, pendingPoint, displayWidth.value, displayHeight.value)
}

const drawNode = (ctx, node, visual, profile, phase, fx) => {
  const p = toScreen(node.x, node.y)
  const r = nodeRadius.value
  const idleGradient = ctx.createRadialGradient(p.x - 5, p.y - 6, 2, p.x, p.y, r + 6)
  idleGradient.addColorStop(0, profile.idleInner)
  idleGradient.addColorStop(1, profile.idleOuter)

  const isSink = node.role === 'sink' || /sink/i.test(String(node.name || ''))
  fillCircle(ctx, p.x, p.y, r, idleGradient, 0.92)
  strokeCircle(ctx, p.x, p.y, r, profile.nodeStroke, 1.4, 0.9)

  const pulse = 0.5 + (Math.sin((phase * (4.2 + (fx * 0.8))) + (node.node_id * 0.6)) * 0.5)
  strokeCircle(ctx, p.x, p.y, r + 4 + (pulse * 3), profile.ring, 1, 0.35 + (pulse * 0.3))
  if (fx > 1) {
    strokeCircle(ctx, p.x, p.y, r + 10 + (pulse * 6), profile.ring, 1.2, 0.3)
  }

  if (visual.mode === 'tx') {
    const progressRadius = 3 + ((r - 3) * visual.fillProgress)
    fillCircle(ctx, p.x, p.y, progressRadius, profile.tx, 0.98)
    strokeCircle(ctx, p.x, p.y, r + 8 + (pulse * 5), profile.tx, 1.2, 0.35)

    if (visual.overlay?.kind === 'collision_rx_tx') {
      fillCircle(ctx, p.x, p.y, r * 0.8, profile.bad, 0.78)
    }
  } else if (visual.mode === 'rx' || visual.mode === 'rx-done') {
    const progressRadius = visual.mode === 'rx-done'
      ? r
      : 3 + ((r - 3) * visual.fillProgress)
    fillCircle(ctx, p.x, p.y, progressRadius, profile.rx, visual.fade ?? 1)
    strokeCircle(ctx, p.x, p.y, r + 7 + (pulse * 4), profile.rx, 1, 0.28)
  } else if (visual.mode === 'collision' || visual.mode === 'collision-linger') {
    fillCircle(ctx, p.x, p.y, r, profile.bad, visual.fade ?? 1)
    strokeCircle(ctx, p.x, p.y, r + 10 + (pulse * 4), profile.bad, 1.6, 0.5)
    if (fx > 1) {
      for (let i = 0; i < 3; i += 1) {
        const rr = r + 13 + (i * 7) + (((phase * 42) + (i * 8)) % 10)
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
  const labelOffset = fx > 1 ? r + 14 : r + 10
  ctx.fillText(node.name, p.x + labelOffset, p.y + 2)
  ctx.fillStyle = profile.depth
  ctx.font = '10px "IBM Plex Sans", "Segoe UI", sans-serif'
  ctx.fillText(`z ${Number(node.z ?? 0).toFixed(2)}m`, p.x + labelOffset, p.y + 16)
  ctx.restore()
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
  const phase = props.currentTime / 1_000_000

  const background = ctx.createRadialGradient(w * 0.2, h * 0.18, 0, w * 0.2, h * 0.18, Math.max(w, h))
  background.addColorStop(0, profile.bg[0])
  background.addColorStop(0.45, profile.bg[1])
  background.addColorStop(1, profile.bg[2])
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)
  drawWorldGrid(ctx, w, h, projection.value)

  drawVisiblePackets(ctx, profile, phase, fx)

  if (props.editMode && props.originalPositions.length) {
    ctx.save()
    ctx.lineCap = 'butt'
    ctx.setLineDash([11, 5])
    ctx.lineWidth = 1.7
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.78)'
    for (const original of props.originalPositions) {
      const current = nodeById.value.get(original.node_id)
      const from = toScreen(original.x, original.y)
      ctx.beginPath()
      ctx.arc(from.x, from.y, 8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)'
      ctx.fill()
      ctx.stroke()
      if (!current) continue
      const to = toScreen(current.x, current.y)
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
    ctx.restore()
  }

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
    const selected = selectedIdSet.value.has(Number(node.node_id)) || props.selectedNodeId === node.node_id
    if (props.editMode && selected) {
      const p = toScreen(node.x, node.y)
      strokeCircle(ctx, p.x, p.y, 22, profile.idleInner, 2.1, 0.95)
    }
  }

  if (marquee.value) {
    const x = Math.min(marquee.value.x0, marquee.value.x1)
    const y = Math.min(marquee.value.y0, marquee.value.y1)
    const wBox = Math.abs(marquee.value.x1 - marquee.value.x0)
    const hBox = Math.abs(marquee.value.y1 - marquee.value.y0)
    ctx.save()
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)'
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([5, 4])
    ctx.fillRect(x, y, wBox, hBox)
    ctx.strokeRect(x, y, wBox, hBox)
    ctx.restore()
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

  paintMeasurements(ctx)
}

const nodesInMarquee = (box) => {
  const left = Math.min(box.x0, box.x1)
  const right = Math.max(box.x0, box.x1)
  const top = Math.min(box.y0, box.y1)
  const bottom = Math.max(box.y0, box.y1)
  return props.nodes.filter((node) => {
    const p = toScreen(node.x, node.y)
    return p.x >= left && p.x <= right && p.y >= top && p.y <= bottom
  })
}

const onPointerDown = (event) => {
  if (event.button !== undefined && event.button !== 0 && event.button !== 1) return

  const canvas = canvasEl.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top

  if (event.button === 1 || (spaceHeld.value && toolMode.value !== TOOL_MODES.MEASURE && toolMode.value !== TOOL_MODES.PLACE)) {
    activePointerId = event.pointerId
    isPanning.value = true
    hoveredNodeId.value = null
    panStart.value = { x: sx, y: sy }
    panOffsetStart.value = { ...pan.value }
    hasDragged.value = false
    try {
      canvas.setPointerCapture(event.pointerId)
    } catch {
      // ignore
    }
    return
  }

  if (toolMode.value === TOOL_MODES.MEASURE) {
    event.preventDefault()
    event.stopImmediatePropagation()
    const point = createMeasurePoint(sx, sy)

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
      distance: distanceByMeasurePoints(point, pendingMeasurePoint.value),
    }
    commitMeasurementState([...measurementLines.value, nextMeasurement], nextMeasurement.id)
    pendingMeasurePoint.value = null
    requestAnimationFrame(draw)
    return
  }

  if (props.editMode && toolMode.value === TOOL_MODES.PLACE) {
    const target = pickNodeAt(sx, sy)
    if (target) {
      event.preventDefault()
      draggingNodeId.value = target.node_id
      dragFrozenBounds.value = { ...liveBounds.value }
      activePointerId = event.pointerId
      hasDragged.value = false
      panStart.value = { x: sx, y: sy }
      emit('node-select', target)
      emit('pause-request')
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
      requestAnimationFrame(draw)
      return
    }
    const world = toWorld(sx, sy)
    emit('node-place', { x: world.x, y: world.y })
    emit('pause-request')
    return
  }

  const forcePan = spaceHeld.value || event.button === 1 || (props.boxSelect && toolMode.value === TOOL_MODES.PAN)

  if (props.editMode && toolMode.value !== TOOL_MODES.MEASURE && !forcePan) {
    const target = pickNodeAt(sx, sy)
    if (target) {
      event.preventDefault()
      const clickedId = Number(target.node_id)
      const currentIds = [...selectedIdSet.value]
      let nextIds
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        nextIds = currentIds.includes(clickedId)
          ? currentIds.filter((id) => id !== clickedId)
          : [...currentIds, clickedId]
      } else if (currentIds.includes(clickedId)) {
        nextIds = currentIds
      } else {
        nextIds = [clickedId]
      }
      emit('selection-change', nextIds)
      emit('node-select', target)
      const origins = new Map()
      for (const node of props.nodes) {
        if (nextIds.includes(Number(node.node_id))) {
          origins.set(Number(node.node_id), { x: node.x, y: node.y })
        }
      }
      dragGroup.value = {
        ids: nextIds,
        start: toWorld(sx, sy),
        origins,
      }
      draggingNodeId.value = target.node_id
      dragFrozenBounds.value = { ...liveBounds.value }
      activePointerId = event.pointerId
      hasDragged.value = false
      panStart.value = { x: sx, y: sy }
      emit('pause-request')
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
      requestAnimationFrame(draw)
      return
    }

    if (props.boxSelect && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      marquee.value = {
        x0: sx,
        y0: sy,
        x1: sx,
        y1: sy,
        additive: event.shiftKey && (event.ctrlKey || event.metaKey),
      }
      activePointerId = event.pointerId
      hasDragged.value = false
      emit('pause-request')
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
      requestAnimationFrame(draw)
      return
    }
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
  hoveredNodeId.value = null
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
  const canvas = canvasEl.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  if (marquee.value) {
    if ((x - marquee.value.x0) ** 2 + (y - marquee.value.y0) ** 2 > 16) hasDragged.value = true
    marquee.value = { ...marquee.value, x1: x, y1: y }
    requestAnimationFrame(draw)
    return
  }

  if (dragGroup.value) {
    if ((x - panStart.value.x) ** 2 + (y - panStart.value.y) ** 2 > 16 || hasDragged.value) {
      hasDragged.value = true
    }
    const world = toWorld(x, y)
    const dx = world.x - dragGroup.value.start.x
    const dy = world.y - dragGroup.value.start.y
    const moves = [...dragGroup.value.origins.entries()].map(([nodeId, origin]) => ({
      node_id: nodeId,
      x: origin.x + dx,
      y: origin.y + dy,
    }))
    emit('nodes-move', moves)
    if (moves.length === 1) {
      emit('node-move', moves[0])
    }
    requestAnimationFrame(draw)
    return
  }

  if (draggingNodeId.value != null) {
    if ((x - panStart.value.x) ** 2 + (y - panStart.value.y) ** 2 > 16 || hasDragged.value) {
      hasDragged.value = true
    }
    const world = toWorld(x, y)
    emit('node-move', {
      node_id: draggingNodeId.value,
      x: world.x,
      y: world.y,
    })
    requestAnimationFrame(draw)
    return
  }

  if (!isPanning.value) return

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

const updateHoveredNode = (sx, sy) => {
  if (isPanning.value) {
    hoveredNodeId.value = null
    return
  }
  const picked = pickNodeAt(sx, sy)
  hoveredNodeId.value = picked ? picked.node_id : null
}

const onCanvasPointerMove = (event) => {
  const canvas = canvasEl.value
  if (!canvas) return

  if (marquee.value || dragGroup.value || draggingNodeId.value != null) {
    onPointerMove(event)
    return
  }

  const rect = canvas.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top
  hoverCursor.value = { x: sx, y: sy }
  updateMeasureHover(sx, sy)
  updateHoveredNode(sx, sy)
  if (toolMode.value === TOOL_MODES.MEASURE) {
    requestAnimationFrame(draw)
  }
}

const onCanvasPointerLeave = () => {
  hoveredNodeId.value = null
  hoverCursor.value = { x: 0, y: 0 }
  if (toolMode.value === TOOL_MODES.MEASURE) {
    hoveredMeasureNode.value = null
    requestAnimationFrame(draw)
  }
}

const onPointerUp = (event) => {
  if (marquee.value) {
    const box = marquee.value
    const picked = nodesInMarquee(box).map((node) => Number(node.node_id))
    let nextIds
    if (!hasDragged.value) {
      nextIds = []
    } else if (box.additive) {
      nextIds = [...new Set([...selectedIdSet.value, ...picked])]
    } else {
      nextIds = picked
    }
    emit('selection-change', nextIds)
    if (nextIds.length === 1) {
      const node = props.nodes.find((item) => Number(item.node_id) === nextIds[0])
      if (node) emit('node-select', node)
    }
    marquee.value = null
    if (canvasEl.value && activePointerId !== null) {
      try {
        canvasEl.value.releasePointerCapture(activePointerId)
      } catch {
        // ignore
      }
    }
    activePointerId = null
    requestAnimationFrame(draw)
    return
  }

  if (dragGroup.value || draggingNodeId.value != null) {
    emit('node-move-end')
    dragGroup.value = null
    draggingNodeId.value = null
    dragFrozenBounds.value = null
    if (canvasEl.value && activePointerId !== null) {
      try {
        canvasEl.value.releasePointerCapture(activePointerId)
      } catch {
        // ignore
      }
    }
    activePointerId = null
    requestAnimationFrame(draw)
    return
  }

  if (!isPanning.value) return

  if (!hasDragged.value && event) {
    const canvas = canvasEl.value
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const target = pickNodeAt(x, y)
      if (target) {
        emit('node-select', target)
      }
    }
  }

  isPanning.value = false
  if (event && canvasEl.value) {
    const rect = canvasEl.value.getBoundingClientRect()
    updateHoveredNode(event.clientX - rect.left, event.clientY - rect.top)
  }
  if (canvasEl.value && activePointerId !== null) {
    try {
      canvasEl.value.releasePointerCapture(activePointerId)
    } catch {
      // ignore
    }
  }
  activePointerId = null
}

const onDragOver = (event) => {
  if (!props.boxSelect && !props.editMode) return
  event.dataTransfer.dropEffect = 'copy'
}

const onDrop = (event) => {
  const raw = event.dataTransfer?.getData('application/x-aqua-item')
    || event.dataTransfer?.getData('application/x-aqua-mac')
    || event.dataTransfer?.getData('text/plain')
  if (!raw) return
  let payload = raw
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = { layer: 'mac', id: raw, typeId: raw, field: 'macId', scope: 'node' }
  }
  const canvas = canvasEl.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top
  const target = pickNodeAt(sx, sy)
  emit('protocol-drop', {
    ...payload,
    macId: payload.id || payload.macId,
    nodeId: target ? Number(target.node_id) : null,
  })
}

const activatePlaceTool = () => {
  if (toolMode.value === TOOL_MODES.PLACE) {
    toolMode.value = TOOL_MODES.PAN
    requestAnimationFrame(draw)
    return
  }
  toolMode.value = TOOL_MODES.PLACE
  pendingMeasurePoint.value = null
  requestAnimationFrame(draw)
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
  hoveredNodeId.value = null
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
  const zoomFactor = Math.exp(-event.deltaY * 0.0015)
  const nextZoom = Math.max(0.25, Math.min(4, beforeZoom * zoomFactor))
  if (nextZoom === beforeZoom) return

  const anchorWorld = toWorld(cx, cy)
  zoom.value = nextZoom

  requestAnimationFrame(() => {
    const base = bounds.value
    const s = effectiveScale.value
    const origin = contentOrigin.value
    pan.value = {
      x: cx - ((anchorWorld.x - base.minX) * s) - origin.x,
      y: cy - ((base.maxY - anchorWorld.y) * s) - origin.y,
    }
    requestAnimationFrame(draw)
  })
}

const updateViewport = () => {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  displayWidth.value = Math.max(160, rect.width - 2)
  displayHeight.value = Math.max(120, Math.round((rect.height || 0) - 2))
  requestAnimationFrame(draw)
}

watch(
  () => [props.currentTime, props.nodes, props.nodeVisuals, props.visiblePackets, props.themeKey, props.fxLevel, props.editMode, props.originalPositions, props.selectedNodeId, props.selectedNodeIds],
  () => {
    requestAnimationFrame(draw)
  },
  { deep: true, immediate: true },
)

watch(() => [props.editMode, props.allowPlaceNode], ([editable, allowPlace]) => {
  if (!editable || !allowPlace) {
    if (toolMode.value === TOOL_MODES.PLACE) {
      toolMode.value = props.boxSelect ? TOOL_MODES.SELECT : TOOL_MODES.PAN
    }
  }
})

watch(() => props.boxSelect, (enabled) => {
  if (enabled && (toolMode.value === TOOL_MODES.PAN || !toolMode.value)) {
    toolMode.value = TOOL_MODES.SELECT
  }
  if (!enabled && toolMode.value === TOOL_MODES.SELECT) {
    toolMode.value = TOOL_MODES.PAN
  }
}, { immediate: true })

watch(() => props.editMode, async (next) => {
  draggingNodeId.value = null
  dragFrozenBounds.value = null
  if (!next) {
    sessionFrozenBounds.value = null
    return
  }
  await nextTick()
  sessionFrozenBounds.value = { ...liveBounds.value }
})

const onKeyDown = (event) => {
  if (event.code !== 'Space') return
  if (event.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(event.target.tagName)) return
  event.preventDefault()
  spaceHeld.value = true
}

const onKeyUp = (event) => {
  if (event.code === 'Space') spaceHeld.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
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
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
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

.canvas-host-edit {
  box-shadow: none;
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

.canvas-reset-view:hover {
  border-color: color-mix(in srgb, var(--accent-soft, #93c5fd) 48%, transparent);
  filter: brightness(1.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 18px color-mix(in srgb, var(--accent, #38bdf8) 22%, transparent);
}

.canvas-reset-view:active {
  transform: translateY(1.5px) scale(0.96);
  box-shadow:
    inset 0 3px 9px rgba(2, 8, 20, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 2px 6px rgba(2, 8, 20, 0.22);
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
  z-index: 5;
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--card, #0b1a2d) 86%, #020617 14%), color-mix(in srgb, var(--card, #0b1a2d) 94%, #020617 6%)),
    repeating-linear-gradient(120deg, rgba(148, 230, 255, 0.06) 0 2px, transparent 2px 12px);
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 36%, transparent);
  border-radius: 12px;
  padding: 0.55rem 0.65rem;
  width: min(360px, calc(100% - 16px));
  max-width: min(360px, calc(100vw - 18px));
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.42),
    0 0 22px color-mix(in srgb, var(--accent, #38bdf8) 24%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--accent-soft, #93c5fd) 16%, transparent);
  pointer-events: none;
  backdrop-filter: blur(8px) saturate(1.08);
  animation: tooltip-pop 140ms ease-out;
}

.node-tooltip::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(110deg, transparent 0%, rgba(125, 211, 252, 0.16) 45%, transparent 72%);
  background-size: 230% 100%;
  animation: tooltip-sheen 2.3s linear infinite;
}

.node-tooltip-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.node-tooltip-title {
  margin: 0;
  font-size: 0.88rem;
  color: #e2e8f0;
  font-weight: 700;
  line-height: 1.2;
}

.node-tooltip-role {
  color: color-mix(in srgb, var(--accent-soft, #93c5fd) 88%, #ffffff 12%);
  margin-left: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.node-tooltip-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 50%, transparent);
  padding: 0.12rem 0.5rem;
  font-size: 0.68rem;
  color: #dbeafe;
  background: color-mix(in srgb, var(--accent, #38bdf8) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-soft, #93c5fd) 16%, transparent);
}

.node-tooltip-grid {
  position: relative;
  z-index: 1;
  margin-top: 0.45rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 0.45rem;
}

.node-tooltip-grid-compact {
  margin-top: 0.48rem;
}

.node-tooltip-item {
  margin: 0;
  min-width: 0;
  display: grid;
  gap: 0.08rem;
}

.node-tooltip-item span {
  color: color-mix(in srgb, var(--accent-soft, #93c5fd) 76%, #ffffff 24%);
  font-size: 0.67rem;
  letter-spacing: 0.03em;
}

.node-tooltip-item strong {
  color: #e2e8f0;
  font-size: 0.74rem;
  line-height: 1.22;
  word-break: break-word;
  font-weight: 600;
}

.node-tooltip-strip {
  position: relative;
  z-index: 1;
  margin-top: 0.45rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.34rem;
}

.tooltip-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.1rem 0.44rem;
  font-size: 0.66rem;
  border: 1px solid rgba(148, 163, 184, 0.38);
  color: #dbeafe;
}

.tooltip-pill.ok {
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.15);
  color: #bbf7d0;
}

.tooltip-pill.bad {
  border-color: rgba(239, 68, 68, 0.48);
  background: rgba(239, 68, 68, 0.14);
  color: #fecaca;
}

.tooltip-pill.warn {
  border-color: rgba(249, 115, 22, 0.48);
  background: rgba(249, 115, 22, 0.14);
  color: #fed7aa;
}

.tooltip-pill.mute {
  border-color: rgba(148, 163, 184, 0.44);
  background: rgba(148, 163, 184, 0.12);
  color: #dbeafe;
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

.canvas-edit {
  cursor: grab;
}

.canvas-place {
  cursor: copy;
}

.canvas-select {
  cursor: crosshair;
}

.canvas-marquee {
  cursor: crosshair;
}

.canvas-edit-hover {
  cursor: grab;
}

.canvas-edit-dragging {
  cursor: grabbing;
}

.canvas-measure-hover {
  cursor: pointer;
}

.canvas:active {
  cursor: grabbing;
}

@keyframes tooltip-pop {
  from {
    opacity: 0;
    transform: scale(0.985);
    filter: brightness(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
    filter: brightness(1);
  }
}

@keyframes tooltip-sheen {
  0% {
    background-position: -120% 0;
  }
  100% {
    background-position: 180% 0;
  }
}

@media (max-width: 1680px), (max-height: 980px) {
  .canvas-toolbar {
    bottom: 8px;
    left: 8px;
    gap: 0.3rem;
  }

  .toolbar-group {
    padding: 0.28rem 0.38rem;
    gap: 0.32rem;
    border-radius: 10px;
  }

  .toolbar-btn {
    padding: 0.22rem 0.5rem;
    font-size: 0.7rem;
  }

  .toolbar-btn-icon {
    width: 28px;
    height: 28px;
  }

  .toolbar-help {
    font-size: 0.68rem;
  }

  .canvas-reset-view {
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
  }

  .node-tooltip {
    width: min(280px, calc(100% - 16px));
    max-width: min(280px, calc(100vw - 16px));
    padding: 0.4rem 0.5rem;
  }

  .node-tooltip-grid {
    margin-top: 0.3rem;
    gap: 0.22rem 0.32rem;
  }
}
</style>
