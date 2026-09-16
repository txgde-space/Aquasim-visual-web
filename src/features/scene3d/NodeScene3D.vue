<template>
  <div ref="hostEl" class="scene-host">
    <canvas ref="canvasEl" class="scene-canvas" />
    <canvas
      ref="axesEl"
      class="scene-axes"
      width="84"
      height="84"
      @click="resetCameraView"
      title="重置 3D 视角"
    />
    <div class="scene-help" @pointerdown.stop>
      <span>3D 视图</span>
      <span>拖动旋转</span>
      <span>滚轮缩放</span>
      <span>点击节点查看</span>
    </div>

    <div
      v-if="selectedNodePos && selectedNode"
      class="scene-tooltip"
      :style="{ left: `${selectedNodePos.x}px`, top: `${selectedNodePos.y}px` }"
    >
      <p class="scene-tooltip-title">
        {{ selectedNode.name }}（{{ selectedNode.node_id }}）
        <span class="scene-tooltip-role">{{ selectedNode.role }}</span>
      </p>
      <p class="scene-tooltip-row">x: {{ selectedNode.x.toFixed(2) }}m, y: {{ selectedNode.y.toFixed(2) }}m, z: {{ Number(selectedNode.z ?? 0).toFixed(2) }}m</p>
      <p v-if="selectedNodeVisual" class="scene-tooltip-row">状态：{{ selectedNodeVisual.statusText }}</p>
      <p v-if="selectedNodeVisual?.packetId" class="scene-tooltip-row">关联包：{{ selectedNodeVisual.packetId }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Matrix, MeshBuilder, Vector3, Viewport } from '@babylonjs/core'
import {
  DEPTH_SCALE,
  PROGRESS_CORE_SCALE,
  clamp,
  packetColor,
  theme3DFor,
  worldPos,
} from '@/features/scene3d/lib/themes3d'
import {
  createNodeEntry,
  createPacketEntry,
  disposeNodeEntry,
  disposePacketEntry,
  setMaterialColor,
  syncMaterialColor,
  visualProgressStyle,
  visualStateColor,
} from '@/features/scene3d/lib/factories'
import {
  disposeWorldAxisEntry,
  drawAxesWidget,
  syncWorldAxes,
} from '@/features/scene3d/lib/worldAxes'
import { useBabylonScene } from '@/features/scene3d/lib/useBabylonScene'

const props = defineProps({
  nodes: { type: Array, required: true },
  nodeVisuals: { type: Array, required: true },
  visiblePackets: { type: Array, default: () => [] },
  currentTime: { type: Number, required: true },
  themeKey: { type: String, default: 'ocean-sonar' },
  fxLevel: { type: String, default: 'standard' },
})

const hostEl = ref(null)
const canvasEl = ref(null)
const axesEl = ref(null)
const selectedNode = ref(null)
const selectedNodePos = ref(null)

const nodeById = computed(() => new Map(props.nodes.map((node) => [node.node_id, node])))
const nodeVisualById = computed(() => new Map(props.nodeVisuals.map((visual) => [visual.node_id, visual])))
const selectedNodeVisual = computed(() => {
  if (!selectedNode.value) return null
  return nodeVisualById.value.get(selectedNode.value.node_id) || null
})

const nodeLabel = (node) => `Node ${node.node_id}`
const nodeTitle = (node) => node.name ? `${nodeLabel(node)} · ${node.name}` : nodeLabel(node)

const theme3D = computed(() => theme3DFor(props.themeKey))
const fx3D = computed(() => (props.fxLevel === 'extreme' ? 1.85 : 1))

let nodeMeshMap = new Map()
let packetMeshMap = new Map()
const worldAxesMap = new Map()
/** Consecutive refreshes a packet entry survives while inactive before disposal. */
const PACKET_ENTRY_STALE_REFRESHES = 3
const packetStaleCounts = new Map()
let renderQueued = false
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
    new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight()),
  )
  selectedNodePos.value = {
    x: projected.x,
    y: projected.y,
  }
}

