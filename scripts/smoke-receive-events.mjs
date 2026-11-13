// Real simulations through an existing dev service; does not start a server.
import assert from 'node:assert/strict'
const base = process.argv[2] || 'http://localhost:5173'
const aquaSimHome = process.argv[3] || ''
const node = (id, x, app = '') => ({ id, x, y: 0, z: 0, role: 'node', app,
  ...(app ? { appDestination: 3, appAttrs: { Delay: '10', PacketSize: '40' } } : {}) })
const specFor = (phy = 'ns3::AquaSimPhySimple') => ({
  schema: 'aqua-sim-experiment/v0', simStop: '19s', traffic: { preset: 'none' },
  channel: { type: 'ns3::AquaSimChannel', propagation: 'ns3::AquaSimRangePropagation' },
  stack: { phy: { type: phy }, mac: { type: 'ns3::AquaSimBroadcastMac' }, routing: { type: 'ns3::AquaSimStaticRouting' } },
  protocolAttributes: { [phy]: { transRange: '600', ...(phy === 'ns3::AquaSimPhyCmn' ? {} : { DataRate: '1kbps' }) } },
  nodes: [node(1, -500, 'ns3::AquaSimTrafficGen'), node(2, 500, 'ns3::AquaSimTrafficGen'), node(3, 0)],
})
const run = async (spec, label) => {
  const response = await fetch(new URL('/api/run', base), { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spec, aquaSimHome }),
    signal: AbortSignal.timeout(600_000) })
  const result = await response.json()
  assert.ok(result.ok, `${label}: ${result.error || result.stdout}`)
  const log = JSON.parse(result.log)
  return { log, sink: log.packets.flatMap(p => p.receivers.filter(rx => rx.dst === 3)) }
}
for (const phy of ['ns3::AquaSimPhySimple', 'ns3::AquaSimPhyCmn']) {
  const { log, sink } = await run(specFor(phy), phy)
  assert.equal(log.meta.trace_scope, 'phy-events')
  assert.equal(sink.length, 2)
  assert.ok(sink.every(rx => rx.status === 'fail' && rx.reason === 'collision_rx_rx'
    && rx.collision_start_us >= rx.rx_start_us && rx.rx_drop_us >= rx.collision_start_us))
  console.log(`Receive events passed: native collision/cache drops through ${phy}`)
}
const sinr = specFor()
sinr.nodes.splice(1, 1)
sinr.protocolAttributes[sinr.stack.phy.type].SignalCache = 'ns3::AquaVisualSignalCacheSINR[]'
const observed = await run(sinr, 'observable SINR cache')
assert.equal(observed.log.meta.trace_scope, 'phy-events')
assert.equal(observed.sink.length, 1)
assert.equal(observed.sink[0].status, 'ok')
const native = structuredClone(sinr)
native.protocolAttributes[native.stack.phy.type].SignalCache = 'ns3::AquaSimSignalCacheSINR[]'
const original = await run(native, 'explicit native cache')
assert.equal(original.log.meta.trace_scope, 'phy-success', 'explicit cache is retained, never silently replaced')
assert.equal(original.sink[0].status, 'ok')
assert.equal(original.sink[0].rx_start_us, observed.sink[0].rx_start_us)
assert.equal(original.sink[0].rx_duration_us, observed.sink[0].rx_duration_us)
console.log('Receive events passed: SINR observation preserves timing, explicit native cache keeps legacy fallback')
const radio = specFor('ns3::AquaSimRadioPhy')
radio.channel = { type: 'ns3::AquaSimRadioChannel', propagation: 'ns3::AquaSimRadioPropagation' }
const medium = await run(radio, 'radio shared event interface')
assert.equal(medium.log.meta.trace_scope, 'phy-events')
assert.equal(medium.sink.length, 2)
assert.ok(medium.sink.every(rx => rx.status === 'fail' && rx.reason === 'collision_rx_rx'
  && Number.isFinite(rx.collision_start_us) && Number.isFinite(rx.rx_drop_us)))
console.log('Receive events passed: radio uses the same optional trace interface')
const partial = specFor(); partial.nodes.splice(1, 1); partial.simStop = '10.5s'
const unfinished = await run(partial, 'simulation ends during reception')
assert.equal(unfinished.sink.length, 1)
assert.equal(unfinished.sink[0].reason, 'reception_incomplete')
assert.equal(unfinished.sink[0].collision_start_us, undefined)
assert.equal(unfinished.sink[0].rx_drop_us, undefined)
console.log('Receive events passed: unfinished reception has no fabricated collision or drop')
