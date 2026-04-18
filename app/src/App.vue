<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import netLogDefaultText from './assets/net.log?raw'
import netLogMultiHopText from './assets/net_multihop.log?raw'
import netLogMultiHopComplexText from './assets/net_multihop_complex.log?raw'
import NodeCanvas from './components/NodeCanvas.vue'

const NodeScene3D = defineAsyncComponent(() => import('./components/NodeScene3D.vue'))

const SOUND_SPEED_MPS = 1500
const MIN_NODE_GAP_M = 1000
const MIN_SIM_TIME_US = 10_000_000
const RX_OK_HOLD_US = 180_000
const RX_FAIL_HOLD_US = 220_000

const normalizeTime = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const clampRatio = (value) => Math.max(0, Math.min(1, Number(value) || 0))

const timeDisplay = (us) => {
  if (us >= 1_000_000) return `${(us / 1_000_000).toFixed(2)} s`
  return `${(us / 1000).toFixed(2)} ms`
}

const reasonLabel = (reason) => {
  if (reason === 'collision_rx_rx') return 'rx-rx 冲突'
  if (reason === 'collision_rx_tx') return 'rx-tx 冲突'
  if (reason === 'below_rx_thresh') return '门限不足（信号低于接收阈值）'
  return '接收失败'
}

const packetTagLabel = (kind) => {
  if (kind === 'ok') return '全成功'
  if (kind === 'mixed') return '混合结果'
  return '全失败'
}

const packetTagClass = (kind) => {
  if (kind === 'ok') return 'tag-ok'
  if (kind === 'mixed') return 'tag-mixed'
  return 'tag-fail'
}

const receiverPillClass = (receiver) => {
  if (receiver.status === 'ok') return 'receiver-pill-ok'
  if (receiver.reason === 'collision_rx_tx') return 'receiver-pill-rxtx'
  if (receiver.reason === 'collision_rx_rx') return 'receiver-pill-rxrx'
  return 'receiver-pill-fail'
}

const deriveReasonFromLegacy = (result) => {
  if (result === 'collision') return 'collision_rx_rx'
  if (result === 'half_duplex_busy') return 'collision_rx_tx'
  if (result === 'below_snr' || result === 'out_of_range') return 'below_rx_thresh'
  return 'decode_error'
}

