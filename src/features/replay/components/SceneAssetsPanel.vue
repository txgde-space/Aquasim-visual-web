<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { SCENE_ASSET_CATALOG, sceneAssetDefinition, type SceneAsset, type SceneAssetType } from '@/shared/sceneAssets'
import { sceneAssetSizeLabel } from '@/shared/sceneAssetGeometry'
import SceneAssetThumbnail from './SceneAssetThumbnail.vue'

defineProps<{ open: boolean; assets: SceneAsset[]; visible: boolean; selected: SceneAsset | null; error: string }>()
const emit = defineEmits<{
  close: []; add: [type: SceneAssetType]; select: [id: string]; locate: [id: string]; remove: [id: string]; duplicate: [id: string]
  'update:visible': [value: boolean]; patch: [id: string, changes: Partial<SceneAsset>]
  field: [id: string, field: 'x' | 'y' | 'z' | 'heading' | 'scale' | 'name', value: string]
  import: [text: string]; export: []; 'import-error': [message: string]
}>()
const fileEl = ref<HTMLInputElement | null>(null)
let importVersion = 0
onBeforeUnmount(() => { importVersion++ })
const readFile = async (event: Event) => {
  const input = event.target as HTMLInputElement, file = input.files?.[0], version = ++importVersion
  input.value = ''
  if (!file) return
  if (file.size > 1_000_000) { emit('import-error', '场景文件不能超过 1 MB'); return }
  try {
    const text = await file.text()
    if (version === importVersion) emit('import', text)
  } catch { if (version === importVersion) emit('import-error', '无法读取场景文件') }
}
const valueOf = (event: Event) => (event.target as HTMLInputElement).value
const checked = (event: Event) => (event.target as HTMLInputElement).checked
</script>

<template>
  <Transition name="flyout">
    <section v-if="open" class="dock scenery-panel" aria-label="场景资产" @pointerdown.stop @wheel.stop @keydown.esc.stop.prevent="emit('close')">
      <header><div><span class="eyebrow">SCENE LIBRARY</span><h2>场景资产</h2></div><button class="close" aria-label="关闭场景资产" @click="emit('close')">×</button></header>
      <div class="scenery-actions">
        <label><input type="checkbox" :checked="visible" @change="emit('update:visible', checked($event))" />显示场景</label>
        <div><button class="btn" @click="fileEl?.click()">导入</button><button class="btn" @click="emit('export')">保存场景</button></div>
        <input ref="fileEl" class="file-input" type="file" accept=".json,application/json" aria-label="导入场景文件" @change="readFile" />
      </div>
      <div class="scenery-scroll">
        <div class="asset-catalog">
          <button v-for="asset in SCENE_ASSET_CATALOG" :key="asset.type" class="asset-tile" :aria-label="`添加${asset.label}`" @click="emit('add', asset.type)">
            <span class="asset-category">{{ asset.group }}</span><SceneAssetThumbnail :type="asset.type" /><strong>{{ asset.label }}</strong><span class="asset-plus" aria-hidden="true">＋</span>
          </button>
        </div>
        <div class="assets-heading"><h3>已添加</h3><span>{{ assets.length }} / 128</span></div>
        <p v-if="!assets.length" class="empty">选择上方资产添加到场景</p>
        <ul v-else class="asset-list">
          <li v-for="asset in assets" :key="asset.id" :class="{ selected: selected?.id === asset.id }">
            <input type="checkbox" :checked="asset.visible" :aria-label="`显示${asset.name}`" @change="emit('patch', asset.id, { visible: checked($event) })" />
            <button class="asset-name" @click="emit('select', asset.id)"><strong>{{ asset.name }}</strong><span>{{ sceneAssetDefinition(asset.type).label }}</span></button>
            <button class="locate" :aria-label="`定位${asset.name}`" title="定位查看" @click="emit('locate', asset.id)">⌖</button>
          </li>
        </ul>
        <form v-if="selected" :key="selected.id" class="asset-editor" @submit.prevent>
          <h3>资产设置</h3>
          <span class="asset-dimensions">{{ sceneAssetSizeLabel(selected.type, selected.scale) }}</span>
          <label class="field"><span>名称</span><input :value="selected.name" maxlength="80" @change="emit('field', selected.id, 'name', valueOf($event))" /></label>
          <div class="asset-coordinates">
            <label v-for="axis in (['x', 'y', 'z'] as const)" :key="axis" class="field"><span>{{ axis.toUpperCase() }} <small>m</small></span><input :aria-label="`资产 ${axis.toUpperCase()} 坐标`" :value="selected[axis]" placeholder="m / km" title="支持 m、km，无单位按米" @change="emit('field', selected.id, axis, valueOf($event))" /></label>
          </div>
          <div class="asset-coordinates two">
            <label class="field"><span>朝向 <small>°</small></span><input aria-label="资产朝向" :value="selected.heading" type="number" step="5" @change="emit('field', selected.id, 'heading', valueOf($event))" /></label>
            <label class="field"><span>缩放 <small>×</small></span><input aria-label="资产缩放" :value="selected.scale" type="number" min="0.05" max="100" step="0.25" @change="emit('field', selected.id, 'scale', valueOf($event))" /></label>
          </div>
          <button v-if="selected.scale !== 1" class="btn" @click="emit('patch', selected.id, { scale: 1 })">恢复原尺寸</button>
          <div class="editor-actions"><button class="btn" @click="emit('locate', selected.id)">定位查看</button><button class="btn" @click="emit('duplicate', selected.id)">复制</button><button class="btn danger" @click="emit('remove', selected.id)">删除</button></div>
        </form>
        <p v-if="error" class="asset-error" role="alert">{{ error }}</p>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.scenery-panel { position: absolute; z-index: 10; left: 14px; top: 18px; width: 310px; max-height: calc(100% - 100px); display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--panel); backdrop-filter: blur(20px); box-shadow: var(--shadow-island); color: var(--text); overflow: hidden; }
