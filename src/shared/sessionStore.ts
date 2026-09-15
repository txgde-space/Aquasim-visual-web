import { reactive } from 'vue'
import type { ReplayNode } from './types/replay'

export interface ReplaySessionState {
  replayNodes: ReplayNode[] | null
  pendingReplayApply: ReplayNode[] | null
  pendingReplayLog: string | null
  pendingReplayName: string
}

export const session = reactive<ReplaySessionState>({
  replayNodes: null,
  pendingReplayApply: null,
  pendingReplayLog: null,
  pendingReplayName: '',
})
