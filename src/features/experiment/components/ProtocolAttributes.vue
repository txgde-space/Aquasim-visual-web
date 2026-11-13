<script setup lang="ts">
import { computed } from 'vue'
import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import { catalogItemById, orderCatalogLayers, type CatalogLayer } from '../lib/typeIdCatalog'
import { attributeEditState } from '../lib/protocolMetadata'
import { attributeDisplayValue, attributeInputHint, attributeLiteral } from '../lib/protocolUnits'
import type { ProtocolAttribute } from '../lib/typeIdCatalog'
import { NODE_PROTOCOL_LAYERS } from '../lib/protocolConfiguration'

const props = defineProps<{ layers: CatalogLayer[]; form: ExperimentForm; node: TopologyNode | null; ready: boolean; scope?: 'scene' | 'node' | 'device-node' | 'mobility-node'; layerId?: string; embedded?: boolean; hideHeading?: boolean }>()
const emit = defineEmits<{ change: [typeId: string, name: string, value: string, nodeId?: number] }>()
const isDeviceLayer = (id: string) => NODE_PROTOCOL_LAYERS.some((layer) => layer === id)
const groups = computed(() => orderCatalogLayers(props.layers).filter((layer) =>
  (!props.layerId || layer.id === props.layerId) && (props.scope === 'node' ? layer.id === 'app'
    : props.scope === 'device-node' ? isDeviceLayer(layer.id)
      : props.scope === 'mobility-node' ? layer.id === 'mobility' : layer.id !== 'app' && layer.scope !== 'node')).flatMap((layer) => {
  const ids = layer.id === 'channel' ? [props.form.channelId, props.form.propagationId]
    : layer.id === 'app' ? [props.node?.appId || 'none']
      : layer.id === 'mobility' ? [props.node?.mobility?.type || ''] : [String(props.form[layer.field as keyof ExperimentForm] || '')]
  return ids.map((id) => {
    const item = catalogItemById(layer.id, id, props.layers)
    if (!item?.typeId) return null
    const attributes = (item.attributes || []).map((attr) => ({ ...attr, ...attributeEditState(item, attr, layer.id) }))
    const values = layer.id === 'app' ? props.node?.appAttrs || {} : props.scope === 'device-node' || props.scope === 'mobility-node'
      ? props.node?.protocolAttributes?.[item.typeId] || {} : props.form.protocolAttributes?.[item.typeId] || {}
    const registered = new Set(attributes.map((attr) => attr.name))
    const unregistered = Object.keys(values).filter((name) => !registered.has(name))
    return { label: `${layer.label} · ${item.label}`, layerId: layer.id, item, attributes, values, unregistered,
      nodeId: layer.id === 'app' || props.scope === 'device-node' || props.scope === 'mobility-node' ? props.node?.node_id : undefined }
  }).filter((group) => group !== null)
}))
const labels: Record<string, string> = {
  StartTime: '应用启动时间', StopTime: '应用停止时间', OnTime: '发送持续时间', OffTime: '静默持续时间', Interval: '发送间隔分布',
  NodeCount: '节点数量', InitialRoundDelay: '首轮延迟', SlotNum: '时隙数量', SlotLen: '时隙长度', Token: '令牌标识',
  transRange: '传输距离（m）', Frequency: '频率', devName: '串口设备', DataRate: '发送速率（bit/s）', PacketSize: '包大小（B，字节）',
  RxProcessingDelay: '接收处理时间',
  Position: '初始位置', Velocity: '当前速度', InitialVelocity: '初始速度',
  Delay: '发送间隔', traffic: '每秒发包数', mode: '发送模式', Nsend: '发送节点上限', stopSend: '停止发送时间',
  RXThresh: '接收阈值', rxPower: '接收功耗', idlePower: '空闲功耗', MaxBytes: '最大发送字节数',
}
const placeholder = (typeId: string, attr: ProtocolAttribute) => {
  const defaultValue = attributeDisplayValue(attr, attr.defaultValue)
  const name = attr.name
  if (props.scope !== 'device-node') return defaultValue
  const inherited = props.form.protocolAttributes?.[typeId]?.[name]
  return !inherited?.trim() ? defaultValue : `继承统一：${attributeDisplayValue(attr, inherited)}`
}
const inputError = (attr: ProtocolAttribute, value?: string) => {
  if (!value?.trim()) return ''
  try { attributeLiteral(attr, value); return '' }
  catch (error) { return error instanceof Error ? error.message : String(error) }
}
</script>

