import { fixtureLayers, selectedForm } from './protocol-fixture.mjs'
import assert from 'node:assert/strict'
import { createRenderer, h, nextTick, onMounted, reactive, ssrContextKey } from 'vue'

export async function checkCanvasState(server) {
  const { parseCanvasState } = await server.ssrLoadModule('/src/shared/canvasState.ts')
  const { serializeExperiment, parseExperiment } = await server.ssrLoadModule('/src/features/experiment/lib/experimentDocument.ts')
  const { createDefaultExperimentForm, createDefaultTopology, buildExperimentSpec } = await server.ssrLoadModule('/src/features/experiment/lib/experimentSpec.ts')
  const { useCanvasPersistence } = await server.ssrLoadModule('/src/features/canvas2d/composables/useCanvasPersistence.ts')
  const { generateAquaVisualCc } = await server.ssrLoadModule('/src/features/experiment/lib/generateScratch.ts')
  const saved = {
    version: 1, viewport: { width: 1400, height: 600 },
    view: { bounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 }, center: { x: -50, y: 125 }, scale: .2, zoom: 2 },
    nodeSize: .9,
    measurements: [{ id: 'measurement-1', start: { x: -100, y: 0, z: -5, nodeId: 3 }, end: { x: 500, y: 700 } }],
    nodeRanges: { 3: { visible: true, radiusM: '1.5km', filled: true, showLabel: false, opacity: .2 } },
    snapping: { enabled: true, grid: false, alignment: true, spacing: false },
  }
  assert.deepEqual(parseCanvasState(saved), saved)
  assert.equal(parseCanvasState(undefined), undefined, 'visual settings are optional')
  const parsed = parseCanvasState(saved); parsed.measurements[0].start.x = 12; parsed.nodeRanges[3].radiusM = '20m'
  assert.equal(saved.measurements[0].start.x, -100); assert.equal(saved.nodeRanges[3].radiusM, '1.5km', 'parsing creates detached data')
  for (const mutate of [
    s => { s.version = 99 }, s => { s.view.center.x = Infinity }, s => { s.view.scale = 0 },
    s => { s.view.bounds.minX = 3000 }, s => { s.nodeSize = 20 },
    s => { s.measurements.push(s.measurements[0]) }, s => { s.measurements[0].start.nodeId = 1.5 },
    s => { s.measurements = Array.from({ length: 1001 }, () => ({})) }, s => { s.snapping.grid = 'false' },
    s => { s.nodeRanges[3].opacity = -1 }, s => { s.nodeRanges[0] = s.nodeRanges[3] },
  ]) {
    const invalid = structuredClone(saved); mutate(invalid); assert.throws(() => parseCanvasState(invalid), /画布/)
  }
  const draft = { form: createDefaultExperimentForm(), nodes: [], selectedIds: [], activeCatalogId: '', canvas: saved }
  const doc = JSON.parse(serializeExperiment(draft))
  assert.deepEqual(doc.editor.canvas, saved)
  assert.equal(doc.canvas, undefined, 'visual state lives only in optional editor data')
  assert.deepEqual(parseExperiment(JSON.stringify(doc)).canvas, saved)
  delete doc.editor.canvas
  assert.equal(parseExperiment(JSON.stringify(doc)).canvas, undefined, 'older editor documents still import')
  delete doc.editor
  assert.equal(parseExperiment(JSON.stringify(doc)).canvas, undefined, 'bare ns-3 specs require no visual state')

  const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
  let restored = [], emitted = []
  const live = reactive({ enabled: true, active: true, renderRevision: 0, snapshot: structuredClone(saved) })
  const App = { setup() {
    // Device defaults load before a file restore; the file must win.
    onMounted(() => { live.snapshot.nodeSize = 1.2 })
    useCanvasPersistence({ enabled: () => live.enabled, active: () => live.active, initial: () => saved,
      capture: () => { void live.renderRevision; return JSON.parse(JSON.stringify(live.snapshot)) },
      restore: state => { restored.push(state); live.snapshot = state }, emit: state => { emitted.push(state); live.renderRevision++ } })
    return () => null
  } }
  const app = renderer.createApp(App); app.provide(ssrContextKey, { modules: new Set() }); app.mount({})
  try {
    await nextTick()
    assert.equal(restored.length, 1); assert.equal(emitted.at(-1).nodeSize, .9, 'saved preferences override device defaults')
    live.snapshot.view.center.x = 300; await nextTick()
    assert.equal(emitted.at(-1).view.center.x, 300)
    assert.equal(restored.length, 1, 'saving a view never restores it again or resets a gesture')
    live.active = false; await nextTick(); const count = emitted.length
    live.snapshot.nodeSize = 1.4; await nextTick(); assert.equal(emitted.length, count, 'hidden canvases stop snapshot traversal')
    live.active = true; await nextTick(); assert.equal(emitted.at(-1).nodeSize, 1.4)
  } finally { app.unmount() }
  // Optional editor data cannot change executable code, even when the whole file is sent.
  const layers = fixtureLayers.map(layer => ({ ...layer, items: layer.items.map(item => ({ ...item, attributes: [] })) }))
  const spec = buildExperimentSpec(selectedForm(createDefaultExperimentForm), createDefaultTopology(2), layers)
  assert.equal(generateAquaVisualCc({ ...spec, editor: { canvas: saved } }, layers), generateAquaVisualCc(spec, layers))
  console.log('Canvas state regressions passed: optional metadata, strict atomic import, detached snapshots, restore precedence and hidden-view lifecycle.')
}
