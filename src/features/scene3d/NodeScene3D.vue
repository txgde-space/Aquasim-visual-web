<template>
  <div ref="hostEl" class="scene-host" :style="{ background: hostBackground }">
    <canvas ref="canvasEl" class="scene-canvas" tabindex="0" aria-label="3D 场景，点击后可使用 WASD 移动、空格上升、Shift 下沉" />
    <canvas
      ref="axesEl"
      class="scene-axes"
      width="84"
      height="84"
      @click="resetCameraView"
      title="重置 3D 视角"
    />
    <div class="scene-help" @pointerdown.stop @click.stop>
      <span>3D 视图</span>
      <select aria-label="查看节点模型" :value="viewedNodeId ?? ''" @change="selectNodeView">
        <option value="" disabled>查看节点</option>
        <option v-for="node in nodes" :key="node.node_id" :value="node.node_id">{{node.name || '节点'}} ({{node.node_id}})</option>
      </select>
      <button type="button" @click="resetCameraView">全局拓扑</button>
      <button type="button" :class="{ active: oceanEnabled }" :aria-pressed="oceanEnabled" @click="oceanEnabled = !oceanEnabled">海洋环境</button>
      <button type="button" :class="{ active: worldAxesVisible }" :aria-pressed="worldAxesVisible" @click="worldAxesVisible = !worldAxesVisible">坐标轴</button>
      <button type="button" :class="{ active: isRoaming }" :aria-pressed="isRoaming" @click="toggleRoaming">{{ isRoaming ? '退出漫游' : '漫游' }}</button>
      <button type="button" :aria-pressed="isFullscreen" @click="babylon.toggleFullscreen()">{{ isFullscreen ? '退出全屏' : '全屏' }}</button>
      <span class="scene-key-help">{{ isRoaming ? '鼠标转向 · WASD · 空格上升 · Shift 下沉 · Esc' : '拖动环绕 · 滚轮缩放 · WASD · 空格上升 · Shift 下沉' }}</span>
    </div>
    <div v-if="isPointerLocked" class="scene-reticle" aria-hidden="true" />
    <p v-if="navigationError" class="scene-navigation-error" role="status">{{ navigationError }}</p>
    <SceneOverview v-if="active" :nodes="nodes" :bounds="baseViewNodes" :visuals="nodeVisuals"
      :packets="visiblePackets" :current-time="currentTime" :viewed-node-id="viewedNodeId" @inspect="inspectOverviewNode" />
    <div v-if="viewedNode && viewedNodeVisual" class="scene-live-status" :class="[viewedNodeVisual.mode, { 'has-conflict': viewedNodeVisual.overlay }]" aria-label="聚焦节点通信状态">
      <span>{{ viewedNode.name }} · {{ viewedNode.node_id }}</span><strong>{{ viewedNodeVisual.statusText }}</strong>
      <span v-if="['tx','rx'].includes(viewedNodeVisual.mode)" class="scene-live-progress"><i :style="{ transform: `scaleX(${viewedNodeVisual.fillProgress})` }" /></span>
    </div>

    <div
      v-if="selectedNodePos && selectedNode"
      ref="nodeCardEl"
      class="scene-tooltip"
      role="group"
      :aria-label="`节点 ${selectedNode.node_id} 详情`"
      @pointerdown.stop
      @click.stop
      @wheel.stop
      :style="{ left: `${selectedNodePos.x}px`, top: `${selectedNodePos.y}px` }"
    >
      <button type="button" class="scene-card-close" aria-label="关闭节点详情" @click="closeNodeCard">×</button>
      <p class="scene-tooltip-title">
        {{ selectedNode.name }}（{{ selectedNode.node_id }}）
        <span class="scene-tooltip-role">{{ selectedNode.role }}</span>
      </p>
      <p class="scene-tooltip-row">x: {{ selectedNode.x.toFixed(2) }}m, y: {{ selectedNode.y.toFixed(2) }}m, z: {{ Number(selectedNode.z ?? 0).toFixed(2) }}m</p>
      <p v-if="selectedNodeVisual" class="scene-tooltip-row">状态：{{ selectedNodeVisual.statusText }}</p>
      <p v-if="selectedNodeVisual?.packetId" class="scene-tooltip-row">关联包：{{ selectedNodeVisual.packetId }}</p>
      <div class="scene-model-size"><span>{{ nodeModelSizeLabel(resolveNodeModel(selectedNode)) }}</span><button type="button" @click="inspectSelectedNode">近看模型</button></div>
      <slot name="node-actions" :node="selectedNode" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Matrix, Vector3, Viewport } from '@babylonjs/core'
