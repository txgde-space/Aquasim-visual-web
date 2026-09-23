<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
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
import { useSimulatorSettings } from '@/features/experiment/composables/useSimulatorSettings'
import { useExperimentFiles } from '@/features/experiment/composables/useExperimentFiles'
import ExperimentFiles from '@/features/experiment/components/ExperimentFiles.vue'
import NodeProtocolDetails from '@/features/experiment/components/NodeProtocolDetails.vue'
import ProtocolAttributes from '@/features/experiment/components/ProtocolAttributes.vue'
import SimulatorSettings from '@/features/experiment/components/SimulatorSettings.vue'

const router = useRouter()
const { catalog, catalogReady, aquaSimHome, defaultHome, storageError, checking, result: simulatorResult, precompile, buildStatus, buildLog, buildError, buildProgress, clearBuild, cleanStatus, cleanError, resetDirectory, selectDirectory } = useSimulatorSettings()
const simulatorBusy = computed(() => buildStatus.value === 'building' || cleanStatus.value === 'cleaning')
const editor = useTopologyEditor(catalog)
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
  setProtocolAttribute,
  setNodeDestination,
} = editor

const copyHint = ref('')
const protoOpen = ref(true)
const inspectOpen = ref(true)

// 底部控制台：可折叠为标题条，拖拽上边缘调高
const stageEl = ref<HTMLElement | null>(null)
const consoleOpen = ref(false)
const consoleHeight = ref(180)
const consoleDragging = ref(false)
let consoleDragY = 0
let consoleDragH = 0

const onConsoleGripMove = (event: PointerEvent) => {
  const maxH = Math.max(160, (stageEl.value?.clientHeight ?? window.innerHeight) * 0.5)
  consoleHeight.value = Math.min(maxH, Math.max(120, consoleDragH + (consoleDragY - event.clientY)))
}
const onConsoleGripUp = () => {
  consoleDragging.value = false
  window.removeEventListener('pointermove', onConsoleGripMove)
  document.body.style.userSelect = ''
}
const onConsoleGripDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  consoleDragging.value = true
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

const experimentSpec = computed(() => buildExperimentSpec(experimentForm.value, editNodes.value, catalog.value))
const experimentWarnings = computed(() => validateExperiment(experimentSpec.value))
const generatedScratch = computed(() => {
  try { return generateAquaVisualCc(experimentSpec.value, catalog.value) }
  catch (error) { return `// ${error instanceof Error ? error.message : String(error)}` }
})

const onRunSuccess = (log: string, logName: string) => {
  session.pendingReplayApply = null
  session.pendingReplayLog = log
  session.pendingReplayName = logName
  router.push('/replay')
}

const { runStatus, runLog, runExperiment } = useRunExperiment({
  getSpec: () => experimentSpec.value,
  getAquaSimHome: () => aquaSimHome.value,
  onSuccess: onRunSuccess,
})

const consoleVisible = computed(() => runStatus.value !== 'idle' || !!runLog.value)
const runStatusLabel = computed(
  () => ({ running: '运行中', ok: '成功', fail: '失败', idle: '' })[runStatus.value],
)

const onRun = async () => {
  if (editNodes.value.length < 2 || !catalogReady.value || simulatorBusy.value) return
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
  session.pendingReplayLog = null
  session.pendingReplayName = ''
  router.push('/replay')
}

