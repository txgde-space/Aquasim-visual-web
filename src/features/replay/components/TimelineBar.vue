<script setup lang="ts">
defineProps<{
  currentTime: number
  cycleEndUs: number
  rangeProgressStyle: string
}>()

const emit = defineEmits<{
  seek: [us: number]
}>()

const onInput = (event: Event) => {
  const next = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(next)) emit('seek', next)
}
</script>

<template>
  <div class="wb-transport visual-timeline">
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
  </div>
</template>
