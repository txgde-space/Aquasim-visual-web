import assert from 'node:assert/strict'

const canvasRecorder = () => {
  const state = { globalAlpha: 0.37, strokeStyle: 'previous stroke', fillStyle: 'previous fill', font: 'previous font',
    lineWidth: 7, lineCap: 'round', textAlign: 'left', textBaseline: 'top', dash: [2, 3] }
  const stack = []
  const texts = []
  const boxes = []
  const clips = []
  let points = []
  const point = (x, y) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), 'canvas coordinates stay finite')
    points.push({ x, y })
  }
  const bounds = () => ({ left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)) })
  const methods = {
    save: () => stack.push(structuredClone(state)),
    restore: () => { assert.ok(stack.length, 'restore has a matching save'); Object.assign(state, stack.pop()) },
    beginPath: () => { points = [] },
    moveTo: point, lineTo: point,
    quadraticCurveTo: (cx, cy, x, y) => { point(cx, cy); point(x, y) },
    rect: (x, y, width, height) => { point(x, y); point(x + width, y + height) },
    closePath() {}, stroke() {},
    clip: () => clips.push(bounds()),
    fill: () => boxes.push(bounds()),
    setLineDash: (dash) => { state.dash = [...dash] },
    measureText: (text) => ({ width: [...text].length * 7 }),
    fillText: (text, x, y) => { assert.ok(Number.isFinite(x) && Number.isFinite(y)); texts.push(text) },
  }
  const ctx = new Proxy(state, { get: (target, key) => key in methods ? methods[key] : target[key] })
  return { ctx, state, stack, texts, boxes, clips }
}

export async function checkSnapGuides(server) {
  const [{ createSnapSession, snapNodeDrag }, { drawSnapGuides }, { THEME_PROFILES }] = await Promise.all([
    '/src/features/canvas2d/lib/nodeSnapping.ts', '/src/features/canvas2d/lib/draw/snapGuides.ts', '/src/features/canvas2d/lib/themes.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const profile = THEME_PROFILES['industrial-scada']
  const node = (node_id, x, y) => ({ node_id, x, y })
  const snap = (references, delta, kind, extra = {}) => snapNodeDrag(
    createSnapSession([node(0, 0, 0), ...references], [0], 0), delta,
    { enabled: true, grid: false, alignment: false, spacing: false, [kind]: true, scale: 1, gridStep: 200, ...extra },
  ).guides
  const render = (guides, project, viewport = { width: 640, height: 520 }) => {
    const recording = canvasRecorder()
    const before = structuredClone(recording.state)
    drawSnapGuides(recording.ctx, guides, project, profile, viewport)
    assert.deepEqual(recording.state, before, 'drawing cannot leak colors, font, opacity or dashes into node rendering')
    assert.equal(recording.stack.length, 0)
    assert.deepEqual(recording.clips, [{ left: 0, top: 0, right: viewport.width, bottom: viewport.height }])
    for (const box of recording.boxes) {
      assert.ok(box.left >= 0 && box.top >= 0 && box.right <= viewport.width && box.bottom <= viewport.height, 'label backgrounds stay inside the viewport')
      for (const guide of guides) {
        // Grid endpoints are decorative; the snapped node is at their centre.
        const nodes = guide.kind === 'grid' ? [{ x: (guide.from.x + guide.to.x) / 2, y: (guide.from.y + guide.to.y) / 2 }] : [guide.from, guide.to]
        for (const endpoint of nodes) {
          const point = project(endpoint.x, endpoint.y)
          const dx = Math.max(box.left - point.x, 0, point.x - box.right)
          const dy = Math.max(box.top - point.y, 0, point.y - box.bottom)
          assert.ok(Math.hypot(dx, dy) >= 16, 'labels leave room for node numbers at reference endpoints')
        }
      }
    }
    return recording
  }

  // Use actual algorithm output so a correct label in geometry cannot silently
  // disappear or turn into screen-pixel distances at the drawing boundary.
  const alignment = snap([node(1, 100, 0), node(2, 100, 100), node(3, 100, 300)], { x: 97, y: 175 }, 'alignment')
  for (const [scale, top] of [[1, 70], [0.7, 70], [1.3, -50]]) {
    const recording = render(alignment, (x, y) => ({ x: x * scale + 120, y: y * scale + top }))
    assert.deepEqual(recording.texts, ['100 m', '75 m', '125 m'], 'all adjacent alignment distances reach fillText unchanged after zoom and partial clipping')
  }

  for (const [gridStep, expected] of [[200, '网格 200 m'], [2000, '网格 2 km']]) {
    for (const scale of [1, 0.5]) {
      const grid = snap([], { x: gridStep - 3, y: 2 * gridStep + 3 }, 'grid', { gridStep, scale })
      const project = (x, y) => ({ x: (x - gridStep) * scale + 160, y: (y - 2 * gridStep) * scale + 140 })
      assert.deepEqual(render(grid, project).texts, [expected, expected], 'grid labels show the configured world step, not the decorative crosshair length')
      const zeroLength = [{ ...grid[0], to: grid[0].from }]
      assert.deepEqual(render(zeroLength, project).texts, [expected], 'zero-length grid hints retain their distance label')
    }
  }

  const spacing = snap([node(1, 0, 0), node(2, 4000, 0)], { x: 1997, y: 3 }, 'spacing')
  for (const [scale, left] of [[0.1, 80], [0.2, -100]]) {
    assert.deepEqual(render(spacing, (x, y) => ({ x: x * scale + left, y: y * scale + 150 })).texts,
      ['2 km', '2 km'], 'equal-spacing kilometre labels survive viewport clipping without being shortened numerically')
  }

  const failed = canvasRecorder()
  const before = structuredClone(failed.state)
  assert.throws(() => drawSnapGuides(failed.ctx, alignment, () => { throw new Error('projection failed') }, profile, { width: 640, height: 520 }), /projection failed/)
  assert.deepEqual(failed.state, before, 'projection failure still restores the caller canvas state')
  assert.equal(failed.stack.length, 0)
  console.log('snap guide drawing regressions passed: generated distance labels, zoom/clipping, node clearance and canvas state restoration')
}
