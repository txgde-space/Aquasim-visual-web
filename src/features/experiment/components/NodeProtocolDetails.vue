<script setup lang="ts">
import { computed } from 'vue'
import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import { catalogItemById, type CatalogLayer } from '../lib/typeIdCatalog'
import { hasSocketInterface } from '../lib/protocolMetadata'
import ProtocolAttributes from './ProtocolAttributes.vue'

const props = defineProps<{ nodeId: number; nodes: TopologyNode[]; layers: CatalogLayer[]; form: ExperimentForm; ready: boolean; disabled: boolean }>()
const emit = defineEmits<{
  application: [nodeId: number, id: string]
  attribute: [typeId: string, name: string, value: string, nodeId?: number]
  destination: [nodeId: number, destination?: number]
  'protocol-attribute': [typeId: string, name: string, value: string, nodeId: number]
  mobility: [nodeId: number, typeId: string]
}>()
const node = computed(() => props.nodes.find(({ node_id }) => node_id === props.nodeId))
const apps = computed(() => props.layers.find((layer) => layer.id === 'app')?.items || [])
const selectedApp = computed(() => catalogItemById('app', node.value?.appId || 'none', props.layers))
const applicationLabel = computed(() => selectedApp.value?.label || (node.value?.appId && node.value.appId !== 'none' ? node.value.appId : '无独立应用'))
const hasDestination = computed(() => hasSocketInterface(selectedApp.value || undefined))
const destinationKnown = computed(() => node.value?.appDestination === undefined || props.nodes.some((target) => target.node_id === node.value?.appDestination))
const mobilityModels = computed(() => props.layers.find((layer) => layer.id === 'mobility')?.items || [])
const selectedMobility = computed(() => catalogItemById('mobility', node.value?.mobility?.type || '', props.layers))
const mobilityLabel = computed(() => selectedMobility.value?.label || node.value?.mobility?.type || '固定位置')
</script>

<template>
  <div v-if="node" class="node-protocol-details">
    <fieldset :disabled="disabled">
      <div v-if="ready" class="dock-title">节点协议属性</div>
      <details class="node-application">
        <summary>应用层 · {{ applicationLabel }}</summary>
      <label class="field field-compact">
        <span class="field-head"><span>应用</span><span class="field-param">Application</span></span>
        <select class="select" aria-label="节点应用" :disabled="!ready" :value="selectedApp?.id || node.appId || 'none'"
          @change="emit('application', node.node_id, ($event.target as HTMLSelectElement).value)">
          <option v-if="!selectedApp && (!node.appId || node.appId === 'none')" value="none">无独立应用</option>
          <option v-else-if="!selectedApp && node.appId" :value="node.appId">{{ node.appId }}（{{ ready ? '未注册' : '待校验' }}）</option>
          <option v-for="app in apps" :key="app.id" :value="app.id">{{ app.label }}</option>
        </select>
      </label>
      <p v-if="!ready" class="node-scope">预编译后可选择应用并编辑注册属性。</p>
      <template v-if="node.appId && node.appId !== 'none'">
        <label v-if="hasDestination" class="field field-compact">
          <span class="field-head"><span>目的节点</span><span class="field-param">Remote</span></span>
          <select class="select" aria-label="节点应用目的节点" :value="node.appDestination ?? ''"
            @change="emit('destination', node.node_id, ($event.target as HTMLSelectElement).value === '' ? undefined : Number(($event.target as HTMLSelectElement).value))">
            <option value="">请选择目的节点</option>
            <option v-if="!destinationKnown" :value="node.appDestination">节点 {{ node.appDestination }}（已移除）</option>
            <option v-for="target in nodes" :key="target.node_id" :value="target.node_id">节点 {{ target.node_id }} · {{ target.name }}</option>
          </select>
        </label>
        <ProtocolAttributes embedded scope="node" :layers="layers" :form="form" :node="node" :ready="ready"
          @change="(typeId, name, value, nodeId) => emit('attribute', typeId, name, value, nodeId)" />
      </template>
      </details>
      <ProtocolAttributes hide-heading scope="device-node" :layers="layers" :form="form" :node="node" :ready="ready"
        @change="(typeId, name, value) => emit('protocol-attribute', typeId, name, value, nodeId)" />
      <details class="node-mobility">
        <summary>移动模型 · {{ mobilityLabel }}</summary>
        <label class="field field-compact">
          <span class="field-head"><span>移动模型</span><span class="field-param">MobilityModel</span></span>
          <select class="select" aria-label="节点移动模型" :disabled="!ready" :value="selectedMobility?.typeId || node.mobility?.type || ''"
            @change="emit('mobility', node.node_id, ($event.target as HTMLSelectElement).value)">
            <option value="">固定位置</option>
            <option v-if="node.mobility?.type && !selectedMobility" :value="node.mobility.type">{{ node.mobility.type }}（{{ ready ? '未注册' : '待校验' }}）</option>
            <option v-for="model in mobilityModels" :key="model.typeId" :value="model.typeId">{{ model.label }}</option>
          </select>
        </label>
        <ProtocolAttributes v-if="node.mobility" embedded scope="mobility-node" :layers="layers" :form="form" :node="node" :ready="ready"
          @change="(typeId, name, value) => emit('protocol-attribute', typeId, name, value, nodeId)" />
      </details>
    </fieldset>
  </div>
</template>

<style scoped>
.node-protocol-details { margin-top: 8px; }
.node-scope { color: var(--muted); font-size: 12px; line-height: 1.5; margin: 6px 0; overflow-wrap: anywhere; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.select { width: 100%; min-width: 0; }
.field { margin-top: 8px; }
.node-application, .node-mobility { border-bottom: 1px solid var(--line); padding: 8px 0; }
.node-application summary, .node-mobility summary { cursor: pointer; color: var(--text); font-size: 12px; overflow-wrap: anywhere; }
</style>
