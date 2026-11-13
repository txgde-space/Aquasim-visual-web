<script setup lang="ts">
import { ref, watch } from 'vue'
import { parseQuantity } from '@/shared/quantity'

const props = defineProps<{ nodeId: number; x: number; y: number; z?: number; disabled?: boolean }>()
const emit = defineEmits<{ change: [value: { node_id: number; axis: 'x' | 'y' | 'z'; value: number }] }>()
const axes = ['x', 'y', 'z'] as const
const errors = ref<Partial<Record<typeof axes[number], string>>>({})
watch(() => props.nodeId, () => { errors.value = {} })
const change = (axis: typeof axes[number], event: Event) => {
  if (props.disabled) return
  const input = event.target as HTMLInputElement
  try {
    const { value } = parseQuantity(input.value, 'm')
    errors.value[axis] = undefined
    emit('change', { node_id: props.nodeId, axis, value })
    input.value = String(value)
  } catch {
    errors.value[axis] = '请输入距离，如 -1.5km'
  }
}
</script>

<template>
  <fieldset class="node-position" :disabled="disabled" aria-label="节点位置">
    <label v-for="axis in axes" :key="`${nodeId}:${axis}`" class="field field-compact">
      <span class="field-head"><span>{{ axis.toUpperCase() }} (m)</span></span>
      <input class="select" type="text" spellcheck="false" autocomplete="off" :value="props[axis] ?? 0"
        placeholder="默认 m" title="支持 m、km；无单位按 m" :aria-invalid="!!errors[axis]"
        @input="errors[axis] = undefined" @change="change(axis, $event)" />
      <span v-if="errors[axis]" class="position-error" role="alert">{{ errors[axis] }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.node-position { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin: 0 0 12px; padding: 0; min-width: 0; border: 0; }
.field { min-width: 0; }
.field-head { font: 11px var(--font-mono); color: var(--muted); margin-bottom: 4px; }
.select { width: 100%; min-width: 0; font: 11px var(--font-mono); padding: 6px; }
.position-error { color: var(--bad); font-size: 10px; line-height: 1.4; }
</style>