const parseLog = (raw) => {
  const lines = String(raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const nodes = []
  const packets = []
  const tx = []
  const rx = []
  const parseErrors = []
  const meta = {
    type: 'meta',
    schema: 'uan-vis-packet-log/v1',
    time_unit: 'us',
    distance_unit: 'm',
    sim_end_us: 0,
  }

  for (const line of lines) {
    try {
      const obj = JSON.parse(line)

      if (obj.type === 'meta') {
        Object.assign(meta, obj)
      } else if (obj.type === 'node' && Number.isFinite(Number(obj.node_id))) {
        nodes.push({
          ...obj,
          node_id: Number(obj.node_id),
          x: Number(obj.x ?? 0),
          y: Number(obj.y ?? 0),
          z: Number(obj.z ?? 0),
        })
      } else if (obj.type === 'packet' && Number.isFinite(Number(obj.src))) {
        packets.push({ ...obj })
      } else if (obj.type === 'tx') {
        tx.push({ ...obj })
      } else if (obj.type === 'rx') {
        rx.push({ ...obj })
      }
    } catch {
      parseErrors.push(line)
    }
  }

  return { nodes, packets, tx, rx, parseErrors, meta }
}

const normalizeReceiver = (packetId, receiver, index, fallbackDurationUs) => {
  const startUs = normalizeTime(receiver.rx_start_us ?? receiver.start_us)
  const durationUs = Math.max(1, normalizeTime(receiver.rx_duration_us ?? receiver.duration_us ?? fallbackDurationUs))
  const rawStatus = receiver.status
  const status = rawStatus === 'ok' || receiver.result === 'ok' ? 'ok' : 'fail'

  return {
    ...receiver,
    receiver_id: receiver.receiver_id || `${packetId}-rx-${index + 1}`,
    dst: Number(receiver.dst),
    status,
    reason: status === 'ok' ? null : String(receiver.reason || deriveReasonFromLegacy(receiver.result)),
    with: Array.isArray(receiver.with)
      ? receiver.with.map(String)
      : Array.isArray(receiver.collided_with)
        ? receiver.collided_with.map(String)
        : [],
    rx_start_us: startUs,
    rx_duration_us: durationUs,
    rx_end_us: startUs + durationUs,
  }
}

const normalizePacket = (packet, index) => {
  const packetId = String(packet.packet_id || packet.tx_id || `pkt-${index + 1}`)
  const eventId = String(packet.event_id || packet.tx_id || `${packetId}-seg-${index + 1}`)
  const txStartUs = normalizeTime(packet.tx_start_us ?? packet.start_us)
  const txDurationUs = Math.max(1, normalizeTime(packet.tx_duration_us ?? packet.duration_us))
  const txEndUs = normalizeTime(packet.tx_end_us ?? packet.end_us ?? (txStartUs + txDurationUs))
  const receivers = Array.isArray(packet.receivers)
    ? packet.receivers
      .map((receiver, receiverIndex) => normalizeReceiver(packetId, receiver, receiverIndex, txDurationUs))
      .filter((receiver) => Number.isFinite(receiver.dst))
      .sort((a, b) => a.rx_start_us - b.rx_start_us)
    : []

  const packetEndUs = Math.max(txEndUs, ...receivers.map((receiver) => receiver.rx_end_us))
  return {
    ...packet,
    type: 'packet',
    eventId,
    packet_id: packetId,
    src: Number(packet.src),
    tx_start_us: txStartUs,
    tx_duration_us: txDurationUs,
    tx_end_us: txEndUs,
    timeStart: txStartUs,
    timeEnd: packetEndUs,
    receivers,
  }
}

const buildPacketsFromLegacy = (txRows, rxRows) => {
  const rxByTx = new Map()
  for (const item of rxRows) {
    const list = rxByTx.get(item.tx_id) || []
    list.push(item)
    rxByTx.set(item.tx_id, list)
  }

  return txRows.map((txItem, index) => ({
    type: 'packet',
    event_id: String(txItem.tx_id || `tx-${index + 1}`),
    tx_id: String(txItem.tx_id || `tx-${index + 1}`),
    packet_id: String(txItem.packet_uid || txItem.tx_id || `pkt-${index + 1}`),
    src: Number(txItem.src),
    tx_start_us: normalizeTime(txItem.start_us),
    tx_duration_us: Math.max(1, normalizeTime(txItem.duration_us)),
    receivers: (rxByTx.get(txItem.tx_id) || []).map((rxItem) => ({
      receiver_id: String(rxItem.rx_id || `${txItem.tx_id || `tx-${index + 1}`}-rx-${rxItem.dst || 'x'}`),
      dst: Number(rxItem.dst),
      rx_start_us: normalizeTime(rxItem.start_us),
      rx_duration_us: Math.max(1, normalizeTime(rxItem.duration_us || txItem.duration_us)),
      status: rxItem.result === 'ok' ? 'ok' : 'fail',
      reason: rxItem.result === 'ok' ? null : deriveReasonFromLegacy(rxItem.result),
      with: Array.isArray(rxItem.collided_with) ? rxItem.collided_with.map(String) : [],
    })),
  }))
}

const enforceMinGap = (nodes) => {
  if (nodes.length < 2) return nodes.map((node) => ({ ...node }))

  let minGap = Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]
      const b = nodes[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dz = (a.z ?? 0) - (b.z ?? 0)
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d > 0 && d < minGap) minGap = d
    }
  }

  if (!Number.isFinite(minGap) || minGap >= MIN_NODE_GAP_M || minGap <= 0) {
    return nodes.map((node) => ({ ...node }))
  }

  const cx = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length
  const cy = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length
  const scale = MIN_NODE_GAP_M / minGap

  return nodes.map((node) => ({
    ...node,
    x: cx + (node.x - cx) * scale,
    y: cy + (node.y - cy) * scale,
  }))
}

const distanceMeters = (a, b) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

const LOG_SOURCES = Object.freeze({
  default: {
    label: '默认日志（net.log）',
    raw: netLogDefaultText,
  },
  multihop: {
    label: '多跳转发日志（net_multihop.log）',
    raw: netLogMultiHopText,
  },
  complex: {
    label: '复杂冲突日志（net_multihop_complex.log）',
    raw: netLogMultiHopComplexText,
  },
})

