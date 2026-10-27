import { onScopeDispose, ref, type Ref } from 'vue'
import type { ExperimentSpec } from '../../../shared/types/experiment'
import { requestSimulator } from '../api/simulator'

export type RunStatus = 'idle' | 'running' | 'ok' | 'fail'

interface RunResponse {
  ok?: boolean
  stdout?: string
  error?: string
  log?: string
  logName?: string
}

interface RunExperimentDeps {
  getSpec: () => ExperimentSpec
  getAquaSimHome: () => string
  /** Called with the produced ns-3 log when the run succeeds. */
  onSuccess: (log: string, logName: string) => void
}

export const useRunExperiment = ({ getSpec, getAquaSimHome, onSuccess }: RunExperimentDeps) => {
  const runStatus: Ref<RunStatus> = ref('idle')
  const runLog: Ref<string> = ref('')
  let pending: AbortController | null = null
  let disposed = false

  onScopeDispose(() => {
    disposed = true
    // Stop listening after leaving the page. The server retains its own lock and timeout.
    pending?.abort()
    pending = null
  })

  const runExperiment = async () => {
    if (disposed || runStatus.value === 'running') return
    const controller = new AbortController()
    pending = controller
    runStatus.value = 'running'
    runLog.value = ''
    try {
      const { ok, data } = await requestSimulator<RunResponse>('run', {
        spec: getSpec(), aquaSimHome: getAquaSimHome().trim(),
      }, controller.signal)
      if (pending !== controller || disposed) return
      runLog.value = data.stdout || data.error || ''
      if (!ok || data.ok === false) {
        runStatus.value = 'fail'
        return
      }
      runStatus.value = 'ok'
      if (data.log) {
        onSuccess(data.log, data.logName || 'ns3.log')
      }
    } catch (error) {
      if (controller.signal.aborted || disposed) return
      runStatus.value = 'fail'
      runLog.value = String((error as { message?: unknown })?.message || error)
    } finally {
      if (pending === controller) pending = null
    }
  }

  return {
    runStatus,
    runLog,
    runExperiment,
  }
}

export type RunExperiment = ReturnType<typeof useRunExperiment>
