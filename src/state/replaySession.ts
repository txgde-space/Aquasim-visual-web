import { reactive } from 'vue'
import type { ReplayNode } from '../shared/types/replay'
import type { ReplaySnapshot } from '../features/replay/composables/useReplayResume'

export interface ReplaySessionState {
  lastReplay: ReplaySnapshot | null
  replayNodes: ReplayNode[] | null
  pendingReplayApply: ReplayNode[] | null
  pendingReplayLog: string | null
  pendingReplayName: string
}

export const session = reactive<ReplaySessionState>({
  lastReplay: null,
  replayNodes: null,
  pendingReplayApply: null,
  pendingReplayLog: null,
  pendingReplayName: '',
})
