// Compile outside the simulator tree, link its existing shared libraries, run
// real simulations, then parse their logs with the current Web parser. No server.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const home = path.resolve(process.argv[2] || path.join(root, '../aqua-sim-dev'))
const phy = process.argv[3] || 'ns3::AquaSimPhyCmn'
const temp = mkdtempSync(path.join(tmpdir(), 'visual-logger-check-'))
const libDir = path.join(home, 'build/lib')
const files = readdirSync(libDir)
const library = module => {
  const matches = files.filter(file => new RegExp(`^libns3.+-${module}-(debug|default|optimized|release)\\.(dylib|so)$`).test(file))
  assert.equal(matches.length, 1, `Expected one built ${module} library, found ${matches}`)
  return path.join(libDir, matches[0])
}
const aquaModules = files.map(file => file.match(/^libns3.+-(aqua-sim-[a-z0-9-]+)-(?:debug|default|optimized|release)\.(?:dylib|so)$/)?.[1]).filter(Boolean)
assert.equal(aquaModules.length, 1, 'Select a build with one Aqua-Sim module')
let server
try {
  execFileSync(process.execPath, ['scripts/export-ns3-logger.mjs', '--check'], { cwd: root, stdio: 'pipe', timeout: 60_000 })
  for (const test of ['core', 'aquasim', 'helper']) {
    const modules = ['core', 'network', 'mobility', ...(test !== 'core' ? aquaModules : [])]
    execFileSync(process.env.CXX || 'c++', ['-std=c++23', '-DNS3_LOG_ENABLE', '-DNS3_ASSERT_ENABLE',
      `-I${path.join(home, 'build/include')}`, path.join(root, 'contrib/visual-logger/tests', `${test}.cc`),
      ...(test === 'helper' ? [path.join(root, 'contrib/visual-logger/helper/visual-log-helper.cc')] : []),
      ...modules.map(library), `-Wl,-rpath,${libDir}`, '-o', path.join(temp, test)], { cwd: temp, stdio: 'pipe', timeout: 60_000 })
  }
  server = await createServer({ root, configFile: false, cacheDir: path.join(temp, 'vite'),
    resolve: { alias: { '@': path.join(root, 'src') } },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' })
  const { parseLog } = await server.ssrLoadModule('/src/features/replay/lib/logParser.ts')
  const { normalizePacketsFromParsed, mergeParsedNodeLogs } = await server.ssrLoadModule('/src/features/replay/lib/logMerge.ts')
  const readLog = filename => {
    const raw = readFileSync(filename, 'utf8')
    const log = JSON.parse(raw)
    const parsed = parseLog(raw)
    assert.equal(parsed.parseErrors.length, 0)
    assert.equal(parsed.nodes.length, log.nodes.length)
    assert.equal(parsed.packets.length, log.packets.length)
    const normalized = normalizePacketsFromParsed(parsed, filename)
    assert.equal(normalized.length, log.packets.length)
    return log
  }
  execFileSync(path.join(temp, 'core'), [path.join(temp, 'core.json')], { cwd: temp, timeout: 20_000 })
  const core = readLog(path.join(temp, 'core.json'))
  assert.equal(core.packets.length, 3)
  assert.equal(core.packets[0].receivers[0].dst, 22)
  assert.equal(core.packets[1].receivers[0].dst, 33)
  assert.deepEqual(core.packets[1].receivers[0].with, ['phy-0'])
  assert.equal(core.packets[1].receivers[0].collision_start_us, 2250000)
  assert.equal(core.packets[2].receivers[0].reason, 'reception_incomplete')
  assert.equal(core.movements.length, 1)
  assert.ok(Math.abs(core.movements[0].to_x - 10) < 1e-9)
  assert.equal(core.movements[0].end_us, 5000000)
  console.log('Core: same-UID retransmission, successful reception, collision, unfinished reception, real mobility, Web import passed.')

  const logs = new Map()
  for (const observe of [0, 1]) for (const collision of [0, 1]) for (const logging of [0, 1]) {
    const name = `${observe}-${collision}-${logging}`
    const output = path.join(temp, `${name}.json`)
    const stdout = execFileSync(path.join(temp, 'aquasim'), [`--phy=${phy}`, `--observe=${observe}`,
      `--collision=${collision}`, `--logging=${logging}`, `--output=${output}`],
    { cwd: temp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 })
    assert.equal(stdout.trim(), collision ? 'delivered=0' : 'delivered=1')
    if (!logging) continue
    const log = readLog(output)
    logs.set(name, log)
    assert.equal(log.packets.length, collision ? 2 : 1)
    assert.equal(log.meta.trace_scope, observe ? 'phy-events' : 'phy-success')
    if (collision) {
      for (const packet of log.packets) {
        assert.equal(packet.receivers.length, observe ? 1 : 0)
        if (observe) {
          const rx = packet.receivers[0]
          assert.equal(rx.dst, 3)
          assert.equal(rx.status, 'fail')
          assert.equal(rx.reason, 'collision_rx_rx')
          assert.ok(rx.collision_start_us >= rx.rx_start_us)
          assert.ok(rx.rx_drop_us >= rx.collision_start_us)
          assert.equal(rx.with.length, 1)
          assert.notEqual(rx.with[0], packet.packet_id)
        }
      }
    } else assert.equal(log.packets[0].receivers[0].status, 'ok')
  }
  assert.deepEqual(logs.get('0-0-1').packets, logs.get('1-0-1').packets,
    'Observed native cache must preserve success timing')
  assert.deepEqual(logs.get('0-1-1').packets.map(({ receivers, ...tx }) => tx),
    logs.get('1-1-1').packets.map(({ receivers, ...tx }) => tx), 'Collision tracing must preserve transmission timing')
  const partial = path.join(temp, 'partial.json')
  execFileSync(path.join(temp, 'aquasim'), [`--phy=${phy}`, '--observe=1', '--stop=10.5', `--output=${partial}`],
    { cwd: temp, stdio: 'pipe', timeout: 20_000 })
  assert.equal(readLog(partial).packets[0].receivers[0].reason, 'reception_incomplete')
  console.log(`Aqua-Sim: ${home}; ${phy}; 8 native/observed, collision/success, logger-on/off cases + early stop passed.`)
  const packetView = packets => packets.map(tx => ({
    packet_id: tx.packet_id, src: tx.src, tx_start_us: tx.tx_start_us, tx_duration_us: tx.tx_duration_us,
    receivers: tx.receivers.map(rx => Object.fromEntries(['dst', 'status', 'reason', 'rx_start_us', 'rx_duration_us',
      'collision_start_us', 'rx_drop_us', 'with'].map(key => [key, rx[key]]))).sort((a, b) => a.dst - b.dst),
  })).sort((a, b) => a.packet_id.localeCompare(b.packet_id))
  let bothSuccess
  for (const [mode, collision, enabled, flush, stop] of [
    ['both', 0, 1, 0, 19], ['both', 1, 1, 0, 19], ['node', 0, 1, 0, 19],
    ['network', 0, 1, 0, 19], ['single', 1, 1, 0, 19], ['sender', 0, 1, 0, 19],
    ['both', 0, 0, 0, 19], ['both', 0, 1, 1, 19], ['both', 0, 1, 0, 10.5],
  ]) {
    const directory = path.join(temp, `helper-${mode}-${collision}-${enabled}-${flush}-${stop}`)
    const runDirectory = path.join(directory, 'test-run')
    const stdout = execFileSync(path.join(temp, 'helper'), [`--phy=${phy}`, `--directory=${directory}`, `--mode=${mode}`,
      `--collision=${collision}`, `--enabled=${enabled}`, `--flush=${flush}`, `--stop=${stop}`],
    { cwd: temp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20_000 })
    assert.equal(stdout.trim(), collision || stop < 11 ? 'delivered=0' : 'delivered=1')
    if (!enabled) { assert.equal(existsSync(directory), false, 'Disabled helper creates no output'); continue }
    const nodeFiles = readdirSync(runDirectory).filter(file => file.startsWith('node.')).sort()
    const parsedNodes = nodeFiles.map(file => parseLog(readFileSync(path.join(runDirectory, file), 'utf8')))
    assert.equal(nodeFiles.length, mode === 'network' ? 0 : mode === 'single' || mode === 'sender' ? 1 : 4)
    assert.equal(existsSync(path.join(runDirectory, 'net.json')), mode === 'both' || mode === 'network')
    for (const parsed of parsedNodes) {
      assert.equal(parsed.meta.run_id, 'test-run')
      assert.equal(parsed.meta.sim_end_us, stop * 1e6)
      for (const event of parsed.nodeEvents) assert.equal(event.type === 'tx_start' ? event.src : event.dst, parsed.meta.node_id)
      assert.ok(parsed.movements.every(movement => movement.node_id === parsed.meta.node_id))
    }
    if (!nodeFiles.length) continue
    const merged = mergeParsedNodeLogs(parsedNodes, nodeFiles)
    assert.deepEqual(merged.parseErrors, [])
    const normalized = normalizePacketsFromParsed(merged, 'merged')
    assert.equal(merged.nodes.find(node => node.node_id === 30).modelType, 'buoy')
    if (mode === 'both') {
      const global = parseLog(readFileSync(path.join(runDirectory, 'net.json'), 'utf8'))
      assert.deepEqual(packetView(normalized), packetView(normalizePacketsFromParsed(global, 'global')),
        'All node-owned logs must reconstruct the same packet timing and RX outcomes as network capture')
      assert.deepEqual(merged.movements, global.movements)
      assert.equal(merged.meta.sim_end_us, global.meta.sim_end_us)
      const end = merged.movements.find(movement => movement.node_id === 40)
      assert.ok(Math.abs(end.to_x - (10000 + stop * 2)) < 1e-8, 'Automatic Destroy flush captures the final position')
      if (!collision && stop === 19) bothSuccess = packetView(normalized)
    }
    if (mode === 'node') assert.deepEqual(packetView(normalized), bothSuccess)
    if (mode === 'single') {
      assert.equal(normalized.length, 2)
      assert.ok(normalized.every(tx => tx.tx_observed_via_rx && tx.receivers.length === 1 && tx.receivers[0].dst === 30))
      assert.ok(normalized.every(tx => tx.src !== 40), 'Unrelated node transmission is not in single-point output')
    }
    if (mode === 'sender') { assert.equal(normalized.length, 1); assert.equal(normalized[0].src, 10); assert.equal(normalized[0].receivers.length, 0) }
  }
  console.log('Helper: automatic Destroy flush, disabled mode, NETWORK/NODE/BOTH, single receiver/sender, node types, final mobility and partial-run merge equivalence passed.')
  console.log('All produced replay files parsed and normalized by the current Web code.')
} finally {
  if (server) await server.close()
  rmSync(temp, { recursive: true, force: true })
}
