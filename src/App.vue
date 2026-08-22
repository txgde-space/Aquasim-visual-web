<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import netLogDefaultText from './assets/net.json?raw'
import netLogMultiHopText from './assets/net_multihop.json?raw'
import netLogMultiHopComplexText from './assets/net_multihop_complex.json?raw'
import netLogChainNoConflictText from './assets/net_chain_5_no_conflict.log?raw'
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

const blockedReasonLabel = (reason) => {
  if (reason === 'busy') return 'PHY busy'
  return reason ? String(reason) : '未知原因'
}

const packetTagLabel = (kind) => {
  if (kind === 'blocked') return '发送阻塞'
  if (kind === 'ok') return '全成功'
  if (kind === 'mixed') return '混合结果'
  return '全失败'
}

const packetTagClass = (kind) => {
  if (kind === 'blocked') return 'tag-fail'
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

const finiteOrNull = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const resolveNodePoint = (rawPoint, fallbackPoint = null) => ({
  x: finiteOrNull(rawPoint.x) ?? fallbackPoint?.x ?? 0,
  y: finiteOrNull(rawPoint.y) ?? fallbackPoint?.y ?? 0,
  z: finiteOrNull(rawPoint.z) ?? fallbackPoint?.z ?? 0,
})

const interpolateNodePoint = (start, end, ratio) => ({
  x: start.x + ((end.x - start.x) * ratio),
  y: start.y + ((end.y - start.y) * ratio),
  z: start.z + ((end.z - start.z) * ratio),
})

const normalizeMovements = (movementRows, nodes) => {
  const nodeDefaults = new Map(nodes.map((node) => [node.node_id, { x: node.x, y: node.y, z: node.z ?? 0 }]))
  const lastNodePoint = new Map(nodeDefaults)

  return movementRows
    .filter((item) => Number.isFinite(Number(item.node_id)))
    .map((item, index) => ({ ...item, node_id: Number(item.node_id), __index: index }))
    .sort((a, b) => normalizeTime(a.start_us) - normalizeTime(b.start_us) || a.__index - b.__index)
    .map((item) => {
      const previousPoint = lastNodePoint.get(item.node_id) || nodeDefaults.get(item.node_id) || { x: 0, y: 0, z: 0 }
      const start = resolveNodePoint({
        x: item.from_x ?? item.start_x ?? item.start?.x ?? item.x,
        y: item.from_y ?? item.start_y ?? item.start?.y ?? item.y,
        z: item.from_z ?? item.start_z ?? item.start?.z ?? item.z,
      }, previousPoint)
      const end = resolveNodePoint({
        x: item.to_x ?? item.end_x ?? item.target_x ?? item.end?.x,
        y: item.to_y ?? item.end_y ?? item.target_y ?? item.end?.y,
        z: item.to_z ?? item.end_z ?? item.target_z ?? item.end?.z,
      }, start)
      const startUs = normalizeTime(item.start_us)
      const endUs = Math.max(startUs, normalizeTime(item.end_us ?? item.stop_us))
      const durationUs = Math.max(1, endUs - startUs)

      lastNodePoint.set(item.node_id, end)

      return {
        ...item,
        type: 'movement',
        node_id: item.node_id,
        start,
        end,
        start_us: startUs,
        end_us: endUs,
        duration_us: durationUs,
      }
    })
}

const resolveMovingNodes = (nodes, movements, timeUs) => {
  const nodeMap = new Map(nodes.map((node) => [node.node_id, { ...node }]))

  for (const movement of movements) {
    const node = nodeMap.get(movement.node_id)
    if (!node || timeUs < movement.start_us) continue

    if (timeUs >= movement.end_us) {
      Object.assign(node, movement.end)
      continue
    }

    const ratio = clampRatio((timeUs - movement.start_us) / Math.max(1, movement.duration_us))
    Object.assign(node, interpolateNodePoint(movement.start, movement.end, ratio))
  }

  return [...nodeMap.values()]
}

const createEmptyParsedLog = () => ({
  nodes: [],
  movements: [],
  packets: [],
  nodeEvents: [],
  tx: [],
  rx: [],
  parseErrors: [],
  meta: {
    type: 'meta',
    schema: 'uan-vis-packet-log/v1',
    time_unit: 'us',
    distance_unit: 'm',
    sim_end_us: 0,
  },
})

const appendParsedObject = (obj, parsed) => {
  if (!obj || typeof obj !== 'object') return

  if (obj.type === 'meta') {
    Object.assign(parsed.meta, obj)
  } else if (obj.type === 'node' && Number.isFinite(Number(obj.node_id))) {
    const nodeId = Number(obj.node_id)
    parsed.nodes.push({
      ...obj,
      node_id: nodeId,
      x: Number(obj.x ?? 0),
      y: Number(obj.y ?? 0),
      z: Number(obj.z ?? 0),
    })
    if (Array.isArray(obj.movements)) {
      for (const movement of obj.movements) {
        parsed.movements.push({
          ...movement,
          node_id: nodeId,
        })
      }
    }
  } else if (obj.type === 'movement') {
    parsed.movements.push({ ...obj })
  } else if (obj.type === 'packet' && Number.isFinite(Number(obj.src))) {
    parsed.packets.push({ ...obj })
  } else if (
    obj.type === 'tx_blocked'
    || obj.type === 'tx_start'
    || obj.type === 'rx_success'
    || obj.type === 'rx_drop'
    || obj.type === 'drop'
    || obj.type === 'node_event'
  ) {
    parsed.nodeEvents.push({ ...obj })
  } else if (obj.type === 'tx') {
    parsed.tx.push({ ...obj })
  } else if (obj.type === 'rx') {
    parsed.rx.push({ ...obj })
  }
}

const finalizeParsedLog = (parsed) => ({
  ...parsed,
  movements: normalizeMovements(parsed.movements, parsed.nodes),
})

const parseStructuredLog = (raw) => {
  const parsed = createEmptyParsedLog()
  const data = JSON.parse(raw)

  if (Array.isArray(data)) {
    for (const entry of data) appendParsedObject(entry, parsed)
    return finalizeParsedLog(parsed)
  }

  if (!data || typeof data !== 'object') {
    throw new Error('invalid structured log')
  }

  if (data.meta && typeof data.meta === 'object') {
    appendParsedObject({ ...data.meta, type: 'meta' }, parsed)
  }
  if (Array.isArray(data.nodes)) {
    for (const entry of data.nodes) appendParsedObject({ ...entry, type: 'node' }, parsed)
  }
  if (Array.isArray(data.movements)) {
    for (const entry of data.movements) appendParsedObject({ ...entry, type: 'movement' }, parsed)
  }
  if (Array.isArray(data.packets)) {
    for (const entry of data.packets) appendParsedObject({ ...entry, type: 'packet' }, parsed)
  }
  if (Array.isArray(data.events)) {
    for (const entry of data.events) parsed.nodeEvents.push({ ...entry })
  }
  if (Array.isArray(data.tx)) {
    for (const entry of data.tx) appendParsedObject({ ...entry, type: 'tx' }, parsed)
  }
  if (Array.isArray(data.rx)) {
    for (const entry of data.rx) appendParsedObject({ ...entry, type: 'rx' }, parsed)
  }

  return finalizeParsedLog(parsed)
}

const parseJsonLinesLog = (raw) => {
  const lines = String(raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const nodes = []
  const movements = []
  const packets = []
  const nodeEvents = []
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
      appendParsedObject(JSON.parse(line), { nodes, movements, packets, nodeEvents, tx, rx, parseErrors, meta })
    } catch {
      parseErrors.push(line)
    }
  }

  return { nodes, movements: normalizeMovements(movements, nodes), packets, nodeEvents, tx, rx, parseErrors, meta }
}