const THEME_OPTIONS = Object.freeze([
  { key: 'ocean-sonar', label: '海洋声呐' },
  { key: 'research-lab', label: '科研仪表盘' },
  { key: 'tactical-ops', label: '战术态势' },
  { key: 'industrial-scada', label: '工业监控' },
  { key: 'cyber-neon', label: '赛博霓虹' },
  { key: 'light-minimal', label: '极简浅色' },
  { key: 'gis-map', label: 'GIS地图' },
  { key: 'timeline-story', label: '时间轴叙事' },
])
const FX_LEVEL_OPTIONS = Object.freeze([
  { key: 'standard', label: '标准' },
  { key: 'extreme', label: 'Beta' },
])
const UNDERWATER_DETAIL_OPTIONS = Object.freeze([
  { key: 'low', label: '轻量' },
  { key: 'standard', label: '标准' },
  { key: 'cinematic', label: '电影级' },
])

const normalizePacketsFromParsed = (parsed) => (
  (parsed.packets.length > 0 ? parsed.packets : buildPacketsFromLegacy(parsed.tx, parsed.rx))
    .map((packet, index) => normalizePacket(packet, index))
)

const initialParsed = parseLog(LOG_SOURCES.default.raw)
const logSourceKey = ref('default')
const selectedTheme = ref('ocean-sonar')
const fxLevel = ref('standard')
const underwaterDetail = ref('standard')
const isMuted = ref(false)
const nodesState = ref(enforceMinGap(initialParsed.nodes))
const packetRows = ref(normalizePacketsFromParsed(initialParsed))
const parseErrors = ref(initialParsed.parseErrors)
const metaState = ref(initialParsed.meta)

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
const cycleEndUs = computed(() => Math.max(MIN_SIM_TIME_US, normalizeTime(metaState.value.sim_end_us), packetsMaxEndUs.value))
const currentTime = ref(0)
const rangeProgressStyle = computed(() => `${((currentTime.value / Math.max(1, cycleEndUs.value)) * 100).toFixed(2)}%`)

const focusedPacketId = ref(null)
const replayMode = ref('global')
const selectedLifecyclePacketId = ref('')
const isPlaying = ref(false)
const speed = ref(1)
const showAllActivePackets = ref(true)
const visualMode = ref('2d')
const activeDragEvent = ref(null)
const suppressLogClick = ref(null)
const globalLogListEl = ref(null)
const lifecycleLogListEl = ref(null)
let raf = 0
let lastTs = 0
let audioCtx = null
let audioMaster = null
let schedulerTimer = null
let bgmStep = 0
let bgmNextTime = 0

const BGM_PATTERN = Object.freeze([
  [110, 164.81],
  [123.47, 185],
  [130.81, 196],
  [146.83, 220],
  [123.47, 185],
  [110, 164.81],
  [98, 146.83],
  [92.5, 138.59],
])

const clampTime = (us) => Math.max(0, Math.min(cycleEndUs.value, normalizeTime(us)))

const packetEntries = computed(() => packets.value.map((packet) => {
  const sourceNode = nodeById.value.get(packet.src)
  const receivers = packet.receivers.map((receiver) => {
    const dstNode = nodeById.value.get(receiver.dst)
    const overlapHint = receiver.status !== 'ok'
      && Array.isArray(receiver.with)
      && receiver.with.length > 0
      ? `（与 ${receiver.with.join(', ')} 重叠）`
      : ''
    const reason = receiver.status === 'ok' ? '成功' : `${reasonLabel(receiver.reason)}${overlapHint}`
    const tone = receiver.status === 'ok'
      ? 'ok'
      : receiver.reason === 'collision_rx_tx'
        ? 'rxtx'
        : receiver.reason === 'collision_rx_rx'
          ? 'rxrx'
          : 'fail'

    return {
      ...receiver,
      dstLabel: dstNode ? dstNode.name : `Node-${receiver.dst}`,
      reasonLabel: reason,
      tone,
    }
  })

  const okCount = receivers.filter((receiver) => receiver.status === 'ok').length
  const failCount = receivers.length - okCount
  const rxrxCount = receivers.filter((receiver) => receiver.reason === 'collision_rx_rx').length
  const rxtxCount = receivers.filter((receiver) => receiver.reason === 'collision_rx_tx').length
  const packetKind = failCount === 0 ? 'ok' : (okCount > 0 ? 'mixed' : 'fail')
  const totalDurationUs = Math.max(1, packet.timeEnd - packet.tx_start_us)
  const progressPct = clampRatio((currentTime.value - packet.tx_start_us) / totalDurationUs) * 100

  return {
    ...packet,
    sourceLabel: sourceNode ? sourceNode.name : `Node-${packet.src}`,
    receivers,
    okCount,
    failCount,
    rxrxCount,
    rxtxCount,
    packetKind,
    packetKindLabel: packetTagLabel(packetKind),
    packetKindClass: packetTagClass(packetKind),
    packetDurationLabel: timeDisplay(totalDurationUs),
    prettyTime: timeDisplay(packet.tx_start_us),
    progressPct,
    startUs: packet.tx_start_us,
    endUs: packet.timeEnd,
  }
}))

