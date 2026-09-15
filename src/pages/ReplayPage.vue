<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import NodeCanvas from '../components/NodeCanvas.vue'
import { session } from '../shared/sessionStore'
import {
  MAX_LOG_FILES,
  sanitizeDisplayText,
  sanitizeFileName,
  validateImportedFile,
  validateImportedText,
} from '../shared/logSafety'
import {
  recomputeReceiversFromGeometry,
} from '../shared/acousticSim'
import {
  DEFAULT_SOUND_SPEED_MPS,
  LOCAL_STORAGE_KEYS,
  MIN_SIM_TIME_US,
  SOUND_SPEED_OPTIONS_MPS,
  SPEED_OPTIONS,
} from '../shared/constants'
import { LOG_SOURCES } from '../features/replay/lib/sources'
import {
  blockedReasonLabel,
  clampRatio,
  normalizeTime,
  timeDisplay,
} from '../features/replay/lib/format'
import {
  resolveMovingNodes,
} from '../features/replay/lib/logNormalize'
import {
  mergeParsedNodeLogs,
  normalizePacketsFromParsed,
} from '../features/replay/lib/logMerge'
import { parseLog } from '../features/replay/lib/logParser'
import {
  enforceMinGap,
  summarizePackets,
} from '../features/replay/lib/geometry'
import {
  buildLifecycleGroups,
  buildLifecycleStages,
  buildPacketEntries,
  receiverPillClass,
} from '../features/replay/lib/packetEntries'

const NodeScene3D = defineAsyncComponent(() => import('../components/NodeScene3D.vue'))

const RX_OK_HOLD_US = 180_000
const RX_FAIL_HOLD_US = 220_000

const FX_LEVEL_OPTIONS = Object.freeze([
  { key: 'standard', label: '标准' },
  { key: 'extreme', label: '增强' },
])

const currentTime = ref(0)
const initialParsed = parseLog(LOG_SOURCES.default.raw)
const logFileInput = ref(null)
const nodeLogFileInput = ref(null)
const logSourceKey = ref('default')
const uploadedLogName = ref('')
const uploadedNodeLogNames = ref([])
const selectedTheme = ref('research-lab')
const fxLevel = ref('standard')
const baseNodesState = ref(enforceMinGap(initialParsed.nodes))
const nodeMovementRows = ref(initialParsed.movements)
const sourcePacketRows = ref(normalizePacketsFromParsed(initialParsed, uploadedLogName.value || 'node-log'))
const simulatedPacketRows = ref(null)
const parseErrors = ref(initialParsed.parseErrors)
const metaState = ref(initialParsed.meta)
const interactionMode = ref('replay')
const editSoundSpeed = ref(DEFAULT_SOUND_SPEED_MPS)
const editNodes = ref([])
const originalEditPoseById = ref(new Map())
const selectedEditNodeId = ref(null)
const packetRows = computed(() => (
  isEditMode.value && simulatedPacketRows.value
    ? simulatedPacketRows.value
    : sourcePacketRows.value
))
const nodesState = computed(() => (
  isEditMode.value
    ? editNodes.value
    : resolveMovingNodes(baseNodesState.value, nodeMovementRows.value, currentTime.value)
))
const isEditMode = computed(() => interactionMode.value === 'edit')
const isCustomLog = computed(() => logSourceKey.value === 'upload' || logSourceKey.value === 'node-upload')
const activeLogName = computed(() => {
  if (logSourceKey.value === 'upload' && uploadedLogName.value) return uploadedLogName.value
  if (logSourceKey.value === 'node-upload' && uploadedNodeLogNames.value.length) {
    const names = uploadedNodeLogNames.value
    if (names.length <= 2) return names.join(' + ')
    return `${names[0]} + ${names.length - 1} 个节点日志`
  }
  return (LOG_SOURCES[logSourceKey.value] || LOG_SOURCES.default).fileName
})
const customLogSelectLabel = computed(() => {
  if (logSourceKey.value === 'upload') return `已导入：${uploadedLogName.value || '自定义日志'}`
  if (logSourceKey.value === 'node-upload') return `已导入：${activeLogName.value}`
  return ''
})
const originalReceiverMap = computed(() => {
  const map = new Map()
  for (const packet of sourcePacketRows.value) {
    for (const receiver of packet.receivers || []) {
      map.set(`${packet.eventId}:${receiver.dst}`, receiver)
    }
  }
  return map
})
const originalEditPositions = computed(() => [...originalEditPoseById.value.values()])
const selectedEditNode = computed(() => (
  editNodes.value.find((node) => node.node_id === selectedEditNodeId.value) || null
))
const originalSummary = computed(() => summarizePackets(sourcePacketRows.value))
const simulatedSummary = computed(() => summarizePackets(packetRows.value))

