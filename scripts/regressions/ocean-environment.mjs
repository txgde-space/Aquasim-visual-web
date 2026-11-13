import assert from 'node:assert/strict'
import { ArcRotateCamera, NullEngine, Scene, Vector3, VertexBuffer } from '@babylonjs/core'

export async function checkOceanEnvironment(server) {
  const { SEA_LEVEL_METERS, createOceanEnvironment, oceanLayoutFor, oceanLayoutNeedsRefresh, seabedHeightAt } = await server.ssrLoadModule('/src/features/scene3d/lib/oceanEnvironment.ts')
  const { SEABED_LEVEL_METERS, SEABED_RELIEF_METERS } = await server.ssrLoadModule('/src/features/scene3d/lib/seabedTerrain.ts')
  const { theme3DFor, worldPos, DEPTH_SCALE } = await server.ssrLoadModule('/src/features/scene3d/lib/themes3d.ts')
  const { worldAxisBounds } = await server.ssrLoadModule('/src/features/scene3d/lib/sceneState.ts')
  const { syncWorldAxes, setWorldAxesVisible, disposeWorldAxisEntry } = await server.ssrLoadModule('/src/features/scene3d/lib/worldAxes.ts')
  const topology = [{ x: -1800, y: -700, z: -20 }, { x: 2400, y: 800, z: -100 }]
  const original = structuredClone(topology)
  const layout = oceanLayoutFor(topology)
  assert.equal(worldPos(topology[0]).y, -20 * DEPTH_SCALE, 'negative physical Z lies under the fixed water surface')
  assert.equal(worldPos({ x: 0, y: 0, z: 10 }).y, 10 * DEPTH_SCALE, 'physical Z keeps its actual coordinate mapping')
  assert.equal(worldAxisBounds(topology, DEPTH_SCALE).minY, layout.nodeMinY, 'axes and environment share the same physical Z convention')
  assert.equal(layout.nodeMinY, -100 * DEPTH_SCALE)
  assert.equal(DEPTH_SCALE, 1, 'XYZ all use the same metre scale')
  assert.equal(layout.floorY, -10000)
  assert.equal(SEABED_LEVEL_METERS, -10000)
  const terrainHeights = []
  for (let x = -6000; x <= 6000; x += 750) {
    for (let z = -6000; z <= 6000; z += 750) {
      const height = seabedHeightAt(x, z, layout)
      terrainHeights.push(height)
      assert.ok(Math.abs(height - SEABED_LEVEL_METERS) <= SEABED_RELIEF_METERS)
      assert.equal(height, seabedHeightAt(x, z, oceanLayoutFor([{ x: 50000, y: -40000, z: -15000 } ])), 'node placement cannot move or reshape the seabed')
    }
  }
  assert.ok(Math.max(...terrainHeights) - Math.min(...terrainHeights) > 2000, 'terrain contains substantial ridges and trenches')
  assert.ok(Math.min(...terrainHeights) < -11000 && Math.max(...terrainHeights) > -10000)
  assert.equal(oceanLayoutFor([]), null)
  assert.equal(oceanLayoutFor([{ x: NaN, y: 0 }]), null)
  assert.equal(oceanLayoutNeedsRefresh(layout, { ...layout, centerX: layout.centerX + 10 }), false, 'small edits reuse the existing environment')
  assert.equal(oceanLayoutNeedsRefresh(layout, { ...layout, floorY: layout.floorY - 1000 }), true)
  const engine = new NullEngine(), scene = new Scene(engine)
  const palette = theme3DFor('industrial-scada').ocean
  const camera = new ArcRotateCamera('environment-check-camera', -1, 1, 9000, Vector3.Zero(), scene)
  const warm = createOceanEnvironment(scene, palette); warm.dispose()
  void scene.defaultMaterial
  const baseline = { meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length }
  const originalFog = { mode: scene.fogMode, start: scene.fogStart, end: scene.fogEnd, color: scene.fogColor.asArray() }
  const environment = createOceanEnvironment(scene, palette)
  try {
    assert.equal(environment.sync(topology), true)
    const owned = scene.meshes.filter((mesh) => mesh.metadata?.oceanEnvironment)
    assert.equal(owned.length, 9, 'underwater particles, light shafts and shared-bed caustics add three bounded draws')
    assert.ok(scene.getMeshByName('ocean-seagrass-field').getTotalVertices() > 500)
    assert.ok(scene.getMeshByName('ocean-coral-field').getTotalVertices() > 500)
    assert.ok(scene.getMeshByName('ocean-rock-field').getTotalVertices() > 1000)
    assert.ok(scene.getMeshByName('ocean-surface').getBoundingInfo().boundingBox.extendSize.x >= 50000)
    const daylightLights = scene.lights.filter(light => light.name.startsWith('ocean-'))
    assert.equal(daylightLights.length, 2)
    assert.ok(daylightLights.every(light => light.isEnabled()))
    assert.ok(owned.every((mesh) => !mesh.isPickable && !('nodeId' in mesh.metadata)), 'environment never intercepts node selection')
    const particles = scene.getMeshByName('ocean-suspended-particles')
    const volume = scene.getMeshByName('ocean-water-volume')
    const caustics = scene.getMeshByName('ocean-seabed-caustics')
    assert.equal(particles.getTotalVertices(), 512, 'particle detail is bounded independently of topology size')
    assert.equal(particles.material.pointsCloud, true)
    assert.equal(volume.material.disableDepthWrite, true, 'water tint cannot hide node depth')
    const surface = scene.getMeshByName('ocean-surface')
    assert.equal(SEA_LEVEL_METERS, 500)
    assert.equal(surface.position.y, 500 * DEPTH_SCALE, 'water surface uses physical Z=500 m with the same depth scale as nodes')
    assert.ok(worldPos({ x: 0, y: 0, z: 499 }).y < surface.position.y)
    assert.ok(worldPos({ x: 0, y: 0, z: 501 }).y > surface.position.y)
    const previousDeltaTime = engine.getDeltaTime
    const clockBefore = surface.material._floats.clock
    try {
      engine.getDeltaTime = () => 16
      environment.frame(camera, 0); environment.frame(camera, 0)
      assert.ok(surface.material._floats.clock > clockBefore, 'ambient water keeps moving while replay time is paused')
      environment.setEnabled(false)
      const frozenClock = surface.material._floats.clock
      environment.frame(camera, 0)
      assert.equal(surface.material._floats.clock, frozenClock, 'disabled water does not advance animation')
      environment.setEnabled(true)
    } finally { engine.getDeltaTime = previousDeltaTime }
    const surfaceVertices = surface.getVerticesData(VertexBuffer.PositionKind)
    for (let index = 1; index < surfaceVertices.length; index += 3) assert.equal(surfaceVertices[index], 0)
    const bed = scene.getMeshByName('ocean-seabed')
    const bedVertices = bed.getVerticesData(VertexBuffer.PositionKind)
    assert.ok(Math.abs(bedVertices[0]-layout.centerX)>=200000, 'coarse outer terrain fills the distant view while keeping local grid detail')
    for (let index = 1; index < bedVertices.length; index += 3) assert.ok(Math.abs(bedVertices[index] - layout.floorY) <= layout.relief + 0.01)
    const bedNormals = bed.getVerticesData(VertexBuffer.NormalKind)
    for (let index = 1; index < bedNormals.length; index += 3) {
      assert.ok(bedNormals[index] > 0, 'seabed normals face upward in the actual Babylon left-handed coordinate system')
    }
    assert.equal(bed.getVerticesData(VertexBuffer.ColorKind).length, bed.getTotalVertices() * 4, 'terrain slopes carry sediment and rock shading')
    assert.equal(bed.material.backFaceCulling, true, 'the seabed uses correctly wound front faces instead of hiding the error with double-sided rendering')
    assert.equal(caustics.geometry, bed.geometry, 'moving light patterns share terrain geometry')
    const counts = { meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length }
    for (let frame = 0; frame < 120; frame++) {
      assert.equal(environment.sync(topology), false, 'playback ticks do not rebuild terrain')
      environment.frame(camera, frame / 60)
    }
    assert.deepEqual({ meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length }, counts)
    assert.equal(scene.fogMode, Scene.FOGMODE_LINEAR)
    assert.ok(scene.fogStart >= 30000 && scene.fogEnd >= 140000, 'distant scenery remains visible through light haze')
    assert.deepEqual(scene.getMeshByName('ocean-daylight-sky').position.asArray(), camera.position.asArray(), 'sky follows roaming without moving topology')
    const savedTarget = camera.getTarget().clone()
    camera.setTarget(new Vector3(0, -8000, 0), false, false, true); camera.getViewMatrix(true); environment.frame(camera, 10)
    assert.equal(volume.isEnabled(), true); assert.equal(particles.isEnabled(), true)
    assert.deepEqual(volume.position.asArray(), camera.position.asArray())
    camera.setTarget(new Vector3(0, 20000, 0), false, false, true); camera.getViewMatrix(true); environment.frame(camera, 10)
    assert.equal(volume.isEnabled(), false); assert.equal(particles.isEnabled(), false, 'underwater overlays stop above the sea surface')
    camera.setTarget(savedTarget, false, false, true); camera.getViewMatrix(true); environment.frame(camera, 10)
    environment.setEnabled(false)
    assert.ok(owned.every((mesh) => !mesh.isEnabled()))
    assert.ok(daylightLights.every(light => !light.isEnabled()))
    environment.frame(camera, 60)
    assert.deepEqual({ mode: scene.fogMode, start: scene.fogStart, end: scene.fogEnd, color: scene.fogColor.asArray() }, originalFog,
      'disabled environment restores the scene and does not update on frames')
    environment.setEnabled(true)
    assert.ok(owned.filter(mesh => !mesh.metadata.underwaterEffect).every(mesh => mesh.isEnabled()))
    const enlarged = [...topology, { x: 8500, y: 5000, z: -240 }]
    assert.equal(environment.sync(enlarged), true)
    assert.ok(owned.every((mesh) => mesh.isDisposed()), 'range changes dispose the previous geometry')
    assert.deepEqual({ meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length }, counts,
      'range updates reuse materials and textures')
    assert.equal(environment.sync([]), true)
    assert.equal(scene.meshes.length, baseline.meshes)
    assert.deepEqual(topology, original, 'environment never changes simulation node coordinates')
    const previousCreateCanvas = engine.createCanvas
    const backgrounds = []
    engine.createCanvas = (width, height) => {
      const context = { clearRect() {}, fillRect() { backgrounds.push(this.fillStyle) }, fillText() {}, measureText: (text) => ({ width: String(text).length * 20 }) }
      return { width, height, getContext: () => context, remove() {} }
    }
    const axes = new Map()
    try {
      syncWorldAxes(scene, topology, axes)
      const vertical = axes.get('y')
      const verticalVertices = vertical.line.getVerticesData(VertexBuffer.PositionKind)
      assert.equal(verticalVertices[1], SEA_LEVEL_METERS * DEPTH_SCALE, 'vertical axis begins at the sea surface')
      assert.ok(verticalVertices[4] <= (SEABED_LEVEL_METERS - SEABED_RELIEF_METERS) * DEPTH_SCALE, 'vertical axis points down through the entire seabed range')
      for (const key of ['x', 'z']) {
        const coordinates = axes.get(key).line.getVerticesData(VertexBuffer.PositionKind)
        assert.equal(coordinates[1], SEA_LEVEL_METERS * DEPTH_SCALE)
        assert.equal(coordinates[4], SEA_LEVEL_METERS * DEPTH_SCALE, 'horizontal axes lie on the sea-surface plane')
      }
      const axisResources = { meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length }
      setWorldAxesVisible(axes, false)
      for (const axis of axes.values()) {
        assert.equal(axis.line.isEnabled(), false); assert.equal(axis.tip.isEnabled(), false)
        assert.ok(axis.ticks.every(tick => !tick.isEnabled()) && axis.labels.every(label => !label.plane.isEnabled()))
      }
      setWorldAxesVisible(axes, true)
      assert.deepEqual({ meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length }, axisResources, 'visibility changes reuse all axis resources')
      for (const axis of axes.values()) {
        for (const label of axis.labels) {
          assert.equal(label.plane.renderingGroupId, 2, 'axis text renders above seabed and water rather than being buried')
          assert.equal(label.plane.isPickable, false, 'annotations do not intercept node selection')
          assert.equal(label.material.fogEnabled, false)
          assert.equal(label.material.disableLighting, true, 'ocean lighting cannot darken axis text')
          assert.ok(label.material.alpha >= 0.9, 'axis text keeps readable contrast')
          assert.equal(label.texture.hasAlpha, true)
        }
      }
      assert.ok(backgrounds.length > 0 && backgrounds.every((color) => color !== 'transparent'), 'axis text has a contrasting backing over the sediment texture')
    } finally {
      for (const axis of axes.values()) disposeWorldAxisEntry(axis)
      engine.createCanvas = previousCreateCanvas
    }
  } finally {
    environment.dispose(); environment.dispose()
    assert.deepEqual({ meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length }, baseline,
      'unmount releases all environment geometry, materials and generated textures')
    assert.ok(scene.lights.every(light => !light.name.startsWith('ocean-')), 'environment lights are fully released')
    camera.dispose(); scene.dispose(); engine.dispose()
  }
}
