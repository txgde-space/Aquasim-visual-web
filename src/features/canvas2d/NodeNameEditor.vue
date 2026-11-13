<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { normalizeNodeName } from '../../shared/nodeName'

const props = defineProps<{ nodeId: number; name?: string; editable: boolean }>()
const emit = defineEmits<{ change: [nodeId: number, name: string] }>()
const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)
const label = computed(() => normalizeNodeName(props.name || '', props.nodeId))
watch(() => [props.nodeId, props.name, props.editable], () => { editing.value = false })
const beginEdit = () => {
  if (!props.editable) return
  draft.value = label.value
  editing.value = true
  nextTick(() => { input.value?.focus(); input.value?.select() })
}
const save = () => {
  if (!editing.value || !props.editable) return
  const name = normalizeNodeName(draft.value, props.nodeId)
  editing.value = false
  if (name !== label.value) emit('change', props.nodeId, name)
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Enter') save()
  else editing.value = false
}
</script>

<template>
  <span class="node-name-editor">
    <span class="node-identity">Node {{ nodeId }}</span>
    <span class="name-separator" aria-hidden="true">·</span>
    <template v-if="editing">
      <input ref="input" v-model="draft" class="name-input" aria-label="节点名称（备注）" autocomplete="off" @keydown="onKeydown" />
      <button type="button" class="name-action" aria-label="保存节点名称" title="保存（Enter）" @click="save">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-9" /></svg>
      </button>
      <button type="button" class="name-action" aria-label="取消修改节点名称" title="取消（Esc）" @click="editing = false">×</button>
    </template>
    <template v-else>
      <span class="node-remark" :title="label">{{ label }}</span>
      <button v-if="editable" type="button" class="name-action" aria-label="修改节点名称" title="修改名称（备注）" @click="beginEdit">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 3.5 4 4M4 12l9-9a1.5 1.5 0 0 1 2 0l2 2a1.5 1.5 0 0 1 0 2l-9 9-5 1z" /></svg>
      </button>
    </template>
  </span>
</template>

<style scoped>
.node-name-editor { display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 100%; }
.node-identity { flex: none; font-family: var(--font-mono); }
.name-separator { color: var(--faint); }
.node-remark { min-width: 0; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name-input { width: 130px; min-width: 0; border: 1px solid var(--line-strong); border-radius: var(--r-sm); background: var(--sunken); color: var(--text); font: inherit; padding: 3px 5px; }
.name-action { flex: none; display: inline-flex; justify-content: center; align-items: center; width: 23px; height: 23px; padding: 3px; border-radius: var(--r-sm); color: var(--muted); cursor: pointer; transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out); }
.name-action:hover { color: var(--accent); background: var(--raised); }
.name-action svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.name-action:focus-visible, .name-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
