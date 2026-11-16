import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { Projection } from '../lib/coordinate'
import { geographic, projectedBounds, supportsLocalFrame, tileBounds, visibleTiles, type GeoPoint, type GpsMapInfo } from './geometry'

const IMAGE_CACHE_BYTES = 64 * 1024 * 1024
export const useGpsMap = (scheduleDraw: () => void) => {
  const enabled = ref(false), loading = ref(false), error = ref(''), tileError = ref('')
  const info = shallowRef<GpsMapInfo | null>(null), origin = ref<GeoPoint>({ lon: 0, lat: 0 })
  const bounds = computed(() => info.value ? projectedBounds(info.value.bounds) : null)
  const active = computed(() => enabled.value && !!info.value)
  const sourceFile = shallowRef<File | null>(null)
  const fileName = ref('')
  const fileBytes = ref(0)
  const readStats = shallowRef({ bytesRead: 0, reads: 0, maxOffset: 0, cacheBytes: 0 })
  let imageBytes = 0
  let worker: Worker | null = null, candidateWorker: Worker | null = null, generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const cache = new Map<string, ImageBitmap | null>(), pending = new Set<string>()
  const clear = () => { for (const bitmap of cache.values()) bitmap?.close(); cache.clear(); pending.clear(); imageBytes = 0 }
  const dispose = () => { generation++; worker?.terminate(); candidateWorker?.terminate(); worker = null; candidateWorker = null; clearTimeout(timer); clear() }
  const load = (file: File, savedOrigin?: GeoPoint) => {
    error.value = ''
    if (!file.size) { error.value = '底图文件为空。'; return }
    // The former source remains usable until the replacement is validated.
    candidateWorker?.terminate()
    const candidate = new Worker(new URL('./mbtiles.worker.ts', import.meta.url), { type: 'module' })
    candidateWorker = candidate
    const token = ++generation
    loading.value = true
    clearTimeout(timer)
    const fail = (message: string) => {
      candidate.terminate()
      if (token !== generation) return
      loading.value = false; error.value = message; clearTimeout(timer)
    }
    timer = setTimeout(() => fail('读取底图超时，请重试或裁剪文件范围。'), 60000)
    candidate.onerror = () => {
      if (candidate === worker) { tileError.value = '底图读取器异常，请重新选择文件。'; pending.clear() }
      else fail('底图读取器启动失败，请重新选择文件。')
    }
    candidate.onmessage = async ({ data }) => {
      if (token !== generation && candidate !== worker) { candidate.terminate(); return }
      if (data.stats) readStats.value = data.stats
      if (data.type === 'error') {
        if (candidate !== worker) fail(`底图加载失败：${data.message}`)
        else { tileError.value = `瓦片读取失败：${data.message}`; for (const key of data.keys ?? []) { pending.delete(key); if (!cache.has(key)) cache.set(key, null) }; scheduleDraw() }
      }
      if (data.type === 'ready') {
        const next = data.info as GpsMapInfo
        const b = projectedBounds(next.bounds)
        // A single local EN plane cannot represent the back hemisphere of the Earth.
        if (!supportsLocalFrame(next.bounds, geographic({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }))) { fail('底图范围过大，请裁剪为实验所在区域，以建立唯一的本地东 / 北坐标。'); return }
        worker?.terminate(); clear(); worker = candidate; candidateWorker = null
        info.value = next; fileName.value = file.name; fileBytes.value = file.size
        origin.value = geographic({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 })
        if (savedOrigin && Number.isFinite(savedOrigin.lon) && Number.isFinite(savedOrigin.lat) && savedOrigin.lon >= next.bounds[0] && savedOrigin.lon <= next.bounds[2] && savedOrigin.lat >= next.bounds[1] && savedOrigin.lat <= next.bounds[3] && supportsLocalFrame(next.bounds, savedOrigin)) origin.value = { ...savedOrigin }
        sourceFile.value = file
        loading.value = false; enabled.value = true; tileError.value = ''; clearTimeout(timer); scheduleDraw()
      }
      if (data.type === 'tiles') {
        for (const { key, bytes } of data.tiles as { key: string; bytes: Uint8Array | null }[]) {
          let bitmap: ImageBitmap | null = null
          try { if (bytes) bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)])) }
          catch { tileError.value = '部分瓦片图像损坏或无法解码。' }
          if (candidate !== worker) { bitmap?.close(); return }
          pending.delete(key)
          const previous = cache.get(key)
          if (previous) { imageBytes -= previous.width * previous.height * 4; previous.close() }
          cache.set(key, bitmap)
          if (bitmap) imageBytes += bitmap.width * bitmap.height * 4
        }
        while (cache.size > 512 || imageBytes > IMAGE_CACHE_BYTES) {
          const key = cache.keys().next().value!, old = cache.get(key)
          if (old) { imageBytes -= old.width * old.height * 4; old.close() }
          cache.delete(key)
        }
        scheduleDraw()
      }
    }
    candidate.postMessage({ type: 'open', file })
  }
  const draw = (ctx: CanvasRenderingContext2D, proj: Projection, width: number, height: number, background: string, labelColor: string) => {
    if (!active.value || !info.value || !worker) return
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height)
    const tiles = visibleTiles(proj, width, height, info.value.zooms), requests = []
    const screen = (x: number, y: number) => ({ x: proj.origin.x + (x - proj.bounds.minX) * proj.scale + proj.pan.x, y: proj.origin.y + (proj.bounds.maxY - y) * proj.scale + proj.pan.y })
    ctx.save()
    const nw = screen(proj.bounds.minX, proj.bounds.maxY)
    ctx.beginPath(); ctx.rect(nw.x, nw.y, proj.bounds.spanX * proj.scale, proj.bounds.spanY * proj.scale); ctx.clip()
    for (const tile of tiles) {
      const b = tileBounds(tile.z, tile.x, tile.y), p = screen(b.x, b.y), size = b.span * proj.scale
      const image = cache.get(tile.key)
      if (image) { ctx.drawImage(image, p.x, p.y, size + 0.3, size + 0.3); cache.delete(tile.key); cache.set(tile.key, image) }
      else if (cache.has(tile.key)) {
        // Use a cached parent while a sparse high-zoom tileset has no imagery here.
        let filled = false
        for (const z of info.value.zooms.filter(z => z < tile.z).reverse()) {
          const factor = 2 ** (tile.z - z), x = Math.floor(tile.x / factor), y = Math.floor(tile.y / factor), key = `${z}/${x}/${y}`
          const parent = cache.get(key)
          if (parent) { ctx.drawImage(parent, (tile.x % factor) / factor * parent.width, (tile.y % factor) / factor * parent.height, parent.width / factor, parent.height / factor, p.x, p.y, size + 0.3, size + 0.3); filled = true; break }
          if (!cache.has(key)) {
            if (!pending.has(key) && pending.size < 64) { pending.add(key); requests.push({ z, x, y, key }) }
            break
          }
        }
        if (!filled && size > 80) { ctx.fillStyle = labelColor; ctx.font = '12px sans-serif'; ctx.fillText('此处无瓦片', p.x + 12, p.y + 24) }
      } else if (!pending.has(tile.key) && pending.size < 64) { pending.add(tile.key); requests.push(tile) }
    }
    ctx.restore()
    if (requests.length) worker.postMessage({ type: 'tiles', tiles: requests })
  }
  onBeforeUnmount(dispose)
  return { sourceFile, enabled, active, loading, error, tileError, info, origin, bounds, fileName, fileBytes, readStats, load, draw }
}
export type GpsMap = ReturnType<typeof useGpsMap>
