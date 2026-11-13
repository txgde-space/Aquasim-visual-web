<script setup lang="ts">
import { NODE_MODEL_OPTIONS, isNodeModelType, resolveNodeModel, nodeModelSizeLabel } from '@/shared/nodeModel'
import { ref, onMounted, watch, useId } from 'vue'
import { drawNodeModel } from '@/features/canvas2d/lib/draw/nodes'
import { THEME_PROFILES } from '@/features/canvas2d/lib/themes'
import { CANVAS_THEME_KEY } from '@/shared/constants'
import type { NodeModelType } from '@/shared/nodeModel'

const props = defineProps<{
  node: { node_id: number; modelType?: unknown; role?: unknown; name?: unknown }
  disabled?: boolean
}>()
const emit = defineEmits<{ change: [payload: { node_id: number; modelType: NodeModelType }] }>()
const selectId = useId()
const previewEl = ref<HTMLCanvasElement | null>(null)
const drawPreview = () => {
  const canvas = previewEl.value, ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const dpr = window.devicePixelRatio || 1
  canvas.width = 224 * dpr; canvas.height = 80 * dpr
  ctx.setTransform(dpr,0,0,dpr,0,0)
  const profile = THEME_PROFILES[CANVAS_THEME_KEY]!
  drawNodeModel(ctx,resolveNodeModel(props.node),{x:112,y:40},28,profile,profile.idleInner,profile.label)
}
onMounted(drawPreview)
watch(() => resolveNodeModel(props.node), drawPreview, {flush:'post'})
const onChange = (event: Event) => {
  const modelType = (event.target as HTMLSelectElement).value
  if (!props.disabled && isNodeModelType(modelType)) emit('change', { node_id: props.node.node_id, modelType })
}
</script>

<template>
  <div class="node-model-field">
    <canvas ref="previewEl" class="node-model-preview" aria-label="设备外形预览" />
    <label class="node-model-label" :for="selectId">模型类型 <span class="field-param">modelType</span></label>
    <select :id="selectId" aria-label="模型类型" :value="resolveNodeModel(node)" :disabled="disabled" @change="onChange">
      <option v-for="option in NODE_MODEL_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
    <span class="node-model-dimensions">{{ nodeModelSizeLabel(resolveNodeModel(node)) }}</span>
  </div>
</template>

<style scoped>
.node-model-field { display: grid; gap: 7px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.node-model-label { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--text); font-size: 12px; font-weight: 600; }
.node-model-preview { display: block; width: 100%; height: 80px; object-fit: contain; background: var(--sunken); border-radius: var(--r-sm); }
.node-model-dimensions { color: var(--muted); font: 10px var(--font-mono); }
select { width: 100%; min-width: 0; padding: 7px 8px; border: 1px solid var(--line-strong); border-radius: 7px; background: var(--sunken); color: var(--text); font: inherit; font-size: 12px; cursor: pointer; }
select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
select:disabled { cursor: default; opacity: .5; }
</style>
