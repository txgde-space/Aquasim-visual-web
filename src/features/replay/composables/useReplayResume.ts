import type { ReplayStateApi } from './useReplayState'
import type { PlaybackEngine } from './usePlaybackEngine'
import type { LogPanelApi } from './useLogPanel'

export interface ReplaySnapshot {
  state: ReturnType<ReplayStateApi['captureSnapshot']>
  currentTime: number
  speed: number
  focusedPacketId: string | null
  visualMode: string
  logPanelOpen: boolean
}

/** Session-only data handoff. Engines, pending gestures and imports stay local. */
export const useReplayResume = ({ state, playback, panel }: {
  state: ReplayStateApi
  playback: PlaybackEngine
  panel: LogPanelApi
}) => ({
  capture(): ReplaySnapshot {
    return {
      state: state.captureSnapshot(),
      currentTime: playback.currentTime.value,
      speed: playback.speed.value,
      focusedPacketId: playback.focusedPacketId.value,
      visualMode: panel.visualMode.value,
      logPanelOpen: panel.logPanelOpen.value,
    }
  },
  restore(snapshot: ReplaySnapshot | null) {
    if (!snapshot) return
    state.restoreSnapshot(snapshot.state)
    playback.seekTime(snapshot.currentTime)
    playback.speed.value = snapshot.speed
    playback.focusedPacketId.value = snapshot.focusedPacketId
    // Returning resumes at the saved position, paused; hidden routes never play.
    playback.isPlaying.value = false
    panel.visualMode.value = snapshot.visualMode
    panel.logPanelOpen.value = snapshot.logPanelOpen
  },
})