const nodeById = computed(() => new Map(nodesState.value.map((node) => [node.node_id, node])))
const packetByPacketId = computed(() => {
  const map = new Map()
  for (const packet of packetRows.value) {
    const prev = map.get(packet.packet_id)
    if (!prev || normalizeTime(packet.tx_start_us) < normalizeTime(prev.tx_start_us)) {
      map.set(packet.packet_id, packet)
    }
  }
  return map
})

const packets = computed(() => {
  const packetMap = packetByPacketId.value

  return packetRows.value
    .map((packet) => {
      const receivers = packet.receivers.map((receiver) => {
        let collisionStartUs = receiver.rx_start_us
        if (receiver.reason === 'collision_rx_rx' && receiver.with.length) {
          for (const packetId of receiver.with) {
            const otherPacket = packetMap.get(packetId)
            const otherReceiver = otherPacket?.receivers.find((item) => item.dst === receiver.dst)
            if (!otherReceiver) continue
            collisionStartUs = Math.max(collisionStartUs, Math.max(receiver.rx_start_us, otherReceiver.rx_start_us))
          }
        }

        return {
          ...receiver,
          collision_start_us: collisionStartUs,
        }
      })

      return {
        ...packet,
        receivers,
      }
    })
    .slice()
    .sort((a, b) => a.tx_start_us - b.tx_start_us)
})

const packetsMaxEndUs = computed(() => packets.value.reduce((maxEnd, packet) => Math.max(maxEnd, packet.timeEnd), 0))
const movementsMaxEndUs = computed(() => nodeMovementRows.value.reduce((maxEnd, movement) => Math.max(maxEnd, movement.end_us), 0))
const cycleEndUs = computed(() => Math.max(MIN_SIM_TIME_US, normalizeTime(metaState.value.sim_end_us), packetsMaxEndUs.value, movementsMaxEndUs.value))
const rangeProgressStyle = computed(() => `${((currentTime.value / Math.max(1, cycleEndUs.value)) * 100).toFixed(2)}%`)

const focusedPacketId = ref(null)
const replayMode = ref('global')
const selectedLifecyclePacketId = ref('')
const isPlaying = ref(false)
const speed = ref(1)
const showAllActivePackets = ref(true)
const visualMode = ref('2d')
const logPanelOpen = ref(false)
const activeDragEvent = ref(null)
const suppressLogClick = ref(null)
const globalLogListEl = ref(null)
const lifecycleLogListEl = ref(null)
let raf = 0
let lastTs = 0
const clampTime = (us) => Math.max(0, Math.min(cycleEndUs.value, normalizeTime(us)))

const packetEntries = computed(() => buildPacketEntries(packets.value, {
  nodeById: nodeById.value,
  packetMap: packetByPacketId.value,
  currentTimeUs: currentTime.value,
  originalReceiverMap: originalReceiverMap.value,
  packetRows: packetRows.value,
}))

const lifecycleGroups = computed(() => buildLifecycleGroups(packetEntries.value, currentTime.value))

const visiblePacketEntries = computed(() => packetEntries.value)

const currentPacketIds = computed(() => new Set(
  packetEntries.value
    .filter((packet) => currentTime.value >= packet.startUs && currentTime.value <= packet.endUs)
    .map((packet) => packet.eventId),
))

