import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'

export async function checkCanvasSelection(server) {
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
  const bounds = { minX: 0, maxX: 200, minY: 0, maxY: 200, spanX: 200, spanY: 200 }
  const point = (x, y) => ({ x, y })
  const noop = () => {}
  const pick = (x, y) => editor.canvasNodes.value.find((node) => Math.hypot(node.x - x, node.y - y) < 3) || null
  const event = (type, x, y, keys = {}) => ({ type, button: 0, pointerId: 1, clientX: x, clientY: y,
    shiftKey: false, ctrlKey: false, metaKey: false, preventDefault: noop, stopImmediatePropagation: noop, ...keys })
  const handlers = { 'selection-change': editor.onSelectionChange, 'node-select': editor.onNodeSelect,
    'nodes-move': editor.onNodesMove, 'node-move': editor.onNodeMove }
  const tools = scope.run(() => {
    const view = useCanvasView({ getProjection: () => ({ bounds, origin: point(0, 0), scale: 1, pan: point(0, 0) }),
      getBaseScale: () => 1, scheduleDraw: noop, getCanvasEl: () => canvas })
    const measure = useMeasureTool({ getNodeById: (id) => editor.editNodes.value.find((node) => node.node_id === id),
      pickNodeAtScreen: pick, toWorldFn: point, toScreenFn: point, scheduleDraw: noop, onPauseRequest: noop })
    return usePointerTools({ props: { editMode: true, boxSelect: true, get nodes() { return editor.canvasNodes.value } },
      // Match ExperimentPage's event wiring: node-select must not undo a deselection.
      emit: (name, payload) => handlers[name]?.(payload), view, measure, scheduleDraw: noop,
      getCanvasEl: () => canvas, pickNodeAt: pick, toWorld: point,
      getSelectedIdSet: () => new Set(editor.selectedIds.value), getViewBounds: () => bounds,
      setHoveredNodeId: noop, setHoverCursor: noop, updateHoveredNode: noop, updateMeasureHover: noop })
  })
  tools.setNodeScreenInBox((node, left, right, top, bottom) => node.x >= left && node.x <= right && node.y >= top && node.y <= bottom)
  const reset = (ids = []) => {
    tools.cancelActiveTool()
    assert.equal(editor.replaceTopology([1, 2, 3].map((id) => ({ node_id: id, x: 20 + (id - 1) * 40, y: 20, z: 0 }))), true)
    editor.onSelectionChange(ids)
  }
  const click = (x, y, keys = {}) => {
    tools.onPointerDown(event('pointerdown', x, y, keys))
    tools.onPointerUp(event('pointerup', x, y, keys))
  }
  const clickNode = (id, keys = {}) => {
    const node = editor.editNodes.value.find((item) => item.node_id === id)
    click(node.x, node.y, keys)
  }
  const box = (x0, y0, x1, y1, keys) => {
    tools.onPointerDown(event('pointerdown', x0, y0, keys))
    tools.onPointerMove(event('pointermove', x1, y1, keys))
    tools.onPointerUp(event('pointerup', x1, y1, keys))
  }
  const selected = (ids, message) => assert.deepEqual([...editor.selectedIds.value], ids, message)
  const positions = () => editor.editNodes.value.map(({ x, y }) => [x, y])
  try {
    for (const modifier of ['shiftKey', 'ctrlKey', 'metaKey']) {
      reset()
      clickNode(1)
      selected([1], 'ordinary click selects a single node')
      clickNode(2, { [modifier]: true })
      selected([1, 2], `${modifier} adds to the existing selection`)
      tools.onPointerDown(event('pointerdown', 20, 20, { [modifier]: true }))
      selected([2], `${modifier} removal is not overwritten by the editor's node-select handler`)
      assert.equal(tools.dragGroup.value, null, 'deselection cannot start dragging the remaining selected nodes')
      tools.onPointerMove(event('pointermove', 40, 40))
      tools.onPointerUp(event('pointerup', 40, 40))
      assert.deepEqual(positions(), [[20, 20], [60, 20], [100, 20]])
      const before = positions()
      tools.onPointerDown(event('pointerdown', 60, 20, { [modifier]: true }))
      selected([], `${modifier} can deselect the final node`)
      assert.equal(tools.dragGroup.value, null, 'deselection does not begin a group drag')
      assert.equal(tools.draggingNodeId.value, null)
      assert.equal(captures.size, 0)
      tools.onPointerMove(event('pointermove', 80, 40))
      tools.onPointerUp(event('pointerup', 80, 40))
      selected([], 'pointerup after deselection cannot reselect the node')
      assert.deepEqual(positions(), before, 'deselection cannot move any node')
    }

    reset([1])
    box(50, 10, 70, 30, { shiftKey: true })
    selected([1, 2], 'Shift marquee appends to the existing selection')
    box(50, 10, 70, 30, { shiftKey: true })
    selected([1, 2], 'additive marquee deduplicates existing nodes')
    box(150, 100, 180, 130, { shiftKey: true })
    selected([1, 2], 'empty Shift marquee preserves selection')
    click(150, 100, { shiftKey: true })
    selected([1, 2], 'Shift click on blank canvas preserves selection')
    for (const modifier of ['ctrlKey', 'metaKey']) {
      reset([1])
      box(50, 10, 70, 30, { [modifier]: true })
      selected([2], `${modifier} marquee retains replacement behavior`)
      reset([1])
      box(50, 10, 70, 30, { shiftKey: true, [modifier]: true })
      selected([1, 2], `Shift plus ${modifier} marquee remains additive`)
    }

    reset([1, 2])
    tools.onPointerDown(event('pointerdown', 20, 20))
    tools.onPointerMove(event('pointermove', 20.5, 20.5))
    assert.deepEqual(positions(), [[20, 20], [60, 20], [100, 20]], 'click jitter cannot shift a selected group')
    tools.onPointerMove(event('pointermove', 30, 35))
    tools.onPointerUp(event('pointerup', 30, 35))
    selected([1, 2], 'dragging a selected node keeps the group selected')
    assert.deepEqual(positions(), [[30, 35], [70, 35], [100, 20]], 'group drag moves selected nodes by the same delta only')
    tools.onPointerDown(event('pointerdown', 30, 35))
    tools.onPointerMove(event('pointermove', 35, 40))
    tools.cancelActiveTool() // NodeCanvas's Escape handler delegates here.
    tools.onPointerUp(event('pointerup', 35, 40))
    selected([1, 2], 'Escape ends a drag without clearing selection')
    assert.deepEqual(positions(), [[35, 40], [75, 40], [100, 20]], 'Escape retains the current node positions')
    assert.equal(captures.size, 0, 'Escape releases pointer capture')
    reset([1])
    tools.onPointerDown(event('pointerdown', 50, 10, { shiftKey: true }))
    tools.onPointerMove(event('pointermove', 70, 30, { shiftKey: true }))
    tools.cancelActiveTool()
    tools.onPointerUp(event('pointerup', 70, 30, { shiftKey: true }))
    selected([1], 'Escape cancels an unfinished marquee without applying its result')
    click(150, 150)
    selected([], 'ordinary blank click still clears selection')
    console.log('Canvas selection regressions passed: real editor event wiring, modifier toggles, additive/replacement marquee, group drag, blank clicks and Escape.')
  } finally {
    tools.cancelActiveTool()
    scope.stop()
    editor.editNodes.value = savedNodes
    editor.selectedIds.value = savedSelection
  }
}
