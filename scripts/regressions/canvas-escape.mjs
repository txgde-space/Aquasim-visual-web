import assert from 'node:assert/strict'
import { createRenderer, effectScope, h, markRaw, nextTick, reactive, ref, ssrContextKey } from 'vue'

export async function checkCanvasEscape(server) {
  const { default: NodeCanvas } = await server.ssrLoadModule('/src/components/NodeCanvas.vue')
  const keys = ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver']
  const saved = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const frames = new Map()
  let nextFrame = 0
  globalThis.window = new EventTarget()
  globalThis.document = Object.assign(new EventTarget(), { activeElement: null })
  globalThis.requestAnimationFrame = (fn) => { frames.set(++nextFrame, fn); return nextFrame }
  globalThis.cancelAnimationFrame = (id) => frames.delete(id)
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const apps = []
  const mount = (component, props) => {
    const View = { ...component, render: () => null }
    const app = renderer.createApp({ render: () => h(View, props) })
    app.provide(ssrContextKey, { modules: new Set() })
    app.mount({})
    apps.push(app)
    return app._instance.subTree.component.setupState
  }
  const escape = (extra = {}) => Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape', ...extra })
  const pointer = (type, x, y, extra = {}) => Object.assign(new Event(type, { cancelable: true }), {
    clientX: x, clientY: y, pointerId: 7, button: 0, ...extra,
  })
  const snapshot = (value) => JSON.parse(JSON.stringify(value))
  try {
    const events = []
    const props = reactive({
      nodes: [{ node_id: 0, x: 0, y: 0 }, { node_id: 1, x: 1000, y: 1000 }],
      nodeVisuals: [], currentTime: 0, active: true, editMode: true, boxSelect: true, allowPlaceNode: true,
      onNodeMoveEnd: () => events.push('move-end'), onSelectionChange: () => events.push('selection'),
      onNodeSelect: () => events.push('node-select'),
      onNodesMove: (moves) => {
        events.push('move')
        for (const move of moves) Object.assign(props.nodes.find((node) => node.node_id === move.node_id), move)
      },
    })
    const state = mount(NodeCanvas, props)
    const inside = markRaw({ name: 'canvas control' })
    const outside = markRaw({ name: 'external form' })
    const cardInput = markRaw({ name: 'node card input' })
    const focusCalls = []
    const released = []
    const canvas = markRaw({
      getContext: () => null,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 520 }),
      setPointerCapture() {}, releasePointerCapture: (id) => released.push(id),
      focus: (options) => { focusCalls.push(options); document.activeElement = canvas },
    })
    state.canvasEl = canvas
    state.containerEl = markRaw({
      getBoundingClientRect: canvas.getBoundingClientRect,
      contains: (element) => [inside, cardInput, canvas].includes(element),
    })
    state.nodeCardEl = markRaw({ contains: (element) => element === cardInput })
    state.contextXEl = markRaw({ focus: () => { document.activeElement = inside } })

    state.activateMeasureTool()
    state.onCanvasPointerDown(pointer('pointerdown', 40, 40))
    state.onCanvasPointerDown(pointer('pointerdown', 250, 40))
    assert.equal(state.measurementLines.length, 1)
    const completed = snapshot(state.measurementLines)
    const history = snapshot(state.measure.measurementHistory.value)
    state.onCanvasPointerDown(pointer('pointerdown', 40, 300))
    assert.ok(state.pendingMeasurePoint)
    document.activeElement = inside
    const measureEscape = escape()
    window.dispatchEvent(measureEscape)
    assert.equal(state.toolMode, 'select')
    assert.equal(state.pendingMeasurePoint, null)
    assert.deepEqual(state.measurementLines, completed, 'Escape preserves completed measurements')
    assert.deepEqual(state.measure.measurementHistory.value, history, 'Escape preserves undo history')
    assert.equal(measureEscape.defaultPrevented, true)
    assert.equal(document.activeElement, canvas)
    state.undoMeasurement(); assert.equal(state.measurementLines.length, 0)
    state.redoMeasurement(); assert.deepEqual(state.measurementLines, completed)

    state.zoomPanelOpen = true
    state.onCanvasContextMenu(pointer('contextmenu', 70, 250, { button: 2 }))
    await nextTick()
    assert.ok(state.contextMenu)
    window.dispatchEvent(escape())
    assert.equal(state.zoomPanelOpen, false)
    assert.equal(state.contextMenu, null)
    assert.equal(document.activeElement, canvas, 'closing a focused canvas control restores canvas focus')
    state.zoomPanelOpen = true
    document.activeElement = outside
    const beforeOutside = focusCalls.length
    window.dispatchEvent(escape())
    assert.equal(state.zoomPanelOpen, false)
    assert.equal(focusCalls.length, beforeOutside, 'Escape never steals focus from an external form')
    assert.equal(document.activeElement, outside)

    state.activateMeasureTool()
    state.onCanvasPointerDown(pointer('pointerdown', 40, 300))
    state.zoomPanelOpen = true
    const prevented = escape(); prevented.preventDefault()
    for (const event of [prevented, escape({ isComposing: true })]) {
      window.dispatchEvent(event)
      assert.equal(state.toolMode, 'measure')
      assert.ok(state.pendingMeasurePoint, 'IME and already-handled Escape preserve pending measurement')
      assert.equal(state.zoomPanelOpen, true)
    }
    window.dispatchEvent(escape())

    const nodePoint = state.toScreen(0, 0)
    state.onCanvasPointerDown(pointer('pointerdown', nodePoint.x, nodePoint.y))
    assert.equal(state.draggingNodeId, 0, 'node zero can begin a drag')
    window.dispatchEvent(pointer('pointermove', nodePoint.x + 30, nodePoint.y + 20))
    const movedNodes = snapshot(props.nodes)
    const moveEnds = events.filter((event) => event === 'move-end').length
    window.dispatchEvent(escape())
    assert.equal(state.dragGroup, null)
    assert.equal(state.draggingNodeId, null)
    assert.equal(state.dragFrozenBounds, null)
    assert.equal(events.filter((event) => event === 'move-end').length, moveEnds + 1)
    assert.equal(released.at(-1), 7)
    const afterDragCancel = events.length
    window.dispatchEvent(pointer('pointerup', nodePoint.x, nodePoint.y))
    window.dispatchEvent(pointer('pointermove', nodePoint.x + 100, nodePoint.y))
    assert.equal(events.length, afterDragCancel, 'a cancelled drag has no trailing pointerup/move action')
    assert.deepEqual(props.nodes, movedNodes, 'Escape retains the last applied node positions')

    state.onCanvasPointerDown(pointer('pointerdown', 10, 450, { shiftKey: true }))
    assert.ok(state.marquee)
    window.dispatchEvent(pointer('pointermove', 800, 500))
    window.dispatchEvent(escape())
    assert.equal(state.marquee, null)
    const afterMarqueeCancel = events.length
    window.dispatchEvent(pointer('pointerup', 800, 500))
    assert.equal(events.length, afterMarqueeCancel, 'a cancelled marquee cannot publish a later selection')

    const movedPoint = state.toScreen(props.nodes[0].x, props.nodes[0].y)
    const openCard = () => {
      state.card.beginClick(pointer('pointerdown', movedPoint.x, movedPoint.y))
      window.dispatchEvent(pointer('pointerup', movedPoint.x, movedPoint.y))
      assert.equal(state.card.nodeId.value, 0)
    }
    openCard()
    document.activeElement = cardInput
    window.dispatchEvent(escape({ isComposing: true }))
    assert.equal(state.card.nodeId.value, 0)
    window.dispatchEvent(escape())
    assert.equal(state.card.nodeId.value, null)
    assert.equal(document.activeElement, canvas, 'card Escape restores focus only from inside the card')
    openCard()
    props.active = false
    await nextTick()
    document.activeElement = outside
    const beforeHidden = focusCalls.length
    window.dispatchEvent(escape())
    assert.equal(state.card.nodeId.value, 0, 'hidden canvas card ignores Escape')
    assert.equal(focusCalls.length, beforeHidden)
    props.active = false
    await nextTick()
    await checkCanvasDeletion(server, NodeCanvas, mount, pointer, canvas)
  } finally {
    for (const app of apps.reverse()) app.unmount()
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
  console.log('Canvas keyboard regressions passed: Escape, Delete/Backspace, real editor removal, focus/modal guards and gesture cleanup.')
}

