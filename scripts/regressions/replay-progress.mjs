import assert from 'node:assert/strict'
import { effectScope, nextTick, ref, shallowRef } from 'vue'

export async function checkPacketListProgress(server) {
  const { usePacketListProgress } = await server.ssrLoadModule('/src/features/replay/composables/usePacketListProgress.ts')
  const packets = ref(Array.from({ length: 5000 }, (_, i) => ({ eventId: `p-${i}`, startUs: i * 10, endUs: i * 10 + 5 })))
  let visited = 0
  const makeRows = () => packets.value.map((packet) => {
    const classes = new Set()
    const band = { style: { transform: '' } }
    return {
      dataset: { eventId: packet.eventId }, band, classes,
      querySelector: () => band,
      classList: { toggle(name, enabled) { visited++; if (enabled) classes.add(name); else classes.delete(name) } },
    }
  })
  let rows = makeRows()
  const list = shallowRef({ querySelectorAll: () => rows })
  const time = ref(102), active = ref(true), focus = ref(null), edit = ref(false)
  const scope = effectScope()
  scope.run(() => usePacketListProgress({ list, getPackets: () => packets.value, getTime: () => time.value,
    isActive: () => active.value, getFocus: () => focus.value, isEditMode: () => edit.value }))
  try {
    await nextTick()
    assert.equal(rows[10].band.style.transform, 'scaleX(0.4)')
    assert.equal(rows[10].classes.has('log-item-active'), true)
    visited = 0
    time.value = 103
    await nextTick()
    assert.equal(rows[10].band.style.transform, 'scaleX(0.6)')
    assert.ok(visited <= 2, 'a normal clock tick must not touch 5000 DOM rows')
    time.value = 501
    await nextTick()
    assert.equal(rows[10].band.style.transform, 'scaleX(1)')
    assert.equal(rows[10].classes.has('log-item-active'), false)
    assert.equal(rows[20].band.style.transform, 'scaleX(1)', 'short events skipped between frames still finish')
    time.value = 102
    await nextTick()
    assert.equal(rows[20].band.style.transform, 'scaleX(0)', 'backward seeks reset crossed events')
    active.value = false
    await nextTick()
    focus.value = 'p-10'
    rows[10].classes.clear() // Vue rewrites the focus class while the dock is closed.
    await nextTick()
    active.value = true
    await nextTick()
    assert.equal(rows[10].classes.has('log-item-active'), true, 'reopening restores active state even without a time change')
    active.value = false
    await nextTick()
    time.value = 503
    await nextTick()
    assert.equal(rows[10].band.style.transform, 'scaleX(0.4)', 'closed panels do not update progress DOM')
    active.value = true
    await nextTick()
    assert.equal(rows[50].band.style.transform, 'scaleX(0.6)')
    // Switching to lifecycle removes the global list; returning mounts fresh rows.
    list.value = null
    await nextTick()
    rows = makeRows()
    list.value = { querySelectorAll: () => rows }
    await nextTick()
    assert.equal(rows[50].band.style.transform, 'scaleX(0.6)')
    packets.value = [{ eventId: 'p-50', startUs: 500, endUs: 510 }]
    rows = makeRows()
    await nextTick()
    assert.equal(rows[0].band.style.transform, 'scaleX(0.3)', 'same-ID log replacement rebuilds the element and interval index')
    scope.stop()
    time.value = 510
    await nextTick()
    assert.equal(rows[0].band.style.transform, 'scaleX(0.3)', 'unmount stops DOM writes')
  } finally { scope.stop() }
  console.log('Replay log progress: differential DOM updates, backwards seeks, hidden dock, remount and replacement checks passed')
}
