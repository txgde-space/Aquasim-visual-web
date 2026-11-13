import assert from 'node:assert/strict'
import { effectScope, ref } from 'vue'
import { NullEngine, Scene } from '@babylonjs/core'

export async function checkSceneAssets(server) {
  const [{ SCENE_ASSET_CATALOG, parseReplayScene }, { sceneAssetParts, sceneAssetBounds, sceneAssetLocalPoint }, { useReplayScenery }, { useReplayState },
    { syncSceneAssets, disposeSceneAssetEntry }, { drawSceneAssets, pickSceneAsset }, { THEME_PROFILES }, { seabedElevationMeters }] = await Promise.all([
    '/src/shared/sceneAssets.ts', '/src/shared/sceneAssetGeometry.ts', '/src/features/replay/composables/useReplayScenery.ts',
    '/src/features/replay/composables/useReplayState.ts', '/src/features/scene3d/lib/sceneAssets.ts',
    '/src/features/canvas2d/lib/draw/sceneAssets.ts', '/src/features/canvas2d/lib/themes.ts', '/src/shared/seabedTerrain.ts',
  ].map(path => server.ssrLoadModule(path)))
  const scope = effectScope()
  const playback = { currentTime: ref(0), isPlaying: ref(false), focusedPacketId: ref(null) }
  const state = scope.run(() => useReplayState({ playback }))
  const scenery = scope.run(() => useReplayScenery({ assets: state.sceneAssets, visible: state.sceneAssetsVisible,
    selectedId: state.selectedSceneAssetId, getNodes: () => state.staticModelNodes.value }))
  const originalNodes = JSON.stringify(state.baseNodesState.value), originalPackets = JSON.stringify(state.sourcePacketRows.value)
  try {
    for (const definition of SCENE_ASSET_CATALOG) {
      scenery.add(definition.type)
      assert.equal(state.sceneAssets.value.at(-1).type, definition.type)
      assert.equal(state.sceneAssets.value.at(-1).scale, 1, 'new placements use real proportions')
      assert.ok(sceneAssetParts(definition.type).length >= 10, `${definition.type} has detailed model geometry`)
    }
    assert.ok(sceneAssetBounds('drone').size[0] < 1.7 && sceneAssetBounds('drone').size[1] < 1.7, 'industrial quadrotor has a metre-sized propeller envelope')
    assert.ok(Math.abs(sceneAssetBounds('aircraft').size[0]-53) < .01, 'transport length follows its full-size reference')
    assert.ok(Math.abs(sceneAssetBounds('aircraft').size[1]-51.8) < .01, 'wingspan is independently correct')
    assert.ok(sceneAssetBounds('warship').size[0] > 150 && sceneAssetBounds('warship').size[0] < 155)
    assert.ok(sceneAssetBounds('submarine').size[0] >= 115 && sceneAssetBounds('submarine').size[0] < 117)
    assert.equal(state.sceneAssets.value.length, 8)
    assert.equal(new Set(state.sceneAssets.value.map(asset => asset.id)).size, 8)
    for(const definition of SCENE_ASSET_CATALOG) {
      const {min,max}=sceneAssetBounds(definition.type)
      assert.ok(Math.abs(min[2])<1e-8,`${definition.type}: the asset base is local Z=0`)
      assert.ok(Math.abs(min[0]+max[0])<1e-8 && Math.abs(min[1]+max[1])<1e-8,`${definition.type}: the base pivot is horizontally centred`)
    }
    const coast = state.sceneAssets.value.find(asset=>asset.type==='coast'), command=state.sceneAssets.value.find(asset=>asset.type==='command')
    const ground=sceneAssetLocalPoint('coast',[-500,-280,85])
    assert.ok(Math.abs(command.x-coast.x-ground[0]*coast.scale)<.011)
    assert.ok(Math.abs(command.y-coast.y-ground[1]*coast.scale)<.011)
    assert.ok(Math.abs(command.z-coast.z-ground[2]*coast.scale)<.011,'command compound base sits on the coast ground after both pivots change')
    const wreck = state.sceneAssets.value.find(asset => asset.type === 'wreck')
    assert.ok(Math.abs(wreck.z - seabedElevationMeters(wreck.x, wreck.y)) < .01, 'wreck rests on the actual shared bathymetry')
    assert.equal(state.sceneAssets.value.find(asset => asset.type === 'warship').z + sceneAssetLocalPoint('warship',[0,0,0])[2], 500, 'default ship waterline stays at sea level while its coordinate denotes its keel')
    assert.ok(state.sceneAssets.value.find(asset => asset.type === 'aircraft').z > 500)
    assert.equal(JSON.stringify(state.baseNodesState.value), originalNodes, 'scenery never creates or moves network nodes')
    assert.equal(JSON.stringify(state.sourcePacketRows.value), originalPackets, 'scenery never changes PHY events or packet statistics')
    scenery.setField(wreck.id, 'x', '1.5km')
    scenery.setField(wreck.id, 'heading', '-45')
    scenery.setField(wreck.id, 'scale', '3')
    assert.equal(scenery.selected.value?.type, 'command')
    const edited = state.sceneAssets.value.find(asset => asset.id === wreck.id)
    assert.equal(edited.x, 1500); assert.equal(edited.heading, 315); assert.equal(edited.scale, 3)
    const old = scenery.exportScene()
    scenery.setField(wreck.id, 'z', 'not a distance')
    assert.equal(scenery.exportScene(), old, 'invalid fields do not partially update placement')
    scenery.importScene('{ invalid')
    assert.equal(scenery.exportScene(), old, 'invalid JSON preserves the complete current scene')
    for (const mutation of [
      doc => { doc.assets[0].type = 'auv' }, doc => { doc.assets[0].scale = -1 },
      doc => { doc.assets[0].x = '1km' }, doc => { doc.assets[0].z = Infinity },
      doc => { doc.assets.push({ ...doc.assets[0] }) }, doc => { doc.assets[0].name = 'bad\u0000name' },
    ]) {
      const bad = JSON.parse(old); mutation(bad)
      assert.throws(() => parseReplayScene(bad))
    }
    scenery.importScene(old)
    assert.equal(scenery.error.value, '')
    assert.deepEqual(JSON.parse(scenery.exportScene()), JSON.parse(old), 'scene files round-trip separately from logs')
    scenery.patch(wreck.id, { visible: false })
    state.sceneAssetsVisible.value = false
    scenery.locate(wreck.id)
    assert.equal(state.sceneAssetsVisible.value, true)
    assert.equal(state.sceneAssets.value.find(asset => asset.id === wreck.id).visible, true)
    const revision = scenery.focusRequest.value.revision
    scenery.locate(wreck.id)
    assert.ok(scenery.focusRequest.value.revision > revision, 'repeated locate remains an explicit new camera action')
    scenery.duplicate(wreck.id)
    assert.equal(state.sceneAssets.value.length, 9)
    assert.notEqual(state.selectedSceneAssetId.value, wreck.id)
    scenery.remove(state.selectedSceneAssetId.value)
    assert.equal(state.selectedSceneAssetId.value, null)
    state.scenePanelOpen.value = true
    state.selectedSceneAssetId.value = wreck.id
    const saved = state.captureSnapshot()
    const returned = scope.run(() => useReplayState({ playback }))
    returned.restoreSnapshot(saved)
    assert.equal(returned.sceneAssets.value.length, 8, 'route return retains asset layout')
    assert.equal(returned.scenePanelOpen.value, true)
    assert.equal(returned.selectedSceneAssetId.value, wreck.id)
    returned.applyTopology([])
    assert.equal(returned.sceneAssets.value.length, 0, 'replacing the log/topology clears scenery from unrelated coordinates')

    const engine = new NullEngine(), scene = new Scene(engine), entries = new Map()
    try {
      void scene.defaultMaterial
      syncSceneAssets(scene, [edited], true, entries)
      for (const entry of entries.values()) disposeSceneAssetEntry(entry)
      entries.clear()
      const baseline = [scene.meshes.length, scene.materials.length, scene.transformNodes.length, scene.textures.length]
      syncSceneAssets(scene, state.sceneAssets.value, true, entries)
      assert.equal(entries.size, 8)
      const roots = [...entries.values()].map(entry => entry.root)
      for (const entry of entries.values()) {
        assert.ok(entry.meshes.length <= 8, 'model surfaces are batched instead of one draw per detail')
        assert.deepEqual(entry.root.position.asArray(), [entry.asset.x, entry.asset.z, entry.asset.y])
        for (const mesh of entry.meshes) {
          assert.equal(mesh.material.getClassName(), 'PBRMaterial')
          assert.deepEqual(mesh.metadata, { sceneAssetId: entry.asset.id }, 'asset picking cannot resolve to a network node')
          assert.ok(mesh.getTotalVertices() && mesh.getTotalIndices())
          assert.ok(mesh.getVerticesData('position').every(Number.isFinite))
        }
      }
      for(const entry of entries.values()) {
        const bounds = sceneAssetBounds(entry.asset.type)
        entry.root.position.setAll(0); entry.root.rotation.setAll(0); entry.root.scaling.setAll(1)
        const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity]
        for(const mesh of entry.meshes) {
          mesh.computeWorldMatrix(true)
          const box=mesh.getBoundingInfo().boundingBox
          const lo=box.minimumWorld.asArray(), hi=box.maximumWorld.asArray()
          for(let i=0;i<3;i++) {min[i]=Math.min(min[i],lo[i]);max[i]=Math.max(max[i],hi[i])}
        }
        for(const [axis,world] of [[0,0],[1,2],[2,1]]) {
          assert.ok(Math.abs(min[world]-bounds.min[axis]) < .1, `${entry.asset.type}: lower geometry bound agrees between 2D and 3D`)
          assert.ok(Math.abs(max[world]-bounds.max[axis]) < .1, `${entry.asset.type}: upper geometry bound agrees between 2D and 3D`)
        }
      }
      const anchored=state.sceneAssets.value.map(asset=>({...asset,x:1234,y:-890,z:27,heading:63,scale:2.5}))
      syncSceneAssets(scene,anchored,true,entries)
      for(const entry of entries.values()) {
        let lowest=Infinity
        for(const mesh of entry.meshes) {mesh.computeWorldMatrix(true);lowest=Math.min(lowest,mesh.getBoundingInfo().boundingBox.minimumWorld.y)}
        assert.ok(Math.abs(lowest-27)<.03,`${entry.asset.type}: yaw and scaling keep the bottom at the explicit Z coordinate`)
        assert.deepEqual(entry.root.position.asArray(),[1234,27,-890])
      }
      const count = scene.meshes.length
      syncSceneAssets(scene, state.sceneAssets.value.map(asset => ({ ...asset, x: asset.x + 20 })), false, entries)
      assert.equal(scene.meshes.length, count, 'move/visibility updates never rebuild geometry')
      assert.deepEqual([...entries.values()].map(entry => entry.root), roots)
      assert.ok(roots.every(root => !root.isEnabled()))
      syncSceneAssets(scene, [], true, entries)
      assert.deepEqual([scene.meshes.length, scene.materials.length, scene.transformNodes.length, scene.textures.length], baseline,
        'deletion releases all private geometry, roots, materials and textures')
    } finally { scene.dispose(); engine.dispose() }

    let depth = 0, fills = 0
    const ctx = new Proxy({}, { get: (_, name) => (...values) => {
      if (name === 'save') depth++
      if (name === 'restore') depth--
      if (name === 'fill') fills++
      for (const value of values) if (typeof value === 'number') assert.ok(Number.isFinite(value))
    }, set: () => true })
    drawSceneAssets(ctx, state.sceneAssets.value, (x, y) => ({ x, y }), .5, THEME_PROFILES['industrial-scada'], wreck.id)
    assert.equal(depth, 0); assert.ok(fills > 100, '2D renders the same detailed independent scenery')
    assert.equal(pickSceneAsset([{ ...edited, x: 0, y: 0, heading: 90 }], 0, 40, 2)?.id, wreck.id)
    assert.equal(pickSceneAsset([{ ...edited, visible: false }], edited.x, edited.y, 2), undefined)
  } finally { scope.stop() }
  console.log('Scene assets passed: eight models, node/trace isolation, placement/units, atomic files, route resume, focus, picking, cached meshes and resource disposal.')
}
