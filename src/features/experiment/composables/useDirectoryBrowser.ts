import { onBeforeUnmount, ref } from 'vue'
import { requestSimulator } from '../api/simulator'

interface DirectoryListing {
  ok?: boolean
  error?: string
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
      const { ok, data } = await requestSimulator<DirectoryListing>('simulator/directories', {
        aquaSimHome: directory,
      }, controller.signal)
      if (!ok || !data.ok) throw new Error(data.error || '无法浏览目录')
      if (pending === controller && !controller.signal.aborted) listing.value = data
    } catch (cause) {
      if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (pending === controller) {
        loading.value = false
        pending = null
      }
    }
  }

  onBeforeUnmount(() => {
    pending?.abort()
    pending = null
  })
  return { listing, loading, error, browse }
}
