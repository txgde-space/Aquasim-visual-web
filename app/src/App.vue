<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import netLogText from './assets/net.log?raw'
import NodeCanvas from './components/NodeCanvas.vue'

const SOUND_SPEED_MPS = 1500
const MIN_NODE_GAP_M = 1000
const MIN_SIM_TIME_US = 10_000_000

const parseLog = (raw) => {
  const lines = String(raw ?? '').split('\n').map((line) => line.trim()).filter(Boolean)

  const nodes = []
  const tx = []
  const rx = []
  const parseErrors = []
  const meta = {
    type: 'meta',
    schema: 'uan-vis-log/v1',
    time_unit: 'us',
    sim_end_us: 0,
  }

  for (const line of lines) {
    try {
      const obj = JSON.parse(line)
      if (obj.type === 'meta') {
        Object.assign(meta, obj)
      } else if (obj.type === 'node' && Number.isFinite(obj.node_id)) {
        nodes.push({ ...obj })
      } else if (obj.type === 'tx') {
        tx.push({
          ...obj,
          timeStart: Number(obj.start_us ?? 0),
          timeEnd: Number(obj.end_us ?? ((obj.start_us ?? 0) + (obj.duration_us ?? 0))),
          eventId: obj.tx_id || `tx-${tx.length}`,
        })
      } else if (obj.type === 'rx') {
        rx.push({
          ...obj,
          eventId: obj.rx_id || `rx-${rx.length}`,
        })
      }
    } catch {
      parseErrors.push(line)
    }
  }

  const allEventEnds = [...tx.map((i) => i.timeEnd)]
  if (!Number.isFinite(meta.sim_end_us) || meta.sim_end_us <= 0) {
    const maxEnd = allEventEnds.length ? Math.max(...allEventEnds) : 0
    meta.sim_end_us = maxEnd
  }

  return { nodes, tx, rx, parseErrors, meta }
}

const enforceMinGap = (nodes) => {
  if (nodes.length < 2) return nodes.map((n) => ({ ...n }))

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
    return nodes.map((n) => ({ ...n }))
  }

  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length
  const scale = MIN_NODE_GAP_M / minGap

  return nodes.map((n) => ({
    ...n,
    x: cx + (n.x - cx) * scale,
    y: cy + (n.y - cy) * scale,
  }))
}