import {
  DEPTH_SCALE,
  clamp,
  packetColor,
  theme3DFor,
  worldPos,
} from '@/features/scene3d/lib/themes3d'
import {
  createNodeEntry,
  syncNodeAnnotation,
  createPacketEntry,
  disposeNodeEntry,
  disposePacketEntry,
  syncMaterialColor,
  syncPacketGeometry,
  visualProgressStyle,
} from '@/features/scene3d/lib/factories'
import {
  disposeWorldAxisEntry,
  drawAxesWidget,
  syncWorldAxes,
  setWorldAxesVisible,
} from '@/features/scene3d/lib/worldAxes'
import { nodeCardPosition } from '@/features/scene3d/lib/nodeCardPosition'
import { NODE_MODEL_DIMENSIONS, nodeModelSizeLabel, resolveNodeModel } from '@/shared/nodeModel'
import { motionAngles } from '@/shared/nodeMotion'
import { useBabylonScene } from '@/features/scene3d/lib/useBabylonScene'
import { createOceanEnvironment } from '@/features/scene3d/lib/oceanEnvironment'
import { packetPathKey, worldAxisBounds, worldAxesNeedRefresh } from '@/features/scene3d/lib/sceneState'
import { syncSceneAssets, disposeSceneAssetEntry } from '@/features/scene3d/lib/sceneAssets'
import { followModelMovement, inspectModel, syncInspectionDepth } from '@/features/scene3d/lib/modelInspection'
import { sceneAssetBounds } from '@/shared/sceneAssetGeometry'
import { signalWindow } from './lib/signalTimeline'
import { syncPacketAnnotationSize, syncPacketPresentation } from './lib/packetEffects'
import SceneOverview from './SceneOverview.vue'

const props = defineProps({
  nodes: { type: Array, required: true },
  nodeVisuals: { type: Array, required: true },
  visiblePackets: { type: Array, default: () => [] },
  currentTime: { type: Number, required: true },
  topologyNodes: { type: Array, default: null },
  viewNodes: { type: Array, default: null },
  themeKey: { type: String, default: 'industrial-scada' },
  fxLevel: { type: String, default: 'standard' },
  /* 视图常驻（v-show）时的可见性：false 停 renderLoop，true 恢复并补刷新 */
  active: { type: Boolean, default: true },
  sceneAssets: { type: Array, default: () => [] },
  sceneAssetsVisible: { type: Boolean, default: true },
  sceneFocusRequest: { type: Object, default: null },
})
const emit = defineEmits(['scene-error', 'scene-asset-select'])
const sceneAssetEntries = new Map()
let consumedAssetFocus = null
let appliedSceneAssets = null
let appliedSceneVisibility = null

const hostEl = ref(null)
const canvasEl = ref(null)
const axesEl = ref(null)
const nodeCardEl = ref(null)
let cardObserver = null
let cardSize = { width: 260, height: 150 }
const selectedNodeId = ref(null)
const selectedNodePos = ref(null)
const oceanEnabled = ref(true)
const worldAxesVisible = ref(true)
let oceanEnvironment = null
const baseViewNodes = computed(() => props.viewNodes || props.topologyNodes || props.nodes)

const nodeById = computed(() => new Map(props.nodes.map((node) => [node.node_id, node])))
const nodeVisualById = computed(() => new Map(props.nodeVisuals.map((visual) => [visual.node_id, visual])))
const selectedNode = computed(() => nodeById.value.get(selectedNodeId.value) || null)
const selectedNodeVisual = computed(() => {
  if (!selectedNode.value) return null
  return nodeVisualById.value.get(selectedNode.value.node_id) || null
})

const clearSelection = () => {
  selectedNodeId.value = null
  selectedNodePos.value = null
}

