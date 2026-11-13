// Optional integration smoke against an already running dev service and real ns-3.
import assert from 'node:assert/strict'
const base = process.argv[2] || 'http://localhost:5173'
const post = async (route, body) => {
  const response = await fetch(new URL(route, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(600_000) })
  return { status: response.status, body: await response.json() }
}
const catalog = await post('/api/simulator/check', {})
const vbf = catalog.body.catalog?.find(layer => layer.id === 'routing')?.items.find(item => item.typeId === 'ns3::AquaSimVBF')
assert.ok(vbf, 'precompile first: VBF must come from the actual TypeId probe')
for (const key of ['HopByHop', 'EnableRouting', 'Width', 'TargetPos']) assert.ok(vbf.attributes.some(attr => attr.name === key))
const makeSpec = (y, width) => ({
  schema: 'aqua-sim-experiment/v0', simStop: '19s',
  channel: { type: 'ns3::AquaSimChannel', propagation: 'ns3::AquaSimRangePropagation' },
  stack: { phy: { type: 'ns3::AquaSimPhyCmn', attrs: {} }, mac: { type: 'ns3::AquaSimBroadcastMac', attrs: {} }, routing: { type: 'ns3::AquaSimVBF' } },
  protocolAttributes: { 'ns3::AquaSimVBF': { Width: String(width), TargetPos: '-500:100:0' }, 'ns3::AquaSimPhyCmn': { transRange: '600' } },
  traffic: { preset: 'none' },
  nodes: [
    { id: 1, name: 'source', x: -1500, y: 100, z: 0, role: 'node', app: 'ns3::AquaSimTrafficGen', appAttrs: { Delay: '10', PacketSize: '40' }, appDestination: 3 },
    { id: 2, name: 'relay', x: -1000, y, z: 0, role: 'node', app: '' },
    { id: 3, name: 'sink', x: -500, y: 100, z: 0, role: 'node', app: '' },
  ],
})
for (const [label, y, width, shouldForward] of [['signed coordinates / multihop', 100, 100, true], ['outside forwarding pipe', 300, 100, false], ['wider pipe', 300, 300, true]]) {
  const result = await post('/api/run', makeSpec(y, width))
  assert.ok(result.body.ok, `${label}: ${result.body.error || result.body.stdout}`)
  const log = JSON.parse(result.body.log)
  assert.equal(log.packets.some(packet => packet.src === 1 && packet.receivers.some(rx => rx.dst === 2 && rx.status === 'ok')), true, `${label}: relay physically received the source`)
  assert.equal(log.packets.some(packet => packet.src === 2 && packet.receivers.some(rx => rx.dst === 3 && rx.status === 'ok')), shouldForward, label)
  assert.equal(/ROUTE-3 pktNum:1/.test(result.body.stdout), shouldForward, `${label}: actual routing delivery`)
  assert.equal(log.nodes[0].x, -1500, 'true coordinates are retained')
  assert.doesNotMatch(result.body.stdout, /ERROR_BADF|packet send failed/)
  console.log(`VBF real simulation passed: ${label}`)
}
const invalid = await post('/api/run', makeSpec(100, 0))
assert.equal(invalid.body.ok, false)
assert.match(invalid.body.stdout || invalid.body.error, /AquaSimVBF\.Width/)
console.log('VBF real simulation passed: registered width checker rejects zero')