const drawAxesOverlay = () => {
  const camera = babylon.getCamera()
  if (!axesEl.value || !camera) return
  drawAxesWidget(axesEl.value, camera)
}

const babylon = useBabylonScene({
  canvasRef: canvasEl,
  hostRef: hostEl,
  getClearColor: () => theme3D.value.clear,
  onPick: (nodeId) => {
    if (!nodeId) {
      selectedNode.value = null
      selectedNodePos.value = null
      return
    }
    selectedNode.value = nodeById.value.get(nodeId) || null
    syncSelectedNodePos()
  },
  onFrame: () => {
    syncSelectedNodePos()
    drawAxesOverlay()
  },
  cleanup: () => {
    for (const entry of nodeMeshMap.values()) disposeNodeEntry(entry)
    nodeMeshMap.clear()
    for (const entry of packetMeshMap.values()) disposePacketEntry(entry)
    packetMeshMap.clear()
    packetStaleCounts.clear()
    for (const entry of worldAxesMap.values()) disposeWorldAxisEntry(entry)
    worldAxesMap.clear()
  },
})

const buildNodes = () => {
  const scene = babylon.getScene()
  if (!scene) return
  const palette = theme3D.value
  const fx = fx3D.value
  for (const node of props.nodes) {
    const visual = nodeVisualById.value.get(node.node_id)
    const pos = worldPos(node)
    let entry = nodeMeshMap.get(node.node_id)
    if (!entry) {
      entry = createNodeEntry(scene, node.node_id, palette)
      nodeMeshMap.set(node.node_id, entry)
    }

    entry.base.position.copyFrom(pos)
    entry.progress.position.copyFrom(pos)
    entry.base.setEnabled(true)
    const isSink = node.role === 'sink' || /sink/i.test(String(node.name || ''))
    if (fx > 1) {
      const pulse = 1 + (Math.sin((props.currentTime * 0.000004) + (node.node_id * 0.35)) * 0.02)
      if (isSink) {
        entry.base.scaling.set(1.72 * pulse, 0.42 * pulse, 0.66 * pulse)
      } else {
        entry.base.scaling.set(1.36 * pulse, 0.44 * pulse, 0.56 * pulse)
      }
    } else {
      if (isSink) entry.base.scaling.set(1.62, 0.4, 0.62)
      else entry.base.scaling.setAll(1)
    }
    entry.progress.setEnabled(true)
    entry.progress.scaling.setAll(0.01)
    syncMaterialColor(entry.progress.material, {
      diffuse: palette.rx,
      emissive: palette.rx.scale(0.28),
      alpha: 0,
    })
    const state = visualStateColor(visual, palette)
    syncMaterialColor(entry.base.material, state)
    if (isSink) {
      entry.sinkBridge.setEnabled(true)
      entry.sinkMast.setEnabled(true)

      const pulse = 1 + (Math.sin((props.currentTime * 0.0000034) + (node.node_id * 0.31)) * 0.018)
      entry.sinkBridge.position.copyFromFloats(pos.x + 48, pos.y + 52, pos.z)
      entry.sinkBridge.scaling.set(1.04 * pulse, 1.02 * pulse, 1.1 * pulse)
      entry.sinkMast.position.copyFromFloats(pos.x + 74, pos.y + 122, pos.z)
      entry.sinkMast.scaling.set(1, 1 + (Math.sin((props.currentTime * 0.000006) + node.node_id) * 0.04), 1)

      syncMaterialColor(entry.sinkBridge.material, {
        diffuse: state.diffuse.scale(0.88),
        emissive: state.emissive.scale(0.92),
        alpha: state.alpha,
      })
      syncMaterialColor(entry.sinkMast.material, {
        diffuse: state.diffuse.scale(1.05),
        emissive: state.emissive.scale(1.14),
        alpha: state.alpha,
      })
    } else {
      entry.sinkBridge.setEnabled(false)
      entry.sinkMast.setEnabled(false)
    }
    const progressStyle = visualProgressStyle(visual, palette)
    if (progressStyle && progressStyle.alpha > 0.001) {
      entry.progress.scaling.set(
        progressStyle.scaleX ?? PROGRESS_CORE_SCALE,
        progressStyle.scaleY ?? PROGRESS_CORE_SCALE,
        progressStyle.scaleZ ?? PROGRESS_CORE_SCALE,
      )
      syncMaterialColor(entry.progress.material, progressStyle)
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
      if (now < packet.tx_start_us || now > receiver.rx_end_us) continue
      const dstNode = nodeById.value.get(receiver.dst)
      if (!dstNode) continue
      const key = `${packet.packet_id}:${receiver.dst}`
      activeKeys.add(key)

      const dstPos = worldPos(dstNode)
      const pathDuration = Math.max(1, receiver.rx_start_us - packet.tx_start_us)
      const frontRatio = clamp((now - packet.tx_start_us) / pathDuration, 0, 1)
      const tailRatio = clamp((now - (packet.tx_start_us + packet.tx_duration_us)) / pathDuration, 0, 1)
      const startRatio = Math.min(frontRatio, tailRatio)
      const endRatio = Math.max(frontRatio, tailRatio)
      if (endRatio <= 0) continue

      const fullDirection = dstPos.subtract(srcPos)
      const pathLength = fullDirection.length()
      if (pathLength < 1) continue
      const segLength = Math.max(80, pathLength * Math.max(0.001, endRatio - startRatio))
      const midPos = srcPos.add(fullDirection.scale((startRatio + endRatio) / 2))
      const color = packetColor(receiver, now, palette)

      let entry = packetMeshMap.get(key)
      if (!entry) {
        entry = createPacketEntry(scene, packet.packet_id, receiver.dst, srcPos, dstPos, palette, color)
        packetMeshMap.set(key, entry)
      }
      packetStaleCounts.delete(key)

      MeshBuilder.CreateLines(null, {
        points: [srcPos, dstPos],
        instance: entry.line,
      })
      entry.line.setEnabled(true)
      entry.line.alpha = fx > 1 ? 0.62 : 0.52
      entry.line.color = palette.line
      entry.block.setEnabled(true)
      entry.marker.setEnabled(now >= receiver.rx_start_us)

      entry.block.position.copyFrom(midPos)
      entry.block.scaling.x = fx > 1 ? 1.15 : 1
      entry.block.scaling.y = segLength / 100
      entry.block.scaling.z = fx > 1 ? 1.15 : 1
      entry.block.rotationQuaternion = null
      entry.block.lookAt(dstPos)
      entry.block.rotate(Vector3.Right(), Math.PI / 2)
      const pulseAlpha = fx > 1
        ? (0.78 + ((Math.sin((now * 0.000009) + segLength) + 1) * 0.08))
        : 0.96
      setMaterialColor(entry.block.material, color, color.scale(0.12 * fx), pulseAlpha)

      entry.marker.position.copyFrom(dstPos)
      entry.marker.scaling.setAll(1)
      setMaterialColor(
        entry.marker.material,
        color,
        color.scale(0.12 * fx),
        Math.min(0.82, palette.markerAlpha * fx),
      )
    }
  }

  for (const [key, entry] of packetMeshMap.entries()) {
    if (activeKeys.has(key)) continue
    entry.line.setEnabled(false)
    entry.block.setEnabled(false)
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

const updateCameraTarget = () => {
  if (!babylon.getCamera() || !props.nodes.length) return
  const xs = props.nodes.map((node) => node.x)
  const ys = props.nodes.map((node) => node.y)
  const zs = props.nodes.map((node) => -(node.z ?? 0) * DEPTH_SCALE)
  const center = new Vector3(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  )
  babylon.focusCamera(center)
}

// World axes only depend on node bounds; skip the rebuild (which redraws a
// dozen DynamicTexture labels) while bounds stay unchanged during playback.
let worldAxesSignature = ''

const syncWorldAxesIfNeeded = () => {
  const scene = babylon.getScene()
  if (!scene) return
  if (!props.nodes.length) {
    worldAxesSignature = ''
    return
  }
  const xs = props.nodes.map((node) => node.x)
  const ys = props.nodes.map((node) => node.y)
  const zs = props.nodes.map((node) => -(node.z ?? 0) * DEPTH_SCALE)
  const signature = [
    props.nodes.length,
    Math.min(...xs), Math.max(...xs),
    Math.min(...zs), Math.max(...zs),
    Math.min(...ys), Math.max(...ys),
  ].map((value) => Math.round(value * 10) / 10).join(',')
  if (signature === worldAxesSignature) return
  worldAxesSignature = signature
  syncWorldAxes(scene, props.nodes, worldAxesMap)
}

const refreshScene = () => {
  if (!babylon.getScene()) return
  updateCameraTarget()
  syncWorldAxesIfNeeded()
  buildNodes()
  buildPackets()
  syncSelectedNodePos()
}

const resize = () => {
  babylon.resize()
}

const resetCameraView = () => {
  babylon.resetCameraView()
  drawAxesOverlay()
}

const onCanvasPointerDown = (event) => {
  if (!babylon.getCamera() || !canvasEl.value || event.button !== 1) return
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
  camera.target.addInPlace(delta)
  babylon.focusCamera(camera.getTarget())
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

const queueRefresh = () => {
  if (renderQueued) return
  renderQueued = true
  requestAnimationFrame(() => {
    renderQueued = false
    refreshScene()
  })
}

onMounted(() => {
  canvasEl.value?.addEventListener('pointerdown', onCanvasPointerDown)
  canvasEl.value?.addEventListener('pointermove', onCanvasPointerMove)
  window.addEventListener('pointerup', endMiddlePan)
  window.addEventListener('pointercancel', endMiddlePan)
  window.addEventListener('resize', resize)
  queueRefresh()
})

watch(
  () => [props.nodes, props.nodeVisuals, props.visiblePackets, props.currentTime, props.themeKey, props.fxLevel],
  () => queueRefresh(),
  { deep: true },
)

watch(
  () => props.themeKey,
  () => {
    babylon.setClearColor(theme3D.value.clear)
    queueRefresh()
  },
)

watch(
  () => props.fxLevel,
  () => {
    queueRefresh()
  },
)

onBeforeUnmount(() => {
  // Mesh/material disposal runs in the babylon cleanup hook (before scene
  // disposal); here we only release DOM/window listeners.
  endMiddlePan()
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointerup', endMiddlePan)
  window.removeEventListener('pointercancel', endMiddlePan)
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
  padding: 0.4rem 0.65rem;
  border-radius: var(--r-md, 10px);
  border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
  background: var(--panel, rgba(17, 23, 34, 0.88));
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-island, 0 14px 40px rgba(0, 0, 0, 0.5));
  color: var(--muted, #8b93a5);
  font-size: 0.74rem;
}

.scene-help span:first-child {
  color: var(--accent-soft, #8fd9ff);
  font-weight: 600;
}

.scene-tooltip {
  position: absolute;
  transform: translate(14px, -50%);
  z-index: 2;
  background: var(--panel, rgba(17, 23, 34, 0.88));
  backdrop-filter: blur(10px);
  border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
  border-radius: var(--r-md, 10px);
  padding: 0.5rem 0.65rem;
  min-width: 200px;
  box-shadow: var(--shadow-pop, 0 18px 48px rgba(0, 0, 0, 0.55));
  pointer-events: none;
}

.scene-tooltip-title {
  margin: 0;
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
    min-width: 160px;
    padding: 0.35rem 0.5rem;
  }
}
</style>
