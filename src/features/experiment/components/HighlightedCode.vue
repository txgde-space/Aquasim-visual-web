<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { CodeLanguage } from '../lib/highlightCode'

const props = defineProps<{ code: string; language: CodeLanguage }>()
const highlighted = ref<string | null>(null)

onMounted(() => {
  watch([() => props.code, () => props.language], ([code, language], _, onCleanup) => {
    highlighted.value = null
    if (!code) return

    let worker: Worker | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    let active = true
    const dispose = () => {
      active = false
      clearTimeout(timeout)
      worker?.terminate()
    }
    onCleanup(dispose)

    // Keep the original text readable while the worker loads or if it fails.
    // Terminating on change also prevents stale output and expensive old jobs.
    try {
      worker = new Worker(new URL('../lib/highlightCode.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (active && typeof event.data === 'string') highlighted.value = event.data
        dispose()
      }
      worker.onerror = dispose
      worker.onmessageerror = dispose
      timeout = setTimeout(dispose, 10_000)
      worker.postMessage({ code, language })
    } catch {
      dispose()
    }
  }, { immediate: true, flush: 'sync' })
})

const selectCode = (event: KeyboardEvent) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a') return
  const target = event.currentTarget
  const selection = window.getSelection()
  if (!(target instanceof HTMLElement) || !selection) return
  event.preventDefault()
  event.stopPropagation()
  const range = document.createRange()
  range.selectNodeContents(target)
  selection.removeAllRanges()
  selection.addRange(range)
}
</script>

<template>
  <pre class="highlighted-code" tabindex="0" :data-language="language" :data-highlighted="highlighted !== null" @keydown="selectCode"><code v-if="highlighted !== null" v-html="highlighted"></code><code v-else>{{ code }}</code></pre>
</template>

<style scoped>
.highlighted-code { min-width: 0; min-height: 0; margin: 0; overflow: auto; overscroll-behavior: contain; tab-size: 4; color: var(--text); font: 12px/1.7 var(--font-mono); white-space: pre; }
.highlighted-code code { font: inherit; }
.highlighted-code:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.highlighted-code :deep(.hljs-comment) { color: var(--muted); font-style: italic; }
.highlighted-code :deep(.hljs-keyword), .highlighted-code :deep(.hljs-selector-tag) { color: var(--accent); }
.highlighted-code :deep(.hljs-string), .highlighted-code :deep(.hljs-char), .highlighted-code :deep(.hljs-regexp) { color: var(--rx); }
.highlighted-code :deep(.hljs-number), .highlighted-code :deep(.hljs-literal) { color: var(--tx); }
.highlighted-code :deep(.hljs-type), .highlighted-code :deep(.hljs-built_in), .highlighted-code :deep(.hljs-title) { color: var(--warn); }
.highlighted-code :deep(.hljs-meta), .highlighted-code :deep(.hljs-symbol) { color: var(--idle); }
.highlighted-code :deep(.hljs-attr), .highlighted-code :deep(.hljs-attribute) { color: var(--accent-soft); }
.highlighted-code :deep(.hljs-punctuation), .highlighted-code :deep(.hljs-operator) { color: var(--muted); }
</style>
