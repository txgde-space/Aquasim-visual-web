import assert from 'node:assert/strict'
import { effectScope, h, ref } from 'vue'
import { readFileSync } from 'node:fs'
import { renderToString } from '@vue/server-renderer'
import { fixtureLayers, selectedForm } from './protocol-fixture.mjs'

export async function checkNodeMobilityEditor(server) {
  const [{ createDefaultTopology, createDefaultExperimentForm, buildExperimentSpec, validateExperiment },
    { parseExperiment, serializeExperiment }, { cloneNode, nodesFromReplay, useTopologyEditor },
    { TYPEID_LAYERS }, { default: NodeDetails }, { default: Attributes }, { attributeEditState }] = await Promise.all([
    '/src/features/experiment/lib/experimentSpec.ts', '/src/features/experiment/lib/experimentDocument.ts',
    '/src/features/experiment/composables/useTopologyEditor.ts', '/src/features/experiment/lib/typeIdCatalog.ts',
    '/src/features/experiment/components/NodeProtocolDetails.vue', '/src/features/experiment/components/ProtocolAttributes.vue',
    '/src/features/experiment/lib/protocolMetadata.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const firstType = 'ns3::LessonMotion', secondType = 'ns3::OtherMotion'
  const attr = (name, valueType, defaultValue, extra = {}) => ({ name, valueType, defaultValue, help: '', constructible: true, ...extra })
  const item = (typeId, attributes) => ({ id: typeId, typeId, label: typeId.replace('ns3::', ''), source: '', attributes })
  const position = attr('Position', 'ns3::Vector3DValue', '0:0:0')
  const velocity = attr('Velocity', 'ns3::Vector3DValue', '0:0:0', { constructible: false, writable: false })
  const first = item(firstType, [position, velocity, attr('InitialVelocity', 'ns3::Vector3DValue', '2:0:0', { help: '[unit=m/s]' }), attr('Step', 'ns3::TimeValue', '250ms')])
  const second = item(secondType, [position, attr('Speed', 'ns3::DoubleValue', '3', { help: '[unit=m/s]' })])
  const layers = [...fixtureLayers.map((layer) => ({ ...layer, items: layer.items.map((entry) => ({ ...entry, attributes: [] })) })),
    { id: 'mobility', label: '移动模型', field: 'mobilityId', scope: 'node', items: [first, second] }]
  const form = selectedForm(createDefaultExperimentForm)
  const nodes = createDefaultTopology(2)
  assert.ok(nodes.every((node) => !Object.hasOwn(node, 'mobility')), 'new nodes stay fixed until an explicit mobility selection')
  assert.deepEqual(TYPEID_LAYERS.find((layer) => layer.id === 'mobility'), { id: 'mobility', label: '移动模型', field: 'mobilityId', scope: 'node', items: [] }, 'the initial catalog has no guessed mobility classes')
  nodes[0].mobility = { type: firstType }
  nodes[0].protocolAttributes = { [firstType]: { InitialVelocity: '1m/s:0:0', Step: '500ms' }, [secondType]: { Speed: '2m/s' } }
  const draft = { form, nodes, selectedIds: [1, 2], activeCatalogId: '' }
  const document = serializeExperiment(draft, layers)
  const json = JSON.parse(document)
  assert.deepEqual(json.nodes[0].mobility, { type: firstType })
  assert.deepEqual(json.editor.nodes[0].mobility, { type: firstType })
  assert.deepEqual(parseExperiment(document, []).nodes[0].mobility, nodes[0].mobility)
  assert.deepEqual(parseExperiment(document, []).nodes[0].protocolAttributes, nodes[0].protocolAttributes, 'selected and inactive attributes round trip even before precompile')
  const bare = structuredClone(json); delete bare.editor
  const restoredBare = parseExperiment(JSON.stringify(bare), layers)
  assert.deepEqual(restoredBare.nodes[0].mobility, nodes[0].mobility)
  assert.deepEqual(restoredBare.nodes[0].protocolAttributes, nodes[0].protocolAttributes)
  assert.ok(!Object.hasOwn(restoredBare.nodes[1], 'mobility'), 'old fixed nodes never receive a hidden model selection')
  const clone = cloneNode(nodes[0]); clone.mobility.type = secondType; clone.protocolAttributes[firstType].Step = '1s'
  assert.equal(nodes[0].mobility.type, firstType)
  assert.equal(nodes[0].protocolAttributes[firstType].Step, '500ms', 'clones cannot mutate the source mobility or attributes')
  assert.deepEqual(validateExperiment(buildExperimentSpec(form, nodes, layers), layers), [])
  const inactive = buildExperimentSpec(form, nodes, layers)
  inactive.nodes[0].protocolAttributes = { ...inactive.nodes[0].protocolAttributes, [secondType]: { Speed: 'still editing' } }
  assert.deepEqual(validateExperiment(inactive, layers), [], 'inactive mobility inputs remain saved without being executed or validated as the selected model')
  const misplaced = buildExperimentSpec(form, nodes, layers)
  misplaced.protocolAttributes = { ...misplaced.protocolAttributes, [firstType]: { Step: '20ms' } }
  assert.ok(validateExperiment(misplaced, layers).some((issue) => /移动模型属性必须放在节点 protocolAttributes/.test(issue)), 'misplaced unified attributes report an error rather than being silently ignored')
  const unknown = structuredClone(json)
  unknown.editor.nodes[0].mobility.type = 'ns3::UnavailableMobility'
  unknown.editor.nodes[0].protocolAttributes['ns3::UnavailableMobility'] = { Saved: '7' }
  const unknownDraft = parseExperiment(JSON.stringify(unknown), layers)
  assert.equal(unknownDraft.nodes[0].mobility.type, 'ns3::UnavailableMobility')
  assert.equal(unknownDraft.nodes[0].protocolAttributes['ns3::UnavailableMobility'].Saved, '7')
  assert.ok(validateExperiment(buildExperimentSpec(unknownDraft.form, unknownDraft.nodes, layers), layers).some((issue) => /mobility 未注册协议.*UnavailableMobility/.test(issue)), 'unknown mobility never falls back to fixed position at runtime')
  for (const invalid of [null, [], 'moving', {}, { type: 1 }, { type: '' }, { type: firstType, attrs: { Speed: '1' } }]) {
    const broken = structuredClone(json); broken.editor.nodes[0].mobility = invalid
    assert.throws(() => parseExperiment(JSON.stringify(broken), layers), /节点 1.*移动模型/)
  }
  assert.deepEqual(attributeEditState(first, position, 'mobility'), { editable: false, managed: true, reason: '由节点坐标设置初始位置' })
  assert.equal(attributeEditState(first, velocity, 'mobility').editable, false)
  for (const [name, value, pattern] of [['Position', '9:8:7', /由节点坐标/], ['Velocity', '1:0:0', /不允许/], ['Missing', '3', /没有属性 Missing/]]) {
    const broken = buildExperimentSpec(form, nodes, layers)
    broken.nodes[0].protocolAttributes = { [firstType]: { [name]: value } }
    assert.ok(validateExperiment(broken, layers).some((issue) => pattern.test(issue)))
  }

  const editor = useTopologyEditor({ value: layers })
  const saved = { nodes: editor.editNodes.value, form: editor.experimentForm.value, ids: editor.selectedIds.value, active: editor.activeCatalogId.value }
  try {
    editor.editNodes.value = nodes.map(cloneNode); editor.experimentForm.value = structuredClone(form); editor.selectedIds.value = [1, 2]
    editor.setNodeMobility(1, secondType)
    assert.equal(editor.editNodes.value[0].mobility.type, secondType)
    assert.equal(editor.editNodes.value[1].mobility, undefined, 'a node card ignores the other selected nodes')
    editor.setNodeProtocolAttribute(secondType, 'Speed', '4m/s', [1])
    editor.setNodeMobility(1, firstType)
    assert.equal(editor.editNodes.value[0].protocolAttributes[firstType].Step, '500ms')
    assert.equal(editor.editNodes.value[0].protocolAttributes[secondType].Speed, '4m/s', 'switching models retains inactive overrides by TypeId')
    assert.deepEqual(editor.experimentForm.value, form, 'mobility never changes the global protocols or parameters')
    editor.setNodeMobility(1, '')
    assert.ok(!Object.hasOwn(editor.editNodes.value[0], 'mobility'))
    assert.equal(editor.editNodes.value[0].protocolAttributes[firstType].Step, '500ms')
    editor.assignItem({ layer: 'mobility', id: firstType }, [1, 2])
    assert.deepEqual(editor.experimentForm.value, form, 'node-owned layers cannot write hidden fields into the unified form')
  } finally {
    editor.editNodes.value = saved.nodes; editor.experimentForm.value = saved.form; editor.selectedIds.value = saved.ids; editor.activeCatalogId.value = saved.active
  }

  const html = await renderToString(h(NodeDetails, { nodeId: 1, nodes, layers, form, ready: true, disabled: false }))
  const summaries = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((match) => match[1].replace(/<[^>]*>/g, '').trim().split(' · ')[0])
  assert.deepEqual(summaries, ['应用层', '路由', 'MAC', '物理层', '移动模型'], 'mobility is the final collapsible block in the node card')
  assert.match(html, /aria-label="节点移动模型"/)
  assert.match(html, /value="ns3::LessonMotion"/)
  assert.match(html, /value="ns3::OtherMotion"/)
  assert.match(html, /data-protocol-attribute="InitialVelocity"/)
  assert.match(html, /由节点坐标设置初始位置/)
  assert.doesNotMatch(html, /class="node-mobility"[^>]*\bopen/)
  const sceneHtml = await renderToString(h(Attributes, { scope: 'scene', layers, form, node: nodes[0], ready: true }))
  assert.doesNotMatch(sceneHtml, /InitialVelocity|LessonMotion|OtherMotion/, 'mobility attributes are absent from global protocol editing')
  const unknownHtml = await renderToString(h(NodeDetails, { nodeId: 1, nodes: unknownDraft.nodes, layers, form, ready: true, disabled: false }))
  assert.match(unknownHtml, /ns3::UnavailableMobility（未注册）/)
  const locked = await renderToString(h(NodeDetails, { nodeId: 1, nodes, layers, form, ready: true, disabled: true }))
  assert.match(locked, /<fieldset\b[^>]*\bdisabled(?:\s|>)/)

  // Follow the same static replay -> session clone -> experiment conversion as
  // the actual "从回放导入" action, including a moving node's original units.
  const [{ parseLog }, { useReplayState }, { cloneNode: cloneReplayNode }] = await Promise.all([
    '/src/features/replay/lib/logParser.ts', '/src/features/replay/composables/useReplayState.ts',
    '/src/features/replay/composables/useEditMode.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const scope = effectScope()
  const playback = { currentTime: ref(0), isPlaying: ref(false), focusedPacketId: ref(null) }
  const linearType = 'ns3::AquaVisualLinearMobilityModel'
  const transferLayers = layers.map((layer) => layer.id === 'mobility'
    ? { ...layer, items: [...layer.items, item(linearType, first.attributes)] } : layer)
  const raw = {
    meta: { sim_end_us: 16e6 },
    nodes: [
      { node_id: 1, name: 'Node-1', x: 0, y: 0, z: -50, role: 'node', modelType: 'auv' },
      { node_id: 2, name: 'Moving receiver', x: 100, y: 0, z: -50, role: 'node', modelType: 'auv',
        mobility: { type: linearType }, protocolAttributes: { [linearType]: { InitialVelocity: '0.02km/s:0:0' } },
        movements: [{ start_us: 0, end_us: 16e6, to_x: 420, to_y: 0, to_z: -50 }] },
    ], packets: [],
  }
  const previous = { nodes: editor.editNodes.value, form: editor.experimentForm.value, ids: editor.selectedIds.value }
  try {
    const replay = scope.run(() => useReplayState({ playback }))
    replay.applyParsedLog(parseLog(JSON.stringify(raw)))
    playback.currentTime.value = 8e6
    assert.equal(replay.nodesState.value[1].x, 260, 'the fixture is actively moving in replay')
    const sessionNodes = replay.staticModelNodes.value.map(cloneReplayNode)
    assert.equal(sessionNodes[1].x, 100, 'the session transfers the initial topology rather than the current frame')
    const imported = nodesFromReplay(sessionNodes, form)
    assert.equal(editor.replaceTopology(imported), true)
    assert.deepEqual(editor.editNodes.value[1].mobility, { type: linearType })
    assert.equal(editor.editNodes.value[1].protocolAttributes[linearType].InitialVelocity, '0.02km/s:0:0')
    assert.equal(editor.editNodes.value[1].x, 100)
    const transferredHtml = await renderToString(h(NodeDetails, { nodeId: 2, nodes: editor.editNodes.value, layers: transferLayers, form, ready: true, disabled: false }))
    assert.match(transferredHtml, /移动模型 · AquaVisualLinearMobilityModel/)
    assert.match(transferredHtml, /value="0\.02km\/s:0:0"/)
    const exported = parseExperiment(serializeExperiment({ form, nodes: editor.editNodes.value, selectedIds: [], activeCatalogId: '' }, transferLayers), transferLayers)
    assert.deepEqual(exported.nodes[1].mobility, { type: linearType })
    assert.equal(exported.nodes[1].protocolAttributes[linearType].InitialVelocity, '0.02km/s:0:0')
    imported[1].mobility.type = 'ns3::ChangedAfterImport'
    imported[1].protocolAttributes[linearType].InitialVelocity = '99:0:0'
    assert.equal(replay.baseNodesState.value[1].mobility.type, linearType, 'experiment metadata does not alias the original replay')
    assert.equal(replay.baseNodesState.value[1].protocolAttributes[linearType].InitialVelocity, '0.02km/s:0:0')
    assert.equal(editor.editNodes.value[1].mobility.type, linearType)

    replay.applyTopology(editor.editNodes.value)
    assert.equal(replay.nodeMovementRows.value.length, 0, 'preview topology does not retain the old simulation trajectory')
    assert.deepEqual(replay.staticModelNodes.value[1].mobility, { type: linearType }, 'experiment preview keeps the configured model without pretending it has run')
    assert.equal(replay.staticModelNodes.value[1].protocolAttributes[linearType].InitialVelocity, '0.02km/s:0:0')
    editor.editNodes.value[1].protocolAttributes[linearType].InitialVelocity = '33:0:0'
    assert.equal(replay.staticModelNodes.value[1].protocolAttributes[linearType].InitialVelocity, '0.02km/s:0:0', 'preview metadata has its own detached snapshot')
    const roundTrip = nodesFromReplay(replay.staticModelNodes.value.map(cloneReplayNode), form)
    assert.deepEqual(roundTrip[1].mobility, { type: linearType })
    assert.equal(roundTrip[1].protocolAttributes[linearType].InitialVelocity, '0.02km/s:0:0')
  } finally {
    scope.stop()
    editor.editNodes.value = previous.nodes; editor.experimentForm.value = previous.form; editor.selectedIds.value = previous.ids
  }
  const experimentPage = readFileSync(new URL('../../src/pages/ExperimentPage.vue', import.meta.url), 'utf8')
  assert.match(experimentPage, /replaceTopology\(nodesFromReplay\(source, experimentForm\.value\)\)/, 'the page action uses the verified metadata-preserving converter')
  console.log('Node mobility editor regressions passed: dynamic models, single-node configuration, shared attributes, fixed-position defaults, unknown imports, round trips, managed position and raw-log/replay/experiment transfer.')
}
