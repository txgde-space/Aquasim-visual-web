<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import NodeCanvas from '../components/NodeCanvas.vue'
import { session } from '../shared/sessionStore'
import {
  LOCAL_STORAGE_KEYS,
  MIN_SIM_TIME_US,
  SOUND_SPEED_OPTIONS_MPS,
  SPEED_OPTIONS,
} from '../shared/constants'
import { LOG_SOURCES } from '@/features/replay/lib/sources'
import { timeDisplay } from '@/features/replay/lib/format'
import { receiverPillClass } from '@/features/replay/lib/packetEntries'
import { parseLog } from '@/features/replay/lib/logParser'
import { usePlaybackEngine } from '@/features/replay/composables/usePlaybackEngine'
import { useReplayState } from '@/features/replay/composables/useReplayState'
import { useLogPanel } from '@/features/replay/composables/useLogPanel'
import { cloneNode, useEditMode } from '@/features/replay/composables/useEditMode'
import { useLogImport } from '@/features/replay/composables/useLogImport'

const NodeScene3D = defineAsyncComponent(() => import('../components/NodeScene3D.vue'))

const FX_LEVEL_OPTIONS = Object.freeze([
  { key: 'standard', label: '标准' },
  { key: 'extreme', label: '增强' },
])

let getCycleEndUs = () => MIN_SIM_TIME_US
const playback = usePlaybackEngine({ getCycleEndUs })
const state = useReplayState({ playback })
getCycleEndUs = () => state.cycleEndUs.value

const logFileInput = useTemplateRef<HTMLInputElement>('logFileInput')
const nodeLogFileInput = useTemplateRef<HTMLInputElement>('nodeLogFileInput')
const globalLogListEl = useTemplateRef<HTMLElement>('globalLogListEl')
const lifecycleLogListEl = useTemplateRef<HTMLElement>('lifecycleLogListEl')

const panel = useLogPanel({ state, playback, globalLogListEl, lifecycleLogListEl })
const editMode = useEditMode({
  state,
  playback,
  onEnterEdit: () => {
    panel.visualMode.value = '2d'
  },
})
const logImport = useLogImport({
  state,
  applyParsedLog: (parsed) => state.applyParsedLog(parsed, editMode.exitEditMode),
  logFileInput,
  nodeLogFileInput,
})

const {
  currentTime,
  isPlaying,
  speed,
  focusedPacketId,
  rangeProgressStyle,
  togglePlay,
  pauseForTool,
  reset,
  onJump,
  onSpeed,
} = playback

const {
  logSourceKey,
  uploadedLogName,
  selectedTheme,
  fxLevel,
  replayMode,
  selectedLifecyclePacketId,
  showAllActivePackets,
  editSoundSpeed,
  baseNodesState,
  nodeMovementRows,
  parseErrors,
  cycleEndUs,
  nodesState,
  nodeVisuals,
  displayPackets,
  isEditMode,
  isCustomLog,
  customLogSelectLabel,
  selectedEditNode,
  originalEditPositions,
  selectedEditNodeId,
  lifecyclePacketOptions,
  lifecyclePacket,
  lifecycleStages,
  activeLifecycleStage,
  visiblePacketEntries,
  currentPacketIds,
  summary,
  originalSummary,
} = state

const {
  logPanelOpen,
  visualMode,
  onReplayModeChange,
  onLifecyclePacketChange,
  onKeydown,
  onLogSelect,
  onLifecycleStageSelect,
  onEventTrackPointerDown,
  onGlobalPointerMove,
  onGlobalPointerUp,
} = panel

const {
  openLogFilePicker,
  openNodeLogFilePicker,
  onSampleLogChange,
  onLogFileChange,
  onNodeLogFilesChange,
} = logImport

const {
  setInteractionMode,
  onEditNodeMove,
  onEditNodeMoveEnd,
  onEditNodeSelect,
  restoreSelectedEditNode,
  restoreAllEditNodes,
  onEditSoundSpeedChange,
  onEditCoordChange,
} = editMode

const onFxLevelChange = (event: Event) => {
  fxLevel.value = (event.target as HTMLSelectElement).value
}

watch(nodesState, (nodes) => {
  if (isEditMode.value) return
  session.replayNodes = (nodes || []).map(cloneNode)
}, { deep: true })

