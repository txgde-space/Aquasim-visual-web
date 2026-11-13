import {
  Color3,
  Mesh,
  MeshBuilder,
  TransformNode,
  type LinesMesh,
  type Quaternion,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import { NODE_MODEL_DIMENSIONS, type NodeModelType } from '@/shared/nodeModel'
import { buildNodeModel } from './nodeModels'
import {
  PROGRESS_CORE_SCALE,
  type Theme3DPalette,
} from './themes3d'

export const makeMaterial = (
  scene: Scene,
  name: string,
  diffuse: Color3,
  emissive: Color3 | null = null,
  alpha = 1,
): StandardMaterial => {
  const material = new StandardMaterial(name, scene)
  material.diffuseColor = diffuse
  material.specularColor = new Color3(0.12, 0.18, 0.26)
  material.emissiveColor = emissive || Color3.Black()
  material.alpha = alpha
  return material
}

export const bindNodeMeta = <T extends Mesh>(mesh: T, nodeId: number): T => {
  mesh.metadata = { nodeId }
  return mesh
}

export const setMaterialColor = (
  material: StandardMaterial | null,
  diffuse: Color3,
  emissive: Color3 | null = null,
  alpha = 1,
): void => {
  if (!material) return
  material.diffuseColor = diffuse
  material.emissiveColor = emissive || Color3.Black()
  material.alpha = alpha
}

interface MaterialColorState {
  diffuse: Color3
  emissive?: Color3 | null
  alpha?: number
}

/** Skip redundant material writes by comparing against a cached state key. */
export const syncMaterialColor = (
  material: StandardMaterial | null,
  next: MaterialColorState,
): void => {
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

export interface NodeSceneVisual {
  mode?: string
  fillProgress?: number
  fade?: number
  overlay?: { kind?: string } | null
}

export const visualStateColor = (visual: NodeSceneVisual | undefined, palette: Theme3DPalette): MaterialColorState => {
  void visual
  return { diffuse: palette.idleDiffuse, emissive: palette.idleEmissive, alpha: 1 }
}

export interface ProgressStyle extends MaterialColorState {
  scaleX?: number
  scaleY?: number
  scaleZ?: number
}

export const visualProgressStyle = (
  visual: NodeSceneVisual | undefined,
  palette: Theme3DPalette,
): ProgressStyle | null => {
  if (!visual) return null
  const fillScale = () => 0.08 + (PROGRESS_CORE_SCALE * Math.max(0, Math.min(1, visual.fillProgress ?? 0)))
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
      scaleX: fillScale(),
      scaleY: fillScale(),
      scaleZ: fillScale(),
    }
  }
  if (visual.mode === 'rx') {
    return {
      diffuse: palette.rx,
      emissive: palette.rx.scale(0.4),
      alpha: 0.82,
      scaleX: fillScale(),
      scaleY: fillScale(),
      scaleZ: fillScale(),
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

export type NodeModelKind = NodeModelType

export interface NodeMeshEntry {
  kind: NodeModelKind
  root: TransformNode
  /** 模型主体：使用设备自身的 PBR 涂装，收发状态由 progress 单独显示。 */
  base: Mesh
  progress: Mesh
  /** Screen-space locator only; equipment geometry remains in metres. */
  marker: Mesh
  progressScale: number
  /** 上层建筑、尾舵、桅杆等固定配色部件 */
  details: Mesh[]
}

/** 创建节点模型：root 挂在节点世界坐标上，设备材质与收发状态独立。 */
export const createNodeEntry = (
  scene: Scene,
  nodeId: number,
  kind: NodeModelKind,
  palette: Theme3DPalette,
): NodeMeshEntry => {
  const root = new TransformNode(`node-${nodeId}-root`, scene)
  const { base, details } = buildNodeModel(scene, nodeId, kind, root, palette.model)

  const progress = bindNodeMeta(MeshBuilder.CreateTorus(`node-${nodeId}-progress`, {
    diameter: 1,
    thickness: .025,
    tessellation: 48,
  }, scene), nodeId)
  progress.rotation.x = Math.PI / 2
  progress.bakeCurrentTransformIntoVertices()
  progress.billboardMode = Mesh.BILLBOARDMODE_ALL
  progress.parent = root
  const progressMaterial = makeMaterial(
    scene,
    `node-${nodeId}-progress-mat`,
    palette.rx,
    palette.rx.scale(0.28),
    0,
  )
  progressMaterial.disableLighting = true
  progressMaterial.disableDepthWrite = true
  progress.material = progressMaterial
  progress.renderingGroupId = 1

  const marker = bindNodeMeta(MeshBuilder.CreateTorus(`node-${nodeId}-locator`, { diameter: 1, thickness: .035, tessellation: 32 }, scene), nodeId)
  marker.rotation.x = Math.PI / 2
  marker.bakeCurrentTransformIntoVertices()
  marker.billboardMode = Mesh.BILLBOARDMODE_ALL
  marker.parent = root
  const markerMaterial = makeMaterial(scene, `node-${nodeId}-locator-mat`, palette.idleDiffuse, palette.idleDiffuse, .7)
  markerMaterial.disableLighting = true
  markerMaterial.disableDepthWrite = true
  marker.material = markerMaterial
  marker.renderingGroupId = 2
  return { kind, root, base, progress, marker, progressScale: .01, details }
}

const disposeMeshAndMaterial = (mesh: Mesh): void => {
  const material = mesh.material
  if (material) material.dispose()
  mesh.dispose()
}

/** Dispose a node's meshes AND their materials (mesh.dispose alone leaks materials). */
export const disposeNodeEntry = (entry: NodeMeshEntry): void => {
  disposeMeshAndMaterial(entry.base)
  disposeMeshAndMaterial(entry.progress)
  disposeMeshAndMaterial(entry.marker)
  for (const detail of entry.details) disposeMeshAndMaterial(detail)
  entry.root.dispose()
}

/** Only screen annotations adapt to distance; equipment geometry always stays at 1:1 scale. */
export const syncNodeAnnotation = (entry: NodeMeshEntry, camera: { globalPosition: Vector3; fov: number }, viewportHeight: number): void => {
  const size = NODE_MODEL_DIMENSIONS[entry.kind]
  const physicalDiameter = Math.max(size.length, size.width, size.height)
  const distance = Vector3.Distance(camera.globalPosition, entry.root.position)
  const metresPerPixel = 2 * distance * Math.tan(camera.fov / 2) / Math.max(1, viewportHeight)
  const locator = 26 * metresPerPixel
  entry.progress.position.y = size.height / 2
  entry.marker.position.y = size.height / 2
  entry.marker.scaling.setAll(locator)
  entry.marker.setEnabled(physicalDiameter < 16 * metresPerPixel)
  entry.progress.scaling.setAll(Math.max(physicalDiameter * 1.12, locator) * entry.progressScale)
}

export interface PacketMeshEntry {
  line: LinesMesh
  block: Mesh
  marker: Mesh
  head: Mesh
  result: LinesMesh
  sourcePosition: Vector3
  destinationPosition: Vector3
  direction: Vector3
  pathLength: number
}

const orientPacketPath = (entry: PacketMeshEntry): void => {
  entry.block.position.copyFrom(entry.sourcePosition)
  entry.block.rotationQuaternion = null
  entry.block.lookAt(entry.destinationPosition)
  entry.block.rotate(Vector3.Right(), Math.PI / 2)
  entry.head.rotationQuaternion = (entry.block.rotationQuaternion as Quaternion | null)?.clone() || null
  entry.marker.position.copyFrom(entry.destinationPosition)
  entry.result.position.copyFrom(entry.destinationPosition)
}

/** Time/progress/color changes do not require rewriting the path vertex buffer. */
export const syncPacketGeometry = (entry: PacketMeshEntry, source: Vector3, destination: Vector3): boolean => {
  if (entry.sourcePosition.equals(source) && entry.destinationPosition.equals(destination)) return false
  entry.sourcePosition.copyFrom(source)
  entry.destinationPosition.copyFrom(destination)
  destination.subtractToRef(source, entry.direction)
  entry.pathLength = entry.direction.length()
  MeshBuilder.CreateLines(entry.line.name, { points: [source, destination], instance: entry.line })
  orientPacketPath(entry)
  return true
}

/** Thin signal band, direction arrow and an endpoint ring; never scale equipment. */
export const createPacketEntry = (
  scene: Scene,
  packetId: number | string,
  dst: number,
  srcPos: Vector3,
  dstPos: Vector3,
  palette: Theme3DPalette,
  color: Color3,
): PacketMeshEntry => {
  const line = MeshBuilder.CreateLines(`packet-${packetId}-${dst}-line`, {
    points: [srcPos, dstPos],
    updatable: true,
  }, scene)
  line.color = palette.line
  line.alpha = 0.52

  const block = MeshBuilder.CreateCylinder(`packet-${packetId}-${dst}-block`, {
    diameter: 1,
    height: 1,
    tessellation: 8,
  }, scene)
  block.material = makeMaterial(scene, `packet-${packetId}-${dst}-mat`, color, color.scale(0.12), 0.96)

  const marker = MeshBuilder.CreateTorus(`packet-${packetId}-${dst}-marker`, {
    diameter: 1, thickness: .045, tessellation: 32,
  }, scene)
  marker.rotation.x = Math.PI / 2
  marker.bakeCurrentTransformIntoVertices()
  marker.billboardMode = Mesh.BILLBOARDMODE_ALL
  marker.material = makeMaterial(scene, `packet-${packetId}-${dst}-marker-mat`, color, color.scale(0.12), palette.markerAlpha)
  const head = MeshBuilder.CreateCylinder(`packet-${packetId}-${dst}-head`, {
    diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 8,
  }, scene)
  head.material = makeMaterial(scene, `${head.name}-mat`, palette.tx, palette.tx, .95)
  const result = MeshBuilder.CreateLineSystem(`packet-${packetId}-${dst}-result`, { lines: [
    [new Vector3(-.25,-.25,0), new Vector3(.25,.25,0)],
    [new Vector3(-.25,.25,0), new Vector3(.25,-.25,0)],
  ] }, scene)
  result.billboardMode = Mesh.BILLBOARDMODE_ALL
  result.color = palette.bad
  for (const mesh of [line, block, head, marker, result]) {
    mesh.isPickable = false
    mesh.renderingGroupId = 1
    const material = mesh.material as StandardMaterial
    material.disableDepthWrite = true
    material.fogEnabled = false
    if (material instanceof StandardMaterial) material.disableLighting = true
  }

  const direction = dstPos.subtract(srcPos)
  const entry = {
    line, block, marker, head, result,
    sourcePosition: srcPos.clone(), destinationPosition: dstPos.clone(),
    direction, pathLength: direction.length(),
  }
  orientPacketPath(entry)
  return entry
}

/** Dispose a packet path's meshes AND their materials. */
export const disposePacketEntry = (entry: PacketMeshEntry): void => {
  disposeMeshAndMaterial(entry.block)
  disposeMeshAndMaterial(entry.marker)
  disposeMeshAndMaterial(entry.head)
  entry.line.dispose()
  entry.result.dispose()
}
