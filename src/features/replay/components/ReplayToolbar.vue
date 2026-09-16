<script setup lang="ts">
defineProps<{
  isEditMode: boolean
  visualMode: string
  logPanelOpen: boolean
}>()

const emit = defineEmits<{
  setInteractionMode: [mode: string]
  'update:visualMode': [mode: string]
  toggleLogPanel: []
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
    <span class="cmd-sep" aria-hidden="true"></span>
    <button class="btn btn-compact" :class="{ active: logPanelOpen }" @click="emit('toggleLogPanel')">日志</button>
  </div>
</template>
