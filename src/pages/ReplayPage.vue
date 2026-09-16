<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, watch } from 'vue'
import NodeCanvas from '../components/NodeCanvas.vue'
import SplitPane from '../components/SplitPane.vue'
import { session } from '../shared/sessionStore'
import { CANVAS_THEME_KEY, LOCAL_STORAGE_KEYS, MIN_SIM_TIME_US } from '../shared/constants'
import { parseLog } from '@/features/replay/lib/logParser'
import { timeDisplay } from '@/features/replay/lib/format'
import { LOG_SOURCES } from '@/features/replay/lib/sources'
import { usePlaybackEngine } from '@/features/replay/composables/usePlaybackEngine'
import { useReplayState } from '@/features/replay/composables/useReplayState'
import { useLogPanel } from '@/features/replay/composables/useLogPanel'
import { cloneNode, useEditMode } from '@/features/replay/composables/useEditMode'
import { useLogImport } from '@/features/replay/composables/useLogImport'
import ReplayToolbar from '@/features/replay/components/ReplayToolbar.vue'
import TimelineBar from '@/features/replay/components/TimelineBar.vue'
import LogPanel from '@/features/replay/components/LogPanel.vue'

const NodeScene3D = defineAsyncComponent(() => import('../features/scene3d/NodeScene3D.vue'))

const FX_LEVEL_OPTIONS = Object.freeze([
  { key: 'standard', label: '标准' },
  { key: 'extreme', label: '增强' },
])

let getCycleEndUs = () => MIN_SIM_TIME_US
const playback = usePlaybackEngine({ getCycleEndUs })
const state = useReplayState({ playback })
getCycleEndUs = () => state.cycleEndUs.value
const panel = useLogPanel({ state, playback })
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
  queueSeek,
  scrubStart,
  scrubEnd,
  onSpeed,
} = playback

const {
  logSourceKey,
  uploadedLogName,
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
  globalActiveEventId,
  lifecycleActiveEventId,
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

const onVisualModeChange = (mode: string) => {
  panel.visualMode.value = mode
}

const onToggleLogPanel = () => {
  panel.logPanelOpen.value = !panel.logPanelOpen.value
}

const onShowAllActiveChange = (value: boolean) => {
  state.showAllActivePackets.value = value
}

const logSourceLabel = computed(() =>
  isCustomLog.value
    ? customLogSelectLabel.value
    : (LOG_SOURCES[logSourceKey.value]?.label ?? '示例'),
)

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
  <section class="page">
    <div class="deck">
      <div class="deck-canvas">
        <NodeCanvas
          v-if="visualMode === '2d'"
          :nodes="nodesState"
          :node-visuals="nodeVisuals"
          :visible-packets="displayPackets"
          :current-time="currentTime"
          :theme-key="CANVAS_THEME_KEY"
          :fx-level="fxLevel"
          :edit-mode="isEditMode"
          :original-positions="originalEditPositions"
          :selected-node-id="selectedEditNodeId ?? undefined"
          :sound-speed-mps="editSoundSpeed"
          :view-padding="{ top: 24, right: 340 }"
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
              :theme-key="CANVAS_THEME_KEY"
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
      </div>

      <ReplayToolbar
        :is-edit-mode="isEditMode"
        :visual-mode="visualMode"
        @set-interaction-mode="setInteractionMode"
        @update:visual-mode="onVisualModeChange"
      />

      <div class="dock-unit dock-unit-r" :class="{ closed: !logPanelOpen }">
        <button
          class="panel-ear"
          :title="logPanelOpen ? '收起日志面板' : '展开日志面板'"
          :aria-label="logPanelOpen ? '收起日志面板' : '展开日志面板'"
          :aria-expanded="logPanelOpen"
          @click="onToggleLogPanel"
        >
          <svg viewBox="0 0 6 10" width="6" height="10" aria-hidden="true">
            <path :d="logPanelOpen ? 'M1 1l4 4-4 4' : 'M5 1L1 5l4 4'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="ear-label">日志</span>
        </button>

        <SplitPane
          class="dock-right"
          :default-width="340"
          :min="280"
          :max="520"
          :storage-key="LOCAL_STORAGE_KEYS.splitLog"
        >
        <LogPanel
          :show-all-active-packets="showAllActivePackets"
          :is-playing="isPlaying"
          :replay-mode="replayMode"
          :log-source-key="logSourceKey"
          :is-custom-log="isCustomLog"
          :custom-log-select-label="customLogSelectLabel"
          :fx-level="fxLevel"
          :fx-level-options="FX_LEVEL_OPTIONS"
          :is-edit-mode="isEditMode"
          :edit-sound-speed="editSoundSpeed"
          :selected-edit-node="selectedEditNode"
          :selected-lifecycle-packet-id="selectedLifecyclePacketId"
          :lifecycle-packet-options="lifecyclePacketOptions"
          :lifecycle-packet="lifecyclePacket"
          :active-lifecycle-stage="activeLifecycleStage"
          :lifecycle-stages="lifecycleStages"
          :parse-errors="parseErrors"
          :visible-packet-entries="visiblePacketEntries"
          :current-packet-ids="currentPacketIds"
          :focused-packet-id="focusedPacketId"
          :summary="summary"
          :original-summary="originalSummary"
          :global-active-event-id="globalActiveEventId"
          :lifecycle-active-event-id="lifecycleActiveEventId"
          @update:show-all-active-packets="onShowAllActiveChange"
          @log-file-change="onLogFileChange"
          @node-log-files-change="onNodeLogFilesChange"
          @sample-log-change="onSampleLogChange"
          @replay-mode-change="onReplayModeChange"
          @edit-sound-speed-change="onEditSoundSpeedChange"
          @fx-level-change="onFxLevelChange"
          @coord-change="onEditCoordChange"
          @restore-selected="restoreSelectedEditNode"
          @restore-all="restoreAllEditNodes"
          @lifecycle-packet-change="onLifecyclePacketChange"
          @log-select="onLogSelect"
          @stage-select="onLifecycleStageSelect"
          @track-pointer-down="onEventTrackPointerDown"
        />
        </SplitPane>
      </div>

      <TimelineBar
        :current-time="currentTime"
        :cycle-end-us="cycleEndUs"
        :range-progress-style="rangeProgressStyle"
        :is-playing="isPlaying"
        :speed="speed"
        @seek="queueSeek"
        @seek-start="scrubStart"
        @seek-end="scrubEnd"
        @toggle-play="togglePlay"
        @reset="reset"
        @speed-change="onSpeed"
      />
    </div>

    <footer class="statusbar">
      <span class="sb-item">{{ replayMode === 'lifecycle' ? '单包生命周期' : '全局' }} · {{ logSourceLabel }}</span>
      <span class="sb-item">成功 <b>{{ summary.okReceivers }}</b></span>
      <span class="sb-item">rx-rx <b>{{ summary.rxrxCollisions }}</b></span>
      <span class="sb-item">rx-tx <b>{{ summary.rxtxCollisions }}</b></span>
      <span class="sb-spacer"></span>
      <span class="sb-item">{{ timeDisplay(currentTime) }} / {{ timeDisplay(cycleEndUs) }} · {{ speed }}x</span>
    </footer>
  </section>
</template>