const closeNodeCard = () => {
  clearSelection()
  canvasEl.value?.focus({ preventScroll: true })
}
const onOutsidePointerDown = (event) => {
  if (!props.active || selectedNodeId.value == null || event.target === canvasEl.value
    || nodeCardEl.value?.contains(event.target)) return
  clearSelection()
}

// A replacement topology is a different replay, even if it reuses node IDs.
watch(() => props.topologyNodes, clearSelection)
watch(
  () => props.active && selectedNodeId.value != null && !nodeById.value.has(selectedNodeId.value),
  (missing) => { if (missing) clearSelection() },
)

const theme3D = computed(() => theme3DFor(props.themeKey))
/* Babylon 引擎初始化前宿主先垫一层与 clearColor 相同的底色，避免切页闪一帧透明 */
const hostBackground = computed(() => theme3D.value.clear.toHexString())
const fx3D = computed(() => (props.fxLevel === 'extreme' ? 1.85 : 1))

let nodeMeshMap = new Map()
let packetMeshMap = new Map()
const worldAxesMap = new Map()
/** Consecutive refreshes a packet entry survives while inactive before disposal. */
const PACKET_ENTRY_STALE_REFRESHES = 3
const packetStaleCounts = new Map()
let refreshPending = false
let middlePanPointerId = null
let middlePanLast = null

const syncSelectedNodePos = () => {
  const engine = babylon.getEngine()
  const scene = babylon.getScene()
  const camera = babylon.getCamera()
  if (!selectedNode.value || !camera || !engine || !scene || !hostEl.value) {
    selectedNodePos.value = null
    return
  }
  const pos = worldPos(selectedNode.value)
  const projected = Vector3.Project(
    pos,
    Matrix.IdentityReadOnly,
    scene.getTransformMatrix(),
    new Viewport(0, 0, hostEl.value.clientWidth, hostEl.value.clientHeight),
  )
  const position = nodeCardPosition(projected,
    { width: hostEl.value.clientWidth, height: hostEl.value.clientHeight }, cardSize)
  if (position?.x !== selectedNodePos.value?.x || position?.y !== selectedNodePos.value?.y) {
    selectedNodePos.value = position
  }
}

watch(nodeCardEl, (element) => {
  cardObserver?.disconnect()
  cardObserver = null
  if (!element) return
  cardObserver = new ResizeObserver(() => {
    cardSize = { width: element.offsetWidth, height: element.offsetHeight }
    if (props.active) syncSelectedNodePos()
  })
  cardObserver.observe(element)
})

const drawAxesOverlay = () => {
  const camera = babylon.getCamera()
  if (!axesEl.value || !camera) return
  drawAxesWidget(axesEl.value, camera)
}

const onSceneFrame = () => {
  flushRefresh()
  const camera = babylon.getCamera()
  if (props.active && camera) {
    syncInspectionDepth(camera)
    oceanEnvironment?.frame(camera, props.currentTime / 1e6)
    const height = hostEl.value?.clientHeight || 800
    for (const entry of nodeMeshMap.values()) syncNodeAnnotation(entry, camera, height)
    for (const entry of packetMeshMap.values()) syncPacketAnnotationSize(entry, camera, height)
  }
  syncSelectedNodePos()
  drawAxesOverlay()
}

const babylon = useBabylonScene({
  canvasRef: canvasEl,
  hostRef: hostEl,
  getClearColor: () => theme3D.value.clear,
  getActive: () => props.active,
  onPick: (nodeId, assetId) => {
    if (babylon.pointerLocked.value) return
    if (assetId) { clearSelection(); emit('scene-asset-select', assetId); return }
    if (nodeId == null || !nodeById.value.has(nodeId)) {
      clearSelection()
      return
    }
    selectedNodeId.value = nodeId
    syncSelectedNodePos()
  },
  onFrame: onSceneFrame,
  onError: (error) => emit('scene-error', error),
  cleanup: () => {
    for (const entry of sceneAssetEntries.values()) disposeSceneAssetEntry(entry)
    sceneAssetEntries.clear()
    oceanEnvironment?.dispose()
    oceanEnvironment = null
    for (const entry of nodeMeshMap.values()) disposeNodeEntry(entry)
    nodeMeshMap.clear()
    for (const entry of packetMeshMap.values()) disposePacketEntry(entry)
    packetMeshMap.clear()
    packetStaleCounts.clear()
    for (const entry of worldAxesMap.values()) disposeWorldAxisEntry(entry)
    worldAxesMap.clear()
  },
})
const isRoaming = computed(() => babylon.navigationMode.value === 'roam')
const isPointerLocked = computed(() => babylon.pointerLocked.value)
const isFullscreen = computed(() => babylon.fullscreen.value)
const navigationError = computed(() => babylon.navigationError.value)
const toggleRoaming = () => {
  endMiddlePan()
  clearSelection()
  viewedNodeId.value = null
  inspectedPosition = null
  if (isRoaming.value) babylon.exitRoaming()
  else void babylon.requestRoaming()
}

