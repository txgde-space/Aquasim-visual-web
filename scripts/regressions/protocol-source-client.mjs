import assert from 'node:assert/strict'
import { effectScope, h, ref } from 'vue'
import { renderToString } from '@vue/server-renderer'

export async function checkProtocolSourceClient(server) {
  const { useProtocolSource } = await server.ssrLoadModule('/src/features/experiment/composables/useProtocolSource.ts')
  const { default: ProtocolDrawer } = await server.ssrLoadModule('/src/components/ProtocolDrawer.vue')
  const originalFetch = globalThis.fetch
  const requests = []
  const flush = () => new Promise((resolve) => setImmediate(resolve))
  const files = [
    { path: 'src/aqua-sim-tg/model/protocol.cc', language: 'cpp' },
    { path: 'src/aqua-sim-tg/model/protocol.h', language: 'cpp' },
  ]
  const payload = (typeId, code, selectedPath = files[0].path) => ({ ok: true, typeId, files, selectedPath, code })
  const respond = (request, data, status = 200) => request.resolve(new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  }))
  let scope

  // Deliberately allow aborted requests to resolve, so these checks verify the
  // stale-response guard independently of the browser's fetch cancellation.
  globalThis.fetch = (url, init) => new Promise((resolve) => requests.push({ url, init, resolve }))
  try {
    const directory = ref(' /first ')
    const typeId = ref('ns3::AquaSimSwarm')
    scope = effectScope()
    const source = scope.run(() => useProtocolSource(() => directory.value, () => typeId.value))
    assert.equal(requests[0].url, '/api/simulator/source')
    assert.deepEqual(JSON.parse(requests[0].init.body), { aquaSimHome: '/first', typeId: typeId.value })
    assert.equal(source.loading.value, true)
    respond(requests[0], payload(typeId.value, 'implementation'))
    await flush()
    assert.equal(source.code.value, 'implementation')
    assert.equal(source.loading.value, false)

    const requestCount = requests.length
    source.selectFile('/not-returned-by-server')
    assert.equal(requests.length, requestCount, 'file selection only sends a returned source path')
    source.selectFile(files[1].path)
    const header = requests.at(-1)
    assert.equal(JSON.parse(header.init.body).path, files[1].path)
    assert.equal(source.code.value, '', 'a pending file change cannot display or copy the old file')
    source.selectFile(files[0].path)
    const implementation = requests.at(-1)
    assert.equal(header.init.signal.aborted, true, 'switching files cancels the previous request')
    respond(implementation, payload(typeId.value, 'new implementation'))
    respond(header, payload(typeId.value, 'stale header', files[1].path))
    await flush()
    assert.equal(source.code.value, 'new implementation')
    assert.equal(source.selectedPath.value, files[0].path)

    directory.value = '/second'
    const oldTypeRequest = requests.at(-1)
    assert.deepEqual(source.files.value, [], 'changing directories clears the previous directory files')
    assert.equal(source.code.value, '')
    directory.value = '/third'
    const oldDirectoryRequest = requests.at(-1)
    assert.equal(oldTypeRequest.init.signal.aborted, true, 'changing directories cancels the previous request')
    typeId.value = 'ns3::AquaSimTDMA'
    const latest = requests.at(-1)
    assert.equal(oldDirectoryRequest.init.signal.aborted, true, 'changing protocol cancels the previous request')
    assert.deepEqual(JSON.parse(latest.init.body), { aquaSimHome: '/third', typeId: 'ns3::AquaSimTDMA' })
    respond(latest, payload(typeId.value, 'TDMA'))
    respond(oldTypeRequest, payload('ns3::AquaSimSwarm', 'stale implementation'))
    respond(oldDirectoryRequest, { ok: false, error: 'stale directory error' }, 500)
    await flush()
    assert.equal(source.code.value, 'TDMA', 'a stale directory/protocol response cannot replace current source')
    assert.equal(source.error.value, '', 'a stale request error cannot replace current success')

    source.selectFile(files[1].path)
    respond(requests.at(-1), { ok: false, error: 'header unavailable' }, 404)
    await flush()
    assert.equal(source.error.value, 'header unavailable')
    assert.equal(source.code.value, '')
    assert.equal(source.loading.value, false)
    source.retry()
    assert.equal(JSON.parse(requests.at(-1).init.body).path, files[1].path, 'retry keeps the failed file selection')
    respond(requests.at(-1), payload(typeId.value, '', files[1].path))
    await flush()
    assert.equal(source.error.value, '', 'a successful retry clears the error')
    assert.equal(source.loading.value, false)
    assert.equal(source.selectedPath.value, files[1].path, 'an empty source file is a valid loaded file')

    source.selectFile(files[0].path)
    const pending = requests.at(-1)
    scope.stop()
    assert.equal(pending.init.signal.aborted, true, 'closing the viewer cancels its pending request')
    respond(pending, payload(typeId.value, 'after close'))
    await flush()
    assert.equal(source.code.value, '', 'a late response cannot publish after the viewer closes')

    const html = await renderToString(h(ProtocolDrawer, {
      ready: false,
      layers: [{ id: 'mac', label: 'MAC', items: [
        { id: 'swarm', typeId: 'ns3::AquaSimSwarm', label: 'Swarm' },
        { id: 'none', typeId: '', label: 'None' },
      ] }],
    }))
    assert.equal((html.match(/class="protocol-source-button"/g) || []).length, 1, 'none has no source viewer button')
    assert.match(html, /<button[^>]*class="lib-item"[^>]*disabled/, 'assigning remains disabled before compilation')
    assert.match(html, /<\/button><button[^>]*class="protocol-source-button"/, 'source and assign buttons are siblings, never nested')
    assert.doesNotMatch(html, /<button[^>]*class="protocol-source-button"[^>]*disabled/, 'source viewing is enabled before compilation')
  } finally {
    scope?.stop()
    globalThis.fetch = originalFetch
  }
  console.log('Protocol source client regressions passed: file switching, directory/protocol races, retry, close cancellation and independent source buttons before compilation.')
}
