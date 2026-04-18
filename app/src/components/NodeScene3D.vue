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
      <span>Babylon 3D 视图</span>
      <span>左键拖动旋转</span>
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
      <p class="scene-tooltip-row">x: {{ selectedNode.x.toFixed(1) }}m, y: {{ selectedNode.y.toFixed(1) }}m, z: {{ selectedNode.z ?? 0 }}m</p>
      <p v-if="selectedNodeVisual" class="scene-tooltip-row">状态：{{ selectedNodeVisual.statusText }}</p>
      <p v-if="selectedNodeVisual?.packetId" class="scene-tooltip-row">关联包：{{ selectedNodeVisual.packetId }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DynamicTexture,
  Engine,
  GlowLayer,
  HemisphericLight,
  Matrix,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  Vector3,
  Viewport,
} from '@babylonjs/core'

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

let engine = null
let scene = null
let camera = null
let resizeObserver = null
let pointerObserver = null
let nodeMeshes = []
let packetMeshes = []
let nodeMeshMap = new Map()
let packetMeshMap = new Map()
let worldAxesMap = new Map()
let renderQueued = false
let defaultCameraState = null
let middlePanPointerId = null
let middlePanLast = null
let glowLayer = null

const NODE_RADIUS = 130
const DEPTH_SCALE = 38
const PATH_BLOCK_DIAMETER = 34
const PROGRESS_CORE_SCALE = 0.94
const AXIS_X_COLOR = new Color3(0.9725, 0.4431, 0.4431)
const AXIS_Y_COLOR = new Color3(0.2902, 0.8706, 0.502)
const AXIS_Z_COLOR = new Color3(0.3765, 0.6471, 0.9804)
const color3 = (hex) => Color3.FromHexString(hex)
const THEME_3D = Object.freeze({
  'ocean-sonar': {
    clear: new Color4(0.03, 0.07, 0.13, 1),
    idleDiffuse: color3('#2963eb'),
    idleEmissive: color3('#123066'),
    tx: color3('#f59e0b'),
    rx: color3('#22c55e'),
    bad: color3('#dc2626'),
    line: color3('#6f8bbd'),
    markerAlpha: 0.45,
  },
  'research-lab': {
    clear: new Color4(0.05, 0.08, 0.16, 1),
    idleDiffuse: color3('#3b82f6'),
    idleEmissive: color3('#1e3a8a'),
    tx: color3('#f59e0b'),
    rx: color3('#10b981'),
    bad: color3('#ef4444'),
    line: color3('#7b9ac8'),
    markerAlpha: 0.42,
  },
  'tactical-ops': {
    clear: new Color4(0.04, 0.08, 0.04, 1),
    idleDiffuse: color3('#65a30d'),
    idleEmissive: color3('#1f4c2c'),
    tx: color3('#f59e0b'),
    rx: color3('#4ade80'),
    bad: color3('#ef4444'),
    line: color3('#7faa4b'),
    markerAlpha: 0.45,
  },
  'industrial-scada': {
    clear: new Color4(0.04, 0.08, 0.12, 1),
    idleDiffuse: color3('#0ea5e9'),
    idleEmissive: color3('#164e63'),
    tx: color3('#f97316'),
    rx: color3('#14b8a6'),
    bad: color3('#ef4444'),
    line: color3('#6d90a6'),
    markerAlpha: 0.42,
  },
  'cyber-neon': {
    clear: new Color4(0.08, 0.03, 0.12, 1),
    idleDiffuse: color3('#c026d3'),
    idleEmissive: color3('#4a145f'),
    tx: color3('#f97316'),
    rx: color3('#2dd4bf'),
    bad: color3('#fb7185'),
    line: color3('#b26ac6'),
    markerAlpha: 0.48,
  },
  'light-minimal': {
    clear: new Color4(0.84, 0.9, 0.97, 1),
    idleDiffuse: color3('#2563eb'),
    idleEmissive: color3('#93c5fd'),
    tx: color3('#f97316'),
    rx: color3('#16a34a'),
    bad: color3('#dc2626'),
    line: color3('#64748b'),
    markerAlpha: 0.36,
  },
  'gis-map': {
    clear: new Color4(0.05, 0.11, 0.1, 1),
    idleDiffuse: color3('#0f766e'),
    idleEmissive: color3('#14532d'),
    tx: color3('#f59e0b'),
    rx: color3('#22c55e'),
    bad: color3('#ef4444'),
    line: color3('#6ba58c'),
    markerAlpha: 0.44,
  },
  'timeline-story': {
    clear: new Color4(0.08, 0.07, 0.14, 1),
    idleDiffuse: color3('#4f46e5'),
    idleEmissive: color3('#312e81'),
    tx: color3('#f59e0b'),
    rx: color3('#60a5fa'),
    bad: color3('#f43f5e'),
    line: color3('#9f8fc6'),
    markerAlpha: 0.45,
  },
})
const theme3D = computed(() => THEME_3D[props.themeKey] || THEME_3D['ocean-sonar'])
const fx3D = computed(() => (props.fxLevel === 'extreme' ? 1.85 : 1))

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const worldPos = (node) => new Vector3(node.x, -(node.z ?? 0) * DEPTH_SCALE, node.y)

