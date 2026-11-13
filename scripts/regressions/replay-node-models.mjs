import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { effectScope, ref } from 'vue'

export async function checkReplayNodeModels(server) {
  const [{ parseLog }, { useReplayState }, { useEditMode }, { resolveNodeModel }] = await Promise.all([
    '/src/features/replay/lib/logParser.ts',
    '/src/features/replay/composables/useReplayState.ts',
    '/src/features/replay/composables/useEditMode.ts',
    '/src/shared/nodeModel.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const scope = effectScope()
  const playback = {
    currentTime: ref(0), isPlaying: ref(false), focusedPacketId: ref(null),
    pauseForTool() { this.isPlaying.value = false },
  }
  const raw = {
    meta: { sim_end_us: 30e6 },
    nodes: [
      { node_id: 1, name: 'Sink', role: 'sink', x: 0, y: 0, z: -20, modelType: 'sensor' },
      { node_id: 2, name: 'A', role: 'node', x: 1000, y: 200, z: -50, modelType: 'auv' },
      { node_id: 3, name: 'B', role: 'node', x: -1000, y: 400, z: -150 },
    ],
    packets: [{ packet_id: 'one', src: 2, tx_start_us: 1e6, tx_duration_us: 1.6e6,
      receivers: [{ dst: 1, rx_start_us: 2e6, rx_duration_us: 1.6e6, status: 'ok' }] }],
  }
  const parsed = parseLog(JSON.stringify(raw))
  const node = (state, id) => state.nodesState.value.find((item) => item.node_id === id)
  const poses = (nodes) => nodes.map(({ node_id, x, y, z, role }) => ({ node_id, x, y, z, role }))
  try {
    const state = scope.run(() => useReplayState({ playback }))
    const edit = scope.run(() => useEditMode({ state, playback }))
    state.applyParsedLog(parsed)
    assert.equal(resolveNodeModel(node(state, 1)), 'sensor', 'an explicit model remains independent of the sink role')
    const base = state.baseNodesState.value
    const sourceText = JSON.stringify(base)
    const packets = state.sourcePacketRows.value
    const entries = state.packetEntries.value
    const originalPoses = poses(base)
    playback.currentTime.value = 2e6
    playback.isPlaying.value = true
    state.focusedNodeId.value = 1
    playback.focusedPacketId.value = state.packetEntries.value[0].eventId
    const focusedEntries = state.packetEntries.value
    const selectedPacket = playback.focusedPacketId.value
    state.onNodeModelChange({ node_id: 2, modelType: 'rov' })
    assert.equal(node(state, 2).modelType, 'rov')
    assert.equal(node(state, 1).modelType, 'sensor')
    assert.equal(node(state, 3).modelType, undefined)
    assert.equal(state.baseNodesState.value, base, 'display changes preserve the topology identity used by the 3D camera')
    assert.equal(JSON.stringify(base), sourceText, 'display changes do not rewrite imported log metadata')
    assert.deepEqual(poses(state.nodesState.value), originalPoses, 'model selection does not change coordinates or roles')
    assert.equal(state.sourcePacketRows.value, packets)
    assert.equal(state.packetEntries.value, focusedEntries, 'model changes do not rebuild packet metadata')
    assert.equal(playback.currentTime.value, 2e6)
    assert.equal(playback.isPlaying.value, true)
    assert.equal(playback.focusedPacketId.value, selectedPacket)
    assert.equal(state.focusedNodeId.value, 1)
    assert.equal(state.staticModelNodes.value.find((item) => item.node_id === 2).modelType, 'rov',
      'the static topology exported to the experiment includes model choices')

    const stationary = state.nodesState.value
    playback.currentTime.value = 3e6
    assert.equal(state.nodesState.value, stationary, 'stationary topology references remain stable as playback advances')
    state.onNodeModelChange({ node_id: 999, modelType: 'buoy' })
    state.onNodeModelChange({ node_id: 2, modelType: 'unknown' })
    assert.equal(node(state, 2).modelType, 'rov', 'invalid runtime UI payloads cannot corrupt the model choice')
    assert.equal(state.nodesState.value.length, 3)
    state.focusedNodeId.value = null
    assert.deepEqual(state.packetEntries.value, entries)

    edit.enterEditMode()
    assert.equal(node(state, 2).modelType, 'rov', 'entering edit mode carries the selected display model')
    const simulated = state.simulatedPacketRows.value
    state.onNodeModelChange({ node_id: 3, modelType: 'buoy' })
    assert.equal(node(state, 3).modelType, 'buoy')
    assert.equal(state.simulatedPacketRows.value, simulated, 'model changes do not rerun geometric packet inference')
    edit.restoreAllEditNodes()
    assert.equal(node(state, 3).modelType, 'buoy', 'restoring positions preserves the display model choice')
    edit.exitEditMode()
    assert.equal(node(state, 2).modelType, 'rov')
    assert.equal(node(state, 3).modelType, 'buoy')
    assert.equal(JSON.stringify(base), sourceText)

    state.applyParsedLog(parsed, edit.exitEditMode)
    assert.equal(node(state, 2).modelType, 'auv', 'new logs clear model overrides even when node IDs repeat')
    assert.equal(node(state, 3).modelType, undefined)
    state.applyTopology([
      { node_id: 1, name: 'Sink', role: 'sink', x: 10, y: 20, z: -30, modelType: 'rov' },
      { node_id: 2, name: 'Sensor', role: 'node', x: 110, y: 220, z: -130, modelType: 'sensor' },
    ], edit.exitEditMode)
    assert.equal(node(state, 1).modelType, 'rov', 'experiment topology transfers retain explicit models')
    assert.equal(node(state, 2).modelType, 'sensor')
    assert.equal(state.sourcePacketRows.value.length, 0)

    const moving = parseLog(JSON.stringify({ ...raw, nodes: raw.nodes.map((item) => item.node_id === 2
      ? { ...item, movements: [{ start_us: 0, end_us: 1e6, to_x: 2000, to_y: 400, to_z: -100 }] }
      : item) }))
    state.applyParsedLog(moving, edit.exitEditMode)
    state.onNodeModelChange({ node_id: 2, modelType: 'vessel' })
    const tracks = JSON.stringify(state.nodeMovementRows.value)
    playback.currentTime.value = 0.5e6
    assert.equal(node(state, 2).modelType, 'vessel')
    assert.equal(node(state, 2).x, 1500)
    assert.equal(state.staticModelNodes.value.find((item) => item.node_id === 2).x, 1000,
      'exported static topology is independent of playback interpolation')
    edit.enterEditMode()
    assert.equal(node(state, 2).x, 1500, 'edit snapshots still use the current movement position')
    assert.equal(node(state, 2).modelType, 'vessel')
    edit.exitEditMode()
    playback.currentTime.value = 0.75e6
    assert.equal(node(state, 2).x, 1750)
    assert.equal(node(state, 2).modelType, 'vessel')
    assert.equal(JSON.stringify(state.nodeMovementRows.value), tracks, 'display overrides preserve movement tracks')
  } finally { scope.stop() }

  const replayPage = readFileSync(new URL('../../src/pages/ReplayPage.vue', import.meta.url), 'utf8')
  for (const component of ['NodeCanvas', 'AsyncNodeScene3D']) {
    const block = replayPage.match(new RegExp(`<${component}\\b[\\s\\S]*?</${component}>`))?.[0]
    assert.ok(block, `${component} is present`)
    assert.match(block, /#node-actions="\{ node \}"[\s\S]*?<NodeModelSelect/,
      `${component} exposes the shared per-node model selector`)
    assert.match(block, /onNodeModelChange/, `${component} updates the same replay model state`)
  }
  console.log('Replay node models passed: individual display changes, trace and clock invariance, stable stationary nodes, edit lifecycle, movement, topology transfer and shared 2D/3D controls.')
}
