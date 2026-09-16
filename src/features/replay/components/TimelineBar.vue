<script setup lang="ts">
import { SPEED_OPTIONS } from '@/shared/constants'
import { timeDisplay } from '../lib/format'

defineProps<{
  currentTime: number
  cycleEndUs: number
  rangeProgressStyle: string
  isPlaying: boolean
  speed: number
}>()

const emit = defineEmits<{
  seek: [us: number]
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
      :title="isPlaying ? '暂停' : '播放'"
      :aria-label="isPlaying ? '暂停' : '播放'"
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
      <span class="tp-now">{{ timeDisplay(currentTime) }}</span>
      <span class="tp-total">/ {{ timeDisplay(cycleEndUs) }}</span>
    </div>
    <label class="range-wrap">
      <input
        class="range"
        type="range"
        :min="0"
        :max="cycleEndUs"
        :step="1000"
        :value="currentTime"
        :style="{ '--range-progress': rangeProgressStyle }"
        aria-label="回放进度"
        @input="onInput"
      />
    </label>
    <label class="tp-speed">
      <select class="select" :value="speed" aria-label="倍速" @change="emit('speedChange', $event)">
        <option v-for="option in SPEED_OPTIONS" :key="option" :value="option">{{ option }}x</option>
      </select>
    </label>
  </div>
</template>
