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
  <div class="wb-timeline">
    <button class="btn btn-compact primary" @click="emit('togglePlay')">{{ isPlaying ? '暂停' : '播放' }}</button>
    <button class="btn btn-compact" @click="emit('reset')">重置</button>
    <span class="wb-time">{{ timeDisplay(currentTime) }} / {{ timeDisplay(cycleEndUs) }}</span>
    <label class="field range-wrap">
      <input
        class="range"
        type="range"
        :min="0"
        :max="cycleEndUs"
        :step="1000"
        :value="currentTime"
        :style="{ '--range-progress': rangeProgressStyle }"
        @input="onInput"
      />
    </label>
    <label class="tl-speed">
      <span>倍速</span>
      <select class="select" :value="speed" @change="emit('speedChange', $event)">
        <option v-for="option in SPEED_OPTIONS" :key="option" :value="option">{{ option }}x</option>
      </select>
    </label>
  </div>
</template>