const viewedNodeId = ref(null)
const viewedNode = computed(() => nodeById.value.get(viewedNodeId.value) || null)
const viewedNodeVisual = computed(() => nodeVisualById.value.get(viewedNodeId.value) || null)
let inspectedPosition = null
const inspectNode = (node) => {
  const camera = babylon.getCamera()
  if (!camera || !node) return
  const size = NODE_MODEL_DIMENSIONS[resolveNodeModel(node)]
  const entry = nodeMeshMap.get(node.node_id)
  const center = new Vector3(0, size.height / 2, 0)
  const target = entry ? Vector3.TransformCoordinates(center, entry.root.computeWorldMatrix(true)) : worldPos(node).add(center)
  inspectModel(camera, target, Math.max(size.length, size.width, size.height))
  viewedNodeId.value = node.node_id
  inspectedPosition = entry ? entry.root.position.clone() : worldPos(node)
}
const inspectSelectedNode = () => inspectNode(selectedNode.value)
const inspectOverviewNode = (node) => {
  clearSelection()
  inspectNode(node)
  canvasEl.value?.focus({ preventScroll: true })
}
const selectNodeView = (event) => {
  const node = nodeById.value.get(Number(event.target.value))
  if (!node) return
  clearSelection()
  inspectNode(node)
  syncSelectedNodePos()
}

const buildNodes = () => {
  const scene = babylon.getScene()
  if (!scene) return
  const palette = theme3D.value
  const inactiveProgressStyle = { diffuse: palette.rx, emissive: palette.rx.scale(0.28), alpha: 0 }
  for (const node of props.nodes) {
    const visual = nodeVisualById.value.get(node.node_id)
    const pos = worldPos(node)
    const kind = resolveNodeModel(node)
    let entry = nodeMeshMap.get(node.node_id)
    // Replace only the changed node's geometry; preserve camera and replay state.
    if (entry && entry.kind !== kind) {
      disposeNodeEntry(entry)
      nodeMeshMap.delete(node.node_id)
      entry = null
    }
    if (!entry) {
      entry = createNodeEntry(scene, node.node_id, kind, palette)
      nodeMeshMap.set(node.node_id, entry)
    }

    entry.root.position.copyFrom(pos)
    entry.root.scaling.setAll(1)
    const direction = motionAngles(node.motionDirection)
    if (direction && ['auv', 'rov', 'vessel'].includes(kind)) {
      entry.root.rotation.set(0, -direction.heading, kind === 'vessel' ? 0 : clamp(direction.pitch, -Math.PI / 6, Math.PI / 6))
    } else entry.root.rotation.set(0, 0, 0)

    entry.progress.setEnabled(true)
    // Equipment keeps its own material; traffic state is a separate overlay.

    const progressStyle = visualProgressStyle(visual, palette)
    if (progressStyle && progressStyle.alpha > 0.001) {
      entry.progressScale = 1
      syncMaterialColor(entry.progress.material, progressStyle)
    } else {
      entry.progressScale = 0.01
      syncMaterialColor(entry.progress.material, inactiveProgressStyle)
    }
  }

  for (const [nodeId, entry] of nodeMeshMap.entries()) {
    if (nodeById.value.has(nodeId)) continue
    // Dispose meshes AND materials; mesh.dispose() alone leaks materials.
    disposeNodeEntry(entry)
    nodeMeshMap.delete(nodeId)
  }
}