const lifecycleGroups = computed(() => {
  const groups = new Map()
  for (const entry of packetEntries.value) {
    const key = entry.packet_id
    const existing = groups.get(key) || {
      packet_id: key,
      sourceLabel: entry.sourceLabel,
      startUs: Number.POSITIVE_INFINITY,
      endUs: 0,
      segments: [],
    }
    existing.startUs = Math.min(existing.startUs, entry.startUs)
    existing.endUs = Math.max(existing.endUs, entry.endUs)
    existing.segments.push(entry)
    groups.set(key, existing)
  }

  return [...groups.values()]
    .map((group) => {
      const sortedSegments = group.segments.slice().sort((a, b) => a.startUs - b.startUs)
      const allReceivers = sortedSegments.flatMap((segment) => segment.receivers)
      const okCount = allReceivers.filter((receiver) => receiver.status === 'ok').length
      const failCount = allReceivers.length - okCount
      const rxrxCount = allReceivers.filter((receiver) => receiver.reason === 'collision_rx_rx').length
      const rxtxCount = allReceivers.filter((receiver) => receiver.reason === 'collision_rx_tx').length
      const packetKind = failCount === 0 ? 'ok' : (okCount > 0 ? 'mixed' : 'fail')
      const totalDurationUs = Math.max(1, group.endUs - group.startUs)
      const progressPct = clampRatio((currentTime.value - group.startUs) / totalDurationUs) * 100

      return {
        ...group,
        segments: sortedSegments,
        okCount,
        failCount,
        rxrxCount,
        rxtxCount,
        packetKind,
        packetKindLabel: packetTagLabel(packetKind),
        packetKindClass: packetTagClass(packetKind),
        packetDurationLabel: timeDisplay(totalDurationUs),
        prettyTime: timeDisplay(group.startUs),
        progressPct,
      }
    })
    .sort((a, b) => a.startUs - b.startUs)
})

const visiblePacketEntries = computed(() => packetEntries.value.slice(-120))

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

const lifecycleStages = computed(() => {
  if (!lifecyclePacket.value) return []

  const stages = []
  for (const segment of lifecyclePacket.value.segments) {
    stages.push({
      eventId: `${segment.eventId}-tx`,
      type: 'tx',
      status: 'ok',
      title: `${segment.sourceLabel} 发射`,
      detail: `${lifecyclePacket.value.packet_id} · 段 ${segment.eventId} · 时长 ${timeDisplay(segment.tx_duration_us)}`,
      startUs: segment.tx_start_us,
      endUs: segment.tx_end_us,
    })

    for (const receiver of segment.receivers) {
      const status = receiver.status === 'ok'
        ? 'ok'
        : receiver.reason === 'collision_rx_tx'
          ? 'rxtx'
          : receiver.reason === 'collision_rx_rx'
            ? 'rxrx'
            : 'fail'

      stages.push({
        eventId: receiver.receiver_id,
        type: 'rx',
        status,
        title: `${receiver.dstLabel} 接收`,
        detail: `${receiver.reasonLabel} · 段 ${segment.eventId} · 时长 ${timeDisplay(receiver.rx_duration_us)}`,
        startUs: receiver.rx_start_us,
        endUs: receiver.rx_end_us,
      })
    }
  }

  return stages
    .sort((a, b) => a.startUs - b.startUs)
    .map((stage) => {
      const totalUs = Math.max(1, stage.endUs - stage.startUs)
      const progressPct = clampRatio((currentTime.value - stage.startUs) / totalUs) * 100
      return {
        ...stage,
        progressPct,
        active: currentTime.value >= stage.startUs && currentTime.value <= stage.endUs,
      }
    })
})

