<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { GpsMap } from './useGpsMap'
import { supportsLocalFrame, type GeoPoint } from './geometry'
const props = defineProps<{ map: GpsMap; cursor: GeoPoint | null }>()
const open = ref(false), input = ref<HTMLInputElement | null>(null)
const longitude = ref(''), latitude = ref(''), originError = ref('')
const selectFile = (event: Event) => {
  const el = event.target as HTMLInputElement, file = el.files?.[0]
  if (file) props.map.load(file)
  el.value = ''
}
const displayCoordinate = (value: number) => value.toFixed(8).replace(/\.?0+$/, '')
const toggle = () => { open.value = !open.value; longitude.value = displayCoordinate(props.map.origin.value.lon); latitude.value = displayCoordinate(props.map.origin.value.lat); originError.value = '' }
const setOrigin = () => {
  const lon = Number(longitude.value), lat = Number(latitude.value), b = props.map.info.value?.bounds
  if (!b || !longitude.value.trim() || !latitude.value.trim() || !Number.isFinite(lon) || !Number.isFinite(lat) || lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) { originError.value = '原点经纬度必须位于底图范围内。'; return }
  if (!supportsLocalFrame(b, { lon, lat })) { originError.value = '底图范围超出此原点的本地坐标覆盖，请选择更靠近底图中心的原点。'; return }
  props.map.origin.value = { lon, lat }; originError.value = ''
}
watch(() => props.map.origin.value, (point) => { longitude.value = displayCoordinate(point.lon); latitude.value = displayCoordinate(point.lat) })
const attribution = computed(() => props.map.info.value?.attribution.replace(/<[^>]*>/g, '') ?? '')
</script>
<template>
  <div class="gps-control" @pointerdown.stop @wheel.stop @dblclick.stop @contextmenu.prevent.stop @keydown.esc.stop.prevent="open = false">
    <input ref="input" type="file" accept=".mbtiles" hidden @change="selectFile" />
    <section v-if="open" class="gps-panel" role="dialog" aria-label="GPS 模式设置">
      <header><strong>GPS 模式</strong><button class="btn" aria-label="关闭 GPS 设置" @click="open = false">×</button></header>
      <label class="gps-switch"><input v-model="map.enabled.value" type="checkbox" :disabled="!map.info.value" />使用卫星 / 地图底图</label>
      <button class="btn" :disabled="map.loading.value" @click="input?.click()">{{ map.loading.value ? '正在读取底图…' : map.info.value ? '更换 MBTiles 底图' : '选择 MBTiles 底图' }}</button>
      <p>支持 GB 级栅格 MBTiles（PNG / JPEG / WebP），按需从本地文件读取，不上传。刷新后需重新选择文件。</p>
      <p v-if="map.error.value" class="gps-error" role="alert">{{ map.error.value }}</p>
      <template v-if="map.info.value">
        <strong class="gps-filename">{{ map.fileName.value }}</strong>
        <p>{{ (map.fileBytes.value / 1024 ** 3).toFixed(2) }} GiB · 本地按需读取</p>
        <p>经度 {{ map.info.value.bounds[0].toFixed(6) }} ～ {{ map.info.value.bounds[2].toFixed(6) }}°<br />纬度 {{ map.info.value.bounds[1].toFixed(6) }} ～ {{ map.info.value.bounds[3].toFixed(6) }}°</p>
        <p>WGS84 · X 向东 / Y 向北，单位 m；Z 保留实验深度。底图中心默认对应 X=0、Y=0。</p>
        <form @submit.prevent="setOrigin">
          <label><span class="gps-field-head">原点经度 <span class="field-param">longitude (°)</span></span><input v-model="longitude" class="select" type="text" inputmode="decimal" /></label>
          <label><span class="gps-field-head">原点纬度 <span class="field-param">latitude (°)</span></span><input v-model="latitude" class="select" type="text" inputmode="decimal" /></label>
          <button class="btn" type="submit">应用坐标原点</button>
        </form>
        <p>调整原点会改变节点对应的地理位置，节点 XYZ 数值保持原值。测距为本地三维直线距离；比例尺为当前视图地面距离。</p>
        <p v-if="originError" class="gps-error" role="alert">{{ originError }}</p>
        <p v-if="map.tileError.value" class="gps-error" role="alert">{{ map.tileError.value }}</p>
      </template>
    </section>
    <div v-if="map.active.value" class="gps-readout">
      <span v-if="cursor" class="gps-coordinates"><span>经度 <b>{{ cursor.lon.toFixed(6) }}°</b></span><span>纬度 <b>{{ cursor.lat.toFixed(6) }}°</b></span></span>
      <span v-if="attribution" class="gps-attribution" :title="attribution">{{ attribution }}</span>
    </div>
    <button class="btn gps-toggle" :class="{ active: map.active.value }" :aria-expanded="open" @click="toggle">GPS 模式<span v-if="map.active.value" class="gps-state">已开启</span></button>
  </div>
</template>
<style scoped>
.gps-control { position: absolute; right: 14px; bottom: 12px; z-index: 30; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; max-width: calc(100% - 28px); font: 12px/1.5 var(--font-ui); }
.gps-toggle, .gps-panel, .gps-readout { border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(14px); border-radius: var(--r-lg); box-shadow: var(--shadow-island); }
.gps-toggle { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; font: 500 12px/1.5 var(--font-ui); }
.gps-state { font-size: 11px; font-weight: 400; }.gps-toggle.active { color: var(--accent); border-color: var(--accent); }
.gps-panel { width: 320px; max-width: 100%; max-height: min(520px, calc(100vh - 190px)); overflow: auto; padding: 16px; display: grid; gap: 12px; }
header strong { font-size: 14px; }
header { display: flex; justify-content: space-between; align-items: center; }p { margin: 0; font-size: 12px; line-height: 1.6; color: var(--muted); }.gps-error { color: var(--bad); }
form, form label { display: grid; gap: 8px; }form label { font-size: 12px; }.gps-switch { display: flex; gap: 8px; align-items: center; font-size: 13px; }.gps-filename { overflow-wrap: anywhere; font-size: 12px; }
.gps-field-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.gps-panel input.select { font: 12px/1.5 var(--font-mono); font-variant-numeric: tabular-nums; }
.gps-readout { display: grid; gap: 1px; padding: 4px 9px; color: var(--text); max-width: 320px; }
.gps-coordinates { display: flex; gap: 12px; font-size: 11px; white-space: nowrap; }
.gps-coordinates b { font: 400 11px/1.5 var(--font-mono); font-variant-numeric: tabular-nums; }
.gps-attribution { font: 11px/1.5 var(--font-ui); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