const packetColor = (receiver, now, palette) => {
  if (now < receiver.rx_start_us) return palette.tx
  if (receiver.status === 'ok') return palette.rx
  if (receiver.reason === 'collision_rx_rx') {
    const collisionAt = receiver.collision_start_us ?? receiver.rx_start_us
    return now < collisionAt ? palette.rx : palette.bad
  }
  if (receiver.reason === 'collision_rx_tx') {
    return now < receiver.rx_start_us ? palette.tx : palette.bad
  }
  return palette.bad
}

const disposeMeshList = (list) => {
  for (const item of list) item.dispose()
  list.length = 0
}

const disposeEntryMap = (map) => {
  for (const entry of map.values()) {
    Object.values(entry).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item && typeof item.dispose === 'function') item.dispose()
          else if (item && typeof item === 'object') {
            Object.values(item).forEach((nested) => {
              if (nested && typeof nested.dispose === 'function') nested.dispose()
            })
          }
        })
        return
      }
      if (value && typeof value.dispose === 'function') value.dispose()
    })
  }
  map.clear()
}

const makeMaterial = (name, diffuse, emissive = null, alpha = 1) => {
  const material = new StandardMaterial(name, scene)
  material.diffuseColor = diffuse
  material.specularColor = new Color3(0.12, 0.18, 0.26)
  material.emissiveColor = emissive || Color3.Black()
  material.alpha = alpha
  return material
}

const bindNodeMeta = (mesh, nodeId) => {
  mesh.metadata = { nodeId }
  return mesh
}

const setMaterialColor = (material, diffuse, emissive = null, alpha = 1) => {
  if (!material) return
  material.diffuseColor = diffuse
  material.emissiveColor = emissive || Color3.Black()
  material.alpha = alpha
}

const syncMaterialColor = (material, next) => {
  if (!material || !next) return
  const stateKey = [
    next.diffuse.r.toFixed(4),
    next.diffuse.g.toFixed(4),
    next.diffuse.b.toFixed(4),
    (next.emissive || Color3.Black()).r.toFixed(4),
    (next.emissive || Color3.Black()).g.toFixed(4),
    (next.emissive || Color3.Black()).b.toFixed(4),
    Number(next.alpha ?? 1).toFixed(4),
  ].join(':')

  if (material.metadata?.stateKey === stateKey) return
  setMaterialColor(material, next.diffuse, next.emissive, next.alpha)
  material.metadata = { ...(material.metadata || {}), stateKey }
}

const visualStateColor = (visual, palette) => {
  return { diffuse: palette.idleDiffuse, emissive: palette.idleEmissive, alpha: 1 }
}

