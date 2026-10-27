<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import type {
  LifecycleGroup,
  LifecycleStage,
  PacketEntry,
  ReplayNode,
} from '@/shared/types/replay'
import { DEFAULT_RADIO_PROPAGATION_SPEED_MPS, SOUND_SPEED_OPTIONS_MPS } from '@/shared/constants'
import { LOG_SOURCES } from '../lib/sources'
import { timeDisplay } from '../lib/format'
import { receiverPillClass } from '../lib/packetEntries'
import type { PacketSummary } from '../lib/geometry'
import type { PacketTrackTarget } from '../composables/useLogPanel'
import { usePacketListProgress } from '../composables/usePacketListProgress'
import { useVirtualLogList } from '../composables/useVirtualLogList'
import StatsBar from './StatsBar.vue'

const props = defineProps<{
  panelActive: boolean
  currentTime: number
  isPlaying: boolean
  replayMode: string
  logSourceKey: string
  isCustomLog: boolean
  customLogSelectLabel: string
  fxLevel: string
  fxLevelOptions: ReadonlyArray<{ key: string; label: string }>
  isEditMode: boolean
  fractionalTiming?: boolean
  successTraceOnly?: boolean
  editSoundSpeed: number
  selectedEditNode: ReplayNode | null
  selectedEditNodeCount: number
  selectedLifecyclePacketId: string
  lifecyclePacketOptions: ReadonlyArray<{ id: string; label: string; startUs: number }>
  lifecyclePacket: LifecycleGroup | null
  activeLifecycleStage: LifecycleStage | null
  lifecycleStages: LifecycleStage[]
  parseErrors: string[]
  visiblePacketEntries: PacketEntry[]
  focusedPacketId: string | null
  summary: PacketSummary
  originalSummary: PacketSummary
  globalActiveEventId: string | null
  lifecycleActiveEventId: string | null
}>()

const showAllActivePackets = defineModel<boolean>('showAllActivePackets', { required: true })

const toggleShowAllActive = () => {
  showAllActivePackets.value = !showAllActivePackets.value
}

const emit = defineEmits<{
  logFileChange: [event: Event]
  nodeLogFilesChange: [event: Event]
  sampleLogChange: [event: Event]
  replayModeChange: [event: Event]
  editSoundSpeedChange: [event: Event]
  fxLevelChange: [event: Event]
  coordChange: [axis: 'x' | 'y' | 'z', event: Event]
  restoreSelected: []
  restoreAll: []
  lifecyclePacketChange: [event: Event]
  logSelect: [packet: PacketEntry]
  stageSelect: [stage: LifecycleStage]
  trackPointerDown: [packet: PacketTrackTarget, event: Event]
}>()

const logFileInput = useTemplateRef<HTMLInputElement>('logFileInput')
const nodeLogFileInput = useTemplateRef<HTMLInputElement>('nodeLogFileInput')
const globalLogListEl = useTemplateRef<HTMLElement>('globalLogListEl')
const lifecycleLogListEl = useTemplateRef<HTMLElement>('lifecycleLogListEl')

const globalList = useVirtualLogList({
  list: globalLogListEl,
  getItems: () => props.visiblePacketEntries,
  isActive: () => props.panelActive && props.replayMode === 'global',
})
const { windowItems, startIndex, topPadding, bottomPadding, virtual: virtualGlobalList } = globalList
const packetIndexByEventId = computed(() => {
  const indexes = new Map<string, number>()
  props.visiblePacketEntries.forEach((packet, index) => {
    if (!indexes.has(packet.eventId)) indexes.set(packet.eventId, index)
  })
  return indexes
})

usePacketListProgress({
  list: globalLogListEl,
  getPackets: () => windowItems.value,
  getTime: () => props.currentTime,
  isActive: () => props.panelActive,
  getFocus: () => props.focusedPacketId,
  isEditMode: () => props.isEditMode,
  fractionalTiming: () => !!props.fractionalTiming,
})

const openLogFilePicker = () => {
  logFileInput.value?.click()
}

const openNodeLogFilePicker = () => {
  nodeLogFileInput.value?.click()
}

