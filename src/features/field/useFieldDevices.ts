import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { LOCAL_STORAGE_KEYS } from '../../shared/constants'
import { readSerialPreferences, serialPreferenceError, type FieldDevice, type FieldStatus } from './lib/devices'

const API_TIMEOUT_MS = 5000
const unavailable = '设备服务未连接，请通过 Go 服务打开真实试验页面。'

/** Only this mounted field view polls devices; it owns no simulator or replay state. */
export const useFieldDevices = () => {
  let saved: string | null = null
  const storageError = ref('')
  try { saved = localStorage.getItem(LOCAL_STORAGE_KEYS.fieldDevices) } catch { storageError.value = '串口设置仅在本次页面中保留。' }
  const preferences = reactive(readSerialPreferences(saved))
  const status = ref<FieldStatus | null>(null)
  const serviceError = ref('')
  const actionError = ref('')
  const message = ref('')
  const busy = ref(false)
  const ports = ref<string[]>([])
  const portsLoading = ref(false)
  const portsError = ref('')
  const lastStatusAt = ref(0)
  const now = ref(Date.now())
  const statusStale = computed(() => !!serviceError.value || !lastStatusAt.value || now.value - lastStatusAt.value > API_TIMEOUT_MS)
  let disposed = false
  let revision = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let polling: AbortController | null = null
  const requests = new Set<AbortController>()

  const request = async (endpoint: string, body?: unknown, controller = new AbortController()): Promise<unknown> => {
    requests.add(controller)
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    try {
      const response = await fetch(`/api/field/${endpoint}`, {
        method: body === undefined ? 'GET' : 'POST', signal: controller.signal, cache: 'no-store',
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      })
      if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error(unavailable)
      const data = await response.json()
      if (!response.ok || data?.ok !== true) throw new Error(typeof data?.error === 'string' ? data.error : `设备请求失败（${response.status}）`)
      return data
    } catch (error) {
      if (controller.signal.aborted) throw new Error('设备服务请求超时或已取消。')
      throw error
    } finally { clearTimeout(timeout); requests.delete(controller) }
  }

  const poll = async () => {
    if (disposed || polling) return
    now.value = Date.now()
    const current = revision
    const controller = new AbortController()
    polling = controller
    try {
      const data = await request('status', undefined, controller) as FieldStatus
      if (disposed || current !== revision) return
      if (!data.gps || !data.atomic || typeof data.systemTime !== 'string' || !Number.isFinite(Date.parse(data.systemTime))) throw new Error('设备服务返回的数据无效。')
      status.value = data
      serviceError.value = ''
      lastStatusAt.value = Date.now()
    } catch (error) {
      if (!disposed && current === revision) serviceError.value = error instanceof Error ? error.message : unavailable
    } finally {
      if (polling === controller) polling = null
      if (!disposed) { clearTimeout(timer); timer = setTimeout(() => { void poll() }, 1000) }
    }
  }
  const refresh = () => { clearTimeout(timer); void poll() }
  const loadPorts = async () => {
    if (disposed || portsLoading.value) return
    portsLoading.value = true; portsError.value = ''
    try {
      const data = await request('ports') as { ports?: unknown }
      if (!disposed) {
        if (!Array.isArray(data.ports) || !data.ports.every(port => typeof port === 'string')) throw new Error('串口列表无效。')
        ports.value = data.ports
      }
    } catch (error) { if (!disposed) portsError.value = error instanceof Error ? error.message : '无法读取串口列表。' }
    finally { if (!disposed) portsLoading.value = false }
  }
  const savePreferences = () => {
    try { localStorage.setItem(LOCAL_STORAGE_KEYS.fieldDevices, JSON.stringify(preferences)); storageError.value = '' }
    catch { storageError.value = '浏览器无法保存串口设置，本次仍可使用。' }
  }
  const mutate = async (endpoint: string, body: unknown, success: string) => {
    if (disposed || busy.value) return
    busy.value = true; actionError.value = ''; message.value = ''
    revision++
    // Ignore an older status response that could repaint a just-changed connection.
    polling?.abort()
    try {
      await request(endpoint, body)
      if (!disposed) { message.value = success; savePreferences() }
    } catch (error) { if (!disposed) actionError.value = error instanceof Error ? error.message : '设备操作失败。' }
    finally {
      if (!disposed) { busy.value = false; refresh() }
    }
  }
  const connect = (device: FieldDevice) => {
    const config = preferences[device]
    const error = serialPreferenceError(config)
    if (error) { actionError.value = error; return }
    void mutate('connect', { device, ...config, port: config.port.trim() }, `${device === 'gps' ? 'GPS' : '原子钟'}串口已连接，等待设备数据。`)
  }
  const disconnect = (device: FieldDevice) => { void mutate('disconnect', { device }, '串口已断开。') }
  const synchronize = (source: 'gps' | 'system') => {
    void mutate('atomic-sync', { source }, '校时指令已发送，请核对后续原子钟读数。')
  }
  onMounted(refresh)
  onBeforeUnmount(() => {
    disposed = true; revision++; clearTimeout(timer)
    requests.forEach(controller => controller.abort()); requests.clear()
  })
  return { preferences, status, serviceError, actionError, message, busy, ports, portsLoading, portsError,
    storageError, statusStale, loadPorts, connect, disconnect, synchronize, refresh, savePreferences }
}
