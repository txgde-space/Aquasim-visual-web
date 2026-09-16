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

  /* 拖动/滑杆等高频输入的寻址合并：一帧最多落一次，避免每个 pointermove/input
     事件都同步触发全量派生重建（packetEntries → 面板列表重渲染）造成卡顿 */
  let seekRaf = 0
  let pendingSeekUs: number | null = null

  const seekTime = (us: number) => {
    pendingSeekUs = null // 离散跳转优先，作废未落的拖动寻址
    currentTime.value = clampTime(us)
    lastTs = 0
  }

  const queueSeek = (us: number) => {
    pendingSeekUs = us
    if (seekRaf) return
    seekRaf = requestAnimationFrame(() => {
      seekRaf = 0
      if (pendingSeekUs != null) {
        const target = pendingSeekUs
        pendingSeekUs = null
        seekTime(target)
      }
    })
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

  /* scrub（拖动进度）期间暂停播放循环，松手后若原本在播则恢复——
     否则 tick 与拖动寻址互相打架，进度条在按住时仍自顾自往前走 */
  let scrubbing = false
  let resumeAfterScrub = false

  const scrubStart = () => {
    if (scrubbing) return
    scrubbing = true
    resumeAfterScrub = isPlaying.value
    if (isPlaying.value) {
      isPlaying.value = false
      lastTs = 0
    }
  }

  const scrubEnd = () => {
    if (!scrubbing) return
    scrubbing = false
    if (resumeAfterScrub) {
      resumeAfterScrub = false
      lastTs = 0
      isPlaying.value = true
    }
  }

  const reset = () => {
    isPlaying.value = false
    resumeAfterScrub = false
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
    if (seekRaf) cancelAnimationFrame(seekRaf)
    seekRaf = 0
    pendingSeekUs = null
  }

  return {
    currentTime,
    isPlaying,
    speed,
    focusedPacketId,
    rangeProgressStyle,
    clampTime,
    seekTime,
    queueSeek,
    scrubStart,
    scrubEnd,
    togglePlay,
    pauseForTool,
    reset,
    onJump,
    onSpeed,
    dispose,
  }
}

export type PlaybackEngine = ReturnType<typeof usePlaybackEngine>
