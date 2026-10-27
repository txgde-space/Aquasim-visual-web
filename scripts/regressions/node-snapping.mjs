import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'

export async function checkNodeSnapping(server) {
  const { createSnapSession, snapNodeDrag, SNAP_THRESHOLD_PX } = await server.ssrLoadModule('/src/features/canvas2d/lib/nodeSnapping.ts')
  assert.equal(SNAP_THRESHOLD_PX, 4)
  const node = (node_id, x, y) => ({ node_id, x, y })
  const defaults = { enabled: true, grid: true, alignment: true, spacing: true, scale: 1, gridStep: 100 }
  const only = (kind, extra = {}) => ({ ...defaults, grid: false, alignment: false, spacing: false, [kind]: true, ...extra })
  const session = (references = [], origins = [node(0, 0, 0)], anchor = origins[0].node_id) => createSnapSession([...origins, ...references], origins.map((point) => point.node_id), anchor)
  const closePoint = (actual, expected, message) => {
    assert.ok(Math.abs(actual.x - expected.x) < 1e-7 && Math.abs(actual.y - expected.y) < 1e-7,
      `${message}: expected (${expected.x}, ${expected.y}), received (${actual.x}, ${actual.y})`)
  }
  const grid = session()
  closePoint(snapNodeDrag(grid, { x: 97, y: 196 }, only('grid')).delta, { x: 100, y: 200 }, 'nearby grid intersections snap both axes')
  closePoint(snapNodeDrag(grid, { x: 90, y: 196 }, only('grid')).delta, { x: 90, y: 200 }, 'each axis outside the capture radius stays free')
  closePoint(snapNodeDrag(grid, { x: -97, y: -196 }, only('grid')).delta, { x: -100, y: -200 }, 'negative grid coordinates work')
  closePoint(snapNodeDrag(grid, { x: 98, y: 97.9 }, only('grid', { scale: 2 })).delta, { x: 100, y: 97.9 }, '4 screen pixels use the current world scale, including the boundary')
  closePoint(snapNodeDrag(grid, { x: 93, y: 93 }, only('grid', { scale: 2 })).delta, { x: 93, y: 93 }, 'zooming in releases a point outside the screen-space radius')
  for (const options of [{ ...defaults, enabled: false }, { ...only('none') }, ...[0, -1, NaN, Infinity].map((scale) => ({ ...defaults, scale }))]) {
    const result = snapNodeDrag(grid, { x: 97, y: 196 }, options)
    closePoint(result.delta, { x: 97, y: 196 }, 'disabled or invalid-scale snapping preserves raw movement')
    assert.deepEqual(result.guides, [])
  }
  for (const gridStep of [0, -1, NaN, Infinity]) assert.deepEqual(snapNodeDrag(grid, { x: 97, y: 196 }, only('grid', { gridStep })).guides, [])

  const aligned = session([node(1, 100, 300), node(2, 400, 200)])
  const spacingCapture = session([node(1, 0, 0), node(2, 100, 0)])
  for (const scale of [0.5, 1, 2]) {
    for (const distancePx of [5, 6, 7, 8]) {
      const gap = distancePx / scale
      for (const [kind, prepared, target] of [['grid', grid, { x: 100, y: 200 }], ['alignment', aligned, { x: 100, y: 200 }], ['spacing', spacingCapture, { x: 50, y: 0 }]]) {
        const raw = { x: target.x - gap, y: target.y - gap }
        const result = snapNodeDrag(prepared, raw, only(kind, { scale }))
        closePoint(result.delta, raw, `${kind} no longer captures the former ${distancePx}px range at scale ${scale}`)
        assert.deepEqual(result.guides, [], 'leaving the weaker capture radius clears its guides')
      }
    }
  }
  const alignment = snapNodeDrag(aligned, { x: 97, y: 196 }, only('alignment'))
  closePoint(alignment.delta, { x: 100, y: 200 }, 'X and Y alignment can use different reference nodes')
  assert.ok(alignment.guides.every((guide) => guide.kind === 'alignment'))
  const labeled = (result, kind) => result.guides.filter((guide) => guide.kind === kind && guide.label)
  const axisSegments = (result, axis) => labeled(result, 'alignment')
    .filter((guide) => guide.from[axis] !== guide.to[axis])
    .map((guide) => [Math.min(guide.from[axis], guide.to[axis]), Math.max(guide.from[axis], guide.to[axis]), guide.label])
    .sort((a, b) => a[0] - b[0])
  assert.deepEqual(axisSegments(alignment, 'x'), [[100, 400, '300 m']], 'horizontal alignment labels use real endpoints without screen-space padding')
  assert.deepEqual(axisSegments(alignment, 'y'), [[200, 300, '100 m']], 'vertical alignment labels use the final snapped position on the other axis')
  const multipleReferences = session([node(1, 100, 0), node(2, 100, 100), node(3, 100, 300), node(4, 100, 100)])
  const betweenReferences = snapNodeDrag(multipleReferences, { x: 97, y: 175 }, only('alignment'))
  assert.deepEqual(axisSegments(betweenReferences, 'y'), [[0, 100, '100 m'], [100, 175, '75 m'], [175, 300, '125 m']],
    'all same-axis references and the moving node define adjacent distances, with duplicate references removed')
  assert.deepEqual(axisSegments(snapNodeDrag(multipleReferences, { x: 97, y: 225 }, only('alignment')), 'y'),
    [[0, 100, '100 m'], [100, 225, '125 m'], [225, 300, '75 m']], 'guide creation cannot retain a previous moving-node position')
  assert.deepEqual(snapNodeDrag(multipleReferences, { x: 97, y: 175 }, only('alignment')), betweenReferences,
    'building labels does not mutate the reusable drag snapshot')
  const alignedGroup = session([node(3, 100, 0), node(4, 100, 300)], [node(0, 0, 0), node(1, 0, 50), node(2, 10, 40)])
  assert.deepEqual(axisSegments(snapNodeDrag(alignedGroup, { x: 97, y: 125 }, only('alignment')), 'y'),
    [[0, 125, '125 m'], [125, 175, '50 m'], [175, 300, '125 m']], 'every selected member on the final line participates; off-line members do not')
  const overlap = snapNodeDrag(session([node(1, 100, 100), node(2, 100, 300)]), { x: 97, y: 100 }, only('alignment'))
  assert.deepEqual(axisSegments(overlap, 'y'), [[100, 300, '200 m']], 'overlapping moving and reference nodes are deduplicated')
  assert.ok(labeled(overlap, 'alignment').every((guide) => guide.label !== '0 m' && Math.hypot(guide.to.x - guide.from.x, guide.to.y - guide.from.y) > 0),
    'overlap cannot produce zero-distance labels')
  const longAlignment = snapNodeDrag(session([node(1, 100, 0), node(2, 100, 2500)]), { x: 97, y: 1250 }, only('alignment'))
  assert.deepEqual(axisSegments(longAlignment, 'y'), [[0, 1250, '1.25 km'], [1250, 2500, '1.25 km']], 'alignment distances use compact kilometre labels')
  const fractionalAlignment = snapNodeDrag(session([node(1, 100, 123.456)]), { x: 97, y: 0 }, only('alignment'))
  assert.deepEqual(axisSegments(fractionalAlignment, 'y'), [[0, 123.456, '123.46 m']], 'labels round to two decimals without altering actual endpoints')
  for (const [gridStep, raw, label] of [[200, { x: 197, y: 403 }, '网格 200 m'], [2000, { x: 1997, y: 4003 }, '网格 2 km']]) {
    for (const scale of [1, 0.5]) {
      const result = snapNodeDrag(grid, raw, only('grid', { gridStep, scale }))
      assert.equal(labeled(result, 'grid').length, 2)
      assert.ok(labeled(result, 'grid').every((guide) => guide.label === label), 'grid labels identify grid spacing, independent of guide length and zoom')
      assert.ok(labeled(result, 'grid').every((guide) => Math.abs(Math.hypot(guide.to.x - guide.from.x, guide.to.y - guide.from.y) * scale - 48) < 1e-7),
        'weaker snapping retains the 24px visual half-length of grid guides')
    }
  }
  const tie = snapNodeDrag(aligned, { x: 97, y: 196 }, { ...defaults, spacing: false })
  assert.ok(tie.guides.every((guide) => guide.kind === 'alignment'), 'alignment wins equal-distance grid ties')
  const nearerGrid = snapNodeDrag(session([node(1, 103, 300)]), { x: 99, y: 55 }, { ...defaults, spacing: false })
  closePoint(nearerGrid.delta, { x: 100, y: 55 }, 'closer grid wins over a farther alignment')
  const excluded = session([], [node(0, 0, 0), node(1, 100, 100)])
  const excludedResult = snapNodeDrag(excluded, { x: 4, y: 4 }, only('alignment'))
  closePoint(excludedResult.delta, { x: 4, y: 4 }, 'selected nodes never become their own references')
  assert.deepEqual(excludedResult.guides, [])

  for (const axis of ['x', 'y']) {
    const point = (along, across) => axis === 'x' ? { x: along, y: across } : { x: across, y: along }
    const spacing = session([node(1, 0, 0), { node_id: 2, ...point(100, 0) }])
    for (const [raw, expected] of [[47, 50], [197, 200], [-97, -100]]) {
      const result = snapNodeDrag(spacing, point(raw, 3), only('spacing'))
      closePoint(result.delta, point(expected, 0), `${axis} spacing alone enforces midpoint/extension and the common row/column`)
      assert.equal(result.guides.length, 2)
      assert.ok(result.guides.every((guide) => guide.kind === 'spacing' && guide.label))
      const lengths = result.guides.map((guide) => Math.hypot(guide.to.x - guide.from.x, guide.to.y - guide.from.y))
      assert.equal(lengths[0], lengths[1], 'spacing guides represent two equal world distances')
      assert.ok(result.guides.every((guide) => guide.label === (expected === 50 ? '50 m' : '100 m')), 'spacing labels describe each equal interval')
    }
    const remote = snapNodeDrag(spacing, point(47, 20), only('spacing'))
    closePoint(remote.delta, point(47, 20), 'spacing cannot capture a node far from the reference row/column')
    assert.deepEqual(remote.guides, [])
  }
  const longSpacing = snapNodeDrag(session([node(1, 0, 0), node(2, 4000, 0)]), { x: 1997, y: 3 }, only('spacing'))
  assert.deepEqual(longSpacing.guides.map((guide) => guide.label), ['2 km', '2 km'], 'spacing uses the same compact kilometre format as alignment')
  const boundarySpacing = snapNodeDrag(session([node(1, 0, 0), node(2, 2000, 0)]), { x: 997, y: 3 }, only('spacing'))
  assert.deepEqual(boundarySpacing.guides.map((guide) => guide.label), ['1 km', '1 km'], '1000 metres is the kilometre formatting boundary')
  const row = session([node(1, 0, 0), node(2, 100, 0)])
  closePoint(snapNodeDrag(row, { x: 47, y: 3 }, { ...defaults, grid: false }).delta, { x: 50, y: 0 }, 'spacing can add X while preserving an already chosen Y alignment')
  const gridSpacingTie = snapNodeDrag(row, { x: 47, y: 3 }, { ...defaults, alignment: false, gridStep: 50 })
  assert.ok(gridSpacingTie.guides.every((guide) => guide.kind === 'spacing'), 'spacing wins an equal-distance grid tie')
  const conflict = session([node(1, 0, 0), node(2, 100, 0), node(3, 300, 2)])
  const conflictResult = snapNodeDrag(conflict, { x: 47, y: 3 }, { ...defaults, grid: false })
  closePoint(conflictResult.delta, { x: 47, y: 2 }, 'a farther spacing constraint cannot displace a closer conflicting alignment')
  assert.ok(conflictResult.guides.every((guide) => guide.kind === 'alignment'), 'conflicting guides cannot claim a false equal-spacing relationship')
  const noisyRow = session([node(1, 0, 0), node(2, 100, 0.0000001)])
  closePoint(snapNodeDrag(noisyRow, { x: 47, y: 3 }, only('spacing')).delta, { x: 50, y: 0 }, 'tiny coordinate noise does not split a row')
  assert.deepEqual(snapNodeDrag(session([node(1, 0, 0), node(2, 100, 1)]), { x: 47, y: 3 }, only('spacing')).guides, [], 'different rows do not become spacing references')

  const origins = [node(0, 20, 30), node(1, 67, 81)]
  const group = session([], origins)
  const translated = snapNodeDrag(group, { x: 77, y: 166 }, only('grid'))
  closePoint(translated.delta, { x: 80, y: 170 }, 'the best group anchor supplies a single translation')
  const moved = origins.map((origin) => ({ x: origin.x + translated.delta.x, y: origin.y + translated.delta.y }))
  closePoint({ x: moved[1].x - moved[0].x, y: moved[1].y - moved[0].y }, { x: 47, y: 51 }, 'a selected group never changes its relative positions')
  const secondAnchor = session([node(2, 100, 200)], origins)
  closePoint(snapNodeDrag(secondAnchor, { x: 30, y: 116 }, only('alignment')).delta, { x: 33, y: 119 }, 'a secondary group member can align the whole group')
  const tieOrigins = [node(0, 0, 40), node(1, 8, 40)]
  const deterministic = snapNodeDrag(session([], tieOrigins, 1), { x: 96, y: 15 }, only('grid'))
  closePoint(deterministic.delta, { x: 92, y: 15 }, 'the pressed node resolves equal-distance group ties')
  assert.deepEqual(snapNodeDrag(session([], [...tieOrigins].reverse(), 1), { x: 96, y: 15 }, only('grid')), deterministic, 'input order cannot change tie resolution')
  closePoint(snapNodeDrag(grid, { x: 115, y: 215 }, only('grid')).delta, { x: 115, y: 215 }, 'fresh raw movement releases previous snapping without drift or a lock')

  let coordinateReads = 0
  const source = [{ node_id: 0, get x() { coordinateReads += 1; return 0 }, get y() { coordinateReads += 1; return 0 } },
    { node_id: 1, get x() { coordinateReads += 1; return 100 }, get y() { coordinateReads += 1; return 200 },
      get applicationMetadata() { throw new Error('snapping must not inspect unrelated metadata') } }]
  const snapshot = createSnapSession(source, [0], 0)
  const readsAfterSnapshot = coordinateReads
  for (let index = 0; index < 100; index += 1) snapNodeDrag(snapshot, { x: 97, y: 196 }, defaults)
  assert.equal(coordinateReads, readsAfterSnapshot, 'mousemove only queries the prepared geometry snapshot')
  const mutable = [node(0, 0, 0), node(1, 100, 200)]
  const isolated = createSnapSession(mutable, [0], 0)
  mutable[1].x = 900
  closePoint(snapNodeDrag(isolated, { x: 97, y: 196 }, only('alignment')).delta, { x: 100, y: 200 }, 'a drag snapshot is isolated from later live node edits')
  closePoint(snapNodeDrag(createSnapSession(mutable, [0], 0), { x: 97, y: 196 }, only('alignment')).delta, { x: 97, y: 200 }, 'a new drag rebuilds references from current geometry')
  assert.deepEqual(snapNodeDrag(createSnapSession(mutable, [], 0), { x: 97, y: 196 }, defaults).guides, [])

  const many = Array.from({ length: 1600 }, (_, index) => node(index, (index % 40) * 100, Math.floor(index / 40) * 100))
  const started = performance.now()
  const prepared = createSnapSession(many, many.slice(0, 40).map((point) => point.node_id), 0)
  for (let index = 0; index < 120; index += 1) {
    const raw = { x: 43 + index * 1.13, y: 93 + index * 0.37 }
    const result = snapNodeDrag(prepared, raw, defaults)
    assert.ok(Math.abs(result.delta.x - raw.x) <= SNAP_THRESHOLD_PX && Math.abs(result.delta.y - raw.y) <= SNAP_THRESHOLD_PX, 'all candidates respect the per-axis screen-space radius')
  }
  const elapsed = performance.now() - started
  assert.ok(elapsed < 5000, `prepared snapping should not perform per-move pair enumeration (${elapsed.toFixed(0)} ms)`)
  console.log(`Node snapping regressions passed: radius/scale, adjacent-distance labels, independent modes, spacing constraints, conflicts, stable groups, snapshots and 1600-node queries (${elapsed.toFixed(0)} ms).`)
}
