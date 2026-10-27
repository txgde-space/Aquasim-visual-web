import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TYPEID_LAYERS, type CatalogLayer } from '../lib/typeIdCatalog'
import { LOCAL_STORAGE_KEYS } from '../../../shared/constants'
import { requestSimulator } from '../api/simulator'

const PROGRESS_TIMEOUT_MS = 10_000
const WAIT_STATUS_FAILURE_LIMIT = 3

interface SimulatorCheck {
  ok: boolean
  home?: string
  source?: 'browser' | 'environment' | 'default'
  error?: string
  defaultHome?: string
  catalog?: CatalogLayer[] | null
}

interface BuildProgress {
  phase: 'waiting' | 'configure' | 'build' | 'catalog' | 'done' | 'failed'
  completed: number
  total: number
}

interface OperationResponse {
  ok?: boolean
  code?: string
  stdout?: string
  error?: string
  catalog?: CatalogLayer[]
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
  const buildProgress = ref<BuildProgress | null>(null)
  const cleanStatus = ref<'idle' | 'cleaning' | 'ok' | 'fail'>('idle')
  const cleanError = ref('')
  const result = ref<SimulatorCheck | null>(null)
  let pending: AbortController | null = null
  let operation: AbortController | null = null
  let progressRequest: AbortController | null = null
  let onRunnerAvailable: ((error?: Error) => void) | null = null
  let waitingStatusFailures = 0
  let disposed = false
  let startupPrecompilePending = true
  let progressTimer: ReturnType<typeof setInterval> | null = null
  const stopProgressPolling = () => {
    if (progressTimer) clearInterval(progressTimer)
    progressTimer = null
    progressRequest?.abort()
    progressRequest = null
  }
  const invalidateOperation = () => {
    operation?.abort()
    operation = null
    stopProgressPolling()
    // Release the suspended caller too; its controller check prevents a retry.
    onRunnerAvailable?.()
    onRunnerAvailable = null
  }
  const pollBuildProgress = async () => {
    if (disposed || progressRequest || !operation || buildStatus.value !== 'building') return
    const currentOperation = operation
    const wasWaiting = buildProgress.value?.phase === 'waiting'
    const controller = new AbortController()
    progressRequest = controller
    const timeout = setTimeout(() => controller.abort(), PROGRESS_TIMEOUT_MS)
    controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true })
    try {
      const { ok, data } = await requestSimulator<{
        progress?: BuildProgress | null
        task?: { kind: 'build' | 'run' | 'clean'; home: string } | null
      }>('simulator/build-progress', {
        aquaSimHome: aquaSimHome.value.trim(),
      }, controller.signal)
      if (!ok) throw new Error('任务状态请求失败')
      if (ok && operation === currentOperation && !controller.signal.aborted) {
        if (buildProgress.value?.phase === 'waiting') {
          waitingStatusFailures = 0
          // Only a fresh, explicit idle status can resume a rejected request.
          // Completed progress may belong to a previous build, not this task.
          if (wasWaiting && data.task === null) {
            onRunnerAvailable?.()
            onRunnerAvailable = null
          }
        } else if (data.progress) buildProgress.value = data.progress
      }
    } catch {
      // A transient progress request must not interrupt the actual build.
      if (wasWaiting && operation === currentOperation && buildProgress.value?.phase === 'waiting') {
        waitingStatusFailures += 1
        if (waitingStatusFailures >= WAIT_STATUS_FAILURE_LIMIT) {
          onRunnerAvailable?.(new Error('无法获取当前任务状态，请检查仿真服务后重新预编译。'))
          onRunnerAvailable = null
        }
      }
    } finally {
      clearTimeout(timeout)
      if (progressRequest === controller) progressRequest = null
    }
  }
  try {
    aquaSimHome.value = localStorage.getItem(LOCAL_STORAGE_KEYS.aquaSimHome) || ''
  } catch {
    storageError.value = '浏览器无法读取设置，本次仍可填写目录。'
  }

  watch(aquaSimHome, (value) => {
    startupPrecompilePending = false
    pending?.abort()
    pending = null
    invalidateOperation()
    checking.value = false
    result.value = null
    catalog.value = TYPEID_LAYERS
    catalogReady.value = false
    buildStatus.value = 'idle'
    buildLog.value = ''
    buildError.value = ''
    buildProgress.value = null
    cleanStatus.value = 'idle'
    cleanError.value = ''
    try {
      if (value.trim()) localStorage.setItem(LOCAL_STORAGE_KEYS.aquaSimHome, value.trim())
      else localStorage.removeItem(LOCAL_STORAGE_KEYS.aquaSimHome)
      storageError.value = ''
    } catch {
      storageError.value = '浏览器无法保存设置，目录仅在当前页面生效。'
    }
  }, { flush: 'sync' })

  const checkDirectory = async (precompileAfterCheck = false) => {
    if (!precompileAfterCheck) startupPrecompilePending = false
    if (disposed) return
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    checking.value = true
    result.value = null
    try {
      const { ok, data } = await requestSimulator<SimulatorCheck>('simulator/check', {
        aquaSimHome: aquaSimHome.value.trim(),
      }, controller.signal)
      if (pending === controller && !controller.signal.aborted && !disposed) {
        if (data.defaultHome) defaultHome.value = data.defaultHome
        result.value = { ...data, ok: ok && data.ok }
        catalogReady.value = ok && data.ok && !!data.catalog
        catalog.value = catalogReady.value ? data.catalog! : TYPEID_LAYERS
        // Only the initial check may build automatically. Explicit directory
        // changes and operations consume this opportunity, including late replies.
        if (precompileAfterCheck && startupPrecompilePending && ok && data.ok) void precompile()
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
    startupPrecompilePending = false
    if (disposed || buildStatus.value === 'building' || cleanStatus.value === 'cleaning') return
    pending?.abort()
    pending = null
    checking.value = false
    invalidateOperation()
    const controller = new AbortController()
    operation = controller
    buildStatus.value = 'building'
    buildLog.value = ''
    buildError.value = ''
    buildProgress.value = { phase: 'configure', completed: 0, total: 0 }
    cleanStatus.value = 'idle'
    progressTimer = setInterval(() => { void pollBuildProgress() }, 600)
    void pollBuildProgress()
    try {
      while (operation === controller && !controller.signal.aborted) {
        const { ok, status, data } = await requestSimulator<OperationResponse>('simulator/build', {
          aquaSimHome: aquaSimHome.value.trim(),
        }, controller.signal)
        if (operation !== controller || controller.signal.aborted) return
        if (status === 409 && data.code === 'SIMULATOR_BUSY') {
          buildProgress.value = { phase: 'waiting', completed: 0, total: 0 }
          waitingStatusFailures = 0
          progressRequest?.abort()
          progressRequest = null
          await new Promise<void>((resolve, reject) => {
            onRunnerAvailable = (error) => error ? reject(error) : resolve()
            void pollBuildProgress()
          })
          if (operation !== controller || controller.signal.aborted) return
          buildProgress.value = { phase: 'configure', completed: 0, total: 0 }
          continue
        }
        buildLog.value = data.stdout || ''
        if (!ok || !data.ok) throw new Error(data.error || '预编译失败，请查看编译输出')
        catalog.value = data.catalog || TYPEID_LAYERS
        catalogReady.value = !!data.catalog
        buildStatus.value = 'ok'
        buildProgress.value = { phase: 'done', completed: 1, total: 1 }
        break
      }
    } catch (error) {
      if (operation !== controller || controller.signal.aborted) return
      buildStatus.value = 'fail'
      buildError.value = error instanceof Error ? error.message : String(error)
    } finally {
      if (operation === controller) invalidateOperation()
    }
  }

  const clearBuild = async () => {
    startupPrecompilePending = false
    if (disposed || buildStatus.value === 'building' || cleanStatus.value === 'cleaning') return
    pending?.abort()
    pending = null
    checking.value = false
    invalidateOperation()
    const controller = new AbortController()
    operation = controller
    cleanStatus.value = 'cleaning'
    cleanError.value = ''
    buildLog.value = ''
    try {
      const { ok, data } = await requestSimulator<OperationResponse>('simulator/clean', {
        aquaSimHome: aquaSimHome.value.trim(),
      }, controller.signal)
      if (operation !== controller || controller.signal.aborted) return
      buildLog.value = data.stdout || ''
      if (!ok || !data.ok) throw new Error(data.error || '清除构建失败')
      catalog.value = TYPEID_LAYERS
      catalogReady.value = false
      buildStatus.value = 'idle'
      buildProgress.value = null
      buildError.value = ''
      cleanStatus.value = 'ok'
    } catch (error) {
      if (operation !== controller || controller.signal.aborted) return
      cleanStatus.value = 'fail'
      cleanError.value = error instanceof Error ? error.message : String(error)
    } finally {
      if (operation === controller) invalidateOperation()
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
  onMounted(() => { void checkDirectory(true) })
  onBeforeUnmount(() => {
    disposed = true
    pending?.abort()
    pending = null
    invalidateOperation()
  })

  return { catalog, catalogReady, aquaSimHome, defaultHome, storageError, checking, result, precompile, buildStatus, buildLog, buildError, buildProgress, clearBuild, cleanStatus, cleanError, resetDirectory, selectDirectory }
}