const parseLog = (raw) => {
  const text = String(raw ?? '').trim()
  if (!text) return createEmptyParsedLog()

  try {
    return parseStructuredLog(text)
  } catch {
    return parseJsonLinesLog(text)
  }
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

const normalizeCommitted = (value) => !(value === false || value === 'false')

const normalizePacket = (packet, index) => {
  const packetId = String(packet.packet_id || packet.tx_id || `pkt-${index + 1}`)
  const eventId = String(packet.event_id || packet.tx_id || `${packetId}-seg-${index + 1}`)
  const txStartUs = normalizeTime(packet.tx_start_us ?? packet.start_us)
  const txCommitted = normalizeCommitted(packet.tx_committed)
  const txDurationRawUs = normalizeTime(packet.tx_duration_us ?? packet.duration_us)
  const txDurationUs = txCommitted ? Math.max(1, txDurationRawUs) : Math.max(0, txDurationRawUs)
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
    tx_committed: txCommitted,
    tx_blocked_reason: txCommitted ? null : (packet.tx_blocked_reason ? String(packet.tx_blocked_reason) : null),
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

const eventTimeUs = (event) => normalizeTime(
  event.time_us
  ?? event.tx_start_us
  ?? event.rx_start_us
  ?? event.start_us
  ?? event.local_time_us
  ?? event.utc_us,
)

const nodeEventPacketId = (event, fallbackIndex) => String(
  event.packet_id
  || event.packet_uid
  || event.tx_id
  || event.seq
  || event.sequence
  || `node-event-${fallbackIndex + 1}`,
)

const nodeEventTxKey = (event, fallbackIndex) => String(
  event.event_id
  || event.tx_id
  || `${nodeEventPacketId(event, fallbackIndex)}-src-${event.src ?? event.node_id ?? 'x'}-t-${eventTimeUs(event)}`,
)

const normalizeNodeTxEvent = (event, index) => {
  const packetId = nodeEventPacketId(event, index)
  const txStartUs = normalizeTime(event.tx_start_us ?? event.start_us ?? event.time_us ?? event.utc_us)
  const txDurationUs = Math.max(0, normalizeTime(event.tx_duration_us ?? event.duration_us))
  const txCommitted = event.type !== 'tx_blocked' && normalizeCommitted(event.tx_committed)

  return {
    ...event,
    type: 'packet',
    event_id: nodeEventTxKey(event, index),
    packet_id: packetId,
    src: Number(event.src ?? event.node_id),
    tx_start_us: txStartUs,
    tx_duration_us: txCommitted ? Math.max(1, txDurationUs) : txDurationUs,
    tx_end_us: normalizeTime(event.tx_end_us ?? event.end_us ?? (txStartUs + txDurationUs)),
    tx_committed: txCommitted,
    tx_blocked_reason: txCommitted ? null : String(event.tx_blocked_reason || event.reason || 'busy'),
    receivers: [],
  }
}

const normalizeNodeRxEvent = (event, index) => {
  const packetId = nodeEventPacketId(event, index)
  const rxStartUs = normalizeTime(event.rx_start_us ?? event.start_us ?? event.time_us ?? event.utc_us)
  const rxDurationUs = Math.max(1, normalizeTime(event.rx_duration_us ?? event.duration_us))
  const status = event.status === 'ok' || event.result === 'ok' ? 'ok' : 'fail'

  return {
    ...event,
    packet_id: packetId,
    tx_key: event.event_id || event.tx_id || null,
    src: Number(event.src),
    receiver_id: String(event.receiver_id || event.rx_id || `${packetId}-node-rx-${index + 1}`),
    dst: Number(event.dst ?? event.node_id),
    rx_start_us: rxStartUs,
    rx_duration_us: rxDurationUs,
    status,
    reason: status === 'ok' ? null : String(event.reason || deriveReasonFromLegacy(event.result)),
    with: Array.isArray(event.with)
      ? event.with.map(String)
      : Array.isArray(event.collided_with)
        ? event.collided_with.map(String)
        : [],
  }
}

const mergeParsedNodeLogs = (parsedLogs, fileNames = []) => {
  const merged = createEmptyParsedLog()
  const nodeById = new Map()
  const txEvents = []
  const rxEvents = []

  parsedLogs.forEach((parsed, fileIndex) => {
    Object.assign(merged.meta, parsed.meta || {})
    for (const node of parsed.nodes || []) {
      if (!Number.isFinite(Number(node.node_id))) continue
      const nodeId = Number(node.node_id)
      const existing = nodeById.get(nodeId)
      nodeById.set(nodeId, {
        ...(existing || {}),
        ...node,
        node_id: nodeId,
        movements: [
          ...((existing && Array.isArray(existing.movements)) ? existing.movements : []),
          ...(Array.isArray(node.movements) ? node.movements : []),
        ],
      })
    }
    for (const movement of parsed.movements || []) merged.movements.push({ ...movement })

    const sourceLabel = fileNames[fileIndex] || `node-log-${fileIndex + 1}`
    for (const event of parsed.nodeEvents || []) {
      const eventType = String(event.type === 'node_event' ? event.event : (event.type || event.event || '')).toLowerCase()
      const taggedEvent = { ...event, type: eventType, source_file: sourceLabel }
      if (eventType === 'tx' || eventType === 'tx_start' || eventType === 'tx_blocked') {
        txEvents.push(taggedEvent)
      } else if (eventType === 'rx' || eventType === 'rx_success' || eventType === 'drop' || eventType === 'rx_drop') {
        rxEvents.push(taggedEvent)
      }
    }
    for (const tx of parsed.tx || []) txEvents.push({ ...tx, type: 'tx', source_file: sourceLabel })
    for (const rx of parsed.rx || []) rxEvents.push({ ...rx, type: 'rx', source_file: sourceLabel })
    for (const packet of parsed.packets || []) merged.packets.push({ ...packet })
    for (const error of parsed.parseErrors || []) merged.parseErrors.push(`${sourceLabel}: ${error}`)
  })

  merged.nodes = [...nodeById.values()].sort((a, b) => a.node_id - b.node_id)
  merged.movements = normalizeMovements(merged.movements, merged.nodes)

  const packets = txEvents
    .map((event, index) => normalizeNodeTxEvent(event, index))
    .filter((packet) => Number.isFinite(packet.src))
    .sort((a, b) => a.tx_start_us - b.tx_start_us)

  const packetsByTxKey = new Map(packets.map((packet) => [packet.event_id, packet]))
  const packetsByPacketId = new Map()
  for (const packet of packets) {
    const list = packetsByPacketId.get(packet.packet_id) || []
    list.push(packet)
    packetsByPacketId.set(packet.packet_id, list)
  }

  rxEvents
    .map((event, index) => normalizeNodeRxEvent(event, index))
    .filter((receiver) => Number.isFinite(receiver.dst))
    .sort((a, b) => a.rx_start_us - b.rx_start_us)
    .forEach((receiver) => {
      const directPacket = receiver.tx_key ? packetsByTxKey.get(receiver.tx_key) : null
      const candidatePackets = receiver.packet_id ? (packetsByPacketId.get(receiver.packet_id) || []) : []
      const matchedPacket = directPacket || candidatePackets
        .filter((packet) => (!Number.isFinite(receiver.src) || packet.src === receiver.src) && packet.tx_start_us <= receiver.rx_start_us)
        .sort((a, b) => Math.abs(receiver.rx_start_us - a.tx_start_us) - Math.abs(receiver.rx_start_us - b.tx_start_us))[0]
        || candidatePackets[0]

      if (!matchedPacket) {
        merged.parseErrors.push(`${receiver.source_file || 'node-log'}: 未找到 ${receiver.packet_id} 的 TX 事件`)
        return
      }

      matchedPacket.receivers.push(receiver)
    })

  merged.packets.push(...packets.map((packet) => ({
    ...packet,
    receivers: packet.receivers.slice().sort((a, b) => a.rx_start_us - b.rx_start_us),
  })))

  merged.meta = {
    ...merged.meta,
    schema: 'uan-vis-merged-node-log/v1',
    source_schema: merged.meta.schema,
    log_scope: 'merged-node',
    node_log_count: parsedLogs.length,
    sim_end_us: Math.max(
      normalizeTime(merged.meta.sim_end_us),
      ...merged.packets.map((packet) => Math.max(
        normalizeTime(packet.tx_end_us ?? packet.end_us),
        ...((packet.receivers || []).map((receiver) => normalizeTime(receiver.rx_start_us ?? receiver.start_us) + normalizeTime(receiver.rx_duration_us ?? receiver.duration_us))),
      )),
      ...merged.movements.map((movement) => movement.end_us),
    ),
  }

  return merged
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
    label: '默认日志（net.json）',
    fileName: 'net.json',
    raw: netLogDefaultText,
  },
  multihop: {
    label: '多跳转发日志（net_multihop.json）',
    fileName: 'net_multihop.json',
    raw: netLogMultiHopText,
  },
  complex: {
    label: '复杂冲突日志（net_multihop_complex.json）',
    fileName: 'net_multihop_complex.json',
    raw: netLogMultiHopComplexText,
  },
  chainNoConflict: {
    label: '5 节点链式无冲突日志（net_chain_5_no_conflict.log）',
    fileName: 'net_chain_5_no_conflict.log',
    raw: netLogChainNoConflictText,
  },
})

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
  (
    parsed.packets.length > 0
      ? parsed.packets
      : (parsed.nodeEvents?.length > 0
        ? mergeParsedNodeLogs([parsed], [uploadedLogName.value || 'node-log']).packets
        : buildPacketsFromLegacy(parsed.tx, parsed.rx))
  )
    .map((packet, index) => normalizePacket(packet, index))
)

