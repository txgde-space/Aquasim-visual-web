<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import NodeCanvas from '../components/NodeCanvas.vue'
import ExperimentPanel from '../components/ExperimentPanel.vue'
import ProtocolDrawer from '../components/ProtocolDrawer.vue'
import { session } from '../shared/sessionStore'
import {
  buildExperimentSpec,
  createDefaultExperimentForm,
  createDefaultTopology,
  macPresetById,
  validateExperiment,
} from '../experimentSpec.js'
import { generateAquaVisualCc } from '../generateScratch.js'
import { catalogItemById } from '../typeIdCatalog.js'

const router = useRouter()
const editNodes = ref(createDefaultTopology())
const selectedIds = ref([1])
const experimentForm = ref(createDefaultExperimentForm())
const copyHint = ref('')
const activeCatalogId = ref('mac:swarm')
const inspectOpen = ref(true)
const consoleOpen = ref(false)
const stackOpen = ref(false)
const runStatus = ref('idle')
const runLog = ref('')

const selectedNodes = computed(() => (
  editNodes.value.filter((node) => selectedIds.value.includes(Number(node.node_id)))
))
const selectedEditNode = computed(() => (selectedNodes.value.length === 1 ? selectedNodes.value[0] : null))
const selectedMacId = computed(() => experimentForm.value.macId || 'swarm')
const experimentSpec = computed(() => buildExperimentSpec(experimentForm.value, editNodes.value))
const experimentWarnings = computed(() => validateExperiment(experimentSpec.value))
const experimentSpecJson = computed(() => JSON.stringify(experimentSpec.value, null, 2))
const generatedScratch = computed(() => generateAquaVisualCc(experimentSpec.value))
const canvasNodes = computed(() => editNodes.value.map((node) => ({
  ...node,
  macId: experimentForm.value.macId || 'swarm',
  phyId: experimentForm.value.phyId || 'phy-fdm',
  routingId: experimentForm.value.routingId || 'static',
})))
const nodeVisuals = computed(() => canvasNodes.value.map((node) => ({
  ...node,
  mode: 'idle',
  fillProgress: 0,
  fade: 1,
  statusText: macPresetById(experimentForm.value.macId || 'swarm').label,
  packetId: null,
})))

const selectedSummary = computed(() => `${selectedNodes.value.length} 选中`)
const stackBrief = computed(() => protocolStack.value
  .filter((row) => row.key !== 'app' && row.key !== 'channel')
  .map((row) => row.name)
  .join(' · '))

const stackLayer = (layerId, itemId) => {
  const item = catalogItemById(layerId, itemId)
  return {
    name: item?.label || itemId || '—',
    typeId: item?.typeId ? item.typeId.replace(/^ns3::/, '') : '—',
    source: item?.source || '',
  }
}

const protocolStack = computed(() => {
  const form = experimentForm.value
  const appIds = [...new Set(editNodes.value.map((node) => node.appId || 'none'))]
  const apps = appIds.map((id) => stackLayer('app', id))
  const appName = apps.map((item) => item.name).join(' / ')
  const appType = [...new Set(apps.map((item) => item.typeId))].join(' / ')
  const channel = stackLayer('channel', form.channelId || 'channel')
  const prop = stackLayer('channel', form.propagationId || 'range')
  return [
    { key: 'app', layer: '应用层', name: appName, typeId: appType, source: [...new Set(apps.map((item) => item.source).filter(Boolean))].join('\n') },
    { key: 'routing', layer: '路由', ...stackLayer('routing', form.routingId || 'static') },
    { key: 'mac', layer: 'MAC', ...stackLayer('mac', form.macId || 'swarm') },
    { key: 'phy', layer: '物理层', ...stackLayer('phy', form.phyId || 'phy-fdm') },
    {
      key: 'channel',
      layer: '信道',
      name: `${channel.name} · ${prop.name}`,
      typeId: `${channel.typeId} · ${prop.typeId}`,
      source: [channel.source, prop.source].filter(Boolean).join('\n'),
    },
  ]
})

const cloneNode = (node) => ({
  ...node,
  x: Number(node.x) || 0,
  y: Number(node.y) || 0,
  z: Number(node.z) || 0,
  phyId: node.phyId || 'phy-fdm',
  macId: node.macId || 'swarm',
  routingId: node.routingId || 'static',
  appId: node.appId || 'none',
})