const distanceMeters = (a, b) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z ?? 0) - (b.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

const delayUsFromDistance = (a, b) => (distanceMeters(a, b) / SOUND_SPEED_MPS) * 1e6

const normalizeTime = (us) => Number(us) || 0
const isCollisionEvent = (result, collidedWith) => {
  if (result === 'ok') return false
  if (Array.isArray(collidedWith) && collidedWith.length > 0) return true
  return result != null && result !== ''
}
const formatPacketStatus = (isCollision) => (isCollision ? 'collision' : 'normal')

const baseData = parseLog(netLogText)
const nodesState = ref(enforceMinGap(baseData.nodes))
const txRows = ref(baseData.tx)
const rxRows = ref(baseData.rx)
const parseErrors = ref(baseData.parseErrors)

const txs = computed(() => txRows.value.map((item) => {
  const start = normalizeTime(item.start_us)
  const duration = normalizeTime(item.duration_us)
  return {
    ...item,
    timeStart: start,
    timeEnd: start + duration,
    duration_us: duration,
  }
}))

const txById = computed(() => new Map(txs.value.map((item) => [item.tx_id, item])))

const nodeById = computed(() => new Map(nodesState.value.map((node) => [node.node_id, node])))

const rxEvents = computed(() => {
  const derived = rxRows.value.map((item) => {
    const txItem = txById.value.get(item.tx_id)
    const src = nodeById.value.get(item.src)
    const dst = nodeById.value.get(item.dst)

    const baseStart = normalizeTime(item.start_us || (txItem ? txItem.timeStart : 0))
    const duration = normalizeTime(item.duration_us || (txItem ? txItem.duration_us : 0))
    const distanceM = src && dst ? distanceMeters(src, dst) : normalizeTime(item.distance_m)
    const delayUs = src && dst ? delayUsFromDistance(src, dst) : normalizeTime(item.prop_delay_us)

    const startUs = txItem ? txItem.timeStart + delayUs : baseStart

    return {
      ...item,
      distance_m: distanceM,
      prop_delay_us: delayUs,
      timeStart: startUs,
      timeEnd: startUs + duration,
      duration_us: duration,
      txStartUs: txItem ? txItem.timeStart : undefined,
      collision: isCollisionEvent(item.result, item.collided_with),
    }
  })

  const maxEnd = derived.reduce((m, item) => Math.max(m, item.timeEnd), 0)
  if (!baseData.meta.sim_end_us || baseData.meta.sim_end_us < maxEnd) {
    baseData.meta.sim_end_us = maxEnd
  }
  return derived
})

const rxEventsByTx = computed(() => {
  const byTx = new Map()
  for (const rx of rxEvents.value) {
    const list = byTx.get(rx.tx_id) || []
    list.push(rx)
    byTx.set(rx.tx_id, list)
  }
  for (const [txId, events] of byTx.entries()) {
    events.sort((a, b) => a.timeStart - b.timeStart)
    byTx.set(txId, events)
  }
  return byTx
})

const txStatusById = computed(() => {
  const statusMap = new Map()
  for (const tx of txs.value) {
    const related = rxEventsByTx.value.get(tx.tx_id) || []
    const hasCollision = related.some((rx) => rx.collision)
    statusMap.set(tx.tx_id, formatPacketStatus(hasCollision))
  }
  return statusMap
})

const cycleEndUs = computed(() => Math.max(MIN_SIM_TIME_US, normalizeTime(baseData.meta.sim_end_us)))
const currentTime = ref(Math.min(300_000, cycleEndUs.value))
const rangeProgressStyle = computed(() => `${((currentTime.value / Math.max(1, cycleEndUs.value)) * 100).toFixed(2)}%`)

const isPlaying = ref(false)
const speed = ref(1)
const activeDragEvent = ref(null)
const suppressLogClick = ref(null)
let raf = 0
let lastTs = 0

const clampTime = (us) => Math.max(0, Math.min(cycleEndUs.value, normalizeTime(us)))

const timeDisplay = (us) => `${(us / 1000).toFixed(2)} ms`

const activeTxs = computed(() => txs.value
  .filter((tx) => tx.timeStart <= currentTime.value && currentTime.value <= tx.timeEnd)
  .map((tx) => {
    const src = nodeById.value.get(tx.src)
    if (!src) return null
    const progress = (currentTime.value - tx.timeStart) / Math.max(tx.duration_us, 1)
    const ratio = Math.max(0, Math.min(1, progress))
    return {
      ...tx,
      source: src,
      radius: 18 + ratio * 250,
      opacity: Math.max(0, 1 - ratio),
    }
  })
  .filter(Boolean)
)

const activeRxs = computed(() => rxEvents.value
  .filter((rx) => rx.timeStart <= currentTime.value && currentTime.value <= rx.timeEnd)
  .map((rx) => {
    const src = nodeById.value.get(rx.src)
    const dst = nodeById.value.get(rx.dst)
    if (!src || !dst) return null
    const progress = (currentTime.value - rx.timeStart) / Math.max(rx.duration_us, 1)
    const ratio = Math.max(0, Math.min(1, progress))
    return {
      ...rx,
      srcPos: src,
      dstPos: dst,
      travelX: src.x + (dst.x - src.x) * ratio,
      travelY: src.y + (dst.y - src.y) * ratio,
      label: `${rx.rx_id}`,
    }
  })
  .filter(Boolean)
)

const logEvents = computed(() => {
  const txRows = txs.value.map((tx) => {
    const src = nodeById.value.get(tx.src)
    const txDurationUs = normalizeTime(tx.duration_us)
    const txStart = normalizeTime(tx.timeStart)
    const txEnd = normalizeTime(tx.timeEnd)
    const txDurationSec = Math.max(1, txEnd - txStart)
    const txTrackProgress = Math.max(0, Math.min(100, ((currentTime.value - txStart) / txDurationSec) * 100))

    return {
      ...tx,
      startUs: txStart,
      endUs: txEnd,
      durationUs: txDurationUs,
      durationMs: (txDurationUs / 1000).toFixed(2),
      prettyTime: timeDisplay(tx.timeStart),
      sourceLabel: src ? src.name : `Node-${tx.src}`,
      dstLabel: tx.dst != null ? `Node-${tx.dst}` : null,
      delayMs: '0.00',
      status: txStatusById.value.get(tx.tx_id) || 'normal',
      trackProgressPct: Number.isFinite(txTrackProgress) ? txTrackProgress : 0,
      _eventKind: 0,
      type: 'tx',
    }
  })

  const rxRows = rxEvents.value.map((rx) => {
    const dst = nodeById.value.get(rx.dst)
    const rxSrc = nodeById.value.get(rx.src)
    const rxDurationUs = normalizeTime(rx.duration_us)
    const rxStart = normalizeTime(rx.timeStart)
    const rxEnd = normalizeTime(rx.timeEnd)
    const rxDurationSec = Math.max(1, rxEnd - rxStart)
    const rxTrackProgress = Math.max(0, Math.min(100, ((currentTime.value - rxStart) / rxDurationSec) * 100))

    return {
      ...rx,
      startUs: rxStart,
      endUs: rxEnd,
      durationUs: rxDurationUs,
      durationMs: (rxDurationUs / 1000).toFixed(2),
      prettyTime: timeDisplay(rx.timeStart),
      sourceLabel: rxSrc ? rxSrc.name : `Node-${rx.src}`,
      dstLabel: dst ? dst.name : `Node-${rx.dst}`,
      delayMs: ((rx.prop_delay_us || 0) / 1000).toFixed(2),
      status: formatPacketStatus(rx.collision),
      trackProgressPct: Number.isFinite(rxTrackProgress) ? rxTrackProgress : 0,
      _eventKind: 1,
      type: 'rx',
    }
  })

  return [...txRows, ...rxRows]
    .filter((item) => item.durationUs >= 0)
    .sort((a, b) => {
      const dt = normalizeTime(a.timeStart) - normalizeTime(b.timeStart)
      if (dt !== 0) return dt
      const kind = Number(a._eventKind) - Number(b._eventKind)
      if (kind !== 0) return kind
      return (a.eventId || '').localeCompare(b.eventId || '')
    })
})

const visibleLogEvents = computed(() => logEvents.value.slice(-120))

const activeEvent = computed(() => visibleLogEvents.value.find((item) => currentTime.value >= item.timeStart && currentTime.value <= item.timeEnd))

const summary = computed(() => {
  const total = txs.value.length
  const collision = txs.value.filter((tx) => txStatusById.value.get(tx.tx_id) === 'collision').length
  const ok = total - collision
  return {
    total,
    ok,
    collision,
    rate: total ? ((ok / total) * 100).toFixed(1) : '0.0',
  }
})

const formatNodeGap = () => {
  const nodes = nodesState.value
  if (nodes.length < 2) return '1.0 km'

  let minGap = Infinity
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const d = distanceMeters(nodes[i], nodes[j])
      if (d < minGap) minGap = d
    }
  }
  return `${(minGap / 1000).toFixed(2)} km`
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const pauseForTool = () => {
  isPlaying.value = false
}

