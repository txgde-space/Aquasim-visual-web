<script setup lang="ts">
import { computed } from 'vue'
import type { ExperimentForm, TopologyNode } from '../../../shared/types/experiment'
import { catalogItemById, type CatalogLayer } from '../lib/typeIdCatalog'

const props = defineProps<{ layers: CatalogLayer[]; form: ExperimentForm; node: TopologyNode | null; ready: boolean; scope?: 'scene' | 'node'; layerId?: string; embedded?: boolean }>()
const emit = defineEmits<{ change: [typeId: string, name: string, value: string, nodeId?: number] }>()
const groups = computed(() => props.layers.filter((layer) =>
  (!props.layerId || layer.id === props.layerId) && (props.scope === 'node' ? layer.id === 'app' : layer.id !== 'app')).flatMap((layer) => {
  const ids = layer.id === 'channel' ? [props.form.channelId, props.form.propagationId]
    : layer.id === 'app' ? [props.node?.appId || 'none'] : [String(props.form[layer.field as keyof ExperimentForm] || '')]
  return ids.map((id) => {
    const item = catalogItemById(layer.id, id, props.layers)
    if (!item?.typeId) return null
    // Object pointers and socket endpoints are connected by the installer.
    const attributes = (item.attributes || []).filter((attr) =>
      !['ns3::ObjectVectorValue', 'ns3::AddressValue'].includes(attr.valueType) &&
      (attr.valueType !== 'ns3::PointerValue' || ['OnTime', 'OffTime', 'Interval'].includes(attr.name)) &&
      !['Protocol', 'Remote', 'txPower'].includes(attr.name))
    return { label: `${layer.label} · ${item.label}`, item, attributes, nodeId: layer.id === 'app' ? props.node?.node_id : undefined,
      values: layer.id === 'app' ? props.node?.appAttrs || {} : props.form.protocolAttributes?.[item.typeId] || {} }
  }).filter((group) => group !== null)
}))
const labels: Record<string, string> = {
  StartTime: '应用启动时间', StopTime: '应用停止时间', OnTime: '发送持续时间', OffTime: '静默持续时间', Interval: '发送间隔分布',
  NodeCount: '节点数量', InitialRoundDelay: '首轮延迟', SlotNum: '时隙数量', SlotLen: '时隙长度',
  transRange: '传输距离', Frequency: '频率', devName: '串口设备', DataRate: '发送速率', PacketSize: '包大小',
  Delay: '发送间隔', traffic: '每秒发包数', mode: '发送模式', Nsend: '发送节点上限', stopSend: '停止发送时间',
  RXThresh: '接收阈值', rxPower: '接收功耗', idlePower: '空闲功耗', MaxBytes: '最大发送字节数',
}
</script>

<template>
  <section v-if="ready" class="protocol-attributes">
    <div v-if="!embedded" class="dock-title">{{ scope === 'node' ? '节点应用属性' : '统一协议属性' }}</div>
    <p class="attribute-hint">{{ scope === 'node' ? '参数仅作用于当前节点；留空使用协议默认值，启动时间默认 0s，停止时间默认仿真结束。' : '填写值会覆盖实验参数；留空使用实验配置或协议默认值。' }}</p>
    <component :is="embedded ? 'section' : 'details'" v-for="group in groups" :key="group.item.typeId" class="attribute-group" :open="!embedded && scope === 'node' ? true : undefined">
      <summary v-if="!embedded">{{ group.label }}</summary>
      <h3 v-else-if="groups.length > 1" class="attribute-heading">{{ group.label }}</h3>
      <p v-if="group.item.requirement" class="attribute-hint">{{ group.item.requirement }}</p>
      <p v-if="!group.attributes.length" class="attribute-hint">此协议没有可编辑的标量属性。</p>
      <label v-for="attr in group.attributes" :key="attr.name" class="field field-compact" :title="attr.help">
        <span class="field-head"><span>{{ labels[attr.name] || '协议参数' }}</span><span class="field-param">{{ attr.name }}</span></span>
        <input class="select" :value="group.values[attr.name] || ''" :placeholder="`注册默认：${attr.defaultValue}`"
          @input="emit('change', group.item.typeId, attr.name, ($event.target as HTMLInputElement).value, group.nodeId)" />
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
.attribute-hint { font-size: 11px; line-height: 1.5; color: var(--muted); margin-top: 8px; }
</style>