const visualProgressStyle = (visual, palette) => {
  if (!visual) return null
  if (visual.mode === 'tx') {
    if (visual.overlay?.kind === 'collision_rx_tx') {
      return {
        diffuse: palette.bad,
        emissive: palette.bad.scale(0.44),
        alpha: 0.98,
        scaleX: PROGRESS_CORE_SCALE,
        scaleY: PROGRESS_CORE_SCALE,
        scaleZ: PROGRESS_CORE_SCALE,
      }
    }
    return {
      diffuse: palette.tx,
      emissive: palette.tx.scale(0.36),
      alpha: 0.68,
      scaleX: 0.08 + (PROGRESS_CORE_SCALE * Math.max(0, Math.min(1, visual.fillProgress ?? 0))),
      scaleY: 0.08 + (PROGRESS_CORE_SCALE * Math.max(0, Math.min(1, visual.fillProgress ?? 0))),
      scaleZ: 0.08 + (PROGRESS_CORE_SCALE * Math.max(0, Math.min(1, visual.fillProgress ?? 0))),
    }
  }
  if (visual.mode === 'rx') {
    return {
      diffuse: palette.rx,
      emissive: palette.rx.scale(0.4),
      alpha: 0.82,
      scaleX: 0.08 + (PROGRESS_CORE_SCALE * Math.max(0, Math.min(1, visual.fillProgress ?? 0))),
      scaleY: 0.08 + (PROGRESS_CORE_SCALE * Math.max(0, Math.min(1, visual.fillProgress ?? 0))),
      scaleZ: 0.08 + (PROGRESS_CORE_SCALE * Math.max(0, Math.min(1, visual.fillProgress ?? 0))),
    }
  }
  if (visual.mode === 'rx-done') {
    return {
      diffuse: palette.rx,
      emissive: palette.rx.scale(0.4),
      alpha: (visual.fade ?? 1) * 0.78,
      scaleX: PROGRESS_CORE_SCALE,
      scaleY: PROGRESS_CORE_SCALE,
      scaleZ: PROGRESS_CORE_SCALE,
    }
  }
  if (visual.mode === 'collision' || visual.mode === 'collision-linger') {
    return {
      diffuse: palette.bad,
      emissive: palette.bad.scale(0.44),
      alpha: Math.max(0, (visual.fade ?? 1) * 0.72),
      scaleX: PROGRESS_CORE_SCALE,
      scaleY: PROGRESS_CORE_SCALE,
      scaleZ: PROGRESS_CORE_SCALE,
    }
  }
  return null
}

