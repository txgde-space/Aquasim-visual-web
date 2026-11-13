// Real ns-3 validation against the user's existing Vite service. Starts no server.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const base = process.argv[2] || 'http://localhost:5173'
const aquaSimHome = process.argv[3] || ''
const LINEAR = 'ns3::AquaVisualLinearMobilityModel'
const PHY = 'ns3::AquaSimPhySimple'
const post = async (route, body) => {
  const response = await fetch(new URL(route, base), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, aquaSimHome }), signal: AbortSignal.timeout(600_000),
  })
  return { status: response.status, data: await response.json() }
}
const close = (actual, expected, label, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} != ${expected}`)
const run = async (spec, label) => {
  const { status, data } = await post('/api/run', { spec })
  assert.equal(status, 200, `${label}: ${data.error || data.stdout}`)
  assert.equal(data.ok, true, data.stdout)
  return JSON.parse(data.log)
}
const node = (id, x, y = 0, z = -50) => ({ id, name: `Node-${id}`, role: 'node', modelType: 'auv', x, y, z, app: '' })
const makeSpec = () => ({
  schema: 'aqua-sim-experiment/v0', simStop: '16s', traffic: { preset: 'none' },
  channel: { type: 'ns3::AquaSimChannel', propagation: 'ns3::AquaSimRangePropagation' },
  stack: { phy: { type: PHY, attrs: {} }, mac: { type: 'ns3::AquaSimBroadcastMac', attrs: {} }, routing: { type: 'ns3::AquaSimStaticRouting' } },
  protocolAttributes: { [PHY]: { DataRate: '200bps', transRange: '250m', RxProcessingDelay: '0ms' } },
  nodes: [node(1, 0), node(2, 100)],
})

const checked = await post('/api/simulator/check', {})
const mobility = checked.data.catalog?.find((layer) => layer.id === 'mobility')
assert.ok(mobility?.items.length, 'precompile first: mobility choices must come from the real TypeId probe')
const linear = mobility.items.find((item) => item.typeId === LINEAR)
assert.ok(linear, 'registered editable linear model is discovered without a frontend whitelist')
const initialVelocity = linear.attributes.find((attr) => attr.name === 'InitialVelocity')
assert.equal(initialVelocity.valueType, 'ns3::Vector3DValue')
assert.ok(initialVelocity.constructible && initialVelocity.writable)
assert.match(initialVelocity.help, /m\/s/)

const onlyMovement = makeSpec()
onlyMovement.simStop = '12s'
onlyMovement.nodes[0] = { ...node(1, -500, -250, -80), mobility: { type: LINEAR }, protocolAttributes: { [LINEAR]: { InitialVelocity: '30m/s:10m/s:1m/s' } } }
const trajectory = await run(onlyMovement, 'movement without traffic')
assert.equal(trajectory.packets.length, 0)
assert.ok(trajectory.movements.length > 0)
const end = trajectory.movements.filter((row) => row.node_id === 1).at(-1)
close(end.end_us, 12e6, 'trajectory includes the exact simulation stop')
close(end.to_x, -140, 'actual X displacement')
close(end.to_y, -130, 'actual Y displacement')
close(end.to_z, -68, 'actual vertical displacement')
assert.ok(!trajectory.movements.some((row) => row.node_id === 2), 'legacy nodes remain fixed')
assert.equal(trajectory.nodes[0].mobility.type, LINEAR)
assert.equal(trajectory.nodes[0].protocolAttributes[LINEAR].InitialVelocity, '30m/s:10m/s:1m/s')
console.log('Mobility passed: real per-node 3-axis motion, fixed-node compatibility, movement-only replay and metadata persistence.')

const communication = makeSpec()
communication.nodes[0] = { ...communication.nodes[0], app: 'ns3::AquaSimTrafficGen', appAttrs: { Delay: '5', PacketSize: '40' }, appDestination: 2 }
communication.nodes[1] = { ...communication.nodes[1], name: 'Moving receiver', mobility: { type: LINEAR }, protocolAttributes: { [LINEAR]: { InitialVelocity: '0.02km/s:0:0' } } }
const movingReceiver = await run(communication, 'moving receiver changes propagation and range')
const first = movingReceiver.packets.find((packet) => packet.src === 1 && Math.abs(packet.tx_start_us - 5e6) < 1)
assert.ok(first)
const reception = first.receivers.find((receiver) => receiver.dst === 2)
assert.ok(reception && reception.status === 'ok', 'receiver is still within range for the first transmission')
close(reception.rx_start_us - first.tx_start_us, 200 / 1500 * 1e6, 'propagation uses actual moved position', .01)
const later = movingReceiver.packets.filter((packet) => packet.src === 1 && packet.tx_start_us >= 10e6)
assert.ok(later.length > 0)
assert.ok(later.every((packet) => !packet.receivers.some((receiver) => receiver.dst === 2)), 'out-of-range receiver has no invented reception')
console.log('Mobility passed: actual movement changes propagation delay and range; vector speed units are converted.')

const randomModel = mobility.items.find((item) => item.typeId === 'ns3::RandomWalk2dMobilityModel')
assert.ok(randomModel, 'a standard ns-3 model is discovered through the same interface')
const randomSpec = makeSpec()
randomSpec.simStop = '3.2s'
randomSpec.nodes[0] = { ...node(1, 500, 500), mobility: { type: randomModel.typeId }, protocolAttributes: { [randomModel.typeId]: {
  Bounds: '0|1000|0|1000', Speed: 'ns3::ConstantRandomVariable[Constant=3]', Time: '1s', Mode: 'Time',
} } }
const randomLog = await run(randomSpec, 'standard registered random walk')
assert.ok(randomLog.movements.length >= 3, 'actual direction changes are observed')
assert.ok(randomLog.movements.every((row) => row.from_x >= 0 && row.to_x <= 1000 && row.from_y >= 0 && row.to_y <= 1000))
console.log('Mobility passed: standard random walk and its registered pointer/time/bounds attributes use the same factory.')

for (const [label, change] of [
  ['unknown model', (spec) => { spec.nodes[0].mobility.type = 'ns3::MissingMobilityModel' }],
  ['managed position', (spec) => { spec.nodes[0].protocolAttributes[LINEAR].Position = '1:2:3' }],
  ['invalid speed units', (spec) => { spec.nodes[0].protocolAttributes[LINEAR].InitialVelocity = '1kg:0:0' }],
]) {
  const invalid = structuredClone(onlyMovement)
  change(invalid)
  const result = await post('/api/run', { spec: invalid })
  assert.equal(result.data.ok, false, label)
  assert.ok(!result.data.log, `${label} cannot silently run with a replacement or ignored value`)
}
const output = path.join(tmpdir(), 'aquasim-node-mobility-smoke')
writeFileSync(`${output}-spec.json`, JSON.stringify(communication, null, 2))
writeFileSync(`${output}-log.json`, JSON.stringify(movingReceiver, null, 2))
writeFileSync(`${output}-trajectory.json`, JSON.stringify(trajectory, null, 2))
console.log(`Mobility smoke complete. Replay fixture: ${output}-log.json`)
