import assert from 'node:assert/strict'
import { createRenderer, h, nextTick, reactive, ssrContextKey } from 'vue'

// Record transformed paths and their paint state without a browser or a canvas dependency.
function recordingContext() {
  const calls = [], points = [], paints = [], texts = [], stack = []
  const state = { matrix: [1, 0, 0, 1, 0, 0], fillStyle: 'initial-fill', strokeStyle: 'initial-stroke', lineWidth: 1, globalAlpha: .8 }
  let path = []
  const point = (x, y) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), 'model geometry must remain finite')
    const [a, b, c, d, e, f] = state.matrix
    const p = [a * x + c * y + e, b * x + d * y + f]
    path.push(p); points.push(p)
  }
  const multiply = ([a, b, c, d, e, f]) => {
    const [A, B, C, D, E, F] = state.matrix
    state.matrix = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F]
  }
  const paint = (kind) => paints.push({ kind, path: path.map((p) => [...p]), matrix: [...state.matrix], fillStyle: state.fillStyle,
    strokeStyle: state.strokeStyle, lineWidth: state.lineWidth, globalAlpha: state.globalAlpha })
  const gradient = () => ({ stops: [], addColorStop(offset, color) { this.stops.push([offset, color]) } })
  const methods = {
    save() { stack.push({ ...state, matrix: [...state.matrix] }) },
    restore() { assert.ok(stack.length, 'canvas restores are balanced'); Object.assign(state, stack.pop()) },
    setTransform(...matrix) { state.matrix = matrix },
    translate(x, y) { multiply([1, 0, 0, 1, x, y]) },
    scale(x, y) { multiply([x, 0, 0, y, 0, 0]) },
    rotate(angle) { multiply([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]) },
    beginPath() { path = [] },
    moveTo: point, lineTo: point,
    quadraticCurveTo(cx, cy, x, y) { point(cx, cy); point(x, y) },
    bezierCurveTo(ax, ay, bx, by, x, y) { point(ax, ay); point(bx, by); point(x, y) },
    arc(x, y, radius) { for (let i = 0; i < 16; i++) point(x + Math.cos(i * Math.PI / 8) * radius, y + Math.sin(i * Math.PI / 8) * radius) },
    ellipse(x, y, rx, ry, angle = 0) {
      for (let i = 0; i < 16; i++) {
        const dx = Math.cos(i * Math.PI / 8) * rx, dy = Math.sin(i * Math.PI / 8) * ry
        point(x + dx * Math.cos(angle) - dy * Math.sin(angle), y + dx * Math.sin(angle) + dy * Math.cos(angle))
      }
    },
    rect(x, y, w, height) { point(x, y); point(x + w, y); point(x + w, y + height); point(x, y + height) },
    roundRect(x, y, w, height) { methods.rect(x, y, w, height) },
    fill() { paint('fill') }, stroke() { paint('stroke') },
    fillRect(x, y, w, height) { methods.rect(x, y, w, height); paint('fill') },
    strokeRect(x, y, w, height) { methods.rect(x, y, w, height); paint('stroke') },
    fillText(text, x, y) { texts.push({ text: String(text), x, y, fillStyle: state.fillStyle, textAlign: state.textAlign }) },
    measureText(text) { return { width: String(text).length * 6 } },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
  }
  const ctx = new Proxy(state, { get(target, key) {
    if (key in methods) return (...args) => { calls.push([key, ...args]); return methods[key](...args) }
    if (key in target) return target[key]
    return (...args) => calls.push([key, ...args])
  } })
  return { ctx, state, calls, points, paints, texts, stack,
    clear() { calls.length = 0; points.length = 0; paints.length = 0; texts.length = 0 } }
}

