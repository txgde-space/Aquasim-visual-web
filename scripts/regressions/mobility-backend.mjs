import assert from 'node:assert/strict'
import { fixtureLayers, selectedForm } from './protocol-fixture.mjs'

export async function checkMobilityBackend(server) {
  const [{ generateAquaVisualCc }, { createDefaultExperimentForm, createDefaultTopology, buildExperimentSpec },
    { saveCatalog, catalogProbe }, { MOBILITY_TRACE_CC }, { LINEAR_MOBILITY_CC }, { parseLog }, { resolveMovingNodes }] = await Promise.all([
    '/src/features/experiment/lib/generateScratch.ts', '/src/features/experiment/lib/experimentSpec.ts',
    '/server/protocolCatalog.ts', '/src/features/experiment/lib/mobilityTrace.ts', '/src/features/experiment/lib/linearMobility.ts',
    '/src/features/replay/lib/logParser.ts', '/src/features/replay/lib/logNormalize.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const model = { typeId: 'ns3::VendorDriftModel', layer: 'mobility', parentTypeId: 'ns3::MobilityModel', groupName: 'Mobility', attributes: [
    { name: 'Position', help: 'Initial position.', valueType: 'ns3::Vector3DValue', defaultValue: '0:0:0', constructible: false, readable: true, writable: true },
    { name: 'Velocity', help: 'Current velocity.', valueType: 'ns3::Vector3DValue', defaultValue: '0:0:0', constructible: false, readable: true, writable: false },
    { name: 'DriftVector', help: 'Motion vector [unit=m/s].', valueType: 'ns3::Vector3DValue', defaultValue: '0:0:0', constructible: true },
    { name: 'TurnPeriod', help: 'Time between course changes.', valueType: 'ns3::TimeValue', defaultValue: '+1e+09ns', constructible: true },
  ] }
  const discovered = saveCatalog('/nonexistent/mobility-regression', `AQUASIM_CATALOG_BEGIN\n${JSON.stringify([
    { layer: 'mac', typeId: 'ns3::ExampleMac', attributes: [] }, model,
  ])}\nAQUASIM_CATALOG_END`)
  const mobilityLayer = discovered.find((layer) => layer.id === 'mobility')
  assert.equal(mobilityLayer.scope, 'node')
  assert.equal(mobilityLayer.field, 'mobilityId')
  assert.equal(mobilityLayer.items[0].typeId, model.typeId, 'unfamiliar registered models appear without an allowlist')
  assert.deepEqual(mobilityLayer.items[0].attributes, model.attributes)
  assert.match(catalogProbe, /tid\.IsChildOf\(MobilityModel::GetTypeId\(\)\)/)
  assert.match(LINEAR_MOBILITY_CC, /AddAttribute\("InitialVelocity", "Initial velocity vector \[unit=m\/s\]/)
  assert.doesNotMatch(LINEAR_MOBILITY_CC, /AddAttribute\("Velocity"/, 'inherited read-only Velocity is not illegally re-registered')
  assert.match(LINEAR_MOBILITY_CC, /void DoInitialize\(\) override[\s\S]*SetVelocity\(m_initialVelocity\)/,
    'generic position installation cannot clear the configured initial velocity')

  const layers = [...fixtureLayers.map((layer) => ({ ...layer, items: layer.items.map((item) => ({ ...item, attributes: [] })) })), mobilityLayer]
  const nodes = createDefaultTopology(2)
  nodes[0].x = -120; nodes[0].y = 450; nodes[0].z = 35
  nodes[0].mobility = { type: model.typeId }
  nodes[0].protocolAttributes = { [model.typeId]: { DriftVector: '2m/s:0m/s:-1m/s', TurnPeriod: '250ms' } }
  const spec = buildExperimentSpec(selectedForm(createDefaultExperimentForm), nodes, layers)
  const original = JSON.stringify(spec)
  const code = generateAquaVisualCc(spec, layers)
  assert.equal(JSON.stringify(spec), original)
  assert.ok(code.includes('VisualCreateMobility("ns3::VendorDriftModel", {{"DriftVector", "2:0:-1"}, {"TurnPeriod", "250ms"}}, 1, Vector(-120, 450, 35))'),
    'the chosen model uses the common factory, checker/unit conversion, node address and actual coordinates')
  assert.ok(code.includes('VisualCreateMobility("ns3::ConstantPositionMobilityModel", {}, 2, Vector(1000, 0, 0))'),
    'files without an explicit movement selection keep their original fixed-position behavior')
  assert.match(code, /tid\.IsChildOf\(MobilityModel::GetTypeId\(\)\)/, 'runtime enforces the public mobility interface')
  assert.match(code, /attribute\.first == "Position"[\s\S]*Position is managed by node coordinates/)
  assert.ok(code.indexOf('VisualFinishMobilityTrace();') < code.indexOf('Simulator::Destroy();'),
    'the final actual position is captured before models are disposed')
  assert.match(code, /mobility_sample_interval_us/)
  assert.match(code, /std::max\(0\.1, simStop\.GetSeconds\(\) \* nodesCon\.GetN\(\) \/ 20000\.0\)/,
    'periodic sampling adapts to simulation length and topology size')
  assert.match(MOBILITY_TRACE_CC, /"CourseChange", "ns3::MobilityModel::TracedCallback"/)
  assert.match(MOBILITY_TRACE_CC, /Mobility trace exceeds 30000 movement segments/,
    'overflow is an explicit failure instead of a silently truncated replay')

  const metadataLine = code.split('\n').find((line) => line.includes(`replay << ${JSON.stringify('},"nodes":')} << `))
  const metadata = JSON.parse(JSON.parse(metadataLine.trim().slice(metadataLine.trim().lastIndexOf(' << ') + 4, -1)))
  assert.deepEqual(metadata[0].mobility, spec.nodes[0].mobility)
  assert.deepEqual(metadata[0].protocolAttributes, spec.nodes[0].protocolAttributes, 'log metadata preserves original attribute text for experiment synchronization')
  assert.equal(metadata[1].mobility, undefined)

  for (const [name, value, pattern] of [['Position', '1:2:3', /节点 1.*坐标/], ['Velocity', '1:0:0', /节点 1.*构造/],
    ['TurnPeriod', 'invalid', /TurnPeriod/], ['DriftVector', '2s:0:0', /DriftVector/]]) {
    const invalid = structuredClone(spec)
    invalid.nodes[0].protocolAttributes[model.typeId][name] = value
    assert.throws(() => generateAquaVisualCc(invalid, layers), pattern)
  }
  const unknown = structuredClone(spec)
  unknown.nodes[0].mobility.type = 'ns3::NotRegisteredMobility'
  assert.throws(() => generateAquaVisualCc(unknown, layers), /mobility 未注册协议/, 'unknown models never silently become fixed nodes')

  const parsed = parseLog(JSON.stringify({ nodes: metadata, movements: [
    { node_id: 1, start_us: 0, end_us: 350000, from_x: -120, from_y: 450, from_z: 35, to_x: -119.3, to_y: 450, to_z: 34.65 },
    { node_id: 1, start_us: 350000, end_us: 1000000, from_x: -119.3, from_y: 450, from_z: 34.65, to_x: -119.3, to_y: 451.3, to_z: 34.65 },
  ], packets: [] }))
  assert.deepEqual(parsed.parseErrors, [])
  assert.equal(parsed.movements.length, 2, 'the existing movement schema needs no parser-semantic changes')
  assert.deepEqual(parsed.nodes[0].mobility, spec.nodes[0].mobility)
  const midway = resolveMovingNodes(parsed.nodes, parsed.movements, 500000)
  assert.ok(Math.abs(midway[0].x + 119.3) < 1e-10 && Math.abs(midway[0].y - 450.3) < 1e-10)
  assert.equal(midway[1].x, 1000, 'fixed nodes remain fixed in the same replay')
  console.log('Mobility backend passed: dynamic discovery, public factories/checkers, per-node attributes, managed coordinates, unit conversion, bounded observations, metadata and shared movement replay.')
}