const currentTime = ref(0)
const initialParsed = parseLog(LOG_SOURCES.default.raw)
const logFileInput = ref(null)
const nodeLogFileInput = ref(null)
const logSourceKey = ref('default')
const uploadedLogName = ref('')
const uploadedLogText = ref('')
const uploadedNodeLogNames = ref([])
const uploadedNodeParsedLog = ref(null)
const selectedTheme = ref('research-lab')
const fxLevel = ref('standard')
const underwaterDetail = ref('standard')
const baseNodesState = ref(enforceMinGap(initialParsed.nodes))
const nodeMovementRows = ref(initialParsed.movements)
const packetRows = ref(normalizePacketsFromParsed(initialParsed))
const parseErrors = ref(initialParsed.parseErrors)
const metaState = ref(initialParsed.meta)
const nodesState = computed(() => resolveMovingNodes(baseNodesState.value, nodeMovementRows.value, currentTime.value))
const activeLogName = computed(() => {
  if (logSourceKey.value === 'upload' && uploadedLogName.value) return uploadedLogName.value
  if (logSourceKey.value === 'node-upload' && uploadedNodeLogNames.value.length) {
    const names = uploadedNodeLogNames.value
    if (names.length <= 2) return names.join(' + ')
    return `${names[0]} + ${names.length - 1} 个节点日志`
  }
  return (LOG_SOURCES[logSourceKey.value] || LOG_SOURCES.default).fileName
})

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
const activeDragEvent = ref(null)
const suppressLogClick = ref(null)
const globalLogListEl = ref(null)
const lifecycleLogListEl = ref(null)
let raf = 0
let lastTs = 0
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
  const packetKind = !packet.tx_committed
    ? 'blocked'
    : failCount === 0
      ? 'ok'
      : (okCount > 0 ? 'mixed' : 'fail')
  const totalDurationUs = Math.max(1, packet.timeEnd - packet.tx_start_us)
  const progressPct = clampRatio((currentTime.value - packet.tx_start_us) / totalDurationUs) * 100
  const blockedReasonText = packet.tx_committed ? null : blockedReasonLabel(packet.tx_blocked_reason)
  const outcomeSummary = packet.tx_committed
    ? `成功 ${okCount} / rx-rx ${rxrxCount} / rx-tx ${rxtxCount}`
    : `未发出 / 原因 ${blockedReasonText}`

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
    blockedReasonText,
    outcomeSummary,
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
      const blockedCount = sortedSegments.filter((segment) => !segment.tx_committed).length
      const packetKind = blockedCount > 0
        ? 'blocked'
        : failCount === 0
          ? 'ok'
          : (okCount > 0 ? 'mixed' : 'fail')
      const totalDurationUs = Math.max(1, group.endUs - group.startUs)
      const progressPct = clampRatio((currentTime.value - group.startUs) / totalDurationUs) * 100

      return {
        ...group,
        segments: sortedSegments,
        blockedCount,
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

const lifecycleStages = computed(() => {
  if (!lifecyclePacket.value) return []

  const stages = []
  for (const segment of lifecyclePacket.value.segments) {
    stages.push({
      eventId: `${segment.eventId}-tx`,
      type: 'tx',
      status: segment.tx_committed ? 'ok' : 'fail',
      title: segment.tx_committed ? `${segment.sourceLabel} 发射` : `${segment.sourceLabel} 发送被阻塞`,
      detail: segment.tx_committed
        ? `${lifecyclePacket.value.packet_id} · 段 ${segment.eventId} · 时长 ${timeDisplay(segment.tx_duration_us)}`
        : `${lifecyclePacket.value.packet_id} · 段 ${segment.eventId} · 未发出（${blockedReasonLabel(segment.tx_blocked_reason)}）`,
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
  let committedPacketCount = 0
  let blockedPacketCount = 0
  let okReceivers = 0
  let rxrxCollisions = 0
  let rxtxCollisions = 0

  for (const packet of packets.value) {
    if (packet.tx_committed) committedPacketCount += 1
    else blockedPacketCount += 1
    for (const receiver of packet.receivers) {
      if (receiver.status === 'ok') okReceivers += 1
      if (receiver.reason === 'collision_rx_rx') rxrxCollisions += 1
      if (receiver.reason === 'collision_rx_tx') rxtxCollisions += 1
    }
  }

  return {
    packetCount: packets.value.length,
    committedPacketCount,
    blockedPacketCount,
    okReceivers,
    rxrxCollisions,
    rxtxCollisions,
  }
})

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

const ensureBgm = () => {}
const toggleMute = () => {}

const onJump = (event) => {
  const next = Number(event.target.value)
  if (Number.isFinite(next)) seekTime(next)
}

const onSpeed = (event) => {
  speed.value = Number(event.target.value)
}

const applyParsedLog = (parsed) => {
  baseNodesState.value = enforceMinGap(parsed.nodes)
  nodeMovementRows.value = parsed.movements
  packetRows.value = normalizePacketsFromParsed(parsed)
  parseErrors.value = parsed.parseErrors
  metaState.value = parsed.meta

  focusedPacketId.value = null
  selectedLifecyclePacketId.value = ''
  currentTime.value = 0
  isPlaying.value = false
  lastTs = 0
}

const onLogSourceChange = (event) => {
  logSourceKey.value = event.target.value
}

const openLogFilePicker = () => {
  logFileInput.value?.click()
}

const openNodeLogFilePicker = () => {
  nodeLogFileInput.value?.click()
}

const onLogFileChange = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return

  const text = await file.text()
  uploadedLogName.value = file.name
  uploadedLogText.value = text
  logSourceKey.value = 'upload'
  applyParsedLog(parseLog(text))

  if (event.target) {
    event.target.value = ''
  }
}

const onNodeLogFilesChange = async (event) => {
  const files = [...(event.target?.files || [])]
  if (!files.length) return

  const parsedLogs = []
  const fileNames = []
  for (const file of files) {
    const text = await file.text()
    parsedLogs.push(parseLog(text))
    fileNames.push(file.name)
  }

  const mergedParsed = mergeParsedNodeLogs(parsedLogs, fileNames)
  uploadedNodeLogNames.value = fileNames
  uploadedNodeParsedLog.value = mergedParsed
  logSourceKey.value = 'node-upload'
  applyParsedLog(mergedParsed)

  if (event.target) {
    event.target.value = ''
  }
}

const onFxLevelChange = (event) => {
  fxLevel.value = event.target.value
}

const onUnderwaterDetailChange = (event) => {
  underwaterDetail.value = event.target.value
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

watch(logSourceKey, (nextKey) => {
  if (nextKey === 'upload') {
    if (!uploadedLogText.value) {
      logSourceKey.value = 'default'
      return
    }
    applyParsedLog(parseLog(uploadedLogText.value))
    return
  }

  if (nextKey === 'node-upload') {
    if (!uploadedNodeParsedLog.value) {
      logSourceKey.value = 'default'
      return
    }
    applyParsedLog(uploadedNodeParsedLog.value)
    return
  }

  const source = LOG_SOURCES[nextKey] || LOG_SOURCES.default
  applyParsedLog(parseLog(source.raw))
}, { immediate: false })

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
    const savedFx = localStorage.getItem('aquasim_fx_level')
    if (savedFx && FX_LEVEL_OPTIONS.some((item) => item.key === savedFx)) {
      fxLevel.value = savedFx
    }
    const savedUnderwaterDetail = localStorage.getItem('aquasim_underwater_detail')
    if (savedUnderwaterDetail && UNDERWATER_DETAIL_OPTIONS.some((item) => item.key === savedUnderwaterDetail)) {
      underwaterDetail.value = savedUnderwaterDetail
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
  <div class="page-wrap" :class="[`theme-${selectedTheme}`, `fx-${fxLevel}`]">
    <header class="topbar">
      <div>
        <p class="eyebrow">ns-3 Acoustic Replay</p>
        <h1>NS3-Aquasim日志可视化分析工具</h1>
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
            @pause-request="pauseForTool"
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
              <button class="btn btn-compact" @click="openLogFilePicker">选择日志文件</button>
              <button class="btn btn-compact" @click="openNodeLogFilePicker">选择节点级日志</button>
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
                  <option value="upload" :disabled="!uploadedLogText">{{ uploadedLogName || '上传日志文件' }}</option>
                  <option value="node-upload" :disabled="!uploadedNodeParsedLog">
                    {{ uploadedNodeLogNames.length ? `节点级日志（${uploadedNodeLogNames.length} 个）` : '上传节点级日志' }}
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
            <input
              ref="logFileInput"
              class="hidden-file-input"
              type="file"
              accept=".log,.jsonl,.json,.txt"
              @change="onLogFileChange"
            />
            <input
              ref="nodeLogFileInput"
              class="hidden-file-input"
              type="file"
              multiple
              accept=".log,.jsonl,.json,.txt"
              @change="onNodeLogFilesChange"
            />
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
                </span>
              </div>
            </div>
          </li>
        </ul>

        <div class="stat-grid">
          <div>记录总数：{{ summary.packetCount }}</div>
          <div>真正发射：{{ summary.committedPacketCount }}</div>
          <div>发送阻塞：{{ summary.blockedPacketCount }}</div>
          <div>成功接收：{{ summary.okReceivers }}</div>
          <div>rx-rx 冲突：{{ summary.rxrxCollisions }}</div>
          <div>rx-tx 冲突：{{ summary.rxtxCollisions }}</div>
        </div>
      </aside>
    </section>

    <section class="panel legend">
      <p><span class="dot idle"></span>蓝色：空闲 <span class="dot tx-state"></span>橙色：发送中 <span class="dot rx-state"></span>绿色：接收中 / 接收成功 <span class="dot bad"></span>红色：接收冲突 | 声速：{{ SOUND_SPEED_MPS }} m/s | 节点最小间距：{{ formatNodeGap() }} | 当前日志：{{ activeLogName }}</p>
      <p class="legend-note">其中“橙底红闪”表示 `rx-tx` 冲突：节点仍在发送，但此时到达的包无法被它接收。周期保证：{{ timeDisplay(MIN_SIM_TIME_US) }}（若日志短于该时长，回放界面仍保持完整时间轴）。</p>
    </section>
  </div>
</template>
