<template>
  <div
    ref="containerEl"
    class="canvas-host"
    :class="{ 'canvas-host-edit': editMode }"
    :style="{ background: hostBackground }"
    @wheel.prevent="onWheel"
    @dragover.prevent="onDragOver"
    @drop.prevent="onDrop"
  >
    <div class="canvas-toolbar" :class="{ 'zoom-open': zoomPanelOpen }" @pointerdown.stop @contextmenu.prevent="cancelActiveTool">
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          :class="{ active: toolMode === 'measure' }"
          title="测量节点间距离，Esc 取消"
          @click="activateMeasureTool"
        >
          测距工具
        </button>
      </div>

      <div ref="zoomControlEl" class="toolbar-group toolbar-zoom" @wheel.stop>
        <button class="toolbar-btn" :class="{ active: zoomPanelOpen }" :aria-expanded="zoomPanelOpen"
          aria-haspopup="dialog" @click="zoomPanelOpen = !zoomPanelOpen">缩放调节</button>
        <Transition name="zoom-pop">
        <div v-if="zoomPanelOpen" class="zoom-panel" role="dialog" aria-label="缩放设置">
          <label class="zoom-column">
            <span>画布</span>
            <input v-model.number="canvasZoomPosition" class="zoom-range" type="range" min="0" max="100" step="0.1"
              aria-label="画布缩放" :aria-valuetext="`每格 ${scaleBar.label}`" />
            <output>{{ scaleBar.label }}</output>
          </label>
          <label class="zoom-column">
            <span>节点</span>
            <input v-model.number="nodeSizeScale" class="zoom-range" type="range" :min="NODE_SIZE_MIN" :max="NODE_SIZE_MAX"
              :step="NODE_SIZE_STEP" aria-label="节点大小" />
            <output>{{ nodeSizeScale.toFixed(1) }}×</output>
          </label>
        </div>
        </Transition>
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
        <button class="toolbar-btn toolbar-btn-icon" @click="resetView" title="回到默认位置" aria-label="回到默认位置">
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
      </div>
      <div class="canvas-scale" role="img" :aria-label="`比例尺 ${scaleBar.label}`" :style="{ width: `${scaleBar.width}px` }">
        <span>{{ scaleBar.label }}</span>
        <span class="canvas-scale-line" aria-hidden="true"></span>
      </div>
    </div>

    <canvas
      ref="canvasEl"
      class="canvas"
      :class="canvasCursorClass"
      :aria-label="`acoustic-node-canvas-${Math.round(displayWidth)}x${Math.round(displayHeight)}`"
      @pointerdown="onCanvasPointerDown"
      @pointermove="onCanvasPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onCanvasPointerLeave"
      @contextmenu="onCanvasContextMenu"
    />

    <form
      v-if="contextMenu"
      ref="contextMenuEl"
      class="node-context-menu"
      role="dialog"
      aria-label="添加节点"
      :style="{ left: `${contextMenu.left}px`, top: `${contextMenu.top}px` }"
      @submit.prevent="addNodeFromContext"
      @contextmenu.prevent.stop
    >
      <div class="node-context-head">
        <strong>添加节点</strong>
        <button type="button" class="node-card-close" aria-label="关闭添加节点菜单" @click="closeContextMenu">×</button>
      </div>
      <div class="node-context-coords">
        <label class="field field-compact"><span>X (m)</span><input ref="contextXEl" v-model="contextMenu.x" class="select" type="number" step="0.01" required /></label>
        <label class="field field-compact"><span>Y (m)</span><input v-model="contextMenu.y" class="select" type="number" step="0.01" required /></label>
        <label class="field field-compact"><span>Z (m)</span><input v-model="contextMenu.z" class="select" type="number" step="0.01" required /></label>
      </div>
      <button type="submit" class="btn primary node-context-add">添加节点</button>
    </form>

    <div
      v-if="hoveredNodePos && hoveredNode && hoveredNodeStats"
      ref="nodeCardEl"
      class="node-tooltip"
      role="dialog"
      :aria-label="`节点 ${hoveredNode.node_id} 详情`"
      :data-pinned="card.pinned.value"
      :style="{ ...hoveredTooltipStyle, maxHeight: `${displayHeight - 16}px` }"
      @pointerdown.stop
      @wheel.stop
      @dragover.stop
      @drop.stop
    >
      <div class="node-tooltip-head">
        <p class="node-tooltip-title">
          {{ nodeTitle(hoveredNode) }}
          <span class="node-tooltip-role">{{ hoveredNode.role || 'relay' }}</span>
        </p>
        <span class="node-tooltip-chip">{{ card.pinned.value ? '已固定' : hoveredNodeStats.modeLabel }}</span>
        <button class="node-card-close" aria-label="关闭节点卡片" @click.stop="card.close">×</button>
      </div>

      <slot name="node-details" :node="hoveredNode" :pinned="card.pinned.value">
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
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { THEME_PROFILES } from '@/features/canvas2d/lib/themes'
import { LOCAL_STORAGE_KEYS } from '@/shared/constants'
import {
  computeBounds,
  computeEditBounds,
  computeContentOrigin,
  computeScale,
  MAX_VIEW_SCALE,
  NODE_HIT_EXTRA_PX,
  nodeRadiusFor,
  toScreenPoint,
  toWorldPoint,
  viewInsetsFor,
} from '@/features/canvas2d/lib/coordinate'
import { pickWorldGridStep } from '@/features/canvas2d/lib/draw/grid'
import {
  drawEditGhosts,
  drawHudText,
  drawMarqueeBox,
  drawNodeBody,
  drawVisiblePacketSet,
  paintMeasurementOverlay,
  paintSceneBackdrop,
  syncCanvasContext,
} from '@/features/canvas2d/lib/draw/scene'
import { useCanvasLoop } from '@/features/canvas2d/composables/useCanvasLoop'
import { useCanvasView, ZOOM_MIN } from '@/features/canvas2d/composables/useCanvasView'
import { useMeasureTool } from '@/features/canvas2d/composables/useMeasureTool'
import { TOOL_MODES, usePointerTools } from '@/features/canvas2d/composables/usePointerTools'
import { useNodeCard } from '@/features/canvas2d/composables/useNodeCard'
import { useNodeTooltip } from '@/features/canvas2d/composables/useNodeTooltip'

