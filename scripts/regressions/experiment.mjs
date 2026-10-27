import assert from 'node:assert/strict'

const PHY = 'ns3::AquaSimPhyFDM', CMN = 'ns3::AquaSimPhyCmn', RADIO = 'ns3::AquaSimRadioPhy'
const TDMA = 'ns3::AquaSimTDMA', SWARM = 'ns3::AquaSimSwarm', VARIANT = 'ns3::AquaSimSwarM'
const APP = 'ns3::OnOffNDApplication', CUSTOM = 'ns3::CustomSwarmTDMA', CUSTOM_APP = 'ns3::OtherSocketApplication'
const attr = (name, valueType = 'ns3::DoubleValue', defaultValue = '0', extra = {}) => ({
  name, valueType, defaultValue, help: '', constructible: true, readable: true, writable: true, ...extra,
})
const applicationAttributes = () => [
  attr('Protocol', 'ns3::TypeIdValue', 'ns3::AquaSimSocketFactory'), attr('Remote', 'ns3::AddressValue', '00-00'),
  attr('StartTime', 'ns3::TimeValue', '+0ns'), attr('StopTime', 'ns3::TimeValue', '+0ns'),
  attr('DataRate', 'ns3::DataRateValue', '500000bps'), attr('PacketSize', 'ns3::UintegerValue', '512'),
  attr('Nsend', 'ns3::UintegerValue', '1'), attr('traffic'), attr('mode', 'ns3::UintegerValue', '1'), attr('stopSend'),
  attr('OffTime', 'ns3::PointerValue', 'ns3::ConstantRandomVariable[Constant=1]', { pointeeTypeId: 'ns3::RandomVariableStream' }),
]
// Deliberately non-platform defaults prove that neither the UI nor generator replaces registration data.
const registeredLayers = (placeholders) => placeholders.map((layer) => ({ ...layer, items: [
  ...layer.items.map((item) => ({ ...item, parentTypeId: `ns3::${layer.id === 'app' ? 'Application' : 'Object'}`, attributes:
    item.typeId === TDMA ? [attr('SlotNum', 'ns3::UintegerValue', '2'), attr('SlotLen', 'ns3::TimeValue', '100ms')]
      : item.typeId === SWARM ? [attr('NodeCount', 'ns3::UintegerValue', '11'), attr('InitialRoundDelay', 'ns3::TimeValue', '500ms')]
      : layer.id === 'phy' ? [attr('transRange', 'ns3::DoubleValue', '3000'), attr('DataRate', 'ns3::DataRateValue', '1Mbps'), attr('Frequency'), attr('RXThresh'), attr('txPower')]
      : item.typeId === APP ? applicationAttributes()
      : item.typeId === 'ns3::AquaSimTrafficGen' ? [...applicationAttributes(), attr('Delay')]
      : [],
  })),
  ...(layer.id === 'mac' ? [VARIANT, CUSTOM].map((typeId) => ({ id: typeId, typeId, source: '', label: typeId, attributes: [
    attr('NodeCount', 'ns3::UintegerValue', '11'), attr('SlotNum', 'ns3::UintegerValue', '100'),
    attr('SlotLen', 'ns3::DoubleValue', '1.5'), attr('CustomDelay', 'ns3::TimeValue', '-1s'),
  ] })) : []),
  ...(layer.id === 'app' ? [
    { id: CUSTOM_APP, typeId: CUSTOM_APP, label: 'Custom socket app', source: '', attributes: applicationAttributes() },
    { id: 'ns3::TimerApplication', typeId: 'ns3::TimerApplication', label: 'Timer app', source: '', attributes: [attr('Interval', 'ns3::TimeValue', '1s')] },
  ] : []),
] }))

