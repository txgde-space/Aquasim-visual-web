import { ref, type Ref } from 'vue'
import type { ExperimentSpec } from '../../../shared/types/experiment'

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
  /** Called with the produced ns-3 log when the run succeeds. */
  onSuccess: (log: string, logName: string) => void
}

export const useRunExperiment = ({ getSpec, onSuccess }: RunExperimentDeps) => {
  const runStatus: Ref<RunStatus> = ref('idle')
  const runLog: Ref<string> = ref('')

  const runExperiment = async () => {
    if (runStatus.value === 'running') return
    runStatus.value = 'running'
    runLog.value = ''
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getSpec()),
      })
      const data = await response.json() as RunResponse
      runLog.value = data.stdout || data.error || ''
      if (!response.ok || data.ok === false) {
        runStatus.value = 'fail'
        return
      }
      runStatus.value = 'ok'
      if (data.log) {
        onSuccess(data.log, data.logName || 'ns3.log')
      }
    } catch (error) {
      runStatus.value = 'fail'
      runLog.value = String((error as { message?: unknown })?.message || error)
    }
  }

  return {
    runStatus,
    runLog,
    runExperiment,
  }
}

export type RunExperiment = ReturnType<typeof useRunExperiment>