const props = defineProps({
  nodes: { type: Array, required: true },
  nodeVisuals: { type: Array, required: true },
  visiblePackets: { type: Array, default: () => [] },
  currentTime: { type: Number, required: true },
  themeKey: { type: String, default: 'industrial-scada' },
  fxLevel: { type: String, default: 'standard' },
  editMode: { type: Boolean, default: false },
  allowPlaceNode: { type: Boolean, default: false },
  boxSelect: { type: Boolean, default: false },
  originalPositions: { type: Array, default: () => [] },
  selectedNodeId: { type: [Number, String], default: null },
  selectedNodeIds: { type: Array, default: () => [] },
  soundSpeedMps: { type: Number, default: 1500 },
  /* 额外安全边距（px），为浮动 dock 留出默认视图空间：{ left, top, right, bottom } */
  viewPadding: { type: Object, default: null },
})

const NODE_SIZE_MIN = 0.5
const NODE_SIZE_MAX = 2
const NODE_SIZE_STEP = 0.1
const NODE_SIZE_DEFAULT = 0.7

const clampNodeSize = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return NODE_SIZE_DEFAULT
  return Math.min(NODE_SIZE_MAX, Math.max(NODE_SIZE_MIN, num))
}

const nodeSizeScale = ref(NODE_SIZE_DEFAULT)
const zoomControlEl = ref(null)
const zoomPanelOpen = ref(false)
const onZoomOutside = (event) => {
  if (!zoomControlEl.value?.contains(event.target)) zoomPanelOpen.value = false
}

