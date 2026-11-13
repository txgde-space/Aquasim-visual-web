import assert from 'node:assert/strict'
import { h } from 'vue'
import { renderToString } from '@vue/server-renderer'

export async function checkNodeProtocols(server) {
  const load = (file) => server.ssrLoadModule(file)
  const [{ createDefaultExperimentForm, createDefaultTopology, buildExperimentSpec, validateExperiment },
    { serializeExperiment, parseExperiment }, { generateAquaVisualCc }, { deviceProtocolConfigurations },
    { useTopologyEditor, cloneNode }, { default: Attributes }, { protocolRange }] = await Promise.all([
    '/src/features/experiment/lib/experimentSpec.ts', '/src/features/experiment/lib/experimentDocument.ts',
    '/src/features/experiment/lib/generateScratch.ts', '/src/features/experiment/lib/protocolConfiguration.ts',
    '/src/features/experiment/composables/useTopologyEditor.ts', '/src/features/experiment/components/ProtocolAttributes.vue',
    '/src/features/experiment/lib/protocolRange.ts',
  ].map(load))
  const phy = 'ns3::UnlistedPhy', mac = 'ns3::UnlistedMac', routing = 'ns3::UnlistedRouting'
  const channel = 'ns3::UnlistedChannel', propagation = 'ns3::UnlistedPropagation'
  const attr = (name, valueType = 'ns3::UintegerValue', defaultValue = '4', extra = {}) => ({
    name, valueType, defaultValue, help: '', constructible: true, ...extra,
  })
  const item = (typeId, attributes = [], extra = {}) => ({ id: typeId, typeId, label: typeId, source: '', attributes, ...extra })
  const layers = [
    { id: 'phy', label: '物理层', field: 'phyId', items: [item(phy, [attr('transRange', 'ns3::DoubleValue', '1000'), attr('DataRate', 'ns3::DataRateValue', '7kbps'), attr('RxProcessingDelay', 'ns3::TimeValue', '0s')])] },
    { id: 'mac', label: 'MAC', field: 'macId', items: [item(mac, [attr('Token'), attr('SlotNum'), attr('SlotLen', 'ns3::TimeValue', '1s'),
      attr('SetDevice', 'ns3::PointerValue'), attr('ReadOnly', 'ns3::UintegerValue', '0', { constructible: false })])] },
    { id: 'routing', label: '路由', field: 'routingId', items: [item(routing, [attr('RouteOption')])] },
    { id: 'channel', label: '信道', field: 'channelId', items: [item(channel), item(propagation, [], { field: 'propagationId' })] },
    { id: 'app', label: '应用', field: 'appId', items: [] },
  ]
  const form = { ...createDefaultExperimentForm(), phyId: phy, macId: mac, routingId: routing, channelId: channel,
    propagationId: propagation, protocolAttributes: { [mac]: { Token: '1', SlotNum: '4', SlotLen: '1s' }, [phy]: { transRange: '1200', DataRate: '1kbps', RxProcessingDelay: '0ms' } } }
  const nodes = createDefaultTopology(2)
  nodes[0].protocolAttributes = { [mac]: { Token: '2', SlotLen: '500ms' }, [phy]: { transRange: '800', DataRate: '500bps', RxProcessingDelay: '150ms' }, [routing]: { RouteOption: '7' } }
  nodes[1].protocolAttributes = { [mac]: { Token: '0' } }
  const makeSpec = () => buildExperimentSpec(form, nodes, layers)
  let spec = makeSpec()
  const before = JSON.stringify({ form, nodes })
  assert.deepEqual(validateExperiment(spec, layers), [])
  const first = deviceProtocolConfigurations(spec, spec.nodes[0])
  assert.deepEqual(first.find((config) => config.layerId === 'mac').attributes, { Token: '2', SlotNum: '4', SlotLen: '500ms' })
  assert.equal(deviceProtocolConfigurations(spec, spec.nodes[1]).find((config) => config.layerId === 'mac').attributes.Token, '0')
  assert.equal(deviceProtocolConfigurations(spec, spec.nodes[1]).find((config) => config.layerId === 'phy').attributes.transRange, '1200')
  assert.equal(protocolRange(form, layers, nodes[0]), 800, 'range visuals use node overrides before unified settings')
  assert.equal(protocolRange(form, layers, nodes[1]), 1200)
  const code = generateAquaVisualCc(spec, layers)
  const macTable = code.match(/nodeMacAttributes = \{([\s\S]*?)\n    \};/)[1]
  assert.match(macTable, /\{"Token", "2"\}.*\{"SlotLen", "500ms"\}/)
  assert.match(macTable, /\{"Token", "0"\}.*\{"SlotLen", "1s"\}/)
  assert.match(code, /nodePhyAttributes\[i\]/)
  const phyTable = code.match(/nodePhyAttributes = \{([\s\S]*?)\n    \};/)[1]
  assert.match(phyTable, /\{"DataRate", "500bps"\}.*\{"RxProcessingDelay", "150ms"\}/)
  assert.match(phyTable, /\{"DataRate", "1000bps"\}.*\{"RxProcessingDelay", "0ms"\}/)
  const invalidTime = structuredClone(makeSpec()); invalidTime.nodes[0].protocolAttributes[phy].RxProcessingDelay = 'invalid'
  assert.throws(() => generateAquaVisualCc(invalidTime, layers), /RxProcessingDelay/)
  assert.match(code, /nodeRoutingAttributes\[i\]/)
  assert.equal(JSON.stringify({ form, nodes }), before, 'merging and generation cannot mutate source settings')

  const draft = { form, nodes, selectedIds: [1, 2], activeCatalogId: `mac:${mac}` }
  const document = serializeExperiment(draft, layers)
  const restored = parseExperiment(document, [])
  assert.deepEqual(restored.nodes.map((node) => node.protocolAttributes), nodes.map((node) => node.protocolAttributes), 'unknown selections and node overrides round trip before precompile')
  assert.equal(generateAquaVisualCc(buildExperimentSpec(restored.form, restored.nodes, layers), layers), code)
  const bare = JSON.parse(document); delete bare.editor
  assert.deepEqual(parseExperiment(JSON.stringify(bare), layers).nodes.map((node) => node.protocolAttributes), nodes.map((node) => node.protocolAttributes), 'bare specs retain the same per-node settings')
  for (const invalid of [[], 'bad', { [mac]: null }, { [mac]: { Token: { nested: true } } }]) {
    const broken = JSON.parse(document); broken.editor.nodes[0].protocolAttributes = invalid
    assert.throws(() => parseExperiment(JSON.stringify(broken), layers), /对象|标量/)
    const direct = makeSpec(); direct.nodes[0].protocolAttributes = invalid
    assert.ok(validateExperiment(direct, layers).some((message) => /节点 1/.test(message)))
  }
  for (const [attrs, pattern] of [
    [{ [mac]: { Unknown: '1' } }, /节点 1.*没有属性 Unknown/],
    [{ [mac]: { SlotLen: 'editing' } }, /节点 1.*SlotLen/],
    [{ [mac]: { SetDevice: '0' } }, /节点 1.*公共设备接口/],
    [{ [mac]: { ReadOnly: '1' } }, /节点 1.*不允许/],
    [{ [channel]: { Any: '1' } }, /不支持节点协议覆盖/],
    [{ [propagation]: { Any: '1' } }, /不支持节点协议覆盖/],
  ]) {
    const invalid = makeSpec(); invalid.nodes[0].protocolAttributes = attrs
    assert.throws(() => generateAquaVisualCc(invalid, layers), pattern)
  }
  const precedence = makeSpec()
  precedence.protocolAttributes = { ...form.protocolAttributes, [mac]: { SlotLen: 'invalid' } }
  precedence.nodes.forEach((node) => { node.protocolAttributes = { [mac]: { SlotLen: '2s' } } })
  assert.deepEqual(validateExperiment(precedence, layers), [], 'only effective values are checked when all nodes override a unified value')

  const editor = useTopologyEditor({ value: layers })
  const saved = { nodes: editor.editNodes.value, form: editor.experimentForm.value, ids: editor.selectedIds.value, active: editor.activeCatalogId.value }
  try {
    editor.editNodes.value = nodes.map(cloneNode); editor.experimentForm.value = structuredClone(form); editor.selectedIds.value = [1]
    editor.setNodeProtocolAttribute(mac, 'Token', '3')
    assert.equal(editor.editNodes.value[0].protocolAttributes[mac].Token, '3')
    assert.equal(editor.editNodes.value[1].protocolAttributes[mac].Token, '0')
    assert.equal(editor.experimentForm.value.protocolAttributes[mac].Token, '1')
    editor.setNodeProtocolAttribute(mac, 'Token', '')
    assert.equal(deviceProtocolConfigurations(buildExperimentSpec(editor.experimentForm.value, editor.editNodes.value, layers), editor.editNodes.value[0]).find((config) => config.layerId === 'mac').attributes.Token, '1')
    editor.setNodeProtocolAttribute(mac, 'Token', '2', [1, 2])
    editor.editNodes.value[0].protocolAttributes[mac].Token = '3'
    assert.equal(editor.editNodes.value[1].protocolAttributes[mac].Token, '2', 'node maps do not alias after bulk editing')
    assert.equal(nodes[0].protocolAttributes[mac].Token, '2', 'cloning never aliases imported overrides')
    editor.addNode()
    assert.equal(editor.editNodes.value[2].protocolAttributes, undefined, 'new nodes inherit unified configuration rather than copying a sampled override')
    editor.assignItem({ layer: 'mac', id: mac })
    assert.equal(editor.editNodes.value[0].protocolAttributes[mac].Token, '3', 'assigning protocols does not overwrite explicit node parameters')
  } finally {
    editor.editNodes.value = saved.nodes; editor.experimentForm.value = saved.form; editor.selectedIds.value = saved.ids; editor.activeCatalogId.value = saved.active
  }

  const sidebar = await renderToString(h(Attributes, { layers, form, node: null, ready: true, scope: 'scene', layerId: 'mac', embedded: true }))
  assert.doesNotMatch(sidebar, /节点参数覆盖|节点 1 协议覆盖|节点 2 协议覆盖|恢复继承/, 'the sidebar edits unified attributes only')
  const { default: NodeDetails } = await load('/src/features/experiment/components/NodeProtocolDetails.vue')
  for (const node of nodes) {
    const html = await renderToString(h(NodeDetails, { layers, form, nodes, nodeId: node.node_id, ready: true, disabled: false }))
    assert.match(html, new RegExp(`aria-label="节点 ${node.node_id} 协议覆盖"`))
    assert.doesNotMatch(html, new RegExp(`aria-label="节点 ${3 - node.node_id} 协议覆盖"`), 'a card exposes only its own overrides')
    assert.match(html, /节点协议属性/)
    assert.match(html, /继承统一：1s/)
    assert.match(html, /恢复继承/)
    assert.match(html, /data-protocol-attribute="Token"/)
    assert.match(html, /节点应用/)
    const summaries = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((match) => match[1].replace(/<[^>]*>/g, '').trim().split(' · ')[0])
    assert.deepEqual(summaries, ['应用层', '路由', 'MAC', '物理层', '移动模型'], 'node-card protocol order remains stable and mobility stays last')
    const application = html.match(/<details[^>]*class="node-application"[^>]*>/)?.[0]
    assert.ok(application && !/\bopen\b/.test(application), 'the application selector and attributes start in a collapsed layer')
    assert.doesNotMatch(html, /UnlistedChannel|UnlistedPropagation/, 'shared models stay out of node override controls')
  }
  const locked = await renderToString(h(NodeDetails, { layers, form, nodes, nodeId: 1, ready: true, disabled: true }))
  assert.match(locked, /<fieldset\b[^>]*\bdisabled(?:\s|>)/, 'simulation locks both application and node protocol editing')
  console.log('Node protocol regressions passed: generic PHY/MAC/routing overrides, precedence, inheritance, serialization, runtime validation, editor isolation and node-card UI.')
}
