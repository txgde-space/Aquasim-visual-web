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
  startX: number
  startY: number
  moved: boolean
}

/** A press that travels farther than this counts as a drag, not a click. */
export const DRAG_CLICK_THRESHOLD_PX = 6

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
    // Consume-on-read: any click clears the flag, so a stale suppression
    // from a drag released off-item cannot eat a future genuine click.
    const suppressedEventId = suppressLogClick.value
    suppressLogClick.value = null
    if (suppressedEventId === packet.eventId) {
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
    playback.scrubStart()

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
      startX: (event as PointerEvent).clientX,
      startY: (event as PointerEvent).clientY,
      moved: false,
    }
  }

  const onGlobalPointerMove = (event: PointerEvent) => {
    if (!activeDragEvent.value) return

    if (!activeDragEvent.value.moved) {
      const dx = Math.abs(event.clientX - activeDragEvent.value.startX)
      const dy = Math.abs(event.clientY - activeDragEvent.value.startY)
      if (Math.max(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
        activeDragEvent.value = { ...activeDragEvent.value, moved: true }
      }
    }

    const durationUs = Math.max(1, activeDragEvent.value.maxUs - activeDragEvent.value.minUs)
    const ratio = clampRatio((event.clientX - activeDragEvent.value.left) / activeDragEvent.value.width)
    playback.queueSeek(activeDragEvent.value.minUs + (durationUs * ratio))
  }

  const onGlobalPointerUp = () => {
    if (activeDragEvent.value?.moved) {
      // The gesture was a drag: suppress the click that follows pointerup.
      suppressLogClick.value = activeDragEvent.value.eventId
    }
    activeDragEvent.value = null
    playback.scrubEnd()
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
