import { onBeforeUnmount, ref } from 'vue'

interface DirectoryListing {
  home: string
  parent: string | null
  directories: Array<{ name: string; path: string }>
  simulator: { ok: boolean; error: string }
}

export const useDirectoryBrowser = () => {
  const listing = ref<DirectoryListing | null>(null)
  const loading = ref(false)
  const error = ref('')
  let pending: AbortController | null = null

  const browse = async (directory: string) => {
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    loading.value = true
    error.value = ''
    try {
      const response = await fetch('/api/simulator/directories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aquaSimHome: directory }),
        signal: controller.signal,
      })
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('仿真服务不可用，请通过 yarn dev 启动服务。')
      }
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || '无法浏览目录')
      if (pending === controller) listing.value = data as DirectoryListing
    } catch (cause) {
      if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (pending === controller) {
        loading.value = false
        pending = null
      }
    }
  }

  onBeforeUnmount(() => pending?.abort())
  return { listing, loading, error, browse }
}
