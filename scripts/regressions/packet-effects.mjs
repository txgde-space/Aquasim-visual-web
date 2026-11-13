import assert from 'node:assert/strict'
import { ArcRotateCamera, Matrix, NullEngine, Scene, Vector3, Viewport } from '@babylonjs/core'
import { h } from 'vue'
import { renderToString } from '@vue/server-renderer'

export async function checkPacketEffects(server) {
  const [{ signalWindow }, { createPacketEntry, disposePacketEntry }, { syncPacketPresentation, syncPacketAnnotationSize }, { theme3DFor }, { inspectModel, syncInspectionDepth }] = await Promise.all([
    '/src/features/scene3d/lib/signalTimeline.ts', '/src/features/scene3d/lib/factories.ts',
    '/src/features/scene3d/lib/packetEffects.ts', '/src/features/scene3d/lib/themes3d.ts',
    '/src/features/scene3d/lib/modelInspection.ts',
  ].map(file => server.ssrLoadModule(file)))
  const packet = { tx_start_us: 0, tx_duration_us: 1e6 }
  const receiver = { rx_start_us: 2e6, rx_end_us: 3e6, status: 'fail', reason: 'collision_rx_rx', collision_start_us: 2.5e6 }
  assert.deepEqual(signalWindow(packet, receiver, 1.5e6), { active: true, front: .75, tail: .25, receiving: false })
  assert.equal(signalWindow(packet, receiver, -1).active, false)
  assert.equal(signalWindow({ ...packet, tx_committed: false }, receiver, 1e6).active, false)
  assert.equal(signalWindow(packet, receiver, 3e6+1).active, false)
  assert.deepEqual(signalWindow(packet, { rx_start_us: 0, rx_end_us: 1e6 }, .5e6), { active: true, front: 1, tail: 0, receiving: true })
  const engine = new NullEngine(), scene = new Scene(engine)
  engine.useReverseDepthBuffer = true
  const camera = new ArcRotateCamera('signals', -.9, 1.1, 9200, Vector3.Zero(), scene)
  const palette = theme3DFor('industrial-scada')
  const entry = createPacketEntry(scene, 'event', 2, Vector3.Zero(), new Vector3(1500,0,0), palette, palette.tx)
  try {
    syncPacketPresentation(entry, packet, receiver, 1.5e6, palette, 1)
    assert.equal(entry.block.position.x, 750)
    assert.equal(entry.block.scaling.y, 750, 'signal band is exactly the occupied path length without an 80 m minimum')
    assert.equal(entry.head.position.x, 1125)
    assert.equal(entry.marker.isEnabled(), false, 'future reception is not announced')
    syncPacketPresentation(entry, packet, receiver, 2.4e6, palette, 1)
    assert.equal(entry.marker.material.diffuseColor, palette.rx, 'recorded future collision remains receiving until the collision time')
    assert.equal(entry.result.isEnabled(), false)
    syncPacketPresentation(entry, packet, receiver, 2.6e6, palette, 1)
    assert.equal(entry.marker.material.diffuseColor, palette.bad)
    assert.equal(entry.result.isEnabled(), true)
    assert.equal(entry.block.material.diffuseColor, palette.tx, 'a receiver collision does not recolor the emitted signal')
    for (const distance of [30, 3000, 30000]) {
      camera.setPosition(new Vector3(750,0,distance)); camera.getViewMatrix(true)
      syncPacketAnnotationSize(entry, camera, 800)
      const scale = 2*Vector3.Distance(camera.globalPosition,entry.block.position)*Math.tan(camera.fov/2)/800
      assert.ok(Math.abs(entry.block.scaling.x/scale-2)<1e-5, 'signal width is 2 pixels at close and distant views')
    }
    const counts = [scene.meshes.length, scene.materials.length]
    for(let i=0;i<300;i++) syncPacketPresentation(entry,packet,receiver,i*10000,palette,1)
    assert.deepEqual([scene.meshes.length,scene.materials.length],counts, 'playback ticks reuse every signal mesh and material')
    syncPacketPresentation(entry, packet, receiver, 3e6, palette, 1)
    assert.equal(entry.block.isEnabled(), false, 'no artificial signal tail after reception ends')
    camera.beta = 1.1
    inspectModel(camera,new Vector3(0,500,0),1.6);syncInspectionDepth(camera)
    camera.getViewMatrix(true)
    camera.getProjectionMatrix(true)
    const eye = camera.position.clone(), direction = camera.getTarget().subtract(eye).normalize()
    const bed = eye.add(direction.scale((-10000-eye.y)/direction.y))
    const projected = Vector3.Project(bed,Matrix.Identity(),camera.getTransformationMatrix(),new Viewport(0,0,800,600))
    assert.ok(projected.z>=0 && projected.z<=1, `the -10 km seabed remains inside the focused camera depth range: ${JSON.stringify({eye,direction,bed,projected,minZ:camera.minZ,maxZ:camera.maxZ})}`)
    const fleet = Vector3.Project(eye.add(direction.scale(6000)),Matrix.Identity(),camera.getTransformationMatrix(),new Viewport(0,0,800,600))
    assert.ok(fleet.z>=0 && fleet.z<=1, 'other vessels beyond 3 km are not clipped in a close inspection')
    assert.ok([entry.line,entry.block,entry.head,entry.marker,entry.result].every(mesh=>!mesh.isPickable), 'communication annotations cannot intercept model selection')
  } finally { disposePacketEntry(entry); scene.dispose(); engine.dispose() }
  const { default: Overview } = await server.ssrLoadModule('/src/features/scene3d/SceneOverview.vue')
  const nodes = [{ node_id:1,name:'船',x:10000,y:10000,z:498.9 },{ node_id:2,name:'艇',x:10100,y:10000,z:360 }]
  const overview = await renderToString(h(Overview,{ nodes,bounds:nodes,visuals:[{ node_id:2,mode:'collision',overlay:{kind:'collision_rx_rx'} }],
    packets:[{ ...packet,src:1,eventId:'a',receivers:[{...receiver,dst:2}] }],currentTime:2.6e6,viewedNodeId:1 }))
  assert.match(overview,/聚焦 船（1）/)
  assert.match(overview,/聚焦 艇（2）/, 'close inspection never removes other nodes from the overview')
  assert.match(overview,/overview-node bad/, 'observed receiver failure is shown in the overview')
  assert.match(overview,/overview-focus/, 'the currently inspected node is identified independently of packet filtering')
  assert.ok(!overview.includes('NaN'))
  const empty = await renderToString(h(Overview,{nodes:[],bounds:[],visuals:[],packets:[],currentTime:0,viewedNodeId:null}))
  assert.ok(!empty.includes('NaN') && !empty.includes('Infinity'), 'empty/single-axis topology does not create invalid SVG positions')
  console.log('3D communication passed: observed timing, direction and occupied length, local collision glyph, stable pixel widths, caching, full ocean/fleet depth and disposal.')
}