const onSelectionChange = (ids) => {
  selectedIds.value = (ids || []).map((id) => Number(id))
}

const onNodeSelect = (node) => {
  if (!node) return
  const id = Number(node.node_id)
  if (!selectedIds.value.includes(id)) selectedIds.value = [id]
}

const onNodesMove = (moves) => {
  if (!Array.isArray(moves) || !moves.length) return
  const byId = new Map(moves.map((item) => [Number(item.node_id), item]))
  editNodes.value = editNodes.value.map((node) => {
    const next = byId.get(Number(node.node_id))
    if (!next) return node
    return {
      ...node,
      x: Math.round((Number(next.x) || 0) * 100) / 100,
      y: Math.round((Number(next.y) || 0) * 100) / 100,
    }
  })
}

const onNodeMove = (payload) => {
  if (!payload || !Number.isFinite(Number(payload.node_id))) return
  if (selectedIds.value.length > 1) return
  editNodes.value = editNodes.value.map((node) => (
    node.node_id === payload.node_id
      ? { ...node, x: Math.round((Number(payload.x) || 0) * 100) / 100, y: Math.round((Number(payload.y) || 0) * 100) / 100 }
      : node
  ))
}

const onCoordChange = (axis, event) => {
  const node = selectedEditNode.value
  if (!node) return
  const next = Number(event.target.value)
  if (!Number.isFinite(next)) return
  editNodes.value = editNodes.value.map((item) => (
    item.node_id === node.node_id ? { ...item, [axis]: Math.round(next * 100) / 100 } : item
  ))
}

const nextNodeId = () => {
  const ids = editNodes.value.map((node) => Number(node.node_id)).filter(Number.isFinite)
  return ids.length ? Math.max(...ids) + 1 : 1
}

