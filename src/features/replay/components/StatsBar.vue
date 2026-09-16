<script setup lang="ts">
import type { PacketSummary } from '../lib/geometry'

defineProps<{
  summary: PacketSummary
  originalSummary: PacketSummary
  isEditMode: boolean
}>()
</script>

<template>
  <div class="stat-grid">
    <div>记录总数：{{ summary.packetCount }}</div>
    <div>真正发射：{{ summary.committedPacketCount }}</div>
    <div>发送阻塞：{{ summary.blockedPacketCount }}</div>
    <div>成功接收：{{ summary.okReceivers }}<span v-if="isEditMode" class="stat-compare"> / 原 {{ originalSummary.okReceivers }}</span></div>
    <div>rx-rx 冲突：{{ summary.rxrxCollisions }}<span v-if="isEditMode" class="stat-compare"> / 原 {{ originalSummary.rxrxCollisions }}</span></div>
    <div>rx-tx 冲突：{{ summary.rxtxCollisions }}<span v-if="isEditMode" class="stat-compare"> / 原 {{ originalSummary.rxtxCollisions }}</span></div>
  </div>
</template>
