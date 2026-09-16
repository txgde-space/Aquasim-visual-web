<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import NodeCanvas from '../components/NodeCanvas.vue'
import ExperimentPanel from '../components/ExperimentPanel.vue'
import ProtocolDrawer from '../components/ProtocolDrawer.vue'
import SplitPane from '../components/SplitPane.vue'
import ThemePicker from '../components/ThemePicker.vue'
import { useCanvasTheme } from '../components/useUiPrefs'
import { LOCAL_STORAGE_KEYS } from '../shared/constants'
import { session } from '../shared/sessionStore'
import { buildExperimentSpec, validateExperiment } from '@/features/experiment/lib/experimentSpec'
import { generateAquaVisualCc } from '@/features/experiment/lib/generateScratch'
import { cloneNode, useTopologyEditor } from '@/features/experiment/composables/useTopologyEditor'
import { useRunExperiment } from '@/features/experiment/composables/useRunExperiment'

const router = useRouter()
const editor = useTopologyEditor()
const {
  editNodes,
  selectedIds,
  experimentForm,
  activeCatalogId,
  selectedEditNode,
  selectedMacId,
  selectedSummary,
  canvasNodes,
  nodeVisuals,
  protocolStack,
  stackBrief,
  onSelectionChange,
  onNodeSelect,
  onNodesMove,
  onNodeMove,
  onCoordChange,
  addNode,
  removeSelected,
  assignItem,
  onProtocolDrop,
  replaceTopology,
  setField,
} = editor

const copyHint = ref('')
const inspectOpen = ref(true)
const { canvasTheme } = useCanvasTheme()

// 底部控制台：可折叠为标题条，拖拽上边缘调高
const stageEl = ref<HTMLElement | null>(null)
const consoleOpen = ref(false)
const consoleHeight = ref(180)
let consoleDragY = 0
let consoleDragH = 0

const onConsoleGripMove = (event: PointerEvent) => {
  const maxH = Math.max(160, (stageEl.value?.clientHeight ?? window.innerHeight) * 0.5)
  consoleHeight.value = Math.min(maxH, Math.max(120, consoleDragH + (consoleDragY - event.clientY)))
}
const onConsoleGripUp = () => {
  window.removeEventListener('pointermove', onConsoleGripMove)
  document.body.style.userSelect = ''
}
const onConsoleGripDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  consoleDragY = event.clientY
  consoleDragH = consoleHeight.value
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onConsoleGripMove)
  window.addEventListener('pointerup', onConsoleGripUp, { once: true })
}
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onConsoleGripMove)
  document.body.style.userSelect = ''
})

const experimentSpec = computed(() => buildExperimentSpec(experimentForm.value, editNodes.value))
const experimentWarnings = computed(() => validateExperiment(experimentSpec.value))
const experimentSpecJson = computed(() => JSON.stringify(experimentSpec.value, null, 2))
const generatedScratch = computed(() => generateAquaVisualCc(experimentSpec.value))

const onRunSuccess = (log: string, logName: string) => {
  session.pendingReplayLog = log
  session.pendingReplayName = logName
  router.push('/replay')
}

const { runStatus, runLog, runExperiment } = useRunExperiment({
  getSpec: () => experimentSpec.value,
  onSuccess: onRunSuccess,
})

const consoleVisible = computed(() => runStatus.value !== 'idle' || !!runLog.value)
const runStatusLabel = computed(
  () => ({ running: '运行中', ok: '成功', fail: '失败', idle: '' })[runStatus.value],
)

const onRun = async () => {
  await runExperiment()
  consoleOpen.value = true
}

const syncFromReplay = () => {
  const source = session.replayNodes
  if (!Array.isArray(source) || !source.length) return
  replaceTopology(source.map((node) => cloneNode({
    node_id: Number(node.node_id),
    name: node.name,
    x: node.x,
    y: node.y,
    z: node.z ?? 0,
    role: node.role,
    macId: 'swarm',
  })))
}

const applyToReplay = () => {
  session.pendingReplayApply = editNodes.value.map(cloneNode) as unknown as typeof session.replayNodes
  router.push('/replay')
}

const downloadJson = () => {
  const blob = new Blob([experimentSpecJson.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'experiment.json'
  link.click()
  URL.revokeObjectURL(url)
}

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(experimentSpecJson.value)
    copyHint.value = '已复制'
  } catch {
    copyHint.value = '失败'
  }
  window.setTimeout(() => {
    copyHint.value = ''
  }, 1600)
}
</script>

