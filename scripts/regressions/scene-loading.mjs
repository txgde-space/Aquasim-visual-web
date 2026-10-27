import assert from 'node:assert/strict'
import { effectScope } from 'vue'

export async function checkSceneLoading(server) {
  const { useSceneLoader } = await server.ssrLoadModule('/src/features/scene3d/lib/useSceneLoader.ts')
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const timers = new Map()
  let timerId = 0
  globalThis.setTimeout = (callback) => { timers.set(++timerId, callback); return timerId }
  globalThis.clearTimeout = (id) => timers.delete(id)
  const scopes = []
  const createLoader = (importScene) => {
    const scope = effectScope()
    scopes.push(scope)
    return { scope, loader: scope.run(() => useSceneLoader(importScene)) }
  }
  const pendingImport = () => {
    let resolve
    let reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    return { promise, resolve, reject }
  }
  const Scene = { name: 'LoadedScene', render: () => null }
  try {
    let imports = 0
    const importFailure = new TypeError('Failed to fetch dynamically imported module')
    const { loader } = createLoader(async () => {
      imports += 1
      if (imports === 1) throw importFailure
      return Scene
    })
    assert.equal(imports, 0, 'creating the boundary does not eagerly import Babylon')
    await loader.load()
    assert.equal(loader.error.value, importFailure, 'rejected dynamic imports become an explicit error')
    assert.equal(loader.loading.value, false, 'import failure ends the loading indicator')
    assert.equal(loader.component.value, null)
    assert.equal(timers.size, 0)
    await loader.load()
    assert.equal(imports, 2, 'retry invokes the loader again')
    assert.equal(loader.component.value, Scene)
    assert.equal(loader.error.value, null)
    assert.equal(loader.loading.value, false)
    loader.reportError(new Error('Scene initialization failed'))
    assert.equal(loader.component.value, null, 'runtime initialization failure unmounts the failed scene')
    assert.match(loader.error.value.message, /initialization failed/)
    await loader.load()
    assert.equal(loader.component.value, Scene, 'initialization failure can also be retried')

    const stale = pendingImport()
    const current = pendingImport()
    let attempt = 0
    const { loader: retryLoader } = createLoader(() => (++attempt === 1 ? stale.promise : current.promise))
    const firstLoad = retryLoader.load()
    assert.equal(retryLoader.loading.value, true)
    const secondLoad = retryLoader.load()
    assert.equal(timers.size, 1, 'retry clears the previous attempt timeout')
    current.resolve(Scene)
    await secondLoad
    stale.reject(new Error('stale request failed'))
    await firstLoad
    assert.equal(retryLoader.component.value, Scene, 'an old import rejection cannot replace the successful retry')
    assert.equal(retryLoader.error.value, null)

    const slow = pendingImport()
    const { loader: timeoutLoader } = createLoader(() => slow.promise)
    const slowLoad = timeoutLoader.load()
    const timeout = [...timers.values()][0]
    timeout()
    assert.equal(timeoutLoader.loading.value, false, 'a stalled request cannot spin indefinitely')
    assert.match(timeoutLoader.error.value.message, /超时/)
    assert.equal(timers.size, 0)
    slow.resolve(Scene)
    await slowLoad
    assert.equal(timeoutLoader.component.value, null, 'late success does not silently remove a timeout error')

    const abandoned = pendingImport()
    const { scope, loader: abandonedLoader } = createLoader(() => abandoned.promise)
    const abandonedLoad = abandonedLoader.load()
    scope.stop()
    assert.equal(timers.size, 0, 'route teardown cancels the timeout')
    abandoned.resolve(Scene)
    await abandonedLoad
    assert.equal(abandonedLoader.component.value, null, 'an import finishing after unmount cannot mount the scene')
    abandonedLoader.reportError(new Error('late render error'))
    assert.equal(abandonedLoader.error.value, null, 'disposed boundaries ignore late render errors')
    console.log('3D loading regressions passed: lazy import, rejection, retry, timeout, stale results, runtime failure and cleanup.')
  } finally {
    for (const scope of scopes) scope.stop()
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
}