const scrollLogItemIntoView = (listEl: HTMLElement | null, eventId: string | null) => {
  if (!listEl || !eventId) return
  const target = listEl.querySelector<HTMLElement>(`.log-item[data-event-id="${CSS.escape(eventId)}"]`)
  if (!target) return

  const listRect = listEl.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const outOfViewTop = targetRect.top < listRect.top
  const outOfViewBottom = targetRect.bottom > listRect.bottom
  if (!outOfViewTop && !outOfViewBottom) return

  /* 不能用 scrollIntoView：抽屉收起时面板被 transform 移出屏幕，scrollIntoView
     会横向滚动 overflow:hidden 的祖先（.deck），把收起的抽屉“拖”回可视区。
     这里只垂直滚动日志列表自身，不触碰任何祖先容器 */
  const nextTop = outOfViewTop
    ? listEl.scrollTop - (listRect.top - targetRect.top)
    : listEl.scrollTop + (targetRect.bottom - listRect.bottom)
  listEl.scrollTo({
    top: nextTop,
    behavior: props.isPlaying ? 'smooth' : 'auto',
  })
}

watch([() => props.panelActive, () => props.replayMode, () => props.globalActiveEventId], async ([active, mode, eventId]) => {
  if (!active || mode !== 'global' || !eventId) return
  await nextTick()
  if (virtualGlobalList.value) {
    await globalList.ensureVisible(packetIndexByEventId.value.get(eventId) ?? -1)
    return
  }
  scrollLogItemIntoView(globalLogListEl.value, eventId)
})

watch([() => props.panelActive, () => props.replayMode, () => props.lifecycleActiveEventId], async ([active, mode, eventId]) => {
  if (!active || mode !== 'lifecycle' || !eventId) return
  await nextTick()
  scrollLogItemIntoView(lifecycleLogListEl.value, eventId)
})
</script>