const buildPackets = () => {
  const scene = babylon.getScene()
  if (!scene) return
  const palette = theme3D.value
  const fx = fx3D.value
  const now = props.currentTime
  const activeKeys = new Set()

  for (const packet of props.visiblePackets) {
    const srcNode = nodeById.value.get(packet.src)
    if (!srcNode) continue
    const srcPos = worldPos(srcNode)

    for (const receiver of packet.receivers) {
      if (!signalWindow(packet, receiver, now).active) continue
      const dstNode = nodeById.value.get(receiver.dst)
      if (!dstNode) continue
      const key = packetPathKey(packet, receiver.dst)

      const dstPos = worldPos(dstNode)
      if (Vector3.DistanceSquared(srcPos, dstPos) < 1e-8) continue
      activeKeys.add(key)
      const color = packetColor(receiver, now, palette)

      let entry = packetMeshMap.get(key)
      if (!entry) {
        entry = createPacketEntry(scene, key, receiver.dst, srcPos, dstPos, palette, color)
        packetMeshMap.set(key, entry)
      } else {
        syncPacketGeometry(entry, srcPos, dstPos)
      }
      packetStaleCounts.delete(key)

      syncPacketPresentation(entry, packet, receiver, now, palette, fx)
    }
  }

  for (const [key, entry] of packetMeshMap.entries()) {
    if (activeKeys.has(key)) continue
    entry.line.setEnabled(false)
    entry.block.setEnabled(false)
    entry.head.setEnabled(false)
    entry.result.setEnabled(false)
    entry.marker.setEnabled(false)
    // Bound the cache: dispose entries that stay inactive for a few refreshes
    // (previously they were only disabled and leaked without limit).
    const stale = (packetStaleCounts.get(key) || 0) + 1
    packetStaleCounts.set(key, stale)
    if (stale >= PACKET_ENTRY_STALE_REFRESHES) {
      disposePacketEntry(entry)
      packetMeshMap.delete(key)
      packetStaleCounts.delete(key)
    }
  }
}

/* Use the base topology rather than moving playback positions so orbit/pan
   stays stable. Refocus only when the base topology coordinates change. */
let cameraFocusSignature = ''
let needsInitialNodeView = false

const updateCameraTargetIfNeeded = () => {
  const topology = baseViewNodes.value
  if (!babylon.getCamera() || !topology.length) return
  // Base topology is stable during movement playback and changes on log import.
  const signature = topology.map((node) => `${node.node_id}:${node.x}:${node.y}:${node.z ?? 0}`).join('|')
  if (signature === cameraFocusSignature) return
  cameraFocusSignature = signature
  const xs = topology.map((node) => node.x)
  const ys = topology.map((node) => node.y)
  const zs = topology.map((node) => (node.z ?? 0) * DEPTH_SCALE)
  const center = new Vector3(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  )
  const modelSpan = Math.max(4, ...props.nodes.map(node => {
    const size = NODE_MODEL_DIMENSIONS[resolveNodeModel(node)]
    return Math.max(size.length, size.width, size.height)
  }))
  const span = Math.hypot(Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys), Math.max(...zs)-Math.min(...zs))
  const radius = Math.max(modelSpan * 1.8, span * .65 / Math.tan(babylon.getCamera().fov / 2))
  babylon.focusCamera(center, radius)
  needsInitialNodeView = true
}

// World axes only depend on node bounds; skip the rebuild (which redraws a
// dozen DynamicTexture labels) while bounds stay unchanged during playback.
// Compare absolute bounds to the last rendered bounds. Using a normalized
// signature alone would miss expansion/contraction around the origin.
let drawnWorldAxisBounds = null

const syncWorldAxesIfNeeded = () => {
  setWorldAxesVisible(worldAxesMap, worldAxesVisible.value)
  if (!worldAxesVisible.value) return
  const scene = babylon.getScene()
  if (!scene) return
  const nextBounds = worldAxisBounds(baseViewNodes.value, DEPTH_SCALE)
  if (!worldAxesNeedRefresh(drawnWorldAxisBounds, nextBounds)) return
  drawnWorldAxisBounds = nextBounds
  if (!nextBounds) {
    for (const entry of worldAxesMap.values()) disposeWorldAxisEntry(entry)
    worldAxesMap.clear()
    return
  }
  syncWorldAxes(scene, baseViewNodes.value, worldAxesMap)
}