const themeProfile = computed(() => THEME_PROFILES[props.themeKey] || THEME_PROFILES['industrial-scada'])
/* 画布首帧前的垫底背景：与 paintSceneBackdrop 的径向渐变同 stops，
   避免切页/重挂载时露出一帧 --sunken 底色造成闪烁 */
const hostBackground = computed(() => {
  const bg = themeProfile.value.bg
  return `radial-gradient(circle at 20% 18%, ${bg[0]} 0%, ${bg[1]} 45%, ${bg[2]} 100%)`
})
const fxIntensity = computed(() => (props.fxLevel === 'extreme' ? 2.2 : 1))
const canvasEl = ref(null)
const containerEl = ref(null)
const contextMenuEl = ref(null)
const contextXEl = ref(null)
const contextMenu = ref(null)
const displayWidth = ref(900)
const displayHeight = ref(520)
const hoveredNodeId = ref(null)
const hoverCursor = ref({ x: 0, y: 0 })
const viewInsets = computed(() => {
  const base = viewInsetsFor(displayWidth.value, displayHeight.value)
  const extra = props.viewPadding
  if (!extra) return base
  return {
    left: base.left + (Number(extra.left) || 0),
    top: base.top + (Number(extra.top) || 0),
    right: base.right + (Number(extra.right) || 0),
    bottom: base.bottom + (Number(extra.bottom) || 0),
  }
})
const nodeRadius = computed(() => nodeRadiusFor(Math.min(displayWidth.value, displayHeight.value)) * nodeSizeScale.value)
const emit = defineEmits([
  'node-select', 'pause-request', 'node-move', 'node-move-end', 'node-place', 'selection-change', 'nodes-move',
  'protocol-drop',
])
let resizeObserver = null

const liveBounds = computed(() => computeBounds(props.nodes))
const bounds = computed(() => dragFrozenBounds.value || sessionFrozenBounds.value || liveBounds.value)

const scale = computed(() => computeScale(displayWidth.value, displayHeight.value, viewInsets.value, bounds.value))

const effectiveScale = computed(() => Math.min(scale.value * zoom.value, MAX_VIEW_SCALE))
const scaleBar = computed(() => {
  const meters = pickWorldGridStep(effectiveScale.value)
  return { width: meters * effectiveScale.value, label: meters >= 1000 ? `${meters / 1000} km` : `${meters} m` }
})

const contentOrigin = computed(() => computeContentOrigin(displayWidth.value, displayHeight.value, viewInsets.value, bounds.value, scale.value))

const projection = computed(() => ({ bounds: bounds.value, origin: contentOrigin.value, scale: effectiveScale.value, pan: pan.value }))

const loop = useCanvasLoop(() => draw)
const { scheduleDraw } = loop

const view = useCanvasView({
  getProjection: () => projection.value,
  getBaseScale: () => scale.value,
  getDraw: () => draw,
  getCanvasEl: () => canvasEl.value,
})
const {
  pan,
  isPanning,
  panStart,
  panOffsetStart,
  zoom,
  hasDragged,
  dragFrozenBounds,
  sessionFrozenBounds,
  onWheel,
} = view

const canvasZoomPosition = computed({
  get: () => {
    const minScale = scale.value * ZOOM_MIN
    return Math.max(0, Math.min(100, Math.log(effectiveScale.value / minScale) / Math.log(MAX_VIEW_SCALE / minScale) * 100))
  },
  set: (position) => {
    const minScale = scale.value * ZOOM_MIN
    const targetScale = minScale * (MAX_VIEW_SCALE / minScale) ** (Number(position) / 100)
    const inset = viewInsets.value
    view.setZoomAt(targetScale / scale.value,
      (inset.left + displayWidth.value - inset.right) / 2,
      (inset.top + displayHeight.value - inset.bottom) / 2)
  },
})