<template>
  <aside class="log-panel">
    <div class="side-controls">
      <details class="panel-section" open>
        <summary>设置</summary>
        <div class="control-btn-row">
          <button class="btn btn-compact" @click="openLogFilePicker">导入全局日志</button>
          <button class="btn btn-compact" @click="openNodeLogFilePicker">导入节点日志</button>
        </div>
        <label class="field field-compact">
          <div class="field-head">
            <span>日志来源</span>
            <span v-if="isCustomLog" class="field-chip">已导入</span>
          </div>
          <select class="select" :value="logSourceKey" @change="emit('sampleLogChange', $event)">
            <option v-if="isCustomLog" :value="logSourceKey" disabled>{{ customLogSelectLabel }}</option>
            <option
              v-for="[key, source] in Object.entries(LOG_SOURCES)"
              :key="key"
              :value="key"
            >
              {{ source.label }}
            </option>
          </select>
        </label>
        <p v-if="successTraceOnly" class="trace-scope">仅记录物理层发送与成功接收，不含丢包原因。</p>
        <div class="control-fields-grid">
          <label class="field field-compact">
            <div class="field-head"><span>回放模式</span></div>
            <select class="select" :value="replayMode" @change="emit('replayModeChange', $event)">
              <option value="global">全局</option>
              <option value="lifecycle">单包生命周期</option>
            </select>
          </label>
          <label class="field field-compact">
            <div class="field-head"><span>渲染质量</span></div>
            <select class="select" :value="fxLevel" @change="emit('fxLevelChange', $event)">
              <option
                v-for="item in fxLevelOptions"
                :key="item.key"
                :value="item.key"
              >
                {{ item.label }}
              </option>
            </select>
          </label>
          <label v-if="isEditMode" class="field field-compact">
            <div class="field-head"><span>{{ fractionalTiming ? '传播速度' : '声速' }}</span><span v-if="fractionalTiming" class="field-param">m/s</span></div>
            <input v-if="fractionalTiming" class="select" type="number" min="1" :max="DEFAULT_RADIO_PROPAGATION_SPEED_MPS" step="any"
              :value="editSoundSpeed" @change="emit('editSoundSpeedChange', $event)" />
            <select v-else class="select" :value="String(editSoundSpeed)" @change="emit('editSoundSpeedChange', $event)">
              <option v-if="!SOUND_SPEED_OPTIONS_MPS.includes(editSoundSpeed)" :value="editSoundSpeed">{{ editSoundSpeed }} m/s</option>
              <option v-for="option in SOUND_SPEED_OPTIONS_MPS" :key="option" :value="option">{{ option }} m/s</option>
            </select>
          </label>
          <label v-if="replayMode === 'lifecycle'" class="field field-compact field-span-2">
            <span>选择数据包</span>
            <select class="select" :value="selectedLifecyclePacketId" @change="emit('lifecyclePacketChange', $event)">
              <option
                v-for="packet in lifecyclePacketOptions"
                :key="packet.id"
                :value="packet.id"
              >
                {{ packet.label }}
              </option>
            </select>
          </label>
        </div>
        <button
          v-if="replayMode === 'global'"
          class="btn btn-compact btn-wide"
          :class="{ active: showAllActivePackets }"
          @click="toggleShowAllActive"
        >
          {{ showAllActivePackets ? '显示全部传播' : '仅显示聚焦包' }}
        </button>
      </details>
      <details v-if="isEditMode" class="panel-section" open>
        <summary>节点编辑 · 已选 {{ selectedEditNodeCount }} 个</summary>
        <div v-if="selectedEditNode" class="field field-compact">
          <div class="field-head"><span>{{ selectedEditNode.name }}（{{ selectedEditNode.node_id }}）</span></div>
          <div class="coord-grid">
            <label class="field field-compact">
              <div class="field-head"><span>X (m)</span></div>
              <input class="select" type="number" step="0.01" :value="selectedEditNode.x.toFixed(2)" @change="emit('coordChange', 'x', $event)" />
            </label>
            <label class="field field-compact">
              <div class="field-head"><span>Y (m)</span></div>
              <input class="select" type="number" step="0.01" :value="selectedEditNode.y.toFixed(2)" @change="emit('coordChange', 'y', $event)" />
            </label>
            <label class="field field-compact">
              <div class="field-head"><span>Z (m)</span></div>
              <input class="select" type="number" step="0.01" :value="(selectedEditNode.z ?? 0).toFixed(2)" @change="emit('coordChange', 'z', $event)" />
            </label>
          </div>
        </div>
        <p v-else class="edit-selection-hint">{{ selectedEditNodeCount ? '拖动任一选中节点可整体移动；单独选择一个节点可编辑坐标。' : '单击节点选择；按住 Shift 点击或框选可追加选择。' }}</p>
        <div class="control-btn-row coord-actions">
          <button class="btn btn-compact" :disabled="!selectedEditNodeCount" @click="emit('restoreSelected')">{{ selectedEditNodeCount === 1 ? '恢复该点' : '恢复选中' }}</button>
          <button class="btn btn-compact" @click="emit('restoreAll')">恢复全部</button>
        </div>
      </details>
      <input
        ref="logFileInput"
        class="hidden-file-input"
        type="file"
        accept=".log,.jsonl,.json,.txt,application/json,text/plain"
        @change="emit('logFileChange', $event)"
      />
      <input
        ref="nodeLogFileInput"
        class="hidden-file-input"
        type="file"
        multiple
        accept=".log,.jsonl,.json,.txt,application/json,text/plain"
        @change="emit('nodeLogFilesChange', $event)"
      />
    </div>
    <div class="card-title">{{ isEditMode ? '推演' : (replayMode === 'lifecycle' ? '生命周期' : '日志') }}</div>

    <div
      v-if="replayMode === 'lifecycle'"
      v-memo="[panelActive, lifecyclePacket, panelActive ? lifecycleStages : null]"
      class="lifecycle-panel"
    >
      <div v-if="lifecyclePacket" class="lifecycle-summary">
        <div>当前包：<strong>{{ lifecyclePacket.packet_id }}</strong></div>
        <div>源节点：{{ lifecyclePacket.sourceLabel }}</div>
        <div>生命周期：{{ timeDisplay(lifecyclePacket.startUs, fractionalTiming) }} - {{ timeDisplay(lifecyclePacket.endUs, fractionalTiming) }}</div>
        <div>当前阶段：{{ activeLifecycleStage ? activeLifecycleStage.title : '无' }}</div>
      </div>

      <ul ref="lifecycleLogListEl" class="log-list lifecycle-list">
        <li v-if="!lifecycleStages.length" class="log-item empty">暂无阶段数据</li>
        <li
          v-for="stage in lifecycleStages"
          :key="stage.eventId"
          class="log-item"
          :data-event-id="stage.eventId"
          :class="{ 'log-item-active': stage.active }"
          @click="emit('stageSelect', stage)"
        >
          <div
            class="event-track"
            @pointerdown="emit('trackPointerDown', { ...(lifecyclePacket ?? {}), eventId: stage.eventId, packet_id: stage.eventId, startUs: stage.startUs, endUs: stage.endUs }, $event)"
          >
            <div class="event-band" :style="{ transform: `scaleX(${stage.progressPct / 100})` }" aria-hidden="true"></div>
          </div>
          <div class="log-content">
            <div class="log-head">
              <span class="time">{{ timeDisplay(stage.startUs, fractionalTiming) }}</span>
              <span class="tag" :class="stage.status === 'ok' ? 'tag-ok' : (stage.status === 'rxrx' || stage.status === 'fail' ? 'tag-fail' : 'tag-mixed')">
                {{ stage.type.toUpperCase() }}
              </span>
              <span class="duration">时长 {{ timeDisplay(stage.endUs - stage.startUs, fractionalTiming) }}</span>
              <span class="packet-title">{{ stage.title }}</span>
            </div>
            <div class="packet-hint">{{ stage.detail }}</div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Labels and receiver details stay cached during playback. The progress
         effect updates only time-dependent rows and catches up when reopened. -->
    <ul
      v-if="replayMode === 'global'"
      ref="globalLogListEl"
      v-memo="[windowItems, topPadding, bottomPadding, startIndex, parseErrors, logSourceKey, isEditMode, focusedPacketId]"
      class="log-list"
    >
      <li v-if="parseErrors.length" class="log-item parse-error">
        日志解析失败：{{ parseErrors.length }} 条
      </li>
      <li v-if="visiblePacketEntries.length === 0" class="log-item empty">
        {{ logSourceKey === 'topology' ? '仅导入了实验拓扑，尚无发包记录。请在实验页运行仿真后查看回放。' : '暂无日志...' }}
      </li>
      <li v-if="topPadding" class="log-spacer" :style="{ height: `${topPadding}px` }" aria-hidden="true"></li>
      <li
        v-for="(packet, index) in windowItems"
        :key="packet.eventId"
        class="log-item"
        :data-event-id="packet.eventId"
        :data-virtual-index="startIndex + index"
        :aria-posinset="virtualGlobalList ? startIndex + index + 1 : undefined"
        :aria-setsize="virtualGlobalList ? visiblePacketEntries.length : undefined"
        :class="{
          'log-item-focused': focusedPacketId === packet.eventId,
        }"
        @click="emit('logSelect', packet)"
      >
        <div class="event-track" @pointerdown="emit('trackPointerDown', packet, $event)">
          <div class="event-band" aria-hidden="true"></div>
        </div>

        <div class="log-content">
          <div class="log-head">
            <span class="time">{{ packet.prettyTime }}</span>
            <span class="tag" :class="packet.packetKindClass">{{ packet.packetKindLabel }}</span>
            <span v-if="isEditMode && packet.simulated" class="tag tag-sim">推演</span>
            <span v-if="packet.timingWarn" class="tag tag-mixed">时序早于到达</span>
            <span class="duration">总历时 {{ packet.packetDurationLabel }}</span>
            <span class="packet-title">{{ packet.packet_id }} {{ packet.sourceLabel }} {{ packet.tx_committed ? '发射' : '尝试发送' }}（段 {{ packet.eventId }}）</span>
            <span class="packet-hint">{{ packet.outcomeSummary }}</span>
          </div>

          <div class="receiver-strip">
            <span
              v-if="!packet.tx_committed"
              class="receiver-pill receiver-pill-fail"
            >
              <span class="receiver-name">未发出</span>
              <span class="receiver-reason">{{ packet.blockedReasonText }}</span>
            </span>
            <span
              v-for="receiver in packet.receivers"
              :key="receiver.receiver_id"
              class="receiver-pill"
              :class="receiverPillClass(receiver)"
            >
              <span class="receiver-name">{{ receiver.dstLabel }}</span>
              <span class="receiver-reason">{{ receiver.reasonLabel }}</span>
              <span v-if="receiver.originalChanged" class="receiver-reason">原 {{ receiver.originalReasonLabel }}</span>
            </span>
          </div>
        </div>
      </li>
      <li v-if="bottomPadding" class="log-spacer" :style="{ height: `${bottomPadding}px` }" aria-hidden="true"></li>
    </ul>

    <StatsBar :summary="summary" :original-summary="originalSummary" :is-edit-mode="isEditMode" />
  </aside>
</template>

<style scoped>
.trace-scope { margin: 6px 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.edit-selection-hint { margin: 8px 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
.log-spacer {
  padding: 0;
  margin: 0;
  border: 0;
  pointer-events: none;
  list-style: none;
}
</style>
