import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'

export async function checkReceiveTrace(server) {
  const [{ parseLog }, { useReplayState }, { packetSegmentColor, drawPacketRect }, { reasonLabel }, { packetColor, theme3DFor }] = await Promise.all([
    '/src/features/replay/lib/logParser.ts', '/src/features/replay/composables/useReplayState.ts',
    '/src/features/canvas2d/lib/draw/packets.ts', '/src/features/replay/lib/format.ts', '/src/features/scene3d/lib/themes3d.ts',
  ].map(file => server.ssrLoadModule(file)))
  const scope = effectScope()
  const playback = { currentTime: ref(0), isPlaying: ref(false), focusedPacketId: ref(null) }
  const nodes = [1, 2, 3, 4].map(node_id => ({ node_id, x: node_id * 500, y: 0, z: 0 }))
  const packet = (id, src, start, collision, partners) => ({ packet_id: id, src, tx_start_us: start, tx_duration_us: 12e6,
    receivers: [{ dst: 4, rx_start_us: start + 1e6, rx_duration_us: 12e6, status: 'fail', reason: 'collision_rx_rx',
      collision_start_us: collision, rx_drop_us: start + 13e6, with: partners }] })
  const log = {
    meta: { time_unit: 'us', time_precision_us: .001, trace_scope: 'phy-events', sim_end_us: 25e6 }, nodes,
    packets: [packet('a', 1, 0, 6e6, ['b', 'c']), packet('b', 2, 5e6, 6e6, ['a']), packet('c', 3, 10e6, 11e6, ['a'])],
  }
  try {
    const state = scope.run(() => useReplayState({ playback }))
    state.applyParsedLog(parseLog(JSON.stringify(log)))
    assert.equal(state.receiveEventTrace.value, true)
    assert.equal(state.successTraceOnly.value, false)
    const first = state.packets.value[0].receivers[0]
    assert.equal(first.collision_start_us, 6e6, 'later interferers cannot delay an observed first collision')
    assert.equal(first.rx_drop_us, 13e6, 'actual drop timing survives parsing and normalization')
    assert.deepEqual(first.with, ['b', 'c'])
    const profile = { tx: 'tx', rx: 'rx', bad: 'bad' }
    assert.equal(packetSegmentColor(first, .5e6, profile), 'tx')
    assert.equal(packetSegmentColor(first, 5e6, profile), 'rx', 'incoming packet remains normal until observed collision')
    assert.equal(packetSegmentColor(first, 6e6, profile), 'bad')
    playback.currentTime.value = 5e6
    assert.equal(state.nodeVisuals.value.find(node => node.node_id === 4).mode, 'rx')
    playback.currentTime.value = 6e6
    assert.equal(state.nodeVisuals.value.find(node => node.node_id === 4).mode, 'collision')
    const legacy = structuredClone(log); legacy.meta.trace_scope = 'phy-success'
    state.applyParsedLog(parseLog(JSON.stringify(legacy)))
    assert.equal(state.packets.value[0].receivers[0].collision_start_us, 11e6, 'legacy with-based timing semantics remain unchanged')
    assert.equal(state.receiveEventTrace.value, false)
    const invalid = structuredClone(log); invalid.packets[0].receivers[0].collision_start_us = -100
    state.applyParsedLog(parseLog(JSON.stringify(invalid)))
    assert.equal(state.packets.value[0].receivers[0].collision_start_us, 11e6, 'invalid observed time uses the existing bounded fallback')
    for (const reason of ['reception_incomplete', 'outcome_unreported']) {
      const partial = structuredClone(log); partial.packets = [packet('pending', 1, 0, 0, [])]
      partial.packets[0].receivers[0].reason = reason
      delete partial.packets[0].receivers[0].collision_start_us
      state.applyParsedLog(parseLog(JSON.stringify(partial)))
      playback.currentTime.value = 2e6
      assert.equal(state.nodeVisuals.value.find(node => node.node_id === 4).mode, 'rx')
      assert.equal(packetSegmentColor(state.packets.value[0].receivers[0], 2e6, profile), 'rx', 'an unfinished/unknown outcome cannot fabricate a collision')
      const palette = theme3DFor('industrial-scada')
      assert.equal(packetColor(state.packets.value[0].receivers[0], 2e6, palette), palette.rx)
      const context = new Proxy({}, { get: () => () => {}, set: () => true })
      drawPacketRect(context, { src: { x: 0, y: 0 }, dst: { x: 100, y: 0 } }, state.packets.value[0],
        state.packets.value[0].receivers[0], 2e6, { ...profile, ring: 'ring' }, 1, 2)
      // The minimal context deliberately lacks a gradient result: any false collision burst would throw.
      assert.notEqual(reasonLabel(reason), '接收失败')
      playback.currentTime.value = 13_050_000
      assert.equal(state.nodeVisuals.value.find(node => node.node_id === 4).mode, 'idle', 'an unobserved outcome never produces a collision burst')
    }
  } finally { scope.stop() }
  console.log('Receive trace regressions passed: observed collision timing, normal arrival before collision, drop metadata, incomplete outcomes and frozen legacy semantics.')
}