const activePacket = computed(() => {
  for (let i = packetEntries.value.length - 1; i >= 0; i -= 1) {
    const packet = packetEntries.value[i]
    if (currentTime.value >= packet.startUs && currentTime.value <= packet.endUs) {
      return packet
    }
  }
  return null
})

const focusedPacket = computed(() => (
  focusedPacketId.value
    ? packetEntries.value.find((packet) => packet.eventId === focusedPacketId.value || packet.packet_id === focusedPacketId.value) || null
    : null
))

const lifecyclePacketOptions = computed(() => lifecycleGroups.value.map((packet) => ({
  id: packet.packet_id,
  label: `${packet.packet_id} · ${packet.sourceLabel} · ${packet.segments.length}段`,
  startUs: packet.startUs,
})))

const lifecyclePacket = computed(() => {
  if (!lifecyclePacketOptions.value.length) return null
  const targetId = selectedLifecyclePacketId.value || lifecyclePacketOptions.value[0].id
  return lifecycleGroups.value.find((packet) => packet.packet_id === targetId) || lifecycleGroups.value[0] || null
})

const lifecycleStages = computed(() => buildLifecycleStages(lifecyclePacket.value, currentTime.value))

const activeLifecycleStage = computed(() => lifecycleStages.value.find((stage) => stage.active) || null)
const globalActiveEventId = computed(() => activePacket.value?.eventId || null)
const lifecycleActiveEventId = computed(() => activeLifecycleStage.value?.eventId || null)

const displayPackets = computed(() => {
  if (isEditMode.value && !isPlaying.value) return []
  if (replayMode.value === 'lifecycle' && lifecyclePacket.value) {
    return lifecyclePacket.value.segments
  }

  const activePackets = packetEntries.value.filter((packet) => currentTime.value >= packet.startUs && currentTime.value <= packet.endUs)
  if (showAllActivePackets.value) return activePackets
  if (focusedPacket.value) return [focusedPacket.value]
  return activePacket.value ? [activePacket.value] : []
})

const summary = computed(() => summarizePackets(packets.value))

const txEventsByNode = computed(() => {
  const map = new Map()
  for (const packet of packets.value) {
    if (!packet.tx_committed) continue
    const list = map.get(packet.src) || []
    list.push(packet)
    map.set(packet.src, list)
  }
  return map
})

const rxEventsByNode = computed(() => {
  const map = new Map()
  for (const packet of packets.value) {
    for (const receiver of packet.receivers) {
      const list = map.get(receiver.dst) || []
      list.push({
        ...receiver,
        packet_id: packet.packet_id,
        src: packet.src,
      })
      map.set(receiver.dst, list)
    }
  }
  return map
})

