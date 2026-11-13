import { computed, ref, type Ref } from 'vue'
import { MAX_SCENE_ASSETS, parseReplayScene, sceneAssetDefinition, type SceneAsset, type SceneAssetFocus, type SceneAssetType } from '@/shared/sceneAssets'
import { sceneAssetLocalPoint } from '@/shared/sceneAssetGeometry'
import { SEA_LEVEL_METERS } from '@/shared/oceanCoordinates'
import { seabedElevationMeters } from '@/shared/seabedTerrain'
import { parseQuantity } from '@/shared/quantity'
import type { ReplayNode } from '@/shared/types/replay'

export const useReplayScenery = ({ assets, visible, selectedId, getNodes }: {
  assets: Ref<SceneAsset[]>
  visible: Ref<boolean>
  selectedId: Ref<string | null>
  getNodes: () => readonly ReplayNode[]
}) => {
  const error = ref('')
  const focusRequest = ref<SceneAssetFocus | null>(null)
  const selected = computed(() => assets.value.find(asset => asset.id === selectedId.value) ?? null)
  let serial = 0, revision = 0
  const nextId = () => {
    const ids = new Set(assets.value.map(asset => asset.id))
    let id: string
    do { id = `asset-${Date.now().toString(36)}-${++serial}` } while (ids.has(id))
    return id
  }
  const add = (type: SceneAssetType) => {
    error.value = ''
    if (assets.value.length >= MAX_SCENE_ASSETS) { error.value = `最多添加 ${MAX_SCENE_ASSETS} 个场景资产`; return }
    const definition = sceneAssetDefinition(type), nodes = getNodes()
    const centerX = nodes.length ? nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length : 0
    const centerY = nodes.length ? nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length : 0
    const order = assets.value.length
    let x = centerX + (order % 3 - 1) * 450, y = centerY + 450 + Math.floor(order / 3) * 450
    let z = SEA_LEVEL_METERS - sceneAssetLocalPoint(type, [0, 0, 0])[2]
    if (definition.placement === 'seabed') z = seabedElevationMeters(x, y)
    if (definition.placement === 'underwater') z = nodes.length ? nodes.reduce((sum, node) => sum + (node.z ?? 0), 0) / nodes.length : -100
    if (definition.placement === 'air') z = SEA_LEVEL_METERS + (type === 'aircraft' ? 900 : 450)
    if (type === 'coast') { x = centerX - 1500; y = centerY + 900 }
    if (definition.placement === 'land') {
      const coast = assets.value.find(asset => asset.type === 'coast')
      if (coast) {
        const angle = coast.heading * Math.PI / 180
        const ground = sceneAssetLocalPoint(coast.type, [-500, -280, 85])
        x = coast.x + (ground[0] * Math.cos(angle) - ground[1] * Math.sin(angle)) * coast.scale
        y = coast.y + (ground[0] * Math.sin(angle) + ground[1] * Math.cos(angle)) * coast.scale
        z = coast.z + ground[2] * coast.scale
      } else z = SEA_LEVEL_METERS + 8
    }
    const asset: SceneAsset = { id: nextId(), type, name: `${definition.label.split(' · ')[0]} ${assets.value.filter(asset => asset.type === type).length + 1}`,
      x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100,
      heading: 0, scale: 1, visible: true }
    assets.value = [...assets.value, asset]
    selectedId.value = asset.id
    visible.value = true
  }
  const patch = (id: string, changes: Partial<SceneAsset>) => {
    error.value = ''
    try {
      const next = parseReplayScene({ schema: 'aquasim-replay-scene/v1', visible: visible.value,
        assets: assets.value.map(asset => asset.id === id ? { ...asset, ...changes, id: asset.id, type: asset.type } : asset) })
      assets.value = next.assets
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '无效的场景参数' }
  }
  const setField = (id: string, field: 'x' | 'y' | 'z' | 'heading' | 'scale' | 'name', raw: string) => {
    try {
      const value = field === 'name' ? raw : ['x', 'y', 'z'].includes(field) ? parseQuantity(raw, 'm').value : Number(raw)
      if (field !== 'name' && !raw.trim()) throw new Error('参数不能为空')
      patch(id, { [field]: value })
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '请输入有效参数' }
  }
  const remove = (id: string) => {
    assets.value = assets.value.filter(asset => asset.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }
  const duplicate = (id: string) => {
    const asset = assets.value.find(item => item.id === id)
    if (!asset) return
    if (assets.value.length >= MAX_SCENE_ASSETS) { error.value = `最多添加 ${MAX_SCENE_ASSETS} 个场景资产`; return }
    const copy = { ...asset, id: nextId(), name: `${asset.name.slice(0, 75)} 副本`, x: asset.x + 100, y: asset.y - 100 }
    patchCopy(copy)
  }
  const patchCopy = (copy: SceneAsset) => {
    try {
      const next = parseReplayScene({ schema: 'aquasim-replay-scene/v1', visible: visible.value, assets: [...assets.value, copy] })
      assets.value = next.assets; selectedId.value = copy.id; error.value = ''
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '无法复制资产' }
  }
  const locate = (id: string) => {
    const asset = assets.value.find(item => item.id === id)
    if (!asset) return
    selectedId.value = id
    patch(id, { visible: true }); visible.value = true
    focusRequest.value = { id, revision: ++revision }
  }
  const importScene = (text: string) => {
    try {
      if (text.length > 1_000_000) throw new Error('场景文件不能超过 1 MB')
      const next = parseReplayScene(JSON.parse(text))
      assets.value = next.assets; visible.value = next.visible; selectedId.value = null
      focusRequest.value = null; error.value = ''
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '无法导入场景文件' }
  }
  const exportScene = () => JSON.stringify({ schema: 'aquasim-replay-scene/v1', visible: visible.value, assets: assets.value }, null, 2)
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportScene()], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'aquasim-scene.json'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return { selected, error, focusRequest, add, patch, setField, remove, duplicate, locate, importScene, exportScene, download }
}
