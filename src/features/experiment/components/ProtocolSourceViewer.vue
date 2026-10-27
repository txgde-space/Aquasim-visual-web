<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useProtocolSource } from '../composables/useProtocolSource'
import type { CatalogItem } from '../lib/typeIdCatalog'
import HighlightedCode from './HighlightedCode.vue'

const props = defineProps<{
  item: CatalogItem
  aquaSimHome: string
  directoryLabel: string
}>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const { files, selectedPath, code, loading, error, selectFile, retry } = useProtocolSource(
  () => props.aquaSimHome, () => props.item.typeId,
)
const copyMessage = ref('')
const copyFailed = ref(false)
let copyVersion = 0
let returnFocus: HTMLElement | null = null
let pointerStartedOutside = false

watch([code, selectedPath], () => {
  copyVersion++
  copyMessage.value = ''
  copyFailed.value = false
})

const copyCode = async () => {
  if (loading.value || error.value || !selectedPath.value) return
  const version = ++copyVersion
  try {
    await navigator.clipboard.writeText(code.value)
    if (version === copyVersion) {
      copyMessage.value = '源码已复制'
      copyFailed.value = false
    }
  } catch {
    if (version === copyVersion) {
      copyMessage.value = '复制失败，请选中代码后手动复制。'
      copyFailed.value = true
    }
  }
}

const isOutside = (event: MouseEvent | PointerEvent) => {
  const rect = dialog.value?.getBoundingClientRect()
  return !!rect && (event.clientX < rect.left || event.clientX > rect.right
    || event.clientY < rect.top || event.clientY > rect.bottom)
}
const onPointerDown = (event: PointerEvent) => { pointerStartedOutside = isOutside(event) }
const onDialogClick = (event: MouseEvent) => {
  if (pointerStartedOutside && isOutside(event)) emit('close')
  pointerStartedOutside = false
}
const onKeyDown = (event: KeyboardEvent) => {
  // Keep canvas shortcuts behind the native modal from handling code selection.
  event.stopPropagation()
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.value?.showModal()
  closeButton.value?.focus()
})
onBeforeUnmount(() => {
  copyVersion++
  dialog.value?.close()
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
})

const fileName = (path: string) => path.split('/').at(-1) || path
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="protocol-source-viewer"
      aria-labelledby="protocol-source-title"
      aria-describedby="protocol-source-directory"
      @cancel.prevent="emit('close')"
      @keydown="onKeyDown"
      @pointerdown="onPointerDown"
      @click="onDialogClick"
    >
      <header class="source-header">
        <div class="source-heading">
          <h2 id="protocol-source-title">{{ item.label }} 源码</h2>
          <p class="source-type-id">{{ item.typeId }}</p>
        </div>
        <button ref="closeButton" class="btn btn-compact" type="button" aria-label="关闭协议源码" @click="emit('close')">关闭</button>
      </header>
      <p id="protocol-source-directory" class="source-directory"><span>{{ selectedPath.startsWith('builtin/') ? '模型来源' : '仿真目录' }}</span><code>{{ selectedPath.startsWith('builtin/') ? '内置模型' : directoryLabel }}</code></p>
      <nav v-if="files.length" class="source-files" aria-label="源码文件">
        <button
          v-for="file in files"
          :key="file.path"
          class="source-file"
          type="button"
          :class="{ selected: file.path === selectedPath }"
          :aria-pressed="file.path === selectedPath"
          :title="file.path"
          :data-source-path="file.path"
          @click="selectFile(file.path)"
        >{{ fileName(file.path) }}</button>
      </nav>
      <div class="source-toolbar">
        <p class="source-path" aria-label="源码路径">{{ selectedPath || (loading ? '正在定位源码文件…' : '尚未读取源码路径') }}</p>
        <button class="btn btn-compact" type="button" :disabled="loading || !!error || !selectedPath" @click="copyCode">复制源码</button>
      </div>
      <div class="source-content" :aria-busy="loading">
        <p v-if="loading" class="source-state" role="status">正在读取源码…</p>
        <div v-else-if="error" class="source-state source-error">
          <p role="alert">{{ error }}</p>
          <button class="btn btn-compact" type="button" @click="retry">重试</button>
        </div>
        <HighlightedCode v-else class="source-code" :code="code" language="cpp" aria-label="协议源码" />
      </div>
      <footer class="source-footer">
        <span>只读 · C++</span>
        <span class="source-copy-message" :class="{ failed: copyFailed }" role="status">{{ copyMessage }}</span>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.protocol-source-viewer { width: min(1100px, calc(100vw - 32px)); height: min(820px, calc(100dvh - 48px)); max-width: none; max-height: none; margin: auto; padding: 0; overflow: hidden; border: 1px solid var(--line-strong); border-radius: var(--r-lg); background: var(--overlay); color: var(--text); box-shadow: var(--shadow-pop); z-index: 80; }
.protocol-source-viewer[open] { display: flex; flex-direction: column; }
.protocol-source-viewer::backdrop { background: color-mix(in srgb, var(--sunken) 68%, transparent); backdrop-filter: blur(4px); }
.source-header { display: flex; align-items: center; justify-content: space-between; flex: none; gap: 16px; padding: 18px 20px 12px; }
.source-heading { min-width: 0; }
.source-heading h2 { font-size: 16px; font-weight: 600; }
.source-type-id { margin-top: 4px; overflow-wrap: anywhere; color: var(--muted); font: 12px/1.5 var(--font-mono); }
.source-header .btn, .source-toolbar .btn { flex-shrink: 0; }
.source-directory { display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 0 20px 14px; color: var(--muted); font-size: 11px; }
.source-directory code { min-width: 0; overflow-wrap: anywhere; font-family: var(--font-mono); }
.source-files { display: flex; gap: 4px; flex: none; overflow-x: auto; padding: 0 16px; border-bottom: 1px solid var(--line); }
.source-file { flex: none; padding: 10px 12px; border-bottom: 2px solid transparent; color: var(--muted); font: 12px/1.5 var(--font-mono); transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out); }
.source-file:hover { color: var(--text); background: var(--raised); }
.source-file.selected { color: var(--accent); border-bottom-color: var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.source-toolbar { display: flex; align-items: center; gap: 12px; flex: none; padding: 10px 20px; background: var(--panel-solid); border-bottom: 1px solid var(--line); }
.source-path { flex: 1; min-width: 0; overflow-wrap: anywhere; color: var(--muted); font: 11px/1.5 var(--font-mono); }
.source-content { flex: 1; min-height: 0; display: flex; overflow: hidden; background: var(--sunken); }
.source-state { margin: auto; max-width: 100%; padding: 28px; text-align: center; color: var(--muted); font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.source-error { display: grid; justify-items: center; gap: 14px; color: var(--bad); }
.source-code { flex: 1; min-width: 0; margin: 0; padding: 18px 20px; overflow: auto; overscroll-behavior: contain; tab-size: 4; color: var(--text); font: 12px/1.7 var(--font-mono); white-space: pre; }
.source-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; flex: none; padding: 9px 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
.source-copy-message { color: var(--rx); }
.source-copy-message.failed { color: var(--bad); }
.source-file:focus-visible, .source-code:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 600px) {
  .protocol-source-viewer { width: calc(100vw - 16px); height: calc(100dvh - 24px); }
  .source-header, .source-toolbar { padding-inline: 12px; }
  .source-directory, .source-footer { padding-inline: 12px; }
  .source-files { padding-inline: 8px; }
  .source-code { padding: 12px; }
}
</style>
