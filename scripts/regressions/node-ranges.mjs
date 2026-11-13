import assert from 'node:assert/strict'
import { effectScope, h, nextTick, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'

export async function checkNodeRanges(server) {
  const [{ DEFAULT_NODE_RANGE, rangeRadius }, { useNodeRanges }, { drawNodeRanges }, { protocolRange }, { THEME_PROFILES }, { default: Settings }] = await Promise.all([
    '/src/features/canvas2d/lib/nodeRange.ts', '/src/features/canvas2d/composables/useNodeRanges.ts',
    '/src/features/canvas2d/lib/draw/ranges.ts', '/src/features/experiment/lib/protocolRange.ts',
    '/src/features/canvas2d/lib/themes.ts', '/src/features/canvas2d/NodeRangeSettings.vue',
  ].map((file) => server.ssrLoadModule(file)))
  assert.equal(rangeRadius('', null), null, 'missing range metadata is never guessed')
  assert.equal(rangeRadius('', 1200), 1200)
  for (const [text, meters] of [['1500', 1500], ['1500m', 1500], ['1.5km', 1500], [' 1.5 KM ', 1500], ['.5 km', 500], ['1e3m', 1000], ['20cm', .2], ['500mm', .5]]) {
    assert.equal(rangeRadius(text, 1200), meters, 'display distances normalize m/km into real meters')
  }
  for (const value of ['0', '-1', 'bad', 'Infinity', '1e309', '0km', '-1km', '2ms', '1m km', '0x10', '1e308km']) assert.equal(rangeRadius(value, 1200), null, 'invalid overrides never fall back to a valid model range')
  const form = { phyId: 'ns3::OtherPhy', protocolAttributes: {} }
  const layers = [{ id: 'phy', items: [{ id: form.phyId, typeId: form.phyId,
    attributes: [{ name: 'transRange', defaultValue: '2345' }] }] }]
  assert.equal(protocolRange(form, layers), 2345, 'any PHY implementing the registered interface provides its actual default')
  form.protocolAttributes[form.phyId] = { transRange: '678' }
  assert.equal(protocolRange(form, layers), 678)
  form.protocolAttributes[form.phyId].transRange = 'editing'
  assert.equal(protocolRange(form, layers), null)
  assert.equal(protocolRange(form, []), null)

  const scope = effectScope()
  const nodes = ref([{ node_id: 1, x: 100, y: 200 }, { node_id: 2, x: 400, y: 200 }])
  const automatic = ref(1000), active = ref(true), topology = ref(0)
  const ranges = scope.run(() => useNodeRanges(() => nodes.value, () => automatic.value, () => active.value, () => topology.value))
  try {
    assert.deepEqual(ranges.ranges.value, [])
    ranges.update(1, { visible: true })
    assert.equal(ranges.ranges.value.length, 1)
    assert.equal(ranges.settingsFor(2).visible, false, 'each node has its own visibility')
    const before = structuredClone(nodes.value.map((node) => ({ ...node })))
    ranges.update(1, { radiusM: '500', opacity: 0.2 })
    assert.deepEqual(nodes.value.map((node) => ({ ...node })), before, 'display controls cannot change topology or simulation attributes')
    automatic.value = 2000
    assert.equal(ranges.ranges.value[0].radius, 500, 'custom radii do not follow model changes')
    ranges.update(1, { radiusM: '1.5km' })
    assert.equal(ranges.ranges.value[0].radius, 1500)
    assert.equal(ranges.settingsFor(1).radiusM, '1.5km', 'editing preserves the entered unit instead of rewriting the draft')
    ranges.update(1, { radiusM: '' })
    assert.equal(ranges.ranges.value[0].radius, 2000, 'reset resumes live model defaults')
    nodes.value[0].x = 300
    assert.equal(ranges.ranges.value[0].node.x, 300, 'the footprint follows node movement')
    active.value = false
    assert.deepEqual(ranges.ranges.value, [], 'hidden canvases stop traversing range geometry')
    active.value = true
    assert.equal(ranges.ranges.value[0].radius, 2000)
    nodes.value = nodes.value.slice(1)
    await nextTick()
    nodes.value.push({ node_id: 1, x: 0, y: 0 })
    await nextTick()
    assert.equal(ranges.settingsFor(1).visible, false, 'reusing a deleted node ID never inherits its circle')
    ranges.update(2, { visible: true })
    topology.value++
    await nextTick()
    assert.deepEqual(ranges.ranges.value, [], 'new/imported topologies clear previous display settings')
  } finally { scope.stop() }

  const renderRange = (scale, extra = {}, radius = 1000) => {
    const arcs = [], texts = [], stack = []
    const state = { globalAlpha: 0.3, lineWidth: 7, dash: [1, 2] }
    const original = structuredClone(state)
    const methods = {
      save: () => stack.push({ ...state, dash: [...state.dash] }), restore: () => Object.assign(state, stack.pop()),
      arc: (x, y, radius) => { assert.ok([x, y, radius].every(Number.isFinite)); arcs.push({ x, y, radius }) },
      setLineDash: (dash) => { state.dash = dash }, measureText: (text) => ({ width: text.length * 5 }),
      fillText: (text) => texts.push(text), createRadialGradient: () => ({ addColorStop() {} }),
    }
    const ctx = new Proxy(state, { get: (target, key) => key in methods ? methods[key] : key in target ? target[key] : () => {} })
    drawNodeRanges(ctx, [{ node: { node_id: 1, x: 0, y: 0 }, radius,
      settings: { ...DEFAULT_NODE_RANGE, visible: true, ...extra } }], (x, y) => ({ x: 300 + x * scale, y: 300 - y * scale }), scale,
    THEME_PROFILES['industrial-scada'], { width: 800, height: 650 })
    for (const key of Object.keys(original)) assert.deepEqual(state[key], original[key], 'range drawing restores canvas state')
    assert.equal(stack.length, 0)
    return { arcs, texts }
  }
  assert.equal(renderRange(0.1).arcs[0].radius, 100, 'real meters are projected using current scale')
  assert.equal(renderRange(0.2).arcs[0].radius, 200, 'zoom changes display size, never range meters')
  assert.equal(renderRange(0.1).texts[0], '1 km')
  assert.equal(renderRange(0.1, {}, rangeRadius('1.5km', null)).arcs[0].radius, 150)
  assert.deepEqual(renderRange(0.1, { showLabel: false }).texts, [])
  assert.equal(renderRange(0.1, { filled: false }).arcs.length, 1, 'outline-only mode has no fill pass')
  assert.deepEqual(renderRange(1e100).arcs, [], 'a range covering the viewport avoids enormous arc geometry')
  const html = await renderToString(h(Settings, { settings: { ...DEFAULT_NODE_RANGE, visible: true }, automaticRadius: null }))
  assert.match(html, /暂无协议范围/)
  assert.match(html, /role="switch"/)
  console.log('Node range regressions passed: registered defaults, independent controls, missing/invalid radii, movement, hidden/reset/delete lifecycle and meter-accurate rendering.')
}