const nodeVisuals = computed(() => {
  const time = currentTime.value

  return nodesState.value.map((node) => {
    const txEvents = txEventsByNode.value.get(node.node_id) || []
    const rxEvents = rxEventsByNode.value.get(node.node_id) || []

    const activeTx = txEvents
      .filter((packet) => time >= packet.tx_start_us && time <= packet.tx_end_us)
      .sort((a, b) => a.tx_start_us - b.tx_start_us)
      .at(-1) || null

    const activeReceivers = rxEvents
      .filter((receiver) => time >= receiver.rx_start_us && time <= receiver.rx_end_us)
      .sort((a, b) => a.rx_start_us - b.rx_start_us)

    const activeRxTxConflict = activeReceivers
      .filter((receiver) => receiver.reason === 'collision_rx_tx')
      .at(-1) || null

    const activeRxRxConflict = activeReceivers
      .filter((receiver) => receiver.reason === 'collision_rx_rx' && time >= receiver.collision_start_us)
      .at(-1) || null

    const preCollisionReceive = activeReceivers
      .filter((receiver) => receiver.reason === 'collision_rx_rx' && time < receiver.collision_start_us)
      .at(-1) || null

    const activeReceive = activeReceivers
      .filter((receiver) => receiver.status === 'ok')
      .at(-1) || null

    const recentSuccess = rxEvents
      .filter((receiver) => receiver.status === 'ok' && time > receiver.rx_end_us && time - receiver.rx_end_us <= RX_OK_HOLD_US)
      .sort((a, b) => a.rx_end_us - b.rx_end_us)
      .at(-1) || null

    const recentFailure = rxEvents
      .filter((receiver) => receiver.status !== 'ok' && time > receiver.rx_end_us && time - receiver.rx_end_us <= RX_FAIL_HOLD_US)
      .sort((a, b) => a.rx_end_us - b.rx_end_us)
      .at(-1) || null

    if (activeTx) {
      const txProgress = clampRatio((time - activeTx.tx_start_us) / Math.max(activeTx.tx_duration_us, 1))
      return {
        ...node,
        mode: 'tx',
        fillProgress: txProgress,
        fade: 1,
        statusText: activeRxTxConflict ? '发送中 / rx-tx 冲突' : '发送中',
        packetId: activeTx.packet_id,
        overlay: activeRxTxConflict
          ? {
            kind: 'collision_rx_tx',
            strength: 1,
            packetId: activeRxTxConflict.packet_id,
          }
          : null,
      }
    }

    if (activeRxRxConflict) {
      return {
        ...node,
        mode: 'collision',
        fillProgress: 1,
        fade: 1,
        statusText: '接收冲突',
        packetId: activeRxRxConflict.packet_id,
        overlay: {
          kind: 'collision_rx_rx',
          strength: 1,
          packetId: activeRxRxConflict.packet_id,
        },
      }
    }

    if (activeReceive) {
      return {
        ...node,
        mode: 'rx',
        fillProgress: clampRatio((time - activeReceive.rx_start_us) / Math.max(activeReceive.rx_duration_us, 1)),
        fade: 1,
        statusText: '接收中',
        packetId: activeReceive.packet_id,
        overlay: null,
      }
    }

    if (preCollisionReceive) {
      return {
        ...node,
        mode: 'rx',
        fillProgress: clampRatio((time - preCollisionReceive.rx_start_us) / Math.max(preCollisionReceive.rx_duration_us, 1)),
        fade: 1,
        statusText: '接收中',
        packetId: preCollisionReceive.packet_id,
        overlay: null,
      }
    }

    if (recentFailure) {
      return {
        ...node,
        mode: 'collision-linger',
        fillProgress: 1,
        fade: clampRatio(1 - ((time - recentFailure.rx_end_us) / RX_FAIL_HOLD_US)),
        statusText: reasonLabel(recentFailure.reason),
        packetId: recentFailure.packet_id,
        overlay: {
          kind: recentFailure.reason,
          strength: clampRatio(1 - ((time - recentFailure.rx_end_us) / RX_FAIL_HOLD_US)),
          packetId: recentFailure.packet_id,
        },
      }
    }

    if (recentSuccess) {
      return {
        ...node,
        mode: 'rx-done',
        fillProgress: 1,
        fade: clampRatio(1 - ((time - recentSuccess.rx_end_us) / RX_OK_HOLD_US)),
        statusText: '接收成功',
        packetId: recentSuccess.packet_id,
        overlay: null,
      }
    }

    return {
      ...node,
      mode: 'idle',
      fillProgress: 0,
      fade: 1,
      statusText: '空闲',
      packetId: null,
      overlay: null,
    }
  })
})

const togglePlay = () => {
  if (!isPlaying.value && currentTime.value >= cycleEndUs.value) {
    currentTime.value = 0
    focusedPacketId.value = null
  }
  if (!isPlaying.value) lastTs = 0
  isPlaying.value = !isPlaying.value
}

const pauseForTool = () => {
  isPlaying.value = false
  lastTs = 0
}

const seekTime = (us) => {
  currentTime.value = clampTime(us)
  lastTs = 0
}