async function checkCanvasDeletion(server, NodeCanvas, mount, pointer, originalCanvas) {
  const { useTopologyEditor } = await server.ssrLoadModule('/src/features/experiment/composables/useTopologyEditor.ts')
  const scope = effectScope()
  const editor = scope.run(() => useTopologyEditor(ref([])))
  const savedNodes = editor.editNodes.value
  const savedSelection = editor.selectedIds.value
  const singleSelection = ref(false)
  const captures = new Set()
  let requests = 0
  let moveEnds = 0
  let openModal = null
  document.querySelector = (selector) => openModal && selector.split(',').some((part) => part.trim() === openModal.selector) ? openModal : null
  const canvas = markRaw({ ...originalCanvas,
    setPointerCapture: (id) => captures.add(id), releasePointerCapture: (id) => captures.delete(id),
  })
  const props = reactive({
    get nodes() { return editor.canvasNodes.value },
    get selectedNodeIds() { return singleSelection.value ? [] : editor.selectedIds.value },
    get selectedNodeId() { return singleSelection.value ? editor.selectedIds.value[0] ?? null : null },
    nodeVisuals: [], currentTime: 0, active: true, editMode: true, boxSelect: true,
    onSelectionChange: editor.onSelectionChange, onNodeSelect: editor.onNodeSelect,
    onNodesMove: editor.onNodesMove, onNodeMove: editor.onNodeMove,
    onNodeMoveEnd: () => { moveEnds += 1 },
    onNodesDelete: () => {
      requests += 1
      assert.equal(state.card.nodeId.value, null, 'close the card before publishing deletion')
      assert.equal(state.dragGroup, null, 'end the drag before publishing deletion')
      assert.equal(state.marquee, null, 'cancel the marquee before publishing deletion')
      assert.equal(captures.size, 0, 'release pointer capture before publishing deletion')
      editor.removeSelected()
    },
  })
  const state = mount(NodeCanvas, props)
  state.canvasEl = canvas
  state.containerEl = markRaw({ getBoundingClientRect: canvas.getBoundingClientRect, contains: (target) => target === canvas })
  // Only the DOM selector behavior needed by keyboard guards; no browser or DOM framework.
  const element = (tagName = 'DIV', attrs = {}, parentElement = null) => markRaw({
    tagName, parentElement, isContentEditable: false,
    closest(selector) {
      const matches = selector.split(',').some((part) => {
        const text = part.trim()
        if (text === tagName.toLowerCase()) return true
        if (text === '[contenteditable]:not([contenteditable="false"])') return attrs.contenteditable !== undefined && attrs.contenteditable !== 'false'
        const role = /^\[role="([^"]+)"\]$/.exec(text)
        return role !== null && role[1] === attrs.role
      })
      return matches ? this : parentElement?.closest(selector) ?? null
    },
  })
  const keydown = (key, extra = {}, target = canvas) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key, ...extra })
    Object.defineProperty(event, 'target', { value: target })
    window.dispatchEvent(event)
    return event
  }
  const ids = () => editor.editNodes.value.map((node) => node.node_id)
  const reset = async (selected = [1]) => {
    state.cancelActiveTool()
    state.card.close()
    editor.editNodes.value = [1, 2, 3].map((node_id) => ({ node_id, x: (node_id - 1) * 500, y: (node_id - 1) * 500, z: 0 }))
    editor.onSelectionChange(selected)
    singleSelection.value = false
    props.active = true
    props.editMode = true
    props.allowDeleteNodes = true
    openModal = null
    document.activeElement = canvas
    await nextTick()
  }
  try {
    await reset()
    delete props.allowDeleteNodes
    await nextTick()
    assert.equal(keydown('Delete').defaultPrevented, false, 'deletion is disabled unless explicitly enabled')
    assert.equal(requests, 0)

    for (const key of ['Delete', 'Backspace']) {
      await reset([1])
      const point = state.toScreen(0, 0)
      state.card.beginClick(pointer('pointerdown', point.x, point.y))
      window.dispatchEvent(pointer('pointerup', point.x, point.y))
      assert.equal(state.card.nodeId.value, 1)
      const before = requests
      assert.equal(keydown(key).defaultPrevented, true)
      assert.equal(requests, before + 1)
      assert.deepEqual(ids(), [2, 3], `${key} deletes only the selected node`)
      assert.deepEqual(editor.selectedIds.value, [], 'deletion clears selection instead of selecting a survivor')
      await nextTick()
      assert.equal(keydown(key).defaultPrevented, false, 'a second press cannot delete an unselected survivor')
      assert.equal(requests, before + 1)

      await reset([1, 3])
      keydown(key)
      assert.deepEqual(ids(), [2], `${key} deletes every selected node`)
      for (const selection of [[], [999]]) {
        await reset(selection)
        const count = requests
        assert.equal(keydown(key).defaultPrevented, false, 'empty or stale selection does not consume deletion')
        assert.equal(requests, count)
        assert.deepEqual(ids(), [1, 2, 3])
      }

      await reset()
      const count = requests
      const controls = [element('INPUT'), element('TEXTAREA'), element('SELECT'),
        element('DIV', { contenteditable: '' }), element('DIV', { contenteditable: 'plaintext-only' }),
        ...['textbox', 'combobox', 'spinbutton', 'dialog', 'alertdialog'].map((role) => element('DIV', { role })), element('DIALOG')]
      controls.push(element('SPAN', {}, controls[3]))
      controls.push(markRaw({ isContentEditable: true }))
      for (const control of controls) {
        document.activeElement = canvas
        assert.equal(keydown(key, {}, control).defaultPrevented, false, `${key} leaves editable/modal event targets alone`)
        document.activeElement = control
        assert.equal(keydown(key).defaultPrevented, false, `${key} also respects the focused element`)
      }
      document.activeElement = canvas
      for (const selector of ['dialog[open]', '[aria-modal="true"]']) {
        openModal = { selector }
        assert.equal(keydown(key).defaultPrevented, false, 'an open modal protects nodes even before it receives focus')
      }
      openModal = null
      for (const extra of [{ isComposing: true }, { repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
        assert.equal(keydown(key, extra).defaultPrevented, false)
      }
      const prevented = new Event('keydown', { cancelable: true })
      Object.defineProperty(prevented, 'key', { value: key })
      prevented.preventDefault()
      window.dispatchEvent(prevented)
      for (const guard of ['active', 'editMode', 'allowDeleteNodes']) {
        props[guard] = false
        await nextTick()
        assert.equal(keydown(key).defaultPrevented, false, `${guard} guards deletion`)
        props[guard] = true
        await nextTick()
      }
      assert.equal(requests, count, 'guarded keys never publish nodes-delete')
      assert.deepEqual(ids(), [1, 2, 3])
      for (const target of [element('BUTTON'), element('DIV', { contenteditable: 'false' })]) {
        await reset()
        document.activeElement = target
        assert.equal(keydown(key, {}, target).defaultPrevented, true, 'ordinary controls and explicitly non-editable elements permit deletion')
        assert.deepEqual(ids(), [2, 3])
      }
    }

    await reset([0])
    editor.editNodes.value = [{ node_id: 0, x: 0, y: 0 }, { node_id: 1, x: 1000, y: 1000 }]
    singleSelection.value = true
    await nextTick()
    assert.equal(keydown('Delete').defaultPrevented, true, 'selectedNodeId supports node zero without selectedNodeIds')
    assert.deepEqual(ids(), [1])

    await reset([1, 2])
    const point = state.toScreen(0, 0)
    state.onCanvasPointerDown(pointer('pointerdown', point.x, point.y))
    window.dispatchEvent(pointer('pointermove', point.x + 30, point.y + 20))
    assert.ok(state.dragGroup)
    assert.equal(captures.size, 1)
    const previousEnds = moveEnds
    keydown('Delete')
    assert.equal(moveEnds, previousEnds + 1)
    assert.equal(state.draggingNodeId, null)
    assert.equal(state.dragFrozenBounds, null)
    assert.deepEqual(ids(), [3])
    await nextTick()
    const remaining = JSON.stringify(editor.editNodes.value)
    window.dispatchEvent(pointer('pointermove', point.x + 100, point.y + 100))
    window.dispatchEvent(pointer('pointerup', point.x, point.y))
    assert.equal(JSON.stringify(editor.editNodes.value), remaining, 'a deleted drag has no trailing move/up effect')
    assert.equal(state.card.nodeId.value, null, 'pointerup after deletion cannot open a node card')
  } finally {
    state.cancelActiveTool()
    props.active = false
    scope.stop()
    editor.editNodes.value = savedNodes
    editor.selectedIds.value = savedSelection
  }
}
