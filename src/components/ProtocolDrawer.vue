<script setup>
import { computed, ref } from 'vue'
import { AQUA_ITEM_MIME, TYPEID_LAYERS } from '@/features/experiment/lib/typeIdCatalog'

defineProps({
  activeId: { type: String, default: '' },
})

const emit = defineEmits(['assign'])

const openLayer = ref('mac')

const toggleLayer = (id) => {
  openLayer.value = openLayer.value === id ? '' : id
}

const currentLayer = computed(() => TYPEID_LAYERS.find((layer) => layer.id === openLayer.value) || null)

const onDragStart = (layer, item, event) => {
  if (item.supported === false) {
    event.preventDefault()
    return
  }
  const payload = JSON.stringify({
    layer: layer.id,
    id: item.id,
    typeId: item.typeId,
    field: layer.field,
    scope: layer.scope || 'node',
  })
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(AQUA_ITEM_MIME, payload)
  event.dataTransfer.setData('text/plain', payload)
}

const onItemClick = (layer, item) => {
  if (item.supported === false) return
  emit('assign', { layer: layer.id, id: item.id, typeId: item.typeId, field: layer.field, scope: layer.scope || 'node' })
}

const shortType = (typeId) => (typeId ? typeId.replace(/^ns3::/, '') : '—')
const shortLabel = (id) => ({
  phy: 'PHY',
  mac: 'MAC',
  routing: 'RT',
  app: 'APP',
  channel: 'CH',
}[id] || id)
</script>

<template>
  <div class="rail-wrap">
    <nav class="rail">
      <button
        v-for="layer in TYPEID_LAYERS"
        :key="layer.id"
        class="rail-btn"
        :class="{ on: openLayer === layer.id }"
        type="button"
        @click="toggleLayer(layer.id)"
      >
        {{ shortLabel(layer.id) }}
      </button>
    </nav>
    <Transition name="flyout">
    <section v-if="currentLayer" class="flyout">
      <header class="flyout-head">{{ currentLayer.label }}</header>
      <div class="flyout-list">
        <button
          v-for="item in currentLayer.items"
          :key="item.id"
          class="lib-item"
          :class="{ active: activeId === `${currentLayer.id}:${item.id}`, 'lib-item-unsupported': item.supported === false }"
          :draggable="item.supported !== false"
          :data-layer="currentLayer.id"
          :data-item-id="item.id"
          :title="item.supported === false ? '该选项暂未支持：生成器没有对应实现' : item.label"
          @dragstart="onDragStart(currentLayer, item, $event)"
          @click="onItemClick(currentLayer, item)"
        >
          <span class="lib-item-name">{{ item.label }}</span>
          <span class="lib-item-tid">{{ shortType(item.typeId) }}</span>
          <span v-if="item.supported === false" class="lib-item-tag">未支持</span>
        </button>
      </div>
    </section>
    </Transition>
  </div>
</template>

<style scoped>
.lib-item-unsupported {
  opacity: 0.45;
  cursor: not-allowed;
}

.lib-item-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid currentColor;
  opacity: 0.8;
}
</style>
