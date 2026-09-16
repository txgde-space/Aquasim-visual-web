<script setup lang="ts">
import { timeDisplay } from '../lib/format'

defineProps<{
  isPlaying: boolean
  isEditMode: boolean
  visualMode: string
  logPanelOpen: boolean
  currentTime: number
  cycleEndUs: number
}>()

const emit = defineEmits<{
  togglePlay: []
  reset: []
  setInteractionMode: [mode: string]
  'update:visualMode': [mode: string]
  toggleLogPanel: []
}>()
</script>

<template>
  <header class="wb-chrome">
    <div class="wb-chrome-left">
      <button class="btn btn-compact primary" @click="emit('togglePlay')">{{ isPlaying ? '暂停' : '播放' }}</button>
      <button class="btn btn-compact" @click="emit('reset')">重置</button>
      <span class="wb-time">{{ timeDisplay(currentTime) }} / {{ timeDisplay(cycleEndUs) }}</span>
    </div>
    <div class="wb-chrome-right">
      <div class="view-switch" role="tablist" aria-label="交互模式">
        <span class="view-switch-indicator" :class="{ right: isEditMode }" aria-hidden="true"></span>
        <button class="view-switch-btn" :class="{ active: !isEditMode }" @click="emit('setInteractionMode', 'replay')">回放</button>
        <button class="view-switch-btn" :class="{ active: isEditMode }" @click="emit('setInteractionMode', 'edit')">编辑</button>
      </div>
      <div class="view-switch" role="tablist" aria-label="视图模式">
        <span class="view-switch-indicator" :class="{ right: visualMode === '3d' }" aria-hidden="true"></span>
        <button class="view-switch-btn" :class="{ active: visualMode === '2d' }" @click="emit('update:visualMode', '2d')">2D</button>
        <button class="view-switch-btn" :class="{ active: visualMode === '3d' }" @click="emit('update:visualMode', '3d')">3D</button>
      </div>
      <button class="btn btn-compact" @click="emit('toggleLogPanel')">{{ logPanelOpen ? '收起日志' : '日志' }}</button>
    </div>
  </header>
</template>