const refreshScene = () => {
  if (!props.active || !babylon.getScene()) return
  babylon.setClearColor(theme3D.value.clear)
  updateCameraTargetIfNeeded()
  syncWorldAxesIfNeeded()
  if (!oceanEnvironment) oceanEnvironment = createOceanEnvironment(babylon.getScene(), theme3D.value.ocean)
  oceanEnvironment.sync(baseViewNodes.value)
  oceanEnvironment.setEnabled(oceanEnabled.value)
  buildNodes()
  if (needsInitialNodeView) {
    // Inspect a real-size model on entry, instead of enlarging every device to fill the map.
    inspectNode(nodeById.value.get(viewedNodeId.value) || props.nodes[0])
    needsInitialNodeView = false
  } else if (viewedNodeId.value != null) {
    const position = nodeMeshMap.get(viewedNodeId.value)?.root.position
    if (position && inspectedPosition) followModelMovement(babylon.getCamera(), inspectedPosition, position)
    inspectedPosition = position?.clone() || null
  }
  buildPackets()
  if (appliedSceneAssets !== props.sceneAssets || appliedSceneVisibility !== props.sceneAssetsVisible) {
    syncSceneAssets(babylon.getScene(), props.sceneAssets, props.sceneAssetsVisible, sceneAssetEntries)
    appliedSceneAssets = props.sceneAssets; appliedSceneVisibility = props.sceneAssetsVisible
  }
  const focus = props.sceneFocusRequest
  if (focus && focus !== consumedAssetFocus) {
    const asset = props.sceneAssets.find(item => item.id === focus.id)
    const camera = babylon.getCamera()
    if (asset && camera) {
      viewedNodeId.value = null
      inspectedPosition = null
      const size = sceneAssetBounds(asset.type).size
      inspectModel(camera, worldPos(asset).add(new Vector3(0, size[2] * asset.scale / 2, 0)), Math.max(...size) * asset.scale)
      consumedAssetFocus = focus
    }
  }
  syncSelectedNodePos()
}

const resize = () => {
  if (props.active) babylon.resize()
}

const resetCameraView = () => {
  viewedNodeId.value = null
  inspectedPosition = null
  clearSelection()
  babylon.resetCameraView()
  drawAxesOverlay()
}

const onSceneKeyDown = (event) => {
  if (!props.active || event.defaultPrevented || event.isComposing
    || event.key !== 'Escape' || selectedNodeId.value == null) return
  const focusedElement = document.activeElement
  const restoreCanvasFocus = focusedElement && hostEl.value?.contains(focusedElement)
  clearSelection()
  event.preventDefault()
  if (restoreCanvasFocus) canvasEl.value?.focus({ preventScroll: true })
}

const onCanvasPointerDown = (event) => {
  if (isRoaming.value || !babylon.getCamera() || !canvasEl.value || event.button !== 1) return
  event.preventDefault()
  middlePanPointerId = event.pointerId
  middlePanLast = { x: event.clientX, y: event.clientY }
  try {
    canvasEl.value.setPointerCapture(event.pointerId)
  } catch {
    // ignore
  }
}

const onCanvasPointerMove = (event) => {
  const camera = babylon.getCamera()
  if (!camera || middlePanPointerId !== event.pointerId || !middlePanLast) return
  event.preventDefault()
  const dx = event.clientX - middlePanLast.x
  const dy = event.clientY - middlePanLast.y
  middlePanLast = { x: event.clientX, y: event.clientY }

  const target = camera.getTarget()
  const forward = target.subtract(camera.position).normalize()
  const right = Vector3.Cross(forward, camera.upVector).normalize()
  const up = Vector3.Cross(right, forward).normalize()
  const panScale = camera.radius * 0.0014
  const delta = right.scale(dx * panScale).add(up.scale(dy * panScale))
  babylon.translateCamera(delta)
}

const endMiddlePan = (event) => {
  if (middlePanPointerId === null) return
  if (event && event.pointerId !== middlePanPointerId) return
  if (canvasEl.value) {
    try {
      canvasEl.value.releasePointerCapture(middlePanPointerId)
    } catch {
      // ignore
    }
  }
  middlePanPointerId = null
  middlePanLast = null
}