header { display: flex; justify-content: space-between; align-items: center; padding: 15px 16px 12px; border-bottom: 1px solid var(--line); }
h2, h3, p { margin: 0; } h2 { font-size: 15px; margin-top: 3px; } h3 { font-size: 12px; }
.eyebrow { font: 9px var(--font-mono); letter-spacing: 0.15em; color: var(--accent); }
button { cursor: pointer; } .close { border: 0; background: transparent; color: var(--muted); font-size: 23px; }
.scenery-actions { display: flex; align-items: center; justify-content: space-between; padding: 10px 13px; gap: 8px; border-bottom: 1px solid var(--line); font-size: 11px; }
.scenery-actions label { display: flex; gap: 6px; align-items: center; white-space: nowrap; } .scenery-actions > div { display: flex; gap: 5px; }
.btn { font-size: 11px; padding: 6px 8px; } .file-input { display: none; }
.scenery-scroll { padding: 13px; overflow-y: auto; min-height: 0; overscroll-behavior: contain; }
.asset-catalog { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.asset-tile { position: relative; display: flex; flex-direction: column; align-items: flex-start; padding: 10px; min-height: 64px; text-align: left; color: var(--text); background: var(--sunken); border: 1px solid var(--line); border-radius: var(--r-sm); transition: border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out); }
.asset-tile:hover { border-color: var(--accent); background: var(--panel); } .asset-tile strong { font-size: 11px; font-weight: 500; margin-top: 7px; }
.asset-category { color: var(--muted); font-size: 9px; } .asset-plus { position: absolute; right: 8px; top: 7px; color: var(--accent); font-size: 14px; }
.assets-heading { display: flex; justify-content: space-between; margin: 18px 0 9px; align-items: center; } .assets-heading > span { color: var(--muted); font: 10px var(--font-mono); }
.empty { padding: 18px 0; text-align: center; font-size: 11px; color: var(--muted); }
.asset-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.asset-list li { display: flex; gap: 8px; align-items: center; padding: 7px; border: 1px solid var(--line); border-radius: var(--r-sm); }
.asset-list li.selected { border-color: var(--accent); } .asset-name { flex: 1; min-width: 0; text-align: left; background: transparent; border: 0; color: var(--text); display: flex; flex-direction: column; gap: 4px; padding: 2px; }
.asset-name strong { font-size: 11px; font-weight: 500; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .asset-name span { font-size: 9px; color: var(--muted); }
.locate { background: var(--sunken); color: var(--accent); border: 1px solid var(--line); border-radius: var(--r-sm); width: 27px; height: 27px; font-size: 18px; }
.asset-editor { margin-top: 15px; padding-top: 13px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 11px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 11px; min-width: 0; } .field small { color: var(--muted); font: 10px var(--font-mono); }
.field input { width: 100%; min-width: 0; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--sunken); padding: 7px 8px; color: var(--text); font: 11px var(--font-mono); }
.field input:focus { outline: 1px solid var(--accent); } .asset-coordinates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; } .asset-coordinates.two { grid-template-columns: 1fr 1fr; }
.editor-actions { display: flex; gap: 7px; } .editor-actions .danger { color: var(--bad); margin-left: auto; }
.asset-dimensions { color: var(--muted); font: 10px var(--font-mono); font-variant-numeric: tabular-nums; }
.asset-error { color: var(--bad); font-size: 11px; line-height: 1.5; padding: 10px 0; }
@media (max-width: 700px) { .scenery-panel { top: 70px; max-height: calc(100% - 150px); width: min(310px, calc(100% - 28px)); } }
</style>
