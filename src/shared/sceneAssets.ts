/** Replay scenery is a separate document: never a network node or ns-3 input. */
export const SCENE_ASSET_CATALOG = [
  { type: 'wreck', label: '海底船体残骸', group: '水下', placement: 'seabed', length: 160 },
  { type: 'fish', label: '鱼类 · 鱼群', group: '水下', placement: 'underwater', length: 23 },
  { type: 'submarine', label: '作战潜艇', group: '水下', placement: 'underwater', length: 115 },
  { type: 'warship', label: '作战舰艇', group: '水面', placement: 'surface', length: 152 },
  { type: 'drone', label: '无人机', group: '空中', placement: 'air', length: 1.6 },
  { type: 'aircraft', label: '大型有翼机', group: '空中', placement: 'air', length: 53 },
  { type: 'coast', label: '海岸', group: '岸上', placement: 'surface', length: 2400 },
  { type: 'command', label: '岸上指挥所', group: '岸上', placement: 'land', length: 1.60 },
] as const

export type SceneAssetType = typeof SCENE_ASSET_CATALOG[number]['type']
export interface SceneAsset {
  id: string
  type: SceneAssetType
  name: string
  x: number
  y: number
  z: number
  heading: number
  scale: number
  visible: boolean
}
export interface SceneAssetFocus { id: string; revision: number }
export interface ReplaySceneDocument {
  schema: 'aquasim-replay-scene/v1'
  visible: boolean
  assets: SceneAsset[]
}
export const MAX_SCENE_ASSETS = 128
export const sceneAssetDefinition = (type: SceneAssetType) => SCENE_ASSET_CATALOG.find(asset => asset.type === type)!
export const isSceneAssetType = (value: unknown): value is SceneAssetType => SCENE_ASSET_CATALOG.some(asset => asset.type === value)

/** Strict, atomic import; no coercion of node-shaped objects or partial installs. */
export const parseReplayScene = (raw: unknown): ReplaySceneDocument => {
  if (!raw || typeof raw !== 'object') throw new Error('场景文件必须是 JSON 对象')
  const input = raw as Record<string, unknown>
  if (input.schema !== 'aquasim-replay-scene/v1' || typeof input.visible !== 'boolean' || !Array.isArray(input.assets)) {
    throw new Error('不支持的场景文件格式')
  }
  if (input.assets.length > MAX_SCENE_ASSETS) throw new Error(`最多添加 ${MAX_SCENE_ASSETS} 个场景资产`)
  const ids = new Set<string>()
  const assets = input.assets.map((row: unknown): SceneAsset => {
    if (!row || typeof row !== 'object') throw new Error('场景资产格式无效')
    const asset = row as Record<string, unknown>
    if (typeof asset.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(asset.id) || ids.has(asset.id)
      || !isSceneAssetType(asset.type) || typeof asset.name !== 'string' || asset.name.length > 80
      || /[\u0000-\u001f\u007f]/.test(asset.name) || typeof asset.visible !== 'boolean') throw new Error('场景资产名称、类型或标识无效')
    for (const key of ['x', 'y', 'z', 'heading', 'scale'] as const) {
      if (typeof asset[key] !== 'number' || !Number.isFinite(asset[key])) throw new Error('场景资产坐标、朝向和缩放必须是有效数值')
    }
    if (Math.max(Math.abs(asset.x as number), Math.abs(asset.y as number), Math.abs(asset.z as number)) > 1e7) throw new Error('场景资产坐标超出范围')
    if ((asset.scale as number) < 0.05 || (asset.scale as number) > 100) throw new Error('资产缩放范围为 0.05–100 倍')
    ids.add(asset.id)
    return { id: asset.id, type: asset.type, name: asset.name.trim(), visible: asset.visible,
      x: asset.x as number, y: asset.y as number, z: asset.z as number,
      heading: ((asset.heading as number) % 360 + 360) % 360, scale: asset.scale as number }
  })
  return { schema: 'aquasim-replay-scene/v1', visible: input.visible, assets }
}
