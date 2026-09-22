<script setup>
import { computed, ref } from 'vue'
import { AQUA_ITEM_MIME, TYPEID_LAYERS } from '@/features/experiment/lib/typeIdCatalog'

const props = defineProps({
  layers: { type: Array, default: () => TYPEID_LAYERS },
  ready: { type: Boolean, default: false },
  activeId: { type: String, default: '' },
  appliedProtocols: { type: Array, default: () => [] },
})

const emit = defineEmits(['assign'])

const openLayer = ref('mac')

const toggleLayer = (id) => {
  openLayer.value = openLayer.value === id ? '' : id
}

const currentLayer = computed(() => props.layers.find((layer) => layer.id === openLayer.value) || null)

const onDragStart = (layer, item, event) => {
  if (!props.ready) {
    event.preventDefault()
    return
  }
  const payload = JSON.stringify({
    layer: layer.id,
    id: item.id,
    typeId: item.typeId,
    field: item.field || layer.field,
    scope: layer.scope || 'node',
  })
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(AQUA_ITEM_MIME, payload)
  event.dataTransfer.setData('text/plain', payload)
}

const onItemClick = (layer, item) => {
  if (!props.ready) return
  emit('assign', { layer: layer.id, id: item.id, typeId: item.typeId, field: item.field || layer.field, scope: layer.scope || 'node' })
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
  <div class="protocol-drawer">
    <section class="protocol-library" aria-label="协议库">
      <h2 class="drawer-heading">协议库</h2>
      <div class="rail-wrap">
        <nav class="rail" aria-label="协议层">
          <button
            v-for="layer in layers"
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
          <p v-if="!ready" class="catalog-hint">请先预编译，读取此目录实际注册的协议。</p>
          <div class="flyout-list">
            <button
              v-for="item in currentLayer.items"
              :key="item.id"
              class="lib-item"
              :class="{ active: activeId === `${currentLayer.id}:${item.id}` }"
              :draggable="ready"
              :disabled="!ready"
              :data-layer="currentLayer.id"
              :data-item-id="item.id"
              :title="item.requirement || item.label"
              @dragstart="onDragStart(currentLayer, item, $event)"
              @click="onItemClick(currentLayer, item)"
            >
              <span class="lib-item-name">{{ item.label }}</span>
              <span class="lib-item-tid">{{ shortType(item.typeId) }}</span>

            </button>
          </div>
        </section>
        </Transition>
      </div>
    </section>
    <section class="applied-protocols" aria-label="已应用协议">
      <h2 class="drawer-heading">已应用协议</h2>
      <div class="applied-scroll">
        <ol class="stack-list">
          <li v-for="row in appliedProtocols" :key="row.key" class="stack-row">
            <details class="stack-details">
              <summary class="stack-summary">
                <span class="stack-heading">
                  <span class="stack-layer">{{ row.layer }}</span>
                  <span class="stack-name" :title="row.name">{{ row.name }}</span>
                </span>
              </summary>
              <div class="stack-content">
                <span class="stack-tid" :title="row.typeId">{{ row.typeId }}</span>
                <span v-if="row.source" class="stack-src">{{ row.source }}</span>
                <slot name="protocol-settings" :layer-id="row.key" />
              </div>
            </details>
          </li>
        </ol>
      </div>
    </section>
  </div>
</template>

<style scoped>
.catalog-hint { padding: 10px; font-size: 11px; color: var(--muted); line-height: 1.5; }
.protocol-drawer {
  display: flex;
  flex-direction: column;
  width: 254px;
  height: calc(100vh - var(--topbar-h) - var(--statusbar-h) - 88px);
  min-height: 0;
  overflow: hidden;
  border-radius: inherit;
}
.drawer-heading {
  flex: none;
  margin: 0;
  padding: 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  border-bottom: 1px solid var(--line);
}
.protocol-library { display: flex; flex-direction: column; flex: 0 1 280px; min-height: 170px; }
.rail-wrap { flex: 1; height: auto; }
.rail { overflow-y: auto; }
.rail-btn { flex-shrink: 0; }
.flyout { flex: 1; width: auto; height: auto; min-width: 0; }
.applied-protocols { display: flex; flex-direction: column; flex: 1; min-height: 100px; border-top: 1px solid var(--line); }
.applied-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 12px 12px; overscroll-behavior: contain; }
.stack-list {
  margin: 0;
  padding: 0 0 0 0.65rem;
  display: flex;
  flex-direction: column;
  border-left: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
}
.stack-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  padding: 0.4rem 0 0.4rem 0.8rem;
}
.stack-row::before {
  content: "";
  position: absolute;
  left: -3.5px;
  top: 0.68rem;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--panel-solid);
}
.stack-layer {
  color: var(--faint);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.stack-details { min-width: 0; }
.stack-summary { display: flex; align-items: center; gap: 8px; cursor: pointer; list-style: none; }
.stack-summary::-webkit-details-marker { display: none; }
.stack-summary::after {
  content: "";
  flex: none;
  width: 6px;
  height: 6px;
  margin-right: 3px;
  border-right: 1px solid var(--muted);
  border-bottom: 1px solid var(--muted);
  transform: rotate(-45deg);
  transition: transform var(--dur-fast) var(--ease-out);
}
.stack-details[open] > .stack-summary::after { transform: rotate(45deg); }
.stack-summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 3px; }
.stack-heading { display: grid; flex: 1; min-width: 0; gap: 2px; }
.stack-content { display: grid; gap: 6px; padding-top: 8px; }
.stack-name {
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  white-space: normal;
  overflow-wrap: anywhere;
}
.stack-tid {
  color: var(--muted);
  font-size: 0.66rem;
  font-family: var(--font-mono);
  min-width: 0;
  overflow: hidden;
  white-space: normal;
  overflow-wrap: anywhere;
}
.stack-src {
  color: var(--faint);
  font-size: 0.62rem;
  font-family: var(--font-mono);
  white-space: pre-line;
  word-break: break-all;
}
</style>
