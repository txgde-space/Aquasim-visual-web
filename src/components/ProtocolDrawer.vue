<script setup>
import { computed, ref } from 'vue'
import { AQUA_ITEM_MIME, TYPEID_LAYERS } from '../typeIdCatalog.js'

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
    <section v-if="currentLayer" class="flyout">
      <header class="flyout-head">{{ currentLayer.label }}</header>
      <div class="flyout-list">
        <button
          v-for="item in currentLayer.items"
          :key="item.id"
          class="lib-item"
          :class="{ active: activeId === `${currentLayer.id}:${item.id}` }"
          draggable="true"
          :data-layer="currentLayer.id"
          :data-item-id="item.id"
          @dragstart="onDragStart(currentLayer, item, $event)"
          @click="emit('assign', { layer: currentLayer.id, id: item.id, typeId: item.typeId, field: currentLayer.field, scope: currentLayer.scope || 'node' })"
        >
          <span class="lib-item-name">{{ item.label }}</span>
          <span class="lib-item-tid">{{ shortType(item.typeId) }}</span>
        </button>
      </div>
    </section>
  </div>
</template>
