<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import type {
  LifecycleGroup,
  LifecycleStage,
  PacketEntry,
  ReplayNode,
} from '@/shared/types/replay'
import { SOUND_SPEED_OPTIONS_MPS, SPEED_OPTIONS } from '@/shared/constants'
import { LOG_SOURCES } from '../lib/sources'
import { timeDisplay } from '../lib/format'
import { receiverPillClass } from '../lib/packetEntries'
import type { PacketSummary } from '../lib/geometry'
import type { PacketTrackTarget } from '../composables/useLogPanel'
import StatsBar from './StatsBar.vue'

const props = defineProps<{
  isPlaying: boolean
  replayMode: string
  speed: number
  logSourceKey: string
  isCustomLog: boolean
  customLogSelectLabel: string
  fxLevel: string
  fxLevelOptions: ReadonlyArray<{ key: string; label: string }>
  isEditMode: boolean
  editSoundSpeed: number
  selectedEditNode: ReplayNode | null
  selectedLifecyclePacketId: string
  lifecyclePacketOptions: ReadonlyArray<{ id: string; label: string; startUs: number }>
  lifecyclePacket: LifecycleGroup | null
  activeLifecycleStage: LifecycleStage | null
  lifecycleStages: LifecycleStage[]
  parseErrors: string[]
  visiblePacketEntries: PacketEntry[]
  currentPacketIds: Set<string>
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
  togglePlay: []
  reset: []
  logFileChange: [event: Event]
  nodeLogFilesChange: [event: Event]
  sampleLogChange: [event: Event]
  speedChange: [event: Event]
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

const openLogFilePicker = () => {
  logFileInput.value?.click()
}

const openNodeLogFilePicker = () => {
  nodeLogFileInput.value?.click()
}

const scrollLogItemIntoView = (listEl: HTMLElement | null, eventId: string | null) => {
  if (!listEl || !eventId) return
  const target = [...listEl.querySelectorAll<HTMLElement>('.log-item')]
    .find((item) => item.dataset.eventId === eventId)
  if (!target) return

  const listRect = listEl.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const outOfViewTop = targetRect.top < listRect.top
  const outOfViewBottom = targetRect.bottom > listRect.bottom
  if (!outOfViewTop && !outOfViewBottom) return

  target.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: props.isPlaying ? 'smooth' : 'auto',
  })
}

watch([() => props.replayMode, () => props.globalActiveEventId], async ([mode, eventId], [prevMode, prevEventId]) => {
  if (mode !== 'global' || !eventId) return
  if (mode === prevMode && eventId === prevEventId) return
  await nextTick()
  scrollLogItemIntoView(globalLogListEl.value, eventId)
})

watch([() => props.replayMode, () => props.lifecycleActiveEventId], async ([mode, eventId], [prevMode, prevEventId]) => {
  if (mode !== 'lifecycle' || !eventId) return
  if (mode === prevMode && eventId === prevEventId) return
  await nextTick()
  scrollLogItemIntoView(lifecycleLogListEl.value, eventId)
})
</script>

