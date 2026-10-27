import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'

export async function checkCanvasSnapping(server) {
  const [{ usePointerTools }, { useTopologyEditor }, { useCanvasView }, { useMeasureTool }] = await Promise.all([
    '/src/features/canvas2d/composables/usePointerTools.ts',
    '/src/features/experiment/composables/useTopologyEditor.ts',
    '/src/features/canvas2d/composables/useCanvasView.ts',
    '/src/features/canvas2d/composables/useMeasureTool.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const scope = effectScope()
  const editor = scope.run(() => useTopologyEditor(ref([])))
  const savedNodes = editor.editNodes.value
  const savedSelection = editor.selectedIds.value
  const captures = new Set()
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture: (id) => captures.add(id), releasePointerCapture: (id) => captures.delete(id) }
  const bounds = { minX: 0, maxX: 1000, minY: 0, maxY: 1000, spanX: 1000, spanY: 1000 }
  const point = (x, y) => ({ x, y })
  const noop = () => {}
  const pick = (x, y) => editor.canvasNodes.value.find((node) => Math.hypot(node.x - x, node.y - y) < 3) || null
  const event = (type, x, y, keys = {}) => ({ type, button: 0, pointerId: 1, clientX: x, clientY: y,
    shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
    preventDefault: noop, stopImmediatePropagation: noop, ...keys })
  const emitted = []
  const handlers = { 'selection-change': editor.onSelectionChange, 'node-select': editor.onNodeSelect,
    'nodes-move': editor.onNodesMove, 'node-move': editor.onNodeMove }
  let options
  const makeTools = (withSnapping = true) => scope.run(() => {
    const view = useCanvasView({ getProjection: () => ({ bounds, origin: point(0, 0), scale: 1, pan: point(0, 0) }),
      getBaseScale: () => 1, scheduleDraw: noop, getCanvasEl: () => canvas })
    const measure = useMeasureTool({ getNodeById: (id) => editor.editNodes.value.find((node) => node.node_id === id),
      pickNodeAtScreen: pick, toWorldFn: point, toScreenFn: point, scheduleDraw: noop, onPauseRequest: noop })
    return usePointerTools({ props: { editMode: true, boxSelect: true, get nodes() { return editor.canvasNodes.value } },
      emit: (name, payload) => { emitted.push(name); handlers[name]?.(payload) }, view, measure, scheduleDraw: noop,
      getCanvasEl: () => canvas, pickNodeAt: pick, toWorld: point,
      getSelectedIdSet: () => new Set(editor.selectedIds.value), getViewBounds: () => bounds,
      setHoveredNodeId: noop, setHoverCursor: noop, updateHoveredNode: noop, updateMeasureHover: noop,
      ...(withSnapping ? { getSnapOptions: () => options } : {}),
    })
  })
  const tools = makeTools()
  let legacyTools
  const reset = (nodes = [[1, 20, 30, 7]], ids = [1], overrides = {}) => {
    tools.cancelActiveTool()
    assert.equal(editor.replaceTopology(nodes.map(([node_id, x, y, z = 0]) => ({ node_id, x, y, z }))), true)
    editor.onSelectionChange(ids)
    options = { enabled: true, grid: true, alignment: false, spacing: false, scale: 1, gridStep: 100, ...overrides }
    emitted.length = 0
  }
  const positions = () => editor.editNodes.value.map(({ node_id, x, y, z }) => [node_id, x, y, z])
  const down = (x, y, keys) => tools.onPointerDown(event('pointerdown', x, y, keys))
  const move = (x, y, keys) => tools.onPointerMove(event('pointermove', x, y, keys))
  const alt = (held) => tools.onSnapModifierChange({ type: held ? 'keydown' : 'keyup', key: 'Alt', altKey: held, preventDefault: noop })
  const assertCleared = (message) => {
    assert.deepEqual(tools.snapGuides.value, [], `${message}: guides cleared`)
    assert.equal(tools.dragGroup.value, null, `${message}: group drag cleared`)
    assert.equal(tools.draggingNodeId.value, null, `${message}: drag anchor cleared`)
    assert.equal(captures.size, 0, `${message}: pointer capture released`)
  }
  try {
    reset()
    down(20, 30)
    move(97, 196)
    assert.deepEqual(positions(), [[1, 100, 200, 7]], 'grid snapping reaches world grid lines without changing Z')
    assert.ok(tools.snapGuides.value.some((guide) => guide.kind === 'grid'))
    alt(true)
    assert.deepEqual(positions(), [[1, 97, 196, 7]], 'Alt immediately restores the raw pointer delta without another pointermove')
    assert.deepEqual(tools.snapGuides.value, [])
    alt(false)
    assert.deepEqual(positions(), [[1, 100, 200, 7]], 'releasing Alt immediately reapplies snapping at the same pointer')
    move(104, 193, { altKey: true })
    assert.deepEqual(positions(), [[1, 104, 193, 7]], 'pointer Alt state bypasses snapping as well')
    assert.deepEqual(tools.snapGuides.value, [])
    move(104, 193)
    assert.deepEqual(positions(), [[1, 100, 193, 7]], 'only the axis within the weaker 4px radius is captured')
    for (const distance of [5, 6, 7, 8]) {
      move(100 - distance, 200 - distance)
      assert.deepEqual(positions(), [[1, 100 - distance, 200 - distance, 7]], `the former ${distance}px capture range now permits free dragging`)
      assert.deepEqual(tools.snapGuides.value, [], 'moving outside 4px clears earlier snap guides')
    }
    move(150, 251)
    assert.deepEqual(positions(), [[1, 150, 251, 7]], 'each move starts from the numeric drag snapshot, not the last snapped node pose')
    assert.deepEqual(tools.snapGuides.value, [], 'free movement beyond the threshold removes stale guides')
    move(97, 196)
    tools.onPointerUp(event('pointerup', 97, 196))
    assertCleared('pointerup')
    const endedPositions = positions()
    alt(true)
    assert.deepEqual(positions(), endedPositions, 'modifier changes after pointerup cannot restart a drag')

    reset([[1, 20, 30], [2, 100, 400], [3, 400, 200]], [1], { grid: false, alignment: true })
    down(20, 30)
    move(97, 196)
    assert.deepEqual(positions(), [[1, 100, 200, 0], [2, 100, 400, 0], [3, 400, 200, 0]], 'X and Y align independently to stationary nodes')
    assert.ok(tools.snapGuides.value.some((guide) => guide.kind === 'alignment'))
    tools.cancelActiveTool()
    assertCleared('cancelActiveTool')
    const cancelledPositions = positions()
    const endedCount = emitted.filter((name) => name === 'node-move-end').length
    move(200, 300)
    alt(true)
    tools.onPointerUp(event('pointerup', 200, 300))
    assert.deepEqual(positions(), cancelledPositions, 'cancel preserves committed positions and ignores later pointer/modifier events')
    assert.equal(emitted.filter((name) => name === 'node-move-end').length, endedCount, 'a cancelled drag has no deferred move-end action')

    reset([[1, 0, 0], [2, 100, 0], [3, 300, 200]], [3], { grid: false, spacing: true })
    down(300, 200)
    move(47, 3)
    assert.deepEqual(positions(), [[1, 0, 0, 0], [2, 100, 0, 0], [3, 50, 0, 0]], 'spacing snapping can insert a node midway along a nearby row')
    assert.ok(tools.snapGuides.value.some((guide) => guide.kind === 'spacing'))
    move(197, 3)
    assert.deepEqual(positions(), [[1, 0, 0, 0], [2, 100, 0, 0], [3, 200, 0, 0]], 'spacing snapping can extend the row by one equal interval')
    move(47, 20)
    assert.deepEqual(positions(), [[1, 0, 0, 0], [2, 100, 0, 0], [3, 47, 20, 0]], 'spacing does not pull a distant node onto the row')
    assert.deepEqual(tools.snapGuides.value, [])

    reset([[1, 20, 30, 7], [2, 50, 70, 9], [3, 500, 500, 11]], [1, 2])
    down(20, 30)
    move(97, 196)
    assert.deepEqual(positions(), [[1, 100, 200, 7], [2, 130, 240, 9], [3, 500, 500, 11]], 'group snapping applies one shared delta and leaves unselected nodes fixed')
    alt(true)
    assert.deepEqual(positions(), [[1, 97, 196, 7], [2, 127, 236, 9], [3, 500, 500, 11]])
    alt(false)
    assert.deepEqual(positions(), [[1, 100, 200, 7], [2, 130, 240, 9], [3, 500, 500, 11]])
    assert.deepEqual(editor.selectedIds.value, [1, 2], 'snapping and modifier changes preserve the selected group')
    // NodeCanvas uses this same cancellation path before node deletion or hiding.
    tools.cancelActiveTool()
    editor.removeSelected()
    assertCleared('deletion cancellation')
    alt(false)
    move(300, 400)
    assert.deepEqual(positions(), [[3, 500, 500, 11]], 'cancelled snapping cannot recreate deleted nodes')

    reset([[1, 97, 196]], [1])
    down(97, 196)
    move(98, 197)
    alt(true)
    alt(false)
    assert.deepEqual(positions(), [[1, 97, 196, 0]], 'sub-threshold click jitter and modifier changes cannot snap a stationary node')
    assert.ok(!emitted.includes('nodes-move') && !emitted.includes('node-move'))
    assert.deepEqual(tools.snapGuides.value, [])
    tools.onPointerUp(event('pointerup', 98, 197))
    assertCleared('click without drag')

    reset()
    down(20, 30)
    move(97, 196)
    tools.onPointerUp(event('pointercancel', 97, 196))
    assertCleared('pointercancel')

    reset(undefined, undefined, { enabled: false, grid: true, alignment: true, spacing: true })
    down(20, 30)
    move(97, 196)
    assert.deepEqual(positions(), [[1, 97, 196, 7]], 'the master toggle disables all snap candidates')
    assert.deepEqual(tools.snapGuides.value, [])
    tools.cancelActiveTool()

    reset()
    legacyTools = makeTools(false)
    legacyTools.onPointerDown(event('pointerdown', 20, 30))
    legacyTools.onPointerMove(event('pointermove', 97, 196))
    assert.deepEqual(positions(), [[1, 97, 196, 7]], 'callers without snap options retain their existing free-drag behavior')
    assert.deepEqual(legacyTools.snapGuides.value, [])
    console.log('Canvas snapping regressions passed: real pointer/editor grid, XY alignment and spacing, group deltas, Alt without pointer movement, snapshot stability, threshold, cancellation and legacy defaults.')
  } finally {
    tools.cancelActiveTool()
    legacyTools?.cancelActiveTool()
    scope.stop()
    editor.editNodes.value = savedNodes
    editor.selectedIds.value = savedSelection
  }
}
