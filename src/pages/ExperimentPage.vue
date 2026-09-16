<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import NodeCanvas from '../components/NodeCanvas.vue'
import ExperimentPanel from '../components/ExperimentPanel.vue'
import ProtocolDrawer from '../components/ProtocolDrawer.vue'
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
const consoleOpen = ref(false)

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
  <section class="wb" :class="{ 'wb-inspect-open': inspectOpen, 'wb-console-open': consoleOpen && !!runLog }">
    <ProtocolDrawer :active-id="activeCatalogId" @assign="assignItem" />

    <div class="wb-stage">
      <header class="wb-chrome">
        <div class="wb-chrome-left">
          <button class="btn btn-compact" data-testid="exp-add-node" @click="addNode()">添加节点</button>
          <button class="btn btn-compact" :disabled="selectedIds.length === 0 || editNodes.length - selectedIds.length < 2" @click="removeSelected">删除</button>
          <button class="btn btn-compact" @click="inspectOpen = !inspectOpen">{{ inspectOpen ? '收起属性' : '属性' }}</button>
          <span class="wb-stack-brief">{{ stackBrief }}</span>
        </div>
        <div class="wb-chrome-right">
          <span v-if="copyHint" class="field-chip">{{ copyHint }}</span>
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
          theme-key="research-lab"
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

      <footer v-if="consoleOpen && runLog" class="wb-console">
        <div class="wb-console-head">
          <span>输出</span>
          <button class="btn btn-compact" @click="consoleOpen = false">关闭</button>
        </div>
        <pre class="run-log">{{ runLog }}</pre>
      </footer>
    </div>

    <aside v-show="inspectOpen" class="wb-inspect">
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
  </section>
</template>
