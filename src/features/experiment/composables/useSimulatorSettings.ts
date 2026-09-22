import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TYPEID_LAYERS, type CatalogLayer } from '../lib/typeIdCatalog'
import { LOCAL_STORAGE_KEYS } from '../../../shared/constants'

interface SimulatorCheck {
  ok: boolean
  home?: string
  source?: 'browser' | 'environment' | 'default'
  error?: string
  defaultHome?: string
  catalog?: CatalogLayer[] | null
}

export const useSimulatorSettings = () => {
  const aquaSimHome = ref('')
  const catalog = ref<CatalogLayer[]>(TYPEID_LAYERS)
  const catalogReady = ref(false)
  const defaultHome = ref('')
  const storageError = ref('')
  const checking = ref(false)
  const buildStatus = ref<'idle' | 'building' | 'ok' | 'fail'>('idle')
  const buildLog = ref('')
  const buildError = ref('')
  const result = ref<SimulatorCheck | null>(null)
  let pending: AbortController | null = null
  try {
    aquaSimHome.value = localStorage.getItem(LOCAL_STORAGE_KEYS.aquaSimHome) || ''
  } catch {
    storageError.value = '浏览器无法读取设置，本次仍可填写目录。'
  }

  watch(aquaSimHome, (value) => {
    pending?.abort()
    pending = null
    checking.value = false
    result.value = null
    catalog.value = TYPEID_LAYERS
    catalogReady.value = false
    buildStatus.value = 'idle'
    buildLog.value = ''
    buildError.value = ''
    try {
      if (value.trim()) localStorage.setItem(LOCAL_STORAGE_KEYS.aquaSimHome, value.trim())
      else localStorage.removeItem(LOCAL_STORAGE_KEYS.aquaSimHome)
      storageError.value = ''
    } catch {
      storageError.value = '浏览器无法保存设置，目录仅在当前页面生效。'
    }
  }, { flush: 'sync' })

  const checkDirectory = async () => {
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    checking.value = true
    result.value = null
    try {
      const response = await fetch('/api/simulator/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aquaSimHome: aquaSimHome.value.trim() }),
        signal: controller.signal,
      })
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('仿真服务不可用，请通过 yarn dev 启动服务。')
      }
      const data = await response.json() as SimulatorCheck
      if (pending === controller) {
        if (data.defaultHome) defaultHome.value = data.defaultHome
        result.value = { ...data, ok: response.ok && data.ok }
        catalogReady.value = !!data.catalog
        catalog.value = data.catalog || TYPEID_LAYERS
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        result.value = { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    } finally {
      if (pending === controller) {
        checking.value = false
        pending = null
      }
    }
  }

  const precompile = async () => {
    if (buildStatus.value === 'building') return
    pending?.abort()
    pending = null
    checking.value = false
    buildStatus.value = 'building'
    buildLog.value = ''
    buildError.value = ''
    try {
      const response = await fetch('/api/simulator/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aquaSimHome: aquaSimHome.value.trim() }),
      })
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('仿真服务不可用，请通过 yarn dev 启动服务。')
      }
      const data = await response.json() as { ok?: boolean; stdout?: string; error?: string; catalog?: CatalogLayer[] }
      buildLog.value = data.stdout || ''
      if (!response.ok || !data.ok) throw new Error(data.error || '预编译失败，请查看编译输出')
      catalog.value = data.catalog || TYPEID_LAYERS
      catalogReady.value = !!data.catalog
      buildStatus.value = 'ok'
    } catch (error) {
      buildStatus.value = 'fail'
      buildError.value = error instanceof Error ? error.message : String(error)
    }
  }

  const resetDirectory = () => {
    aquaSimHome.value = ''
    void checkDirectory()
  }
  const selectDirectory = (path: string) => {
    aquaSimHome.value = path
    void checkDirectory()
  }
  onMounted(checkDirectory)
  onBeforeUnmount(() => pending?.abort())

  return { catalog, catalogReady, aquaSimHome, defaultHome, storageError, checking, result, precompile, buildStatus, buildLog, buildError, resetDirectory, selectDirectory }
}
