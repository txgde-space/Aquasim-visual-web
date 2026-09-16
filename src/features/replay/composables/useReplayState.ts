import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { DEFAULT_SOUND_SPEED_MPS, LOCAL_STORAGE_KEYS, MIN_SIM_TIME_US } from '@/shared/constants'
import { sanitizeDisplayText } from '@/shared/logSafety'
import type { LogMeta, ParsedLog } from '@/shared/types/log'
import type {
  LifecycleGroup,
  LifecycleStage,
  Movement,
  NodeVisual,
  PacketEntry,
  ReplayNode,
  ReplayPacket,
  ReplayReceiver,
} from '@/shared/types/replay'
import { LOG_SOURCES } from '../lib/sources'
import { clampRatio, normalizeTime, reasonLabel } from '../lib/format'
import { resolveMovingNodes } from '../lib/logNormalize'
import { normalizePacketsFromParsed } from '../lib/logMerge'
import { parseLog } from '../lib/logParser'
import { enforceMinGap, summarizePackets } from '../lib/geometry'
import {
  buildLifecycleGroups,
  buildLifecycleStages,
  buildPacketEntries,
} from '../lib/packetEntries'
import type { PlaybackEngine } from './usePlaybackEngine'

const RX_OK_HOLD_US = 180_000
const RX_FAIL_HOLD_US = 220_000

/** Receiver event enriched with its source packet identity (used by node visuals). */
type RxEvent = ReplayReceiver & { collision_start_us: number; packet_id: string; src: number }