const reset = () => {
  isPlaying.value = false
  focusedPacketId.value = null
  currentTime.value = 0
  lastTs = 0
}

const onJump = (event) => {
  const next = Number(event.target.value)
  if (Number.isFinite(next)) seekTime(next)
}

const onSpeed = (event) => {
  speed.value = Number(event.target.value)
}

const applyParsedLog = (parsed) => {
  exitEditMode()
  baseNodesState.value = enforceMinGap(parsed.nodes)
  nodeMovementRows.value = parsed.movements
  sourcePacketRows.value = normalizePacketsFromParsed(parsed, uploadedLogName.value || 'node-log')
  parseErrors.value = parsed.parseErrors
  metaState.value = parsed.meta

  focusedPacketId.value = null
  selectedLifecyclePacketId.value = ''
  currentTime.value = 0
  isPlaying.value = false
  lastTs = 0
}

const cloneNode = (node) => ({
  ...node,
  x: Number(node.x) || 0,
  y: Number(node.y) || 0,
  z: Number(node.z) || 0,
})

const refreshSimulatedPackets = () => {
  if (!isEditMode.value) return
  simulatedPacketRows.value = recomputeReceiversFromGeometry(
    sourcePacketRows.value,
    editNodes.value,
    editSoundSpeed.value,
  )
}

const snapshotReplayNodes = () => {
  const snapshot = resolveMovingNodes(baseNodesState.value, nodeMovementRows.value, currentTime.value).map(cloneNode)
  originalEditPoseById.value = new Map(snapshot.map((node) => [node.node_id, cloneNode(node)]))
  editNodes.value = snapshot.map(cloneNode)
  selectedEditNodeId.value = snapshot[0]?.node_id ?? null
}

const enterEditMode = () => {
  snapshotReplayNodes()
  interactionMode.value = 'edit'
  isPlaying.value = false
  lastTs = 0
  focusedPacketId.value = null
  currentTime.value = 0
  visualMode.value = '2d'
  refreshSimulatedPackets()
}

const exitEditMode = () => {
  interactionMode.value = 'replay'
  simulatedPacketRows.value = null
  editNodes.value = []
  originalEditPoseById.value = new Map()
  selectedEditNodeId.value = null
  isPlaying.value = false
  lastTs = 0
  focusedPacketId.value = null
  currentTime.value = 0
}

const setInteractionMode = (mode) => {
  if (mode === interactionMode.value) return
  if (mode === 'edit') enterEditMode()
  else exitEditMode()
}

const onEditNodeMove = (payload) => {
  if (!payload || !Number.isFinite(Number(payload.node_id))) return
  pauseForTool()
  editNodes.value = editNodes.value.map((node) => (
    node.node_id === payload.node_id
      ? { ...node, x: Math.round((Number(payload.x) || 0) * 100) / 100, y: Math.round((Number(payload.y) || 0) * 100) / 100 }
      : node
  ))
}

const onEditNodeMoveEnd = () => {
  refreshSimulatedPackets()
}

const onEditNodeSelect = (node) => {
  if (!node) return
  selectedEditNodeId.value = node.node_id
}

const restoreSelectedEditNode = () => {
  const original = originalEditPoseById.value.get(selectedEditNodeId.value)
  if (!original) return
  editNodes.value = editNodes.value.map((node) => (
    node.node_id === original.node_id ? cloneNode(original) : node
  ))
  refreshSimulatedPackets()
}

const restoreAllEditNodes = () => {
  editNodes.value = [...originalEditPoseById.value.values()].map(cloneNode)
  refreshSimulatedPackets()
}

const onEditSoundSpeedChange = (event) => {
  const next = Number(event.target.value)
  if (!Number.isFinite(next) || next <= 0) return
  editSoundSpeed.value = Math.max(200, Math.min(2500, next))
  refreshSimulatedPackets()
}