export async function checkExperimentRegressions(load) {
  const specLib = await load('/src/features/experiment/lib/experimentSpec.ts')
  const doc = await load('/src/features/experiment/lib/experimentDocument.ts')
  const legacy = await load('/src/features/experiment/lib/legacyExperiment.ts')
  const validation = await load('/src/features/experiment/lib/experimentValidation.ts')
  const metadata = await load('/src/features/experiment/lib/protocolMetadata.ts')
  const catalog = await load('/src/features/experiment/lib/typeIdCatalog.ts')
  const { generateAquaVisualCc } = await load('/src/features/experiment/lib/generateScratch.ts')
  const { useTopologyEditor } = await load('/src/features/experiment/composables/useTopologyEditor.ts')
  const { createDefaultExperimentForm: form, createDefaultTopology: nodes, buildExperimentSpec: build, validateExperiment: validate } = specLib
  const { serializeExperiment: serialize, parseExperiment: parse } = doc
  const layers = registeredLayers(catalog.TYPEID_LAYERS)
  const makeDraft = (value = form(), topology = nodes(2)) => ({ form: value, nodes: topology, selectedIds: [], activeCatalogId: `mac:${value.macId}` })
  const makeSpec = () => build(form(), nodes(2), layers)
  const generate = (spec) => generateAquaVisualCc(spec, layers)
  const document = (value = form()) => JSON.parse(serialize(makeDraft(value), layers))

  assert.deepEqual(form().protocolAttributes, {}, 'new experiments use registered defaults without hidden overrides')
  for (const key of ['slotNum', 'slotLen', 'initialRoundDelay', 'transRange', 'environmentStacks', 'trafficId', 'trafficRateBps']) assert.ok(!(key in form()))
  assert.deepEqual(validate(makeSpec(), layers), [])
  assert.doesNotMatch(generate(makeSpec()), /\{"(?:NodeCount|InitialRoundDelay|SlotNum|SlotLen|transRange)",/)
  assert.ok(validate(makeSpec(), catalog.TYPEID_LAYERS).some((message) => message.includes('缺少注册属性信息')))
  const order = ['app', 'routing', 'mac', 'phy', 'channel']
  assert.deepEqual(catalog.TYPEID_LAYERS.map((layer) => layer.id), order)
  const unknownLayers = [{ id: 'unknown-a', items: [] }, ...layers.slice().reverse(), { id: 'unknown-b', items: [] }]
  assert.deepEqual(catalog.orderCatalogLayers(unknownLayers).map((layer) => layer.id), [...order, 'unknown-a', 'unknown-b'])
  assert.equal(unknownLayers[0].id, 'unknown-a', 'ordering does not mutate the caller')

  assert.equal(parse(serialize(makeDraft(form(), []), layers), layers).nodes.length, 0)
  assert.throws(() => generate(build(form(), [], layers)), /至少需要 2 个节点/)
  for (const [field, layer, read] of [
    ['phyId', 'phy', (s) => s.stack.phy.type], ['macId', 'mac', (s) => s.stack.mac.type],
    ['routingId', 'routing', (s) => s.stack.routing.type], ['channelId', 'channel', (s) => s.channel.type],
    ['propagationId', 'channel', (s) => s.channel.propagation],
  ]) {
    const draft = makeDraft({ ...form(), [field]: `missing-${field}` })
    const spec = build(draft.form, draft.nodes, layers)
    assert.equal(read(spec), draft.form[field])
    assert.equal(parse(serialize(draft, layers), layers).form[field], draft.form[field])
    assert.throws(() => generate(spec), new RegExp(`${layer} 未注册协议`))
  }
  assert.equal(build({ ...form(), macId: 'tdma' }, nodes(2), layers.map((layer) => ({ ...layer, items: [] }))).stack.mac.type, 'tdma',
    'runtime never resolves missing choices through a static alias table')
  const unknownApp = makeSpec(); unknownApp.nodes[0].app = 'ns3::UnavailableApplication'
  assert.throws(() => generate(unknownApp), /app 未注册协议/)

  for (const value of ['nonsense', '-1s', '1', '1e309s', '']) {
    const spec = { ...makeSpec(), simStop: value }
    assert.ok(validate(spec, layers).some((message) => message.includes('simStop')))
    assert.throws(() => generate(spec), /simStop/)
  }
  const invalid = makeDraft({ ...form(), simStop: 'editing', protocolAttributes: { [TDMA]: { SlotLen: 'editing' }, [PHY]: { transRange: 'invalid' } } })
  assert.deepEqual(parse(serialize(invalid, layers), layers).form, invalid.form, 'saving never runs execution validation')
  assert.match(generate({ ...makeSpec(), simStop: ' 1.5 MIN ' }), /const Time simStop\("1.5min"\)/)
  for (const [value, seconds] of [['500ms', .5], ['1e3us', .001], ['1000000000ps', .001], ['1000fs', 1e-12], ['2d', 172800], ['1y', 31536000]]) {
    assert.ok(Math.abs(validation.parseExperimentTime(value, 'duration').seconds - seconds) <= Math.abs(seconds) * 1e-12)
  }
  assert.equal(validation.isTimeAttribute({ typeId: SWARM }, 'InitialRoundDelay'), false, 'names never replace missing registered metadata')
  const custom = build({ ...form(), macId: CUSTOM }, nodes(2), layers)
  custom.nodes[0].z = 100
  assert.deepEqual(validate(custom, layers), [], 'TDMA/Swarm substrings do not impose protocol-specific rules')
  custom.protocolAttributes = { [CUSTOM]: { NodeCount: '3', SlotNum: '100', SlotLen: '1.5', CustomDelay: '-1s' } }
  assert.deepEqual(validate(custom, layers), [], 'the simulator checker owns actual numeric ranges and time sentinels')
  assert.match(generate(custom), /\{"CustomDelay", "-1s"\}/)
  custom.protocolAttributes[CUSTOM].CustomDelay = 'invalid'
  assert.throws(() => generate(custom), /CustomDelay/)
  const precedence = makeSpec()
  precedence.stack.mac.attrs.InitialRoundDelay = 'invalid'
  precedence.protocolAttributes = { [SWARM]: { InitialRoundDelay: '2s' } }
  assert.deepEqual(validate(precedence, layers), [])
  assert.match(generate(precedence), /\{"InitialRoundDelay", "2s"\}/)

  // Arbitrary applications with the same registered socket interface use the same wiring.
  for (const appType of [APP, CUSTOM_APP]) {
    const spec = makeSpec(); spec.nodes[0].app = appType
    assert.ok(validate(spec, layers).some((message) => message.includes('目的节点')))
    spec.nodes[0].appDestination = 2
    assert.deepEqual(validate(spec, layers), [])
    assert.doesNotMatch(generate(spec), /\{"Nsend",|app->SetStartTime|app->SetStopTime|GetInstanceTypeId\(\).GetName\(\) ==/)
    spec.nodes[0].appAttrs = { StartTime: 'bad-time' }
    assert.throws(() => generate(spec), /StartTime/)
    spec.nodes[0].appAttrs = { Remote: 'ignored-before' }
    assert.throws(() => generate(spec), /Remote/)
  }
  const wrongField = makeSpec(); wrongField.channel.type = wrongField.channel.propagation
  assert.ok(validate(wrongField, layers).some((message) => message.includes('channel')), 'validation rejects a propagation object in the channel field')
  assert.throws(() => generate(wrongField), /channel/)
  const timer = makeSpec(); timer.nodes[0].app = 'ns3::TimerApplication'
  assert.deepEqual(validate(timer, layers), [], 'applications without a socket interface require no invented endpoint')
  assert.match(generate(timer), /ns3::TimerApplication/)
  const fixtureApp = layers.find((layer) => layer.id === 'app').items.find((item) => item.typeId === CUSTOM_APP)
  assert.equal(metadata.attributeEditState(fixtureApp, fixtureApp.attributes.find((a) => a.name === 'OffTime'), 'app').editable, true)

  // Legacy API normalization is explicit, pure, and unreachable for new traffic:none specs.
  assert.equal(legacy.normalizeLegacyTrafficSpec(timer), timer)
  const oldApi = makeSpec()
  oldApi.traffic = { preset: 'periodic', src: 1, dst: 2, rate_bps: 160, pkt: 40, start: '2s', stop: '20s' }
  oldApi.protocolAttributes = { [APP]: { PacketSize: '60' } }
  const original = structuredClone(oldApi)
  const normalized = legacy.normalizeLegacyTrafficSpec(oldApi)
  assert.deepEqual(oldApi, original)
  assert.equal(normalized.nodes[0].app, APP)
  assert.deepEqual(normalized.traffic, { preset: 'none' })
  assert.equal(normalized.nodes[0].appAttrs.StartTime, '2s')
  assert.equal(normalized.nodes[0].appAttrs.PacketSize, '60')
  assert.equal(normalized.nodes[0].appAttrs.mode, '0')
  const migrated = parse(JSON.stringify(oldApi), layers)
  assert.equal(migrated.nodes[0].appId, APP)
  assert.equal(migrated.nodes[0].appDestination, 2)
  assert.equal(migrated.nodes[0].appAttrs.DataRate, '160bps')
  assert.deepEqual(parse(serialize(migrated, layers), layers).nodes, migrated.nodes)

  await checkLegacyDocuments({ form, document, makeSpec, parse, serialize, makeDraft, layers, nodes })
  await checkEditorAndPresentation(load, { form, nodes, layers, useTopologyEditor, build, generate, parse, serialize, makeDraft, order })

  const tooMany = build(form(), nodes(65), layers)
  assert.ok(validate(tooMany, layers).some((warning) => warning.includes('64')))
  assert.throws(() => generate(tooMany), /64/)
  assert.throws(() => parse(JSON.stringify(tooMany), layers), /64/)
  for (const id of [0, 65535, 1.5]) {
    const spec = makeSpec(); spec.nodes[0].id = id
    assert.ok(validate(spec, layers).some((warning) => warning.includes('节点编号')))
    assert.throws(() => generate(spec), /节点编号/)
  }
  assert.equal(validation.nextAvailableNodeId([65534, 1]), 2)
  return 'experiment regressions passed'
}

async function checkLegacyDocuments({ form, document, makeSpec, parse, serialize, makeDraft, layers, nodes }) {
  for (const version of [1, 2]) {
    const old = document()
    old.editor.version = version
    Object.assign(old.editor.form, { phyId: 'phy-fdm', macId: 'swarm', slotNum: 6, slotLen: '7s', initialRoundDelay: '2s', transRange: 2400,
      protocolAttributes: { [TDMA]: { SlotLen: '9s' }, [PHY]: { Frequency: '18.5' } },
      environmentStacks: { acoustic: { phyId: 'phy-fdm', channelId: 'channel', propagationId: 'range', transRange: 2000 },
        radio: { phyId: 'phy-radio', channelId: 'radio-channel', propagationId: 'radio-propagation', transRange: 5500 } } })
    old.stack.phy.attrs = { txPower: 1.1, transRange: 1000, Frequency: '12', CustomInherited: 'kept' }
    old.stack.mac.attrs = { LegacyMacAttribute: 'retained' }
    const migrated = parse(JSON.stringify(old), layers).form
    assert.equal(migrated.phyId, PHY)
    assert.equal(migrated.macId, SWARM)
    assert.deepEqual(migrated.protocolAttributes[TDMA], { SlotNum: '6', SlotLen: '9s' })
    for (const type of [SWARM, VARIANT]) assert.equal(migrated.protocolAttributes[type].InitialRoundDelay, '2s')
    assert.equal(migrated.protocolAttributes[SWARM].LegacyMacAttribute, 'retained')
    for (const type of [PHY, CMN]) assert.equal(migrated.protocolAttributes[type].transRange, '2400')
    assert.equal(migrated.protocolAttributes[RADIO].transRange, '5500')
    assert.equal(migrated.protocolAttributes[PHY].Frequency, '18.5')
    assert.equal(migrated.protocolAttributes[PHY].CustomInherited, 'kept')
    assert.ok(!('environmentStacks' in migrated))
    assert.ok(!('txPower' in migrated.protocolAttributes[PHY]))
    assert.deepEqual(parse(serialize(makeDraft(migrated), layers), layers).form, migrated)
  }
  const bare = makeSpec()
  bare.stack.mac = { type: TDMA, attrs: { SlotNum: 3, SlotLen: '6s' } }
  bare.stack.phy.attrs = { txPower: 1.1, transRange: 4500, CustomInherited: 'legacy' }
  bare.protocolAttributes = { [TDMA]: { SlotLen: '8s' } }
  const bareForm = parse(JSON.stringify(bare), layers).form
  assert.deepEqual(bareForm.protocolAttributes[TDMA], { SlotNum: '3', SlotLen: '8s' })
  assert.equal(bareForm.protocolAttributes[PHY].transRange, '4500')
  assert.equal(bareForm.protocolAttributes[PHY].CustomInherited, 'legacy')
  const aliasSpec = structuredClone(bare)
  aliasSpec.stack.phy.type = 'phy-fdm'; aliasSpec.stack.mac.type = 'tdma'
  assert.equal(parse(JSON.stringify(aliasSpec), layers).form.protocolAttributes[PHY].CustomInherited, 'legacy',
    'legacy TypeId aliases migrate explicit attributes under the canonical key')
  for (const range of [undefined, 4321]) {
    const old = document({ ...form(), phyId: 'ns3::UnavailablePhy' }); old.editor.version = 2
    if (range !== undefined) old.editor.form.transRange = range
    assert.equal(parse(JSON.stringify(old), layers).form.protocolAttributes['ns3::UnavailablePhy']?.transRange, range === undefined ? undefined : '4321')
  }
  for (const version of [2, 3]) {
    const old = document({ ...form(), protocolAttributes: { [TDMA]: { SlotLen: 'editing' }, [PHY]: { transRange: '0' } } })
    old.editor.version = version
    old.editor.nodes[0] = { ...old.editor.nodes[0], appId: 'onoff', appDestination: 2, appAttrs: {} }
    old.editor.form.environmentStacks = { radio: { phyId: 'ns3::UnavailableRadioPhy', channelId: 'radio-channel', propagationId: 'radio-propagation', transRange: 7654 } }
    const restored = parse(JSON.stringify(old), layers)
    assert.deepEqual(restored.nodes[0].appAttrs, {}, 'v2/v3 applications never receive legacy defaults twice')
    assert.equal(restored.form.protocolAttributes[TDMA].SlotLen, 'editing')
    assert.equal(restored.form.protocolAttributes[PHY].transRange, '0')
    assert.equal(restored.form.protocolAttributes['ns3::UnavailableRadioPhy'].transRange, '7654')
    assert.ok(!('environmentStacks' in restored.form))
  }
  const v1 = document(); v1.editor.version = 1
  v1.editor.form.trafficId = 'periodic'; v1.editor.nodes[0].appId = 'onoff'
  assert.equal(parse(JSON.stringify(v1), layers).nodes[0].appAttrs.StartTime, '5s')
  assert.deepEqual(parse(serialize(makeDraft(form()), layers), layers).form.protocolAttributes, {})
  const unavailable = document({ ...form(), phyId: 'ns3::Unavailable', protocolAttributes: { 'ns3::Unavailable': { Custom: 'raw' } } })
  assert.equal(parse(JSON.stringify(unavailable), []).form.phyId, 'ns3::Unavailable')
  assert.equal(parse(JSON.stringify(unavailable), []).form.protocolAttributes['ns3::Unavailable'].Custom, 'raw')
}

async function checkEditorAndPresentation(load, { form, nodes, layers, useTopologyEditor, build, generate, parse, serialize, makeDraft, order }) {
  const editor = useTopologyEditor({ value: layers })
  const saved = { form: editor.experimentForm.value, nodes: editor.editNodes.value, selected: editor.selectedIds.value, active: editor.activeCatalogId.value }
  try {
    editor.experimentForm.value = form(); editor.editNodes.value = nodes(8); editor.onSelectionChange([1])
    editor.setProtocolAttribute(TDMA, 'SlotNum', '2')
    for (const [layer, id, field] of [['phy', 'phy-radio', 'phyId'], ['channel', 'radio-channel', 'channelId'], ['channel', 'radio-propagation', 'propagationId'], ['mac', 'tdma', 'macId']]) {
      const before = JSON.parse(JSON.stringify(editor.experimentForm.value))
      const beforeNodes = JSON.parse(JSON.stringify(editor.editNodes.value))
      editor.assignItem({ layer, id })
      assert.deepEqual(JSON.parse(JSON.stringify(editor.experimentForm.value)), { ...before, [field]: id }, 'assigning one layer changes exactly that selection')
      assert.deepEqual(editor.selectedIds.value, [1])
      assert.deepEqual(editor.editNodes.value.map(({ [field]: ignored, ...node }) => node), beforeNodes.map(({ [field]: ignored, ...node }) => node))
    }
    assert.equal(editor.experimentForm.value.protocolAttributes[TDMA].SlotNum, '2')
    for (const [type, key] of [[TDMA, 'SlotNum'], [TDMA, 'SlotLen'], [SWARM, 'InitialRoundDelay'], [PHY, 'transRange']]) {
      editor.setProtocolAttribute(type, key, ''); assert.ok(!(key in editor.experimentForm.value.protocolAttributes[type]))
    }
    const cleared = parse(serialize(makeDraft(editor.experimentForm.value), layers), layers).form
    assert.deepEqual(cleared.protocolAttributes[TDMA], {})
    assert.deepEqual(cleared.protocolAttributes[PHY], {})
    assert.doesNotMatch(generate(build(cleared, nodes(2), layers)), /\{"(?:SlotNum|SlotLen|transRange)",/)
    for (const type of [SWARM, VARIANT, CUSTOM]) {
      const value = { ...form(), macId: type }
      assert.doesNotMatch(generate(build(value, nodes(5), layers)), /\{"NodeCount",/)
      editor.experimentForm.value = value; editor.setProtocolAttribute(type, 'NodeCount', '3')
      assert.match(generate(build(editor.experimentForm.value, nodes(5), layers)), /\{"NodeCount", "3"\}/)
      editor.setProtocolAttribute(type, 'NodeCount', '')
      assert.doesNotMatch(generate(build(editor.experimentForm.value, nodes(5), layers)), /\{"NodeCount",/)
    }
    editor.editNodes.value = nodes(64)
    assert.equal(editor.addNode(), false)
    assert.equal(editor.replaceTopology([{ ...nodes(1)[0], node_id: 65534 }]), true)
    assert.equal(editor.addNode(), true)
    assert.deepEqual(editor.editNodes.value.map((node) => node.node_id), [65534, 1])
    const before = JSON.parse(JSON.stringify(editor.editNodes.value))
    assert.equal(editor.replaceTopology(nodes(65)), false)
    assert.deepEqual(JSON.parse(JSON.stringify(editor.editNodes.value)), before)
  } finally {
    editor.experimentForm.value = saved.form; editor.editNodes.value = saved.nodes
    editor.selectedIds.value = saved.selected; editor.activeCatalogId.value = saved.active
  }

  const { createSSRApp } = await import('vue')
  const { renderToString } = await import('@vue/server-renderer')
  const { default: Attributes } = await load('/src/features/experiment/components/ProtocolAttributes.vue')
  const { default: Drawer } = await load('/src/components/ProtocolDrawer.vue')
  const { default: Panel } = await load('/src/components/ExperimentPanel.vue')
  for (const macId of [SWARM, VARIANT, CUSTOM]) {
    const html = await renderToString(createSSRApp(Attributes, { layers, form: { ...form(), macId }, node: null, ready: true, scope: 'scene' }))
    assert.match(html, /注册默认：11/); assert.doesNotMatch(html, /自动：/)
  }
  const radio = { ...form(), phyId: RADIO, channelId: 'radio-channel', propagationId: 'radio-propagation' }
  const radioHtml = await renderToString(createSSRApp(Attributes, { layers, form: radio, node: null, ready: true, scope: 'scene' }))
  for (const name of ['DataRate', 'transRange', 'RXThresh', 'txPower']) assert.match(radioHtml, new RegExp(`>${name}</span>`))
  assert.match(radioHtml, /光速传播/, 'registered propagation has the same property group as other models')
  const appHtml = await renderToString(createSSRApp(Attributes, { layers, form: form(), node: { ...nodes(1)[0], appId: CUSTOM_APP }, ready: true, scope: 'node' }))
  assert.match(appHtml, /由节点目的地址与公共 Socket 接口连接/)
  assert.match(appHtml, />OffTime<\/span>/)
  const right = await renderToString(createSSRApp(Panel, { form: form(), specJson: '{}', scratchCc: '' }))
  assert.match(right, />simStop<\/span>/)
  for (const name of ['SlotNum', 'SlotLen', 'InitialRoundDelay', 'transRange']) assert.doesNotMatch(right, new RegExp(`>${name}</span>`))
  const drawer = await renderToString(createSSRApp(Drawer, { layers: layers.slice().reverse(), ready: true }))
  for (const activeId of ['mac:swarm', `mac:${SWARM}`]) {
    const activeHtml = await renderToString(createSSRApp(Drawer, { layers, ready: true, activeId }))
    const button = activeHtml.match(/<button(?=[^>]*data-item-id="swarm")[^>]*>/)?.[0]
    assert.match(button || '', /class="[^"]*\bactive\b/, 'aliases and canonical TypeIds highlight the same selected protocol')
  }
  const renderedOrder = [...drawer.matchAll(/class="[^"]*rail-btn[^"]*"[^>]*>([^<]+)<\/button>/g)].map((match) => match[1].trim())
  assert.deepEqual(renderedOrder, ['APP', 'RT', 'MAC', 'PHY', 'CH'], 'dynamic catalogs use the same app-to-channel order')
}