onMounted(() => {
  if (typeof session.pendingReplayLog === 'string' && session.pendingReplayLog.length) {
    logSourceKey.value = 'upload'
    uploadedLogName.value = session.pendingReplayName || 'ns3.log'
    state.applyParsedLog(parseLog(session.pendingReplayLog), editMode.exitEditMode)
    session.pendingReplayLog = null
    session.pendingReplayName = ''
  }
  if (Array.isArray(session.pendingReplayApply) && session.pendingReplayApply.length) {
    baseNodesState.value = session.pendingReplayApply.map(cloneNode)
    nodeMovementRows.value = []
    session.pendingReplayApply = null
    session.replayNodes = baseNodesState.value.map(cloneNode)
  }
  try {
    const savedFx = localStorage.getItem(LOCAL_STORAGE_KEYS.fxLevel)
    if (savedFx && FX_LEVEL_OPTIONS.some((item) => item.key === savedFx)) {
      fxLevel.value = savedFx
    }
  } catch {
    // ignore persistence errors
  }

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('pointermove', onGlobalPointerMove)
  window.addEventListener('pointerup', onGlobalPointerUp)
  window.addEventListener('pointercancel', onGlobalPointerUp)
})

onBeforeUnmount(() => {
  playback.dispose()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onGlobalPointerMove)
  window.removeEventListener('pointerup', onGlobalPointerUp)
  window.removeEventListener('pointercancel', onGlobalPointerUp)
})
</script>

