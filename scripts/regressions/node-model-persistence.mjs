import assert from 'node:assert/strict'
import { fixtureLayers, selectedForm } from './protocol-fixture.mjs'

export async function checkNodeModelPersistence(server) {
  const [specLib, documentLib, editorLib, { generateAquaVisualCc }, { parseStructuredLog }, modelLib] = await Promise.all([
    '/src/features/experiment/lib/experimentSpec.ts',
    '/src/features/experiment/lib/experimentDocument.ts',
    '/src/features/experiment/composables/useTopologyEditor.ts',
    '/src/features/experiment/lib/generateScratch.ts',
    '/src/features/replay/lib/logParser.ts',
    '/src/shared/nodeModel.ts',
  ].map((file) => server.ssrLoadModule(file)))
  const { createDefaultTopology, createDefaultExperimentForm, buildExperimentSpec, validateExperiment } = specLib
  const { serializeExperiment, parseExperiment } = documentLib
  const { useTopologyEditor, cloneNode } = editorLib
  const { NODE_MODEL_OPTIONS, resolveNodeModel } = modelLib
  const layers = fixtureLayers.map((layer) => ({ ...layer, items: layer.items.map((item) => ({ ...item, attributes: [] })) }))
  const form = selectedForm(createDefaultExperimentForm)
  const nodes = createDefaultTopology(NODE_MODEL_OPTIONS.length)
  assert.ok(nodes.every((node) => node.modelType === 'auv'), 'new nodes have an explicit visual model')
  nodes.forEach((node, index) => { node.modelType = NODE_MODEL_OPTIONS[index].value })
  nodes[1].role = 'sink'
  const draft = { form, nodes, selectedIds: [1, 2], activeCatalogId: '' }
  const document = serializeExperiment(draft, layers)
  const savedDocument = JSON.parse(document)
  const types = nodes.map((node) => node.modelType)
  assert.deepEqual(savedDocument.nodes.map((node) => node.modelType), types)
  assert.deepEqual(savedDocument.editor.nodes.map((node) => node.modelType), types)
  assert.deepEqual(parseExperiment(document, []).nodes.map((node) => node.modelType), types, 'uncompiled editor imports preserve all explicit models')
  const bare = structuredClone(savedDocument); delete bare.editor
  assert.deepEqual(parseExperiment(JSON.stringify(bare), layers).nodes.map((node) => node.modelType), types, 'bare runtime specs also preserve visual metadata')
  assert.deepEqual(nodes.map(cloneNode).map((node) => node.modelType), types)
  assert.equal(resolveNodeModel(nodes[1]), 'rov', 'an explicit model is independent of the sink role')

  for (const invalid of ['unknown-model', null, 3, {}, []]) {
    for (const withEditor of [true, false]) {
      const broken = structuredClone(withEditor ? savedDocument : bare)
      ;(withEditor ? broken.editor.nodes : broken.nodes)[0].modelType = invalid
      assert.throws(() => parseExperiment(JSON.stringify(broken), layers), /节点 1.*modelType/, 'invalid explicit models cannot silently fall back')
    }
    const brokenSpec = buildExperimentSpec(form, nodes, layers)
    brokenSpec.nodes[0].modelType = invalid
    assert.ok(validateExperiment(brokenSpec, layers).some((message) => /节点 1.*modelType/.test(message)))
    assert.throws(() => generateAquaVisualCc(brokenSpec, layers), /节点 1.*modelType/)
  }

  const oldDocument = structuredClone(savedDocument)
  oldDocument.nodes.forEach((node) => { delete node.modelType })
  oldDocument.editor.nodes.forEach((node) => { delete node.modelType })
  const oldDraft = parseExperiment(JSON.stringify(oldDocument), layers)
  assert.ok(oldDraft.nodes.every((node) => !Object.hasOwn(node, 'modelType')), 'old files retain absent metadata rather than silently receiving new values')
  assert.ok(oldDraft.nodes.map(cloneNode).every((node) => !Object.hasOwn(node, 'modelType')))
  assert.doesNotMatch(serializeExperiment(oldDraft, layers), /modelType/)
  assert.equal(resolveNodeModel(oldDraft.nodes[1]), 'vessel', 'old sink appearance remains available without rewriting its saved data')

  const spec = buildExperimentSpec(form, nodes, layers)
  const code = generateAquaVisualCc(spec, layers)
  const metadataLine = (value) => value.split('\n').find((line) => line.includes(`replay << ${JSON.stringify('},"nodes":')} << `))
  const line = metadataLine(code)
  assert.ok(line, 'generated logs contain the original node metadata')
  const metadata = JSON.parse(JSON.parse(line.trim().slice(line.trim().lastIndexOf(' << ') + 4, -1)))
  assert.deepEqual(metadata.map((node) => node.modelType), types)
  assert.deepEqual(metadata.map(({ node_id, role, x, y, z }) => ({ node_id, role, x, y, z })), nodes.map(({ node_id, role, x, y, z }) => ({ node_id, role, x, y, z })))
  const log = parseStructuredLog(JSON.stringify({ nodes: metadata, packets: [] }))
  assert.deepEqual(log.nodes.map((node) => node.modelType), types, 'replay parsing preserves model metadata from simulation output')
  const oldCode = generateAquaVisualCc(buildExperimentSpec(oldDraft.form, oldDraft.nodes, layers), layers)
  assert.equal(code.replace(line, ''), oldCode.replace(metadataLine(oldCode), ''), 'model selection changes only log metadata, never simulation setup or behavior')

  const editor = useTopologyEditor({ value: layers })
  const previous = { nodes: editor.editNodes.value, form: editor.experimentForm.value, selectedIds: editor.selectedIds.value }
  try {
    editor.editNodes.value = nodes.map(cloneNode)
    editor.experimentForm.value = structuredClone(form)
    editor.selectedIds.value = [1, 2, 3]
    const original = structuredClone(nodes)
    editor.onNodeModelChange({ node_id: 2, modelType: 'buoy' })
    assert.deepEqual(editor.editNodes.value.map((node) => node.modelType), ['auv', 'buoy', 'vessel', 'buoy', 'sensor'], 'a card changes its own node even with multiple nodes selected')
    assert.deepEqual(editor.editNodes.value.map(({ modelType, ...node }) => node), nodes.map(cloneNode).map(({ modelType, ...node }) => node), 'model changes preserve IDs, roles, coordinates, protocols and application settings')
    assert.deepEqual(nodes, original, 'editing a cloned draft does not change the source')
    editor.onNodeModelChange({ node_id: 60000, modelType: 'sensor' })
    assert.equal(editor.editNodes.value.length, nodes.length)
    editor.addNode({ x: 10, y: 20, z: -30 })
    assert.equal(editor.editNodes.value.at(-1).modelType, 'auv', 'adding a node sets the default explicitly')
    assert.equal(editor.replaceTopology(oldDraft.nodes), true)
    assert.ok(editor.editNodes.value.every((node) => !Object.hasOwn(node, 'modelType')), 'topology replacement preserves legacy metadata absence')
  } finally {
    editor.editNodes.value = previous.nodes
    editor.experimentForm.value = previous.form
    editor.selectedIds.value = previous.selectedIds
  }
  console.log('Node model persistence regressions passed: imports, exports, validation, legacy absence, clones, per-node edits and replay metadata without simulation changes.')
}