<template>
  <aside class="wb-inspect card log">
    <div class="side-controls">
      <div class="control-actions">
        <div class="control-btn-row">
          <button class="btn btn-compact primary" @click="emit('togglePlay')">{{ isPlaying ? '暂停' : '播放' }}</button>
          <button class="btn btn-compact" @click="emit('reset')">重置</button>
          <button class="btn btn-compact" @click="openLogFilePicker">导入全局日志</button>
          <button class="btn btn-compact" @click="openNodeLogFilePicker">导入节点日志</button>
          <button
            v-if="replayMode === 'global'"
            class="btn btn-compact btn-wide"
            :class="{ active: showAllActivePackets }"
            @click="toggleShowAllActive"
          >
            {{ showAllActivePackets ? '显示全部活跃传播' : '仅显示聚焦/当前包' }}
          </button>
        </div>
        <div class="control-fields-grid">
          <label class="field field-compact">
            <div class="field-head"><span>倍速</span></div>
            <select class="select" :value="speed" @change="emit('speedChange', $event)">
              <option v-for="option in SPEED_OPTIONS" :key="option" :value="option">{{ option }}x</option>
            </select>
          </label>
          <label class="field field-compact">
            <div class="field-head">
              <span>示例日志</span>
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
          <label class="field field-compact">
            <div class="field-head"><span>回放模式</span></div>
            <select class="select" :value="replayMode" @change="emit('replayModeChange', $event)">
              <option value="global">全局模式</option>
              <option value="lifecycle">生命周期模式</option>
            </select>
          </label>
          <label v-if="isEditMode" class="field field-compact">
            <div class="field-head"><span>声速</span></div>
            <select class="select" :value="String(editSoundSpeed)" @change="emit('editSoundSpeedChange', $event)">
              <option v-for="option in SOUND_SPEED_OPTIONS_MPS" :key="option" :value="option">{{ option }} m/s</option>
            </select>
          </label>
          <label class="field field-compact">
            <div class="field-head"><span>可视化质量</span></div>
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
          <div v-if="isEditMode && selectedEditNode" class="field field-compact field-span-2">
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
            <div class="control-btn-row coord-actions">
              <button class="btn btn-compact" @click="emit('restoreSelected')">恢复该点</button>
              <button class="btn btn-compact" @click="emit('restoreAll')">恢复全部</button>
            </div>
          </div>
          <label v-if="replayMode === 'lifecycle'" class="field field-compact field-span-2">
            <span>选择包</span>
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
    </div>
    <div class="card-title">{{ isEditMode ? '推演' : (replayMode === 'lifecycle' ? '生命周期' : '日志') }}</div>

    <div v-if="replayMode === 'lifecycle'" class="lifecycle-panel">
      <div v-if="lifecyclePacket" class="lifecycle-summary">
        <div>当前包：<strong>{{ lifecyclePacket.packet_id }}</strong></div>
        <div>源节点：{{ lifecyclePacket.sourceLabel }}</div>
        <div>生命周期：{{ timeDisplay(lifecyclePacket.startUs) }} - {{ timeDisplay(lifecyclePacket.endUs) }}</div>
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
            <div class="event-band" :style="{ width: `${stage.progressPct}%` }" aria-hidden="true"></div>
          </div>
          <div class="log-content">
            <div class="log-head">
              <span class="time">{{ timeDisplay(stage.startUs) }}</span>
              <span class="tag" :class="stage.status === 'ok' ? 'tag-ok' : (stage.status === 'rxrx' || stage.status === 'fail' ? 'tag-fail' : 'tag-mixed')">
                {{ stage.type.toUpperCase() }}
              </span>
              <span class="duration">时长 {{ timeDisplay(stage.endUs - stage.startUs) }}</span>
              <span class="packet-title">{{ stage.title }}</span>
            </div>
            <div class="packet-hint">{{ stage.detail }}</div>
          </div>
        </li>
      </ul>
    </div>

    <ul v-if="replayMode === 'global'" ref="globalLogListEl" class="log-list">
      <li v-if="parseErrors.length" class="log-item parse-error">
        日志解析失败：{{ parseErrors.length }} 条
      </li>
      <li v-if="visiblePacketEntries.length === 0" class="log-item empty">
        暂无日志...
      </li>
      <li
        v-for="packet in visiblePacketEntries"
        :key="packet.eventId"
        class="log-item"
        :data-event-id="packet.eventId"
        :class="{
          'log-item-active': currentPacketIds.has(packet.eventId),
          'log-item-focused': focusedPacketId === packet.eventId,
        }"
        @click="emit('logSelect', packet)"
      >
        <div class="event-track" @pointerdown="emit('trackPointerDown', packet, $event)">
          <div class="event-band" :style="{ width: `${packet.progressPct}%` }" aria-hidden="true"></div>
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
    </ul>

    <StatsBar :summary="summary" :original-summary="originalSummary" :is-edit-mode="isEditMode" />
  </aside>
</template>
