import {
  Color3,
  Mesh,
  MeshBuilder,
  TransformNode,
  type LinesMesh,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import {
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

export type NodeModelKind = 'vessel' | 'auv'

export interface NodeMeshEntry {
  kind: NodeModelKind
  root: TransformNode
  /** 船体 / 艇身主体：承载节点状态色（tx/rx/collision 变色） */
  base: Mesh
  progress: Mesh
  /** 上层建筑、尾舵、桅杆等固定配色部件 */
  details: Mesh[]
}

/* ---- 水面舰艇（sink / 网关节点）：尖艏船体 + 甲板 + 舰桥 + 桅杆航行灯 ---- */

/** 船体俯视轮廓（X = 船长，艏朝 +X；Y = 船宽），ExtrudeShape 沿 Z 拉出型深后翻转到 Y 向上 */
const VESSEL_HULL_OUTLINE = [
  new Vector3(250, 0, 0),
  new Vector3(120, 76, 0),
  new Vector3(-190, 76, 0),
  new Vector3(-240, 44, 0),
  new Vector3(-240, -44, 0),
  new Vector3(-190, -76, 0),
  new Vector3(120, -76, 0),
]

const buildVessel = (scene: Scene, nodeId: number, palette: Theme3DPalette, root: TransformNode) => {
  const hull = bindNodeMeta(MeshBuilder.ExtrudeShape(`node-${nodeId}-hull`, {
    shape: VESSEL_HULL_OUTLINE,
    path: [new Vector3(0, 0, -32), new Vector3(0, 0, 52)],
    cap: Mesh.CAP_ALL,
  }, scene), nodeId)
  hull.rotation.x = -Math.PI / 2
  hull.parent = root
  hull.material = makeMaterial(scene, `node-${nodeId}-hull-mat`, palette.idleDiffuse, palette.idleEmissive, 1)

  const deck = bindNodeMeta(MeshBuilder.CreateBox(`node-${nodeId}-deck`, {
    width: 400,
    height: 14,
    depth: 132,
  }, scene), nodeId)
  deck.parent = root
  deck.position.set(0, 59, 0)
  deck.material = makeMaterial(scene, `node-${nodeId}-deck-mat`, palette.hull, null, 1)

  const bridge = bindNodeMeta(MeshBuilder.CreateBox(`node-${nodeId}-bridge`, {
    width: 120,
    height: 80,
    depth: 92,
  }, scene), nodeId)
  bridge.parent = root
  bridge.position.set(-110, 106, 0)
  bridge.material = makeMaterial(scene, `node-${nodeId}-bridge-mat`, palette.superstructure, palette.superstructure.scale(0.08), 1)

  const mast = bindNodeMeta(MeshBuilder.CreateCylinder(`node-${nodeId}-mast`, {
    diameterTop: 8,
    diameterBottom: 16,
    height: 130,
    tessellation: 10,
  }, scene), nodeId)
  mast.parent = root
  mast.position.set(-110, 211, 0)
  mast.material = makeMaterial(scene, `node-${nodeId}-mast-mat`, palette.hull, null, 1)

  const beacon = bindNodeMeta(MeshBuilder.CreateSphere(`node-${nodeId}-beacon`, {
    diameter: 20,
    segments: 10,
  }, scene), nodeId)
  beacon.parent = root
  beacon.position.set(-110, 288, 0)
  beacon.material = makeMaterial(scene, `node-${nodeId}-beacon-mat`, palette.beacon, palette.beacon.scale(0.85), 1)

  return { base: hull, details: [deck, bridge, mast, beacon] }
}

/* ---- AUV（水下节点）：胶囊鱼雷艇身 + 指挥台围壳 + 十字尾舵 + 螺旋桨 ---- */

const buildAuv = (scene: Scene, nodeId: number, palette: Theme3DPalette, root: TransformNode) => {
  const body = bindNodeMeta(MeshBuilder.CreateCapsule(`node-${nodeId}-body`, {
    radius: 54,
    height: 400,
    tessellation: 24,
  }, scene), nodeId)
  body.rotation.z = Math.PI / 2 // 胶囊默认沿 Y，放平到 X（艏朝 +X）
  body.parent = root
  body.material = makeMaterial(scene, `node-${nodeId}-body-mat`, palette.idleDiffuse, palette.idleEmissive, 1)

  const sail = bindNodeMeta(MeshBuilder.CreateBox(`node-${nodeId}-sail`, {
    width: 84,
    height: 54,
    depth: 34,
  }, scene), nodeId)
  sail.parent = root
  sail.position.set(34, 62, 0)
  sail.material = makeMaterial(scene, `node-${nodeId}-sail-mat`, palette.hull, null, 1)

  const fins = [
    { name: 'fin-top', width: 70, height: 76, depth: 10, pos: new Vector3(-168, 58, 0) },
    { name: 'fin-bottom', width: 70, height: 76, depth: 10, pos: new Vector3(-168, -58, 0) },
    { name: 'fin-port', width: 70, height: 10, depth: 76, pos: new Vector3(-168, 0, 58) },
    { name: 'fin-starboard', width: 70, height: 10, depth: 76, pos: new Vector3(-168, 0, -58) },
  ].map((spec) => {
    const fin = bindNodeMeta(MeshBuilder.CreateBox(`node-${nodeId}-${spec.name}`, {
      width: spec.width,
      height: spec.height,
      depth: spec.depth,
    }, scene), nodeId)
    fin.parent = root
    fin.position.copyFrom(spec.pos)
    fin.material = makeMaterial(scene, `node-${nodeId}-${spec.name}-mat`, palette.hull, null, 1)
    return fin
  })

  const prop = bindNodeMeta(MeshBuilder.CreateCylinder(`node-${nodeId}-prop`, {
    diameter: 66,
    height: 14,
    tessellation: 20,
  }, scene), nodeId)
  prop.rotation.z = Math.PI / 2
  prop.parent = root
  prop.position.set(-206, 0, 0)
  prop.material = makeMaterial(scene, `node-${nodeId}-prop-mat`, palette.hull, null, 1)

  const bowLight = bindNodeMeta(MeshBuilder.CreateSphere(`node-${nodeId}-bow-light`, {
    diameter: 18,
    segments: 10,
  }, scene), nodeId)
  bowLight.parent = root
  bowLight.position.set(196, 0, 0)
  bowLight.material = makeMaterial(scene, `node-${nodeId}-bow-light-mat`, palette.beacon, palette.beacon.scale(0.85), 1)

  return { base: body, details: [sail, ...fins, prop, bowLight] }
}

/** 创建节点模型：root 挂在节点世界坐标上，base 承载状态色，details 固定配色。 */
export const createNodeEntry = (
  scene: Scene,
  nodeId: number,
  kind: NodeModelKind,
  palette: Theme3DPalette,
): NodeMeshEntry => {
  const root = new TransformNode(`node-${nodeId}-root`, scene)
  const { base, details } = kind === 'vessel'
    ? buildVessel(scene, nodeId, palette, root)
    : buildAuv(scene, nodeId, palette, root)

  const progress = bindNodeMeta(MeshBuilder.CreateSphere(`node-${nodeId}-progress`, {
    diameter: 300,
    segments: 18,
  }, scene), nodeId)
  progress.parent = root
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

  return { kind, root, base, progress, details }
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
  for (const detail of entry.details) disposeMeshAndMaterial(detail)
  entry.root.dispose()
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
