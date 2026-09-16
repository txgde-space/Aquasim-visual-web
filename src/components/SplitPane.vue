<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

/**
 * 右侧面板的可拖拽宽度容器。
 * 手柄位于容器左缘：向左拖增宽，向右拖收窄；双击复位默认宽；宽度持久化 localStorage。
 */
const props = withDefaults(
  defineProps<{
    defaultWidth: number
    min?: number
    max?: number
    storageKey?: string
  }>(),
  { min: 240, max: 480, storageKey: '' },
)

const emit = defineEmits<{ 'update:width': [width: number] }>()

const clamp = (value: number) => Math.min(props.max, Math.max(props.min, Math.round(value)))

const width = ref(clamp(props.defaultWidth))

if (props.storageKey) {
  try {
    const saved = Number(localStorage.getItem(props.storageKey))
    if (Number.isFinite(saved) && saved > 0) {
      width.value = clamp(saved)
    }
  } catch {
    // ignore persistence errors
  }
}

watch(width, (value) => emit('update:width', value), { immediate: true })

const dragging = ref(false)
let startX = 0
let startWidth = 0

const persist = () => {
  if (!props.storageKey) return
  try {
    localStorage.setItem(props.storageKey, String(width.value))
  } catch {
    // ignore persistence errors
  }
}

const onPointerMove = (event: PointerEvent) => {
  width.value = clamp(startWidth + (startX - event.clientX))
}

const onPointerUp = () => {
  dragging.value = false
  window.removeEventListener('pointermove', onPointerMove)
  document.body.style.userSelect = ''
  persist()
}

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  dragging.value = true
  startX = event.clientX
  startWidth = width.value
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
  document.body.style.userSelect = 'none'
}

const reset = () => {
  width.value = clamp(props.defaultWidth)
  persist()
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowLeft') {
    width.value = clamp(width.value + 16)
    persist()
    event.preventDefault()
  } else if (event.key === 'ArrowRight') {
    width.value = clamp(width.value - 16)
    persist()
    event.preventDefault()
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  document.body.style.userSelect = ''
})
</script>

<template>
  <div class="split-pane" :class="{ dragging }" :style="{ width: width + 'px' }">
    <div
      class="split-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="调整面板宽度"
      title="拖拽调整宽度，双击复位"
      tabindex="0"
      @pointerdown="onPointerDown"
      @dblclick="reset"
      @keydown="onKeydown"
    ></div>
    <div class="split-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.split-pane {
  position: relative;
  display: flex;
  flex: none;
  height: 100%;
  min-width: 0;
}
.split-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
}
.split-handle {
  position: absolute;
  left: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 5;
  touch-action: none;
}
.split-handle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
  transition: background 0.15s ease;
}
.split-handle:hover::after,
.split-handle:focus-visible::after,
.dragging .split-handle::after {
  background: var(--accent);
}
</style>
