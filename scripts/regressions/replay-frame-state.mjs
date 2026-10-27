import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { effectScope, nextTick, ref } from 'vue'

// Captured before the performance refactor, including forward/backward seeks at
// every TX/RX/collision/linger boundary. These hashes exclude removed UI metadata.
const visualBaseline = {
  'net-swarm.json': 'cc0806f1141e186e5998cc61a3cf726b317d5459905954ada96170de398231ad',
  'net.json': 'ef466f79303cdb82b90f4906f760440fcbed163c9d9436ffaf5447bea1630a5c',
  'net_chain_5_no_conflict.log': '85f0d5acfc3d0317c5cd4d371aa918e736c4328641f4d7608efdd4da3c03267a',
  'net_moving.json': '5948a5afbf2eb3330318ef87d888096986b3f98ff012adde2f927f0de12cf7fc',
  'net_multihop.json': 'c696339e985936c46b020cb2dd8221c1505248faa3d948a0d8b2648d649ca7ea',
  'net_multihop.log': 'fc63e9b6b00b88805e63b8b29c172a60e0a76afbe89ea1b0141733256560db2d',
  'net_multihop_complex.json': '4ddbd035b8d32e843138141b7c4da6025572a668c760f5f40b6c173fea5d55b4',
  'net_multihop_complex.log': 'b3a7c214a2ac2f228510936c5fccf3d8d6eea737679688b27d98b4d8f2dc3478',
}