const syncSelectedNodePos = () => {
  if (!selectedNode.value || !camera || !engine || !hostEl.value) {
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

const buildNodes = () => {
  const palette = theme3D.value
  const fx = fx3D.value
  for (const node of props.nodes) {
    const visual = nodeVisualById.value.get(node.node_id)
    const pos = worldPos(node)
    let entry = nodeMeshMap.get(node.node_id)
    if (!entry) {
      const base = bindNodeMeta(MeshBuilder.CreateSphere(`node-${node.node_id}-base`, {
        diameter: NODE_RADIUS * 2,
        segments: 22,
      }, scene), node.node_id)
      base.material = makeMaterial(
        `node-${node.node_id}-base-mat`,
        palette.idleDiffuse,
        palette.idleEmissive,
        1,
      )
      const progress = bindNodeMeta(MeshBuilder.CreateSphere(`node-${node.node_id}-progress`, {
        diameter: NODE_RADIUS * 2,
        segments: 18,
      }, scene), node.node_id)
      progress.position = pos.clone()
      progress.material = makeMaterial(
        `node-${node.node_id}-progress-mat`,
        palette.rx,
        palette.rx.scale(0.28),
        0,
      )
      progress.material.backFaceCulling = false
      progress.material.needDepthPrePass = true
      progress.renderingGroupId = 1

      entry = { base, progress }
      nodeMeshMap.set(node.node_id, entry)
      nodeMeshes.push(base, progress)
    }

    entry.base.position.copyFrom(pos)
    entry.progress.position.copyFrom(pos)
    entry.base.setEnabled(true)
    if (fx > 1) {
      const pulse = 1 + (Math.sin((props.currentTime * 0.000004) + (node.node_id * 0.35)) * 0.02)
      entry.base.scaling.setAll(pulse)
    } else {
      entry.base.scaling.setAll(1)
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
    const progressStyle = visualProgressStyle(visual, palette)
    if (progressStyle) {
      if (progressStyle.alpha > 0.001) {
        entry.progress.scaling.set(
          progressStyle.scaleX ?? PROGRESS_CORE_SCALE,
          progressStyle.scaleY ?? PROGRESS_CORE_SCALE,
          progressStyle.scaleZ ?? PROGRESS_CORE_SCALE,
        )
        syncMaterialColor(entry.progress.material, progressStyle)
      }
    }
  }

  for (const [nodeId, entry] of nodeMeshMap.entries()) {
    if (nodeById.value.has(nodeId)) continue
    entry.base.dispose()
    entry.progress.dispose()
    nodeMeshMap.delete(nodeId)
  }
}

const buildPackets = () => {
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
      const pathDirection = fullDirection.clone().normalize()
      const segLength = Math.max(80, pathLength * Math.max(0.001, endRatio - startRatio))
      const midPos = srcPos.add(fullDirection.scale((startRatio + endRatio) / 2))
      const color = packetColor(receiver, now, palette)

      let entry = packetMeshMap.get(key)
      if (!entry) {
        const line = MeshBuilder.CreateLines(`packet-${packet.packet_id}-${receiver.dst}-line`, {
          points: [srcPos, dstPos],
          updatable: true,
        }, scene)
        line.color = palette.line
        line.alpha = 0.52

        const block = MeshBuilder.CreateCylinder(`packet-${packet.packet_id}-${receiver.dst}-block`, {
          diameter: PATH_BLOCK_DIAMETER,
          height: 100,
          tessellation: 20,
        }, scene)
        block.material = makeMaterial(`packet-${packet.packet_id}-${receiver.dst}-mat`, color, color.scale(0.12), 0.96)

        const marker = MeshBuilder.CreateSphere(`packet-${packet.packet_id}-${receiver.dst}-marker`, {
          diameter: 70,
          segments: 14,
        }, scene)
        marker.material = makeMaterial(`packet-${packet.packet_id}-${receiver.dst}-marker-mat`, color, color.scale(0.12), palette.markerAlpha)

        entry = { line, block, marker }
        packetMeshMap.set(key, entry)
        packetMeshes.push(line, block, marker)
      }

      MeshBuilder.CreateLines(null, {
        points: [srcPos, dstPos],
        instance: entry.line,
      })
      entry.line.setEnabled(true)
      entry.block.setEnabled(true)
      entry.marker.setEnabled(now >= receiver.rx_start_us)

      entry.block.position.copyFrom(midPos)
      entry.block.scaling.x = fx > 1 ? 1.15 : 1
      entry.block.scaling.y = segLength / 100
      entry.block.scaling.z = fx > 1 ? 1.15 : 1
      entry.block.rotationQuaternion = null
      entry.block.lookAt(dstPos)
      entry.block.rotate(Vector3.Right(), Math.PI / 2)
      const pulseAlpha = fx > 1 ? (0.78 + ((Math.sin((now * 0.000009) + segLength) + 1) * 0.08)) : 0.96
      setMaterialColor(entry.block.material, color, color.scale(0.12 * fx), pulseAlpha)

      entry.marker.position.copyFrom(dstPos)
      setMaterialColor(entry.marker.material, color, color.scale(0.12 * fx), Math.min(0.82, palette.markerAlpha * fx))
    }
  }

  for (const [key, entry] of packetMeshMap.entries()) {
    if (activeKeys.has(key)) continue
    entry.line.setEnabled(false)
    entry.block.setEnabled(false)
    entry.marker.setEnabled(false)
  }
}

const buildWorldAxes = () => {
  if (!props.nodes.length) return

  const xs = props.nodes.map((node) => node.x)
  const ys = props.nodes.map((node) => node.y)
  const zs = props.nodes.map((node) => -(node.z ?? 0) * DEPTH_SCALE)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...zs)
  const maxY = Math.max(...zs)
  const minZ = Math.min(...ys)
  const maxZ = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1)
  const padding = Math.max(220, span * 0.08)
  const axisLen = Math.max(maxX - minX, maxY - minY, maxZ - minZ) + (padding * 2)
  const origin = new Vector3(
    minX - padding,
    minY - padding,
    minZ - padding,
  )

  const specs = [
    {
      key: 'x',
      color: AXIS_X_COLOR,
      end: new Vector3(origin.x + axisLen, origin.y, origin.z),
      unit: new Vector3(1, 0, 0),
    },
    {
      key: 'y',
      color: AXIS_Y_COLOR,
      end: new Vector3(origin.x, origin.y + axisLen, origin.z),
      unit: new Vector3(0, 1, 0),
    },
    {
      key: 'z',
      color: AXIS_Z_COLOR,
      end: new Vector3(origin.x, origin.y, origin.z + axisLen),
      unit: new Vector3(0, 0, 1),
    },
  ]
  const tickCount = 5
  const tickSpacing = axisLen / tickCount
  const tickLen = Math.max(36, axisLen * 0.012)
  const tickOffsets = {
    x: new Vector3(0, tickLen, 0),
    y: new Vector3(tickLen, 0, 0),
    z: new Vector3(0, tickLen, 0),
  }

  for (const spec of specs) {
    let entry = worldAxesMap.get(spec.key)
    if (!entry) {
      const line = MeshBuilder.CreateLines(`world-axis-${spec.key}`, {
        points: [origin, spec.end],
        updatable: true,
      }, scene)
      line.color = spec.color
      line.alpha = 0.24

      const tip = MeshBuilder.CreateSphere(`world-axis-${spec.key}-tip`, {
        diameter: 34,
        segments: 10,
      }, scene)
      tip.material = makeMaterial(`world-axis-${spec.key}-tip-mat`, spec.color, spec.color.scale(0.08), 0.28)

      const ticks = Array.from({ length: tickCount - 1 }, (_, index) => {
        const tick = MeshBuilder.CreateLines(`world-axis-${spec.key}-tick-${index}`, {
          points: [origin, origin],
          updatable: true,
        }, scene)
        tick.color = spec.color
        tick.alpha = 0.18
        return tick
      })

      const labels = Array.from({ length: tickCount - 1 }, (_, index) => {
        const plane = MeshBuilder.CreatePlane(`world-axis-${spec.key}-label-${index}`, {
          width: 190,
          height: 72,
        }, scene)
        plane.billboardMode = 7
        const texture = new DynamicTexture(`world-axis-${spec.key}-label-tex-${index}`, { width: 256, height: 96 }, scene, true)
        const material = new StandardMaterial(`world-axis-${spec.key}-label-mat-${index}`, scene)
        material.diffuseTexture = texture
        material.emissiveTexture = texture
        material.opacityTexture = texture
        material.specularColor = Color3.Black()
        material.backFaceCulling = false
        material.alpha = 0.52
        plane.material = material
        return { plane, texture, material }
      })

      entry = { line, tip, ticks, labels }
      worldAxesMap.set(spec.key, entry)
    }

    MeshBuilder.CreateLines(null, {
      points: [origin, spec.end],
      instance: entry.line,
    })
    entry.line.setEnabled(true)
    entry.tip.position.copyFrom(spec.end)
    entry.tip.setEnabled(true)

    const tickOffset = tickOffsets[spec.key]
    entry.ticks.forEach((tick, index) => {
      const tickCenter = origin.add(spec.unit.scale(tickSpacing * (index + 1)))
      MeshBuilder.CreateLines(null, {
        points: [tickCenter.subtract(tickOffset), tickCenter.add(tickOffset)],
        instance: tick,
      })
      tick.setEnabled(true)
    })

    entry.labels.forEach((labelEntry, index) => {
      const tickCenter = origin.add(spec.unit.scale(tickSpacing * (index + 1)))
      const labelOffset = tickOffset.scale(2.35)
      labelEntry.plane.position.copyFrom(tickCenter.add(labelOffset))
      labelEntry.plane.setEnabled(true)
      labelEntry.material.alpha = 0.48
      labelEntry.texture.clear()
      labelEntry.texture.drawText(
        `${Math.round(tickSpacing * (index + 1))}`,
        null,
        62,
        '600 42px "IBM Plex Sans", sans-serif',
        spec.key === 'x' ? '#fca5a5' : spec.key === 'y' ? '#86efac' : '#93c5fd',
        'transparent',
        true,
        true,
      )
    })
  }
}

