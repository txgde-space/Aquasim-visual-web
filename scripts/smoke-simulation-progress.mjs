// Run against an existing Vite dev service; never starts a server.
import assert from 'node:assert/strict'
const base = process.argv[2] || 'http://localhost:5173'
const aquaSimHome = process.argv[3] || ''
const makeSpec = delay => ({
  schema: 'aqua-sim-experiment/v0', simStop: '19s', traffic: { preset: 'none' },
  channel: { type: 'ns3::AquaSimChannel', propagation: 'ns3::AquaSimRangePropagation' },
  stack: { phy: { type: 'ns3::AquaSimPhySimple' }, mac: { type: 'ns3::AquaSimBroadcastMac' }, routing: { type: 'ns3::AquaSimStaticRouting' } },
  protocolAttributes: { 'ns3::AquaSimPhySimple': { DataRate: '1kbps', transRange: '600' } },
  nodes: [
    { id: 1, x: 0, y: 0, z: 0, app: 'ns3::AquaSimTrafficGen', appAttrs: { Delay: delay, PacketSize: '40' }, appDestination: 2 },
    { id: 2, x: 500, y: 0, z: 0, app: '' },
  ],
})
const run = async spec => {
  const response = await fetch(new URL('/api/run', base), { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec, aquaSimHome }), signal: AbortSignal.timeout(120_000) })
  return { status: response.status, body: await response.json() }
}
const stopped = await run(makeSpec('0'))
assert.equal(stopped.status, 500)
assert.equal(stopped.body.ok, false)
assert.match(stopped.body.stdout, /仿真时间未推进/)
assert.match(stopped.body.stdout, /100000/)
assert.match(stopped.body.stdout, /重复产包间隔应大于 0/)
assert.ok(!stopped.body.log, 'a stopped run cannot masquerade as successful playback')
console.log('Simulation progress passed: real zero-interval loop stops with an explicit diagnostic')
const normal = await run(makeSpec('10'))
assert.equal(normal.status, 200, normal.body.error || normal.body.stdout)
assert.equal(normal.body.ok, true)
const log = JSON.parse(normal.body.log)
assert.equal(log.packets.length, 1)
assert.equal(log.packets[0].tx_start_us, 10_000_000)
assert.ok(log.packets[0].receivers.some(rx => rx.dst === 2 && rx.status === 'ok'))
console.log('Simulation progress passed: lock is released and ordinary timing/reception are preserved')