export async function checkReplayFrameState(server, root) {
  const { useReplayState } = await server.ssrLoadModule('/src/features/replay/composables/useReplayState.ts')
  const { parseLog } = await server.ssrLoadModule('/src/features/replay/lib/logParser.ts')
  const { indexPacketIntervals, activePacketsAt, changedPacketsBetween, indexTimingWarnings, packetTimingKey } = await server.ssrLoadModule('/src/features/replay/lib/packetTimeline.ts')
  const { buildNodeVisual } = await server.ssrLoadModule('/src/features/replay/lib/nodeVisuals.ts')
  const { earlierArrivalLate } = await server.ssrLoadModule('/src/features/replay/lib/geometry.ts')
  let visits = 0
  for (const [name, expected] of Object.entries(visualBaseline)) {
    const scope = effectScope()
    try {
      const playback = { currentTime: ref(0), isPlaying: ref(true), focusedPacketId: ref(null) }
      const state = scope.run(() => useReplayState({ playback }))
      state.applyParsedLog(parseLog(fs.readFileSync(path.join(root, 'src/assets', name), 'utf8')))
      playback.isPlaying.value = true
      const times = new Set([0, state.cycleEndUs.value])
      for (const packet of state.packets.value) {
        const boundaries = [packet.tx_start_us, packet.tx_end_us, packet.timeEnd,
          ...packet.receivers.flatMap((receiver) => [receiver.rx_start_us, receiver.rx_end_us,
            receiver.collision_start_us, receiver.rx_end_us + 180000, receiver.rx_end_us + 220000])]
        for (const time of boundaries) for (const delta of [-1, 0, 1]) if (time + delta >= 0) times.add(time + delta)
      }
      const ordered = [...times].sort((a, b) => a - b)
      const values = []
      const entries = state.packetEntries.value
      const groups = state.lifecycleGroups.value
      const options = state.lifecyclePacketOptions.value
      const staticNodes = state.nodesState.value
      for (const time of [...ordered, ...ordered.slice().reverse()]) {
        playback.currentTime.value = time
        await nextTick()
        assert.equal(state.packetEntries.value, entries, 'packet metadata must not rebuild per frame, including moving nodes')
        assert.equal(state.lifecycleGroups.value, groups, 'lifecycle aggregation must not rebuild per frame')
        assert.equal(state.lifecyclePacketOptions.value, options)
        if (!state.nodeMovementRows.value.length) assert.equal(state.nodesState.value, staticNodes)
        values.push({ t: time, nodes: state.nodesState.value, visuals: state.nodeVisuals.value,
          display: state.displayPackets.value.map((packet) => packet.eventId), active: state.globalActiveEventId.value,
          ids: [...state.currentPacketIds.value], stages: state.lifecycleStages.value, lifecycleActive: state.lifecycleActiveEventId.value })
      }
      visits += values.length
      assert.equal(createHash('sha256').update(JSON.stringify(values)).digest('hex'), expected, `${name}: unchanged replay frame behavior`)
      state.replayMode.value = 'lifecycle'
      for (const group of state.lifecycleGroups.value) {
        state.selectedLifecyclePacketId.value = group.packet_id
        for (const time of [group.endUs + 1, group.startUs, group.endUs, Math.max(0, group.startUs - 1)]) {
          playback.currentTime.value = time
          assert.deepEqual(state.displayPackets.value.map((packet) => packet.eventId), group.segments.map((packet) => packet.eventId))
        }
      }
    } finally { scope.stop() }
  }

  // A long event preceding shorter ones and equal start times defeat simplistic
  // binary-search-only lookups; prefix end bounds must preserve all overlaps.
  const entries = [
    { eventId: 'long', startUs: 0, endUs: 1000 }, { eventId: 'a', startUs: 10, endUs: 20 },
    { eventId: 'b', startUs: 10, endUs: 30 }, { eventId: 'instant', startUs: 25, endUs: 25 },
    { eventId: 'invalid-duration', startUs: 40, endUs: 39 }, { eventId: 'late', startUs: 50, endUs: 60 },
  ]
  const index = indexPacketIntervals(entries)
  for (const time of [1001, 1000, 0, -1, 10, 20, 21, 25, 30, 31, 39, 40, 50, 60, 61, 15, 5]) {
    assert.deepEqual(activePacketsAt(index, time), entries.filter((entry) => time >= entry.startUs && time <= entry.endUs))
  }

  const progress = (packet, time) => Math.max(0, Math.min(1, (time - packet.startUs) / Math.max(1, packet.endUs - packet.startUs))) * 100
  const rowAt = (packet, time) => ({ progress: progress(packet, time), active: time >= packet.startUs && time <= packet.endUs })
  const assertChangedRows = (packets, previous, time) => {
    const packetIndex = indexPacketIntervals(packets)
    const candidates = changedPacketsBetween(packetIndex, previous, time)
    const candidateSet = new Set(candidates)
    assert.equal(candidates.length, candidateSet.size, 'each changed row is visited at most once')
    const updated = packets.map((packet) => rowAt(packet, candidateSet.has(packet) ? time : previous))
    assert.deepEqual(updated, packets.map((packet) => rowAt(packet, time)), `delta updates match a full refresh at ${previous} → ${time}`)
  }
  // Fractional replay times expose max(1,duration)'s tiny tail after an instant
  // event. The ordinary active union alone would miss 25.25 → 25.75 here.
  for (const [previous, time] of [[25.25, 25.75], [25.75, 25.25], [24, 26], [26, 24], [25, 26], [26, 25], [40.1, 40.9], [40.9, 40.1], [0, 1001], [1001, 0], [10, 10]]) {
    assertChangedRows(entries, previous, time)
  }
  assert.deepEqual(changedPacketsBetween(index, 10, 10), [])
  let seed = 0x12345678
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 }
  const durations = [-1, 0, 0.1, 0.5, 1, 2, 10, 100]
  const randomEntries = Array.from({ length: 400 }, (_, i) => {
    const startUs = Math.floor(random() * 200) / 4
    return { eventId: `random-${i}`, startUs, endUs: startUs + durations[Math.floor(random() * durations.length)] }
  }).sort((a, b) => a.startUs - b.startUs)
  for (let i = 0; i < 300; i++) assertChangedRows(randomEntries, random() * 180 - 5, random() * 180 - 5)
  for (const packet of randomEntries.slice(0, 30)) {
    for (const boundary of [packet.startUs, packet.endUs, packet.startUs + 1]) {
      assertChangedRows(randomEntries, boundary - 0.01, boundary)
      assertChangedRows(randomEntries, boundary, boundary + 0.01)
      assertChangedRows(randomEntries, boundary + 0.01, boundary - 0.01)
    }
  }
  const sparse = Array.from({ length: 5000 }, (_, i) => ({ eventId: `sparse-${i}`, startUs: i * 100, endUs: i * 100 + 50 }))
  assert.equal(changedPacketsBetween(indexPacketIntervals(sparse), 1001, 1002).length, 1, 'steady playback only revisits the active row')

  // Compare timing warnings with the old predicate, including repeated event
  // IDs, equal TX times and a success on a different branch of the same packet.
  const packets = Array.from({ length: 400 }, (_, i) => ({
    packet_id: `packet-${i % 7}`, eventId: `event-${i % 29}`, tx_start_us: (i % 31) * 100,
    receivers: [{ status: i % 3 ? 'ok' : 'fail', rx_end_us: ((i * 13) % 41) * 100 }],
  }))
  const warnings = indexTimingWarnings(packets)
  for (const packet of packets) assert.equal(warnings.get(packetTimingKey(packet)), earlierArrivalLate(packet, packets))

  const node = { node_id: 1, name: 'N1', x: 0, y: 0 }
  const tx = (id) => ({ packet_id: id, tx_start_us: 100, tx_end_us: 200, tx_duration_us: 100 })
  const rx = (id, reason = null) => ({ packet_id: id, status: reason ? 'fail' : 'ok', reason,
    rx_start_us: 100, rx_end_us: 300, rx_duration_us: 200, collision_start_us: 150 })
  const receivers = [rx('first'), rx('last'), rx('rx-tx', 'collision_rx_tx'), rx('rx-rx', 'collision_rx_rx')]
  assert.equal(buildNodeVisual(node, [tx('first-tx'), tx('last-tx')], receivers, 150).packetId, 'last-tx')
  assert.equal(buildNodeVisual(node, [tx('last-tx')], receivers, 150).overlay.kind, 'collision_rx_tx')
  assert.equal(buildNodeVisual(node, [], receivers, 149).packetId, 'last', 'successful RX precedes a pre-collision RX')
  assert.equal(buildNodeVisual(node, [], receivers, 150).packetId, 'rx-rx', 'RX collision takes precedence at its inclusive start')
  assert.equal(buildNodeVisual(node, [], receivers, 300).mode, 'collision')
  assert.equal(buildNodeVisual(node, [], receivers, 301).packetId, 'rx-rx', 'failure linger precedes success linger, preserving equal-end order')
  assert.equal(buildNodeVisual(node, [], receivers, 220300).mode, 'collision-linger')
  assert.equal(buildNodeVisual(node, [], receivers, 220301).mode, 'idle')
  assert.equal(buildNodeVisual(node, [], [rx('ok')], 180300).mode, 'rx-done')
  assert.equal(buildNodeVisual(node, [], [rx('ok')], 180301).mode, 'idle')
  console.log(`Replay frame regressions passed: ${visits} boundary/seek snapshots, stable metadata, sparse progress updates, interval and collision precedence checks.`)
}
