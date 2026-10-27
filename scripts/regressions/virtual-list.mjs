import assert from 'node:assert/strict'

export async function checkVirtualList(server) {
  const { RowHeightIndex, virtualListRange } = await server.ssrLoadModule('/src/features/replay/lib/virtualList.ts')
  const empty = new RowHeightIndex(0, 128)
  assert.deepEqual(virtualListRange(empty, 0, 500), { start: 0, end: 0, top: 0, bottom: 0 })
  assert.equal(empty.indexAt(100), 0)
  const heights = new RowHeightIndex(5, 100)
  assert.equal(heights.total(), 500)
  assert.equal(heights.indexAt(0), 0)
  assert.equal(heights.indexAt(100), 1)
  assert.equal(heights.indexAt(500), 4)
  assert.equal(heights.indexAt(-10), 0)
  assert.equal(heights.set(1, 230), true)
  assert.equal(heights.offset(2), 330)
  assert.equal(heights.total(), 630)
  assert.equal(heights.indexAt(329), 1)
  assert.equal(heights.indexAt(330), 2)
  assert.equal(heights.set(1, 230), false)
  assert.equal(heights.set(1, 0), false)
  assert.equal(heights.set(5, 20), false)

  const count = 5000
  const values = Array.from({ length: count }, (_, index) => 36 + (index * 37 % 300))
  const measured = new RowHeightIndex(count, 128)
  values.forEach((height, index) => measured.set(index, height))
  const offsets = [0]
  for (const height of values) offsets.push(offsets.at(-1) + height)
  assert.equal(measured.total(), offsets.at(-1))
  for (let index = 0; index < count; index += 31) {
    assert.equal(measured.offset(index), offsets[index])
    assert.equal(measured.indexAt(offsets[index]), index)
    assert.equal(measured.indexAt(offsets[index + 1] - 0.01), index)
    const top = offsets[index] + values[index] / 2
    const range = virtualListRange(measured, top, 600, 6)
    assert.ok(range.start <= index)
    assert.ok(range.end > index)
    assert.ok(offsets[range.start] <= top)
    assert.ok(offsets[range.end] >= Math.min(measured.total(), top + 600))
    assert.equal(range.top + values.slice(range.start, range.end).reduce((sum, height) => sum + height, 0) + range.bottom, measured.total())
    assert.ok(range.end - range.start < 35, 'a large log mounts only a bounded window')
  }
  for (const top of [0, measured.total() - 1, measured.total() + 1000]) {
    const range = virtualListRange(measured, top, 600)
    assert.ok(range.start >= 0 && range.end <= count)
    assert.ok(range.top >= 0 && range.bottom >= 0)
  }
  const resized = new RowHeightIndex(count, 128)
  assert.equal(resized.total(), count * 128, 'width changes can discard all old measurements')
  console.log('virtual-list: prefix sums, variable heights, interval boundaries, large-list windows and reset checks passed')
}
