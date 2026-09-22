<script setup lang="ts">
import { computed } from 'vue'
import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import type { CatalogLayer } from '../lib/typeIdCatalog'
import ProtocolAttributes from './ProtocolAttributes.vue'

const props = defineProps<{ nodeId: number; nodes: TopologyNode[]; layers: CatalogLayer[]; form: ExperimentForm; ready: boolean; disabled: boolean }>()
const emit = defineEmits<{
  application: [nodeId: number, id: string]
  attribute: [typeId: string, name: string, value: string, nodeId?: number]
  destination: [nodeId: number, destination?: number]
}>()
const node = computed(() => props.nodes.find((item) => item.node_id === props.nodeId))
const apps = computed(() => props.layers.find((layer) => layer.id === 'app')?.items || [])
const selectedAppKnown = computed(() => apps.value.some((app) => app.id === node.value?.appId))
const destinationKnown = computed(() => node.value?.appDestination === undefined || props.nodes.some((target) => target.node_id === node.value?.appDestination))
</script>

<template>
  <div v-if="node" class="node-protocol-details">
    <p class="node-position">x {{ node.x }} / y {{ node.y }} / z {{ node.z ?? 0 }} m</p>
    <p class="node-scope">以下设置仅作用于节点 {{ node.node_id }} 的应用。</p>
    <fieldset :disabled="disabled">
      <label class="field field-compact">
        <span class="field-head"><span>应用</span><span class="field-param">Application</span></span>
        <select class="select" aria-label="节点应用" :disabled="!ready" :value="node.appId || 'none'"
          @change="emit('application', node.node_id, ($event.target as HTMLSelectElement).value)">
          <option v-if="!selectedAppKnown && node.appId" :value="node.appId">{{ node.appId }}（未注册）</option>
          <option v-for="app in apps" :key="app.id" :value="app.id">{{ app.label }}</option>
        </select>
      </label>
      <p v-if="!ready" class="node-scope">预编译后可选择应用并编辑注册属性。</p>
      <template v-if="node.appId && node.appId !== 'none'">
        <label class="field field-compact">
          <span class="field-head"><span>目的节点</span><span class="field-param">Remote</span></span>
          <select class="select" aria-label="节点应用目的节点" :value="node.appDestination ?? ''"
            @change="emit('destination', node.node_id, ($event.target as HTMLSelectElement).value === '' ? undefined : Number(($event.target as HTMLSelectElement).value))">
            <option value="">请选择目的节点</option>
            <option v-if="!destinationKnown" :value="node.appDestination">节点 {{ node.appDestination }}（已移除）</option>
            <option v-for="target in nodes" :key="target.node_id" :value="target.node_id">节点 {{ target.node_id }} · {{ target.name }}</option>
          </select>
        </label>
        <ProtocolAttributes scope="node" :layers="layers" :form="form" :node="node" :ready="ready"
          @change="(typeId, name, value, nodeId) => emit('attribute', typeId, name, value, nodeId)" />
      </template>
    </fieldset>
  </div>
</template>

<style scoped>
.node-protocol-details { margin-top: 8px; }
.node-position, .node-scope { color: var(--muted); font-size: 12px; line-height: 1.5; margin: 6px 0; overflow-wrap: anywhere; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.select { width: 100%; min-width: 0; }
.field { margin-top: 8px; }
</style>
