import assert from 'node:assert/strict'
import { createRenderer, effectScope, nextTick, ssrContextKey } from 'vue'

export async function checkReplayResume(server) {
  const [{ useReplayState }, { usePlaybackEngine }, { useLogPanel }, { useReplayResume },
    { useEditMode }, { useLogImport }, { parseLog }] = await Promise.all([
    'useReplayState', 'usePlaybackEngine', 'useLogPanel', 'useReplayResume', 'useEditMode', 'useLogImport',
  ].map(name => server.ssrLoadModule(`/src/features/replay/composables/${name}.ts`))
    .concat(server.ssrLoadModule('/src/features/replay/lib/logParser.ts')))
  const originalRaf = globalThis.requestAnimationFrame
  const originalCancel = globalThis.cancelAnimationFrame
  const frames = new Map()
  let nextFrame = 0
  globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  const scopes = new Set()
  const mount = (snapshot = null) => {
    const scope = effectScope()
    scopes.add(scope)
    return scope.run(() => {
      let state
      const playback = usePlaybackEngine({ getCycleEndUs: () => state?.cycleEndUs.value ?? 10e6 })
      state = useReplayState({ playback })
      const panel = useLogPanel({ state, playback })
      const edit = useEditMode({ state, playback })
      const imports = useLogImport({ state, applyParsedLog: parsed => state.applyParsedLog(parsed, edit.exitEditMode) })
      const resume = useReplayResume({ state, playback, panel })
      resume.restore(snapshot)
      return { state, playback, panel, edit, imports, resume, unmount() {
        const saved = resume.capture()
        playback.dispose()
        scope.stop()
        scopes.delete(scope)
        return saved
      } }
    })
  }
  const raw = JSON.stringify({
    meta: { sim_end_us: 30e6, trace_scope: 'phy-events' },
    nodes: [{ node_id: 0, name: 'AUV A', x: 0, y: 0, z: -200 }, { node_id: 1, name: 'Sink', x: 100, y: 0, z: -200 }],
    movements: [{ node_id: 0, start_us: 0, end_us: 20e6, start: { x: 0, y: 0, z: -200 }, end: { x: 400, y: 0, z: -200 } }],
    packets: [{ packet_id: 'custom', src: 0, tx_start_us: 2e6, tx_duration_us: 1e6,
      receivers: [{ dst: 1, rx_start_us: 3e6, rx_duration_us: 1e6, status: 'ok' }] }],
  })
  try {
    let view = mount()
    view.state.logSourceKey.value = 'upload'
    view.state.uploadedLogName.value = 'my-experiment.json'
    view.state.applyParsedLog(parseLog(raw))
    const records = view.state.sourcePacketRows.value
    const recordText = JSON.stringify(records)
    view.state.focusedNodeId.value = 1
    view.state.replayMode.value = 'lifecycle'
    view.state.selectedLifecyclePacketId.value = 'custom'
    view.state.showAllActivePackets.value = false
    view.state.onNodeModelChange({ node_id: 0, modelType: 'rov' })
    view.playback.seekTime(8e6)
    view.playback.speed.value = 2
    view.playback.focusedPacketId.value = records[0].eventId
    view.panel.visualMode.value = '3d'
    view.panel.logPanelOpen.value = true
    view.playback.togglePlay()
    await nextTick()
    assert.equal(frames.size, 1)
    let snapshot = view.unmount()
    assert.equal(frames.size, 0, 'leaving cancels the active playback frame')
    view = mount(snapshot)
    await nextTick()
    assert.equal(view.state.activeLogName.value, 'my-experiment.json')
    assert.equal(view.state.sourcePacketRows.value, records, 'route return reuses the normalized large trace')
    assert.equal(JSON.stringify(records), recordText, 'snapshot handoff does not rewrite records')
    assert.equal(view.state.cycleEndUs.value, 30e6)
    assert.equal(view.state.nodesState.value[0].x, 160, 'motion resumes at the saved simulation time')
    assert.equal(view.state.nodesState.value[0].modelType, 'rov')
    assert.equal(view.state.focusedNodeId.value, 1)
    assert.equal(view.state.replayMode.value, 'lifecycle')
    assert.equal(view.state.selectedLifecyclePacketId.value, 'custom')
    assert.equal(view.state.showAllActivePackets.value, false)
    assert.equal(view.playback.currentTime.value, 8e6)
    assert.equal(view.playback.speed.value, 2)
    assert.equal(view.playback.focusedPacketId.value, records[0].eventId)
    assert.equal(view.playback.isPlaying.value, false)
    assert.equal(frames.size, 0, 'returning stays paused without a hidden clock')
    assert.equal(view.panel.visualMode.value, '3d')
    assert.equal(view.panel.logPanelOpen.value, true)

    view.edit.enterEditMode()
    view.edit.onEditNodeCoordinate({ node_id: 0, axis: 'x', value: 999 })
    view.edit.onEditSelectionChange([0])
    snapshot = view.unmount()
    view = mount(snapshot)
    await nextTick()
    assert.equal(view.state.isEditMode.value, true)
    assert.equal(view.state.nodesState.value[0].x, 999)
    assert.deepEqual(view.state.selectedEditNodeIds.value, [0])
    assert.equal(view.state.originalEditPoseById.value.get(0).x, 160)
    view.edit.restoreSelectedEditNodes()
    assert.equal(view.state.nodesState.value[0].x, 160, 'restoration still works after remount')
    view.edit.exitEditMode()
    assert.equal(view.state.sourcePacketRows.value, records)

    view.imports.loadSampleLog('moving')
    snapshot = view.unmount()
    view = mount(snapshot)
    assert.equal(view.state.logSourceKey.value, 'moving', 'explicit sample choice replaces the cached custom log')
    assert.equal(view.state.focusedNodeId.value, null)
    view.state.applyTopology([{ node_id: 42, name: 'Only topology', x: 7, y: 8, z: -9 }])
    snapshot = view.unmount()
    view = mount(snapshot)
    assert.equal(view.state.logSourceKey.value, 'topology')
    assert.equal(view.state.nodesState.value[0].node_id, 42)
    assert.equal(view.state.sourcePacketRows.value.length, 0)

    view.unmount()
    await checkPageHandoff(server, raw)
  } finally {
    for (const scope of scopes) scope.stop()
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCancel
  }
  console.log('Replay resume passed: custom logs, trace ownership, motion/time, filters, models, edit restore, samples/topology, pending-result priority and playback cleanup.')
}

