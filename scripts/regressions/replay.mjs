import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { effectScope, ref } from 'vue'
import { checkReplayFrameState } from './replay-frame-state.mjs'
import { checkPacketListProgress } from './replay-progress.mjs'
import { checkReplayScheduling } from './replay-scheduling.mjs'

export async function checkReplay(server, root) {
const load = (file) => server.ssrLoadModule(`/${file}`)
const parser = await load('src/features/replay/lib/logParser.ts')
const normalize = await load('src/features/replay/lib/logNormalize.ts')
const merge = await load('src/features/replay/lib/logMerge.ts')
const safety = await load('src/shared/logSafety.ts')
const baseline = JSON.parse(fs.readFileSync(new URL('./replay-baseline.json', import.meta.url), 'utf8'))
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const results = []
function test(name, run) {
  run()
  results.push(name)
}

const samples = fs.readdirSync(path.join(root, 'src/assets')).filter((name) => /\.(json|log)$/.test(name)).sort()
test('all existing samples preserve their recorded parser, packet and merge semantics', () => {
  const currentLogs = []
  for (const sample of samples) {
    const raw = fs.readFileSync(path.join(root, 'src/assets', sample), 'utf8')
    const parsed = parser.parseLog(raw)
    assert.equal(hash([parsed, merge.normalizePacketsFromParsed(parsed, sample)]), baseline[sample], `${sample}: frozen parser and packet semantics`)
    currentLogs.push(parsed)
  }
  assert.equal(hash(merge.mergeParsedNodeLogs(currentLogs, samples)), baseline.merged)
})

test('capping frozen inputs keeps all source arrays intact and preserves extension fields', () => {
  const input = { ...parser.createEmptyParsedLog(), extension: 'kept' }
  input.nodes = Array.from({ length: 4001 }, () => ({ node_id: 1 }))
  for (const key of ['packets', 'movements', 'nodeEvents', 'tx', 'rx']) input[key] = Array.from({ length: 30001 }, () => ({}))
  input.parseErrors = Array.from({ length: 51 }, () => '<unsafe>')
  Object.values(input).filter(Array.isArray).forEach(Object.freeze)
  Object.freeze(input)
  const result = safety.capParsedLog(input)
  assert.equal(result.nodes.length, 4000)
  assert.equal(input.nodes.length, 4001)
  for (const key of ['packets', 'movements', 'nodeEvents', 'tx', 'rx']) {
    assert.equal(result[key].length, 30000)
    assert.equal(input[key].length, 30001)
    assert.notEqual(result[key], input[key])
  }
  assert.equal(result.parseErrors.length, 50)
  assert.equal(input.parseErrors[0], '<unsafe>')
  assert.equal(result.parseErrors[0], 'unsafe')
  assert.equal(result.extension, 'kept')
})

test('150000 packet rows and 150000 TX events merge without argument stack overflow', () => {
  const packetLog = parser.createEmptyParsedLog()
  packetLog.packets = Array.from({ length: 30000 }, (_, i) => ({ type: 'packet', packet_id: `p${i}`, src: 0, tx_end_us: i + 1, receivers: [] }))
  const mergedPackets = merge.mergeParsedNodeLogs(Array.from({ length: 5 }, () => packetLog))
  assert.equal(mergedPackets.packets.length, 30000)
  assert.equal(mergedPackets.meta.sim_end_us, 30000)
  assert.equal(packetLog.packets.length, 30000)
  const txLog = parser.createEmptyParsedLog()
  txLog.nodeEvents = Array.from({ length: 30000 }, (_, i) => ({ type: 'tx_start', packet_id: `p${i}`, src: 0, time_us: i, duration_us: 1 }))
  const mergedTx = merge.mergeParsedNodeLogs(Array.from({ length: 5 }, () => txLog))
  assert.equal(mergedTx.packets.length, 30000)
  assert.equal(mergedTx.meta.sim_end_us, 30000)
})

test('150000 receivers normalize and merge without argument stack overflow', () => {
  const receivers = Array.from({ length: 150000 }, (_, i) => ({ dst: 1, status: 'ok', rx_start_us: i, rx_duration_us: 1 }))
  const packet = { type: 'packet', src: 0, tx_start_us: 0, tx_duration_us: 1, receivers }
  assert.equal(normalize.normalizePacket(packet, 0).timeEnd, 150000)
  const parsed = parser.createEmptyParsedLog()
  parsed.packets = [packet]
  assert.equal(merge.mergeParsedNodeLogs([parsed]).meta.sim_end_us, 150000)
})

test('RX matching preserves exact IDs, first equal-time TX, nearest preceding TX and fallback', () => {
  const parsed = parser.createEmptyParsedLog()
  parsed.nodeEvents = [
    { type: 'tx_start', packet_id: 'p', event_id: 'a', src: 0, time_us: 1, duration_us: 1 },
    { type: 'tx_start', packet_id: 'p', event_id: 'b', src: 0, time_us: 1, duration_us: 1 },
    { type: 'tx_start', packet_id: 'p', event_id: 'c', src: 0, time_us: 3, duration_us: 1 },
    { type: 'rx_success', packet_id: 'p', dst: 1, time_us: 2 },
    { type: 'rx_success', packet_id: 'p', dst: 2, time_us: 4 },
    { type: 'rx_success', packet_id: 'p', dst: 3, time_us: 0 },
    { type: 'rx_success', packet_id: 'p', tx_id: 'b', dst: 4, time_us: 4 },
    { type: 'rx_success', packet_id: 'missing', dst: 5, time_us: 2 },
  ]
  const result = merge.mergeParsedNodeLogs([parsed])
  assert.deepEqual(result.packets.map((packet) => packet.receivers.map((receiver) => receiver.dst)), [[3, 1], [4], [2]])
  assert.ok(result.parseErrors.some((error) => error.includes('missing')))
})

const { useReplayState } = await load('src/features/replay/composables/useReplayState.ts')
const { useLogImport } = await load('src/features/replay/composables/useLogImport.ts')
function setup() {
  const scope = effectScope()
  const state = scope.run(() => useReplayState({ playback: { currentTime: ref(0), isPlaying: ref(false), focusedPacketId: ref(null) } }))
  const imports = scope.run(() => useLogImport({ state, applyParsedLog: (parsed) => state.applyParsedLog(parsed) }))
  return { scope, state, imports }
}
const coords = (nodes) => nodes.map(({ x, y, z }) => ({ x, y, z }))
const rawFor = (x) => JSON.stringify({ nodes: [{ node_id: 0, x: 0, y: 0, z: 0 }, { node_id: 1, x, y: 0, z: 0 }] })

test('real coordinates persist through topology, imported logs and absolute movement start', () => {
  const { scope, state } = setup()
  const parsed = parser.parseLog(JSON.stringify({
    nodes: [{ node_id: 0, x: 0, y: 0, z: 0 }, { node_id: 1, x: 100, y: 0, z: 0 }],
    movements: [{ node_id: 1, start_us: 1000000, end_us: 2000000, from_x: 100, from_y: 0, from_z: 0, to_x: 200, to_y: 0, to_z: 0 }],
  }))
  state.applyParsedLog(parsed)
  assert.deepEqual(coords(state.baseNodesState.value), coords(parsed.nodes))
  assert.equal(normalize.resolveMovingNodes(state.baseNodesState.value, state.nodeMovementRows.value, 999999)[1].x, 100)
  assert.equal(normalize.resolveMovingNodes(state.baseNodesState.value, state.nodeMovementRows.value, 1000000)[1].x, 100)
  state.applyTopology(parsed.nodes)
  assert.deepEqual(coords(state.baseNodesState.value), coords(parsed.nodes))
  assert.equal(state.nodeMovementRows.value.length, 0)
  assert.equal(state.sourcePacketRows.value.length, 0)
  scope.stop()
})

test('failed normalization leaves current replay intact', () => {
  const { scope, state } = setup()
  const before = JSON.stringify(state.baseNodesState.value)
  const invalid = parser.createEmptyParsedLog()
  invalid.packets = [{ type: 'packet', src: 0, receivers: [null] }]
  assert.throws(() => state.applyParsedLog(invalid))
  assert.equal(JSON.stringify(state.baseNodesState.value), before)
  scope.stop()
})

const file = (name, text) => ({ name, size: 100, text: typeof text === 'function' ? text : async () => text })
const event = (...files) => ({ target: { value: 'selected', files } })
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

async function asyncTest(name, run) {
  await run()
  results.push(name)
}
await asyncTest('latest import wins; older completion and failure cannot overwrite it', async () => {
  const { scope, state, imports } = setup()
  const first = deferred()
  const oldImport = imports.onLogFileChange(event(file('old.log', () => first.promise)))
  await imports.onLogFileChange(event(file('new.log', rawFor(200))))
  first.resolve(rawFor(100))
  await oldImport
  assert.equal(state.baseNodesState.value[1].x, 200)
  assert.equal(state.uploadedLogName.value, 'new.log')
  const failed = deferred()
  const failedImport = imports.onLogFileChange(event(file('failed.log', () => failed.promise)))
  await imports.onLogFileChange(event(file('latest.log', rawFor(300))))
  failed.reject(new Error('old read failed'))
  await failedImport
  assert.equal(state.baseNodesState.value[1].x, 300)
  assert.deepEqual([...state.parseErrors.value], [])
  scope.stop()
})
await asyncTest('sample switch and scope disposal invalidate pending imports', async () => {
  const { scope, state, imports } = setup()
  const pending = deferred()
  const importing = imports.onNodeLogFilesChange(event(file('pending.log', () => pending.promise)))
  imports.loadSampleLog('moving')
  const sampleNodes = JSON.stringify(state.baseNodesState.value)
  pending.resolve(rawFor(123))
  await importing
  assert.equal(state.logSourceKey.value, 'moving')
  assert.equal(JSON.stringify(state.baseNodesState.value), sampleNodes)
  const unmounted = deferred()
  const unmountedImport = imports.onLogFileChange(event(file('unmounted.log', () => unmounted.promise)))
  scope.stop()
  unmounted.resolve(rawFor(456))
  await unmountedImport
  assert.equal(state.logSourceKey.value, 'moving')
  assert.equal(JSON.stringify(state.baseNodesState.value), sampleNodes)
})
await asyncTest('read and normalization failures report errors and preserve replay/source metadata', async () => {
  const { scope, state, imports } = setup()
  await imports.onLogFileChange(event(file('good.log', rawFor(777))))
  await imports.onLogFileChange(event(file('bad.log', async () => { throw new Error('unreadable') })))
  assert.match(state.parseErrors.value[0], /unreadable/)
  assert.equal(state.uploadedLogName.value, 'good.log')
  assert.equal(state.baseNodesState.value[1].x, 777)
  await imports.onLogFileChange(event(file('bad-data.log', JSON.stringify({ packets: [{ src: 0, receivers: [null] }] }))))
  assert.ok(state.parseErrors.value[0].startsWith('导入失败'))
  assert.equal(state.uploadedLogName.value, 'good.log')
  assert.equal(state.baseNodesState.value[1].x, 777)
  assert.equal(state.logSourceKey.value, 'upload')
  scope.stop()
})

console.log(`Replay regressions passed: ${results.length} groups, ${samples.length} legacy samples, large logs and import races.`)
await checkReplayFrameState(server, root)
await checkPacketListProgress(server)
await checkReplayScheduling(server)

}