const seekTime = (us) => {
  currentTime.value = clampTime(us)
}

const reset = () => {
  isPlaying.value = false
  currentTime.value = 0
}

const onJump = (event) => {
  const v = Number(event.target.value)
  if (Number.isFinite(v)) {
    seekTime(v)
  }
}

const onSpeed = (event) => {
  speed.value = Number(event.target.value)
}

const onKeydown = (event) => {
  if (event.code !== 'Space' || (event.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|OPTION)$/i.test(event.target.tagName))) {
    return
  }
  event.preventDefault()
  togglePlay()
}

const onLogSelect = (ev) => {
  if (suppressLogClick.value === ev.eventId) {
    suppressLogClick.value = null
    return
  }

  if (activeDragEvent.value && activeDragEvent.value.eventId === ev.eventId) {
    return
  }

  seekTime(ev.timeStart)
}

const onEventTrackPointerDown = (ev, event) => {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  const startUs = Number(ev.startUs ?? ev.timeStart)
  const durationUs = Math.max(1, Number(ev.durationUs ?? Math.max(0, (ev.endUs ?? 0) - (ev.startUs ?? 0))))
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(rect.width, 1)))
  seekTime(startUs + durationUs * ratio)

  activeDragEvent.value = {
    eventId: ev.eventId,
    minUs: startUs,
    maxUs: startUs + durationUs,
    left: rect.left,
    width: Math.max(rect.width, 1),
  }
  suppressLogClick.value = ev.eventId
}

const onGlobalPointerMove = (event) => {
  if (!activeDragEvent.value) return
  const duration = Math.max(1, activeDragEvent.value.maxUs - activeDragEvent.value.minUs)
  const ratio = Math.min(
    1,
    Math.max(
      0,
      (event.clientX - activeDragEvent.value.left) / activeDragEvent.value.width,
    ),
  )
  seekTime(activeDragEvent.value.minUs + duration * ratio)
}

const onGlobalPointerUp = () => {
  if (activeDragEvent.value) {
    const evId = activeDragEvent.value.eventId
    requestAnimationFrame(() => {
      if (suppressLogClick.value === evId) {
        suppressLogClick.value = null
      }
    })
  }
  activeDragEvent.value = null
}