export async function checkNodeModels2D(server) {
  const [{ drawNodeModel, drawNodeModelMeters }, { drawNodeBody }, { nodeModelExtents }, { nodeSpriteLayout, hitNodeSprite }, { THEME_PROFILES }, { NODE_MODEL_OPTIONS }, { default: NodeCanvas }] = await Promise.all([
    '/src/features/canvas2d/lib/draw/nodes.ts', '/src/features/canvas2d/lib/draw/scene.ts',
    '/src/features/canvas2d/lib/nodeModelGeometry.ts', '/src/features/canvas2d/lib/nodeSpriteLayout.ts', '/src/features/canvas2d/lib/themes.ts',
    '/src/shared/nodeModel.ts', '/src/components/NodeCanvas.vue',
  ].map((file) => server.ssrLoadModule(file)))
  const profile = THEME_PROFILES['industrial-scada']
  const hasColor = (paint, color) => paint.fillStyle === color || paint.fillStyle?.stops?.some(([, stop]) => stop === color)
  const p = { x: 140, y: 100 }, radius = 18
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.deepEqual(nodeModelExtents(invalid), { halfWidth: 0, halfHeight: 0 })
    const record = recordingContext()
    drawNodeModel(record.ctx, 'auv', p, invalid, profile, profile.tx, profile.nodeStroke)
    assert.equal(record.calls.length, 0, 'degenerate model sizes issue no invalid canvas operations')
  }
  for (const id of [1, 65534]) {
    const layout = nodeSpriteLayout(radius, id)
    assert.equal(hitNodeSprite(0, layout.idY, radius, id), true, 'the readable ID plate is part of the pointer target')
    assert.equal(hitNodeSprite(layout.idWidth / 2, layout.idY, radius, id), true)
    assert.equal(hitNodeSprite(0, layout.idY + layout.idHeight / 2 + 5, radius, id), false,
      'the pointer target ends just beyond the ID plate padding')
  }
  for (const {value:kind} of NODE_MODEL_OPTIONS) {
    const small=recordingContext(), large=recordingContext()
    drawNodeModelMeters(small.ctx,kind,{x:0,y:0},1,profile)
    drawNodeModelMeters(large.ctx,kind,{x:0,y:0},2,profile)
    assert.equal(small.points.length,large.points.length)
    assert.equal(small.stack.length,0)
    for(let i=0;i<small.points.length;i++) for(let axis=0;axis<2;axis++) {
      assert.ok(Math.abs(large.points[i][axis]-small.points[i][axis]*2)<1e-8, `${kind}: equipment shares the metre projection used by scenery`)
    }
    const first=recordingContext(), resized=recordingContext()
    drawNodeBody(first.ctx,{node_id:1,x:0,y:0,modelType:kind},{mode:'idle',fillProgress:0},profile,0,1,12,{x:0,y:0},false)
    drawNodeBody(resized.ctx,{node_id:1,x:0,y:0,modelType:kind},{mode:'idle',fillProgress:0},profile,0,1,24,{x:0,y:0},false)
    const surfaces = record=>record.paints.filter(paint=>paint.kind==='fill' && paint.fillStyle?.stops).map(paint=>paint.path)
    const modelSurfaces = surfaces(first), biggerSurfaces = surfaces(resized)
    assert.ok(modelSurfaces.length>0,`${kind}: overview draws shaded equipment, not only an empty locator ring`)
    const points=modelSurfaces.flat(), width=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))
    assert.ok(width>12,`${kind}: equipment stays readable at kilometre-scale overview`)
    for(let i=0;i<modelSurfaces.length;i++) for(let j=0;j<modelSurfaces[i].length;j++) for(let axis=0;axis<2;axis++) {
      assert.ok(Math.abs(biggerSurfaces[i][j][axis]-modelSurfaces[i][j][axis]*2)<1e-8,`${kind}: node-size control enlarges the visible equipment as well as its ring`)
    }
  }
  const shapeSignatures = []
  for (const { value: kind } of NODE_MODEL_OPTIONS) {
    const record = recordingContext()
    drawNodeModel(record.ctx, kind, p, radius, profile, profile.tx, profile.nodeStroke)
    assert.ok(record.points.length > 0 && record.paints.length > 0, `${kind} renders real geometry`)
    assert.equal(record.stack.length, 0, `${kind} balances save/restore`)
    assert.deepEqual(record.state.matrix, [1, 0, 0, 1, 0, 0], `${kind} preserves the caller transform`)
    assert.equal(record.state.globalAlpha, .8, `${kind} preserves the caller alpha`)
    assert.ok(record.paints.some((paint) => paint.fillStyle?.stops?.length > 1), `${kind} uses shaded surface materials`)
    const materialColors = Object.values(profile.model)
    assert.ok(record.paints.some((paint) => materialColors.some((color) => hasColor(paint, color))),
      `${kind} takes equipment colors from the model theme palette`)
    const otherStatus = recordingContext()
    drawNodeModel(otherStatus.ctx, kind, p, radius, profile, profile.rx, profile.nodeStroke)
    const surfaceGradients = (sample) => JSON.stringify(sample.paints.filter((paint) => paint.fillStyle?.stops)
      .map((paint) => paint.fillStyle.stops))
    assert.equal(surfaceGradients(otherStatus), surfaceGradients(record), 'changing an indicator color cannot recolor equipment surfaces')
    const extents = nodeModelExtents(radius)
    for (const [x, y] of record.points) {
      assert.ok(Math.abs(x - p.x) <= extents.halfWidth + 1e-8, `${kind} stays inside its horizontal hit extent`)
      assert.ok(Math.abs(y - p.y) <= extents.halfHeight + 1e-8, `${kind} stays inside its vertical hit extent`)
    }
    shapeSignatures.push(JSON.stringify(record.points))
    const bigger = recordingContext()
    drawNodeModel(bigger.ctx, kind, p, radius * 2, profile, profile.tx, profile.nodeStroke)
    assert.equal(bigger.points.length, record.points.length)
    for (let i = 0; i < record.points.length; i++) {
      assert.ok(Math.abs((bigger.points[i][0] - p.x) - (record.points[i][0] - p.x) * 2) < 1e-8, `${kind} width follows node size`)
      assert.ok(Math.abs((bigger.points[i][1] - p.y) - (record.points[i][1] - p.y) * 2) < 1e-8, `${kind} height follows node size`)
    }
  }
  assert.equal(new Set(shapeSignatures).size, NODE_MODEL_OPTIONS.length, 'all model types have distinct 2D silhouettes')

  const rotated = recordingContext()
  drawNodeBody(rotated.ctx, { node_id: 17, name: 'Moving AUV', x: 0, y: 0, modelType: 'auv', motionDirection: { x: 0, y: 5, z: -1 } },
    { mode: 'idle', fillProgress: 0 }, profile, 0, 1, radius, p)
  assert.ok(rotated.calls.some(([method, angle]) => method === 'rotate' && angle === -Math.PI / 2), '2D model turns with its recorded planar direction')
  assert.equal(rotated.stack.length, 0)
  const rotatedId = rotated.texts.find((entry) => entry.text === '17')
  assert.equal(rotatedId.x, p.x, 'the readable numeric ID stays upright under a rotated model')
  const upright = recordingContext()
  drawNodeBody(upright.ctx, { node_id: 18, name: 'Buoy', x: 0, y: 0, modelType: 'buoy', motionDirection: { x: 0, y: 5, z: -1 } },
    { mode: 'idle', fillProgress: 0 }, profile, 0, 1, radius, p)
  assert.ok(!upright.calls.some(([method]) => method === 'rotate'), 'buoys stay upright when their position drifts')

  for (const fx of [1, 2.2]) {
    const rendered = []
    for (const { value: kind } of NODE_MODEL_OPTIONS) {
      let idleMaterials
      for (const [mode, color] of [['idle', profile.idleInner], ['tx', profile.tx], ['rx', profile.rx], ['collision', profile.bad]]) {
        const record = recordingContext()
        drawNodeBody(record.ctx, { node_id: 17, name: 'Demo', x: 0, y: 0, z: -42, modelType: kind },
          { mode, fillProgress: .6 }, profile, .25, fx, radius, p)
        if (mode !== 'idle') assert.ok(record.paints.some((paint) => hasColor(paint, color) || paint.strokeStyle === color),
          `${kind} ${mode} retains its status color at fx ${fx}`)
        const materials = record.paints
          .filter((paint) => Math.abs(paint.matrix[0]) > 1 && Math.abs(paint.matrix[3]) > 1)
          .map(({ kind: operation, fillStyle, strokeStyle, lineWidth }) => operation === 'fill'
            ? { operation, fillStyle } : { operation, strokeStyle, lineWidth })
        assert.ok(materials.length > 0, 'the model owns painted surface geometry')
        const signature = JSON.stringify(materials)
        if (mode === 'idle') idleMaterials = signature
        else assert.equal(signature, idleMaterials, `${kind} ${mode} preserves model materials while its status changes`)
        const id = record.texts.find((text) => text.text === '17')
        assert.ok(id && id.x === p.x && id.y > p.y + nodeModelExtents(radius).halfHeight,
          'the numeric node ID remains visible below the model')
        const label = record.texts.find((text) => text.text === 'Demo')
        assert.ok(label && label.x > p.x + nodeModelExtents(radius).halfWidth, 'node names stay beside the model')
        assert.ok(record.texts.some((text) => text.text.includes('-42')), 'depth labels survive model rendering')
        if (mode === 'idle') rendered.push(JSON.stringify(record.points))
        const selected = recordingContext()
        drawNodeBody(selected.ctx, { node_id: 17, name: 'Demo', x: 0, y: 0, modelType: kind },
          { mode, fillProgress: .6 }, profile, .25, fx, radius, p, true)
        assert.equal(selected.paints.filter((paint) => paint.kind === 'stroke').length,
          record.paints.filter((paint) => paint.kind === 'stroke').length, 'selection thickens an existing outline without adding another ring')
        assert.ok(Math.max(...selected.paints.map((paint) => paint.lineWidth)) > Math.max(...record.paints.map((paint) => paint.lineWidth)),
          'selection remains visually distinguishable')
      }
    }
    assert.equal(new Set(rendered).size, NODE_MODEL_OPTIONS.length, `all five models render at fx ${fx}`)
  }

  const saved = new Map(['window', 'document', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map((key) => [key, globalThis[key]]))
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const storage = new Map()
  // Node-size controls persist by design. Keep this mount's preferences out of
  // later regressions, including their first-frame scheduling expectations.
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => storage.get(String(key)) ?? null,
      setItem: (key, value) => storage.set(String(key), String(value)),
      removeItem: (key) => storage.delete(String(key)),
    },
  })
  const frames = new Map()
  let nextFrame = 1
  globalThis.window = new EventTarget()
  globalThis.document = new EventTarget()
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  globalThis.requestAnimationFrame = (callback) => { const id = nextFrame++; frames.set(id, callback); return id }
  globalThis.cancelAnimationFrame = (id) => frames.delete(id)
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(100) }
  const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
  let app
  try {
    const props = reactive({ nodes: [{ node_id: 1, name: 'One', role: 'node', x: 0, y: 0, z: 0, modelType: 'auv' }],
      active: true, editMode: true, nodeVisuals: [], visiblePackets: [], currentTime: 0 })
    const Canvas = { ...NodeCanvas, render: () => null }
    app = renderer.createApp({ render: () => h(Canvas, props) })
    app.provide(ssrContextKey, { modules: new Set() })
    app.mount({})
    const canvas = app._instance.subTree.component.setupState
    const record = recordingContext()
    let draws = 0
    canvas.canvasEl = { getContext: () => { draws++; return record.ctx }, width: 0, height: 0, removeEventListener() {} }
    await nextTick(); flush()
    const initialShape = JSON.stringify(record.points)
    record.clear()
    props.nodes[0].modelType = 'rov'
    await nextTick()
    assert.equal(frames.size, 1, 'an in-place modelType-only change queues a 2D redraw')
    flush()
    assert.ok(record.points.length > 0)
    assert.notEqual(JSON.stringify(record.points), initialShape, 'the mounted canvas paints the changed model')
    assert.equal(frames.size, 0, 'model drawing never starts another animation loop')
    props.active = false
    await nextTick()
    const beforeHidden = draws
    record.clear()
    props.nodes[0].modelType = 'buoy'
    await nextTick()
    assert.equal(frames.size, 0)
    assert.equal(draws, beforeHidden, 'hidden model changes do not paint')
    assert.equal(record.points.length, 0)
    props.active = true
    await nextTick()
    assert.equal(draws, beforeHidden + 1, 'showing the canvas synchronizes the latest model immediately')
    assert.equal(frames.size, 0, 'reactivation does not leave a second scheduled draw')
    const resumedShape = JSON.stringify(record.points)
    record.clear()
    canvas.draw()
    assert.equal(JSON.stringify(record.points), resumedShape, 'reactivation already rendered the current model')

    for (const size of [.5, 1, 1.5]) {
      canvas.nodeSizeScale = size
      await nextTick(); flush()
      const screen = canvas.toScreen(0, 0)
      const extent = nodeModelExtents(canvas.nodeRadius)
      assert.equal(canvas.pickNodeAt(screen.x, screen.y)?.node_id, 1)
      assert.equal(canvas.pickNodeAt(screen.x + extent.halfWidth, screen.y)?.node_id, 1,
        'the full visible model width can be picked at every node size')
      assert.equal(canvas.pickNodeAt(screen.x, screen.y + extent.halfHeight)?.node_id, 1,
        'the full visible model height can be picked at every node size')
      const layout = nodeSpriteLayout(canvas.nodeRadius, 1)
      assert.equal(canvas.pickNodeAt(screen.x, screen.y + layout.idY)?.node_id, 1,
        'the real canvas also accepts clicks on the numeric ID plate')
      assert.equal(canvas.pickNodeAt(screen.x + extent.halfWidth + 100, screen.y), null)
      assert.equal(canvas.pickNodeAt(screen.x, screen.y + extent.halfHeight + 100), null)
    }
  } finally {
    try {
      app?.unmount()
      assert.equal(frames.size, 0, 'unmount cancels remaining model redraws')
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete globalThis[key]
        else globalThis[key] = value
      }
      if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
      else delete globalThis.localStorage
    }
  }
  console.log('2D node models passed: five silhouettes, scale/bounds, state colors, readable IDs, selection, real canvas invalidation, hidden recovery, hit areas and no extra RAF loop.')
}