export const useReplayState = ({ playback }: { playback: PlaybackEngine }) => {
  const logSourceKey: Ref<string> = ref('default')
  const uploadedLogName: Ref<string> = ref('')
  const uploadedNodeLogNames: Ref<string[]> = ref([])
  const fxLevel: Ref<string> = ref('standard')
  const replayMode: Ref<string> = ref('global')
  const selectedLifecyclePacketId: Ref<string> = ref('')
  const showAllActivePackets: Ref<boolean> = ref(true)
  const interactionMode: Ref<string> = ref('replay')
  const editSoundSpeed: Ref<number> = ref(DEFAULT_SOUND_SPEED_MPS)

  const initialParsed: ParsedLog = parseLog(LOG_SOURCES.default.raw)

  const baseNodesState: Ref<ReplayNode[]> = ref(enforceMinGap(initialParsed.nodes))
  const nodeMovementRows: Ref<Movement[]> = ref(initialParsed.movements as unknown as Movement[])
  const sourcePacketRows: Ref<ReplayPacket[]> = ref(
    normalizePacketsFromParsed(initialParsed, uploadedLogName.value || 'node-log'),
  )
  const simulatedPacketRows: Ref<ReplayPacket[] | null> = ref(null)
  const parseErrors: Ref<string[]> = ref(initialParsed.parseErrors)
  const metaState: Ref<LogMeta> = ref(initialParsed.meta)
  const editNodes: Ref<ReplayNode[]> = ref([])
  const originalEditPoseById: Ref<Map<number, ReplayNode>> = ref(new Map())
  const selectedEditNodeId: Ref<number | null> = ref(null)

  const isEditMode: ComputedRef<boolean> = computed(() => interactionMode.value === 'edit')
  const isCustomLog: ComputedRef<boolean> = computed(() => logSourceKey.value === 'upload' || logSourceKey.value === 'node-upload')
  const activeLogName: ComputedRef<string> = computed(() => {
    if (logSourceKey.value === 'upload' && uploadedLogName.value) return uploadedLogName.value
    if (logSourceKey.value === 'node-upload' && uploadedNodeLogNames.value.length) {
      const names = uploadedNodeLogNames.value
      if (names.length <= 2) return names.join(' + ')
      return `${names[0]} + ${names.length - 1} 个节点日志`
    }
    return (LOG_SOURCES[logSourceKey.value] || LOG_SOURCES.default).fileName
  })
  const customLogSelectLabel: ComputedRef<string> = computed(() => {
    if (logSourceKey.value === 'upload') return `已导入：${uploadedLogName.value || '自定义日志'}`
    if (logSourceKey.value === 'node-upload') return `已导入：${activeLogName.value}`
    return ''
  })

  const packetRows: ComputedRef<ReplayPacket[]> = computed(() => (
    isEditMode.value && simulatedPacketRows.value
      ? simulatedPacketRows.value
      : sourcePacketRows.value
  ))
  const nodesState: ComputedRef<ReplayNode[]> = computed(() => (
    isEditMode.value
      ? editNodes.value
      : resolveMovingNodes(baseNodesState.value, nodeMovementRows.value, playback.currentTime.value)
  ))

  const originalReceiverMap: ComputedRef<Map<string, ReplayReceiver>> = computed(() => {
    const map = new Map<string, ReplayReceiver>()
    for (const packet of sourcePacketRows.value) {
      for (const receiver of packet.receivers || []) {
        map.set(`${packet.eventId}:${receiver.dst}`, receiver)
      }
    }
    return map
  })
  const originalEditPositions: ComputedRef<ReplayNode[]> = computed(() => [...originalEditPoseById.value.values()])
  const selectedEditNode: ComputedRef<ReplayNode | null> = computed(() => (
    editNodes.value.find((node) => node.node_id === selectedEditNodeId.value) || null
  ))
  const originalSummary = computed(() => summarizePackets(sourcePacketRows.value))
  const simulatedSummary = computed(() => summarizePackets(packetRows.value))

  const nodeById: ComputedRef<Map<number, ReplayNode>> = computed(() => new Map(nodesState.value.map((node) => [node.node_id, node])))
  const packetByPacketId: ComputedRef<Map<string, ReplayPacket>> = computed(() => {
    const map = new Map<string, ReplayPacket>()
    for (const packet of packetRows.value) {
      const prev = map.get(packet.packet_id)
      if (!prev || normalizeTime(packet.tx_start_us) < normalizeTime(prev.tx_start_us)) {
        map.set(packet.packet_id, packet)
      }
    }
    return map
  })

  const packets: ComputedRef<ReplayPacket[]> = computed(() => {
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
  const movementsMaxEndUs = computed(() => nodeMovementRows.value.reduce(
    (maxEnd, movement) => Math.max(maxEnd, movement.end_us),
    0,
  ))
  const cycleEndUs = computed(() => Math.max(
    MIN_SIM_TIME_US,
    normalizeTime(metaState.value.sim_end_us),
    packetsMaxEndUs.value,
    movementsMaxEndUs.value,
  ))

  const packetEntries: ComputedRef<PacketEntry[]> = computed(() => buildPacketEntries(packets.value, {
    nodeById: nodeById.value,
    packetMap: packetByPacketId.value,
    currentTimeUs: playback.currentTime.value,
    originalReceiverMap: originalReceiverMap.value,
    packetRows: packetRows.value,
  }))

  const lifecycleGroups: ComputedRef<LifecycleGroup[]> = computed(() => buildLifecycleGroups(packetEntries.value, playback.currentTime.value))
  const visiblePacketEntries: ComputedRef<PacketEntry[]> = computed(() => packetEntries.value)

  const currentPacketIds: ComputedRef<Set<string>> = computed(() => new Set(
    packetEntries.value
      .filter((packet) => playback.currentTime.value >= packet.startUs && playback.currentTime.value <= packet.endUs)
      .map((packet) => packet.eventId),
  ))

  const activePacket: ComputedRef<PacketEntry | null> = computed(() => {
    for (let i = packetEntries.value.length - 1; i >= 0; i -= 1) {
      const packet = packetEntries.value[i]
      if (playback.currentTime.value >= packet.startUs && playback.currentTime.value <= packet.endUs) {
        return packet
      }
    }
    return null
  })

  const focusedPacket: ComputedRef<PacketEntry | null> = computed(() => (
    playback.focusedPacketId.value
      ? packetEntries.value.find(
        (packet) => packet.eventId === playback.focusedPacketId.value || packet.packet_id === playback.focusedPacketId.value,
      ) || null
      : null
  ))

  const lifecyclePacketOptions = computed(() => lifecycleGroups.value.map((packet) => ({
    id: packet.packet_id,
    label: `${packet.packet_id} · ${packet.sourceLabel} · ${packet.segments.length}段`,
    startUs: packet.startUs,
  })))

  const lifecyclePacket: ComputedRef<LifecycleGroup | null> = computed(() => {
    if (!lifecyclePacketOptions.value.length) return null
    const targetId = selectedLifecyclePacketId.value || lifecyclePacketOptions.value[0].id
    return lifecycleGroups.value.find((packet) => packet.packet_id === targetId) || lifecycleGroups.value[0] || null
  })

  const lifecycleStages: ComputedRef<LifecycleStage[]> = computed(() => buildLifecycleStages(lifecyclePacket.value, playback.currentTime.value))
  const activeLifecycleStage: ComputedRef<LifecycleStage | null> = computed(() => lifecycleStages.value.find((stage) => stage.active) || null)
  const globalActiveEventId: ComputedRef<string | null> = computed(() => activePacket.value?.eventId || null)
  const lifecycleActiveEventId: ComputedRef<string | null> = computed(() => activeLifecycleStage.value?.eventId || null)

  const displayPackets: ComputedRef<PacketEntry[]> = computed(() => {
    if (isEditMode.value && !playback.isPlaying.value) return []
    if (replayMode.value === 'lifecycle' && lifecyclePacket.value) {
      return lifecyclePacket.value.segments
    }

    const activePackets = packetEntries.value.filter(
      (packet) => playback.currentTime.value >= packet.startUs && playback.currentTime.value <= packet.endUs,
    )
    if (showAllActivePackets.value) return activePackets
    if (focusedPacket.value) return [focusedPacket.value]
    return activePacket.value ? [activePacket.value] : []
  })

  const summary = computed(() => summarizePackets(packets.value))

  const txEventsByNode = computed(() => {
    const map = new Map<number, ReplayPacket[]>()
    for (const packet of packets.value) {
      if (!packet.tx_committed) continue
      const list = map.get(packet.src) || []
      list.push(packet)
      map.set(packet.src, list)
    }
    return map
  })

  const rxEventsByNode = computed(() => {
    const map = new Map<number, RxEvent[]>()
    for (const packet of packets.value) {
      for (const receiver of packet.receivers) {
        const list = map.get(receiver.dst) || []
        list.push({
          ...receiver,
          collision_start_us: receiver.collision_start_us as number,
          packet_id: packet.packet_id,
          src: packet.src,
        })
        map.set(receiver.dst, list)
      }
    }
    return map
  })

  const makeVisual = (node: ReplayNode, patch: Partial<NodeVisual>): NodeVisual => ({
    node_id: node.node_id,
    mode: 'idle',
    fillProgress: 0,
    fade: 1,
    statusText: '空闲',
    packetId: null,
    overlay: null,
    ...patch,
  })

  const nodeVisuals = computed(() => {
    const time = playback.currentTime.value

    return nodesState.value.map((node): NodeVisual => {
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
        return makeVisual(node, {
          mode: 'tx',
          fillProgress: clampRatio((time - activeTx.tx_start_us) / Math.max(activeTx.tx_duration_us, 1)),
          statusText: activeRxTxConflict ? '发送中 / rx-tx 冲突' : '发送中',
          packetId: activeTx.packet_id,
          overlay: activeRxTxConflict
            ? { kind: 'collision_rx_tx', strength: 1, packetId: activeRxTxConflict.packet_id }
            : null,
        })
      }

      if (activeRxRxConflict) {
        return makeVisual(node, {
          mode: 'collision',
          fillProgress: 1,
          statusText: '接收冲突',
          packetId: activeRxRxConflict.packet_id,
          overlay: { kind: 'collision_rx_rx', strength: 1, packetId: activeRxRxConflict.packet_id },
        })
      }

      if (activeReceive) {
        return makeVisual(node, {
          mode: 'rx',
          fillProgress: clampRatio((time - activeReceive.rx_start_us) / Math.max(activeReceive.rx_duration_us, 1)),
          statusText: '接收中',
          packetId: activeReceive.packet_id,
        })
      }

      if (preCollisionReceive) {
        return makeVisual(node, {
          mode: 'rx',
          fillProgress: clampRatio((time - preCollisionReceive.rx_start_us) / Math.max(preCollisionReceive.rx_duration_us, 1)),
          statusText: '接收中',
          packetId: preCollisionReceive.packet_id,
        })
      }

      if (recentFailure) {
        const fade = clampRatio(1 - ((time - recentFailure.rx_end_us) / RX_FAIL_HOLD_US))
        return makeVisual(node, {
          mode: 'collision-linger',
          fillProgress: 1,
          fade,
          statusText: reasonLabel(recentFailure.reason),
          packetId: recentFailure.packet_id,
          overlay: { kind: recentFailure.reason ?? 'fail', strength: fade, packetId: recentFailure.packet_id },
        })
      }

      if (recentSuccess) {
        return makeVisual(node, {
          mode: 'rx-done',
          fillProgress: 1,
          fade: clampRatio(1 - ((time - recentSuccess.rx_end_us) / RX_OK_HOLD_US)),
          statusText: '接收成功',
          packetId: recentSuccess.packet_id,
        })
      }

      return makeVisual(node, {})
    })
  })

  const applyParsedLog = (parsed: ParsedLog, exitEdit: () => void = () => {}) => {
    exitEdit()
    baseNodesState.value = enforceMinGap(parsed.nodes)
    nodeMovementRows.value = parsed.movements as unknown as Movement[]
    sourcePacketRows.value = normalizePacketsFromParsed(parsed, uploadedLogName.value || 'node-log')
    parseErrors.value = parsed.parseErrors
    metaState.value = parsed.meta

    playback.focusedPacketId.value = null
    selectedLifecyclePacketId.value = ''
    playback.currentTime.value = 0
    playback.isPlaying.value = false
  }

  const rejectImportedLog = (message: string) => {
    parseErrors.value = [sanitizeDisplayText(message, 120)]
  }

  watch(fxLevel, (next) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.fxLevel, next)
    } catch {
      // ignore persistence errors
    }
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

  return {
    logSourceKey,
    uploadedLogName,
    uploadedNodeLogNames,
    fxLevel,
    replayMode,
    selectedLifecyclePacketId,
    showAllActivePackets,
    interactionMode,
    editSoundSpeed,
    baseNodesState,
    nodeMovementRows,
    sourcePacketRows,
    simulatedPacketRows,
    parseErrors,
    metaState,
    editNodes,
    originalEditPoseById,
    selectedEditNodeId,
    isEditMode,
    isCustomLog,
    activeLogName,
    customLogSelectLabel,
    packetRows,
    nodesState,
    originalReceiverMap,
    originalEditPositions,
    selectedEditNode,
    originalSummary,
    simulatedSummary,
    nodeById,
    packetByPacketId,
    packets,
    cycleEndUs,
    packetEntries,
    lifecycleGroups,
    visiblePacketEntries,
    currentPacketIds,
    activePacket,
    focusedPacket,
    lifecyclePacketOptions,
    lifecyclePacket,
    lifecycleStages,
    activeLifecycleStage,
    globalActiveEventId,
    lifecycleActiveEventId,
    displayPackets,
    summary,
    nodeVisuals,
    applyParsedLog,
    rejectImportedLog,
  }
}

export type ReplayStateApi = ReturnType<typeof useReplayState>
