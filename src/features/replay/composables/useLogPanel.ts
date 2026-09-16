import { ref, type Ref } from 'vue'
import type { LifecycleStage, PacketEntry } from '@/shared/types/replay'
import { clampRatio } from '../lib/format'
import type { ReplayStateApi } from './useReplayState'
import type { PlaybackEngine } from './usePlaybackEngine'

interface DragEventState {
  eventId: string
  minUs: number
  maxUs: number
  left: number
  width: number
}

/** Minimal shape needed to seek by dragging an event track (LogPanel builds this for lifecycle stages). */
export interface PacketTrackTarget {
  eventId: string
  startUs: number
  endUs: number
  packet_id?: string
}

export const useLogPanel = ({
  state,
  playback,
}: {
  state: ReplayStateApi
  playback: PlaybackEngine
}) => {
  const logPanelOpen: Ref<boolean> = ref(false)
  const visualMode: Ref<string> = ref('2d')
  const activeDragEvent: Ref<DragEventState | null> = ref(null)
  const suppressLogClick: Ref<string | null> = ref(null)

  const onReplayModeChange = (event: Event) => {
    state.replayMode.value = (event.target as HTMLSelectElement).value
    if (state.replayMode.value === 'lifecycle' && state.lifecyclePacket.value) {
      playback.focusedPacketId.value = state.lifecyclePacket.value.packet_id
      playback.seekTime(state.lifecyclePacket.value.startUs)
    }
  }

  const onLifecyclePacketChange = (event: Event) => {
    state.selectedLifecyclePacketId.value = (event.target as HTMLSelectElement).value
    if (state.lifecyclePacket.value) {
      playback.focusedPacketId.value = state.lifecyclePacket.value.packet_id
      playback.seekTime(state.lifecyclePacket.value.startUs)
    }
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || (event.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|OPTION)$/i.test((event.target as HTMLElement).tagName))) {
      return
    }
    event.preventDefault()
    playback.togglePlay()
  }

  const onLogSelect = (packet: PacketEntry) => {
    if (suppressLogClick.value === packet.eventId) {
      suppressLogClick.value = null
      return
    }

    if (activeDragEvent.value && activeDragEvent.value.eventId === packet.eventId) {
      return
    }

    playback.focusedPacketId.value = packet.eventId
    playback.seekTime(packet.tx_start_us)
  }

  const onLifecycleStageSelect = (stage: LifecycleStage | null) => {
    if (!stage) return
    playback.seekTime(stage.startUs)
  }

  const onEventTrackPointerDown = (packet: PacketTrackTarget, event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    playback.focusedPacketId.value = packet.eventId

    const startUs = Number(packet.startUs)
    const durationUs = Math.max(1, Number(packet.endUs - startUs))
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const ratio = clampRatio(((event as PointerEvent).clientX - rect.left) / Math.max(rect.width, 1))
    playback.seekTime(startUs + (durationUs * ratio))

    activeDragEvent.value = {
      eventId: packet.eventId,
      minUs: startUs,
      maxUs: startUs + durationUs,
      left: rect.left,
      width: Math.max(rect.width, 1),
    }
    suppressLogClick.value = packet.eventId
  }

  const onGlobalPointerMove = (event: PointerEvent) => {
    if (!activeDragEvent.value) return

    const durationUs = Math.max(1, activeDragEvent.value.maxUs - activeDragEvent.value.minUs)
    const ratio = clampRatio((event.clientX - activeDragEvent.value.left) / activeDragEvent.value.width)
    playback.seekTime(activeDragEvent.value.minUs + (durationUs * ratio))
  }

  const onGlobalPointerUp = () => {
    if (activeDragEvent.value) {
      const eventId = activeDragEvent.value.eventId
      requestAnimationFrame(() => {
        if (suppressLogClick.value === eventId) suppressLogClick.value = null
      })
    }
    activeDragEvent.value = null
  }

  return {
    logPanelOpen,
    visualMode,
    activeDragEvent,
    suppressLogClick,
    onReplayModeChange,
    onLifecyclePacketChange,
    onKeydown,
    onLogSelect,
    onLifecycleStageSelect,
    onEventTrackPointerDown,
    onGlobalPointerMove,
    onGlobalPointerUp,
  }
}

export type LogPanelApi = ReturnType<typeof useLogPanel>
