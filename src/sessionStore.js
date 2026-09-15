import { reactive } from 'vue'

export const session = reactive({
  replayNodes: null,
  pendingReplayApply: null,
  pendingReplayLog: null,
  pendingReplayName: '',
})
