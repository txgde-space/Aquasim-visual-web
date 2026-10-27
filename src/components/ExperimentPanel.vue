<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import HighlightedCode from '@/features/experiment/components/HighlightedCode.vue'

const props = defineProps({
  form: { type: Object, required: true },
  specJson: { type: String, required: true },
  scratchCc: { type: String, default: '' },
  warnings: { type: Array, default: () => [] },
  nodeCount: { type: Number, default: 0 },
  selectedCount: { type: Number, default: 0 },
  selectedSummary: { type: String, default: '' },
  runStatus: { type: String, default: 'idle' },
})

const emit = defineEmits([
  'update-field',
  'sync-from-replay',
  'apply-to-replay',
  'add-node',
  'remove-node',
  'download',
  'copy',
  'run',
])

const viewer = ref(null)
const viewerCloseButton = ref(null)
let viewerReturnFocus = null

const openViewer = async (kind) => {
  viewerReturnFocus = document.activeElement
  viewer.value = kind
  await nextTick()
  if (viewer.value === kind) viewerCloseButton.value?.focus()
}

const closeViewer = () => {
  viewer.value = null
  if (viewerReturnFocus?.isConnected) viewerReturnFocus.focus({ preventScroll: true })
  viewerReturnFocus = null
}

const viewerTitle = computed(() => (viewer.value === 'cc' ? 'scratch/aqua-visual.cc' : 'experiment.json'))
const viewerBody = computed(() => (viewer.value === 'cc' ? props.scratchCc : props.specJson))

const onEsc = (event) => {
  if (event.key !== 'Escape' || event.isComposing) return
  // A modal owns Escape even if Tab has moved focus outside its contents.
  event.preventDefault()
  event.stopPropagation()
  closeViewer()
}

watch(viewer, (open) => {
  if (open) window.addEventListener('keydown', onEsc, true)
  else window.removeEventListener('keydown', onEsc, true)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onEsc, true))

const copyViewer = async () => {
  try {
    await navigator.clipboard.writeText(viewerBody.value || '')
  } catch {
    // ignore
  }
}

const onField = (key, event) => {
  const value = event?.target ? event.target.value : event
  emit('update-field', key, value)
}

</script>

<template>
  <div class="experiment-panel">
    <div class="dock-title">全局仿真参数</div>
    <div class="control-fields-grid">
      <label class="field field-compact" title="仿真停止时间，如 30s">
        <div class="field-head"><span>仿真时长</span><span class="field-param">simStop</span></div>
        <input class="select" :value="form.simStop" @input="onField('simStop', $event)" />
      </label>
    </div>

    <ul v-if="warnings.length" class="experiment-warnings">
      <li v-for="item in warnings" :key="item">{{ item }}</li>
    </ul>

    <div class="dock-title">规格与代码</div>
    <div class="control-btn-row">
      <button class="btn btn-compact" title="查看实验规格 JSON" @click="openViewer('json')">预览 JSON</button>
      <button class="btn btn-compact" title="查看生成的 ns-3 仿真代码" @click="openViewer('cc')">预览代码</button>
      <button class="btn btn-compact" title="下载 experiment.json" @click="emit('download')">下载 JSON</button>
      <button class="btn btn-compact" title="复制实验规格 JSON 到剪贴板" @click="emit('copy')">复制 JSON</button>
    </div>

    <div class="dock-title">回放联动</div>
    <div class="control-btn-row">
      <button class="btn btn-compact" title="从回放页读取节点拓扑" @click="emit('sync-from-replay')">从回放导入</button>
      <button class="btn btn-compact" title="将当前拓扑发送到回放页" @click="emit('apply-to-replay')">发送到回放</button>
    </div>

    <Teleport to="body">
      <div v-if="viewer" class="code-modal-backdrop" @click.self="closeViewer">
        <div class="code-modal" role="dialog" aria-modal="true">
          <div class="code-modal-head">
            <span>{{ viewerTitle }}</span>
            <div class="code-modal-actions">
              <button class="btn btn-compact" @click="copyViewer">复制</button>
              <button ref="viewerCloseButton" class="btn btn-compact" @click="closeViewer">关闭</button>
            </div>
          </div>
          <HighlightedCode class="code-modal-body" :code="viewerBody" :language="viewer === 'cc' ? 'cpp' : 'json'" :aria-label="viewerTitle" />
        </div>
      </div>
    </Teleport>
  </div>
</template>
