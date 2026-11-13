import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'

export async function checkMovementPlayback(server) {
  const [{ indexMovements, movingNodesAt, movementViewBounds }, { normalizeMovements, resolveMovingNodes }, { useReplayState }, { parseLog }, { motionAngles }] = await Promise.all([
    '/src/features/replay/lib/movementTimeline.ts', '/src/features/replay/lib/logNormalize.ts',
    '/src/features/replay/composables/useReplayState.ts', '/src/features/replay/lib/logParser.ts', '/src/shared/nodeMotion.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const nodes = [
    { node_id: 1, name: 'AUV', role: 'node', modelType: 'auv', x: 0, y: 0, z: -80 },
    { node_id: 2, name: 'Fixed', role: 'sink', modelType: 'sensor', x: 300, y: 500, z: -140 },
  ]
  const raw = [
    { node_id: 1, start_us: 1e6, end_us: 3e6, start: { x: 0, y: 0, z: -80 }, end: { x: 20, y: 0, z: -80 } },
    { node_id: 1, start_us: 3e6, end_us: 4e6, start: { x: 20, y: 0, z: -80 }, end: { x: 20, y: 30, z: -70 } },
    { node_id: 1, start_us: 4e6, end_us: 5e6, start: { x: 20, y: 30, z: -70 }, end: { x: 20, y: 30, z: -70 } },
    // Preserve last-started-segment precedence for older overlapping logs.
    { node_id: 1, start_us: 6e6, end_us: 10e6, end: { x: 80, y: 40, z: -40 } },
    { node_id: 1, start_us: 7e6, end_us: 8e6, end: { x: 100, y: 50, z: -20 } },
  ]
  const movements = normalizeMovements(raw, nodes)
  const original = JSON.stringify({ nodes, movements })
  const index = indexMovements(movements)
  assert.deepEqual(movementViewBounds(nodes, movements), [{ x: 0, y: 0, z: -140 }, { x: 300, y: 500, z: -20 }])
  const positions = (rows) => rows.map(({ node_id, x, y, z }) => ({ node_id, x, y, z }))
  for (const time of [0, .5e6, 1e6, 2e6, 3e6, 3.5e6, 4e6, 4.5e6, 5e6, 6.5e6, 7e6, 8e6, 9e6, 12e6, 2e6]) {
    assert.deepEqual(positions(movingNodesAt(nodes, index, time)), positions(resolveMovingNodes(nodes, movements, time)), 'indexed playback preserves legacy positions at boundaries, gaps, overlaps and backward seeks')
    assert.equal(movingNodesAt(nodes, index, time)[1], nodes[1], 'stationary nodes keep their references')
  }
  assert.deepEqual(movingNodesAt(nodes, index, 3.5e6)[0].motionDirection, { x: 0, y: 30, z: 10 })
  assert.deepEqual(movingNodesAt(nodes, index, 4.5e6)[0].motionDirection, { x: 0, y: 30, z: 10 }, 'a pause keeps the most recent heading')
  assert.deepEqual(movingNodesAt(nodes, index, 2e6)[0].motionDirection, { x: 20, y: 0, z: 0 }, 'heading comes from simulation time, not previous rendered frame')
  assert.equal(movingNodesAt(nodes, new Map(), 2e6), nodes)
  assert.equal(motionAngles({ x: 0, y: 0, z: 0 }), null)
  assert.equal(motionAngles({ x: NaN, y: 1 }), null)
  assert.equal(motionAngles({ x: 0, y: 30, z: 0 }).heading, Math.PI / 2)
  assert.equal(JSON.stringify({ nodes, movements }), original, 'playback is pure and never rewrites a trace')

  let reads = 0
  const longRows = Array.from({ length: 100_000 }, (_, i) => ({ movement: {
    start_us: i * 100_000, end_us: (i + 1) * 100_000, duration_us: 100_000,
    start: { x: i, y: 0, z: -80 }, end: { x: i + 1, y: 0, z: -80 },
  }, direction: { x: 1, y: 0, z: 0 } }))
  const observed = new Proxy(longRows, { get(target, key) { if (/^\d+$/.test(String(key))) reads++; return target[key] } })
  assert.equal(movingNodesAt(nodes, new Map([[1, observed]]), 9_999_950_000)[0].x, 99_999.5)
  assert.ok(reads < 25, 'a large sampled trace is searched logarithmically instead of scanned each frame')

  const scope = effectScope()
  try {
    const playback = { currentTime: ref(0), isPlaying: ref(false), focusedPacketId: ref(null), pauseForTool() {} }
    const state = scope.run(() => useReplayState({ playback }))
    state.applyParsedLog(parseLog(JSON.stringify({ meta: { sim_end_us: 12e6 }, nodes, movements: raw, packets: [] })))
    playback.currentTime.value = 2e6
    assert.equal(state.nodesState.value[0].x, 10, 'movement-only logs animate without needing a transmitted packet')
    const base = JSON.stringify(state.staticModelNodes.value)
    const viewNodes = state.trajectoryViewNodes.value
    playback.currentTime.value = 3.5e6
    assert.equal(state.nodesState.value[0].y, 15)
    assert.equal(state.nodesState.value[0].z, -75)
    assert.equal(JSON.stringify(state.staticModelNodes.value), base, 'experiment topology transfer keeps initial positions')
    assert.equal(state.trajectoryViewNodes.value, viewNodes, 'moving playback never rebuilds the display bounds')
    assert.equal(state.sourcePacketRows.value.length, 0)
  } finally { scope.stop() }

  const { LOG_SOURCES } = await server.ssrLoadModule('/src/features/replay/lib/sources.ts')
  const survey = parseLog(LOG_SOURCES.default.raw)
  assert.equal(LOG_SOURCES.default.fileName, 'net_surface_survey.json')
  assert.equal(survey.parseErrors.length, 0)
  assert.equal(survey.meta.sim_end_us, 66e6)
  assert.equal(survey.meta.trace_scope, 'phy-events', 'new default contains observed simulator events')
  assert.equal(survey.nodes.length, 8)
  assert.equal(survey.movements.length, 5)
  assert.deepEqual(new Set(survey.nodes.map(node => node.modelType)), new Set(['vessel','buoy','rov','auv','sensor']))
  const surveyIndex = indexMovements(normalizeMovements(survey.movements, survey.nodes))
  for (const time of [0, 12e6, 33e6, 66e6, 0]) {
    const moving = movingNodesAt(survey.nodes, surveyIndex, time)
    assert.equal(moving[0].z, 498.9, 'vessel bottom retains 1.1 m draft at sea level 500 m')
    assert.equal(moving[1].z, 497.3, 'buoy remains on the surface throughout playback')
    assert.ok(moving.slice(2).every(node => node.z < 500), 'underwater equipment remains underwater')
    assert.ok(Math.abs(moving[0].x - (-300 + 1.6*time/1e6)) < 1e-6)
    assert.equal(moving[5], survey.nodes[5], 'fixed observers do not drift')
  }
  assert.ok(survey.packets.some(packet => packet.receivers.some(receiver => receiver.status === 'ok')))
  assert.ok(survey.packets.some(packet => packet.receivers.some(receiver => receiver.reason === 'collision_rx_rx')))
  console.log('Movement playback passed: real trace interpolation, deterministic headings, backward seek, idle identity, movement-only logs and logarithmic sampling lookup.')
}
