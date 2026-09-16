<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { TRAFFIC_PRESETS, macPresetById } from '@/features/experiment/lib/experimentSpec'

const props = defineProps({
  form: { type: Object, required: true },
  specJson: { type: String, required: true },
  scratchCc: { type: String, default: '' },
  warnings: { type: Array, default: () => [] },
  nodeCount: { type: Number, default: 0 },
  selectedCount: { type: Number, default: 0 },
  selectedMacId: { type: String, default: '' },
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

const selectedMac = computed(() => (props.selectedMacId ? macPresetById(props.selectedMacId) : null))
const viewer = ref(null)

const openViewer = (kind) => {
  viewer.value = kind
}

const closeViewer = () => {
  viewer.value = null
}

const viewerTitle = computed(() => (viewer.value === 'cc' ? 'scratch/aqua-visual.cc' : 'experiment.json'))
const viewerBody = computed(() => (viewer.value === 'cc' ? props.scratchCc : props.specJson))

const onEsc = (event) => {
  if (event.key === 'Escape') closeViewer()
}

watch(viewer, (open) => {
  if (open) window.addEventListener('keydown', onEsc)
  else window.removeEventListener('keydown', onEsc)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onEsc))

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

const onNumberField = (key, event) => {
  emit('update-field', key, Number(event.target.value))
}
</script>

<template>
  <div class="experiment-panel">
    <div class="dock-title">仿真参数</div>
    <div class="control-fields-grid">
      <label class="field field-compact" title="仿真停止时间，如 30s">
        <div class="field-head"><span>仿真时长</span><span class="field-param">simStop</span></div>
        <input class="select" :value="form.simStop" @change="onField('simStop', $event)" />
      </label>
      <label class="field field-compact" title="传输距离（米）">
        <div class="field-head"><span>传输距离 m</span><span class="field-param">transRange</span></div>
        <input class="select" type="number" min="1" step="10" :value="form.transRange" @change="onNumberField('transRange', $event)" />
      </label>
      <label v-if="selectedMac?.id === 'swarm'" class="field field-compact" title="首轮延迟，如 1s">
        <div class="field-head"><span>首轮延迟</span><span class="field-param">InitialRoundDelay</span></div>
        <input class="select" :value="form.initialRoundDelay" @change="onField('initialRoundDelay', $event)" />
      </label>
      <label v-if="selectedMac?.id === 'tdma'" class="field field-compact">
        <div class="field-head"><span>时隙数</span><span class="field-param">SlotNum</span></div>
        <input class="select" type="number" min="1" max="8" :value="form.slotNum" @change="onNumberField('slotNum', $event)" />
      </label>
      <label v-if="selectedMac?.id === 'tdma'" class="field field-compact" title="时隙长度，如 5s">
        <div class="field-head"><span>时隙长度</span><span class="field-param">SlotLen</span></div>
        <input class="select" :value="form.slotLen" @change="onField('slotLen', $event)" />
      </label>
      <label class="field field-compact">
        <div class="field-head"><span>流量模式</span></div>
        <select class="select" data-testid="exp-traffic" :value="form.trafficId" @change="onField('trafficId', $event.target.value)">
          <option v-for="item in TRAFFIC_PRESETS" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>
      <template v-if="form.trafficId !== 'none'">
        <label class="field field-compact">
          <div class="field-head"><span>源节点</span><span class="field-param">src</span></div>
          <input class="select" type="number" min="1" :value="form.trafficSrc" @change="onNumberField('trafficSrc', $event)" />
        </label>
        <label v-if="form.trafficId === 'onoff-to'" class="field field-compact">
          <div class="field-head"><span>目的节点</span><span class="field-param">dst</span></div>
          <input class="select" type="number" min="1" :value="form.trafficDst" @change="onNumberField('trafficDst', $event)" />
        </label>
        <label class="field field-compact">
          <div class="field-head"><span>速率 bps</span></div>
          <input class="select" type="number" min="1" :value="form.trafficRateBps" @change="onNumberField('trafficRateBps', $event)" />
        </label>
      </template>
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
              <button class="btn btn-compact" @click="closeViewer">关闭</button>
            </div>
          </div>
          <textarea class="code-modal-body" readonly :value="viewerBody" />
        </div>
      </div>
    </Teleport>
  </div>
</template>
