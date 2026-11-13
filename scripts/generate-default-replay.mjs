// Regenerate the bundled survey replay using the existing simulator service.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'

const base = process.argv[2] || 'http://localhost:5173'
const aquaSimHome = process.argv[3] || ''
const PHY = 'ns3::AquaSimPhySimple'
const LINEAR = 'ns3::AquaVisualLinearMobilityModel'
const node = (id, name, modelType, x, y, z, velocity, delay) => ({
  id, name, modelType, role: id === 1 ? 'sink' : 'node', x, y, z,
  app: delay ? 'ns3::AquaSimTrafficGen' : '',
  ...(delay ? { appDestination: 1, appAttrs: { Delay: `${delay}s`, PacketSize: '40' } } : {}),
  ...(velocity ? {
    mobility: { type: LINEAR },
    protocolAttributes: { [LINEAR]: { InitialVelocity: velocity } },
  } : {}),
})
const spec = {
  schema: 'aqua-sim-experiment/v0', simStop: '66s', traffic: { preset: 'none' },
  channel: { type: 'ns3::AquaSimChannel', propagation: 'ns3::AquaSimRangePropagation' },
  stack: {
    phy: { type: PHY, attrs: {} },
    mac: { type: 'ns3::AquaSimBroadcastMac', attrs: {} },
    routing: { type: 'ns3::AquaSimStaticRouting' },
  },
  protocolAttributes: { [PHY]: { DataRate: '200bps', transRange: '1000m', RxProcessingDelay: '300ms' } },
  nodes: [
    // Coordinates are model bottom-centres; surface Z=500 m, including draft.
    node(1, '科考船', 'vessel', -300, -200, 498.9, '1.6m/s:0.2m/s:0'),
    node(2, '海面浮标', 'buoy', -270, 120, 497.3, '0.1m/s:0.05m/s:0'),
    node(3, '作业ROV', 'rov', 60, -100, 440, '0.35m/s:-0.15m/s:0'),
    node(4, '巡航AUV-A', 'auv', 380, -260, 360, '-1.2m/s:0.55m/s:0', 12),
    node(5, '巡航AUV-B', 'auv', -360, 420, 325, '0.9m/s:-0.65m/s:0', 17),
    node(6, '水下观测站-6', 'sensor', -40, 400, 300, null, 24),
    node(7, '水下观测站-7', 'sensor', 380, 380, 280, null, 29),
    node(8, '水下中继-8', 'sensor', 230, 130, 400),
  ],
}
const response = await fetch(new URL('/api/run', base), {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ spec, aquaSimHome }), signal: AbortSignal.timeout(600_000),
})
const result = await response.json()
assert.equal(response.status, 200, result.error || result.stdout)
assert.equal(result.ok, true, result.error || result.stdout)
const log = JSON.parse(result.log)
assert.ok(log.packets.length && log.movements.length, 'The example must contain real traffic and movement')
log.meta.title = '海面科考船与水下移动观测'
log.meta.example = { source: 'ns-3 simulation', generator: 'scripts/generate-default-replay.mjs', sea_level_m: 500 }
writeFileSync(new URL('../src/assets/net_surface_survey.json', import.meta.url), `${JSON.stringify(log, null, 2)}\n`)
writeFileSync(new URL('../exports/海面科考船-移动观测实验.json', import.meta.url), `${JSON.stringify(spec, null, 2)}\n`)
console.log(JSON.stringify({ packets: log.packets.length, movements: log.movements.length, nodes: log.nodes.length }))
