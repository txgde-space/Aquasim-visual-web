import assert from 'node:assert/strict'
import { createRenderer, ref } from 'vue'

export async function checkRequests(server) {
  const { useRunExperiment } = await server.ssrLoadModule('/src/features/experiment/composables/useRunExperiment.ts')
  const { useSimulatorSettings } = await server.ssrLoadModule('/src/features/experiment/composables/useSimulatorSettings.ts')
  const { useExperimentFiles } = await server.ssrLoadModule('/src/features/experiment/composables/useExperimentFiles.ts')
  const { createDefaultExperimentForm } = await server.ssrLoadModule('/src/features/experiment/lib/experimentSpec.ts')
  const { TYPEID_LAYERS } = await server.ssrLoadModule('/src/features/experiment/lib/typeIdCatalog.ts')
  const originalFetch = globalThis.fetch
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const originalSetInterval = globalThis.setInterval
  const originalClearInterval = globalThis.clearInterval
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const intervals = new Map()
  const timeouts = new Map()
  let nextInterval = 0
  let nextTimeout = 0
  const requests = []
  const response = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  })
  const renderer = createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const apps = new Set()
  const mount = (setup) => {
    let state
    const app = renderer.createApp({ setup() { state = setup(); return () => null } })
    app.mount({})
    apps.add(app)
    return { state, unmount: () => { app.unmount(); apps.delete(app) } }
  }
  const flush = () => new Promise((resolve) => setImmediate(resolve))
  const pollIntervals = async () => {
    for (const { callback } of [...intervals.values()]) callback()
    await flush()
  }
  const callsSince = (start, endpoint) => requests.slice(start).filter(({ url }) => url.endsWith(`/${endpoint}`))
  globalThis.fetch = (url, init) => new Promise((resolve, reject) => requests.push({ url, init, resolve, reject }))
  globalThis.setInterval = (callback, delay) => { intervals.set(++nextInterval, { callback, delay }); return nextInterval }
  globalThis.clearInterval = (id) => intervals.delete(id)
  globalThis.setTimeout = (callback, delay) => { timeouts.set(++nextTimeout, { callback, delay }); return nextTimeout }
  globalThis.clearTimeout = (id) => timeouts.delete(id)
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true, value: { getItem: () => null, setItem() {}, removeItem() {} },
  })
  try {
    const deliveries = []
    const run = mount(() => useRunExperiment({
      getSpec: () => ({ schema: 'aqua-sim-experiment/v0' }), getAquaSimHome: () => ' /sim ',
      onSuccess: (...args) => deliveries.push(args),
    }))
    let waiting = run.state.runExperiment()
    let request = requests.at(-1)
    assert.equal(JSON.parse(request.init.body).aquaSimHome, '/sim')
    request.resolve(response({ ok: true, log: 'sample', logName: 'net.log' }))
    await waiting
    assert.deepEqual(deliveries, [['sample', 'net.log']])
    assert.equal(run.state.runStatus.value, 'ok')

    waiting = run.state.runExperiment()
    requests.at(-1).resolve(new Response('<html>static preview</html>', { headers: { 'Content-Type': 'text/html' } }))
    await waiting
    assert.equal(run.state.runStatus.value, 'fail')
    assert.match(run.state.runLog.value, /yarn dev/)

    waiting = run.state.runExperiment()
    request = requests.at(-1)
    run.unmount()
    assert.equal(request.init.signal.aborted, true)
    request.resolve(response({ ok: true, log: 'late', logName: 'late.log' }))
    await waiting
    assert.equal(deliveries.length, 1, 'leaving the page cannot trigger a late replay navigation')

    // Each mounted experiment page checks and builds once, even when the server
    // already has a catalog. Returning to the page uses incremental ns-3 build.
    for (const cached of [null, [{ id: 'cached' }]]) {
      const start = requests.length
      const startup = mount(useSimulatorSettings)
      const check = requests.at(-1)
      check.resolve(response({ ok: true, home: '/startup', catalog: cached }))
      await flush()
      assert.equal(callsSince(start, 'build').length, 1, 'a valid initial check starts exactly one build regardless of cached catalog')
      const build = callsSince(start, 'build')[0]
      const progress = callsSince(start, 'build-progress')[0]
      assert.deepEqual(JSON.parse(build.init.body), JSON.parse(check.init.body), 'startup build uses the checked directory selection')
      assert.equal(startup.state.checking.value, false)
      assert.equal(startup.state.buildStatus.value, 'building')
      progress.resolve(response({ progress: { phase: 'build', completed: 2, total: 3 } }))
      await flush()
      assert.equal(startup.state.buildProgress.value.completed, 2, 'automatic compilation uses the existing progress display')
      build.resolve(response({ ok: true, stdout: 'incremental build complete', catalog: [{ id: 'compiled' }] }))
      await flush()
      assert.equal(startup.state.buildStatus.value, 'ok')
      assert.equal(startup.state.buildLog.value, 'incremental build complete')
      assert.equal(startup.state.catalog.value[0].id, 'compiled')
      assert.equal(startup.state.catalogReady.value, true)
      assert.equal(startup.state.buildProgress.value.phase, 'done')
      assert.equal(callsSince(start, 'build').length, 1)
      startup.state.selectDirectory('/explicit-selection')
      requests.at(-1).resolve(response({ ok: true, home: '/explicit-selection', catalog: null }))
      await flush()
      startup.state.resetDirectory()
      requests.at(-1).resolve(response({ ok: true, home: '/default', catalog: null }))
      await flush()
      assert.equal(callsSince(start, 'build').length, 1, 'explicit selection and reset retain manual precompilation')
      startup.unmount()
    }

    for (const failure of ['invalid-directory', 'http-error', 'network-error']) {
      const start = requests.length
      const startup = mount(useSimulatorSettings)
      const check = requests.at(-1)
      if (failure === 'network-error') check.reject(new Error('network unavailable'))
      else check.resolve(response({ ok: failure === 'http-error', error: failure }, failure === 'http-error' ? 500 : 400))
      await flush()
      assert.equal(startup.state.result.value.ok, false)
      assert.equal(startup.state.checking.value, false)
      assert.equal(callsSince(start, 'build').length, 0, `${failure} must never start a build`)
      startup.unmount()
    }

    const retryStart = requests.length
    const retry = mount(useSimulatorSettings)
    requests.at(-1).resolve(response({ ok: true, catalog: null }))
    await flush()
    callsSince(retryStart, 'build')[0].resolve(response({ ok: false, error: 'compiler failed', stdout: 'useful compiler output' }, 500))
    await flush()
    assert.equal(retry.state.buildStatus.value, 'fail')
    assert.equal(retry.state.buildError.value, 'compiler failed')
    assert.equal(retry.state.buildLog.value, 'useful compiler output')
    assert.equal(callsSince(retryStart, 'build').length, 1, 'an automatic failure does not start a retry loop')
    waiting = retry.state.precompile()
    assert.equal(callsSince(retryStart, 'build').length, 2, 'manual retry remains available after startup failure')
    callsSince(retryStart, 'build')[1].resolve(response({ ok: true, catalog: [{ id: 'retry-success' }] }))
    await waiting
    assert.equal(retry.state.buildStatus.value, 'ok')
    assert.equal(retry.state.buildError.value, '')
    assert.equal(retry.state.catalog.value[0].id, 'retry-success')
    retry.unmount()

    const answeredProgress = new Set()
    const pendingProgress = (start) => callsSince(start, 'build-progress')
      .filter((item) => !item.init.signal.aborted && !answeredProgress.has(item))
    const replyProgress = async (start, data) => {
      if (!pendingProgress(start).length) await pollIntervals()
      const pending = pendingProgress(start)
      assert.equal(pending.length, 1, 'progress polling keeps only one request in flight')
      answeredProgress.add(pending[0])
      pending[0].resolve(response(data))
      await flush()
    }
    const assertWaiting = (page) => {
      assert.equal(page.state.buildStatus.value, 'building', 'a busy runner keeps precompilation pending')
      assert.equal(page.state.buildProgress.value.phase, 'waiting')
      assert.equal(page.state.buildError.value, '')
      assert.equal(page.state.catalogReady.value, false, 'waiting cannot publish a successful catalog')
    }
    const busyResponse = () => response({ ok: false, code: 'SIMULATOR_BUSY', error: 'another simulator task is active' }, 409)
    const beginWaiting = async (manual = false) => {
      const start = requests.length
      const page = mount(useSimulatorSettings)
      const initialCheck = requests.at(-1)
      let completion
      if (manual) completion = page.state.precompile()
      else initialCheck.resolve(response({ ok: true, home: '/busy-simulator', catalog: null }))
      await flush()
      const initialBuild = callsSince(start, 'build')[0]
      const oldProgress = callsSince(start, 'build-progress')[0]
      assert.ok(initialBuild && oldProgress)
      initialBuild.resolve(busyResponse())
      await flush()
      assertWaiting(page)
      assert.equal(oldProgress.init.signal.aborted, true, 'entering the waiting phase discards progress requested before the rejection')
      oldProgress.resolve(response({ progress: { phase: 'done', completed: 1, total: 1 }, task: null }))
      await flush()
      assertWaiting(page)
      assert.equal(callsSince(start, 'build').length, 1, 'an old idle/done response cannot wake the rejected build')
      assert.equal(intervals.size, 1)
      assert.equal([...intervals.values()][0].delay, 600, 'waiting retains the normal progress polling interval')
      return { start, page, completion }
    }

    const busy = await beginWaiting()
    for (const kind of ['run', 'build', 'clean']) {
      await replyProgress(busy.start, { progress: { phase: 'done', completed: 1, total: 1 }, task: { kind, home: '/another-simulator' } })
      assertWaiting(busy.page)
      assert.equal(callsSince(busy.start, 'build').length, 1, 'an active runner task only polls progress, even for another directory')
      await pollIntervals()
      const progressCount = callsSince(busy.start, 'build-progress').length
      await pollIntervals()
      assert.equal(callsSince(busy.start, 'build-progress').length, progressCount, 'slow progress responses cannot cause overlapping polls')
      assert.equal(callsSince(busy.start, 'build').length, 1, 'timer ticks never repeatedly POST a busy build')
    }
    await replyProgress(busy.start, { progress: { phase: 'done', completed: 1, total: 1 } })
    assertWaiting(busy.page)
    assert.equal(callsSince(busy.start, 'build').length, 1, 'missing task metadata does not imply an idle runner')
    await replyProgress(busy.start, { progress: { phase: 'done', completed: 1, total: 1 }, task: null })
    assert.equal(callsSince(busy.start, 'build').length, 2, 'explicit idle starts exactly one new build request')
    assert.equal(busy.page.state.buildStatus.value, 'building')
    assert.equal(busy.page.state.buildProgress.value.phase, 'configure', 'stale done progress cannot pretend the newly started build succeeded')
    assert.equal(busy.page.state.catalogReady.value, false)
    await replyProgress(busy.start, { progress: { phase: 'build', completed: 2, total: 3 }, task: { kind: 'build', home: '/busy-simulator' } })
    assert.equal(busy.page.state.buildProgress.value.completed, 2, 'the resumed build uses ordinary progress updates')
    await replyProgress(busy.start, { progress: { phase: 'done', completed: 1, total: 1 }, task: null })
    assert.equal(callsSince(busy.start, 'build').length, 2, 'idle progress during an accepted build cannot submit another build')
    assert.equal(busy.page.state.buildStatus.value, 'building', 'only the build response establishes success')
    callsSince(busy.start, 'build')[1].resolve(response({ ok: true, stdout: 'resumed build complete', catalog: [{ id: 'after-wait' }] }))
    await flush()
    assert.equal(busy.page.state.buildStatus.value, 'ok')
    assert.equal(busy.page.state.buildProgress.value.phase, 'done')
    assert.equal(busy.page.state.buildLog.value, 'resumed build complete')
    assert.equal(busy.page.state.catalog.value[0].id, 'after-wait')
    assert.equal(busy.page.state.catalogReady.value, true)
    assert.equal(intervals.size, 0, 'successful queued compilation stops polling')
    await pollIntervals()
    assert.equal(callsSince(busy.start, 'build').length, 2)
    busy.page.unmount()

    const failProgress = async (start, failure) => {
      if (!pendingProgress(start).length) await pollIntervals()
      const pending = pendingProgress(start)
      assert.equal(pending.length, 1)
      const request = pending[0]
      answeredProgress.add(request)
      if (failure === 'http') request.resolve(response({ error: 'progress service unavailable' }, 503))
      else if (failure === 'timeout') {
        assert.equal(timeouts.size, 1, 'only the current progress request owns a timeout')
        const [id, timer] = [...timeouts][0]
        assert.equal(timer.delay, 10000, 'progress requests have a ten-second watchdog')
        timeouts.delete(id) // A real timeout is removed from the timer queue before invoking it.
        timer.callback()
        assert.equal(request.init.signal.aborted, true, 'the watchdog aborts a stalled progress request')
        request.reject(new DOMException('Progress request aborted', 'AbortError'))
      } else request.reject(new Error('progress network unavailable'))
      await flush()
      assert.equal(timeouts.size, 0, 'progress failure clears its watchdog before the next poll')
    }

    const recovered = await beginWaiting(true)
    await failProgress(recovered.start, 'network')
    assertWaiting(recovered.page)
    await replyProgress(recovered.start, { progress: null, task: { kind: 'run', home: '/recovering-runner' } })
    assertWaiting(recovered.page)
    assert.equal(timeouts.size, 0, 'a valid progress response also clears the request watchdog')
    // Two later failures must still be tolerated: the valid response reset the first failure.
    for (const failure of ['http', 'timeout']) {
      await failProgress(recovered.start, failure)
      assertWaiting(recovered.page)
    }
    assert.equal(callsSince(recovered.start, 'build').length, 1, 'recoverable progress failures never retry the busy build directly')
    await replyProgress(recovered.start, { progress: null, task: { kind: 'build', home: '/recovering-runner' } })
    assertWaiting(recovered.page)
    await replyProgress(recovered.start, { progress: null, task: null })
    assert.equal(callsSince(recovered.start, 'build').length, 2)
    callsSince(recovered.start, 'build')[1].resolve(response({ ok: true, catalog: [{ id: 'progress-recovered' }] }))
    await recovered.completion
    assert.equal(recovered.page.state.buildStatus.value, 'ok')
    assert.equal(recovered.page.state.catalog.value[0].id, 'progress-recovered')
    assert.equal(intervals.size, 0)
    assert.equal(timeouts.size, 0)
    recovered.page.unmount()

    const unreachable = await beginWaiting(true)
    let unreachableFinished = false
    unreachable.completion.then(() => { unreachableFinished = true })
    const expiredCallbacks = [...intervals.values()].map(({ callback }) => callback)
    for (const failure of ['network', 'http']) {
      await failProgress(unreachable.start, failure)
      assertWaiting(unreachable.page)
      assert.equal(unreachableFinished, false, 'fewer than three consecutive failures keep the caller waiting')
    }
    await failProgress(unreachable.start, 'timeout')
    assert.equal(unreachableFinished, true, 'three consecutive status failures release the precompile promise')
    assert.equal(unreachable.page.state.buildStatus.value, 'fail')
    assert.match(unreachable.page.state.buildError.value, /无法获取当前任务状态.*重新预编译/)
    assert.equal(unreachable.page.state.catalogReady.value, false)
    assert.equal(intervals.size, 0, 'unreachable runner status stops progress polling')
    assert.equal(timeouts.size, 0)
    const failedRequestCount = requests.length
    expiredCallbacks.forEach((callback) => callback())
    await flush()
    assert.equal(requests.length, failedRequestCount, 'old timer callbacks cannot restart a failed wait')
    assert.equal(callsSince(unreachable.start, 'build').length, 1)
    unreachable.page.unmount()

    const progressingStart = requests.length
    const progressing = mount(useSimulatorSettings)
    const progressingCompletion = progressing.state.precompile()
    const acceptedBuild = callsSince(progressingStart, 'build')[0]
    for (const failure of ['network', 'http', 'timeout']) {
      await failProgress(progressingStart, failure)
      assert.equal(progressing.state.buildStatus.value, 'building', 'progress failures cannot interrupt an accepted build')
      assert.equal(progressing.state.buildError.value, '')
      assert.equal(acceptedBuild.init.signal.aborted, false, 'a progress timeout never aborts the actual build request')
      assert.equal(intervals.size, 1)
    }
    await replyProgress(progressingStart, { progress: { phase: 'build', completed: 1, total: 4 }, task: { kind: 'build', home: '/building' } })
    assert.equal(progressing.state.buildProgress.value.completed, 1, 'normal build progress can recover after repeated errors')
    acceptedBuild.resolve(response({ ok: true, catalog: [{ id: 'build-uninterrupted' }] }))
    await progressingCompletion
    assert.equal(progressing.state.buildStatus.value, 'ok')
    assert.equal(progressing.state.catalog.value[0].id, 'build-uninterrupted')
    assert.equal(callsSince(progressingStart, 'build').length, 1)
    assert.equal(intervals.size, 0)
    assert.equal(timeouts.size, 0)
    progressing.unmount()

    const race = await beginWaiting(true)
    for (let attempt = 2; attempt <= 3; attempt += 1) {
      await replyProgress(race.start, { progress: null, task: null })
      assert.equal(callsSince(race.start, 'build').length, attempt)
      callsSince(race.start, 'build')[attempt - 1].resolve(busyResponse())
      await flush()
      assertWaiting(race.page)
      await replyProgress(race.start, { progress: null, task: { kind: 'run', home: '/winner-of-idle-race' } })
      assert.equal(callsSince(race.start, 'build').length, attempt, 'losing the idle-to-build race returns to polling without spinning')
    }
    await replyProgress(race.start, { progress: null, task: null })
    assert.equal(callsSince(race.start, 'build').length, 4)
    callsSince(race.start, 'build')[3].resolve(response({ ok: true, catalog: [{ id: 'race-success' }] }))
    await race.completion
    assert.equal(race.page.state.buildStatus.value, 'ok')
    assert.equal(race.page.state.catalog.value[0].id, 'race-success')
    assert.equal(intervals.size, 0)
    race.page.unmount()

    for (const [status, code] of [[500, 'SIMULATOR_BUSY'], [409, 'OTHER_CONFLICT']]) {
      const start = requests.length
      const failure = mount(useSimulatorSettings)
      const completion = failure.state.precompile()
      const callbacks = [...intervals.values()].map(({ callback }) => callback)
      callsSince(start, 'build')[0].resolve(response({ ok: false, code, error: 'real build failure' }, status))
      await completion
      assert.equal(failure.state.buildStatus.value, 'fail')
      assert.equal(failure.state.buildError.value, 'real build failure')
      assert.equal(intervals.size, 0)
      callbacks.forEach((callback) => callback())
      await flush()
      assert.equal(callsSince(start, 'build').length, 1, 'only HTTP 409 with SIMULATOR_BUSY may enter automatic waiting')
      failure.unmount()
    }

    for (const action of ['unmount', 'change-directory']) {
      const cancelled = await beginWaiting(true)
      const progress = pendingProgress(cancelled.start)[0]
      const callbacks = [...intervals.values()].map(({ callback }) => callback)
      let finished = false
      cancelled.completion.then(() => { finished = true })
      if (action === 'unmount') cancelled.page.unmount()
      else {
        cancelled.page.state.selectDirectory('/replacement-after-wait')
        requests.at(-1).resolve(response({ ok: true, home: '/replacement-after-wait', catalog: null }))
      }
      assert.equal(progress.init.signal.aborted, true)
      assert.equal(intervals.size, 0, `${action} stops the waiting progress timer`)
      assert.equal(timeouts.size, 0, `${action} clears the pending request watchdog immediately on abort`)
      const countAfterCancel = requests.length
      callbacks.forEach((callback) => callback())
      progress.resolve(response({ progress: { phase: 'done', completed: 1, total: 1 }, task: null }))
      await flush()
      assert.equal(finished, true, `${action} releases the suspended precompile caller`)
      assert.equal(requests.length, countAfterCancel, `${action} blocks late timer callbacks and idle responses from making requests`)
      assert.equal(callsSince(cancelled.start, 'build').length, 1, `${action} never submits the abandoned queued build`)
      assert.equal(cancelled.page.state.catalogReady.value, false)
      if (action === 'change-directory') {
        assert.equal(cancelled.page.state.buildStatus.value, 'idle')
        assert.equal(cancelled.page.state.buildProgress.value, null)
        assert.equal(cancelled.page.state.result.value.home, '/replacement-after-wait')
        cancelled.page.unmount()
      }
    }

    const manualStart = requests.length
    const manual = mount(useSimulatorSettings)
    const delayedInitialCheck = requests.at(-1)
    waiting = manual.state.precompile()
    assert.equal(delayedInitialCheck.init.signal.aborted, true)
    callsSince(manualStart, 'build')[0].resolve(response({ ok: true, catalog: [{ id: 'manual-success' }] }))
    await waiting
    delayedInitialCheck.resolve(response({ ok: true, catalog: [{ id: 'late-initial' }] }))
    await flush()
    assert.equal(callsSince(manualStart, 'build').length, 1, 'a manual build consumes startup auto-build even if it finishes before the check replies')
    assert.equal(manual.state.catalog.value[0].id, 'manual-success')
    manual.unmount()

    const leavingStart = requests.length
    const leaving = mount(useSimulatorSettings)
    const leavingCheck = requests.at(-1)
    leaving.unmount()
    assert.equal(leavingCheck.init.signal.aborted, true)
    leavingCheck.resolve(response({ ok: true, catalog: null }))
    await flush()
    assert.equal(callsSince(leavingStart, 'build').length, 0, 'an initial check arriving after unmount cannot build')

    const resetStart = requests.length
    const resetting = mount(useSimulatorSettings)
    const replacedCheck = requests.at(-1)
    resetting.state.resetDirectory()
    const resetCheck = requests.at(-1)
    assert.equal(replacedCheck.init.signal.aborted, true)
    replacedCheck.resolve(response({ ok: true, catalog: null }))
    resetCheck.resolve(response({ ok: true, catalog: null }))
    await flush()
    assert.equal(callsSince(resetStart, 'build').length, 0, 'reset before startup check finishes remains manual even when the directory string was already empty')
    resetting.unmount()

    for (const action of ['unmount', 'change-directory']) {
      const start = requests.length
      const startup = mount(useSimulatorSettings)
      requests.at(-1).resolve(response({ ok: true, catalog: null }))
      await flush()
      const build = callsSince(start, 'build')[0]
      const progress = callsSince(start, 'build-progress')[0]
      if (action === 'unmount') startup.unmount()
      else {
        startup.state.selectDirectory('/replacement')
        requests.at(-1).resolve(response({ ok: true, home: '/replacement', catalog: null }))
      }
      assert.equal(build.init.signal.aborted, true)
      assert.equal(progress.init.signal.aborted, true)
      build.resolve(response({ ok: true, catalog: [{ id: 'abandoned-auto-build' }] }))
      progress.resolve(response({ progress: { phase: 'build', completed: 99, total: 100 } }))
      await flush()
      assert.equal(startup.state.catalogReady.value, false, `${action} blocks late startup build responses`)
      assert.equal(callsSince(start, 'build').length, 1)
      if (action === 'change-directory') {
        assert.equal(startup.state.result.value.home, '/replacement')
        assert.equal(startup.state.buildStatus.value, 'idle')
        assert.equal(startup.state.buildProgress.value, null)
        startup.unmount()
      }
    }

    const directoryStart = requests.length
    const settings = mount(useSimulatorSettings)
    const firstCheck = requests.at(-1)
    settings.state.selectDirectory('/new-simulator')
    const currentCheck = requests.at(-1)
    assert.equal(firstCheck.init.signal.aborted, true)
    firstCheck.resolve(response({ ok: true, home: '/old', catalog: [{ id: 'old' }] }))
    currentCheck.resolve(response({ ok: true, home: '/new-simulator', catalog: [{ id: 'new' }] }))
    await flush()
    assert.equal(settings.state.result.value.home, '/new-simulator')
    assert.equal(settings.state.catalog.value[0].id, 'new')
    assert.equal(callsSince(directoryStart, 'build').length, 0, 'neither stale initial checks nor explicit replacement checks auto-build')

    const startingAt = requests.length
    waiting = settings.state.precompile()
    const build = requests.slice(startingAt).find(({ url }) => url.endsWith('/build'))
    const progress = requests.slice(startingAt).find(({ url }) => url.endsWith('/build-progress'))
    settings.state.selectDirectory('/another-simulator')
    const nextCheck = requests.at(-1)
    assert.equal(build.init.signal.aborted, true)
    assert.equal(progress.init.signal.aborted, true)
    progress.resolve(response({ progress: { phase: 'build', completed: 90, total: 100 } }))
    build.resolve(response({ ok: true, stdout: 'old output', catalog: [{ id: 'stale-build' }] }))
    nextCheck.resolve(response({ ok: true, home: '/another-simulator', catalog: null }))
    await waiting
    await flush()
    assert.equal(settings.state.catalogReady.value, false)
    assert.equal(settings.state.buildStatus.value, 'idle')
    assert.equal(settings.state.buildLog.value, '')
    assert.equal(settings.state.buildProgress.value, null)
    settings.unmount()

    const cleaningStart = requests.length
    const cleaning = mount(useSimulatorSettings)
    const staleCheck = requests.at(-1)
    waiting = cleaning.state.clearBuild()
    const clean = requests.at(-1)
    assert.equal(staleCheck.init.signal.aborted, true)
    staleCheck.resolve(response({ ok: true, catalog: [{ id: 'cached-before-clean' }] }))
    clean.resolve(response({ ok: true, stdout: 'cleaned' }))
    await waiting
    await flush()
    assert.equal(cleaning.state.catalogReady.value, false, 'a stale directory check cannot revive a cleaned catalog')
    assert.equal(cleaning.state.cleanStatus.value, 'ok')
    assert.equal(callsSince(cleaningStart, 'build').length, 0, 'a manual clean supersedes startup auto-build')
    cleaning.unmount()

    const editor = {
      editNodes: ref([]), selectedIds: ref([]), experimentForm: ref(createDefaultExperimentForm()),
      activeCatalogId: ref('mac:swarm'), topologyError: ref('最多支持 64 个节点'),
    }
    const files = mount(() => useExperimentFiles(editor, ref(TYPEID_LAYERS), ref(''), () => {}, () => {}))
    files.state.newExperiment()
    assert.equal(editor.topologyError.value, '', 'new drafts clear stale topology warnings')
    editor.topologyError.value = 'old topology error'
    await files.state.importFile({ name: 'empty.json', size: 100, text: async () => files.state.documentJson.value })
    assert.equal(editor.topologyError.value, '', 'successful imports clear stale topology warnings')
    assert.equal(files.state.failed.value, false)
    files.unmount()
    assert.equal(timeouts.size, 0, 'request regressions leave no pending watchdogs')
    console.log('Request regressions passed: startup precompile, busy-runner wait/races, progress recovery/timeouts, true failures, cached catalogs, manual precedence, unmount and directory cancellation.')
  } finally {
    for (const app of apps) app.unmount()
    globalThis.fetch = originalFetch
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
    else delete globalThis.localStorage
  }
}