const cancelRefresh = () => {
  refreshPending = false
}

const queueRefresh = () => {
  if (props.active) refreshPending = true
}

const flushRefresh = () => {
  if (!refreshPending || !props.active || !babylon.getScene()) return
  refreshPending = false
  // Babylon already owns a frame loop. Consume the latest props immediately
  // before its render instead of scheduling another RAF, which can coalesce
  // alternating playback ticks while the previous refresh is still pending.
  refreshScene()
}

onMounted(() => {
  canvasEl.value?.addEventListener('pointerdown', onCanvasPointerDown)
  canvasEl.value?.addEventListener('pointermove', onCanvasPointerMove)
  window.addEventListener('pointerup', endMiddlePan)
  window.addEventListener('pointercancel', endMiddlePan)
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onSceneKeyDown)
  document.addEventListener('pointerdown', onOutsidePointerDown, { capture: true })
  queueRefresh()
})

watch(
  () => props.active ? [props.nodeVisuals, props.visiblePackets, props.currentTime, props.themeKey, props.fxLevel] : null,
  queueRefresh,
)
watch(oceanEnabled, queueRefresh)
watch(worldAxesVisible, queueRefresh)
watch(() => props.active ? [props.sceneAssets, props.sceneAssetsVisible, props.sceneFocusRequest] : null, queueRefresh)

// Geometry may also be edited in place; only read mesh/camera input fields.
watch(
  () => props.active ? [
    props.nodes.map((node) => [node.node_id, node.x, node.y, node.z, node.name, node.role, node.modelType, node.motionDirection]),
    props.topologyNodes?.map((node) => [node.node_id, node.x, node.y, node.z]),
    props.viewNodes?.map((node) => [node.x, node.y, node.z]),
  ] : null,
  queueRefresh,
)

watch(
  () => props.active,
  (active) => {
    cancelRefresh()
    if (!active) {
      endMiddlePan()
      selectedNodePos.value = null
      babylon.setActive(false)
      return
    }
    // Hidden scenes skip mesh updates; sync current data before rendering again.
    queueRefresh()
    flushRefresh()
    babylon.setActive(active)
    drawAxesOverlay()
    syncSelectedNodePos()
  },
  /* flush: 'post' —— 等 v-show 的 display 切换落进 DOM 后再 resize/read，
     否则 engine.resize() 读到的是隐藏状态的 0 尺寸 */
  { flush: 'post' },
)

onBeforeUnmount(() => {
  // Mesh/material disposal runs in the babylon cleanup hook (before scene
  // disposal); here we only release DOM/window listeners.
  cancelRefresh()
  endMiddlePan()
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointerup', endMiddlePan)
  window.removeEventListener('pointercancel', endMiddlePan)
  window.removeEventListener('keydown', onSceneKeyDown)
  document.removeEventListener('pointerdown', onOutsidePointerDown, { capture: true })
  cardObserver?.disconnect()
  if (canvasEl.value) {
    canvasEl.value.removeEventListener('pointerdown', onCanvasPointerDown)
    canvasEl.value.removeEventListener('pointermove', onCanvasPointerMove)
  }
})
</script>

<style scoped>
.scene-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.scene-host:fullscreen {
  width: 100vw;
  height: 100vh;
}

.scene-live-status { position:absolute; left:14px; bottom:92px; z-index:2; display:flex; align-items:center; gap:12px; padding:9px 13px; border:1px solid var(--line); border-radius:var(--r-md); background:var(--panel); color:var(--text); backdrop-filter:blur(10px); font-size:12px; }
.scene-live-status strong { font-weight:500; color:var(--muted); }
.scene-live-status.tx strong { color:var(--tx); }.scene-live-status.rx strong,.scene-live-status.rx-done strong { color:var(--rx); }
.scene-live-status.collision strong,.scene-live-status.collision-linger strong,.scene-live-status.has-conflict strong { color:var(--bad); }
.scene-live-progress { width:70px; height:3px; background:var(--line-strong); overflow:hidden; border-radius:3px; }
.scene-live-progress i { display:block; width:100%; height:100%; transform-origin:left; background:var(--rx); }
.tx .scene-live-progress i { background:var(--tx); }

.scene-canvas {
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
}

