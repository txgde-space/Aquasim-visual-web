<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ disabled: boolean; message: string; failed: boolean; importing: boolean }>()
const emit = defineEmits<{ import: [file: File]; export: [] }>()
const fileInput = ref<HTMLInputElement | null>(null)
const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('import', file)
}
</script>

<template>
  <div class="experiment-files">
    <div class="control-btn-row">
      <button class="btn btn-compact" :disabled="disabled || importing" @click="fileInput?.click()">{{ importing ? '导入中…' : '导入参数' }}</button>
      <button class="btn btn-compact" @click="emit('export')">导出参数</button>
    </div>
    <input ref="fileInput" type="file" accept=".json,application/json" aria-label="导入实验参数" hidden @change="onFile" />
    <p v-if="message" :role="failed ? 'alert' : 'status'" class="file-message">{{ message }}</p>
  </div>
</template>

<style scoped>
.experiment-files { margin-top: 8px; }
.file-message { color: var(--muted); font-size: 12px; line-height: 1.5; margin-top: 8px; overflow-wrap: anywhere; }
</style>