const tick = (ts) => {
  if (!isPlaying.value) {
    lastTs = 0
    return
  }

  if (!lastTs) {
    lastTs = ts
  }

  const diff = ts - lastTs
  lastTs = ts
  const next = currentTime.value + diff * 1000 * speed.value

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
    return
  }
  raf = requestAnimationFrame(tick)
})

onMounted(() => {
  if (currentTime.value > cycleEndUs.value) {
    currentTime.value = cycleEndUs.value
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
  <div class="page-wrap">
    <header class="topbar">
      <div>
        <p class="eyebrow">ns-3 Acoustic Replay</p>
        <h1>日志可视化</h1>
      </div>
      <p class="meta">当前：{{ timeDisplay(currentTime) }} / {{ timeDisplay(cycleEndUs) }}</p>
    </header>

    <section class="panel controls">
      <div class="control-grid">
        <button class="btn primary" @click="togglePlay">{{ isPlaying ? '暂停' : '播放' }}</button>
        <button class="btn" @click="reset">重置</button>
        <label class="field">
          <span>倍速</span>
          <select class="select" :value="speed" @change="onSpeed">
            <option :value="0.25">0.25x</option>
            <option :value="0.5">0.5x</option>
            <option :value="1">1x</option>
            <option :value="2">2x</option>
            <option :value="4">4x</option>
          </select>
        </label>
        <p class="hint">传输速度：1500 m/s | 节点最小间距：{{ formatNodeGap() }}</p>
      </div>
        <label class="field range-wrap">
          <span>时间进度（拖拽滑条，空格键暂停/播放）</span>
          <input
            class="range"
            type="range"
            :min="0"
            :max="cycleEndUs"
            :step="1000"
            :value="currentTime"
            @input="onJump"
            :style="{ '--range-progress': rangeProgressStyle }"
          />
        </label>
      <p class="hint">说明：日志文件来源固定 `src/assets/net.log`，未写后端。
      </p>
    </section>

    <section class="panel card-grid">
      <div class="card visual">
        <div class="card-title">节点视图（画布可拖拽）</div>
        <NodeCanvas
          :nodes="nodesState"
          :txs="activeTxs"
          :rxs="activeRxs"
          :current-time="currentTime"
          @pause-request="pauseForTool"
        />
      </div>

      <aside class="card log">
        <div class="card-title">日志时间记录（近120条）</div>
        <ul class="log-list">
          <li v-if="parseErrors.length" class="log-item parse-error">日志解析失败：{{ parseErrors.length }} 条</li>
          <li v-if="visibleLogEvents.length === 0" class="log-item empty">暂无日志...</li>
          <li
            v-for="ev in visibleLogEvents"
            :key="ev.eventId"
            class="log-item"
            :class="{ 'log-item-active': activeEvent?.eventId === ev.eventId }"
            @click="onLogSelect(ev)"
          >
            <div
              class="event-track"
              @pointerdown="onEventTrackPointerDown(ev, $event)"
            >
              <div
                class="event-band"
                :style="{ width: `${ev.trackProgressPct}%` }"
                aria-hidden="true"
              ></div>
            </div>
            <div class="log-content">
              <span class="time">{{ ev.prettyTime }}</span>
              <span class="tag" :class="`tag-${ev.status}`">{{ ev.status === 'normal' ? '正常包' : '冲突包' }}</span>
              <span class="duration">时长 {{ ev.durationMs }} ms</span>
              <span v-if="ev.type === 'tx'">
                {{ ev.tx_id }} {{ ev.sourceLabel }} 发射广播（{{ ev.packet_uid }}）
              </span>
              <span v-else>
                {{ ev.rx_id }} {{ ev.sourceLabel }} -> {{ ev.dstLabel }} {{ ev.status === 'collision' ? '冲突包' : '正常包' }}
                | delay {{ ev.delayMs }} ms
              </span>
              <span class="track-hint">进度 {{ ev.trackProgressPct.toFixed(0) }}%</span>
            </div>
          </li>
        </ul>

        <div class="stat-grid">
          <div>发包总数: {{ summary.total }}</div>
          <div>成功: {{ summary.ok }}</div>
          <div>碰撞: {{ summary.collision }}</div>
          <div>成功率: {{ summary.rate }}%</div>
        </div>
      </aside>
    </section>

    <section class="panel legend">
      <p>周期保证：{{ timeDisplay(MIN_SIM_TIME_US) }}（若日志短于该时长，会自动补零时间段）。</p>
    </section>
  </div>
</template>
