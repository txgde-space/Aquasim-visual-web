import assert from 'node:assert/strict'
import { createRenderer, effectScope, h, nextTick, reactive, ref, shallowRef, ssrContextKey } from 'vue'
import { NullEngine, Scene } from '@babylonjs/core'

export async function checkRadioReplay(server) {
  const [parser, normalize, merge, geometry, format, propagation, stateLib, editLib, panelLib, progressLib, drawing] = await Promise.all([
    '/src/features/replay/lib/logParser.ts', '/src/features/replay/lib/logNormalize.ts',
    '/src/features/replay/lib/logMerge.ts', '/src/shared/acousticSim.ts', '/src/features/replay/lib/format.ts',
    '/src/features/replay/lib/propagation.ts', '/src/features/replay/composables/useReplayState.ts',
    '/src/features/replay/composables/useEditMode.ts', '/src/features/replay/composables/useLogPanel.ts',
    '/src/features/replay/composables/usePacketListProgress.ts', '/src/features/canvas2d/lib/draw/scene.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} ≠ ${expected}`)
  const speed = 299792458
  const nodes = [{ node_id: 1, x: 0, y: 0, z: 0 }, { node_id: 2, x: 100, y: 0, z: 0 }]
  const rawPacket = { packet_id: 'rf', src: 1, tx_start_us: 10.123, tx_duration_us: 0.064,
    receivers: [{ dst: 2, rx_start_us: 10.457, rx_duration_us: 0.064, status: 'ok' }] }
  const makeLog = (meta = { medium: 'radio', propagation_speed_mps: speed }) => parser.parseLog(JSON.stringify({
    meta: { time_unit: 'us', distance_unit: 'm', sim_end_us: 30_000_000, ...meta }, nodes, packets: [rawPacket],
  }))
  const parsed = makeLog()
  assert.equal(parsed.meta.medium, 'radio')
  assert.equal(parsed.meta.propagation_speed_mps, speed)
  assert.deepEqual(parsed.nodes.map(({ x, y, z }) => [x, y, z]), [[0, 0, 0], [100, 0, 0]], 'radio remains in unmodified meter coordinates')
  const packets = merge.normalizePacketsFromParsed(parsed, 'radio')
  assert.equal(packets[0].tx_start_us, 10.123)
  assert.equal(packets[0].tx_duration_us, 0.064)
  assert.equal(packets[0].receivers[0].rx_start_us, 10.457)
  assert.equal(packets[0].receivers[0].rx_duration_us, 0.064)
  close(packets[0].timeEnd, 10.521, 'sub-microsecond RX end')
  assert.equal(propagation.propagationSpeedFromMeta(makeLog({ medium: 'radio' }).meta), speed)
  assert.equal(propagation.propagationSpeedFromMeta(makeLog({}).meta), 1500)
  assert.equal(propagation.propagationSpeedFromMeta(makeLog({ medium: 'acoustic', propagation_speed_mps: 1480 }).meta), 1480)
  for (const invalid of [-1, 0, '299792458', null]) {
    assert.equal(makeLog({ medium: 'radio', propagation_speed_mps: invalid }).meta.propagation_speed_mps, undefined)
  }
  assert.equal(makeLog({ medium: 'unknown' }).meta.medium, undefined)
  const precise = makeLog({ time_precision_us: 0.001, propagation_speed_mps: 1480, trace_scope: 'phy-success' })
  assert.equal(precise.meta.medium, undefined, 'precision does not require a named medium')
  assert.equal(precise.meta.trace_scope, 'phy-success', 'recording scope survives parsing for UI disclosure')
  assert.equal(propagation.usesFractionalTiming(precise.meta), true)
  const precisePacket = merge.normalizePacketsFromParsed(precise, 'generic-precise')[0]
  assert.equal(precisePacket.tx_duration_us, 0.064)
  assert.equal(precisePacket.receivers[0].rx_duration_us, 0.064)
  for (const invalid of [-1, 0, '0.001', null]) {
    assert.equal(makeLog({ time_precision_us: invalid }).meta.time_precision_us, undefined)
  }
  for (const duration of [undefined, 0, 0.064]) {
    const input = { src: 1, tx_start_us: 0, tx_duration_us: duration,
      receivers: [{ dst: 2, rx_start_us: 0, rx_duration_us: duration }] }
    assert.equal(normalize.normalizePacket(input, 0).tx_duration_us, 1, 'legacy zero/missing/fractional duration semantics stay frozen')
    assert.equal(normalize.normalizePacket(input, 0).receivers[0].rx_duration_us, 1)
    const radio = normalize.normalizePacket(input, 0, true)
    assert.equal(radio.tx_duration_us, duration ?? 0, 'radio data is never stretched for display')
    assert.equal(radio.receivers[0].rx_duration_us, duration ?? 0)
  }
  const eventLog = parser.parseLog(JSON.stringify({ meta: { medium: 'radio' }, nodes,
    events: [
      { type: 'tx_start', event_id: 'tx', packet_id: 'p', src: 1, time_us: 10.123, duration_us: 0.064 },
      { type: 'rx_success', tx_id: 'tx', packet_id: 'p', dst: 2, time_us: 10.457, duration_us: 0.064 },
    ],
  }))
  const merged = merge.mergeParsedNodeLogs([eventLog], ['radio-node'])
  assert.equal(merged.meta.medium, 'radio')
  assert.equal(merged.packets[0].tx_duration_us, 0.064)
  assert.equal(merged.packets[0].receivers[0].rx_duration_us, 0.064)
  assert.equal(merge.normalizePacketsFromParsed(eventLog, 'radio-node')[0].receivers[0].rx_duration_us, 0.064)
  const legacyShape = parser.parseLog(JSON.stringify({ meta: { medium: 'radio' }, nodes,
    tx: [{ tx_id: 'legacy-shape', src: 1, start_us: 10.123, duration_us: 0.064 }],
    rx: [{ tx_id: 'legacy-shape', dst: 2, start_us: 10.457, duration_us: 0.064, result: 'ok' }],
  }))
  assert.equal(merge.normalizePacketsFromParsed(legacyShape, 'radio-legacy-shape')[0].tx_duration_us, 0.064)
  legacyShape.rx[0].duration_us = 0
  assert.equal(merge.normalizePacketsFromParsed(legacyShape, 'radio-legacy-shape')[0].receivers[0].rx_duration_us, 0, 'explicit zero RF duration is not replaced by TX duration')
  const delay = 100 / speed * 1_000_000
  close(geometry.propagateDelayUs(nodes[0], nodes[1], speed, true), delay, 'RF propagation retains the sub-microsecond delay')
  assert.equal(geometry.propagateDelayUs(nodes[0], nodes[1], 1500), 66667, 'legacy acoustic geometry retains its rounding')
  assert.equal(format.timeDisplay(0.333, true), '0.333 μs')
  assert.equal(format.timeDisplay(30_000_000.123, true), '30.000000123 s')
  assert.equal(format.timeDisplay(0), '0.00 ms', 'old zero display stays unchanged')

  const scope = effectScope()
  try {
    const playback = { currentTime: ref(0), isPlaying: ref(false), focusedPacketId: ref(null),
      pauseForTool() { this.isPlaying.value = false },
      seekTime(value) { this.currentTime.value = value }, queueSeek(value) { this.currentTime.value = value },
      scrubStart() {}, scrubEnd() {},
    }
    const state = scope.run(() => stateLib.useReplayState({ playback }))
    const edit = scope.run(() => editLib.useEditMode({ state, playback }))
    state.applyParsedLog(parsed, edit.exitEditMode)
    assert.equal(state.fractionalTiming.value, true)
    assert.equal(state.editSoundSpeed.value, speed)
    playback.currentTime.value = rawPacket.tx_start_us + rawPacket.tx_duration_us / 2
    close(state.nodeVisuals.value[0].fillProgress, 0.5, 'TX progress uses the actual 64 ns duration')
    close(state.lifecycleStages.value.find((stage) => stage.type === 'tx').progressPct, 50, 'lifecycle progress uses actual timing')
    assert.match(state.lifecycleStages.value[0].detail, /0\.064 μs/)
    const savedPackets = JSON.stringify(state.sourcePacketRows.value)
    edit.enterEditMode()
    const rx = state.simulatedPacketRows.value[0].receivers[0]
    close(rx.rx_start_us - rawPacket.tx_start_us, delay, 'radio edit geometry uses metadata propagation speed')
    assert.equal(rx.rx_duration_us, 0.064)
    edit.onEditSoundSpeedChange({ target: { value: String(speed) } })
    assert.equal(state.editSoundSpeed.value, speed, 'radio editing does not apply the acoustic 2500 m/s limit')
    edit.onEditSelectionChange([2])
    edit.onEditCoordChange('x', { target: { value: '200' } })
    close(state.simulatedPacketRows.value[0].receivers[0].delay_us, 2 * delay, 'moving a receiver changes delay without stretching the packet')
    edit.restoreAllEditNodes()
    close(state.simulatedPacketRows.value[0].receivers[0].delay_us, delay, 'restoring coordinates restores the RF delay')
    edit.exitEditMode()
    assert.equal(JSON.stringify(state.sourcePacketRows.value), savedPackets)

    const panel = scope.run(() => panelLib.useLogPanel({ state, playback }))
    const track = { eventId: 'short', startUs: 10, endUs: 10.064 }
    const pointer = { clientX: 50, clientY: 0, currentTarget: { getBoundingClientRect: () => ({ left: 0, width: 100 }) },
      preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }
    panel.onEventTrackPointerDown(track, pointer)
    close(playback.currentTime.value, 10.032, 'seeking inside a sub-microsecond track preserves its duration')
    panel.onGlobalPointerMove({ ...pointer, clientX: 100 })
    close(playback.currentTime.value, 10.064, 'drag seeking stops at the true event endpoint')
    panel.onGlobalPointerUp()

    const band = { style: { transform: '' } }
    const row = { querySelector: () => band, classList: { toggle() {} } }
    const list = shallowRef({ querySelectorAll: () => [row] })
    const entry = { ...track, endUs: 10.5 }
    playback.currentTime.value = 10.25
    scope.run(() => progressLib.usePacketListProgress({ list, getPackets: () => [entry], getTime: () => playback.currentTime.value,
      isActive: () => true, getFocus: () => null, isEditMode: () => false, fractionalTiming: () => true }))
    await nextTick()
    assert.equal(band.style.transform, 'scaleX(0.5)')
    playback.currentTime.value = 10.5
    await nextTick()
    assert.equal(band.style.transform, 'scaleX(1)')
    playback.currentTime.value = 10.125
    await nextTick()
    assert.equal(band.style.transform, 'scaleX(0.25)', 'backwards seeking preserves fractional progress')

    state.applyParsedLog(makeLog({ medium: 'acoustic', propagation_speed_mps: 1480 }), edit.exitEditMode)
    assert.equal(state.fractionalTiming.value, false)
    assert.equal(state.editSoundSpeed.value, 1480)
    state.applyParsedLog(precise, edit.exitEditMode)
    assert.equal(state.fractionalTiming.value, true, 'new logs opt into precise timing through metadata')
    assert.equal(state.successTraceOnly.value, true)
    assert.equal(state.editSoundSpeed.value, 1480, 'propagation speed is independent of precision and protocol name')
    playback.currentTime.value = rawPacket.tx_start_us + rawPacket.tx_duration_us / 2
    close(state.nodeVisuals.value[0].fillProgress, 0.5, 'generic precise logs use the same progress pipeline')
    state.applyParsedLog(makeLog({}), edit.exitEditMode)
    assert.equal(state.editSoundSpeed.value, 1500, 'opening a legacy sample resets the previous RF speed')
    state.applyParsedLog(makeLog({ medium: 'radio' }), edit.exitEditMode)
    assert.equal(state.editSoundSpeed.value, speed)
    state.applyTopology(nodes, edit.exitEditMode)
    assert.equal(state.fractionalTiming.value, false, 'topology-only previews do not inherit RF log metadata')
    assert.equal(state.successTraceOnly.value, false)
    assert.equal(state.editSoundSpeed.value, 1500)
  } finally { scope.stop() }

  const animatedPacket = { eventId: 'rf-animation', packet_id: 'rf-animation', src: 1, tx_start_us: 0, tx_duration_us: 0.5,
    receivers: [{ dst: 2, rx_start_us: delay, rx_duration_us: 0.5, rx_end_us: delay + 0.5, status: 'ok', reason: null }] }
  const circles = []
  const ctx = new Proxy({ arc: (x, y) => circles.push([x, y]) }, {
    get: (target, key) => key in target ? target[key] : () => {}, set: (target, key, value) => { target[key] = value; return true },
  })
  const draw2d = (time) => drawing.drawVisiblePacketSet(ctx, [animatedPacket], time, (id) => nodes.find((node) => node.node_id === id),
    (x, y) => ({ x, y }), { ring: '#000', tx: '#111', rx: '#222', bad: '#333' }, 0, 1)
  draw2d(delay / 2)
  close(circles.at(-1)[0], 50, '2D wavefront reaches the midpoint at half the true RF propagation time')
  circles.length = 0
  draw2d(delay + 0.501)
  assert.equal(circles.length, 0, '2D does not extend the event to make it visible')
  await checkRadioScene(server, nodes, animatedPacket, delay, close)
  console.log('Radio replay regressions passed: fractional microseconds, metadata/defaults, node-log merging, original-trace preservation, edit geometry, seek/progress and real 2D/3D propagation timing.')
}

async function checkRadioScene(server, nodes, packet, delay, close) {
  const { default: NodeScene3D } = await server.ssrLoadModule('/src/features/scene3d/NodeScene3D.vue')
  const keys = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver']
  const saved = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget(), requestAnimationFrame: () => 1,
    cancelAnimationFrame() {}, ResizeObserver: class { observe() {} disconnect() {} } })
  const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
  const props = reactive({ nodes, topologyNodes: nodes, nodeVisuals: [], visiblePackets: [packet], currentTime: delay / 2, active: true })
  const component = { ...NodeScene3D, render: () => null }
  const app = renderer.createApp({ render: () => h(component, props) })
  app.provide(ssrContextKey, { modules: new Set() })
  const engine = new NullEngine()
  const scene = new Scene(engine)
  try {
    app.mount({})
    const state = app._instance.subTree.component.setupState
    state.babylon.getScene = () => scene
    state.buildPackets()
    const path = [...state.packetMeshMap.values()][0]
    assert.ok(path)
    close(path.block.position.x, 25, '3D packet spans the first half of the path at half the RF delay')
    props.currentTime = delay + 0.501
    await nextTick()
    state.buildPackets()
    assert.equal(path.block.isEnabled(), false, '3D hides the packet after its actual RX end')
  } finally {
    app.unmount()
    scene.dispose()
    engine.dispose()
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}
