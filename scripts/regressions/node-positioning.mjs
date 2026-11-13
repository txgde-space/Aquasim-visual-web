import assert from 'node:assert/strict'
import {createRenderer,h,nextTick,ref,ssrContextKey} from 'vue'

export async function checkNodePositioning(server) {
  const [{positionAtDistance},{parseCanvasState},{default:NodeCanvas},{useTopologyEditor},{experimentDraft},{serializeExperiment,parseExperiment}] = await Promise.all([
    '/src/features/canvas2d/lib/nodeDistance.ts','/src/shared/canvasState.ts','/src/components/NodeCanvas.vue',
    '/src/features/experiment/composables/useTopologyEditor.ts','/src/features/experiment/composables/experimentDraft.ts',
    '/src/features/experiment/lib/experimentDocument.ts',
  ].map(file=>server.ssrLoadModule(file)))
  const a={x:100,y:200,z:-20},b={x:400,y:600,z:-50}
  for(const distance of [30,250,1500]) {
    const next=positionAtDistance(a,b,distance)
    assert.ok(Math.abs(Math.hypot(next.x-a.x,next.y-a.y,next.z-a.z)-distance)<1e-7)
    assert.equal(next.z,b.z,'distance editing keeps depth')
    assert.ok(Math.abs((next.x-a.x)*400-(next.y-a.y)*300)<1e-7,'bearing remains unchanged')
  }
  for(const distance of [-1,NaN,Infinity,20,Number.MAX_VALUE]) assert.throws(()=>positionAtDistance(a,b,distance))
  assert.throws(()=>positionAtDistance(a,a,100),/重合/)
  assert.deepEqual(positionAtDistance(a,a,0),a)
  const globals=new Map(['window','document','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,globalThis[key]]))
  const saved={nodes:experimentDraft.nodes.value,selected:experimentDraft.selectedIds.value,canvas:experimentDraft.canvas.value}
  const renderer=createRenderer({createElement:()=>({}),createText:()=>({}),createComment:()=>({}),insert(){},remove(){},setText(){},setElementText(){},patchProp(){},parentNode:()=>null,nextSibling:()=>null})
  let frameId=0;const frames=new Map()
  globalThis.window=new EventTarget();globalThis.document=new EventTarget()
  globalThis.ResizeObserver=class{observe(){}disconnect(){}}
  globalThis.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId}
  globalThis.cancelAnimationFrame=id=>frames.delete(id)
  const Canvas={...NodeCanvas,render:()=>null}
  let app,editor
  try {
    let canvasState
    app=renderer.createApp({setup(){
      editor=useTopologyEditor(ref([]))
      editor.editNodes.value=[{node_id:1,name:'A',x:0,y:0,z:-20},{node_id:2,name:'B',x:1000,y:0,z:-20},{node_id:3,name:'C',x:0,y:1000,z:-20}]
      editor.canvas.value=undefined;editor.selectedIds.value=[1,2]
      return ()=>h(Canvas,{nodes:editor.canvasNodes.value,currentTime:0,editMode:true,boxSelect:true,
        persistState:true,allowPositionLock:true,allowCoordinateEdit:true,
        'onCanvas-state':state=>{canvasState=state;editor.canvas.value=state},
        'onNodes-move':editor.onNodesMove,'onNode-move':editor.onNodeMove,'onSelection-change':editor.onSelectionChange,'onNode-select':editor.onNodeSelect})
    }})
    app.provide(ssrContextKey,{modules:new Set()});app.mount({});await nextTick()
    const canvas=app._instance.subTree.component.setupState
    const fakeCanvas={getBoundingClientRect:()=>({left:0,top:0}),getContext:()=>null,setPointerCapture(){},releasePointerCapture(){},removeEventListener(){},focus(){}}
    canvas.canvasEl=fakeCanvas;canvas.snapping.enabled=false
    const mouse=(type,x,y)=>({type,button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}})
    canvas.positioning.toggle(1);await nextTick()
    assert.deepEqual(canvasState.lockedNodeIds,[1],'pin updates the actual experiment canvas snapshot')
    const start=canvas.toScreen(0,0)
    canvas.onCanvasPointerDown(mouse('pointerdown',start.x,start.y));canvas.onPointerMove(mouse('pointermove',start.x+60,start.y+40));canvas.onPointerUp(mouse('pointerup',start.x+60,start.y+40))
    assert.equal(editor.editNodes.value[0].x,0,'pinned node cannot start a drag')
    assert.equal(editor.editNodes.value[0].y,0)
    editor.selectedIds.value=[1,2];await nextTick()
    const moving=canvas.toScreen(1000,0)
    canvas.onCanvasPointerDown(mouse('pointerdown',moving.x,moving.y));canvas.onPointerMove(mouse('pointermove',moving.x+70,moving.y));canvas.onPointerUp(mouse('pointerup',moving.x+70,moving.y));await nextTick()
    assert.equal(editor.editNodes.value[0].x,0,'group drag skips the fixed member')
    assert.notEqual(editor.editNodes.value[1].x,1000,'the unlocked member still moves')
    editor.onNodeCoordinate({node_id:1,axis:'z',value:40});editor.onNodesMove([{node_id:1,x:500,y:500}])
    assert.deepEqual([editor.editNodes.value[0].x,editor.editNodes.value[0].y,editor.editNodes.value[0].z],[0,0,-20],'editor independently rejects coordinate changes to pinned nodes')
    canvas.measure.measurementLines.value=[{id:'distance',start:{nodeId:1,x:0,y:0,z:-20},end:{nodeId:2,x:1000,y:0,z:-20},distance:1000}]
    canvas.measure.selectedMeasurementId.value='distance';await nextTick()
    assert.deepEqual(canvas.positioning.options.value.map(option=>option.id),[2],'only the unpinned endpoint can move')
    canvas.positioning.input.value='2km';canvas.positioning.apply();await nextTick()
    assert.equal(editor.editNodes.value[1].x,2000)
    assert.equal(editor.editNodes.value[0].x,0)
    assert.equal(editor.editNodes.value[2].y,1000,'distance editing affects exactly one endpoint')
    assert.equal(canvas.positioning.distance.value,2000,'the selected measurement resolves the new node coordinates')
    canvas.positioning.input.value='not a distance';canvas.positioning.apply()
    assert.equal(editor.editNodes.value[1].x,2000,'invalid distance input cannot partially move the topology')
    assert.ok(canvas.positioning.error.value)
    canvas.positioning.toggle(2);await nextTick()
    canvas.positioning.input.value='3km';canvas.positioning.apply();await nextTick()
    assert.equal(editor.editNodes.value[1].x,2000,'two pinned endpoints cannot change distance')
    assert.equal(canvas.positioning.options.value.length,0)
    canvas.positioning.toggle(1);canvas.positioning.toggle(2);await nextTick()
    assert.equal(canvas.positioning.options.value.length,2,'both unlocked endpoints are offered explicitly')
    canvas.positioning.movingId.value=1;canvas.positioning.input.value='500m';canvas.positioning.apply();await nextTick()
    assert.equal(editor.editNodes.value[0].x,1500,'choosing the opposite endpoint moves that node along its existing bearing')
    assert.equal(editor.editNodes.value[1].x,2000)
    canvas.positioning.toggle(1);await nextTick()
    const captured=structuredClone(canvasState)
    const parsed=parseCanvasState(captured)
    assert.deepEqual(parsed.lockedNodeIds,[1])
    const text=serializeExperiment({nodes:editor.editNodes.value,form:editor.experimentForm.value,selectedIds:[],activeCatalogId:'',canvas:captured})
    assert.deepEqual(parseExperiment(text).canvas.lockedNodeIds,[1],'experiment files retain locks only in editor.canvas')
    assert.ok(JSON.parse(text).nodes.every(node=>node.lockedNodeIds===undefined),'locks never become simulator node attributes')
    for(const ids of [[1,1],[0],[1.2],['1'],[65535],null]) assert.throws(()=>parseCanvasState({...captured,lockedNodeIds:ids}),/画布/)
    editor.editNodes.value=editor.editNodes.value.filter(node=>node.node_id!==1);await nextTick()
    assert.deepEqual(canvas.positioning.lockedNodeIds.value,[],'deleting a node clears its lock before the ID can be reused')
    app.unmount();app=null
    app=renderer.createApp({render:()=>h(Canvas,{nodes:[{node_id:1,x:1500,y:0,z:-20},{node_id:2,x:2000,y:0,z:-20}],currentTime:0,
      editMode:true,allowPositionLock:true,allowCoordinateEdit:true,persistState:true,initialState:captured})})
    app.provide(ssrContextKey,{modules:new Set()});app.mount({});await nextTick()
    const restored=app._instance.subTree.component.setupState
    assert.deepEqual(restored.positioning.lockedNodeIds.value,[1],'a fresh canvas restores pins from the experiment editor state')
    restored.positioning.toggle(1);await nextTick()
    assert.equal(restored.positioning.isLocked(1),false,'restored pins can be unlocked again')
    const legacy={...captured};delete legacy.lockedNodeIds
    assert.equal(parseCanvasState(legacy).lockedNodeIds,undefined,'old experiment files remain unlocked')
  } finally {
    app?.unmount()
    experimentDraft.nodes.value=saved.nodes;experimentDraft.selectedIds.value=saved.selected;experimentDraft.canvas.value=saved.canvas
    for(const [key,value] of globals) {if(value===undefined)delete globalThis[key];else globalThis[key]=value}
  }
  console.log('Node positioning passed: real canvas pins, fixed/group drag guards, unit distances/bearings/depth, selected endpoints, measurement updates, persistence and legacy files.')
}
