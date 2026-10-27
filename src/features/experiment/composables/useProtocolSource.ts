import { onScopeDispose, ref, watch } from 'vue'
import { requestSimulator } from '../api/simulator'

export interface ProtocolSourceFile {
  path: string
  language: 'cpp'
}

interface ProtocolSourceResponse {
  ok: boolean
  error?: string
  typeId?: string
  files?: ProtocolSourceFile[]
  selectedPath?: string
  code?: string
}

export const useProtocolSource = (getDirectory: () => string, getTypeId: () => string) => {
  const files = ref<ProtocolSourceFile[]>([])
  const selectedPath = ref('')
  const code = ref('')
  const loading = ref(false)
  const error = ref('')
  let pending: AbortController | null = null
  let requestedPath: string | undefined
  let disposed = false

  const load = async (path?: string) => {
    if (disposed) return
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    requestedPath = path
    selectedPath.value = path || ''
    code.value = ''
    error.value = ''
    loading.value = true
    const typeId = getTypeId()
    try {
      const { ok, data } = await requestSimulator<ProtocolSourceResponse>('simulator/source', {
        aquaSimHome: getDirectory().trim(), typeId, ...(path ? { path } : {}),
      }, controller.signal)
      if (pending !== controller || controller.signal.aborted || disposed) return
      if (!ok || !data.ok) throw new Error(data.error || '无法读取协议源码')
      if (data.typeId !== typeId || !Array.isArray(data.files) || typeof data.code !== 'string'
        || typeof data.selectedPath !== 'string'
        || !data.files.every((file) => file && typeof file.path === 'string' && file.language === 'cpp')
        || !data.files.some((file) => file.path === data.selectedPath)) {
        throw new Error('仿真服务返回了无效的源码信息')
      }
      files.value = data.files
      selectedPath.value = data.selectedPath
      code.value = data.code
    } catch (cause) {
      if (pending === controller && !controller.signal.aborted && !disposed) {
        error.value = cause instanceof Error ? cause.message : String(cause)
      }
    } finally {
      if (pending === controller) {
        pending = null
        loading.value = false
      }
    }
  }

  watch([getDirectory, getTypeId], () => {
    files.value = []
    void load()
  }, { immediate: true, flush: 'sync' })

  const selectFile = (path: string) => {
    if (!files.value.some((file) => file.path === path)) return
    if (path === selectedPath.value && !error.value) return
    void load(path)
  }
  const retry = () => { void load(requestedPath) }

  onScopeDispose(() => {
    disposed = true
    pending?.abort()
    pending = null
  })

  return { files, selectedPath, code, loading, error, selectFile, retry }
}