const resetView = () => {
  dragFrozenBounds.value = null
  if (props.editMode) sessionFrozenBounds.value = computeEditBounds(props.nodes)
  view.resetView()
  hoveredNodeId.value = null
  scheduleDraw()
}
const nodeVisualById = computed(() => new Map(props.nodeVisuals.map((visual) => [visual.node_id, visual])))
const nodeById = computed(() => new Map(props.nodes.map((node) => [node.node_id, node])))
const originalPoseById = computed(() => new Map((props.originalPositions || []).map((item) => [item.node_id, item])))

const selectedIdSet = computed(() => new Set((props.selectedNodeIds || []).map((id) => Number(id))))

const canvasCursorClass = computed(() => {
  if (toolMode.value === TOOL_MODES.MEASURE) {
    return hoveredMeasureNode.value ? 'canvas-measure-hover' : 'canvas-measure'
  }
  if (marquee.value) return 'canvas-marquee'
  if (props.editMode) {
    if (draggingNodeId.value || dragGroup.value || isPanning.value) return 'canvas-edit-dragging'
    if (hoveredNodeId.value != null) return 'canvas-edit-hover'
    return 'canvas-edit'
  }
  return ''
})

const toScreen = (x, y) => toScreenPoint(x, y, projection.value)

const toWorld = (x, y) => toWorldPoint(x, y, projection.value)

const closeContextMenu = () => { contextMenu.value = null }
const onCanvasContextMenu = (event) => {
  if (!props.editMode || !props.allowPlaceNode) return
  event.preventDefault()
  const rect = canvasEl.value?.getBoundingClientRect()
  if (!rect) return
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top
  const point = toWorld(sx, sy)
  const averageZ = props.nodes.length
    ? props.nodes.reduce((sum, node) => sum + (Number(node.z) || 0), 0) / props.nodes.length
    : 0
  contextMenu.value = {
    left: Math.max(8, Math.min(sx, displayWidth.value - 254)),
    top: Math.max(8, Math.min(sy, displayHeight.value - 214)),
    x: point.x.toFixed(2),
    y: point.y.toFixed(2),
    z: averageZ.toFixed(2),
  }
  nextTick(() => contextXEl.value?.focus())
}
const addNodeFromContext = () => {
  const menu = contextMenu.value
  if (!menu) return
  const values = [menu.x, menu.y, menu.z]
  if (values.some((value) => String(value).trim() === '' || !Number.isFinite(Number(value)))) return
  emit('node-place', { x: Number(menu.x), y: Number(menu.y), z: Number(menu.z) })
  emit('pause-request')
  closeContextMenu()
}
const onContextMenuOutside = (event) => {
  if (contextMenu.value && !contextMenuEl.value?.contains(event.target)) closeContextMenu()
}