const updateCameraTarget = () => {
  if (!camera || !props.nodes.length) return
  const xs = props.nodes.map((node) => node.x)
  const ys = props.nodes.map((node) => node.y)
  const zs = props.nodes.map((node) => -(node.z ?? 0) * DEPTH_SCALE)
  const center = new Vector3(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...zs) + Math.max(...zs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  )
  camera.setTarget(center)
  if (defaultCameraState) {
    defaultCameraState.target = center.clone()
  }
}

const refreshScene = () => {
  if (!scene) return
  updateCameraTarget()
  buildNodes()
  buildPackets()
  buildWorldAxes()
  syncSelectedNodePos()
}

const resize = () => {
  if (!engine) return
  engine.resize()
  syncSelectedNodePos()
  drawAxesWidget()
}

const drawAxesWidget = () => {
  if (!axesEl.value || !camera) return
  const ctx = axesEl.value.getContext('2d')
  if (!ctx) return
  const w = axesEl.value.width
  const h = axesEl.value.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(8, 15, 28, 0.78)'
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 16)
  ctx.fill()

  const center = { x: w / 2, y: h / 2 }
  const scale = 22
  const view = camera.getViewMatrix()
  const projectAxis = (axis) => {
    const transformed = Vector3.TransformNormal(axis, view).normalize()
    return {
      x: transformed.x,
      y: transformed.y,
      z: transformed.z,
    }
  }
  const axes = [
    { label: 'X', color: '#f87171', vec: projectAxis(new Vector3(1, 0, 0)) },
    { label: 'Y', color: '#4ade80', vec: projectAxis(new Vector3(0, 1, 0)) },
    { label: 'Z', color: '#60a5fa', vec: projectAxis(new Vector3(0, 0, 1)) },
  ]

  for (const axis of axes) {
    const endX = center.x + (axis.vec.x * scale)
    const endY = center.y - (axis.vec.y * scale)
    ctx.strokeStyle = axis.color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(center.x, center.y)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.fillStyle = axis.color
    ctx.beginPath()
    ctx.arc(endX, endY, 3.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '600 11px "IBM Plex Sans", sans-serif'
    ctx.fillText(axis.label, endX + 5, endY + 4)
  }
}