const activeLifecycleStage = computed(() => lifecycleStages.value.find((stage) => stage.active) || null)
const globalActiveEventId = computed(() => activePacket.value?.eventId || null)
const lifecycleActiveEventId = computed(() => activeLifecycleStage.value?.eventId || null)

const displayPackets = computed(() => {
  if (replayMode.value === 'lifecycle' && lifecyclePacket.value) {
    return lifecyclePacket.value.segments
  }

  const activePackets = packetEntries.value.filter((packet) => currentTime.value >= packet.startUs && currentTime.value <= packet.endUs)
  if (showAllActivePackets.value) return activePackets
  if (focusedPacket.value) return [focusedPacket.value]
  return activePacket.value ? [activePacket.value] : []
})

const summary = computed(() => {
  let okReceivers = 0
  let rxrxCollisions = 0
  let rxtxCollisions = 0

  for (const packet of packets.value) {
    for (const receiver of packet.receivers) {
      if (receiver.status === 'ok') okReceivers += 1
      if (receiver.reason === 'collision_rx_rx') rxrxCollisions += 1
      if (receiver.reason === 'collision_rx_tx') rxtxCollisions += 1
    }
  }

  return {
    packetCount: packets.value.length,
    okReceivers,
    rxrxCollisions,
    rxtxCollisions,
  }
})

const txEventsByNode = computed(() => {
  const map = new Map()
  for (const packet of packets.value) {
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

const formatNodeGap = () => {
  if (nodesState.value.length < 2) return '1.00 km'

  let minGap = Infinity
  for (let i = 0; i < nodesState.value.length; i += 1) {
    for (let j = i + 1; j < nodesState.value.length; j += 1) {
      minGap = Math.min(minGap, distanceMeters(nodesState.value[i], nodesState.value[j]))
    }
  }

  return `${(minGap / 1000).toFixed(2)} km`
}

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

const makeVoice = (ctx, destination, frequency, when, duration, options = {}) => {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  osc.type = options.type || 'triangle'
  osc.frequency.setValueAtTime(frequency, when)
  if (options.detune) osc.detune.setValueAtTime(options.detune, when)

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(options.cutoff ?? 900, when)
  filter.Q.value = 0.6

  const attack = options.attack ?? 0.02
  const release = options.release ?? 0.22
  const peak = options.volume ?? 0.08
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(peak, when + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(attack + 0.02, duration - release))

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  osc.start(when)
  osc.stop(when + duration)
}

const makeTick = (ctx, destination, when, duration = 0.07, volume = 0.02) => {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  osc.type = 'square'
  osc.frequency.setValueAtTime(880, when)
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(1300, when)
  gain.gain.setValueAtTime(0.0001, when)
  gain.gain.exponentialRampToValueAtTime(volume, when + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  osc.start(when)
  osc.stop(when + duration)
}

const playUnlockChime = (ctx, destination, startAt) => {
  makeVoice(ctx, destination, 392, startAt, 0.18, {
    type: 'sine',
    volume: 0.035,
    cutoff: 2400,
    attack: 0.01,
    release: 0.1,
  })
  makeVoice(ctx, destination, 523.25, startAt + 0.12, 0.22, {
    type: 'triangle',
    volume: 0.042,
    cutoff: 2600,
    attack: 0.01,
    release: 0.14,
  })
}

const scheduleBgmTick = () => {
  if (!audioCtx || !audioMaster || isMuted.value) return
  const lookAhead = 0.36
  const stepLen = 0.31
  while (bgmNextTime < audioCtx.currentTime + lookAhead) {
    const [bass, pulse] = BGM_PATTERN[bgmStep % BGM_PATTERN.length]
    makeVoice(audioCtx, audioMaster, bass, bgmNextTime, stepLen * 1.45, {
      type: 'sawtooth',
      volume: 0.06,
      cutoff: 760,
      attack: 0.025,
      release: 0.34,
    })

    makeVoice(audioCtx, audioMaster, pulse, bgmNextTime + 0.03, stepLen * 0.82, {
      type: 'triangle',
      volume: 0.048,
      cutoff: 2100,
      attack: 0.01,
      release: 0.18,
    })

    if (bgmStep % 4 === 3) {
      makeVoice(audioCtx, audioMaster, pulse * 1.5, bgmNextTime + 0.12, stepLen * 0.5, {
        type: 'sine',
        volume: 0.032,
        cutoff: 2600,
        attack: 0.01,
        release: 0.16,
      })
    }
    makeTick(audioCtx, audioMaster, bgmNextTime + 0.015, 0.06, 0.015)
    if (bgmStep % 2 === 1) {
      makeTick(audioCtx, audioMaster, bgmNextTime + 0.17, 0.05, 0.012)
    }

    bgmStep += 1
    bgmNextTime += stepLen
  }
}

const ensureBgm = async () => {
  if (isMuted.value) return
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextCtor) return

  if (!audioCtx) {
    audioCtx = new AudioContextCtor()
    audioMaster = audioCtx.createGain()
    audioMaster.gain.value = 0.0001
    audioMaster.connect(audioCtx.destination)
    bgmNextTime = audioCtx.currentTime + 0.05
    schedulerTimer = window.setInterval(scheduleBgmTick, 80)
  }

  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume()
    } catch {
      return
    }
  }

  audioMaster.gain.cancelScheduledValues(audioCtx.currentTime)
  audioMaster.gain.setValueAtTime(Math.max(0.0001, audioMaster.gain.value), audioCtx.currentTime)
  audioMaster.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.2)
  scheduleBgmTick()
  if (bgmStep < 2) {
    playUnlockChime(audioCtx, audioMaster, audioCtx.currentTime + 0.03)
  }
}

