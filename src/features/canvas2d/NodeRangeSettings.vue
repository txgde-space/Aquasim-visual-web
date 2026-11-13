<script setup lang="ts">
import { computed } from 'vue'
import { rangeDistanceLabel, rangeRadius, type NodeRangeSettings } from './lib/nodeRange'

const props = defineProps<{ settings: Readonly<NodeRangeSettings>; automaticRadius: number | null }>()
const emit = defineEmits<{ change: [patch: Partial<NodeRangeSettings>] }>()
const resolved = computed(() => rangeRadius(props.settings.radiusM, props.automaticRadius))
const automaticLabel = computed(() => props.automaticRadius !== null ? rangeDistanceLabel(props.automaticRadius) : '暂无范围数据')
</script>

<template>
  <section class="range-settings" aria-label="传播范围显示">
    <label class="range-toggle">
      <span class="range-title"><span class="range-icon" aria-hidden="true"></span>显示传播范围</span>
      <input type="checkbox" role="switch" aria-label="显示传播范围" :checked="settings.visible"
        @change="emit('change', { visible: ($event.target as HTMLInputElement).checked })" />
    </label>
    <div v-if="settings.visible" class="range-options">
      <label class="field field-compact">
        <span class="field-head"><span>显示半径</span><span class="field-param">默认 m</span></span>
        <input class="select" type="text" spellcheck="false" autocomplete="off" aria-label="传播范围显示半径" :value="settings.radiusM"
          :placeholder="automaticRadius !== null ? `留空继承 · ${automaticLabel}` : '如 500m 或 1.5km'" :aria-invalid="resolved === null" title="支持 m、km；无单位按 m，留空继承协议范围"
          @input="emit('change', { radiusM: ($event.target as HTMLInputElement).value })" />
      </label>
      <p v-if="resolved === null" class="range-hint range-error">{{ settings.radiusM ? '请输入大于 0 的距离，如 500m 或 1.5km。' : '暂无协议范围，请填写显示半径。' }}</p>
      <div class="range-checks">
        <label><input type="checkbox" :checked="settings.filled" @change="emit('change', { filled: ($event.target as HTMLInputElement).checked })" />淡色填充</label>
        <label><input type="checkbox" :checked="settings.showLabel" @change="emit('change', { showLabel: ($event.target as HTMLInputElement).checked })" />距离标签</label>
      </div>
      <label v-if="settings.filled" class="range-opacity">
        <span>填充浓度</span><input type="range" min="0.04" max="0.3" step="0.01" aria-label="传播范围填充浓度" :value="settings.opacity"
          @input="emit('change', { opacity: Number(($event.target as HTMLInputElement).value) })" /><output>{{ Math.round(settings.opacity * 100) }}%</output>
      </label>
      <button v-if="settings.radiusM && automaticRadius !== null" type="button" class="range-reset" @click="emit('change', { radiusM: '' })">恢复协议范围 · {{ automaticLabel }}</button>
    </div>
  </section>
</template>

<style scoped>
.range-settings { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 12px; }
.range-toggle, .range-title, .range-checks, .range-opacity { display: flex; align-items: center; gap: 8px; }
.range-toggle { justify-content: space-between; cursor: pointer; }
.range-title { color: var(--text); font-size: 12px; font-weight: 600; }
.range-icon { width: 15px; height: 15px; border: 1px dashed var(--accent); border-radius: 50%; background: color-mix(in srgb, var(--accent) 12%, transparent); }
.range-toggle input { appearance: none; width: 30px; height: 18px; border-radius: 10px; border: 1px solid var(--line-strong, var(--line)); background: var(--sunken); cursor: pointer; position: relative; transition: background var(--dur-fast) var(--ease-out); }
.range-toggle input::after { content: ''; position: absolute; width: 12px; height: 12px; border-radius: 50%; background: var(--muted); top: 2px; left: 2px; transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out); }
.range-toggle input:checked { background: color-mix(in srgb, var(--accent) 25%, var(--sunken)); border-color: var(--accent); }
.range-toggle input:checked::after { transform: translateX(12px); background: var(--accent); }
input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.range-options { display: grid; gap: 9px; margin-top: 12px; }
.range-options .field { margin: 0; }
.range-options .select { width: 100%; min-width: 0; }
.range-checks { justify-content: space-between; }
.range-checks label { display: inline-flex; gap: 6px; align-items: center; font-size: 11px; color: var(--muted); }
.range-checks input, .range-opacity input { accent-color: var(--accent); }
.range-opacity { color: var(--muted); font-size: 11px; }
.range-opacity input { flex: 1; min-width: 0; }
.range-opacity output { min-width: 30px; font-family: var(--font-mono); text-align: right; }
.range-hint { margin: 0; color: var(--faint); font-size: 10px; line-height: 1.6; }
.range-error { color: var(--bad); }
.range-reset { justify-self: start; color: var(--accent); font-size: 11px; cursor: pointer; }
</style>
