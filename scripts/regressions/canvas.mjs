import assert from 'node:assert/strict'
import { createRenderer, h, nextTick, reactive, ref, shallowRef, ssrContextKey } from 'vue'
import { Color3, NullEngine, Scene as BabylonScene, Vector3, VertexBuffer } from '@babylonjs/core'

export async function checkCanvas(server) {
  const sceneState = await server.ssrLoadModule('/src/features/scene3d/lib/sceneState.ts')
  const coordinate = await server.ssrLoadModule('/src/features/canvas2d/lib/coordinate.ts')
  const { useCanvasLoop } = await server.ssrLoadModule('/src/features/canvas2d/composables/useCanvasLoop.ts')
  const { useCanvasView } = await server.ssrLoadModule('/src/features/canvas2d/composables/useCanvasView.ts')
  const { useNodeCard } = await server.ssrLoadModule('/src/features/canvas2d/composables/useNodeCard.ts')
  const { default: NodeScene3D } = await server.ssrLoadModule('/src/features/scene3d/NodeScene3D.vue')
  const { default: NodeCanvas } = await server.ssrLoadModule('/src/components/NodeCanvas.vue')
  const { worldAxisBounds, worldAxesNeedRefresh, packetPathKey } = sceneState
  const bounds = (maxX, offset = 0, z = 0) => worldAxisBounds([{ x: offset, y: 0 }, { x: maxX + offset, y: 0, z }], 38)
  const original = bounds(1000)
  assert.equal(worldAxesNeedRefresh(original, bounds(2000)), true, 'origin-centered expansion refreshes axes')
  assert.equal(worldAxesNeedRefresh(original, bounds(500)), true, 'contraction refreshes axes')
  assert.equal(worldAxesNeedRefresh(original, bounds(1020)), false, 'small movements reuse axes')
  assert.equal(worldAxesNeedRefresh(original, bounds(1060)), true, 'movement accumulates against last rendered bounds')
  assert.equal(worldAxesNeedRefresh(original, bounds(1000, 100)), true, 'translation refreshes axes')
  assert.equal(worldAxesNeedRefresh(original, bounds(1000, 0, 10)), true, 'depth movement refreshes axes')
  assert.equal(worldAxesNeedRefresh(original, null), true, 'empty topology clears previous axes')
  assert.equal(worldAxesNeedRefresh(null, null), false)
  const packet = { packet_id: 'same-packet', src: 1, tx_start_us: 100 }
  assert.notEqual(packetPathKey({ ...packet, eventId: 'hop-a' }, 3), packetPathKey({ ...packet, eventId: 'hop-b' }, 3), 'simultaneous forwarding events have distinct meshes')
  assert.notEqual(packetPathKey(packet, 3), packetPathKey({ ...packet, src: 2 }, 3), 'legacy fallback distinguishes senders')
  assert.notEqual(packetPathKey(packet, 3), packetPathKey({ ...packet, tx_start_us: 200 }, 3), 'legacy fallback distinguishes retransmissions')
  assert.notEqual(packetPathKey(packet, 3), packetPathKey(packet, 4))

  const savedGlobals = new Map(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver'].map((key) => [key, globalThis[key]]))
  const frames = new Map()
  let nextFrame = 1
  globalThis.window = new EventTarget()
  globalThis.document = new EventTarget()
  globalThis.requestAnimationFrame = (fn) => { const id = nextFrame++; frames.set(id, fn); return id }
  globalThis.cancelAnimationFrame = (id) => frames.delete(id)
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(100) }
  const pointer = (type, x = 0, y = 0, pointerId = 1) => Object.assign(new Event(type), { clientX: x, clientY: y, pointerId, button: 0 })
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const apps = []
  try {
    let active = true
    let draws = 0
    let latestValue = 0
    let lastDrawnValue = null
    const loop = useCanvasLoop(() => () => { draws++; lastDrawnValue = latestValue }, () => active)
    loop.scheduleDraw(); loop.scheduleDraw()
    assert.equal(frames.size, 1, 'redraw requests coalesce')
    active = false
    flushFrames()
    assert.equal(draws, 0, 'queued draw is skipped after deactivation')
    loop.scheduleDraw()
    assert.equal(frames.size, 0, 'hidden canvas queues no frames')
    active = true
    loop.scheduleDraw(); flushFrames()
    assert.equal(draws, 1, 'reactivation can render current state')
    latestValue = 10; loop.scheduleDraw()
    latestValue = 20; loop.scheduleDraw()
    flushFrames()
    assert.equal(lastDrawnValue, 20, 'coalescing preserves the final time/state rather than the first request')
    loop.scheduleDraw(); loop.dispose()
    assert.equal(frames.size, 0, 'unmount cancels pending draw')

    let view
    const projection = () => ({ bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000, spanX: 1000, spanY: 1000 }, origin: { x: 20, y: 30 }, scale: 0.1 * view.zoom.value, pan: view.pan.value })
    let scheduled = 0
    view = useCanvasView({ getProjection: projection, getBaseScale: () => 0.1, scheduleDraw: () => scheduled++, getCanvasEl: () => null })
    const before = coordinate.toWorldPoint(50, 60, projection())
    view.setZoomAt(100, 50, 60)
    const after = coordinate.toWorldPoint(50, 60, projection())
    assert.ok(Math.abs(before.x - after.x) < 1e-8 && Math.abs(before.y - after.y) < 1e-8, 'zoom preserves its screen anchor')
    assert.equal(projection().scale, coordinate.MAX_VIEW_SCALE, 'wheel/slider scale stays bounded')
    assert.equal(scheduled, 1, 'zoom delegates to the shared redraw scheduler')

    let card
    const cardActive = ref(true)
    const ids = ref([1])
    const cardApp = renderer.createApp({ setup() {
      card = useNodeCard({
        nodeIds: () => ids.value, canvas: shallowRef({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }),
        element: shallowRef(null), pick: (x, y) => Math.hypot(x, y) <= 4 ? { node_id: 1 } : null,
        allowClick: () => true, isActive: () => cardActive.value,
      })
      return () => null
    } })
    cardApp.mount({}); apps.push(cardApp)
    card.beginClick(pointer('pointerdown')); window.dispatchEvent(pointer('pointerup'))
    assert.equal(card.nodeId.value, 1, 'a normal click opens the card')
    card.close()
    card.beginClick(pointer('pointerdown'))
    window.dispatchEvent(pointer('pointermove', 20))
    window.dispatchEvent(pointer('pointermove'))
    window.dispatchEvent(pointer('pointerup'))
    assert.equal(card.nodeId.value, null, 'dragging out and back does not open the card')
    card.beginClick(pointer('pointerdown')); window.dispatchEvent(pointer('pointercancel'))
    assert.equal(card.nodeId.value, null)
    card.beginClick(pointer('pointerdown')); window.dispatchEvent(pointer('pointerup', 0, 0, 2)); window.dispatchEvent(pointer('pointerup'))
    assert.equal(card.nodeId.value, 1, 'another pointer cannot end the current click')
    ids.value = []
    await nextTick()
    assert.equal(card.nodeId.value, null, 'deleted nodes close their cards')

    const canvasProps = reactive({ nodes: [], nodeVisuals: [], currentTime: 0, editMode: true, active: true })
    const Canvas = { ...NodeCanvas, render: () => null }
    const canvasApp = renderer.createApp({ render: () => h(Canvas, canvasProps) })
    canvasApp.provide(ssrContextKey, { modules: new Set() })
    canvasApp.mount({}); apps.push(canvasApp)
    const canvasState = canvasApp._instance.subTree.component.setupState
    assert.equal(canvasState.bounds.spanX, 4000, 'blank edit canvas starts with a 4 km range')
    canvasProps.nodes = [{ node_id: 1, x: 0, y: 0 }, { node_id: 2, x: 10000, y: 10000 }]
    await nextTick()
    assert.equal(canvasState.bounds.spanX, 4000, 'node edits retain the frozen view')
    canvasProps.active = false
    await nextTick()
    assert.equal(frames.size, 0, 'hiding 2D cancels pending redraw')
    canvasProps.currentTime = 100
    canvasProps.nodes[1].x = 20000
    await nextTick()
    assert.equal(frames.size, 0, 'hidden 2D updates queue no redraw')
    canvasProps.active = true
    await nextTick()
    assert.equal(frames.size, 0, '2D activation synchronizes immediately')
    assert.equal(canvasState.bounds.spanX, 4000, 'reactivation retains editing view')
    canvasState.resetView()
    assert.equal(canvasState.bounds.spanX, 20000, 'explicit reset fits the latest topology')
    assert.equal(frames.size, 1)
    flushFrames()
    let metadataReads = 0
    const metadata = { get ignoredMetadata() { metadataReads++; return { nested: 'not rendered' } } }
    canvasProps.visiblePackets = [metadata]
    Object.defineProperty(canvasProps.nodes[0], 'appAttrs', { enumerable: true, configurable: true, get() { metadataReads++; return {} } })
    canvasProps.currentTime = 101
    await nextTick()
    assert.equal(metadataReads, 0, '2D clock updates do not traverse packet/node metadata')
    flushFrames()
    canvasProps.nodes[1].x = 21000
    await nextTick()
    assert.equal(frames.size, 1, '2D still redraws in-place node coordinate changes')
    assert.equal(metadataReads, 0)
    canvasApp.unmount(); apps.pop()
    assert.equal(frames.size, 0, '2D unmount cancels pending draw')

    // Exercise the real SFC setup with a non-DOM renderer. With no canvas ref,
    // Babylon does not create an engine; selection and refresh scheduling stay real.
    const sceneProps = reactive({ nodes: [{ node_id: 0, x: 0, y: 0 }], topologyNodes: [{ node_id: 0, x: 0, y: 0 }], nodeVisuals: [], currentTime: 0, active: true })
    const Scene = { ...NodeScene3D, render: () => null }
    const sceneApp = renderer.createApp({ render: () => h(Scene, sceneProps) })
    sceneApp.provide(ssrContextKey, { modules: new Set() })
    sceneApp.mount({}); apps.push(sceneApp)
    const state = sceneApp._instance.subTree.component.setupState
    state.selectedNodeId = 0
    await nextTick()
    assert.equal(state.selectedNode.x, 0, 'node zero can be selected')
    const escapeKey = (options = {}) => Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape', ...options })
    const composingEscape = escapeKey({ isComposing: true })
    window.dispatchEvent(composingEscape)
    assert.equal(state.selectedNodeId, 0, '3D Escape does not dismiss details during IME composition')
    assert.equal(composingEscape.defaultPrevented, false)
    const handledEscape = escapeKey()
    handledEscape.preventDefault()
    window.dispatchEvent(handledEscape)
    assert.equal(state.selectedNodeId, 0, '3D respects an Escape already handled by another control')

    const sceneFocus = {}
    const outsideFocus = {}
    const focusCalls = []
    const previousActiveElement = document.activeElement
    state.hostEl = { contains: (element) => element === sceneFocus }
    state.canvasEl = { focus: (options) => focusCalls.push(options), removeEventListener() {} }
    try {
      document.activeElement = outsideFocus
      state.selectedNodePos = { x: 10, y: 20 }
      const escape = escapeKey()
      window.dispatchEvent(escape)
      assert.equal(state.selectedNodeId, null, 'Escape dismisses the selected 3D node, including node zero')
      assert.equal(state.selectedNodePos, null)
      assert.equal(escape.defaultPrevented, true)
      assert.equal(focusCalls.length, 0, 'dismissing 3D details does not steal focus from an outside form')
      const emptyEscape = escapeKey()
      window.dispatchEvent(emptyEscape)
      assert.equal(emptyEscape.defaultPrevented, false, '3D does not consume Escape when no details are open')

      state.selectedNodeId = 0
      document.activeElement = sceneFocus
      window.dispatchEvent(escapeKey())
      assert.deepEqual(focusCalls, [{ preventScroll: true }], 'scene-local focus returns to the canvas without scrolling')
    } finally {
      if (previousActiveElement === undefined) delete document.activeElement
      else document.activeElement = previousActiveElement
      state.hostEl = null
      state.canvasEl = null
    }
    state.selectedNodeId = 0
    sceneProps.nodes = [{ node_id: 0, x: 250, y: 10 }]
    await nextTick()
    assert.equal(state.selectedNode.x, 250, 'selection follows replacement movement objects')
    flushFrames()
    sceneProps.visiblePackets = [metadata]
    Object.defineProperty(sceneProps.nodes[0], 'appAttrs', { enumerable: true, configurable: true, get() { metadataReads++; return {} } })
    sceneProps.currentTime = 1
    await nextTick()
    assert.equal(metadataReads, 0, '3D clock updates do not traverse packet/node metadata')
    flushFrames()
    sceneProps.nodes[0].x = 300
    await nextTick()
    assert.equal(state.selectedNode.x, 300)
    assert.equal(state.refreshPending, true, '3D still refreshes in-place node coordinate changes')
    assert.equal(frames.size, 0, '3D uses the existing Babylon loop instead of scheduling another RAF')
    sceneProps.nodes = []
    await nextTick()
    assert.equal(state.selectedNodeId, null, 'removing the selected node clears selection')
    sceneProps.nodes = [{ node_id: 0, x: 250, y: 10 }]
    await nextTick()
    state.selectedNodeId = 0
    sceneProps.topologyNodes = [{ node_id: 0, x: 250, y: 10 }]
    await nextTick()
    assert.equal(state.selectedNodeId, null, 'a replacement replay clears selection even when IDs match')
    state.selectedNodeId = 0
    sceneProps.active = false
    await nextTick()
    assert.equal(state.refreshPending, false, 'hiding 3D cancels pending refresh')
    const hiddenEscape = escapeKey()
    window.dispatchEvent(hiddenEscape)
    assert.equal(state.selectedNodeId, 0, 'a hidden 3D scene ignores Escape from the active 2D view')
    assert.equal(hiddenEscape.defaultPrevented, false)
    sceneProps.currentTime = 500
    sceneProps.nodes = [{ node_id: 0, x: 900, y: 10 }]
    await nextTick()
    assert.equal(state.refreshPending, false, 'hidden 3D changes do not queue mesh refreshes')
    sceneProps.active = true
    await nextTick()
    assert.equal(frames.size, 0, 'reactivation does not schedule a separate refresh RAF')
    assert.equal(state.refreshPending, true, 'refresh waits for scene creation when no engine is mounted')
    state.selectedNodeId = 0
    assert.equal(state.selectedNode.x, 900, 'reactivated selection uses the latest data')
    sceneProps.currentTime = 600
    await nextTick()
    assert.equal(state.refreshPending, true, 'visible playback marks scene data for the next Babylon frame')

    // Render actual Babylon meshes without a GPU, exercising the SFC's path
    // cache and appearance updates instead of duplicating its geometry logic.
    const engine = new NullEngine()
    const scene = new BabylonScene(engine)
    const previousSceneGetter = state.babylon.getScene
    state.babylon.getScene = () => scene
    try {
      sceneProps.nodes = [{ node_id: 0, x: 0, y: 0 }, { node_id: 1, x: 1000, y: 0 }]
      sceneProps.currentTime = 1_000_000
      sceneProps.visiblePackets = [{ eventId: 'one-hop', packet_id: 'one-packet', src: 0, tx_start_us: 0, tx_duration_us: 1_000_000,
        receivers: [{ dst: 1, rx_start_us: 2_000_000, rx_end_us: 3_000_000, status: 'ok', reason: null }] }]
      sceneProps.nodeVisuals = [{ node_id: 0, mode: 'tx', fillProgress: 0.5 }]
      await nextTick()
      state.buildPackets()
      const path = [...state.packetMeshMap.values()][0]
      let vertexUpdates = 0
      const updateVerticesData = path.line.updateVerticesData.bind(path.line)
      path.line.updateVerticesData = (...args) => { vertexUpdates++; return updateVerticesData(...args) }
      const originalOrientation = path.block.rotationQuaternion.clone()
      const originalBlockX = path.block.position.x
      sceneProps.currentTime = 1_500_000
      await nextTick()
      state.buildPackets()
      assert.equal(vertexUpdates, 0, 'time-only changes reuse the static path vertex buffer')
      assert.ok(path.block.position.x > originalBlockX, 'the propagation block still advances on the cached path')
      assert.ok(path.block.rotationQuaternion.equals(originalOrientation), 'static path orientation remains unchanged')
      sceneProps.nodes[1].x = 1500
      await nextTick()
      state.buildPackets()
      assert.equal(vertexUpdates, 1, 'moving an endpoint invalidates geometry exactly once')
      assert.equal(path.pathLength, 1500)
      assert.equal(path.marker.position.x, 1500)
      assert.deepEqual(Array.from(path.line.getVerticesData(VertexBuffer.PositionKind), (value) => value || 0), [0, 0, 0, 1500, 0, 0])
      sceneProps.nodes[0].y = 500
      await nextTick()
      state.buildPackets()
      assert.equal(vertexUpdates, 2, 'source movement also invalidates geometry')
      assert.ok(path.direction.equals(new Vector3(1500, 0, -500)))

      const palette = state.theme3D
      const oldLine = palette.line
      const oldTx = palette.tx
      try {
        palette.line = new Color3(0.2, 0.4, 0.6)
        palette.tx = new Color3(0.6, 0.4, 0.2)
        sceneProps.fxLevel = 'extreme'
        await nextTick()
        state.buildPackets()
        assert.equal(vertexUpdates, 2, 'appearance changes do not rebuild endpoint geometry')
        assert.equal(path.line.color, palette.line, 'palette changes still update the cached line')
        assert.equal(path.block.material.diffuseColor, palette.tx, 'palette changes still update the moving block')
        assert.equal(path.line.alpha, 0.62, 'effect changes update cached path appearance')
      } finally {
        palette.line = oldLine
        palette.tx = oldTx
      }
      state.buildNodes()
      const progressMaterial = state.nodeMeshMap.get(0).progress.material
      const materialState = progressMaterial.metadata
      state.buildNodes()
      assert.equal(progressMaterial.metadata, materialState, 'an unchanged active progress material is not reset/reapplied')
      sceneProps.nodeVisuals = [{ node_id: 0, mode: 'idle', fillProgress: 0 }]
      await nextTick()
      state.buildNodes()
      assert.equal(progressMaterial.alpha, 0, 'active-to-idle transition clears the progress fill')

      // Drive the callback actually passed to Babylon, which runs before
      // scene.render(). Reuse the bounds to avoid DOM-only axis label textures.
      state.drawnWorldAxisBounds = worldAxisBounds(sceneProps.nodes, 38)
      let previousX = path.block.position.x
      for (const time of [1_600_000, 1_700_000, 1_800_000, 1_900_000]) {
        sceneProps.currentTime = time
        await nextTick()
        assert.equal(state.refreshPending, true)
        state.onSceneFrame()
        assert.equal(state.refreshPending, false, 'the render callback consumes pending props in this frame')
        assert.ok(path.block.position.x > previousX, 'every consecutive Babylon frame advances the packet')
        previousX = path.block.position.x
      }
      assert.equal(frames.size, 0, 'continuous 3D playback never creates an extra refresh RAF')
      const stationaryMaterial = progressMaterial.metadata
      state.onSceneFrame()
      assert.equal(path.block.position.x, previousX, 'camera-only frames preserve packet state')
      assert.equal(progressMaterial.metadata, stationaryMaterial)

      sceneProps.currentTime = 2_100_000
      await nextTick()
      sceneProps.currentTime = 2_500_000
      await nextTick()
      state.onSceneFrame()
      assert.equal(path.block.position.x, 1312.5, 'coalesced updates render the final playback time without another tick')
      assert.equal(path.marker.isEnabled(), true, 'the final frame includes arrival marker changes')

      sceneProps.active = false
      await nextTick()
      sceneProps.currentTime = 2_700_000
      sceneProps.fxLevel = 'standard'
      await nextTick()
      state.onSceneFrame()
      assert.equal(path.block.position.x, 1312.5, 'hidden scenes do not consume clock changes')
      assert.equal(state.refreshPending, false)
      sceneProps.active = true
      await nextTick()
      assert.equal(path.block.position.x, 1387.5, 'activation refreshes current packets before restarting rendering')
      assert.equal(path.line.alpha, 0.52, 'activation also restores the latest appearance')
      assert.equal(state.refreshPending, false)
      sceneProps.currentTime = 2_800_000
      await nextTick()
      assert.equal(state.refreshPending, true, 'a final pending update is present before unmount')
    } finally {
      state.babylon.getScene = previousSceneGetter
      sceneApp.unmount(); apps.pop()
      scene.dispose()
      engine.dispose()
    }
    assert.equal(state.refreshPending, false, 'unmount cancels pending scene refresh')
    assert.equal(frames.size, 0, '3D unmount leaves no refresh RAF')
    state.selectedNodeId = 0
    const unmountedEscape = escapeKey()
    window.dispatchEvent(unmountedEscape)
    assert.equal(state.selectedNodeId, 0, '3D unmount removes its Escape listener')
    assert.equal(unmountedEscape.defaultPrevented, false)
    console.log('Canvas regressions passed: bounds, packet identity, zoom, latest-frame scheduling, card gestures, editing view, shallow updates, 3D mesh caching, selection and visibility.')
  } finally {
    for (const app of apps.reverse()) app.unmount()
    for (const [key, value] of savedGlobals) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
}
