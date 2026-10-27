import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { LOCAL_STORAGE_KEYS, MIN_SIM_TIME_US } from '@/shared/constants'
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
import { clampRatio, durationForProgress, normalizeTime } from '../lib/format'
import { propagationSpeedFromMeta, usesFractionalTiming } from '../lib/propagation'
import { resolveMovingNodes } from '../lib/logNormalize'
import { normalizePacketsFromParsed } from '../lib/logMerge'
import { createEmptyParsedLog, parseLog } from '../lib/logParser'
import { summarizePackets } from '../lib/geometry'
import { buildNodeVisual, type NodeRxEvent } from '../lib/nodeVisuals'
import { activePacketsAt, indexPacketIntervals } from '../lib/packetTimeline'
import {
  buildLifecycleGroups,
  buildLifecycleStages,
  buildPacketEntries,
} from '../lib/packetEntries'
import type { PlaybackEngine } from './usePlaybackEngine'

export const useReplayState = ({ playback }: { playback: PlaybackEngine }) => {
  const logSourceKey: Ref<string> = ref('default')
  const uploadedLogName: Ref<string> = ref('')
  const uploadedNodeLogNames: Ref<string[]> = ref([])
  const fxLevel: Ref<string> = ref('standard')
  const replayMode: Ref<string> = ref('global')
  const selectedLifecyclePacketId: Ref<string> = ref('')
  const showAllActivePackets: Ref<boolean> = ref(true)
  const interactionMode: Ref<string> = ref('replay')
  const initialParsed: ParsedLog = parseLog(LOG_SOURCES.default.raw)
  const editSoundSpeed: Ref<number> = ref(propagationSpeedFromMeta(initialParsed.meta))

  const baseNodesState: Ref<ReplayNode[]> = ref(initialParsed.nodes.map((node) => ({ ...node })))
  const nodeMovementRows: Ref<Movement[]> = ref(initialParsed.movements as unknown as Movement[])
  const sourcePacketRows: Ref<ReplayPacket[]> = ref(
    normalizePacketsFromParsed(initialParsed, uploadedLogName.value || 'node-log'),
  )
  const simulatedPacketRows: Ref<ReplayPacket[] | null> = ref(null)
  const parseErrors: Ref<string[]> = ref(initialParsed.parseErrors)
  const metaState: Ref<LogMeta> = ref(initialParsed.meta)
  const fractionalTiming = computed(() => usesFractionalTiming(metaState.value))
  const successTraceOnly = computed(() => metaState.value.trace_scope === 'phy-success')
  const editNodes: Ref<ReplayNode[]> = ref([])
  const originalEditPoseById: Ref<Map<number, ReplayNode>> = ref(new Map())
  const selectedEditNodeIds: Ref<number[]> = ref([])
  const selectedEditNodeId = computed(() => selectedEditNodeIds.value.length === 1 ? selectedEditNodeIds.value[0] : null)

  const isEditMode: ComputedRef<boolean> = computed(() => interactionMode.value === 'edit')
  const isCustomLog: ComputedRef<boolean> = computed(() => ['upload', 'node-upload', 'topology'].includes(logSourceKey.value))
  const activeLogName: ComputedRef<string> = computed(() => {
    if (logSourceKey.value === 'topology') return '实验拓扑（尚未仿真）'
    if (logSourceKey.value === 'upload' && uploadedLogName.value) return uploadedLogName.value
    if (logSourceKey.value === 'node-upload' && uploadedNodeLogNames.value.length) {
      const names = uploadedNodeLogNames.value
      if (names.length <= 2) return names.join(' + ')
      return `${names[0]} + ${names.length - 1} 个节点日志`
    }
    return (LOG_SOURCES[logSourceKey.value] || LOG_SOURCES.default).fileName
  })
  const customLogSelectLabel: ComputedRef<string> = computed(() => {
    if (logSourceKey.value === 'topology') return '实验拓扑（尚未仿真）'
    if (logSourceKey.value === 'upload') return `已导入：${uploadedLogName.value || '自定义日志'}`
    if (logSourceKey.value === 'node-upload') return `已导入：${activeLogName.value}`
    return ''
  })

  const packetRows: ComputedRef<ReplayPacket[]> = computed(() => (
    isEditMode.value && simulatedPacketRows.value
      ? simulatedPacketRows.value
      : sourcePacketRows.value
  ))
  const staticNodes = computed(() => {
    const nodes = baseNodesState.value
    // Preserve the existing last-record-wins behavior for duplicate node IDs.
    const byId = new Map(nodes.map((node) => [node.node_id, node]))
    return byId.size === nodes.length ? nodes : [...byId.values()]
  })
  const nodesState: ComputedRef<ReplayNode[]> = computed(() => {
    if (isEditMode.value) return editNodes.value
    if (!nodeMovementRows.value.length) return staticNodes.value
    return resolveMovingNodes(baseNodesState.value, nodeMovementRows.value, playback.currentTime.value)
  })

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

  // Packet labels depend on topology metadata, not interpolated frame positions.
  const nodeById: ComputedRef<Map<number, ReplayNode>> = computed(() => new Map(
    (isEditMode.value ? editNodes.value : baseNodesState.value).map((node) => [node.node_id, node]),
  ))
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
    originalReceiverMap: originalReceiverMap.value,
    packetRows: packetRows.value,
    fractionalTiming: fractionalTiming.value,
  }))

  const lifecycleGroups: ComputedRef<LifecycleGroup[]> = computed(() => buildLifecycleGroups(packetEntries.value, fractionalTiming.value))
  const visiblePacketEntries: ComputedRef<PacketEntry[]> = computed(() => packetEntries.value)

  const packetIntervalIndex = computed(() => indexPacketIntervals(packetEntries.value))
  const activePacketEntries = computed(() => activePacketsAt(packetIntervalIndex.value, playback.currentTime.value))

  const currentPacketIds: ComputedRef<Set<string>> = computed(() => new Set(
    activePacketEntries.value.map((packet) => packet.eventId),
  ))

  const activePacket: ComputedRef<PacketEntry | null> = computed(() => activePacketEntries.value.at(-1) || null)

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

  const lifecycleStageMetadata = computed(() => buildLifecycleStages(lifecyclePacket.value, 0, fractionalTiming.value))
  const lifecycleStages: ComputedRef<LifecycleStage[]> = computed(() => {
    const time = playback.currentTime.value
    return lifecycleStageMetadata.value.map((stage) => ({
      ...stage,
      progressPct: clampRatio((time - stage.startUs) / durationForProgress(stage.endUs - stage.startUs, fractionalTiming.value)) * 100,
      active: time >= stage.startUs && time <= stage.endUs,
    }))
  })
  const activeLifecycleStage: ComputedRef<LifecycleStage | null> = computed(() => lifecycleStages.value.find((stage) => stage.active) || null)
  const globalActiveEventId: ComputedRef<string | null> = computed(() => activePacket.value?.eventId || null)
  const lifecycleActiveEventId: ComputedRef<string | null> = computed(() => activeLifecycleStage.value?.eventId || null)

  const displayPackets: ComputedRef<PacketEntry[]> = computed(() => {
    if (isEditMode.value && !playback.isPlaying.value) return []
    if (replayMode.value === 'lifecycle' && lifecyclePacket.value) {
      return lifecyclePacket.value.segments
    }

    if (showAllActivePackets.value) return activePacketEntries.value
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
    const map = new Map<number, NodeRxEvent[]>()
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

  const nodeVisuals: ComputedRef<NodeVisual[]> = computed(() => {
    const time = playback.currentTime.value
    const txByNode = txEventsByNode.value
    const rxByNode = rxEventsByNode.value
    return nodesState.value.map((node) => buildNodeVisual(
      node, txByNode.get(node.node_id) || [], rxByNode.get(node.node_id) || [], time, fractionalTiming.value,
    ))
  })

  const applyParsedLog = (parsed: ParsedLog, exitEdit: () => void = () => {}) => {
    // Prepare before replacing the current log, so a malformed record cannot
    // leave the existing replay half-updated. World coordinates stay unchanged.
    const nextNodes = parsed.nodes.map((node) => ({ ...node }))
    const nextPackets = normalizePacketsFromParsed(parsed, uploadedLogName.value || 'node-log')
    exitEdit()
    selectedEditNodeIds.value = []
    baseNodesState.value = nextNodes
    nodeMovementRows.value = parsed.movements as unknown as Movement[]
    sourcePacketRows.value = nextPackets
    parseErrors.value = parsed.parseErrors
    metaState.value = parsed.meta
    editSoundSpeed.value = propagationSpeedFromMeta(parsed.meta)

    playback.focusedPacketId.value = null
    selectedLifecyclePacketId.value = ''
    playback.currentTime.value = 0
    playback.isPlaying.value = false
  }

  const applyTopology = (nodes: ReplayNode[], exitEdit: () => void = () => {}) => {
    const parsed = createEmptyParsedLog()
    parsed.nodes = nodes.map((node) => ({
      type: 'node', node_id: node.node_id, name: node.name || `Node-${node.node_id}`,
      role: node.role || 'node', x: node.x, y: node.y, z: node.z ?? 0,
    }))
    logSourceKey.value = 'topology'
    uploadedLogName.value = ''
    uploadedNodeLogNames.value = []
    applyParsedLog(parsed, exitEdit)
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
    fractionalTiming,
    successTraceOnly,
    baseNodesState,
    nodeMovementRows,
    sourcePacketRows,
    simulatedPacketRows,
    parseErrors,
    metaState,
    editNodes,
    originalEditPoseById,
    selectedEditNodeId,
    selectedEditNodeIds,
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
    applyTopology,
    rejectImportedLog,
  }
}

export type ReplayStateApi = ReturnType<typeof useReplayState>