const setMuteState = async (nextMuted) => {
  isMuted.value = nextMuted
  try {
    localStorage.setItem('aquasim_mute', nextMuted ? '1' : '0')
  } catch {
    // ignore persistence errors
  }

  if (nextMuted) {
    if (audioCtx && audioMaster) {
      audioMaster.gain.cancelScheduledValues(audioCtx.currentTime)
      audioMaster.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15)
    }
    return
  }

  await ensureBgm()
}

const toggleMute = () => {
  setMuteState(!isMuted.value)
}

const onJump = (event) => {
  const next = Number(event.target.value)
  if (Number.isFinite(next)) seekTime(next)
  ensureBgm()
}

const onSpeed = (event) => {
  speed.value = Number(event.target.value)
  ensureBgm()
}

const onLogSourceChange = (event) => {
  logSourceKey.value = event.target.value
}

const onThemeChange = (event) => {
  selectedTheme.value = event.target.value
  ensureBgm()
}

const onFxLevelChange = (event) => {
  fxLevel.value = event.target.value
}

const onUnderwaterDetailChange = (event) => {
  underwaterDetail.value = event.target.value
}

const onReplayModeChange = (event) => {
  replayMode.value = event.target.value
  ensureBgm()
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
  ensureBgm()
}

const onKeydown = (event) => {
  if (event.code !== 'Space' || (event.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|OPTION)$/i.test(event.target.tagName))) {
    return
  }
  event.preventDefault()
  togglePlay()
  ensureBgm()
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
  ensureBgm()
}

const onLifecycleStageSelect = (stage) => {
  if (!stage) return
  seekTime(stage.startUs)
  ensureBgm()
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
  ensureBgm()
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
  ensureBgm()
  raf = requestAnimationFrame(tick)
})

watch(logSourceKey, (nextKey) => {
  const source = LOG_SOURCES[nextKey] || LOG_SOURCES.default
  const parsed = parseLog(source.raw)
  nodesState.value = enforceMinGap(parsed.nodes)
  packetRows.value = normalizePacketsFromParsed(parsed)
  parseErrors.value = parsed.parseErrors
  metaState.value = parsed.meta

  focusedPacketId.value = null
  selectedLifecyclePacketId.value = ''
  currentTime.value = 0
  isPlaying.value = false
  lastTs = 0
}, { immediate: false })

