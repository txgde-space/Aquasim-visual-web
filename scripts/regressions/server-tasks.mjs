import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export async function checkServerTasks(server) {
  const { precompileSimulatorGuarded: build, runExperimentGuarded: run, clearSimulatorBuildGuarded: clean, readPrecompileProgress: progress } = await server.ssrLoadModule('/server/runner.ts')
  const { createDefaultExperimentForm, buildExperimentSpec } = await server.ssrLoadModule('/src/features/experiment/lib/experimentSpec.ts')
  const { TYPEID_LAYERS } = await server.ssrLoadModule('/src/features/experiment/lib/typeIdCatalog.ts')
  const { RADIO_TYPE_IDS } = await server.ssrLoadModule('/src/features/experiment/lib/radioEnvironment.ts')
  const rows = TYPEID_LAYERS.flatMap((layer) => layer.items.filter((item) => item.typeId).map((item) => ({
    layer: item.field === 'propagationId' ? 'propagation' : layer.id, typeId: item.typeId, attributes: [],
  })))
  const spec = buildExperimentSpec(createDefaultExperimentForm(), [{ node_id: 1, x: 0, y: 0, z: 0 }, { node_id: 2, x: 100, y: 0, z: 0 }])
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aquasim-task-lock-'))
  const homes = []
  const tasks = []
  const track = (promise) => { tasks.push(promise); void promise.catch(() => {}); return promise }
  const cache = 'build_profile:INTERNAL=debug\nCMAKE_GENERATOR:INTERNAL=Ninja\nNS3_WARNINGS_AS_ERRORS:BOOL=OFF\n'
  const fixture = (name) => {
    const home = path.join(root, name)
    homes.push(home)
    fs.mkdirSync(path.join(home, 'src/aqua-sim-tg'), { recursive: true })
    fs.writeFileSync(path.join(home, 'ns3'), `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
const home = process.cwd(); const args = process.argv.slice(2);
const phase = args[0] === 'run' ? args[1].startsWith('aqua-visual-catalog-') ? 'catalog' : 'run' : args[0];
fs.appendFileSync(path.join(home, 'commands.jsonl'), JSON.stringify({ phase, args }) + '\\n');
if (phase === 'build') fs.writeSync(1, '[1/2] fixture compilation\\n');
(async () => {
  while (fs.existsSync(path.join(home, 'hold-' + phase))) await new Promise(resolve => setTimeout(resolve, 5));
  if (fs.existsSync(path.join(home, 'fail-' + phase))) { fs.writeSync(2, 'fixture ' + phase + ' failed\\n'); process.exit(7); }
  if (phase === 'configure') {
    fs.mkdirSync(path.join(home, 'cmake-cache'), { recursive: true });
    fs.writeFileSync(path.join(home, 'cmake-cache/CMakeCache.txt'), ${JSON.stringify(cache)});
  }
  if (phase === 'catalog') fs.writeSync(1, 'AQUASIM_CATALOG_BEGIN\\n' + ${JSON.stringify(JSON.stringify(rows))} + '\\nAQUASIM_CATALOG_END\\n');
  if (phase === 'run' && fs.existsSync(path.join(home, 'cleanup-error'))) fs.mkdirSync(path.join(home, 'net.' + args[1] + '.json'));
  if (phase === 'run' && fs.existsSync(path.join(home, 'dual-logs'))) {
    fs.writeFileSync(path.join(home, 'net.' + args[1] + '.json'), JSON.stringify({ meta: { time_precision_us: 0.001 }, packets: fs.existsSync(path.join(home, 'empty-trace')) ? [] : [{ src: 1, tx_start_us: 0, tx_duration_us: 1 }] }));
    fs.writeFileSync(path.join(home, 'net.native.json'), JSON.stringify({ native: true }));
  }
})().catch(error => { console.error(error); process.exitCode = 9; });
`, { mode: 0o755 })
    return home
  }
  const flag = (home, name) => fs.writeFileSync(path.join(home, name), '')
  const release = (home, phase) => fs.rmSync(path.join(home, `hold-${phase}`), { force: true })
  const commands = (home) => fs.existsSync(path.join(home, 'commands.jsonl'))
    ? fs.readFileSync(path.join(home, 'commands.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : []
  const waitFor = async (condition, message) => {
    const until = Date.now() + 5000
    while (!condition()) {
      assert.ok(Date.now() < until, typeof message === 'function' ? message() : message)
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
  }
  const started = (home, phase) => waitFor(() => commands(home).some((command) => command.phase === phase), `${phase} fixture must start`)
  const busy = async (promise, kind, home) => {
    const result = await promise
    assert.equal(result.status, 409)
    assert.equal(result.payload.ok, false)
    assert.equal(result.payload.code, 'SIMULATOR_BUSY')
    assert.deepEqual(result.payload.task, { kind, home: fs.realpathSync(home) })
    assert.equal(typeof result.payload.error, 'string')
  }

  try {
    const home = fixture('primary')
    const other = fixture('other')
    const alias = path.join(root, 'primary-alias')
    fs.symlinkSync(home, alias)
    for (const phase of ['configure', 'build', 'catalog']) flag(home, `hold-${phase}`)
    const first = track(build(home))
    assert.deepEqual(progress(other).payload.task, { kind: 'build', home }, 'global task is visible before configure starts, even from another directory')
    assert.equal(track(build(alias)), first, 'realpath aliases share the exact in-flight build Promise')
    assert.equal(track(build(`${home}/./`)), first, 'normalized paths share the same build')
    await started(home, 'configure')
    assert.equal(progress(alias).payload.progress.phase, 'configure')
    await busy(build(other), 'build', home)
    await busy(run(spec, home), 'build', home)
    await busy(clean(home), 'build', home)
    assert.equal(commands(other).length, 0, 'rejected tasks do not launch commands')
    release(home, 'configure')
    await started(home, 'build')
    await waitFor(() => progress(home).payload.progress.completed === 1, () => `Ninja progress must remain available: ${JSON.stringify(progress(home))}`)
    assert.equal(track(build(alias)), first)
    release(home, 'build')
    await started(home, 'catalog')
    assert.equal(progress(home).payload.progress.phase, 'catalog')
    assert.deepEqual(progress(other).payload.task, { kind: 'build', home })
    assert.equal(progress(other).payload.progress, null, 'another directory sees the task without borrowing unrelated build progress')
    assert.equal(track(build(home)), first, 'catalog discovery is still part of the shared task')
    release(home, 'catalog')
    const outcome = await first
    assert.equal(outcome.status, 200)
    assert.equal(progress(home).payload.task, null, 'await returns only after releasing the global lock')
    assert.equal(progress(alias).payload.progress.phase, 'done')
    assert.deepEqual(commands(home).map(({ phase }) => phase), ['configure', 'build', 'catalog'], 'all duplicate requests execute each stage only once')
    assert.equal((await track(clean(alias))).status, 200, 'an immediate clean after await succeeds without a microtask workaround')
    assert.equal(progress(home).payload.task, null)
    assert.equal(progress(alias).payload.progress, null)

    for (const phase of ['configure', 'build', 'catalog']) {
      const failed = fixture(`failed-${phase}`)
      flag(failed, `hold-${phase}`)
      flag(failed, `fail-${phase}`)
      const original = track(build(failed))
      const duplicate = track(build(failed))
      assert.equal(duplicate, original)
      await started(failed, phase)
      release(failed, phase)
      const result = await original
      assert.equal(result.status, 500)
      assert.equal(result.payload.phase, phase)
      assert.equal(await duplicate, result, 'duplicates receive the same failure result')
      assert.equal(progress(failed).payload.task, null)
      assert.equal(progress(failed).payload.progress.phase, 'failed')
      fs.rmSync(path.join(failed, `fail-${phase}`))
      const retry = track(build(failed))
      assert.notEqual(retry, original, 'settled failures cannot become a permanent build cache')
      assert.equal((await retry).status, 200, 'failed builds can be retried immediately')
    }

    for (const kind of ['run', 'clean']) {
      const activeHome = fixture(`active-${kind}`)
      flag(activeHome, `hold-${kind}`)
      if (kind === 'run') flag(activeHome, 'hold-catalog')
      const active = track(kind === 'run' ? run(spec, activeHome) : clean(activeHome))
      assert.deepEqual(progress(other).payload.task, { kind, home: activeHome })
      if (kind === 'run') {
        await started(activeHome, 'catalog')
        await busy(build(activeHome), kind, activeHome)
        release(activeHome, 'catalog')
      }
      await started(activeHome, kind)
      await busy(build(activeHome), kind, activeHome)
      await busy(build(other), kind, activeHome)
      await busy(run(spec, activeHome), kind, activeHome)
      await busy(clean(other), kind, activeHome)
      assert.deepEqual(progress(other).payload.task, { kind, home: activeHome })
      release(activeHome, kind)
      assert.equal((await active).status, 200)
      assert.equal(progress(other).payload.task, null)
    }

    // A cleanup exception escapes doRunExperiment's try/catch. Even this rejected
    // Promise must release the lock before its caller can start another task.
    const throwing = fixture('cleanup-exception')
    flag(throwing, 'cleanup-error')
    await assert.rejects(track(run(spec, throwing)), /directory|EISDIR/i)
    assert.equal(progress(other).payload.task, null)
    assert.equal((await track(clean(throwing))).status, 200)

    const logging = fixture('uniform-log-selection')
    flag(logging, 'dual-logs')
    const acousticResult = await track(run(spec, logging))
    assert.equal(acousticResult.status, 200)
    assert.match(acousticResult.payload.logName, /^net\.aqua-visual-.*\.json$/, 'all stacks use the same generated PHY trace')
    const radioSpec = structuredClone(spec)
    radioSpec.stack.phy.type = RADIO_TYPE_IDS.phy
    radioSpec.channel.type = RADIO_TYPE_IDS.channel
    radioSpec.channel.propagation = RADIO_TYPE_IDS.propagation
    const radioResult = await track(run(radioSpec, logging))
    assert.equal(radioResult.status, 200)
    assert.match(radioResult.payload.logName, /^net\.aqua-visual-.*\.json$/)
    assert.equal(JSON.parse(radioResult.payload.log).meta.time_precision_us, 0.001, 'trace priority is independent of the selected protocol')
    flag(logging, 'empty-trace')
    const emptyResult = await track(run(radioSpec, logging))
    assert.equal(emptyResult.payload.logName, 'net.native.json', 'a model without common trace events retains its native output')
    console.log('server task regressions passed: canonical build joining, global busy metadata, all phases, shared failures, immediate release and exception recovery')
  } finally {
    // Always unblock fixture children before removing their working directories.
    for (const home of homes) {
      for (const file of fs.readdirSync(home).filter((name) => name.startsWith('hold-'))) fs.rmSync(path.join(home, file), { force: true })
    }
    await Promise.allSettled(tasks)
    fs.rmSync(root, { recursive: true, force: true })
  }
}
