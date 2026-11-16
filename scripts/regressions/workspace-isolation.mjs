import assert from 'node:assert/strict'
import { createRenderer, ref, nextTick } from 'vue'

export async function checkWorkspaceIsolation(server) {
  const { createExperimentDraft, experimentDraft, fieldDraft } = await server.ssrLoadModule('/src/features/experiment/composables/experimentDraft.ts')
  const { useTopologyEditor } = await server.ssrLoadModule('/src/features/experiment/composables/useTopologyEditor.ts')
  const { useSimulatorSettings, createSimulatorSession } = await server.ssrLoadModule('/src/features/experiment/composables/useSimulatorSettings.ts')
  const { session: replay } = await server.ssrLoadModule('/src/state/replaySession.ts')
  assert.notEqual(experimentDraft, fieldDraft)
  const sim = createExperimentDraft(), field = createExperimentDraft()
  const simEditor = useTopologyEditor(ref([]), sim), fieldEditor = useTopologyEditor(ref([]), field)
  const replayBefore = JSON.stringify(replay)
  simEditor.addNode({ x: 123, y: 456, z: 5 })
  fieldEditor.addNode({ x: 900, y: 800, z: 7 })
  fieldEditor.setField('simStop', '90s')
  assert.equal(sim.nodes.value[0].x, 123)
  assert.equal(field.nodes.value[0].x, 900)
  assert.notEqual(sim.form.value.simStop, field.form.value.simStop)
  field.selectedIds.value = [1]
  fieldEditor.removeSelected()
  assert.equal(field.nodes.value.length, 0)
  assert.equal(sim.nodes.value.length, 1)
  assert.equal(JSON.stringify(replay), replayBefore, 'editing either workspace never writes replay')

  const fetchBefore = globalThis.fetch
  const storageBefore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const store = new Map([['sim-test-home', '/simulation'], ['field-test-home', '/field']])
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)} })
  const requests = []
  globalThis.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }))
  const renderer = createRenderer({createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null,insert(){},remove(){},patchProp(){}})
  const mount = (storageKey, session) => {
    let state
    const app = renderer.createApp({setup(){state=useSimulatorSettings(session,{storageKey,autoBuild:false});return()=>null}})
    app.mount({});return {app,state}
  }
  const reply = (r, data) => r.resolve(new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}))
  const flush = async () => { for(let i=0;i<12;i++)await Promise.resolve();await nextTick() }
  let a,b
  try {
    const sa=createSimulatorSession(), sb=createSimulatorSession()
    a=mount('sim-test-home',sa);b=mount('field-test-home',sb)
    assert.equal(requests.length,2)
    assert.equal(a.state.aquaSimHome.value,'/simulation')
    assert.equal(b.state.aquaSimHome.value,'/field')
    reply(requests[0],{ok:true,home:'/simulation',catalog:[{id:'sim'}],buildReusable:true})
    reply(requests[1],{ok:true,home:'/field',catalog:null,buildReusable:false})
    await flush()
    assert.equal(requests.length,2,'field initial check must not automatically build or poll ns-3')
    assert.equal(a.state.catalogReady.value,true)
    assert.equal(b.state.catalogReady.value,false)
    b.state.aquaSimHome.value='/another-field'
    assert.equal(a.state.aquaSimHome.value,'/simulation')
    assert.equal(store.get('sim-test-home'),'/simulation')
    assert.equal(store.get('field-test-home'),'/another-field')
    assert.equal(sa.ready.selection,'/simulation')
    assert.equal(sb.ready,null)
    b.state.selectDirectory('/late-field')
    const late=requests.at(-1)
    b.app.unmount();b=null
    assert.equal(late.options.signal.aborted,true)
    reply(late,{ok:true,home:'/late-field',catalog:[{id:'late'}],buildReusable:true})
    await flush()
    assert.equal(sb.ready,null,'late field results cannot refill session or affect simulation')
    assert.equal(a.state.catalog.value[0].id,'sim')
  } finally {
    a?.app.unmount();b?.app.unmount();globalThis.fetch=fetchBefore
    if(storageBefore)Object.defineProperty(globalThis,'localStorage',storageBefore);else delete globalThis.localStorage
  }
  console.log('Workspace isolation passed: separate drafts, selection, directory/session caches, no field autobuild, late response cancellation and no implicit replay writes.')
}