.scene-axes {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  width: 84px;
  height: 84px;
  border-radius: var(--r-md, 10px);
  border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
  background: var(--panel, rgba(17, 23, 34, 0.88));
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-island, 0 14px 40px rgba(0, 0, 0, 0.5));
  cursor: pointer;
  transition: transform 130ms ease, filter 170ms ease;
}

.scene-axes:hover {
  filter: brightness(1.07);
}
.scene-axes:active {
  transform: translateY(1.4px) scale(0.96);
}

.scene-help {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  display: inline-flex;
  gap: 0.55rem;
  align-items: center;
  flex-wrap: wrap;
  max-width: min(540px, max(220px, calc(50% - 200px)));
  padding: 0.4rem 0.65rem;
  border-radius: var(--r-md, 10px);
  border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
  background: var(--panel, rgba(17, 23, 34, 0.88));
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-island, 0 14px 40px rgba(0, 0, 0, 0.5));
  color: var(--muted, #8b93a5);
  font-size: 0.74rem;
}

.scene-help select { max-width: 180px; min-width: 80px; padding: .24rem .4rem; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--panel); color: var(--text); font: inherit; cursor: pointer; }
.scene-help select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.scene-help button {
  padding: 0.24rem 0.5rem;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}

.scene-help button:hover,
.scene-help button.active {
  color: var(--accent-soft);
  border-color: var(--accent-soft);
}

.scene-help button:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 2px;
}

.scene-key-help {
  font-size: 0.68rem;
}

.scene-reticle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 5px;
  height: 5px;
  transform: translate(-50%, -50%);
  border: 1px solid var(--text);
  border-radius: 50%;
  opacity: 0.65;
  pointer-events: none;
}

.scene-navigation-error {
  position: absolute;
  left: 12px;
  top: 64px;
  z-index: 2;
  max-width: calc(100% - 24px);
  padding: 0.4rem 0.65rem;
  border-radius: var(--r-sm);
  background: var(--panel);
  color: var(--text);
  font-size: 0.75rem;
}

.scene-help span:first-child {
  color: var(--accent-soft, #8fd9ff);
  font-weight: 600;
}

.scene-tooltip {
  position: absolute;
  z-index: 2;
  background: var(--panel, rgba(17, 23, 34, 0.88));
  backdrop-filter: blur(10px);
  border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
  border-radius: var(--r-md, 10px);
  padding: 0.5rem 0.65rem;
  width: 260px;
  max-width: calc(100% - 16px);
  max-height: calc(100% - 16px);
  overflow: auto;
  box-sizing: border-box;
  box-shadow: var(--shadow-pop, 0 18px 48px rgba(0, 0, 0, 0.55));
  pointer-events: auto;
}

.scene-model-size { display: flex; gap: 8px; align-items: center; justify-content: space-between; margin-top: 9px; color: var(--muted); font: 10px var(--font-mono); }
.scene-model-size button { background: var(--sunken); border: 1px solid var(--line); border-radius: var(--r-sm); color: var(--text); cursor: pointer; padding: 5px 8px; font: 11px var(--font-ui); }
.scene-card-close { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; padding: 0; border: 0; border-radius: var(--r-sm); background: transparent; color: var(--muted); cursor: pointer; font-size: 18px; }
.scene-card-close:hover { background: var(--raised); color: var(--text); }
.scene-card-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.scene-tooltip-title {
  margin: 0;
  padding-right: 24px;
  overflow-wrap: anywhere;
  font-size: 0.88rem;
  color: var(--text, #e8ecf3);
  font-weight: 700;
}

.scene-tooltip-role {
  font-size: 0.7rem;
  margin-left: 0.35rem;
  color: var(--accent-soft, #8fd9ff);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scene-tooltip-row {
  margin: 0.18rem 0 0;
  color: var(--muted, #8b93a5);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1680px), (max-height: 980px) {
  .scene-help {
    top: 8px;
    left: 8px;
    gap: 0.35rem;
    padding: 0.28rem 0.45rem;
    font-size: 0.68rem;
  }

  .scene-axes {
    top: 8px;
    right: 8px;
    width: 64px;
    height: 64px;
  }

  .scene-tooltip {
    width: 240px;
    padding: 0.35rem 0.5rem;
  }
}
</style>