async function checkPageHandoff(server, raw) {
  const [{ default: ReplayPage }, { session }] = await Promise.all([
    server.ssrLoadModule('/src/pages/ReplayPage.vue'), server.ssrLoadModule('/src/state/replaySession.ts'),
  ])
  const { parseLog } = await server.ssrLoadModule('/src/features/replay/lib/logParser.ts')
  const originalWindow = globalThis.window
  const previousSession = { ...session }
  const listeners = new Set()
  globalThis.window = { addEventListener: (_, callback) => listeners.add(callback), removeEventListener: (_, callback) => listeners.delete(callback) }
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  let app
  const mountPage = () => {
    let page
    app = renderer.createApp({ setup() {
      // Run the actual page assembly and lifecycle without creating GPU/canvas
      // children. Route teardown still disposes all of its composable scopes.
      page = ReplayPage.setup({}, { expose() {} })
      return () => null
    } })
    app.provide(ssrContextKey, { modules: new Set() })
    app.mount({})
    return page
  }
  try {
    Object.assign(session, { lastReplay: null, pendingReplayLog: raw, pendingReplayName: 'simulation.json', pendingReplayApply: null })
    let page = mountPage()
    assert.equal(page.state.activeLogName.value, 'simulation.json')
    page.playback.seekTime(8e6)
    page.state.focusedNodeId.value = 1
    page.panel.visualMode.value = '3d'
    const records = page.state.sourcePacketRows.value
    app.unmount()
    assert.equal(listeners.size, 0, 'real page teardown removes window listeners')
    assert.ok(session.lastReplay)
    page = mountPage()
    await nextTick()
    assert.equal(page.state.sourcePacketRows.value, records)
    assert.equal(page.playback.currentTime.value, 8e6)
    assert.equal(page.state.focusedNodeId.value, 1)
    assert.equal(page.panel.visualMode.value, '3d')
    assert.equal(page.hasOpened3D.value, true, 'the lazy 3D boundary initializes from the restored mode')
    assert.equal(session.replayNodes[0].name, 'AUV A', 'the initial topology publication uses the restored log')
    assert.equal(session.lastReplay, null, 'a mounted page owns its data without retaining another snapshot')
    app.unmount()
    session.pendingReplayLog = JSON.stringify({ nodes: [{ node_id: 99, name: 'New result', x: 10, y: 20, z: 30 }], packets: [] })
    session.pendingReplayName = 'new-result.json'
    session.pendingReplayApply = [{ node_id: 80, x: 0, y: 0, z: 0 }]
    page = mountPage()
    assert.equal(page.state.activeLogName.value, 'new-result.json', 'new simulation results override the cached replay and pending topology')
    assert.equal(page.state.baseNodesState.value[0].node_id, 99)
    assert.equal(page.playback.currentTime.value, 0)
    assert.equal(page.state.focusedNodeId.value, null)
    assert.equal(session.replayNodes[0].node_id, 99)
    assert.equal(session.pendingReplayLog, null)
    assert.equal(session.pendingReplayApply, null)
    app.unmount()
    session.pendingReplayApply = [{ node_id: 80, x: 0, y: 0, z: 0 }]
    page = mountPage()
    assert.equal(page.state.logSourceKey.value, 'topology', 'explicit topology sync overrides the saved simulation')
    assert.equal(session.replayNodes[0].node_id, 80)
    assert.equal(page.state.sourcePacketRows.value.length, 0)
    app.unmount()
    page = mountPage()
    assert.equal(page.state.logSourceKey.value, 'topology', 'another route return preserves that replacement')
    assert.equal(page.state.baseNodesState.value[0].node_id, 80)
  } finally {
    app?.unmount()
    Object.assign(session, previousSession)
    globalThis.window = originalWindow
  }
}
