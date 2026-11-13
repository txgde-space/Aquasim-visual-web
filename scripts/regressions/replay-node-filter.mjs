import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { effectScope, ref, nextTick } from 'vue'

export async function checkReplayNodeFilter(server) {
  const replayPage = readFileSync(new URL('../../src/pages/ReplayPage.vue', import.meta.url), 'utf8')
  for (const component of ['NodeCanvas', 'AsyncNodeScene3D']) {
    const block = replayPage.match(new RegExp(`<${component}\\b[\\s\\S]*?</${component}>`))?.[0]
    assert.ok(block, `${component} exposes node actions`)
    assert.match(block, /#node-actions="\{ node \}"[\s\S]*?<NodeFocusSwitch v-model="focusedNodeId" :node-id="node.node_id"/,
      `${component} binds the same page-owned focus state to its selected node`)
  }
  const loader = readFileSync(new URL('../../src/features/scene3d/AsyncNodeScene3D.vue', import.meta.url), 'utf8')
  assert.match(loader, /#node-actions="slotProps"[\s\S]*?<slot name="node-actions" v-bind="slotProps"/,
    'the lazy loading boundary preserves the selected-node slot payload')

  const [{ parseLog }, { useReplayState }, { useEditMode }, { useLogPanel }] = await Promise.all([
    '/src/features/replay/lib/logParser.ts', '/src/features/replay/composables/useReplayState.ts',
    '/src/features/replay/composables/useEditMode.ts', '/src/features/replay/composables/useLogPanel.ts',
  ].map(file => server.ssrLoadModule(file)))
  const scope = effectScope()
  let dragEnds = 0, playToggles = 0
  const playback = { togglePlay: () => playToggles++, currentTime: ref(2.5e6), isPlaying: ref(true), focusedPacketId: ref(null), scrubEnd: () => dragEnds++, pauseForTool: () => {} }
  const raw = {
    meta: { sim_end_us: 30e6, trace_scope: 'phy-events' },
    nodes: [0, 1, 2, 3, 4, 5].map(node_id => ({ node_id, name: node_id === 2 ? 'Sink' : `Node-${node_id}`, x: node_id * 100, y: 0, z: 0 })),
    packets: [
      { packet_id: 'forwarded', event_id: 'first-hop', src: 0, tx_start_us: 0, tx_duration_us: 1e6, receivers: [
        { dst: 1, status: 'ok', rx_start_us: 1e6, rx_duration_us: 2e6 },
        { dst: 2, status: 'fail', reason: 'collision_rx_rx', collision_start_us: 3e6, with: ['interferer'], rx_start_us: 2e6, rx_duration_us: 2e6 },
        { dst: 4, status: 'ok', rx_start_us: 2e6, rx_duration_us: 8e6 },
      ] },
      { packet_id: 'forwarded', event_id: 'next-hop', src: 1, tx_start_us: 10e6, tx_duration_us: 1e6, receivers: [
        { dst: 2, status: 'ok', rx_start_us: 12e6, rx_duration_us: 1e6 },
      ] },
      { packet_id: 'interferer', src: 3, tx_start_us: 2e6, tx_duration_us: 1e6, receivers: [
        { dst: 2, status: 'fail', reason: 'collision_rx_rx', collision_start_us: 3e6, with: ['forwarded'], rx_start_us: 3e6, rx_duration_us: 1e6 },
      ] },
      { packet_id: 'blocked', src: 0, tx_start_us: 8e6, tx_duration_us: 0, tx_committed: false, tx_blocked_reason: 'busy', receivers: [] },
      { packet_id: 'unrelated', src: 3, tx_start_us: 20e6, tx_duration_us: 1e6, receivers: [
        { dst: 4, status: 'ok', rx_start_us: 21e6, rx_duration_us: 1e6 },
      ] },
    ],
  }
  try {
    const state = scope.run(() => useReplayState({ playback }))
    state.applyParsedLog(parseLog(JSON.stringify(raw)))
    const original = JSON.stringify(state.sourcePacketRows.value)
    const allPackets = state.packets.value
    const fullEnd = state.cycleEndUs.value
    const globalSummary = { ...state.summary.value }
    const panel = scope.run(() => useLogPanel({ state, playback }))
    const playKey = { code: 'KeyP', defaultPrevented: false, target: { tagName: 'CANVAS' }, preventDefault() {} }
    for (const extra of [
      { code: 'Space' }, { code: 'Space', defaultPrevented: true },
      { defaultPrevented: true }, { isComposing: true }, { repeat: true },
      { ctrlKey: true }, { metaKey: true }, { altKey: true },
      ...['INPUT','TEXTAREA','SELECT','BUTTON'].map(tagName => ({ target: { tagName } })),
      { target: { tagName: 'DIV', isContentEditable: true } },
      { target: { tagName: 'SPAN', closest: () => ({}) } },
    ]) panel.onKeydown({ ...playKey, ...extra })
    assert.equal(playToggles, 0, 'Space, editing, handled keys, repeat and system shortcuts cannot toggle playback')
    panel.onKeydown(playKey)
    panel.onKeydown({ ...playKey, shiftKey: true, target: { tagName: 'BODY' } })
    assert.equal(playToggles, 2, 'P toggles playback in the canvas and body, including uppercase P')

    panel.activeDragEvent.value = { eventId: 'unrelated', moved: true }
    panel.suppressLogClick.value = 'unrelated'
    playback.currentTime.value = 2.5e6
    playback.isPlaying.value = true
    playback.focusedPacketId.value = 'unrelated'
    state.focusedNodeId.value = 2
    assert.equal(state.focusedNodeLabel.value, 'Sink · ID 2')
    assert.equal(state.packetEntries.value.length, 3)
    assert.ok(state.packetEntries.value.every(p => p.src === 2 || p.receivers.every(r => r.dst === 2)))
    assert.equal(state.packetEntries.value.find(p => p.eventId === 'first-hop').endUs, 4e6, 'unrelated long receive branch does not extend the focused event')
    assert.equal(state.packetEntries.value.find(p => p.eventId === 'first-hop').receivers[0].collision_start_us, 3e6)
    assert.equal(state.summary.value.okReceivers, 1)
    assert.equal(state.summary.value.rxrxCollisions, 2)
    assert.equal(state.originalSummary.value.okReceivers, 1)
    assert.equal(state.displayPackets.value.length, 2)
    assert.equal(state.nodeVisuals.value.find(n => n.node_id === 4).mode, 'idle', 'unrelated listeners do not animate')
    assert.equal(playback.currentTime.value, 2.5e6)
    assert.equal(playback.isPlaying.value, true, 'filtering preserves the clock and play state')
    assert.equal(playback.focusedPacketId.value, null)
    assert.equal(panel.activeDragEvent.value, null)
    assert.equal(panel.suppressLogClick.value, null)
    assert.equal(dragEnds, 1, 'switching scope ends a stale event-track drag')
    assert.equal(state.cycleEndUs.value, fullEnd, 'filtering never crops the original simulation timeline')
    assert.equal(state.nodesState.value.length, 6, 'topology remains available')
    const entries = state.packetEntries.value, scoped = state.scopedPackets.value, options = state.nodeFilterOptions.value
    playback.currentTime.value = 3.5e6
    assert.equal(state.packetEntries.value, entries)
    assert.equal(state.scopedPackets.value, scoped)
    assert.equal(state.nodeFilterOptions.value, options, 'clock updates never rebuild filter metadata')
    assert.equal(state.nodeVisuals.value.find(n => n.node_id === 2).mode, 'collision')
    state.replayMode.value = 'lifecycle'
    assert.equal(state.lifecycleGroups.value.find(g => g.packet_id === 'forwarded').segments.length, 2, 'related forwarding hops remain distinct')
    assert.ok(state.displayPackets.value.every(p => p.receivers.every(r => r.dst === 2)))
    state.focusedNodeId.value = 5
    await nextTick()
    assert.equal(state.packetEntries.value.length, 0)
    assert.equal(state.lifecyclePacket.value, null)
    assert.equal(state.displayPackets.value.length, 0)
    assert.equal(state.summary.value.packetCount, 0)
    state.focusedNodeId.value = 0
    assert.equal(state.packetEntries.value.length, 2, 'node ID zero is a valid selection')
    assert.equal(state.summary.value.blockedPacketCount, 1, 'blocked outgoing attempts remain visible')
    assert.equal(state.packetEntries.value.find(p => p.eventId === 'first-hop').receivers.length, 3, 'all outgoing branches concern the selected sender')
    assert.ok(!state.packetEntries.value.some(p => p.packet_id === 'interferer'))
    assert.equal(state.packetEntries.value.find(p => p.eventId === 'first-hop').receivers.find(r => r.dst === 2).collision_start_us, 3e6, 'hidden interferers cannot alter collision timing')
    state.focusedNodeId.value = null
    assert.deepEqual(state.summary.value, globalSummary)
    assert.equal(state.packets.value, allPackets)
    assert.equal(JSON.stringify(state.sourcePacketRows.value), original, 'scope changes cannot mutate trace records')
    state.focusedNodeId.value = 2
    const edit = scope.run(() => useEditMode({ state, playback }))
    edit.setInteractionMode('edit')
    state.selectedEditNodeIds.value = [2]
    edit.removeSelectedEditNodes()
    assert.equal(state.focusedNodeId.value, null, 'deleting the focused node clears its view scope')
    edit.exitEditMode()
    state.focusedNodeId.value = 2
    state.applyParsedLog(parseLog(JSON.stringify(raw)))
    assert.equal(state.focusedNodeId.value, null, 'new imports reset the scope even when an ID is reused')
    assert.equal(state.packetEntries.value.length, raw.packets.length)
    state.focusedNodeId.value = 2
    state.applyTopology(state.baseNodesState.value)
    assert.equal(state.focusedNodeId.value, null)
    assert.equal(state.sourcePacketRows.value.length, 0)
  } finally { scope.stop() }
  console.log('Replay node filter passed: incoming/outgoing branches, failures, node zero, forwarding, lifecycle/empty views, clock/cache stability, drag cleanup, reset and immutable traces.')
}