watch(selectedTheme, (next) => {
  try {
    localStorage.setItem('aquasim_theme', next)
  } catch {
    // ignore persistence errors
  }
})

watch(fxLevel, (next) => {
  try {
    localStorage.setItem('aquasim_fx_level', next)
  } catch {
    // ignore persistence errors
  }
})

watch(underwaterDetail, (next) => {
  try {
    localStorage.setItem('aquasim_underwater_detail', next)
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

onMounted(() => {
  try {
    const saved = localStorage.getItem('aquasim_theme')
    if (saved && THEME_OPTIONS.some((item) => item.key === saved)) {
      selectedTheme.value = saved
    }
    const savedFx = localStorage.getItem('aquasim_fx_level')
    if (savedFx && FX_LEVEL_OPTIONS.some((item) => item.key === savedFx)) {
      fxLevel.value = savedFx
    }
    const savedUnderwaterDetail = localStorage.getItem('aquasim_underwater_detail')
    if (savedUnderwaterDetail && UNDERWATER_DETAIL_OPTIONS.some((item) => item.key === savedUnderwaterDetail)) {
      underwaterDetail.value = savedUnderwaterDetail
    }
    isMuted.value = localStorage.getItem('aquasim_mute') === '1'
  } catch {
    // ignore persistence errors
  }

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('pointermove', onGlobalPointerMove)
  window.addEventListener('pointerup', onGlobalPointerUp)
  window.addEventListener('pointercancel', onGlobalPointerUp)
  window.addEventListener('pointerdown', ensureBgm, { once: true })
  window.addEventListener('keydown', ensureBgm, { once: true })
  window.addEventListener('touchstart', ensureBgm, { once: true, passive: true })
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', onGlobalPointerMove)
  window.removeEventListener('pointerup', onGlobalPointerUp)
  window.removeEventListener('pointercancel', onGlobalPointerUp)
  window.removeEventListener('pointerdown', ensureBgm)
  window.removeEventListener('keydown', ensureBgm)
  window.removeEventListener('touchstart', ensureBgm)
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
    audioMaster = null
  }
})
</script>

<template>
  <div class="page-wrap" :class="[`theme-${selectedTheme}`, `fx-${fxLevel}`]">
    <header class="topbar">
      <div>
        <p class="eyebrow">ns-3 Acoustic Replay</p>
        <h1>节点状态回放</h1>
      </div>
      <p class="meta">
        当前：{{ timeDisplay(currentTime) }} / {{ timeDisplay(cycleEndUs) }}
        <span v-if="focusedPacket"> | 聚焦：{{ focusedPacket.packet_id }}</span>
      </p>
    </header>

    <section class="panel card-grid">
      <div class="card visual">
        <div class="card-title-row">
          <div class="card-title">节点状态视图</div>
          <div class="view-switch" role="tablist" aria-label="视图模式">
            <span class="view-switch-indicator" :class="{ right: visualMode === '3d' }" aria-hidden="true"></span>
            <button class="view-switch-btn" :class="{ active: visualMode === '2d' }" @click="visualMode = '2d'">2D</button>
            <button class="view-switch-btn" :class="{ active: visualMode === '3d' }" @click="visualMode = '3d'">3D</button>
          </div>
        </div>
        <div class="visual-main">
          <NodeCanvas
            v-if="visualMode === '2d'"
            :nodes="nodesState"
            :node-visuals="nodeVisuals"
            :visible-packets="displayPackets"
            :current-time="currentTime"
            :theme-key="selectedTheme"
            :fx-level="fxLevel"
            :underwater-detail="underwaterDetail"
            :is-muted="isMuted"
            @pause-request="pauseForTool"
            @toggle-mute="toggleMute"
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
                :is-muted="isMuted"
                @toggle-mute="toggleMute"
              />
            </template>
            <template #fallback>
              <div class="visual-loading">
                <div class="visual-loading-core" aria-hidden="true">
                  <span class="visual-loading-ring ring-a"></span>
                  <span class="visual-loading-ring ring-b"></span>
                  <span class="visual-loading-dot"></span>
                </div>
                <p class="visual-loading-title">3D 视图加载中</p>
                <p class="visual-loading-text">正在初始化 Babylon 场景与节点材质</p>
              </div>
            </template>
          </Suspense>
        </div>
        <div class="visual-timeline">
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

      <aside class="card log">
        <div class="side-controls">
          <div class="control-actions">
            <div class="control-btn-row">
              <button class="btn btn-compact primary" @click="togglePlay">{{ isPlaying ? '暂停' : '播放' }}</button>
              <button class="btn btn-compact" @click="reset">重置</button>
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
                  <option :value="0.05">0.05x</option>
                  <option :value="0.1">0.1x</option>
                  <option :value="0.25">0.25x</option>
                  <option :value="0.5">0.5x</option>
                  <option :value="1">1x</option>
                  <option :value="2">2x</option>
                  <option :value="4">4x</option>
                </select>
              </label>
              <label class="field field-compact">
                <div class="field-head"><span>日志源</span></div>
                <select class="select" :value="logSourceKey" @change="onLogSourceChange">
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
              <label class="field field-compact">
                <div class="field-head"><span>主题风格</span></div>
                <select class="select" :value="selectedTheme" @change="onThemeChange">
                  <option
                    v-for="theme in THEME_OPTIONS"
                    :key="theme.key"
                    :value="theme.key"
                  >
                    {{ theme.label }}
                  </option>
                </select>
              </label>
              <label class="field field-compact">
                <div class="field-head"><span>特效等级</span></div>
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
              <label class="field field-compact" :class="{ 'field-hidden': fxLevel === 'standard' }">
                <div class="field-head"><span>水下环境</span></div>
                <select class="select" :value="underwaterDetail" @change="onUnderwaterDetailChange">
                  <option
                    v-for="item in UNDERWATER_DETAIL_OPTIONS"
                    :key="item.key"
                    :value="item.key"
                  >
                    {{ item.label }}
                  </option>
                </select>
              </label>
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
          </div>
        </div>
        <div class="card-title">{{ replayMode === 'lifecycle' ? '包生命周期阶段' : '包级日志（旧在上，新在下）' }}</div>

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
                  <span class="tag" :class="stage.type === 'tx' ? 'tag-ok' : (stage.status === 'ok' ? 'tag-ok' : (stage.status === 'rxrx' ? 'tag-fail' : 'tag-mixed'))">
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
                <span class="duration">总历时 {{ packet.packetDurationLabel }}</span>
                <span class="packet-title">{{ packet.packet_id }} {{ packet.sourceLabel }} 发射（段 {{ packet.eventId }}）</span>
                <span class="packet-hint">成功 {{ packet.okCount }} / rx-rx {{ packet.rxrxCount }} / rx-tx {{ packet.rxtxCount }}</span>
              </div>

              <div class="receiver-strip">
                <span
                  v-for="receiver in packet.receivers"
                  :key="receiver.receiver_id"
                  class="receiver-pill"
                  :class="receiverPillClass(receiver)"
                >
                  <span class="receiver-name">{{ receiver.dstLabel }}</span>
                  <span class="receiver-reason">{{ receiver.reasonLabel }}</span>
                </span>
              </div>
            </div>
          </li>
        </ul>

        <div class="stat-grid">
          <div>广播包数：{{ summary.packetCount }}</div>
          <div>成功接收：{{ summary.okReceivers }}</div>
          <div>rx-rx 冲突：{{ summary.rxrxCollisions }}</div>
          <div>rx-tx 冲突：{{ summary.rxtxCollisions }}</div>
        </div>
      </aside>
    </section>

    <section class="panel legend">
      <p><span class="dot idle"></span>蓝色：空闲 <span class="dot tx-state"></span>橙色：发送中 <span class="dot rx-state"></span>绿色：接收中 / 接收成功 <span class="dot bad"></span>红色：接收冲突 | 声速：{{ SOUND_SPEED_MPS }} m/s | 节点最小间距：{{ formatNodeGap() }}</p>
      <p>其中“橙底红闪”表示 `rx-tx` 冲突：节点仍在发送，但此时到达的包无法被它接收。周期保证：{{ timeDisplay(MIN_SIM_TIME_US) }}（若日志短于该时长，回放界面仍保持完整时间轴）。</p>
    </section>
  </div>
</template>
