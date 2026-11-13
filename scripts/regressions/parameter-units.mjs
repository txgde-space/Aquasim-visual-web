import assert from 'node:assert/strict'

export async function checkParameterUnits(server) {
  const [quantity, units, validation, { generateAquaVisualCc }, { protocolMetadataIssues }, { deviceProtocolConfigurations }] = await Promise.all([
    '/src/shared/quantity.ts', '/src/features/experiment/lib/protocolUnits.ts',
    '/src/features/experiment/lib/experimentValidation.ts', '/src/features/experiment/lib/generateScratch.ts',
    '/src/features/experiment/lib/protocolMetadata.ts', '/src/features/experiment/lib/protocolConfiguration.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const { parseQuantity } = quantity
  for (const [text, base, expected] of [
    ['1.5 KM', 'm', 1500], ['500 M', 'm', 500], ['25000 Hz', 'kHz', 25], ['2 MHz', 'kHz', 2000],
    ['500ms', 's', .5], ['1 μs', 's', 1e-6], ['2 MIN', 's', 120], ['300 µs', 's', .0003],
    ['1.001 kbps', 'bps', 1001], ['0.29 kB', 'B', 290], ['1 MBps', 'bps', 8e6],
    ['1 Mbps', 'bps', 1e6], ['1 KiB/s', 'bps', 8192], ['1 kB/s', 'bps', 8000],
    ['395 mW', 'W', .395], ['10mJ', 'J', .01], ['40', 'B', 40], ['.5e1 seconds', 's', 5],
  ]) assert.equal(parseQuantity(text, base).value, expected, `${text} interpreted in ${base}`)
  for (const [text, base] of [['1ms', 'm'], ['2km', 's'], ['3w', 'W'], ['5MbPs', 'bps'], ['2dBm', 'W'],
    ['0x10', 'm'], ['NaN', 'm'], ['Infinity', 's'], ['1e309', 'm'], ['1e-9999', 's'], ['1m junk', 'm']]) {
    assert.throws(() => parseQuantity(text, base), undefined, `${text} is never silently truncated`)
  }
  const attr = (name, help = '', valueType = 'ns3::DoubleValue', defaultValue = '1') => ({ name, help, valueType, defaultValue, constructible: true })
  const delay = attr('ArbitraryDelay', 'The delay interval (seconds)'), distance = attr('ArbitraryDistance', 'Length in meters.')
  const frequency = attr('ArbitraryFrequency', 'The frequency, default is 25(khz).')
  assert.equal(units.attributeUnit(delay), 's')
  assert.equal(units.attributeUnit(distance), 'm')
  assert.equal(units.attributeUnit(frequency), 'kHz')
  assert.equal(units.attributeUnit(attr('Delay')), null, 'names never imply execution units')
  assert.equal(units.attributeUnit(attr('traffic', 'packet/bit per second')), null)
  assert.equal(units.attributeUnit(attr('velocity', 'Speed in meters per second')), null, 'compound dimensions are not truncated')
  assert.equal(units.attributeUnit(attr('Ambiguous', 'Measures (m) and (s)')), null)
  assert.equal(units.attributeUnit(attr('Unknown', '[unit=furlong] length (m)')), null, 'unsupported declaration does not fall back')
  assert.equal(units.attributeUnit(attr('Conflict', '[unit=m] [unit=s]')), null)
  assert.equal(units.attributeUnit(attr('Declared', 'distance [unit=km]')), 'km')
  assert.equal(units.attributeLiteral(delay, '500ms'), '0.5')
  assert.equal(units.attributeLiteral(frequency, '25000Hz'), '25')
  assert.equal(units.attributeLiteral(distance, '1.5km'), '1500')
  assert.equal(units.attributeLiteral(attr('Point', '[unit=m]', 'ns3::Vector3DValue'), '-1km:200m:0'), '-1000:200:0')
  const time = attr('Timer', '', 'ns3::TimeValue'), rate = attr('Rate', '', 'ns3::DataRateValue')
  for (const [text, expected] of [['.3', '.3s'], ['300 milliseconds', '300ms'], ['20 μs', '20us'], ['2 MIN', '2min'], ['1e3ns', '1e3ns']]) {
    assert.equal(units.attributeLiteral(time, text), expected)
  }
  assert.equal(units.attributeLiteral(rate, '1.001kbps'), '1001bps')
  assert.equal(units.attributeLiteral(rate, '18446744073709551615'), '18446744073709551615bps', 'bare integers retain all digits for the real checker')
  assert.equal(units.attributeLiteral(attr('Count', '(bytes)', 'ns3::UintegerValue'), '18446744073709551615'), '18446744073709551615')
  assert.throws(() => units.attributeLiteral(attr('Count', '(bytes)', 'ns3::UintegerValue'), '0.1B'))
  assert.throws(() => units.attributeLiteral(rate, '9007199254740993Mbps'), /安全范围/)
  assert.throws(() => units.attributeLiteral(attr('Unknown'), '500ms'), /未声明单位/)
  assert.throws(() => units.attributeLiteral(attr('Unknown'), '1e309'), /范围/)
  for (const help of ['', '(bytes)']) {
    for (const type of ['ns3::IntegerValue', 'ns3::UintegerValue']) {
      const integer = attr('Integral', help, type)
      for (const [text, expected] of [['1e3', '1000'], ['1.0', '1'], ['.5e1', '5'], ['-2e2', '-200'], ['18446744073709551615', '18446744073709551615']]) {
        assert.equal(units.attributeLiteral(integer, text), expected, 'integer parsers must not consume only the prefix')
      }
      for (const text of ['1.5', '1e-3', '1.0000000000000001', '9007199254740993e0']) assert.throws(() => units.attributeLiteral(integer, text), /整数/)
    }
  }
  assert.throws(() => units.attributeLiteral(attr('Integral', '(bytes)', 'ns3::IntegerValue'), '1.0000000000000001B'), /整数/)
  assert.equal(units.attributeLiteral(attr('Double'), '1e3'), '1e3', 'double text stays unchanged')
  assert.equal(validation.parseExperimentTime('30', 'time').literal, '30s')
  assert.deepEqual(units.nonBlankAttributes({ empty: '', space: ' ', zero: '0', numeric: 0, flag: false }), { zero: '0', numeric: 0, flag: false })

  // Deliberately invented TypeIds and arbitrary attribute names exercise the shared path.
  const item = (typeId, attributes = [], extra = {}) => ({ id: typeId, typeId, label: typeId, source: '', attributes, ...extra })
  const layers = [
    { id: 'phy', field: 'phyId', items: [item('ns3::UnitPhy', [distance, frequency, rate])] },
    { id: 'mac', field: 'macId', items: [item('ns3::UnitMac', [time])] },
    { id: 'routing', field: 'routingId', items: [item('ns3::UnitRouting')] },
    { id: 'channel', field: 'channelId', items: [item('ns3::UnitChannel'), item('ns3::UnitPropagation', [], { field: 'propagationId' })] },
    { id: 'app', field: 'appId', items: [item('ns3::UnitApplication', [delay])] },
  ]
  const spec = {
    schema: 'aqua-sim-experiment/v0', simStop: '30', traffic: { preset: 'none' },
    channel: { type: 'ns3::UnitChannel', propagation: 'ns3::UnitPropagation' },
    stack: { phy: { type: 'ns3::UnitPhy', attrs: {} }, mac: { type: 'ns3::UnitMac', attrs: {} }, routing: { type: 'ns3::UnitRouting' } },
    protocolAttributes: { 'ns3::UnitPhy': { ArbitraryDistance: '1.5km', ArbitraryFrequency: '25000Hz', Rate: '1.001kbps' }, 'ns3::UnitMac': { Timer: '0.3' } },
    nodes: [
      { id: 1, name: 'Source', x: 0, y: 0, z: 0, role: 'node', app: 'ns3::UnitApplication', appAttrs: { ArbitraryDelay: '500ms' }, protocolAttributes: { 'ns3::UnitPhy': { ArbitraryDistance: ' ' } } },
      { id: 2, name: 'Sink', x: 100, y: 0, z: 0, role: 'sink', app: '' },
    ],
  }
  const before = structuredClone(spec)
  assert.deepEqual(protocolMetadataIssues(spec, layers), [])
  assert.equal(deviceProtocolConfigurations(spec, spec.nodes[0])[0].attributes.ArbitraryDistance, '1.5km', 'blank node override inherits the scene')
  const code = generateAquaVisualCc(spec, layers)
  for (const fragment of ['{"ArbitraryDistance", "1500"}', '{"ArbitraryFrequency", "25"}', '{"Rate", "1001bps"}', '{"Timer", "0.3s"}', '{"ArbitraryDelay", "0.5"}', 'const Time simStop("30s")']) assert.ok(code.includes(fragment), fragment)
  assert.deepEqual(spec, before, 'execution normalization never rewrites the editable/exported input')
  const invalid = structuredClone(spec); invalid.nodes[0].appAttrs.ArbitraryDelay = '3km'
  assert.ok(protocolMetadataIssues(invalid, layers).some((issue) => issue.includes('ArbitraryDelay')))
  assert.throws(() => generateAquaVisualCc(invalid, layers), /ArbitraryDelay/)
  console.log('Parameter units passed: declared metadata, base units, precise conversions, defaults, inherited overrides, dimensions, and generic generation.')
}
