import {
  Color3,
  MeshBuilder,
  type LinesMesh,
  type Mesh,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import {
  NODE_RADIUS,
  PATH_BLOCK_DIAMETER,
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

export interface NodeMeshEntry {
  base: Mesh
  progress: Mesh
  sinkBridge: Mesh
  sinkMast: Mesh
}

/** Create the four meshes (with materials) that make up one node. */
export const createNodeEntry = (scene: Scene, nodeId: number, palette: Theme3DPalette): NodeMeshEntry => {
  const base = bindNodeMeta(MeshBuilder.CreateSphere(`node-${nodeId}-base`, {
    diameter: NODE_RADIUS * 2,
    segments: 22,
  }, scene), nodeId)
  base.material = makeMaterial(
    scene,
    `node-${nodeId}-base-mat`,
    palette.idleDiffuse,
    palette.idleEmissive,
    1,
  )

  const progress = bindNodeMeta(MeshBuilder.CreateSphere(`node-${nodeId}-progress`, {
    diameter: NODE_RADIUS * 2,
    segments: 18,
  }, scene), nodeId)
  progress.material = makeMaterial(
    scene,
    `node-${nodeId}-progress-mat`,
    palette.rx,
    palette.rx.scale(0.28),
    0,
  )
  progress.material.backFaceCulling = false
  progress.material.needDepthPrePass = true
  progress.renderingGroupId = 1

  const sinkBridge = bindNodeMeta(MeshBuilder.CreateBox(`node-${nodeId}-sink-bridge`, {
    width: 168,
    height: 84,
    depth: 112,
  }, scene), nodeId)
  sinkBridge.material = makeMaterial(
    scene,
    `node-${nodeId}-sink-bridge-mat`,
    palette.idleDiffuse.scale(0.88),
    palette.idleEmissive.scale(0.8),
    0.96,
  )
  sinkBridge.renderingGroupId = 1

  const sinkMast = bindNodeMeta(MeshBuilder.CreateCylinder(`node-${nodeId}-sink-mast`, {
    diameterTop: 22,
    diameterBottom: 28,
    height: 120,
    tessellation: 16,
  }, scene), nodeId)
  sinkMast.material = makeMaterial(
    scene,
    `node-${nodeId}-sink-mast-mat`,
    palette.idleDiffuse.scale(1.04),
    palette.idleEmissive.scale(1.05),
    0.98,
  )
  sinkMast.renderingGroupId = 1

  return { base, progress, sinkBridge, sinkMast }
}

const disposeMeshAndMaterial = (mesh: Mesh): void => {
  const material = mesh.material as StandardMaterial | null
  if (material) material.dispose()
  mesh.dispose()
}

/** Dispose a node's meshes AND their materials (mesh.dispose alone leaks materials). */
export const disposeNodeEntry = (entry: NodeMeshEntry): void => {
  disposeMeshAndMaterial(entry.base)
  disposeMeshAndMaterial(entry.progress)
  disposeMeshAndMaterial(entry.sinkBridge)
  disposeMeshAndMaterial(entry.sinkMast)
}

export interface PacketMeshEntry {
  line: LinesMesh
  block: Mesh
  marker: Mesh
}

/** Create the three meshes (with materials) that visualize one packet path. */
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
    diameter: PATH_BLOCK_DIAMETER,
    height: 100,
    tessellation: 20,
  }, scene)
  block.material = makeMaterial(scene, `packet-${packetId}-${dst}-mat`, color, color.scale(0.12), 0.96)

  const marker = MeshBuilder.CreateSphere(`packet-${packetId}-${dst}-marker`, {
    diameter: 70,
    segments: 14,
  }, scene)
  marker.material = makeMaterial(scene, `packet-${packetId}-${dst}-marker-mat`, color, color.scale(0.12), palette.markerAlpha)

  return { line, block, marker }
}

/** Dispose a packet path's meshes AND their materials. */
export const disposePacketEntry = (entry: PacketMeshEntry): void => {
  disposeMeshAndMaterial(entry.block)
  disposeMeshAndMaterial(entry.marker)
  entry.line.dispose()
}
