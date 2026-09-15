import { computed, ref, watch, type Ref } from 'vue'
import { normalizeTime } from '../lib/format'

export interface PlaybackEngineOptions {
  /** Lazy getter: wired after replay state exists (circular dependency break). */
  getCycleEndUs: () => number
}

export const usePlaybackEngine = (options: PlaybackEngineOptions) => {
  const currentTime: Ref<number> = ref(0)
  const isPlaying: Ref<boolean> = ref(false)
  const speed: Ref<number> = ref(1)
  const focusedPacketId: Ref<string | null> = ref(null)

  let raf = 0
  let lastTs = 0

  const clampTime = (us: unknown): number => Math.max(0, Math.min(options.getCycleEndUs(), normalizeTime(us)))

  const rangeProgressStyle = computed(() => `${((currentTime.value / Math.max(1, options.getCycleEndUs())) * 100).toFixed(2)}%`)

  const seekTime = (us: number) => {
    currentTime.value = clampTime(us)
    lastTs = 0
  }

  const togglePlay = () => {
    if (!isPlaying.value && currentTime.value >= options.getCycleEndUs()) {
      currentTime.value = 0
      focusedPacketId.value = null
    }
    if (!isPlaying.value) lastTs = 0
    isPlaying.value = !isPlaying.value
  }

  const pauseForTool = () => {
    isPlaying.value = false
    lastTs = 0
  }

  const reset = () => {
    isPlaying.value = false
    focusedPacketId.value = null
    currentTime.value = 0
    lastTs = 0
  }

  const onJump = (event: Event) => {
    const next = Number((event.target as HTMLInputElement).value)
    if (Number.isFinite(next)) seekTime(next)
  }

  const onSpeed = (event: Event) => {
    speed.value = Number((event.target as HTMLSelectElement).value)
  }

  const tick = (timestamp: number) => {
    if (!isPlaying.value) {
      lastTs = 0
      return
    }

    if (!lastTs) lastTs = timestamp
    const diff = timestamp - lastTs
    lastTs = timestamp

    const next = currentTime.value + (diff * 1000 * speed.value)
    if (next >= options.getCycleEndUs()) {
      currentTime.value = options.getCycleEndUs()
      isPlaying.value = false
      return
    }

    currentTime.value = next
    raf = requestAnimationFrame(tick)
  }

  watch(isPlaying, (next) => {
    if (!next) {
      if (raf) cancelAnimationFrame(raf)
      lastTs = 0
      return
    }
    raf = requestAnimationFrame(tick)
  })

  const dispose = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  return {
    currentTime,
    isPlaying,
    speed,
    focusedPacketId,
    rangeProgressStyle,
    clampTime,
    seekTime,
    togglePlay,
    pauseForTool,
    reset,
    onJump,
    onSpeed,
    dispose,
  }
}

export type PlaybackEngine = ReturnType<typeof usePlaybackEngine>
