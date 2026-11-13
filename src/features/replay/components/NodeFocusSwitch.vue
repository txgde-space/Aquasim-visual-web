<script setup lang="ts">
const props = defineProps<{ nodeId: number }>()
const focusedNodeId = defineModel<number | null>({ required: true })
const onChange = (event: Event) => {
  focusedNodeId.value = (event.target as HTMLInputElement).checked ? props.nodeId : null
}
</script>

<template>
  <label class="node-focus-toggle">
    <span>关注节点</span>
    <input type="checkbox" role="switch" aria-label="关注节点" :checked="focusedNodeId === nodeId" @change="onChange" />
  </label>
</template>

<style scoped>
.node-focus-toggle { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--text); font-size: 12px; font-weight: 600; cursor: pointer; }
input { appearance: none; position: relative; flex: 0 0 30px; width: 30px; height: 18px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--sunken); cursor: pointer; transition: background var(--dur-fast) var(--ease-out); }
input::after { content: ''; position: absolute; width: 12px; height: 12px; border-radius: 50%; background: var(--muted); top: 2px; left: 2px; transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out); }
input:checked { background: color-mix(in srgb, var(--accent) 25%, var(--sunken)); border-color: var(--accent); }
input:checked::after { transform: translateX(12px); background: var(--accent); }
input:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
</style>