const pickNodeAt = (sx, sy) => {
  let picked = null
  let bestDist = Number.POSITIVE_INFINITY
  const hit = nodeRadius.value + NODE_HIT_EXTRA_PX
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

const measure = useMeasureTool({
  getNodeById: (id) => nodeById.value.get(id),
  pickNodeAtScreen: pickNodeAt,
  toWorldFn: toWorld,
  toScreenFn: toScreen,
  scheduleDraw,
  onPauseRequest: () => emit('pause-request'),
})

let pointer

// Hoisted so they can be injected into usePointerTools below; at call time
// (pointer events) `pointer` is already assigned.
function updateMeasureHover (sx, sy) {
  if (pointer.toolMode.value !== TOOL_MODES.MEASURE) {
    measure.hoveredMeasureNode.value = null
    return
  }
  measure.hoveredMeasureNode.value = pickNodeAt(sx, sy)
}

function updateHoveredNode (sx, sy) {
  if (isPanning.value) {
    hoveredNodeId.value = null
    return
  }
  const picked = pickNodeAt(sx, sy)
  hoveredNodeId.value = picked ? picked.node_id : null
}

pointer = usePointerTools({
  props,
  emit,
  view,
  measure,
  scheduleDraw,
  getCanvasEl: () => canvasEl.value,
  pickNodeAt,
  toWorld,
  getSelectedIdSet: () => selectedIdSet.value,
  getViewBounds: () => bounds.value,
  setHoveredNodeId: (id) => { hoveredNodeId.value = id },
  setHoverCursor: (x, y) => { hoverCursor.value = { x, y } },
  updateHoveredNode,
  updateMeasureHover,
})
pointer.setNodeScreenInBox((node, left, right, top, bottom) => {
  const p = toScreen(node.x, node.y)
  return p.x >= left && p.x <= right && p.y >= top && p.y <= bottom
})

const {
  toolMode,
  spaceHeld,
  marquee,
  draggingNodeId,
  dragGroup,
  onPointerDown,
  onPointerMove,
  onCanvasPointerMove,
  onCanvasPointerLeave,
  onPointerUp,
  onDragOver,
  onDrop,
  activateMeasureTool,
  cancelActiveTool,
} = pointer
const {
  pendingMeasurePoint,
  measurementLines,
  selectedMeasurementId,
  hoveredMeasureNode,
  canUndo,
  canRedo,
  clearMeasurements,
  undoMeasurement,
  redoMeasurement,
  deleteSelectedMeasurement,
} = measure

const nodeCardEl = ref(null)
const card = useNodeCard({
  nodeIds: () => props.nodes.map((node) => node.node_id),
  canvas: canvasEl,
  element: nodeCardEl,
  pick: pickNodeAt,
  allowClick: () => toolMode.value !== TOOL_MODES.MEASURE && !spaceHeld.value,
})
const onCanvasPointerDown = (event) => {
  card.beginClick(event)
  onPointerDown(event)
}
const cardAnchor = computed(() => {
  const node = nodeById.value.get(card.nodeId.value)
  return node ? toScreen(node.x, node.y) : { x: 0, y: 0 }
})

const {
  hoveredNode,
  hoveredNodePos,
  hoveredNodeStats,
  hoveredTooltipStyle,
  nodeLabel,
  nodeTitle,
} = useNodeTooltip({
  hoveredNodeId: card.nodeId,
  nodeById,
  nodeVisualById,
  toScreenFn: toScreen,
  getVisiblePackets: () => props.visiblePackets,
  displayWidth,
  displayHeight,
  hoverCursor: cardAnchor,
  tooltipSize: card.size,
  getInsets: () => props.viewPadding,
})

const paintMeasurements = (ctx) => {
  paintMeasurementOverlay(ctx, measurementLines.value, {
    resolvePoint: measure.resolveMeasurePoint,
    distanceOf: measure.distanceByMeasurePoints,
    toScreen,
    selectedId: selectedMeasurementId.value,
    pendingPoint: pendingMeasurePoint.value,
    showPending: toolMode.value === TOOL_MODES.MEASURE,
    width: displayWidth.value,
    height: displayHeight.value,
  })
}

const draw = () => {
  const ctx = syncCanvasContext(canvasEl.value, displayWidth.value, displayHeight.value)
  if (!ctx) return

  const w = displayWidth.value
  const h = displayHeight.value
  const profile = themeProfile.value
  const fx = fxIntensity.value
  const phase = props.currentTime / 1_000_000

  paintSceneBackdrop(ctx, w, h, profile, projection.value)
  drawVisiblePacketSet(
    ctx,
    props.visiblePackets,
    props.currentTime,
    (id) => nodeById.value.get(id),
    toScreen,
    profile,
    phase,
    fx,
  )

  if (props.editMode && props.originalPositions.length) {
    drawEditGhosts(ctx, props.originalPositions, (id) => nodeById.value.get(id), toScreen)
  }

  // Keep measurement endpoints below node bodies and their ID labels.
  paintMeasurements(ctx)

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
    const selected = selectedIdSet.value.has(Number(node.node_id)) || props.selectedNodeId === node.node_id
    drawNodeBody(ctx, node, visual, profile, phase, fx, nodeRadius.value, toScreen(node.x, node.y), props.editMode && selected)
  }

  if (marquee.value) {
    drawMarqueeBox(ctx, marquee.value)
  }

  drawHudText(ctx, profile, props.currentTime, props.visiblePackets)
}