<template>
  <div class="wb replay-wb" :class="{ 'wb-inspect-open': logPanelOpen }">
    <div class="wb-stage">
      <header class="wb-chrome">
        <div class="wb-chrome-left">
          <button class="btn btn-compact primary" @click="togglePlay">{{ isPlaying ? '暂停' : '播放' }}</button>
          <button class="btn btn-compact" @click="reset">重置</button>
          <span class="wb-time">{{ timeDisplay(currentTime) }} / {{ timeDisplay(cycleEndUs) }}</span>
        </div>
        <div class="wb-chrome-right">
          <div class="view-switch" role="tablist" aria-label="交互模式">
            <span class="view-switch-indicator" :class="{ right: isEditMode }" aria-hidden="true"></span>
            <button class="view-switch-btn" :class="{ active: !isEditMode }" @click="setInteractionMode('replay')">回放</button>
            <button class="view-switch-btn" :class="{ active: isEditMode }" @click="setInteractionMode('edit')">编辑</button>
          </div>
          <div class="view-switch" role="tablist" aria-label="视图模式">
            <span class="view-switch-indicator" :class="{ right: visualMode === '3d' }" aria-hidden="true"></span>
            <button class="view-switch-btn" :class="{ active: visualMode === '2d' }" @click="visualMode = '2d'">2D</button>
            <button class="view-switch-btn" :class="{ active: visualMode === '3d' }" @click="visualMode = '3d'">3D</button>
          </div>
          <button class="btn btn-compact" @click="logPanelOpen = !logPanelOpen">{{ logPanelOpen ? '收起日志' : '日志' }}</button>
        </div>
      </header>
      <div class="wb-canvas visual-main">
          <NodeCanvas
            v-if="visualMode === '2d'"
            :nodes="nodesState"
            :node-visuals="nodeVisuals"
            :visible-packets="displayPackets"
            :current-time="currentTime"
            :theme-key="selectedTheme"
            :fx-level="fxLevel"
            :edit-mode="isEditMode"
            :original-positions="originalEditPositions"
            :selected-node-id="selectedEditNodeId ?? undefined"
            :sound-speed-mps="editSoundSpeed"
            @pause-request="pauseForTool"
            @node-move="onEditNodeMove"
            @node-move-end="onEditNodeMoveEnd"
            @node-select="onEditNodeSelect"
          />
          <Suspense v-else>
            <template #default>
              <NodeScene3D
                :nodes="nodesState"
                :node-visuals="nodeVisuals"
                :visible-packets="displayPackets"
                :current-time="currentTime"
                :theme-key="selectedTheme"
                :fx-level="fxLevel"
              />
            </template>
            <template #fallback>
              <div class="visual-loading">
                <div class="visual-loading-core" aria-hidden="true">
                  <span class="visual-loading-ring ring-a"></span>
                  <span class="visual-loading-ring ring-b"></span>
                  <span class="visual-loading-dot"></span>
                </div>
                <p class="visual-loading-title">3D</p>
              </div>
            </template>
          </Suspense>
          <div v-if="isEditMode && visualMode === '3d'" class="edit-3d-hint">2D</div>
        <div class="wb-transport visual-timeline">
          <label class="field range-wrap">
            <input
              class="range"
              type="range"
              :min="0"
              :max="cycleEndUs"
              :step="1000"
              :value="currentTime"
              :style="{ '--range-progress': rangeProgressStyle }"
              @input="onJump"
            />
          </label>
        </div>
      </div>
    </div>

      <aside v-show="logPanelOpen" class="wb-inspect card log">
        <div class="side-controls">
          <div class="control-actions">
            <div class="control-btn-row">
              <button class="btn btn-compact primary" @click="togglePlay">{{ isPlaying ? '暂停' : '播放' }}</button>
              <button class="btn btn-compact" @click="reset">重置</button>
              <button class="btn btn-compact" @click="openLogFilePicker">导入全局日志</button>
              <button class="btn btn-compact" @click="openNodeLogFilePicker">导入节点日志</button>
              <button
                v-if="replayMode === 'global'"
                class="btn btn-compact btn-wide"
                :class="{ active: showAllActivePackets }"
                @click="showAllActivePackets = !showAllActivePackets"
              >
                {{ showAllActivePackets ? '显示全部活跃传播' : '仅显示聚焦/当前包' }}
              </button>
            </div>
            <div class="control-fields-grid">
              <label class="field field-compact">
                <div class="field-head"><span>倍速</span></div>
                <select class="select" :value="speed" @change="onSpeed">
                  <option v-for="option in SPEED_OPTIONS" :key="option" :value="option">{{ option }}x</option>
                </select>
              </label>
              <label class="field field-compact">
                <div class="field-head">
                  <span>示例日志</span>
                  <span v-if="isCustomLog" class="field-chip">已导入</span>
                </div>
                <select class="select" :value="logSourceKey" @change="onSampleLogChange">
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
                <select class="select" :value="replayMode" @change="onReplayModeChange">
                  <option value="global">全局模式</option>
                  <option value="lifecycle">生命周期模式</option>
                </select>
              </label>
              <label v-if="isEditMode" class="field field-compact">
                <div class="field-head"><span>声速</span></div>
                <select class="select" :value="String(editSoundSpeed)" @change="onEditSoundSpeedChange">
                  <option v-for="option in SOUND_SPEED_OPTIONS_MPS" :key="option" :value="option">{{ option }} m/s</option>
                </select>
              </label>
              <label class="field field-compact">
                <div class="field-head"><span>可视化质量</span></div>
                <select class="select" :value="fxLevel" @change="onFxLevelChange">
                  <option
                    v-for="item in FX_LEVEL_OPTIONS"
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
                    <input class="select" type="number" step="0.01" :value="selectedEditNode.x.toFixed(2)" @change="onEditCoordChange('x', $event)" />
                  </label>
                  <label class="field field-compact">
                    <div class="field-head"><span>Y (m)</span></div>
                    <input class="select" type="number" step="0.01" :value="selectedEditNode.y.toFixed(2)" @change="onEditCoordChange('y', $event)" />
                  </label>
                  <label class="field field-compact">
                    <div class="field-head"><span>Z (m)</span></div>
                    <input class="select" type="number" step="0.01" :value="(selectedEditNode.z ?? 0).toFixed(2)" @change="onEditCoordChange('z', $event)" />
                  </label>
                </div>
                <div class="control-btn-row coord-actions">
                  <button class="btn btn-compact" @click="restoreSelectedEditNode">恢复该点</button>
                  <button class="btn btn-compact" @click="restoreAllEditNodes">恢复全部</button>
                </div>
              </div>
              <label v-if="replayMode === 'lifecycle'" class="field field-compact field-span-2">
                <span>选择包</span>
                <select class="select" :value="selectedLifecyclePacketId" @change="onLifecyclePacketChange">
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
              @change="onLogFileChange"
            />
            <input
              ref="nodeLogFileInput"
              class="hidden-file-input"
              type="file"
              multiple
              accept=".log,.jsonl,.json,.txt,application/json,text/plain"
              @change="onNodeLogFilesChange"
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
              @click="onLifecycleStageSelect(stage)"
            >
              <div class="event-track" @pointerdown="onEventTrackPointerDown({ ...lifecyclePacket, eventId: stage.eventId, packet_id: stage.eventId, startUs: stage.startUs, endUs: stage.endUs }, $event)">
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
            @click="onLogSelect(packet)"
          >
            <div class="event-track" @pointerdown="onEventTrackPointerDown(packet, $event)">
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

        <div class="stat-grid">
          <div>记录总数：{{ summary.packetCount }}</div>
          <div>真正发射：{{ summary.committedPacketCount }}</div>
          <div>发送阻塞：{{ summary.blockedPacketCount }}</div>
          <div>成功接收：{{ summary.okReceivers }}<span v-if="isEditMode" class="stat-compare"> / 原 {{ originalSummary.okReceivers }}</span></div>
          <div>rx-rx 冲突：{{ summary.rxrxCollisions }}<span v-if="isEditMode" class="stat-compare"> / 原 {{ originalSummary.rxrxCollisions }}</span></div>
          <div>rx-tx 冲突：{{ summary.rxtxCollisions }}<span v-if="isEditMode" class="stat-compare"> / 原 {{ originalSummary.rxtxCollisions }}</span></div>
        </div>
      </aside>
  </div>
</template>