<template>
  <section class="wb" :class="{ 'wb-inspect-open': inspectOpen }">
    <ProtocolDrawer :active-id="activeCatalogId" @assign="assignItem" />

    <div ref="stageEl" class="wb-stage">
      <header class="wb-chrome">
        <div class="wb-chrome-left">
          <button class="btn btn-compact" data-testid="exp-add-node" @click="addNode()">添加节点</button>
          <button class="btn btn-compact" :disabled="selectedIds.length === 0 || editNodes.length - selectedIds.length < 2" @click="removeSelected">删除</button>
        </div>
        <div class="wb-chrome-mid">
          <span class="wb-stack-brief">{{ stackBrief }}</span>
        </div>
        <div class="wb-chrome-right">
          <span v-if="copyHint" class="field-chip">{{ copyHint }}</span>
          <ThemePicker v-model="canvasTheme" />
          <button class="btn btn-compact" @click="inspectOpen = !inspectOpen">{{ inspectOpen ? '收起属性' : '属性' }}</button>
          <button class="wb-run" data-testid="exp-run" :disabled="runStatus === 'running'" @click="onRun">
            {{ runStatus === 'running' ? '运行中…' : '运行仿真' }}
          </button>
        </div>
      </header>

      <div class="wb-canvas">
        <NodeCanvas
          :nodes="canvasNodes"
          :node-visuals="nodeVisuals"
          :visible-packets="[]"
          :current-time="0"
          :theme-key="canvasTheme"
          fx-level="standard"
          :edit-mode="true"
          :allow-place-node="true"
          :box-select="true"
          :original-positions="[]"
          :selected-node-id="selectedEditNode?.node_id ?? undefined"
          :selected-node-ids="selectedIds"
          :sound-speed-mps="1500"
          @node-move="onNodeMove"
          @nodes-move="onNodesMove"
          @node-select="onNodeSelect"
          @node-place="addNode"
          @selection-change="onSelectionChange"
          @protocol-drop="onProtocolDrop"
        />
      </div>

      <footer
        v-if="consoleVisible"
        class="wb-console"
        :class="{ collapsed: !consoleOpen }"
        :style="consoleOpen ? { height: consoleHeight + 'px' } : undefined"
      >
        <div
          v-show="consoleOpen"
          class="wb-console-grip"
          role="separator"
          aria-orientation="horizontal"
          aria-label="调整控制台高度"
          title="拖拽调整高度"
          @pointerdown="onConsoleGripDown"
        ></div>
        <div class="wb-console-head" @click="consoleOpen = !consoleOpen">
          <span class="wb-console-title">输出</span>
          <span v-if="runStatusLabel" class="run-badge" :class="`is-${runStatus}`">{{ runStatusLabel }}</span>
          <button class="wb-console-toggle" type="button" :aria-label="consoleOpen ? '收起输出' : '展开输出'">
            <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" :style="{ transform: consoleOpen ? 'none' : 'rotate(180deg)' }">
              <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <pre v-show="consoleOpen" class="run-log">{{ runLog }}</pre>
      </footer>
    </div>

    <SplitPane
      v-show="inspectOpen"
      :default-width="300"
      :min="240"
      :max="480"
      :storage-key="LOCAL_STORAGE_KEYS.splitInspect"
    >
      <aside class="wb-inspect">
      <div class="stack-board">
        <div class="stack-board-title">协议架构</div>
        <ol class="stack-list">
          <li v-for="row in protocolStack" :key="row.key" class="stack-row">
            <span class="stack-layer">{{ row.layer }}</span>
            <span class="stack-name">{{ row.name }}</span>
            <span class="stack-tid">{{ row.typeId }}</span>
            <span v-if="row.source" class="stack-src">{{ row.source }}</span>
          </li>
        </ol>
      </div>
      <div class="wb-inspect-head">
        <span>{{ selectedSummary }}</span>
      </div>
      <div v-if="selectedEditNode" class="coord-grid">
        <label class="field field-compact">
          <div class="field-head"><span>X</span></div>
          <input class="select" type="number" step="0.01" :value="selectedEditNode.x.toFixed(2)" @change="onCoordChange('x', $event)" />
        </label>
        <label class="field field-compact">
          <div class="field-head"><span>Y</span></div>
          <input class="select" type="number" step="0.01" :value="selectedEditNode.y.toFixed(2)" @change="onCoordChange('y', $event)" />
        </label>
        <label class="field field-compact">
          <div class="field-head"><span>Z</span></div>
          <input class="select" type="number" step="0.01" :value="(selectedEditNode.z ?? 0).toFixed(2)" @change="onCoordChange('z', $event)" />
        </label>
      </div>
      <ExperimentPanel
        :form="experimentForm"
        :spec-json="experimentSpecJson"
        :scratch-cc="generatedScratch"
        :warnings="experimentWarnings"
        :node-count="editNodes.length"
        :selected-count="selectedIds.length"
        :selected-mac-id="selectedMacId"
        :selected-summary="selectedSummary"
        :run-status="runStatus"
        @update-field="setField"
        @run="onRun"
        @sync-from-replay="syncFromReplay"
        @apply-to-replay="applyToReplay"
        @add-node="() => addNode()"
        @remove-node="removeSelected"
        @download="downloadJson"
        @copy="copyJson"
      />
      </aside>
    </SplitPane>
  </section>
</template>