const updateViewport = () => {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  /* 视图常驻（v-show）隐藏时宿主尺寸归零：保持既有视口与 backing store，
     重新显示时无需重设 canvas 尺寸，切换无缝 */
  if (rect.width < 2 || rect.height < 2) return
  displayWidth.value = Math.max(160, rect.width - 2)
  displayHeight.value = Math.max(120, Math.round((rect.height || 0) - 2))
  scheduleDraw()
}

watch(
  () => [props.currentTime, props.nodes, props.nodeVisuals, props.visiblePackets, props.themeKey, props.fxLevel, props.editMode, props.originalPositions, props.selectedNodeId, props.selectedNodeIds],
  () => {
    scheduleDraw()
  },
  { deep: true, immediate: true },
)

watch(nodeSizeScale, (next) => {
  nodeSizeScale.value = clampNodeSize(next)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.nodeSize, String(nodeSizeScale.value))
  } catch {
    // ignore persistence errors
  }
  scheduleDraw()
})

watch(() => props.editMode, (next, previous) => {
  // Freeze on initial mount too; entering edit mode preserves the current view.
  const editBounds = next
    ? { ...(previous === undefined ? computeEditBounds(props.nodes) : bounds.value) }
    : null
  draggingNodeId.value = null
  dragFrozenBounds.value = null
  sessionFrozenBounds.value = editBounds
}, { immediate: true })

const onKeyDown = (event) => {
  if (event.key === 'Escape') {
    closeContextMenu()
    zoomPanelOpen.value = false
    cancelActiveTool()
    return
  }
  if (event.code !== 'Space') return
  if (event.target && /^(INPUT|TEXTAREA|SELECT)$/i.test(event.target.tagName)) return
  event.preventDefault()
  spaceHeld.value = true
}

const onKeyUp = (event) => {
  if (event.code === 'Space') spaceHeld.value = false
}

