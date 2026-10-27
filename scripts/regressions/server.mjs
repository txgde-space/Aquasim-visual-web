import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkProtocolSource } from './protocol-source.mjs'
import { checkServerTasks } from './server-tasks.mjs'

export async function checkServer(server) {
  await checkProtocolSource(server)
  await checkServerTasks(server)
  const { precompileSimulatorGuarded } = await server.ssrLoadModule('/server/runner.ts')
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aquasim-build-config-'))
  const bin = path.join(fixtureRoot, 'bin')
  const previousPath = process.env.PATH
  fs.mkdirSync(bin)
  const executable = (file, code) => fs.writeFileSync(file, `#!/usr/bin/env node\n${code}`, { mode: 0o755 })
  const recordCommand = `
    const fs = require('node:fs'); const path = require('node:path');
    const home = process.cwd(); const args = process.argv.slice(2);
    const print = (text) => fs.writeSync(1, text + '\\n');
    fs.appendFileSync(path.join(home, 'commands.jsonl'), JSON.stringify({ command: path.basename(process.argv[1]), args }) + '\\n');
  `
  executable(path.join(bin, 'cmake'), `${recordCommand}
    if (fs.existsSync(path.join(home, 'fail-cmake'))) { print('fixture configure failed'); process.exit(7); }
    const directory = args[args.indexOf('-B') + 1];
    const file = path.join(directory, 'CMakeCache.txt');
    if (!fs.existsSync(path.join(home, 'keep-werror'))) {
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^NS3_WARNINGS_AS_ERRORS:BOOL=.*$/m, 'NS3_WARNINGS_AS_ERRORS:BOOL=OFF'));
    }
    print('reconfigured ' + path.basename(directory));
  `)
  const cacheText = (werror, profile = 'release') => [
    `build_profile:INTERNAL=${profile}`, 'CMAKE_GENERATOR:INTERNAL=Ninja',
    `CMAKE_BUILD_TYPE:STRING=${profile}`, `NS3_WARNINGS_AS_ERRORS:BOOL=${werror}`,
    'NS3_ENABLED_MODULES:STRING=core;aqua-sim-tg', 'NS3_DISABLED_MODULES:STRING=wifi;mesh',
    'NS3_EXAMPLES:BOOL=OFF', 'CUSTOM_OPTION:STRING=must-stay', '',
  ].join('\n')
  const fixture = (name) => {
    const home = path.join(fixtureRoot, name)
    fs.mkdirSync(path.join(home, 'src', 'aqua-sim-tg'), { recursive: true })
    executable(path.join(home, 'ns3'), `${recordCommand}
      if (args[0] === 'configure') {
        fs.mkdirSync(path.join(home, 'cmake-cache'), { recursive: true });
        fs.writeFileSync(path.join(home, 'cmake-cache', 'CMakeCache.txt'), ${JSON.stringify(cacheText('OFF', 'debug'))});
        print('configured new fixture');
      } else { print('fixture build stopped'); process.exit(23); }
    `)
    return home
  }
  const writeCache = (home, directory, werror, profile) => {
    const file = path.join(home, directory, 'CMakeCache.txt')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, cacheText(werror, profile))
    return file
  }
  const commands = (home) => fs.readFileSync(path.join(home, 'commands.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  const precompile = precompileSimulatorGuarded
  process.env.PATH = `${bin}${path.delimiter}${previousPath || ''}`
  try {
    const multiple = fixture('multiple caches')
    const stale = writeCache(multiple, 'cmake-cache', 'OFF', 'default')
    const actual = writeCache(multiple, 'build', 'ON', 'Debug')
    const alternate = writeCache(multiple, 'custom-build', 'YES', 'optimized')
    const originals = [stale, actual, alternate].map((file) => fs.readFileSync(file, 'utf8'))
    const result = await precompile(multiple)
    assert.equal(result.payload.phase, 'build')
    assert.match(result.payload.stdout, /reconfigured build/)
    assert.match(result.payload.stdout, /reconfigured custom-build/)
    const calls = commands(multiple)
    const configureCalls = calls.filter(({ command }) => command === 'cmake')
    assert.equal(configureCalls.length, 2, 'an OFF cache cannot mask other ON caches')
    for (const call of configureCalls) {
      assert.deepEqual(call.args, ['-S', multiple, '-B', call.args[3], '-DNS3_WARNINGS_AS_ERRORS=OFF'])
    }
    assert.deepEqual(calls.filter(({ command }) => command === 'ns3').map(({ args }) => args), [['build']], 'existing caches must bypass ns3 configure defaults')
    for (const [index, file] of [stale, actual, alternate].entries()) {
      assert.equal(fs.readFileSync(file, 'utf8'), originals[index].replace(/^NS3_WARNINGS_AS_ERRORS:BOOL=.*$/m, 'NS3_WARNINGS_AS_ERRORS:BOOL=OFF'), 'profile, module lists and unrelated flags remain identical')
    }
    await precompile(multiple)
    assert.equal(commands(multiple).filter(({ command }) => command === 'cmake').length, 2, 'all-OFF caches need no reconfiguration')

    const empty = fixture('empty-cache-directory')
    fs.mkdirSync(path.join(empty, 'cmake-cache'))
    fs.writeFileSync(path.join(empty, 'cmake-cache.txt'), 'old marker is not a configured build')
    await precompile(empty)
    assert.deepEqual(commands(empty)[0], { command: 'ns3', args: ['configure', '--build-profile=debug', '--enable-examples', '--disable-werror'] })

    const failed = fixture('failed-reconfigure')
    writeCache(failed, 'build', 'ON', 'release')
    fs.writeFileSync(path.join(failed, 'fail-cmake'), '')
    const failure = await precompile(failed)
    assert.equal(failure.payload.phase, 'configure')
    assert.match(failure.payload.stdout, /fixture configure failed/)
    assert.equal(commands(failed).some(({ command }) => command === 'ns3'), false)

    const unchanged = fixture('werror-still-enabled')
    writeCache(unchanged, 'build', 'TRUE', 'release')
    fs.writeFileSync(path.join(unchanged, 'keep-werror'), '')
    const incomplete = await precompile(unchanged)
    assert.equal(incomplete.payload.phase, 'configure', 'a successful command is insufficient if Werror remains enabled')
    assert.match(incomplete.payload.stdout, /reconfigured build/)
    assert.equal(commands(unchanged).some(({ command }) => command === 'ns3'), false)
    console.log('server regressions passed: cache discovery, Werror repair, preserved options, first configure and failure handling')
  } finally {
    if (previousPath === undefined) delete process.env.PATH
    else process.env.PATH = previousPath
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
  }
}
