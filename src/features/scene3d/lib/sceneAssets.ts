import { Color3, Mesh, MeshBuilder, PBRMaterial, TransformNode, VertexData, type Scene } from '@babylonjs/core'
import type { SceneAsset } from '@/shared/sceneAssets'
import { ASSET_FINISHES, sceneAssetParts, type AssetPart } from '@/shared/sceneAssetGeometry'

export interface SceneAssetEntry { root: TransformNode; meshes: Mesh[]; signature: string; asset: SceneAsset }

const prismMesh = (name: string, part: AssetPart, scene: Scene): Mesh => {
  const points = [...part.outline!]
  const area = points.reduce((sum, [x, y], i) => {
    const next = points[(i + 1) % points.length]!
    return sum + x * next[1] - y * next[0]
  }, 0)
  if (area < 0) points.reverse()
  const n = points.length, h = part.size[2] / 2
  const positions = [h, -h].flatMap(z => points.flatMap(([x, y]) => [x, z, y]))
  const indices: number[] = []
  for (let i = 1; i < n - 1; i++) indices.push(0, i + 1, i, n, n + i, n + i + 1)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    indices.push(i, j, n + i, j, n + j, n + i)
  }
  const data = new VertexData(), normals: number[] = []
  VertexData.ComputeNormals(positions, indices, normals)
  data.positions = positions; data.indices = indices; data.normals = normals
  data.uvs = [0, 1].flatMap(() => points.flatMap(([x, y]) => [x / 100, y / 100]))
  const mesh = new Mesh(name, scene)
  data.applyToMesh(mesh)
  mesh.convertToFlatShadedMesh()
  return mesh
}

const terrainMesh = (name: string, part: AssetPart, scene: Scene): Mesh => {
  const positions = part.surface!.flatMap(([x, y, z]) => [x, z, y]), indices = [...part.triangles!], normals: number[] = []
  VertexData.ComputeNormals(positions, indices, normals)
  const data = new VertexData()
  data.positions = positions; data.indices = indices; data.normals = normals
  data.uvs = part.surface!.flatMap(([x, y]) => [x / 100, y / 100])
  const mesh = new Mesh(name, scene)
  data.applyToMesh(mesh)
  return mesh
}

export const createSceneAssetEntry = (scene: Scene, asset: SceneAsset): SceneAssetEntry => {
  const root = new TransformNode(`scenery-${asset.id}`, scene)
  const batches = new Map<string, Mesh[]>()
  for (const [index, part] of sceneAssetParts(asset.type).entries()) {
    const name = `${root.name}-${index}`, [x, y, z] = part.size
    let mesh: Mesh
    if (part.shape === 'terrain' || part.shape === 'surface') mesh = terrainMesh(name, part, scene)
    else if (part.shape === 'prism') mesh = prismMesh(name, part, scene)
    else if (part.shape === 'box') mesh = MeshBuilder.CreateBox(name, { width: x, height: z, depth: y }, scene)
    else if (part.shape === 'ellipsoid') mesh = MeshBuilder.CreateSphere(name, { diameterX: x, diameterY: z, diameterZ: y, segments: 24 }, scene)
    else {
      mesh = MeshBuilder.CreateCylinder(name, { diameter: part.axis === 'x' ? y : x, height: z, tessellation: 32 }, scene)
      if (part.axis === 'x') mesh.rotation.z = -Math.PI / 2
    }
    mesh.position.set(part.at[0], part.at[2], part.at[1])
    mesh.rotation.y = -(part.yaw ?? 0)
    const batch = batches.get(part.finish) ?? []
    batch.push(mesh); batches.set(part.finish, batch)
  }
  const meshes: Mesh[] = []
  for (const [finish, batch] of batches) {
    const material = new PBRMaterial(`${root.name}-${finish}`, scene)
    const surface = ASSET_FINISHES[finish as keyof typeof ASSET_FINISHES]
    material.albedoColor = Color3.FromHexString(surface.color)
    material.metallic = surface.metallic; material.roughness = surface.roughness
    const mesh = batch.length === 1 ? batch[0]! : Mesh.MergeMeshes(batch, true, true, undefined, false, false)!
    mesh.material = material; mesh.parent = root
    mesh.metadata = { sceneAssetId: asset.id }
    mesh.isPickable = true
    meshes.push(mesh)
  }
  return { root, meshes, signature: asset.type, asset }
}

export const disposeSceneAssetEntry = (entry: SceneAssetEntry) => {
  entry.root.dispose(false, true)
}

/** Only type changes rebuild geometry. Playback time and packet focus do not. */
export const syncSceneAssets = (scene: Scene, assets: readonly SceneAsset[], visible: boolean, entries: Map<string, SceneAssetEntry>) => {
  const ids = new Set(assets.map(asset => asset.id))
  for (const [id, entry] of entries) if (!ids.has(id)) { disposeSceneAssetEntry(entry); entries.delete(id) }
  for (const asset of assets) {
    let entry = entries.get(asset.id)
    if (entry && entry.signature !== asset.type) { disposeSceneAssetEntry(entry); entries.delete(asset.id); entry = undefined }
    if (!entry) { entry = createSceneAssetEntry(scene, asset); entries.set(asset.id, entry) }
    entry.asset = asset
    entry.root.position.set(asset.x, asset.z, asset.y)
    entry.root.rotation.y = -asset.heading * Math.PI / 180
    // Keep the normalized base plane at the saved Z for every asset type.
    entry.root.rotation.x = 0
    entry.root.scaling.setAll(asset.scale)
    entry.root.setEnabled(visible && asset.visible)
  }
}