onMounted(() => {
  try {
    const savedNodeSize = localStorage.getItem(LOCAL_STORAGE_KEYS.nodeSize)
    if (savedNodeSize !== null) nodeSizeScale.value = clampNodeSize(savedNodeSize)
  } catch {
    // ignore persistence errors
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  document.addEventListener('pointerdown', onZoomOutside, true)
  document.addEventListener('pointerdown', onContextMenuOutside, true)
  updateViewport()
  // 同步补一次首帧绘制，不等 rAF，保证页面第一次 paint 画布就有内容
  draw()
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
  loop.dispose()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  document.removeEventListener('pointerdown', onZoomOutside, true)
  document.removeEventListener('pointerdown', onContextMenuOutside, true)
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
  z-index: 10;
  bottom: 12px;
  left: 12px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 0.52rem;
  border-radius: var(--r-lg, 14px);
  border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
  background: var(--panel, rgba(17, 23, 34, 0.88));
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-island, 0 14px 40px rgba(0, 0, 0, 0.5));
}

.toolbar-group-history {
  border-color: color-mix(in srgb, var(--warn, #f59e0b) 26%, var(--line, transparent));
}

.canvas-toolbar.zoom-open { z-index: 30; }
.toolbar-zoom { position: relative; }
.zoom-panel {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  transform-origin: center bottom;
  z-index: 30;
  display: flex;
  gap: 16px;
  padding: 14px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-pop);
  backdrop-filter: blur(10px);
}
.zoom-panel::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  width: 10px;
  height: 10px;
  background: var(--panel);
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  transform: translateX(-50%) rotate(45deg);
  pointer-events: none;
}
.zoom-pop-enter-active,
.zoom-pop-leave-active {
  transition: transform var(--dur-med) var(--ease-spring), opacity var(--dur-fast) var(--ease-out);
}
.zoom-pop-leave-active { transition-timing-function: var(--ease-in); }
.zoom-pop-enter-from,
.zoom-pop-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.94); }
.zoom-column { display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 52px; color: var(--text); font-size: 12px; }
.zoom-range { writing-mode: vertical-lr; direction: rtl; width: 20px; height: 120px; margin: 0; accent-color: var(--accent); cursor: pointer; }
.zoom-column output { color: var(--muted); font: 11px var(--font-mono); white-space: nowrap; }
.canvas-scale { display: flex; flex-direction: column; align-items: center; gap: 3px; margin: 0 8px; color: var(--muted); font: 10px var(--font-mono); white-space: nowrap; flex-shrink: 0; pointer-events: none; }
.canvas-scale-line { width: 100%; height: 6px; border: 1px solid currentColor; border-top: 0; }

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
  color: var(--text, #f8fafc);
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
  border-color: color-mix(in srgb, var(--bad, #f87171) 40%, transparent);
  color: var(--bad, #fecaca);
}

.toolbar-help {
  color: var(--accent-soft, #93c5fd);
  font-size: 0.75rem;
  white-space: nowrap;
}

.node-context-menu {
  position: absolute;
  z-index: 30;
  width: min(240px, calc(100% - 16px));
  max-height: calc(100% - 16px);
  overflow-y: auto;
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--panel);
  box-shadow: var(--shadow-pop);
  backdrop-filter: blur(10px);
}
.node-context-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text);
  font-size: 0.84rem;
}
.node-context-coords {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.node-context-coords .field:last-child { grid-column: 1 / -1; }
.node-context-add { width: 100%; }

.node-tooltip {
  position: absolute;
  z-index: 30;
  background: var(--panel, rgba(17, 23, 34, 0.88));
  border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
  border-radius: var(--r-md, 10px);
  padding: 0.55rem 0.65rem;
  width: min(360px, calc(100% - 16px));
  max-width: min(360px, calc(100vw - 18px));
  box-shadow: var(--shadow-pop, 0 18px 48px rgba(0, 0, 0, 0.55));
  pointer-events: auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  backdrop-filter: blur(10px) saturate(1.05);
  animation: tooltip-pop var(--dur-fast) var(--ease-out);
}

.node-card-close {
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 20px;
  padding: 2px 6px;
  border-radius: var(--r-sm);
}
.node-card-close:hover { color: var(--text); background: var(--panel); }

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
  color: var(--text, #e2e8f0);
  font-weight: 700;
  line-height: 1.2;
}

.node-tooltip-role {
  color: color-mix(in srgb, var(--accent-soft, #93c5fd) 88%, var(--text, #ffffff) 12%);
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
  color: var(--accent-soft, #dbeafe);
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
  color: color-mix(in srgb, var(--accent-soft, #93c5fd) 76%, var(--text, #ffffff) 24%);
  font-size: 0.67rem;
  letter-spacing: 0.03em;
}

.node-tooltip-item strong {
  color: var(--text, #e2e8f0);
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
  border: 1px solid color-mix(in srgb, var(--muted, #94a3b8) 40%, transparent);
  color: var(--text, #dbeafe);
}

.tooltip-pill.ok {
  border-color: color-mix(in srgb, var(--rx, #22c55e) 45%, transparent);
  background: color-mix(in srgb, var(--rx, #22c55e) 15%, transparent);
  color: var(--rx, #bbf7d0);
}

.tooltip-pill.bad {
  border-color: color-mix(in srgb, var(--bad, #ef4444) 48%, transparent);
  background: color-mix(in srgb, var(--bad, #ef4444) 14%, transparent);
  color: var(--bad, #fecaca);
}

.tooltip-pill.warn {
  border-color: color-mix(in srgb, var(--tx, #f97316) 48%, transparent);
  background: color-mix(in srgb, var(--tx, #f97316) 14%, transparent);
  color: var(--tx, #fed7aa);
}

.tooltip-pill.mute {
  border-color: color-mix(in srgb, var(--muted, #94a3b8) 44%, transparent);
  background: color-mix(in srgb, var(--muted, #94a3b8) 12%, transparent);
  color: var(--muted, #dbeafe);
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