<template>
  <section v-if="ready" class="protocol-attributes" :aria-label="scope === 'device-node' ? `节点 ${node?.node_id} 协议覆盖` : undefined">
    <div v-if="!embedded && !hideHeading" class="dock-title">{{ scope === 'node' ? '节点应用属性' : scope === 'device-node' ? '节点协议属性' : '统一协议属性' }}</div>
    <component :is="embedded ? 'section' : 'details'" v-for="group in groups" :key="group.item.typeId" class="attribute-group" :open="!embedded && (scope === 'node' || (scope === 'device-node' && groups.length === 1)) ? true : undefined">
      <summary v-if="!embedded">{{ group.label }}</summary>
      <h3 v-else-if="groups.length > 1" class="attribute-heading">{{ group.label }}</h3>
      <p v-if="group.item.requirement" class="attribute-hint">{{ group.item.requirement }}</p>
      <p v-if="!group.attributes.length" class="attribute-hint">此协议没有注册属性。</p>
      <label v-for="attr in group.attributes" :key="attr.name" class="field field-compact" :title="attr.help">
        <span class="field-head"><span>{{ labels[attr.name] || '协议参数' }}</span><span class="field-param">{{ attr.name }}</span></span>
        <input class="select" :value="group.values[attr.name] ?? ''" :placeholder="placeholder(group.item.typeId, attr)" :readonly="!attr.editable" :aria-invalid="attr.editable && !!inputError(attr, group.values[attr.name])" :data-protocol-attribute="attr.name"
          @input="attr.editable && emit('change', group.item.typeId, attr.name, ($event.target as HTMLInputElement).value, group.nodeId)" />
        <span v-if="attr.editable && attributeInputHint(attr)" class="attribute-unit">{{ attributeInputHint(attr) }}</span>
        <span v-if="attr.editable && inputError(attr, group.values[attr.name])" class="attribute-error">{{ inputError(attr, group.values[attr.name]) }}</span>
        <span v-if="!attr.editable" class="attribute-state">
          <span>{{ attr.reason }}</span>
          <button v-if="group.values[attr.name] !== undefined" type="button" class="btn btn-compact" @click="emit('change', group.item.typeId, attr.name, '', group.nodeId)">清除覆盖</button>
        </span>
        <span v-else-if="scope === 'device-node' && group.values[attr.name] !== undefined" class="attribute-state">
          <span>节点覆盖</span><button type="button" class="btn btn-compact" @click="emit('change', group.item.typeId, attr.name, '', group.nodeId)">恢复继承</button>
        </span>
      </label>

      <label v-for="name in group.unregistered" :key="`unregistered:${name}`" class="field field-compact">
        <span class="field-head"><span>未注册属性</span><span class="field-param">{{ name }}</span></span>
        <input class="select" :value="group.values[name]" readonly />
        <span class="attribute-state"><span>已保存的覆盖值</span><button type="button" class="btn btn-compact" @click="emit('change', group.item.typeId, name, '', group.nodeId)">清除覆盖</button></span>
      </label>
    </component>
  </section>
</template>

<style scoped>
.protocol-attributes { min-width: 0; }
.attribute-group { border-bottom: 1px solid var(--line); padding: 8px 0; }
.attribute-group summary { cursor: pointer; color: var(--text); font-size: 12px; overflow-wrap: anywhere; }
.attribute-heading { margin: 0; color: var(--text); font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
.attribute-group .field-head { flex-wrap: wrap; }
.attribute-group .field { margin-top: 8px; }
.attribute-group .field-param { overflow-wrap: anywhere; }
.attribute-group input { width: 100%; min-width: 0; }
.attribute-group input[readonly] { color: var(--muted); }
.attribute-state { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 11px; }
.attribute-unit { color: var(--muted); font-size: 11px; }
.attribute-error { color: var(--bad); font-size: 11px; }
.attribute-hint { font-size: 11px; line-height: 1.5; color: var(--muted); margin-top: 8px; }
</style>