const onEditCoordChange = (axis, event) => {
  const node = selectedEditNode.value
  if (!node) return
  const next = Number(event.target.value)
  if (!Number.isFinite(next)) return
  editNodes.value = editNodes.value.map((item) => (
    item.node_id === node.node_id ? { ...item, [axis]: Math.round(next * 100) / 100 } : item
  ))
  refreshSimulatedPackets()
}

const loadSampleLog = (key) => {
  const source = LOG_SOURCES[key] || LOG_SOURCES.default
  logSourceKey.value = LOG_SOURCES[key] ? key : 'default'
  applyParsedLog(parseLog(source.raw))
}

const onSampleLogChange = (event) => {
  const key = event.target.value
  if (!LOG_SOURCES[key]) return
  loadSampleLog(key)
}

const openLogFilePicker = () => {
  logFileInput.value?.click()
}

const openNodeLogFilePicker = () => {
  nodeLogFileInput.value?.click()
}

const rejectImportedLog = (message) => {
  parseErrors.value = [sanitizeDisplayText(message, 120)]
}

const importLogFile = async (file) => {
  const fileCheck = validateImportedFile(file)
  if (!fileCheck.ok) return { ok: false, error: fileCheck.error }
  const text = await file.text()
  const textCheck = validateImportedText(text)
  if (!textCheck.ok) return { ok: false, error: textCheck.error }
  return { ok: true, text, name: sanitizeFileName(file.name) }
}

const onLogFileChange = async (event) => {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  if (!file) return

  const imported = await importLogFile(file)
  if (!imported.ok) {
    rejectImportedLog(imported.error)
    return
  }

  uploadedLogName.value = imported.name
  logSourceKey.value = 'upload'
  applyParsedLog(parseLog(imported.text))
}

const onNodeLogFilesChange = async (event) => {
  const files = [...(event.target?.files || [])].slice(0, MAX_LOG_FILES)
  if (event.target) event.target.value = ''
  if (!files.length) return

  const parsedLogs = []
  const fileNames = []
  for (const file of files) {
    const imported = await importLogFile(file)
    if (!imported.ok) {
      rejectImportedLog(imported.error)
      return
    }
    parsedLogs.push(parseLog(imported.text))
    fileNames.push(imported.name)
  }

  const mergedParsed = mergeParsedNodeLogs(parsedLogs, fileNames)
  uploadedNodeLogNames.value = fileNames
  logSourceKey.value = 'node-upload'
  applyParsedLog(mergedParsed)
}

const onFxLevelChange = (event) => {
  fxLevel.value = event.target.value
}

const onReplayModeChange = (event) => {
  replayMode.value = event.target.value
  if (replayMode.value === 'lifecycle' && lifecyclePacket.value) {
    focusedPacketId.value = lifecyclePacket.value.packet_id
    seekTime(lifecyclePacket.value.startUs)
  }
}

const onLifecyclePacketChange = (event) => {
  selectedLifecyclePacketId.value = event.target.value
  if (lifecyclePacket.value) {
    focusedPacketId.value = lifecyclePacket.value.packet_id
    seekTime(lifecyclePacket.value.startUs)
  }
}

const onKeydown = (event) => {
  if (event.code !== 'Space' || (event.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|OPTION)$/i.test(event.target.tagName))) {
    return
  }
  event.preventDefault()
  togglePlay()
}

const onLogSelect = (packet) => {
  if (suppressLogClick.value === packet.eventId) {
    suppressLogClick.value = null
    return
  }

  if (activeDragEvent.value && activeDragEvent.value.eventId === packet.eventId) {
    return
  }

  focusedPacketId.value = packet.eventId
  seekTime(packet.tx_start_us)
}

const onLifecycleStageSelect = (stage) => {
  if (!stage) return
  seekTime(stage.startUs)
}

const onEventTrackPointerDown = (packet, event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  focusedPacketId.value = packet.eventId

  const startUs = Number(packet.startUs)
  const durationUs = Math.max(1, Number(packet.endUs - packet.startUs))
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = clampRatio((event.clientX - rect.left) / Math.max(rect.width, 1))
  seekTime(startUs + (durationUs * ratio))

  activeDragEvent.value = {
    eventId: packet.eventId,
    minUs: startUs,
    maxUs: startUs + durationUs,
    left: rect.left,
    width: Math.max(rect.width, 1),
  }
  suppressLogClick.value = packet.eventId
}