const files = useExperimentFiles(editor, catalog, aquaSimHome, selectDirectory, () => {
  runStatus.value = 'idle'
  runLog.value = ''
  consoleOpen.value = false
})
const { documentJson, message: fileMessage, failed: fileFailed, importing, newExperiment, importFile, exportFile } = files

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(documentJson.value)
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
          :view-padding="{ left: 232, top: 24, right: 300, bottom: 0 }"
          @node-move="onNodeMove"
          @nodes-move="onNodesMove"
          @node-select="onNodeSelect"
          @node-place="addNode"
          @selection-change="onSelectionChange"
          @protocol-drop="onProtocolDrop"
        >
          <template #node-details="{ node }">
            <NodeProtocolDetails
              :node-id="node.node_id" :nodes="editNodes" :form="experimentForm" :layers="catalog" :ready="catalogReady"
              :disabled="runStatus === 'running' || simulatorBusy"
              @application="(nodeId, id) => assignItem({ layer: 'app', id }, [nodeId])"
              @attribute="setProtocolAttribute" @destination="setNodeDestination"
            />
          </template>
        </NodeCanvas>
      </div>

      <div class="dock-unit dock-unit-l" :class="{ closed: !protoOpen }">
        <div class="dock dock-left">
          <ProtocolDrawer :layers="catalog" :ready="catalogReady" :active-id="activeCatalogId" :applied-protocols="protocolStack" @assign="assignItem">
            <template #protocol-settings="{ layerId }">
              <ProtocolAttributes embedded scope="scene" :layer-id="layerId" :layers="catalog" :form="experimentForm" :node="null" :ready="catalogReady" @change="setProtocolAttribute" />
            </template>
          </ProtocolDrawer>
        </div>
        <button
          class="panel-ear ear-left"
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
      </div>

      <div class="dock dock-top cmd-bar">
        <button class="btn btn-compact" data-testid="exp-add-node" @click="addNode()">添加节点</button>
        <button class="btn btn-compact" :disabled="selectedIds.length === 0" @click="removeSelected">删除选中</button>
        <span class="cmd-sep" aria-hidden="true"></span>
        <span class="stack-brief">{{ stackBrief }}</span>
        <span class="cmd-sep" aria-hidden="true"></span>
        <span v-if="copyHint" class="field-chip">{{ copyHint }}</span>
        <button class="btn btn-compact" :disabled="runStatus === 'running' || simulatorBusy || importing" @click="newExperiment">新建实验</button>
        <button class="run-btn" data-testid="exp-run" :disabled="editNodes.length < 2 || !catalogReady || runStatus === 'running' || simulatorBusy" @click="onRun">
          {{ runStatus === 'running' ? '运行中…' : '运行仿真' }}
        </button>
      </div>

      <div class="dock-unit dock-unit-r" :class="{ closed: !inspectOpen }">
        <button
          class="panel-ear"
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
          class="dock-right"
          :default-width="300"
          :min="240"
          :max="480"
          :storage-key="LOCAL_STORAGE_KEYS.splitInspect"
        >
        <aside class="dock-body">
          <SimulatorSettings
            v-model="aquaSimHome"
            :default-home="defaultHome"
            :checking="checking"
            :disabled="runStatus === 'running' || simulatorBusy"
            :build-status="buildStatus"
            :build-log="buildLog"
            :build-error="buildError"
            :build-progress="buildProgress"
            :clean-status="cleanStatus"
            :clean-error="cleanError"
            :storage-error="storageError"
            :result="simulatorResult"
            @precompile="precompile"
            @clear-build="clearBuild"
            @reset="resetDirectory"
            @select="selectDirectory"
          />
          <div class="dock-title">{{ selectedSummary }}</div>
          <div v-if="selectedEditNode" class="coord-grid">
            <label class="field field-compact">
              <div class="field-head"><span>X (m)</span></div>
              <input class="select" type="number" step="0.01" :value="selectedEditNode.x" @input="onCoordChange('x', $event)" />
            </label>
            <label class="field field-compact">
              <div class="field-head"><span>Y (m)</span></div>
              <input class="select" type="number" step="0.01" :value="selectedEditNode.y" @input="onCoordChange('y', $event)" />
            </label>
            <label class="field field-compact">
              <div class="field-head"><span>Z (m)</span></div>
              <input class="select" type="number" step="0.01" :value="selectedEditNode.z ?? 0" @input="onCoordChange('z', $event)" />
            </label>
          </div>
          <ExperimentPanel
            :form="experimentForm"
            :spec-json="documentJson"
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
            @download="exportFile"
            @copy="copyJson"
          />
          <ExperimentFiles
            :disabled="runStatus === 'running' || simulatorBusy"
            :message="fileMessage" :failed="fileFailed" :importing="importing"
            @import="importFile" @export="exportFile"
          />
        </aside>
        </SplitPane>
      </div>

      <Transition name="console">
      <footer
        v-if="consoleVisible"
        class="dock console"
        :class="{ collapsed: !consoleOpen, dragging: consoleDragging }"
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
      </Transition>
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
