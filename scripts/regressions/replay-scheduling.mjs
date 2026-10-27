import assert from 'node:assert/strict'
import { createRenderer, h, markRaw, nextTick, ref, ssrContextKey } from 'vue'

export async function checkReplayScheduling(server) {
  const { usePlaybackEngine } = await server.ssrLoadModule('/src/features/replay/composables/usePlaybackEngine.ts')
  const { useReplayState } = await server.ssrLoadModule('/src/features/replay/composables/useReplayState.ts')
  const { default: NodeCanvas } = await server.ssrLoadModule('/src/components/NodeCanvas.vue')
  const globalKeys = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver']
  const savedGlobals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const callbacks = new Map()
  let nextId = 0
  let frame = 0
  let timestamp = 0
  let playback
  let app
  const active = ref(true)
  const draws = []

  globalThis.window = new EventTarget()
  globalThis.document = new EventTarget()
  globalThis.requestAnimationFrame = (callback) => { callbacks.set(++nextId, callback); return nextId }
  globalThis.cancelAnimationFrame = (id) => callbacks.delete(id)
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }

  // Browsers drain microtasks after EACH rAF callback, not after the entire
  // frame's callback list. A batch-only mock misses the former half-rate bug.
  const advanceFrame = async () => {
    frame++
    timestamp += 10
    for (const [id, callback] of [...callbacks]) {
      if (!callbacks.delete(id)) continue
      callback(timestamp)
      await nextTick()
      await Promise.resolve()
    }
  }
  const ctx = markRaw(new Proxy({
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 0 }),
    fillText(text) {
      if (text.startsWith('time:')) draws.push({ frame, time: playback.currentTime.value, text })
    },
  }, { get: (target, key) => key in target ? target[key] : () => {} }))
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })

  try {
    // Keep the real component's setup, watches and draw function. Only its DOM
    // template is omitted; HUD drawing records completed canvas paints.
    const Canvas = { ...NodeCanvas, render: () => null }
    app = renderer.createApp({ setup() {
      playback = usePlaybackEngine({ getCycleEndUs: () => 1000000 })
      return () => h(Canvas, { nodes: [], nodeVisuals: [], visiblePackets: [],
        currentTime: playback.currentTime.value, active: active.value })
    } })
    app.provide(ssrContextKey, { modules: new Set() })
    app.mount({})
    const canvas = app._instance.subTree.component.setupState
    canvas.canvasEl = markRaw({ width: 0, height: 0, getContext: () => ctx })
    canvas.containerEl = markRaw({ getBoundingClientRect: () => ({ width: 800, height: 600 }) })
    canvas.loop.flushDraw()
    assert.equal(draws.length, 1, 'initial canvas can render before playback starts')
    assert.equal(callbacks.size, 0, 'synchronous painting cancels the queued initial draw')
    draws.length = 0

    playback.togglePlay()
    await nextTick()
    for (let i = 0; i < 12; i++) {
      if (i === 4) canvas.loop.scheduleDraw() // A pointer redraw already pending in this frame.
      await advanceFrame()
    }
    assert.deepEqual(draws.map((draw) => draw.frame), Array.from({ length: 11 }, (_, i) => i + 2),
      'every changed playback tick paints exactly once, including a pending pointer redraw')
    for (const draw of draws) assert.equal(draw.text, `time: ${(draw.time / 1000).toFixed(1)} ms`, 'paint uses the current frame props')
    assert.equal(callbacks.size, 1, 'steady playback leaves only its next clock rAF pending')

    playback.pauseForTool()
    await nextTick()
    assert.equal(callbacks.size, 0, 'pausing cancels the next clock frame')
    const pausedDraws = draws.length
    await advanceFrame()
    assert.equal(draws.length, pausedDraws, 'pausing leaves no delayed canvas redraw')
    playback.seekTime(50000)
    await nextTick()
    assert.equal(draws.length, pausedDraws + 1, 'paused seek paints without waiting for another rAF')
    assert.equal(draws.at(-1).time, 50000)

    playback.queueSeek(25000)
    playback.queueSeek(35000)
    assert.equal(callbacks.size, 1, 'scrub inputs still coalesce')
    await advanceFrame()
    assert.equal(draws.at(-1).time, 35000, 'backward scrub paints the final requested time')
    assert.equal(draws.length, pausedDraws + 2)
    assert.equal(callbacks.size, 0, 'scrub paints in its clock frame, without a trailing canvas rAF')

    canvas.loop.scheduleDraw()
    active.value = false
    await nextTick()
    assert.equal(callbacks.size, 0, 'hiding the view cancels pending canvas work')
    const hiddenDraws = draws.length
    playback.seekTime(150000)
    await nextTick()
    playback.togglePlay()
    await nextTick()
    await advanceFrame()
    await advanceFrame()
    assert.equal(draws.length, hiddenDraws, 'hidden views do not paint on seek or playback')
    assert.equal(playback.currentTime.value, 160000, 'hidden rendering does not stop the shared clock')
    active.value = true
    await nextTick()
    assert.equal(draws.length, hiddenDraws + 1, 'reactivation immediately paints current state once')
    assert.equal(draws.at(-1).time, 160000)
    await advanceFrame()
    assert.equal(draws.length, hiddenDraws + 2, 'reactivated view resumes one paint per clock frame')

    playback.pauseForTool()
    playback.seekTime(995000)
    await nextTick()
    draws.length = 0
    playback.togglePlay()
    await nextTick()
    await advanceFrame() // The resumed clock establishes its timestamp without advancing.
    await advanceFrame()
    assert.equal(playback.isPlaying.value, false)
    assert.deepEqual(draws.map((draw) => draw.time), [1000000], 'the final clamped time is painted even when playback stops in that tick')
    assert.equal(callbacks.size, 0, 'the end frame leaves no pending paint or clock')

    canvas.loop.scheduleDraw()
    canvas.loop.scheduleDraw()
    assert.equal(callbacks.size, 1, 'pointer and view redraws retain rAF coalescing')
    canvas.loop.cancelDraw()
    assert.equal(callbacks.size, 0, 'explicit cancellation clears pending canvas work')
    const endedDraws = draws.length
    await advanceFrame()
    assert.equal(draws.length, endedDraws)
    playback.queueSeek(0)
    canvas.loop.scheduleDraw()
    playback.dispose()
    app.unmount()
    app = null
    assert.equal(callbacks.size, 0, 'unmount/dispose cancels pending seek and canvas callbacks')
    await advanceFrame()
    assert.equal(draws.length, endedDraws)

    // Exercise the shipped default log, including the first successful RX's
    // hold state just after 1.54 s. An empty one-second synthetic scene cannot
    // detect exceptions in those visual branches or moving-node updates.
    let state
    app = renderer.createApp({ setup() {
      playback = usePlaybackEngine({ getCycleEndUs: () => state.cycleEndUs.value })
      state = useReplayState({ playback })
      return () => h(Canvas, {
        nodes: state.nodesState.value,
        nodeVisuals: state.nodeVisuals.value,
        visiblePackets: state.displayPackets.value,
        currentTime: playback.currentTime.value,
      })
    } })
    app.provide(ssrContextKey, { modules: new Set() })
    app.mount({})
    const defaultCanvas = app._instance.subTree.component.setupState
    defaultCanvas.canvasEl = markRaw({ width: 0, height: 0, getContext: () => ctx })
    defaultCanvas.containerEl = markRaw({ getBoundingClientRect: () => ({ width: 800, height: 600 }) })
    defaultCanvas.loop.flushDraw()
    assert.equal(state.activeLogName.value, 'net.json', 'this scenario uses the real default log')
    assert.equal(state.cycleEndUs.value, 12000000)
    assert.ok(state.nodeMovementRows.value.length > 0, 'the default fixture contains movement')
    const baseCoordinates = state.baseNodesState.value.map(({ node_id, x, y, z }) => ({ node_id, x, y, z }))
    const boundaryModes = new Map()
    let sawCollision = false
    let sawSuccessHold = false
    let sawMovedNode = false
    draws.length = 0
    playback.togglePlay()
    await nextTick()
    for (let i = 0; i <= 1200; i++) {
      const previousTime = playback.currentTime.value
      const previousDraws = draws.length
      await advanceFrame()
      const time = playback.currentTime.value
      assert.equal(draws.length - previousDraws, time === previousTime ? 0 : 1,
        `default log completes exactly one paint for its changed clock tick at ${time} us`)
      if (time !== previousTime) {
        assert.equal(draws.at(-1).frame, frame, 'default log paints during the clock frame')
        assert.equal(draws.at(-1).text, `time: ${(time / 1000).toFixed(1)} ms`, 'default canvas paints updated time props')
      }
      const visuals = state.nodeVisuals.value
      sawCollision ||= visuals.some((visual) => visual.mode === 'collision')
      sawSuccessHold ||= visuals.some((visual) => visual.mode === 'rx-done' && visual.fade > 0 && visual.fade < 1)
      sawMovedNode ||= state.nodesState.value.some((node, index) => node.x !== baseCoordinates[index].x || node.y !== baseCoordinates[index].y)
      if ([1530000, 1540000, 1550000, 1730000].includes(time)) {
        boundaryModes.set(time, new Map(visuals.map((visual) => [visual.node_id, visual.mode])))
      }
    }
    assert.equal(boundaryModes.get(1530000).get(5), 'collision', 'the 1.53 s frame includes the real RX/RX collision')
    assert.equal(boundaryModes.get(1530000).get(1), 'rx')
    assert.equal(boundaryModes.get(1540000).get(1), 'rx', 'the RX endpoint remains inclusive')
    assert.equal(boundaryModes.get(1550000).get(1), 'rx-done', 'playback crosses the former failure point into successful RX hold')
    assert.equal(boundaryModes.get(1730000).get(1), 'idle', 'the successful RX hold also expires normally')
    assert.ok(sawCollision && sawSuccessHold && sawMovedNode, 'full playback exercises collision, success hold and moving nodes')
    assert.deepEqual(state.baseNodesState.value.map(({ node_id, x, y, z }) => ({ node_id, x, y, z })), baseCoordinates,
      'moving-node playback preserves the original topology')
    assert.equal(draws.length, 1200, 'the full 12 s default log paints every 10 ms test clock advance')
    assert.equal(draws.at(-1).time, 12000000)
    assert.equal(playback.currentTime.value, 12000000)
    assert.equal(playback.isPlaying.value, false)
    assert.equal(callbacks.size, 0, 'the real log endpoint leaves no pending clock or canvas callbacks')
    await advanceFrame()
    assert.equal(draws.length, 1200, 'the completed real log does not keep painting')
    playback.dispose()
    app.unmount()
    app = null
    assert.equal(callbacks.size, 0)
  } finally {
    playback?.dispose()
    app?.unmount()
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
  console.log('Replay scheduling regressions passed: actual canvas paints per tick, pause/seek/end, hidden activation, cancellation and the full 12 s default log with movement/collision/RX hold.')
}
