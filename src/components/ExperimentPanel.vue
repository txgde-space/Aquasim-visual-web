<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { TRAFFIC_PRESETS, macPresetById } from '../experimentSpec.js'

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
  runLog: { type: String, default: '' },
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
    <div class="control-btn-row">
      <button class="btn btn-compact" @click="openViewer('json')">JSON</button>
      <button class="btn btn-compact" @click="openViewer('cc')">CC</button>
      <button class="btn btn-compact" @click="emit('download')">导出</button>
      <button class="btn btn-compact" @click="emit('copy')">复制</button>
    </div>
    <div class="control-btn-row">
      <button class="btn btn-compact" @click="emit('sync-from-replay')">同步回放</button>
      <button class="btn btn-compact" @click="emit('apply-to-replay')">应用到回放</button>
    </div>
    <pre v-if="runLog" class="run-log">{{ runLog }}</pre>

    <div class="control-fields-grid">
      <label class="field field-compact">
        <div class="field-head"><span>simStop</span></div>
        <input class="select" :value="form.simStop" @change="onField('simStop', $event)" />
      </label>
      <label class="field field-compact">
        <div class="field-head"><span>transRange</span></div>
        <input class="select" type="number" min="1" step="10" :value="form.transRange" @change="onNumberField('transRange', $event)" />
      </label>
      <label class="field field-compact">
        <div class="field-head"><span>txPower</span></div>
        <input class="select" type="number" min="0" step="0.1" :value="form.txPower" @change="onNumberField('txPower', $event)" />
      </label>
      <label v-if="selectedMac?.id === 'swarm'" class="field field-compact">
        <div class="field-head"><span>InitialRoundDelay</span></div>
        <input class="select" :value="form.initialRoundDelay" @change="onField('initialRoundDelay', $event)" />
      </label>
      <label v-if="selectedMac?.id === 'tdma'" class="field field-compact">
        <div class="field-head"><span>SlotNum</span></div>
        <input class="select" type="number" min="1" max="8" :value="form.slotNum" @change="onNumberField('slotNum', $event)" />
      </label>
      <label v-if="selectedMac?.id === 'tdma'" class="field field-compact">
        <div class="field-head"><span>SlotLen</span></div>
        <input class="select" :value="form.slotLen" @change="onField('slotLen', $event)" />
      </label>
      <label class="field field-compact">
        <div class="field-head"><span>流量</span></div>
        <select class="select" data-testid="exp-traffic" :value="form.trafficId" @change="onField('trafficId', $event.target.value)">
          <option v-for="item in TRAFFIC_PRESETS" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>
      <template v-if="form.trafficId !== 'none'">
        <label class="field field-compact">
          <div class="field-head"><span>src</span></div>
          <input class="select" type="number" min="1" :value="form.trafficSrc" @change="onNumberField('trafficSrc', $event)" />
        </label>
        <label v-if="form.trafficId === 'onoff-to'" class="field field-compact">
          <div class="field-head"><span>dst</span></div>
          <input class="select" type="number" min="1" :value="form.trafficDst" @change="onNumberField('trafficDst', $event)" />
        </label>
        <label class="field field-compact">
          <div class="field-head"><span>bps</span></div>
          <input class="select" type="number" min="1" :value="form.trafficRateBps" @change="onNumberField('trafficRateBps', $event)" />
        </label>
      </template>
    </div>

    <ul v-if="warnings.length" class="experiment-warnings">
      <li v-for="item in warnings" :key="item">{{ item }}</li>
    </ul>

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
