import assert from 'node:assert/strict'
import { ArcRotateCamera, NullEngine, Ray, Scene, Vector3, VertexBuffer } from '@babylonjs/core'

export async function checkNodeModelMeshes(server) {
  const { createNodeEntry, disposeNodeEntry, syncNodeAnnotation } = await server.ssrLoadModule('/src/features/scene3d/lib/factories.ts')
  const { theme3DFor } = await server.ssrLoadModule('/src/features/scene3d/lib/themes3d.ts')
  const { followModelMovement, inspectModel, syncInspectionDepth } = await server.ssrLoadModule('/src/features/scene3d/lib/modelInspection.ts')
  const { NODE_MODEL_OPTIONS, NODE_MODEL_DIMENSIONS } = await server.ssrLoadModule('/src/shared/nodeModel.ts')
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const palette = theme3DFor('industrial-scada')
  // Babylon lazily creates this scene-owned fallback while disposing a mesh's material.
  void scene.defaultMaterial
  // PBR also lazily initializes a scene-owned BRDF lookup texture. It is shared
  // across models and should survive individual node replacements.
  disposeNodeEntry(createNodeEntry(scene, 99, NODE_MODEL_OPTIONS[0].value, palette))
  const initial = { meshes: scene.meshes.length, materials: scene.materials.length, roots: scene.transformNodes.length, textures: scene.textures.length }
  const camera = new ArcRotateCamera('inspection-test',-.9,1.1,9200,Vector3.Zero(),scene)
  camera.lowerRadiusLimit = 2200; camera.upperRadiusLimit = 100000
  inspectModel(camera,new Vector3(1100,1400,2300),53)
  assert.ok(Math.abs(camera.alpha+.9)<.001 && Math.abs(camera.beta-1.1)<.001, 'inspection preserves the current orbit angle')
  assert.ok(Math.abs(camera.radius-95.4)<.001, 'changing target cannot override the explicit model inspection radius')
  inspectModel(camera,new Vector3(1557,950,2333),1.6)
  syncInspectionDepth(camera)
  assert.equal(camera.radius,3, 'metre-sized models are reachable from the broad topology view')
  assert.equal(camera.maxZ,400000, 'near inspection retains the distant seabed and other vessels')
  const beforeFollow = camera.getTarget().clone()
  const orbit = [camera.alpha, camera.beta, camera.radius]
  followModelMovement(camera, new Vector3(0,500,0), new Vector3(80,500,12))
  assert.deepEqual(camera.getTarget().subtract(beforeFollow).asArray(), [80,0,12], 'inspection follows actual displacement without changing depth')
  assert.deepEqual([camera.alpha,camera.beta,camera.radius], orbit, 'following preserves the viewer orbit and scale')
  followModelMovement(camera,new Vector3(80,500,12),new Vector3(0,500,0))
  assert.deepEqual(camera.getTarget().asArray(),beforeFollow.asArray(), 'backward seeking restores the same viewing offset')
  camera.radius=9200;syncInspectionDepth(camera)
  assert.equal(camera.maxZ,400000, 'zooming out restores the ocean-wide depth range')
  const entries = []
  try {
    for (const [index, { value: kind }] of NODE_MODEL_OPTIONS.entries()) {
      const nodeId = index + 1
      const entry = createNodeEntry(scene, nodeId, kind, palette)
      entries.push(entry)
      assert.equal(entry.kind, kind)
      assert.deepEqual(entry.root.position.asArray(), [0, 0, 0], 'model geometry does not supply a simulation position')
      entry.root.position.set(1234, -567, 890)
      entry.root.computeWorldMatrix(true)
      const parts = [entry.base, ...entry.details, entry.progress, entry.marker]
      assert.equal(entry.progress.material.getClassName(), 'StandardMaterial', 'traffic progress retains a separate overlay material')
      for (const mesh of [entry.base, ...entry.details]) {
        const material = mesh.material
        assert.equal(material.getClassName(), 'PBRMaterial', `${kind}: equipment surfaces use PBR materials`)
        assert.notEqual(material, entry.progress.material, 'traffic state cannot share a model surface material')
        assert.ok(Number.isFinite(material.metallic) && material.metallic >= 0 && material.metallic <= 1)
        assert.ok(Number.isFinite(material.roughness) && material.roughness >= 0 && material.roughness <= 1)
        assert.equal(material.alpha, 1, 'opaque equipment avoids transparency-order artifacts')
      }
      assert.ok(new Set([entry.base, ...entry.details].map((mesh) => `${mesh.material.metallic}|${mesh.material.roughness}`)).size > 1,
        `${kind}: painted, metallic and rubber/optical components have distinct surface properties`)
      assert.equal(entry.root.getChildMeshes().length, parts.length, 'all created meshes belong to the disposable node entry')
      for (const mesh of parts) {
        assert.deepEqual(mesh.metadata, { nodeId }, `${kind}: every part resolves to the node when picked`)
        assert.equal(mesh.parent, entry.root)
        assert.equal(mesh.isPickable, true)
        assert.ok(mesh.getTotalVertices() > 0 && mesh.getTotalIndices() > 0, `${kind}: geometry has rendered surfaces`)
        assert.ok(mesh.material, `${kind}: every mesh owns a material`)
        mesh.computeWorldMatrix(true)
      }
      const minimum = new Vector3(Infinity, Infinity, Infinity)
      const maximum = new Vector3(-Infinity, -Infinity, -Infinity)
      for (const mesh of [entry.base, ...entry.details]) {
        const bounds = mesh.getBoundingInfo().boundingBox
        minimum.minimizeInPlace(bounds.minimumWorld)
        maximum.maximizeInPlace(bounds.maximumWorld)
      }
      const extents = maximum.subtract(minimum).asArray()
      assert.ok(Math.abs(minimum.y-entry.root.position.y)<.002, `${kind}: the lowest model surface is at the saved node Z`)
      assert.ok(Math.abs((minimum.x+maximum.x)/2-entry.root.position.x)<.002, `${kind}: longitudinal centre is at the saved node X`)
      assert.ok(Math.abs((minimum.z+maximum.z)/2-entry.root.position.z)<.002, `${kind}: transverse centre is at the saved node Y`)
      const dimension = NODE_MODEL_DIMENSIONS[kind]
      const expected = [dimension.length, dimension.height, dimension.width]
      for (let axis=0;axis<3;axis++) assert.ok(Math.abs(extents[axis]-expected[axis]) < .002, `${kind}: geometry is calibrated in metres on axis ${axis}`)
      syncNodeAnnotation(entry, {globalPosition: new Vector3(1234, -567, 10890), fov: Math.PI / 3}, 800)
      assert.equal(entry.marker.isEnabled(),true, 'distant equipment keeps a selectable screen marker')
      const farScale = entry.marker.scaling.x
      syncNodeAnnotation(entry, {globalPosition: new Vector3(1234, -567, 20890), fov: Math.PI / 3}, 800)
      assert.ok(Math.abs(entry.marker.scaling.x / farScale - 2) < .001, 'marker pixel size stays constant with camera distance')
      syncNodeAnnotation(entry, {globalPosition: new Vector3(1234, -567, 891), fov: Math.PI / 3}, 800)
      assert.equal(entry.marker.isEnabled(),false, 'close inspection shows the physical equipment')
      for(const cameraDistance of [3,100,9200,50000]) {
        syncNodeAnnotation(entry,{globalPosition:new Vector3(1234,-567,890+cameraDistance),fov:Math.PI/3},800)
        assert.ok([entry.base,...entry.details].every(mesh=>mesh.scaling.x===1 && mesh.scaling.y===1 && mesh.scaling.z===1),`${kind}: camera distance never changes equipment scale`)
        const actualMin=new Vector3(Infinity,Infinity,Infinity), actualMax=new Vector3(-Infinity,-Infinity,-Infinity)
        for(const mesh of [entry.base,...entry.details]) {mesh.computeWorldMatrix(true); const box=mesh.getBoundingInfo().boundingBox; actualMin.minimizeInPlace(box.minimumWorld);actualMax.maximizeInPlace(box.maximumWorld)}
        const actualSize=actualMax.subtract(actualMin).asArray()
        for(let axis=0;axis<3;axis++) assert.ok(Math.abs(actualSize[axis]-expected[axis])<.002,`${kind}: world-metre dimensions stay constant at ${cameraDistance} m viewing distance`)
        assert.ok(Math.abs(actualMin.y-entry.root.position.y)<.002,'model keeps its bottom-centre anchor')
        assert.equal(entry.progress.position.y,dimension.height/2,'status annotation stays at the real model centre')
      }
      assert.deepEqual(entry.root.scaling.asArray(),[1,1,1])
      // A material batch can contain a hull and a distant mast; its bounding
      // box center may be empty space. Aim at a real non-degenerate surface.
      const positions = entry.base.getVerticesData(VertexBuffer.PositionKind)
      const indices = entry.base.getIndices()
      let ray
      for (let index = 0; index + 2 < indices.length; index += 3) {
        const vertices = Array.from(indices.slice(index, index + 3), (vertex) => Vector3.TransformCoordinates(
          Vector3.FromArray(positions, vertex * 3), entry.base.getWorldMatrix()))
        const normal = Vector3.Cross(vertices[1].subtract(vertices[0]), vertices[2].subtract(vertices[0]))
        if (normal.lengthSquared() < 1e-8) continue
        normal.normalize()
        const center = vertices[0].add(vertices[1]).add(vertices[2]).scale(1 / 3)
        ray = new Ray(center.add(normal.scale(1000)), normal.negate())
        break
      }
      assert.ok(ray, `${kind}: the model has a non-degenerate pickable surface`)
      const hit = scene.pickWithRay(ray, (mesh) => mesh.metadata?.nodeId === nodeId && mesh !== entry.progress)
      assert.equal(hit?.hit, true, `${kind}: physical model surfaces can be clicked without its progress bubble`)
      assert.equal(hit?.pickedMesh?.metadata?.nodeId, nodeId)
    }
    while (entries.length) {
      const entry = entries.pop()
      const parts = [entry.base, ...entry.details, entry.progress, entry.marker]
      const materials = parts.map((mesh) => mesh.material)
      disposeNodeEntry(entry)
      assert.ok(parts.every((mesh) => mesh.isDisposed()), `${entry.kind}: model replacement removes all geometry`)
      assert.ok(materials.every((material) => !scene.materials.includes(material)), `${entry.kind}: model replacement removes every owned material`)
      assert.equal(scene.transformNodes.includes(entry.root), false)
      for (const other of entries) {
        assert.equal(other.base.isDisposed(), false, 'changing one node does not dispose a neighboring node')
        assert.ok(scene.materials.includes(other.base.material))
      }
    }
    for (let iteration = 0; iteration < 3; iteration++) {
      for (const { value: kind } of NODE_MODEL_OPTIONS) {
        disposeNodeEntry(createNodeEntry(scene, 99, kind, palette))
      }
    }
    assert.deepEqual({ meshes: scene.meshes.length, materials: scene.materials.length, roots: scene.transformNodes.length, textures: scene.textures.length }, initial,
      'repeated model switching leaves no meshes, materials, private textures or root nodes behind')
  } finally {
    scene.dispose()
    engine.dispose()
  }
}
