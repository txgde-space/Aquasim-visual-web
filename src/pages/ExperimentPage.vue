<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import NodeCanvas from '../components/NodeCanvas.vue'
import ExperimentPanel from '../components/ExperimentPanel.vue'
import ProtocolDrawer from '../components/ProtocolDrawer.vue'
import SplitPane from '../components/SplitPane.vue'
import { CANVAS_THEME_KEY, LOCAL_STORAGE_KEYS } from '../shared/constants'
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
const protoOpen = ref(true)
const inspectOpen = ref(true)
const inspectWidth = ref(300)

// 协议目录宽度随层级开合变化（仅 rail 46px / rail+flyout 256px），实测后驱动左耳位置
const protoDockEl = ref<HTMLElement | null>(null)
const protoDockRight = ref(0)
let protoRO: ResizeObserver | null = null
onMounted(() => {
  const el = protoDockEl.value
  if (!el) return
  const measure = () => {
    protoDockRight.value = el.offsetLeft + el.offsetWidth
  }
  measure()
  protoRO = new ResizeObserver(measure)
  protoRO.observe(el)
})

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
  protoRO?.disconnect()
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
  <section class="page">
    <div ref="stageEl" class="deck">
      <div class="deck-canvas">
        <NodeCanvas
          :nodes="canvasNodes"
          :node-visuals="nodeVisuals"
          :visible-packets="[]"
          :current-time="0"
          :theme-key="CANVAS_THEME_KEY"
          fx-level="standard"
          :edit-mode="true"
          :allow-place-node="true"
          :box-select="true"
          :original-positions="[]"
          :selected-node-id="selectedEditNode?.node_id ?? undefined"
          :selected-node-ids="selectedIds"
          :sound-speed-mps="1500"
          :view-padding="{ left: protoOpen ? 232 : 0, top: 24, right: inspectOpen ? inspectWidth : 0, bottom: 0 }"
          @node-move="onNodeMove"
          @nodes-move="onNodesMove"
          @node-select="onNodeSelect"
          @node-place="addNode"
          @selection-change="onSelectionChange"
          @protocol-drop="onProtocolDrop"
        />
      </div>

      <div v-show="protoOpen" ref="protoDockEl" class="dock dock-left">
        <ProtocolDrawer :active-id="activeCatalogId" @assign="assignItem" />
      </div>

      <button
        class="panel-ear ear-left"
        :style="{ left: protoOpen ? protoDockRight + 'px' : '0px' }"
        :title="protoOpen ? '收起协议目录' : '展开协议目录'"
        :aria-label="protoOpen ? '收起协议目录' : '展开协议目录'"
        :aria-expanded="protoOpen"
        @click="protoOpen = !protoOpen"
      >
        <svg viewBox="0 0 6 10" width="6" height="10" aria-hidden="true">
          <path :d="protoOpen ? 'M5 1L1 5l4 4' : 'M1 1l4 4-4 4'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="ear-label">协议</span>
      </button>

      <div class="dock dock-top cmd-bar">
        <button class="btn btn-compact" data-testid="exp-add-node" @click="addNode()">添加节点</button>
        <button class="btn btn-compact" :disabled="selectedIds.length === 0 || editNodes.length - selectedIds.length < 2" @click="removeSelected">删除选中</button>
        <span class="cmd-sep" aria-hidden="true"></span>
        <span class="stack-brief">{{ stackBrief }}</span>
        <span class="cmd-sep" aria-hidden="true"></span>
        <span v-if="copyHint" class="field-chip">{{ copyHint }}</span>
        <button class="run-btn" data-testid="exp-run" :disabled="runStatus === 'running'" @click="onRun">
          {{ runStatus === 'running' ? '运行中…' : '运行仿真' }}
        </button>
      </div>

      <button
        class="panel-ear"
        :class="{ open: inspectOpen }"
        :style="{ right: inspectOpen ? inspectWidth + 'px' : '0px' }"
        :title="inspectOpen ? '收起属性面板' : '展开属性面板'"
        :aria-label="inspectOpen ? '收起属性面板' : '展开属性面板'"
        :aria-expanded="inspectOpen"
        @click="inspectOpen = !inspectOpen"
      >
        <svg viewBox="0 0 6 10" width="6" height="10" aria-hidden="true">
          <path :d="inspectOpen ? 'M1 1l4 4-4 4' : 'M5 1L1 5l4 4'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="ear-label">属性</span>
      </button>

      <SplitPane
        v-show="inspectOpen"
        class="dock-right"
        :default-width="300"
        :min="240"
        :max="480"
        :storage-key="LOCAL_STORAGE_KEYS.splitInspect"
        @update:width="inspectWidth = $event"
      >
        <aside class="dock-body">
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
          <div class="dock-title">{{ selectedSummary }}</div>
          <div v-if="selectedEditNode" class="coord-grid">
            <label class="field field-compact">
              <div class="field-head"><span>X (m)</span></div>
              <input class="select" type="number" step="0.01" :value="selectedEditNode.x.toFixed(2)" @change="onCoordChange('x', $event)" />
            </label>
            <label class="field field-compact">
              <div class="field-head"><span>Y (m)</span></div>
              <input class="select" type="number" step="0.01" :value="selectedEditNode.y.toFixed(2)" @change="onCoordChange('y', $event)" />
            </label>
            <label class="field field-compact">
              <div class="field-head"><span>Z (m)</span></div>
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

      <footer
        v-if="consoleVisible"
        class="dock console"
        :class="{ collapsed: !consoleOpen }"
        :style="consoleOpen ? { height: consoleHeight + 'px' } : undefined"
      >
        <div
          v-show="consoleOpen"
          class="console-grip"
          role="separator"
          aria-orientation="horizontal"
          aria-label="调整控制台高度"
          title="拖拽调整高度"
          @pointerdown="onConsoleGripDown"
        ></div>
        <div class="console-head" @click="consoleOpen = !consoleOpen">
          <span class="console-title">输出</span>
          <span v-if="runStatusLabel" class="run-badge" :class="`is-${runStatus}`">{{ runStatusLabel }}</span>
          <button class="console-toggle" type="button" :aria-label="consoleOpen ? '收起输出' : '展开输出'">
            <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true" :style="{ transform: consoleOpen ? 'none' : 'rotate(180deg)' }">
              <path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <pre v-show="consoleOpen" class="run-log">{{ runLog }}</pre>
      </footer>
    </div>

    <footer class="statusbar">
      <span class="sb-item"><span class="sb-dot" :class="`is-${runStatus}`"></span>{{ runStatusLabel || '就绪' }}</span>
      <span class="sb-item">节点 <b>{{ editNodes.length }}</b></span>
      <span class="sb-item">选中 <b>{{ selectedIds.length }}</b></span>
      <span class="sb-spacer"></span>
      <span class="sb-item">{{ stackBrief }}</span>
    </footer>
  </section>
</template>
