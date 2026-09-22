<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ disabled: boolean; message: string; failed: boolean; importing: boolean; canRestore: boolean }>()
const emit = defineEmits<{ new: []; import: [file: File]; export: []; restore: [] }>()
const fileInput = ref<HTMLInputElement | null>(null)
const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('import', file)
}
</script>

<template>
  <section aria-label="实验文件" class="experiment-files">
    <div class="dock-title">实验文件</div>
    <div class="control-btn-row">
      <button class="btn btn-compact" :disabled="disabled || importing" @click="emit('new')">新建实验</button>
      <button class="btn btn-compact" :disabled="disabled || importing" @click="fileInput?.click()">{{ importing ? '导入中…' : '导入参数' }}</button>
      <button class="btn btn-compact" @click="emit('export')">导出参数</button>
      <button v-if="canRestore" class="btn btn-compact" :disabled="disabled || importing" @click="emit('restore')">撤销替换</button>
    </div>
    <input ref="fileInput" type="file" accept=".json,application/json" aria-label="导入实验参数" hidden @change="onFile" />
    <p v-if="message" :role="failed ? 'alert' : 'status'" class="file-message">{{ message }}</p>
  </section>
</template>

<style scoped>
.file-message { color: var(--muted); font-size: 12px; line-height: 1.5; margin-top: 8px; overflow-wrap: anywhere; }
</style>