const resetCameraView = () => {
  if (!camera || !defaultCameraState) return
  camera.alpha = defaultCameraState.alpha
  camera.beta = defaultCameraState.beta
  camera.radius = defaultCameraState.radius
  camera.setTarget(defaultCameraState.target.clone())
  drawAxesWidget()
}

const onCanvasPointerDown = (event) => {
  if (!camera || !canvasEl.value || event.button !== 1) return
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
  if (defaultCameraState) defaultCameraState.target = camera.getTarget().clone()
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
  if (!canvasEl.value) return

  engine = new Engine(canvasEl.value, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
  })
  scene = new Scene(engine)
  scene.clearColor = theme3D.value.clear.clone()
  glowLayer = new GlowLayer('scene-glow', scene, {
    mainTextureSamples: 4,
    blurKernelSize: 32,
  })
  glowLayer.intensity = 0.44 * fx3D.value

  camera = new ArcRotateCamera('camera', -Math.PI / 3, Math.PI / 2.9, 9200, Vector3.Zero(), scene)
  camera.lowerRadiusLimit = 2200
  camera.upperRadiusLimit = 45000
  camera.wheelDeltaPercentage = 0.015
  camera.panningSensibility = 0
  camera.minZ = 1
  camera.maxZ = 200000
  camera.attachControl(canvasEl.value, true)
  if (camera.inputs?.attached?.pointers) {
    camera.inputs.attached.pointers.buttons = [0]
  }
  defaultCameraState = {
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
    target: camera.getTarget().clone(),
  }

  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
  light.intensity = 1.1
  light.groundColor = new Color3(0.1, 0.14, 0.2)

  pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
    const picked = pointerInfo.pickInfo?.pickedMesh
    const nodeId = picked?.metadata?.nodeId
    if (!nodeId) {
      selectedNode.value = null
      selectedNodePos.value = null
      return
    }
    selectedNode.value = nodeById.value.get(nodeId) || null
    syncSelectedNodePos()
  })

  engine.runRenderLoop(() => {
    if (!scene || !camera) return
    syncSelectedNodePos()
    drawAxesWidget()
    scene.render()
  })

  resizeObserver = new ResizeObserver(() => resize())
  if (hostEl.value) resizeObserver.observe(hostEl.value)
  canvasEl.value.addEventListener('pointerdown', onCanvasPointerDown)
  canvasEl.value.addEventListener('pointermove', onCanvasPointerMove)
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
    if (scene) scene.clearColor = theme3D.value.clear.clone()
    queueRefresh()
  },
)

