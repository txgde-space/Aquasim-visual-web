import { onScopeDispose, ref, shallowRef, type Component } from 'vue'

const SCENE_LOAD_TIMEOUT_MS = 20_000

/** Keep import failures, timeouts and stale retry results out of the scene. */
export const useSceneLoader = (
  importScene: () => Promise<Component>,
  timeoutMs = SCENE_LOAD_TIMEOUT_MS,
) => {
  const component = shallowRef<Component | null>(null)
  const error = shallowRef<Error | null>(null)
  const loading = ref(false)
  let version = 0
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const reportError = (cause: unknown) => {
    if (disposed) return
    version += 1
    clearTimer()
    component.value = null
    loading.value = false
    error.value = cause instanceof Error ? cause : new Error(String(cause || '3D 场景初始化失败'))
  }

  const load = async () => {
    if (disposed) return
    const request = ++version
    clearTimer()
    component.value = null
    error.value = null
    loading.value = true
    timer = setTimeout(() => {
      if (request === version) reportError(new Error('加载 3D 视图超时，请重试。'))
    }, timeoutMs)
    try {
      const next = await importScene()
      if (disposed || request !== version) return
      clearTimer()
      component.value = next
      loading.value = false
    } catch (cause) {
      if (request === version) reportError(cause)
    }
  }

  onScopeDispose(() => {
    disposed = true
    version += 1
    clearTimer()
  })

  return { component, error, loading, load, reportError }
}
