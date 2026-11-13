<script setup lang="ts">
import { computed } from 'vue'
import { SPEED_OPTIONS } from '@/shared/constants'
import { timeDisplay } from '../lib/format'

const props = defineProps<{
  currentTime: number
  cycleEndUs: number
  rangeProgressStyle: string
  isPlaying: boolean
  speed: number
  fractionalTiming?: boolean
}>()

// Reserve every digit the replay can display, including unit changes. This
// depends on the log duration, never on the moving playback clock.
const timeWidth = computed(() => {
  const end = Number.isFinite(props.cycleEndUs) ? Math.max(0, props.cycleEndUs) : 0
  const secondsDigits = Math.floor(Math.log10(Math.max(1, Math.ceil(end / 1_000_000)))) + 1
  return `${props.fractionalTiming
    ? Math.max(13, secondsDigits + 12)
    : Math.max(10, secondsDigits + 5)}ch`
})

const emit = defineEmits<{
  seek: [us: number]
  seekStart: []
  seekEnd: []
  togglePlay: []
  reset: []
  speedChange: [event: Event]
}>()

const onInput = (event: Event) => {
  const next = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(next)) emit('seek', next)
}
</script>

<template>
  <div class="dock transport">
    <button class="tp-reset" title="重置" aria-label="重置" @click="emit('reset')">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
    </button>
    <button
      class="tp-play"
      :title="isPlaying ? '暂停（P）' : '播放（P）'"
      :aria-label="isPlaying ? '暂停' : '播放'"
      aria-keyshortcuts="P"
      @click="emit('togglePlay')"
    >
      <svg v-if="!isPlaying" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
      </svg>
    </button>
    <div class="tp-time">
      <span class="tp-now" :style="{ width: timeWidth }">{{ timeDisplay(currentTime, fractionalTiming) }}</span>
      <span class="tp-total">/ {{ timeDisplay(cycleEndUs, fractionalTiming) }}</span>
    </div>
    <label class="range-wrap">
      <input
        class="range"
        type="range"
        :min="0"
        :max="cycleEndUs"
        :step="fractionalTiming ? 0.001 : 1000"
        :value="currentTime"
        :style="{ '--range-progress': rangeProgressStyle }"
        aria-label="回放进度"
        @input="onInput"
        @pointerdown="emit('seekStart')"
        @change="emit('seekEnd')"
        @pointercancel="emit('seekEnd')"
      />
    </label>
    <label class="tp-speed">
      <select class="select" :value="speed" aria-label="倍速" @change="emit('speedChange', $event)">
        <option v-for="option in SPEED_OPTIONS" :key="option" :value="option">{{ option }}x</option>
      </select>
    </label>
  </div>
</template>

<style scoped>
.tp-now {
  flex: none;
  text-align: right;
}

.range-wrap {
  min-width: 0;
}
</style>
