// Real ns-3 integration against an existing dev service; no new server is started.
import assert from 'node:assert/strict'
const base = process.argv[2] || 'http://localhost:5173'
const aquaSimHome = process.argv[3] || ''
const PHY = 'ns3::AquaSimPhySimple'
const post = async (route, data) => {
  const response = await fetch(new URL(route, base), { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, aquaSimHome }), signal: AbortSignal.timeout(600_000) })
  return { status: response.status, body: await response.json() }
}
const catalog = await post('/api/simulator/check', {})
const item = catalog.body.catalog?.find(layer => layer.id === 'phy')?.items.find(item => item.typeId === PHY)
assert.ok(item, 'precompile first: Simple PHY must come from the actual TypeId probe')
assert.equal(item.parentTypeId, 'ns3::AquaSimPhyCmn')
assert.equal(item.attributes.find(a => a.name === 'DataRate').valueType, 'ns3::DataRateValue')
assert.equal(item.attributes.find(a => a.name === 'RxProcessingDelay').valueType, 'ns3::TimeValue')
for (const name of ['Frequency', 'transRange', 'RXThresh', 'txPower', 'rxPower', 'idlePower', 'SignalCache']) assert.ok(item.attributes.some(a => a.name === name))
const close = (a, b, label, tolerance = .002) => assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`)
const node = (id, x, y = 0) => ({ id, name: `Node-${id}`, x, y, z: 0, role: 'node', app: '' })
const source = (id, x, target) => ({ ...node(id, x), app: 'ns3::AquaSimTrafficGen', appAttrs: { Delay: '10', PacketSize: '40' }, appDestination: target })
const makeSpec = () => ({
  schema: 'aqua-sim-experiment/v0', simStop: '19s',
  channel: { type: 'ns3::AquaSimChannel', propagation: 'ns3::AquaSimRangePropagation' },
  stack: { phy: { type: PHY, attrs: {} }, mac: { type: 'ns3::AquaSimBroadcastMac', attrs: {} }, routing: { type: 'ns3::AquaSimVBF' } },
  protocolAttributes: { [PHY]: { DataRate: '1kbps', RxProcessingDelay: '0ms', transRange: '600' },
    'ns3::AquaSimVBF': { TargetPos: '1000:0:0', Width: '100' } },
  traffic: { preset: 'none' }, nodes: [source(1, 0, 3), node(2, 500), node(3, 1000)],
})
const run = async (spec, label) => {
  const response = await post('/api/run', { spec })
  assert.ok(response.body.ok, `${label}: ${response.body.error || response.body.stdout}`)
  assert.doesNotMatch(response.body.stdout, /packet send failed|ERROR_BADF/)
  const log = JSON.parse(response.body.log)
  return { log, stdout: response.body.stdout }
}
const sentBy = (result, id) => result.log.packets.find(packet => packet.src === id)
const receivedBy = (result, id) => result.log.packets.flatMap(packet => packet.receivers.filter(rx => rx.dst === id))

const baseline = await run(makeSpec(), 'baseline')
assert.ok(sentBy(baseline, 2), 'relay must actually forward')
assert.match(baseline.stdout, /ROUTE-3 pktNum:1/)
close(receivedBy(baseline, 2)[0].rx_start_us - sentBy(baseline, 1).tx_start_us, 500 / 1500 * 1e6, 'underwater propagation')
const fasterSpec = makeSpec(); fasterSpec.protocolAttributes[PHY].DataRate = '2kbps'
const faster = await run(fasterSpec, '2kbps')
close(sentBy(faster, 1).tx_duration_us * 2, sentBy(baseline, 1).tx_duration_us, 'doubling rate halves actual airtime')
const biggerSpec = makeSpec(); biggerSpec.nodes[0].appAttrs.PacketSize = '80'
const bigger = await run(biggerSpec, 'larger packet')
close(sentBy(bigger, 1).tx_duration_us - sentBy(baseline, 1).tx_duration_us, 40 * 8 / 1000 * 1e6, 'packet size uses bytes, on-air headers unchanged')
console.log('Simple PHY passed: linear bit rate, bytes, inherited underwater propagation and real multihop delivery')

const delayedSpec = makeSpec()
delayedSpec.nodes[1].protocolAttributes = { [PHY]: { RxProcessingDelay: '150ms', DataRate: '2kbps' } }
delayedSpec.nodes[2].protocolAttributes = { [PHY]: { RxProcessingDelay: '40ms', DataRate: '200bps' } }
const delayed = await run(delayedSpec, 'receiver processing')
close(sentBy(delayed, 2).tx_start_us - sentBy(baseline, 2).tx_start_us, 150_000, 'relay forwards after its processing delay')
const relayRx = receivedBy(delayed, 2)[0]
close(relayRx.rx_start_us, receivedBy(baseline, 2)[0].rx_start_us, 'processing never shifts the on-air RX start')
close(relayRx.rx_duration_us, sentBy(delayed, 1).tx_duration_us, 'receiver uses sender airtime despite different rates')
close(relayRx.rx_delivery_us, relayRx.rx_start_us + relayRx.rx_duration_us + 150_000, 'actual MAC delivery time')
close(relayRx.rx_processing_duration_us, 150_000, 'processing metadata')
close(receivedBy(delayed, 3)[0].rx_duration_us, sentBy(delayed, 2).tx_duration_us, 'forwarded packet uses relay rate, not the previous hop')
close(sentBy(delayed, 2).tx_duration_us * 2, sentBy(baseline, 2).tx_duration_us, 'per-node transmitter rate')
assert.match(delayed.stdout, /ROUTE-3 pktNum:1/)
console.log('Simple PHY passed: per-node rates/delays, actual delayed forwarding and precise RX/delivery trace separation')
const truncatedSpec = makeSpec(); truncatedSpec.nodes = [source(1, 0, 2), node(2, 500)]
truncatedSpec.nodes[1].protocolAttributes = { [PHY]: { RxProcessingDelay: '30s' } }
const truncated = await run(truncatedSpec, 'processing beyond stop')
const pendingRx = receivedBy(truncated, 2)[0]
assert.ok(pendingRx, 'successful physical RX is recorded before processing finishes')
assert.equal(pendingRx.rx_processing_duration_us, 30_000_000)
assert.equal(pendingRx.rx_delivery_us, undefined, 'no MAC delivery is invented beyond the simulation stop')
assert.doesNotMatch(truncated.stdout, /ROUTE-2 pktNum:/)
console.log('Simple PHY passed: physical reception survives a simulation stop during receiver processing')


for (const [label, mutate] of [
  ['range cutoff', spec => { spec.nodes = [source(1, 0, 2), node(2, 700)] }],
  ['frequency mismatch', spec => { spec.nodes = [source(1, 0, 2), { ...node(2, 500), protocolAttributes: { [PHY]: { Frequency: '26' } } }] }],
  ['receive threshold', spec => { spec.nodes = [source(1, 0, 2), { ...node(2, 500), protocolAttributes: { [PHY]: { RXThresh: '1e9' } } }] }],
]) {
  const spec = makeSpec(); mutate(spec)
  const result = await run(spec, label)
  assert.ok(result.log.packets.length > 0)
  assert.equal(result.log.packets.flatMap(p => p.receivers).length, 0, label)
  console.log(`Simple PHY passed: inherited ${label}`)
}
const collisions = makeSpec(); collisions.nodes = [source(1, -500, 3), source(2, 500, 3), node(3, 0)]
const collided = await run(collisions, 'simultaneous reception')
assert.equal(collided.log.packets.length, 2)
assert.equal(receivedBy(collided, 3).length, 2)
assert.ok(receivedBy(collided, 3).every(rx => rx.status === 'fail' && rx.reason === 'collision_rx_rx' && Number.isFinite(rx.collision_start_us)), 'actual collisions are retained as failed receptions')
const duplex = makeSpec(); duplex.nodes = [source(1, 0, 2), source(2, 500, 1)]
const busy = await run(duplex, 'half duplex')
assert.equal(busy.log.packets.length, 2)
assert.equal(busy.log.packets.flatMap(p => p.receivers).length, 2)
assert.ok(busy.log.packets.flatMap(p => p.receivers).every(rx => rx.status === 'fail' && rx.reason === 'collision_rx_tx'), 'half-duplex failures are recorded from actual PHY status')
console.log('Simple PHY passed: inherited overlap collisions and half duplex')
const tdmaSpec = makeSpec(); tdmaSpec.nodes = [source(1, 0, 2), node(2, 500)]
tdmaSpec.stack.mac.type = 'ns3::AquaSimTDMA'
tdmaSpec.protocolAttributes['ns3::AquaSimTDMA'] = { SlotNum: '2', SlotLen: '2s', Token: '0' }
tdmaSpec.protocolAttributes[PHY].RxProcessingDelay = '100ms'
tdmaSpec.nodes[1].protocolAttributes = { 'ns3::AquaSimTDMA': { Token: '1' } }
const tdma = await run(tdmaSpec, 'TDMA scheduling')
close(sentBy(tdma, 1).tx_start_us, 12_010_000, 'existing TDMA slot schedule remains in control')
assert.match(tdma.stdout, /ROUTE-2 pktNum:1/)
close(receivedBy(tdma, 2)[0].rx_processing_duration_us, 100_000, 'TDMA uses the same receive processing interface')
console.log('Simple PHY passed: unchanged TDMA scheduling and normal processing/delivery')

for (const [name, value] of [['DataRate', '0bps'], ['RxProcessingDelay', '-1ms']]) {
  const spec = makeSpec(); spec.protocolAttributes[PHY][name] = value
  const invalid = await post('/api/run', { spec })
  assert.equal(invalid.body.ok, false)
  assert.match(invalid.body.stdout || invalid.body.error, new RegExp(name))
}
console.log('Simple PHY passed: zero rate and negative processing delay rejected through the shared runtime')
