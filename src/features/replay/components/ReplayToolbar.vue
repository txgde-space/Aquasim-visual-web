<script setup lang="ts">
defineProps<{
  isEditMode: boolean
  visualMode: string
  scenePanelOpen?: boolean
}>()

const emit = defineEmits<{
  setInteractionMode: [mode: string]
  'update:visualMode': [mode: string]
  'toggle-scene': []
}>()
</script>

<template>
  <div class="dock dock-top switchbar">
    <div class="view-switch" role="tablist" aria-label="视图模式">
      <span class="view-switch-indicator" :class="{ right: visualMode === '3d' }" aria-hidden="true"></span>
      <button class="view-switch-btn" :class="{ active: visualMode === '2d' }" @click="emit('update:visualMode', '2d')">2D</button>
      <button class="view-switch-btn" :class="{ active: visualMode === '3d' }" @click="emit('update:visualMode', '3d')">3D</button>
    </div>
    <div class="view-switch" role="tablist" aria-label="交互模式">
      <span class="view-switch-indicator" :class="{ right: isEditMode }" aria-hidden="true"></span>
      <button class="view-switch-btn" :class="{ active: !isEditMode }" @click="emit('setInteractionMode', 'replay')">回放</button>
      <button class="view-switch-btn" :class="{ active: isEditMode }" @click="emit('setInteractionMode', 'edit')">编辑</button>
    </div>
    <span v-if="isEditMode && visualMode === '3d'" class="hint-chip">编辑模式仅 2D 可用</span>
    <button class="scene-button" :class="{ active: scenePanelOpen }" :aria-expanded="scenePanelOpen" @click="emit('toggle-scene')">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 8 4-8 4-8-4 8-4Zm-8 8 8 4 8-4M2 14l8 4 8-4" /></svg>场景
    </button>
  </div>
</template>

<style scoped>
.scene-button { display: flex; align-items: center; gap: 7px; align-self: stretch; padding: 0 13px; color: var(--muted); background: transparent; border: 1px solid transparent; border-radius: var(--r-md); cursor: pointer; font: inherit; font-size: 12px; transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out); }
.scene-button.active, .scene-button:hover { color: var(--accent); border-color: var(--line); }
.scene-button svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
</style>
