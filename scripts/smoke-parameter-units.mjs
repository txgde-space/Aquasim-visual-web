// Run against an existing dev service after precompilation; does not change the browser draft.
import assert from 'node:assert/strict'
const base = process.argv[2] || 'http://localhost:5173'
const spec = {
  schema: 'aqua-sim-experiment/v0', simStop: '18',
  channel: { type: 'ns3::AquaSimChannel', propagation: 'ns3::AquaSimRangePropagation' },
  stack: { phy: { type: 'ns3::AquaSimPhySimple', attrs: {} }, mac: { type: 'ns3::AquaSimBroadcastMac', attrs: {} }, routing: { type: 'ns3::AquaSimStaticRouting' } },
  protocolAttributes: { 'ns3::AquaSimPhySimple': { DataRate: '0.2kbit/s', RxProcessingDelay: '300ms', transRange: '4.5km', Frequency: '25000Hz', rxPower: '395mW' } },
  traffic: { preset: 'none' },
  nodes: [
    { id: 1, name: 'A', x: -4500, y: 0, z: 0, role: 'node', app: 'ns3::AquaSimTrafficGen', appAttrs: { Delay: '10000ms', StartTime: '0', PacketSize: '26' }, appDestination: 3 },
    { id: 2, name: 'B', x: 1500, y: 0, z: 0, role: 'node', app: 'ns3::AquaSimTrafficGen', appAttrs: { Delay: '10000ms', StartTime: '0', PacketSize: '26' }, appDestination: 3 },
    { id: 3, name: 'Sink', x: 0, y: 0, z: 0, role: 'sink', app: '' },
  ],
}
const post = async (input) => (await fetch(new URL('/api/run', base), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(600000),
})).json()
const result = await post(spec)
assert.equal(result.ok, true, result.error || result.stdout)
const log = JSON.parse(result.log)
assert.equal(log.packets.length, 2)
for (const packet of log.packets) {
  assert.equal(packet.tx_start_us, 10000000)
  assert.equal(packet.tx_duration_us, 1600000)
  const rx = packet.receivers.find((entry) => entry.dst === 3)
  assert.equal(rx.status, 'ok')
  assert.equal(rx.rx_start_us, packet.src === 1 ? 13000000 : 11000000)
  assert.equal(rx.rx_processing_duration_us, 300000)
}
const invalid = structuredClone(spec)
invalid.protocolAttributes['ns3::AquaSimPhySimple'].transRange = '5s'
const rejected = await post(invalid)
assert.equal(rejected.ok, false)
assert.match(rejected.error || rejected.stdout, /transRange/)
console.log('Unit simulation passed: bare seconds, ms, km, kbit/s, Hz and mW; wrong dimensions rejected.')
