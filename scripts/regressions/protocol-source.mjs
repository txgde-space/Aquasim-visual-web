import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'

export async function checkProtocolSource(server) {
  const { readProtocolSource } = await server.ssrLoadModule('/server/protocolSource.ts')
  const { RADIO_TYPE_IDS } = await server.ssrLoadModule('/src/features/experiment/lib/radioEnvironment.ts')
  const { TERRESTRIAL_RADIO_CC } = await server.ssrLoadModule('/src/features/experiment/lib/terrestrialRadio.ts')
  const { ns3RunPlugin } = await server.ssrLoadModule('/server/ns3RunPlugin.ts')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aquasim-protocol-source-'))
  const fixture = (name) => {
    const home = path.join(root, name)
    fs.mkdirSync(path.join(home, 'src/aqua-sim-tg/model/nested'), { recursive: true })
    fs.writeFileSync(path.join(home, 'ns3'), '#!/bin/sh\nexit 99\n', { mode: 0o755 })
    return home
  }
  const sourcePath = 'src/aqua-sim-tg/model/nested/custom.cc'
  const headerPath = sourcePath.replace(/\.cc$/, '.h')
  const typeId = 'ns3::CustomDynamicProtocol'
  try {
    const home = fixture('uncompiled')
    const source = '// TypeId("ns3::CommentOnly")\n/* TypeId("ns3::BlockComment") */\n'
      + 'const char* sample = R"sample(TypeId("ns3::RawStringOnly"))sample";\n'
      + 'TypeIdValue("ns3::NotARegistration");\n'
      + 'TypeId GetTypeId() { static TypeId tid = TypeId ("ns3::CustomDynamicProtocol"); return tid; }\n'
    fs.writeFileSync(path.join(home, sourcePath), source)
    fs.writeFileSync(path.join(home, headerPath), '#pragma once\nclass CustomDynamicProtocol {};\n')
    fs.writeFileSync(path.join(home, 'src/aqua-sim-tg/model/unrelated.cc'), 'TypeId tid("ns3::OtherProtocol");\n')
    const request = (extra = {}) => readProtocolSource({ aquaSimHome: home, typeId, ...extra })
    const result = await request()
    assert.equal(result.status, 200)
    assert.deepEqual(result.payload, { ok: true, typeId, files: [{ path: sourcePath, language: 'cpp' }, { path: headerPath, language: 'cpp' }], selectedPath: sourcePath, code: source })
    const header = await request({ path: headerPath })
    assert.equal(header.status, 200)
    assert.match(header.payload.code, /class CustomDynamicProtocol/)
    assert.equal(fs.existsSync(path.join(home, 'build')), false, 'source access never builds or configures ns-3')

    for (const radioType of Object.values(RADIO_TYPE_IDS)) {
      const radio = await request({ typeId: radioType })
      assert.equal(radio.status, 200)
      assert.equal(radio.payload.selectedPath, 'builtin/terrestrial-radio.cc')
      assert.equal(radio.payload.code, TERRESTRIAL_RADIO_CC)
      assert.equal((await request({ typeId: radioType, path: 'builtin/terrestrial-radio.cc' })).status, 200)
      for (const file of ['builtin/../server/runner.ts', '/etc/passwd', sourcePath]) {
        assert.equal((await request({ typeId: radioType, path: file })).status, 403, 'built-in model access is an exact allowlist, not another filesystem reader')
      }
    }
    assert.equal((await request({ path: 'builtin/terrestrial-radio.cc' })).status, 403)

    for (const typeId of ['ns3::Missing', 'ns3::CommentOnly', 'ns3::BlockComment', 'ns3::RawStringOnly', 'ns3::NotARegistration']) {
      assert.equal((await request({ typeId })).status, 404)
    }
    for (const typeId of ['', 'CustomDynamicProtocol', '../secret', 12, null]) assert.equal((await request({ typeId })).status, 400)
    assert.equal((await request({ path: 12 })).status, 400)
    assert.equal((await request({ aquaSimHome: 12 })).status, 400)
    for (const file of ['/etc/passwd', '../secret', 'src/aqua-sim-tg/../../../secret', 'src/aqua-sim-tg/model/../nested/custom.cc', 'src/aqua-sim-tg/model\\nested\\custom.cc', 'src/aqua-sim-tg/model/unrelated.cc', 'src/aqua-sim-tg/model/%2e%2e/secret', `${sourcePath}\0`]) {
      assert.equal((await request({ path: file })).status, 403, file)
    }

    const outside = path.join(root, 'outside')
    fs.mkdirSync(outside)
    fs.writeFileSync(path.join(outside, 'escaped.cc'), 'TypeId("ns3::Escaped");\n')
    fs.symlinkSync(outside, path.join(home, 'src/aqua-sim-tg/linked-directory'))
    fs.symlinkSync(path.join(outside, 'escaped.cc'), path.join(home, 'src/aqua-sim-tg/model/linked.cc'))
    fs.symlinkSync(path.join(home, 'src/aqua-sim-tg'), path.join(home, 'src/aqua-sim-tg/loop'))
    assert.equal((await request({ typeId: 'ns3::Escaped' })).status, 404, 'symlinked files and directories cannot leak external source')
    fs.unlinkSync(path.join(home, headerPath))
    fs.symlinkSync(path.join(outside, 'escaped.cc'), path.join(home, headerPath))
    assert.equal((await request({ path: headerPath })).status, 403, 'a linked companion header is not exposed')
    const linked = fixture('linked-module')
    fs.rmSync(path.join(linked, 'src/aqua-sim-tg'), { recursive: true })
    fs.symlinkSync(outside, path.join(linked, 'src/aqua-sim-tg'))
    assert.equal((await readProtocolSource({ aquaSimHome: linked, typeId: 'ns3::Escaped' })).status, 403)

    const large = fixture('large')
    fs.writeFileSync(path.join(large, sourcePath), source)
    fs.writeFileSync(path.join(large, headerPath), 'x'.repeat(1_000_001))
    assert.equal((await readProtocolSource({ aquaSimHome: large, typeId, path: headerPath })).status, 413)
    fs.writeFileSync(path.join(large, sourcePath), source + 'x'.repeat(1_000_001))
    assert.equal((await readProtocolSource({ aquaSimHome: large, typeId })).status, 413)

    let middleware
    ns3RunPlugin().configureServer({ middlewares: { use: (handler) => { middleware = handler } } })
    const invoke = async (body) => {
      const req = Readable.from([Buffer.from(JSON.stringify(body))])
      req.method = 'POST'; req.url = '/api/simulator/source'
      let payload
      const res = { statusCode: 200, setHeader() {}, end: (text) => { payload = JSON.parse(text) } }
      await middleware(req, res, () => assert.fail('source route must be handled'))
      return { status: res.statusCode, payload }
    }
    assert.equal((await invoke({ aquaSimHome: home, typeId })).status, 200)
    const absent = await invoke({ aquaSimHome: home, typeId: 'ns3::Absent' })
    assert.equal(absent.status, 404)
    assert.equal(absent.payload.ok, false)
    assert.equal(typeof absent.payload.error, 'string')
    console.log('protocol source regressions passed: dynamic/uncompiled discovery, headers, API, path isolation, symlinks and read limits')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}
