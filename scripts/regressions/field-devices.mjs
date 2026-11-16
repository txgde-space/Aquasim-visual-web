import assert from 'node:assert/strict'
import { createRenderer } from 'vue'

export async function checkFieldDevices(server) {
  const { readSerialPreferences, utcLabel, serialPreferenceError } = await server.ssrLoadModule('/src/features/field/lib/devices.ts')
  const defaults = readSerialPreferences(null)
  assert.equal(defaults.gps.baudRate, 9600)
  assert.equal(defaults.atomic.baudRate, 57600)
  assert.equal(readSerialPreferences('{invalid').gps.port, '')
  assert.equal(readSerialPreferences(JSON.stringify({ gps: { ...defaults.gps, baudRate: -1 } })).gps.baudRate, 9600)
  assert.match(serialPreferenceError(defaults.gps), /串口/)
  assert.match(serialPreferenceError({ ...defaults.gps, port: '/dev/ttyUSB0', stopBits: 1.5 }), /停止位/)
  assert.match(serialPreferenceError({ ...defaults.gps, port: '/dev/ttyUSB0', baudRate: 50 }), /波特率/)
  assert.equal(utcLabel('2026-11-16T12:34:56+08:00'), '2026-11-16 04:34:56.000')
  assert.equal(utcLabel('not-a-time'), '—')
  const { useFieldDevices } = await server.ssrLoadModule('/src/features/field/useFieldDevices.ts')
  const fetchBefore = globalThis.fetch, setBefore = globalThis.setTimeout, clearBefore = globalThis.clearTimeout
  const storageBefore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const timers = new Map(), requests = [], storageWrites = [], apps = new Set()
  let id = 0
  const renderer = createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
  const mount = () => {
    let state
    const app = renderer.createApp({ setup() { state = useFieldDevices(); return () => null } })
    app.mount({}); apps.add(app)
    return { state, unmount() { app.unmount(); apps.delete(app) } }
  }
  const flush = () => new Promise(resolve => setImmediate(resolve))
  const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  const valid = { ok: true, systemTime: '2026-11-16T12:00:00Z', gps: { connected: false }, atomic: { connected: false } }
  globalThis.fetch = (url, init) => new Promise((resolve, reject) => requests.push({ url, init, resolve, reject }))
  globalThis.setTimeout = (callback, ms) => { timers.set(++id, { callback, ms }); return id }
  globalThis.clearTimeout = timer => timers.delete(timer)
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => JSON.stringify({ gps: { ...defaults.gps, port: '/dev/ttyUSB0' }, atomic: defaults.atomic }),
    setItem: (key, value) => storageWrites.push([key, value]),
  } })
  try {
    const page = mount()
    assert.equal(requests.length, 1, 'mount only reads status; saved settings never connect hardware')
    assert.equal(requests[0].url, '/api/field/status')
    page.state.refresh(); page.state.refresh()
    assert.equal(requests.length, 1, 'polls do not overlap')
    requests[0].resolve(response(valid)); await flush()
    assert.equal(page.state.status.value.systemTime, valid.systemTime)
    assert.equal(page.state.statusStale.value, false)
    const scheduled = [...timers.values()].find(timer => timer.ms === 1000)
    assert.ok(scheduled)
    scheduled.callback(); await flush()
    const oldRequest = requests.at(-1)
    page.state.connect('gps')
    assert.equal(oldRequest.init.signal.aborted, true, 'connect invalidates old device snapshots')
    const connecting = requests.at(-1)
    assert.equal(connecting.url, '/api/field/connect')
    assert.equal(JSON.parse(connecting.init.body).port, '/dev/ttyUSB0')
    oldRequest.resolve(response({ ...valid, gps: { connected: true, port: '/wrong' } })); await flush()
    assert.equal(page.state.status.value.gps.connected, false, 'late pre-mutation state cannot overwrite the panel')
    connecting.resolve(response({ ok: true })); await flush()
    assert.ok(storageWrites.every(([key]) => key === 'aquasim_field_devices'), 'settings never write simulation/replay preferences')
    const latest = requests.at(-1)
    assert.equal(latest.url, '/api/field/status')
    page.unmount()
    assert.equal(latest.init.signal.aborted, true)
    latest.resolve(response({ ...valid, gps: { connected: true } })); await flush()
    assert.equal(page.state.status.value.gps.connected, false, 'unmounted field page ignores late telemetry')
    assert.equal(timers.size, 0, 'leaving the field page stops all polling and timeout timers')
    assert.equal(requests.filter(request => request.url.endsWith('/disconnect')).length, 0, 'route changes do not silently disconnect hardware')

    const unsupported = mount()
    requests.at(-1).resolve(new Response('<html>dev fallback</html>', { headers: { 'Content-Type': 'text/html' } })); await flush()
    assert.match(unsupported.state.serviceError.value, /Go 服务/)
    assert.equal(unsupported.state.status.value, null, 'missing backend never fabricates device or system time')
    unsupported.unmount()
  } finally {
    apps.forEach(app => app.unmount())
    globalThis.fetch = fetchBefore; globalThis.setTimeout = setBefore; globalThis.clearTimeout = clearBefore
    if (storageBefore) Object.defineProperty(globalThis, 'localStorage', storageBefore)
    else delete globalThis.localStorage
  }
  console.log('Field device regressions passed: no autoconnect, isolated preferences, UTC, nonoverlapping polls, mutation races, unmount cleanup and missing-service reporting.')
}