const addNode = (point) => {
  const nodeId = nextNodeId()
  const xs = editNodes.value.map((node) => Number(node.x) || 0)
  const ys = editNodes.value.map((node) => Number(node.y) || 0)
  const zs = editNodes.value.map((node) => Number(node.z) || 0)
  const spacing = xs.length >= 2
    ? Math.max(400, (Math.max(...xs) - Math.min(...xs)) / Math.max(xs.length - 1, 1))
    : 1000
  const placed = point && typeof point === 'object' && !('target' in point) && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))
  const x = placed ? Number(point.x) : (xs.length ? Math.max(...xs) + spacing : 0)
  const y = placed ? Number(point.y) : (ys.length ? ys.reduce((sum, value) => sum + value, 0) / ys.length : 0)
  const z = zs.length ? zs.reduce((sum, value) => sum + value, 0) / zs.length : 0
  const sample = selectedEditNode.value || editNodes.value[0]
  editNodes.value = [
    ...editNodes.value,
    {
      node_id: nodeId,
      name: `Node-${nodeId}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      z: Math.round(z * 100) / 100,
      role: 'node',
      phyId: sample?.phyId || 'phy-fdm',
      macId: selectedMacId.value || sample?.macId || 'swarm',
      routingId: sample?.routingId || 'static',
      appId: sample?.appId || 'none',
    },
  ]
  selectedIds.value = [nodeId]
}

const removeSelected = () => {
  const remaining = editNodes.value.length - selectedIds.value.length
  if (remaining < 2 || !selectedIds.value.length) return
  const drop = new Set(selectedIds.value.map(Number))
  editNodes.value = editNodes.value.filter((node) => !drop.has(Number(node.node_id)))
  selectedIds.value = editNodes.value[0] ? [Number(editNodes.value[0].node_id)] : []
}

const assignItem = (payload, ids = selectedIds.value) => {
  if (!payload) return
  const layer = payload.layer || 'mac'
  const itemId = payload.id || payload.macId
  if (!itemId) return
  activeCatalogId.value = `${layer}:${itemId}`

  if (layer === 'channel' || payload.scope === 'scene') {
    if (itemId === 'channel') experimentForm.value = { ...experimentForm.value, channelId: itemId }
    else experimentForm.value = { ...experimentForm.value, propagationId: itemId }
    return
  }

  const field = payload.field || (layer === 'phy' ? 'phyId' : layer === 'routing' ? 'routingId' : layer === 'app' ? 'appId' : 'macId')
  if (field === 'appId') {
    if (!ids.length) return
    const idSet = new Set(ids.map(Number))
    editNodes.value = editNodes.value.map((node) => (
      idSet.has(Number(node.node_id)) ? { ...node, appId: itemId } : node
    ))
    return
  }

  const nextForm = { ...experimentForm.value, [field]: itemId }
  if (field === 'macId') {
    const preset = macPresetById(itemId)
    if (preset && nextForm.trafficId === 'none') nextForm.trafficId = preset.trafficDefault
    if (itemId === 'tdma') nextForm.slotNum = Math.min(8, Math.max(nextForm.slotNum || 4, editNodes.value.length))
  }
  experimentForm.value = nextForm
  editNodes.value = editNodes.value.map((node) => ({ ...node, [field]: itemId }))
}

const onProtocolDrop = (payload) => {
  if (payload?.nodeId != null && Number.isFinite(Number(payload.nodeId))) {
    const id = Number(payload.nodeId)
    const ids = selectedIds.value.includes(id) && selectedIds.value.length > 1
      ? selectedIds.value
      : [id]
    if (!selectedIds.value.includes(id)) selectedIds.value = [id]
    assignItem(payload, ids)
    return
  }
  assignItem(payload, selectedIds.value)
}

const syncFromReplay = () => {
  const source = session.replayNodes
  if (!Array.isArray(source) || !source.length) return
  editNodes.value = source.map((node) => cloneNode({ ...node, macId: node.macId || 'swarm' }))
  selectedIds.value = editNodes.value[0] ? [Number(editNodes.value[0].node_id)] : []
}

const applyToReplay = () => {
  session.pendingReplayApply = editNodes.value.map(cloneNode)
  router.push('/replay')
}

const onField = (key, value) => {
  experimentForm.value = { ...experimentForm.value, [key]: value }
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

const runExperiment = async () => {
  if (runStatus.value === 'running') return
  runStatus.value = 'running'
  runLog.value = ''
  try {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(experimentSpec.value),
    })
    const data = await response.json()
    runLog.value = data.stdout || data.error || ''
    consoleOpen.value = true
    if (!response.ok || data.ok === false) {
      runStatus.value = 'fail'
      return
    }
    runStatus.value = 'ok'
    if (data.log) {
      session.pendingReplayLog = data.log
      session.pendingReplayName = data.logName || 'ns3.log'
      router.push('/replay')
    }
  } catch (error) {
    runStatus.value = 'fail'
    runLog.value = String(error?.message || error)
  }
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
          <button class="wb-stack-brief" type="button" @click="stackOpen = !stackOpen">{{ stackBrief }}</button>
        </div>
        <div class="wb-chrome-right">
          <span v-if="copyHint" class="field-chip">{{ copyHint }}</span>
          <span class="wb-run-hint">运行时生成 scratch/aqua-visual.cc 并执行 ./ns3 run aqua-visual</span>
          <button class="wb-run" data-testid="exp-run" :disabled="runStatus === 'running'" @click="runExperiment">
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
          underwater-detail="standard"
          :edit-mode="true"
          :allow-place-node="true"
          :box-select="true"
          :original-positions="[]"
          :selected-node-id="selectedEditNode?.node_id ?? null"
          :selected-node-ids="selectedIds"
          :sound-speed-mps="1500"
          @node-move="onNodeMove"
          @nodes-move="onNodesMove"
          @node-select="onNodeSelect"
          @node-place="addNode"
          @selection-change="onSelectionChange"
          @protocol-drop="onProtocolDrop"
        />
        <aside v-if="stackOpen" class="wb-hud">
          <div class="stack-board">
            <div class="stack-board-title">
              协议架构
              <button class="btn btn-compact" type="button" @click="stackOpen = false">关闭</button>
            </div>
            <ol class="stack-list">
              <li v-for="row in protocolStack" :key="row.key" class="stack-row">
                <span class="stack-layer">{{ row.layer }}</span>
                <span class="stack-name">{{ row.name }}</span>
                <span class="stack-tid">{{ row.typeId }}</span>
                <span v-if="row.source" class="stack-src">{{ row.source }}</span>
              </li>
            </ol>
          </div>
        </aside>
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
          <input class="select" type="number" step="0.01" :value="selectedEditNode.z.toFixed(2)" @change="onCoordChange('z', $event)" />
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
        :run-log="''"
        @update-field="onField"
        @run="runExperiment"
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