const onGlobalPointerMove = (event) => {
  if (!activeDragEvent.value) return

  const durationUs = Math.max(1, activeDragEvent.value.maxUs - activeDragEvent.value.minUs)
  const ratio = clampRatio((event.clientX - activeDragEvent.value.left) / activeDragEvent.value.width)
  seekTime(activeDragEvent.value.minUs + (durationUs * ratio))
}

const onGlobalPointerUp = () => {
  if (activeDragEvent.value) {
    const eventId = activeDragEvent.value.eventId
    requestAnimationFrame(() => {
      if (suppressLogClick.value === eventId) suppressLogClick.value = null
    })
  }
  activeDragEvent.value = null
}

const scrollLogItemIntoView = (listEl, eventId) => {
  if (!listEl || !eventId) return
  const target = [...listEl.querySelectorAll('.log-item')].find((item) => item.dataset.eventId === eventId)
  if (!target) return

  const listRect = listEl.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const outOfViewTop = targetRect.top < listRect.top
  const outOfViewBottom = targetRect.bottom > listRect.bottom
  if (!outOfViewTop && !outOfViewBottom) return

  target.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: isPlaying.value ? 'smooth' : 'auto',
  })
}

const tick = (timestamp) => {
  if (!isPlaying.value) {
    lastTs = 0
    return
  }

  if (!lastTs) lastTs = timestamp
  const diff = timestamp - lastTs
  lastTs = timestamp

  const next = currentTime.value + (diff * 1000 * speed.value)
  if (next >= cycleEndUs.value) {
    currentTime.value = cycleEndUs.value
    isPlaying.value = false
    return
  }

  currentTime.value = next
  raf = requestAnimationFrame(tick)
}

watch(isPlaying, (next) => {
  if (!next) {
    if (raf) cancelAnimationFrame(raf)
    lastTs = 0
    return
  }
  raf = requestAnimationFrame(tick)
})

watch(fxLevel, (next) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.fxLevel, next)
  } catch {
    // ignore persistence errors
  }
})

watch([replayMode, globalActiveEventId], async ([mode, eventId], [prevMode, prevEventId]) => {
  if (mode !== 'global' || !eventId) return
  if (mode === prevMode && eventId === prevEventId) return
  await nextTick()
  scrollLogItemIntoView(globalLogListEl.value, eventId)
})

watch([replayMode, lifecycleActiveEventId], async ([mode, eventId], [prevMode, prevEventId]) => {
  if (mode !== 'lifecycle' || !eventId) return
  if (mode === prevMode && eventId === prevEventId) return
  await nextTick()
  scrollLogItemIntoView(lifecycleLogListEl.value, eventId)
})

watch(lifecyclePacketOptions, (options) => {
  if (!options.length) {
    selectedLifecyclePacketId.value = ''
    return
  }
  if (!options.some((option) => option.id === selectedLifecyclePacketId.value)) {
    selectedLifecyclePacketId.value = options[0].id
  }
}, { immediate: true })

watch(nodesState, (nodes) => {
  if (isEditMode.value) return
  session.replayNodes = (nodes || []).map(cloneNode)
}, { deep: true })

onMounted(() => {
  if (typeof session.pendingReplayLog === 'string' && session.pendingReplayLog.length) {
    logSourceKey.value = 'upload'
    uploadedLogName.value = session.pendingReplayName || 'ns3.log'
    applyParsedLog(parseLog(session.pendingReplayLog))
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
  if (raf) cancelAnimationFrame(raf)
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
            :selected-node-id="selectedEditNodeId"
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
                    <input class="select" type="number" step="0.01" :value="selectedEditNode.z.toFixed(2)" @change="onEditCoordChange('z', $event)" />
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