watch(
  () => props.fxLevel,
  () => {
    if (glowLayer) {
      glowLayer.intensity = 0.44 * fx3D.value
      glowLayer.blurKernelSize = props.fxLevel === 'extreme' ? 48 : 32
    }
    queueRefresh()
  },
)

onBeforeUnmount(() => {
  endMiddlePan()
  window.removeEventListener('resize', resize)
  window.removeEventListener('pointerup', endMiddlePan)
  window.removeEventListener('pointercancel', endMiddlePan)
  if (canvasEl.value) {
    canvasEl.value.removeEventListener('pointerdown', onCanvasPointerDown)
    canvasEl.value.removeEventListener('pointermove', onCanvasPointerMove)
  }
  if (resizeObserver) resizeObserver.disconnect()
  if (scene && pointerObserver) scene.onPointerObservable.remove(pointerObserver)
  if (glowLayer) {
    glowLayer.dispose()
    glowLayer = null
  }
  disposeEntryMap(nodeMeshMap)
  disposeEntryMap(packetMeshMap)
  disposeEntryMap(worldAxesMap)
  nodeMeshes = []
  packetMeshes = []
  if (scene) scene.dispose()
  if (engine) engine.dispose()
})
</script>

<style scoped>
.scene-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 12px;
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
  cursor: pointer;
}

.scene-help {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  display: inline-flex;
  gap: 0.55rem;
  align-items: center;
  padding: 0.42rem 0.6rem;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 22%, transparent);
  background: color-mix(in srgb, var(--card, #0b1a2d) 88%, #020617 12%);
  backdrop-filter: blur(6px);
  color: var(--accent-soft, #bfdbfe);
  font-size: 0.76rem;
}

.scene-tooltip {
  position: absolute;
  transform: translate(14px, -50%);
  z-index: 2;
  background: color-mix(in srgb, var(--card, #0b1a2d) 94%, #020617 6%);
  border: 1px solid color-mix(in srgb, var(--accent-soft, #93c5fd) 26%, transparent);
  border-radius: 10px;
  padding: 0.45rem 0.65rem;
  min-width: 200px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.32);
  pointer-events: none;
}

.scene-tooltip-title {
  margin: 0;
  font-size: 0.9rem;
  color: #e2e8f0;
  font-weight: 700;
}

.scene-tooltip-role {
  font-size: 0.72rem;
  margin-left: 0.35rem;
  color: var(--accent-soft, #93c5fd);
}

.scene-tooltip-row {
  margin: 0.18rem 0 0;
  color: #cbd5e1;
  font-size: 0.78rem;
}
</style>
