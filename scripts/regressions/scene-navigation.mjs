import assert from 'node:assert/strict'
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core'

class TrackedTarget extends EventTarget {
  listeners = new Map()
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options)
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(listener)
  }
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options)
    this.listeners.get(type)?.delete(listener)
  }
  get listenerCount() { return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0) }
}
const event = (type, extra = {}) => Object.assign(new Event(type, { cancelable: true }), extra)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const close = (actual, expected, label) => assert.ok(Vector3.Distance(actual, expected) < 1e-5, label)

export async function checkSceneNavigation(server) {
  const { createSceneNavigation } = await server.ssrLoadModule('/src/features/scene3d/lib/sceneNavigation.ts')
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const harnesses = []
  let count = 0
  const createHarness = () => {
    const doc = new TrackedTarget(), win = new TrackedTarget(), canvas = new TrackedTarget(), host = new TrackedTarget()
    Object.assign(doc, { defaultView: win, activeElement: null, pointerLockElement: null, fullscreenElement: null, visibilityState: 'visible' })
    Object.assign(canvas, { ownerDocument: doc, focus: () => { doc.activeElement = canvas; doc.dispatchEvent(event('focusin')) } })
    const camera = new ArcRotateCamera(`navigation-${++count}`, -Math.PI / 3, Math.PI / 2.9, 1000, Vector3.Zero(), scene)
    let active = true, userGesture = false, requests = 0, lockExits = 0, fullRequests = 0, fullExits = 0, resizeCount = 0, attached = 0, detached = 0
    const updates = []
    camera.attachControl = () => { attached++ }
    camera.detachControl = () => { detached++ }
    const grantLock = () => { doc.pointerLockElement = canvas; doc.dispatchEvent(event('pointerlockchange')) }
    const grantFullscreen = () => { doc.fullscreenElement = host; doc.dispatchEvent(event('fullscreenchange')) }
    canvas.requestPointerLock = () => {
      assert.equal(userGesture, true, 'pointer lock is requested synchronously inside the explicit gesture')
      requests++; grantLock(); return Promise.resolve()
    }
    doc.exitPointerLock = () => { lockExits++; doc.pointerLockElement = null; doc.dispatchEvent(event('pointerlockchange')) }
    host.requestFullscreen = () => { fullRequests++; grantFullscreen(); return Promise.resolve() }
    doc.exitFullscreen = () => { fullExits++; doc.fullscreenElement = null; doc.dispatchEvent(event('fullscreenchange')); return Promise.resolve() }
    const navigation = createSceneNavigation({ canvas, host, getCamera: () => camera, getActive: () => active,
      onResize: () => { resizeCount++ }, onStateChange: (state) => updates.push(state) })
    const gesture = (fn) => { userGesture = true; try { return fn() } finally { userGesture = false } }
    const enter = () => gesture(() => navigation.requestRoaming())
    const eye = () => { camera.getViewMatrix(true); return camera.position.clone() }
    const key = (code, extra = {}) => {
      const keydown = event('keydown', { code, key: code === 'Escape' ? 'Escape' : code.replace(/^Key/, '').toLowerCase(), ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...extra })
      canvas.dispatchEvent(keydown)
      return keydown
    }
    const release = (code) => win.dispatchEvent(event('keyup', { code }))
    const step = (seconds = .02) => { navigation.moveFromKeyboard(seconds); return eye() }
    const move = (code, extra = {}) => {
      const before = eye(); key(code, extra); const after = step(); release(code); return after.subtract(before)
    }
    const harness = { doc, win, canvas, host, camera, navigation, updates, gesture, enter, eye, key, release, step, move, grantLock, grantFullscreen,
      setActive(value) { active = value }, get calls() { return { requests, lockExits, fullRequests, fullExits, resizeCount, attached, detached } } }
    harnesses.push(harness)
    return harness
  }
  try {
    const h = createHarness()
    assert.deepEqual(h.navigation.state, { mode: 'orbit', pointerLocked: false, fullscreen: false, error: '' })
    assert.equal(h.calls.requests, 0, 'constructing navigation never captures the mouse')
    h.canvas.dispatchEvent(event('pointerdown'))
    assert.equal(h.doc.activeElement, h.canvas)
    assert.equal(h.calls.requests, 0, 'ordinary canvas clicks retain normal orbit control')
    const originalRadius = h.camera.radius
    const pinch = event('wheel', { ctrlKey: true, deltaY: -30 })
    h.canvas.dispatchEvent(pinch)
    assert.equal(pinch.defaultPrevented, true, 'trackpad pinch prevents browser page zoom')
    assert.ok(h.camera.radius < originalRadius, 'trackpad pinch zooms the 3D camera')
    const ordinaryWheel = event('wheel', { ctrlKey: false, deltaY: 10 })
    h.canvas.dispatchEvent(ordinaryWheel)
    assert.equal(ordinaryWheel.defaultPrevented, false, 'ordinary wheel remains owned by Babylon orbit controls')
    const nativeStart = event('gesturestart', { scale: 1 }); h.canvas.dispatchEvent(nativeStart)
    const nativeChange = event('gesturechange', { scale: 2 }); const beforeNative = h.camera.radius; h.canvas.dispatchEvent(nativeChange)
    assert.equal(nativeStart.defaultPrevented && nativeChange.defaultPrevented, true, 'native Safari pinch also suppresses page zoom')
    assert.ok(Math.abs(h.camera.radius - beforeNative / 2) < 1e-6)
    const duringNative = h.camera.radius; h.canvas.dispatchEvent(event('wheel', { ctrlKey: true, deltaY: -20 }))
    assert.equal(h.camera.radius, duringNative, 'native gesture and wheel do not apply the same zoom twice')
    h.canvas.dispatchEvent(event('gestureend'))
    h.camera.radius = originalRadius
    const startEye = h.eye()
    await h.enter()
    assert.equal(h.navigation.state.mode, 'roam')
    assert.equal(h.navigation.state.pointerLocked, true)
    assert.equal(h.calls.detached, 1, 'roaming detaches orbit pointer inputs')
    assert.equal(h.updates[0].mode, 'orbit', 'published state snapshots do not mutate after subsequent transitions')
    const targetBeforeLook = h.camera.getTarget().clone()
    const viewBeforeLook = h.camera.getViewMatrix(true).clone()
    h.doc.dispatchEvent(event('mousemove', { movementX: 140, movementY: 0 }))
    close(h.eye(), startEye, 'mouse look rotates around the eye without translating the camera')
    assert.ok(Vector3.Distance(h.camera.getTarget(), targetBeforeLook) > 1, 'mouse motion changes the look direction')
    const lookRight = Vector3.TransformNormal(h.camera.getTarget().subtract(targetBeforeLook), viewBeforeLook)
    assert.ok(lookRight.x > 0, 'positive horizontal mouse motion turns the view towards screen right')
    const targetBeforeDown = h.camera.getTarget().clone(), viewBeforeDown = h.camera.getViewMatrix(true).clone()
    h.doc.dispatchEvent(event('mousemove', { movementX: 0, movementY: 65 }))
    const lookDown = Vector3.TransformNormal(h.camera.getTarget().subtract(targetBeforeDown), viewBeforeDown)
    assert.ok(lookDown.y < 0, 'positive vertical mouse motion turns the view down')
    h.doc.dispatchEvent(event('mousemove', { movementX: 0, movementY: 1e8 }))
    assert.ok(h.camera.beta > 0 && h.camera.beta < Math.PI, 'pitch clamps before a vertical singularity')
    h.doc.dispatchEvent(event('mousemove', { movementX: 0, movementY: -400 }))
    const viewForward = h.camera.getTarget().subtract(h.eye()); viewForward.y = 0; viewForward.normalize()
    const w = h.move('KeyW'), s = h.move('KeyS'), d = h.move('KeyD'), a = h.move('KeyA')
    assert.ok(Vector3.Dot(w, viewForward) > 0 && Vector3.Dot(s, viewForward) < 0, 'W/S move forward/back relative to the current view')
    assert.ok(Vector3.TransformNormal(d, h.camera.getViewMatrix(true)).x > 0, 'D moves to actual screen right in the Babylon view matrix')
    close(d, a.scale(-1), 'A/D travel in opposite directions')
    assert.ok(Math.abs(w.y) < 1e-6 && Math.abs(s.y) < 1e-6, 'W/S stay on the horizontal plane despite looking up/down')
    assert.ok(h.move('Space').y > 0, 'Space ascends')
    assert.ok(h.move('ShiftLeft').y < 0 && h.move('ShiftRight').y < 0, 'either Shift key descends')
    assert.equal(h.key('Space').defaultPrevented, true, 'Space does not scroll the focused canvas')
    h.release('Space')
    const normalDistance = h.move('KeyW').length()
    h.key('ShiftLeft'); const descendingForward = h.move('KeyW'); h.release('ShiftLeft')
    assert.ok(descendingForward.y < 0, 'W plus Shift moves forward and down')
    assert.ok(Math.abs(descendingForward.length() - normalDistance) < 1e-5, 'Shift descends without a hidden speed boost')
    h.key('Space'); h.key('ShiftLeft')
    const beforeOppositeKeys = h.eye()
    close(h.step(), beforeOppositeKeys, 'opposing ascent and descent cancel')
    h.release('Space'); h.release('ShiftLeft')
    const beforeLongFrame = h.eye(); h.key('KeyW'); const afterLongFrame = h.step(30); h.release('KeyW')
    assert.ok(afterLongFrame.subtract(beforeLongFrame).length() < normalDistance * 3, 'a delayed frame cannot launch the camera a large distance')
    const eyeBeforeExit = h.eye(), targetBeforeExit = h.camera.getTarget().clone()
    h.navigation.exitRoaming()
    assert.equal(h.navigation.state.mode, 'orbit')
    assert.equal(h.doc.pointerLockElement, null)
    assert.ok(h.calls.attached > 0, 'leaving roaming restores orbit input')
    close(h.eye(), eyeBeforeExit, 'returning to orbit preserves the camera eye')
    close(h.camera.getTarget(), targetBeforeExit, 'returning to orbit preserves the viewing direction')
    h.doc.dispatchEvent(event('mousemove', { movementX: 500, movementY: 100 }))
    close(h.eye(), eyeBeforeExit, 'unlocked mouse motion is ignored by the roaming controller')

    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) {
      const before = h.eye(), pressed = h.key('KeyW', modifiers)
      close(h.step(), before, 'modified keys and IME composition do not move the camera')
      assert.equal(pressed.defaultPrevented, false)
      h.release('KeyW')
    }
    h.doc.activeElement = { tagName: 'INPUT' }
    const formEye = h.eye(), formKey = h.key('KeyW')
    close(h.step(), formEye, 'a form with focus never drives the camera')
    assert.equal(formKey.defaultPrevented, false, 'form typing is not intercepted')
    h.canvas.focus()
    close(h.step(), formEye, 'returning focus does not replay a key typed in a form')
    await h.enter()
    const handledMove = event('keydown', { code: 'KeyW', key: 'w' }); handledMove.preventDefault(); h.canvas.dispatchEvent(handledMove)
    const handledEye = h.eye(); close(h.step(), handledEye, 'movement keys already handled by another control are ignored')
    const handledEscape = event('keydown', { code: 'Escape', key: 'Escape' }); handledEscape.preventDefault(); h.canvas.dispatchEvent(handledEscape)
    assert.equal(h.navigation.state.mode, 'roam', 'Escape already consumed by a popup does not also exit navigation')
    h.navigation.exitRoaming()

    for (const trigger of ['escape', 'canvas-blur', 'window-blur', 'hidden', 'inactive', 'focusout', 'lock-loss']) {
      await h.enter(); h.key('KeyW')
      if (trigger === 'escape') h.key('Escape')
      if (trigger === 'canvas-blur') h.canvas.dispatchEvent(event('blur'))
      if (trigger === 'window-blur') h.win.dispatchEvent(event('blur'))
      if (trigger === 'hidden') { h.doc.visibilityState = 'hidden'; h.doc.dispatchEvent(event('visibilitychange')) }
      if (trigger === 'inactive') { h.setActive(false); h.navigation.suspend() }
      if (trigger === 'focusout') { h.doc.activeElement = { tagName: 'TEXTAREA' }; h.doc.dispatchEvent(event('focusin')) }
      if (trigger === 'lock-loss') { h.doc.pointerLockElement = null; h.doc.dispatchEvent(event('pointerlockchange')) }
      assert.equal(h.navigation.state.mode, 'orbit', `${trigger} returns to orbit`)
      assert.equal(h.doc.pointerLockElement, null, `${trigger} releases this canvas's pointer lock`)
      h.doc.visibilityState = 'visible'; h.setActive(true); h.canvas.focus()
      const stoppedAt = h.eye(); close(h.step(), stoppedAt, `${trigger} clears held movement keys`)
    }
    const successfulLockRequest = h.canvas.requestPointerLock
    h.canvas.requestPointerLock = () => Promise.reject(new Error('permission denied'))
    await h.enter()
    assert.equal(h.navigation.state.mode, 'orbit')
    assert.match(h.navigation.state.error, /锁定鼠标/)
    h.canvas.requestPointerLock = successfulLockRequest
    await h.enter()
    assert.equal(h.navigation.state.error, '', 'a successful retry clears the pointer lock error')
    h.doc.dispatchEvent(event('pointerlockerror'))
    assert.equal(h.navigation.state.mode, 'orbit')
    assert.match(h.navigation.state.error, /锁定鼠标/)
    const noLock = h.canvas.requestPointerLock; delete h.canvas.requestPointerLock
    await h.enter()
    assert.match(h.navigation.state.error, /不支持漫游/)
    h.canvas.requestPointerLock = noLock

    const sizeBefore = h.calls.resizeCount
    await h.navigation.toggleFullscreen()
    assert.equal(h.navigation.state.fullscreen, true)
    assert.equal(h.doc.fullscreenElement, h.host)
    assert.ok(h.calls.resizeCount > sizeBefore, 'entering fullscreen resizes the scene')
    h.key('KeyW')
    await h.navigation.toggleFullscreen()
    assert.equal(h.navigation.state.fullscreen, false)
    const afterFullscreen = h.eye(); close(h.step(), afterFullscreen, 'fullscreen changes clear held movement keys')
    const requestFullscreen = h.host.requestFullscreen
    h.host.requestFullscreen = () => Promise.reject(new Error('permission denied'))
    await h.navigation.toggleFullscreen()
    assert.match(h.navigation.state.error, /无法切换全屏/)
    assert.equal(h.navigation.state.fullscreen, false)
    h.host.requestFullscreen = requestFullscreen
    await h.navigation.toggleFullscreen()
    assert.equal(h.navigation.state.error, '', 'fullscreen failures allow a later successful retry')
    h.doc.fullscreenElement = null; h.doc.dispatchEvent(event('fullscreenchange'))
    assert.equal(h.navigation.state.fullscreen, false, 'browser-driven fullscreen exit synchronizes the control')

    const lateLock = createHarness(), pendingLock = deferred()
    lateLock.canvas.requestPointerLock = () => pendingLock.promise
    const lockRequest = lateLock.enter()
    lateLock.navigation.suspend()
    lateLock.grantLock(); pendingLock.resolve(); await lockRequest
    assert.equal(lateLock.doc.pointerLockElement, null, 'a cancelled pending lock cannot recapture the mouse later')
    const disposedLock = createHarness(), disposedPending = deferred()
    disposedLock.canvas.requestPointerLock = () => disposedPending.promise
    const disposeLockRequest = disposedLock.enter()
    disposedLock.navigation.dispose()
    disposedLock.grantLock(); disposedPending.resolve(); await disposeLockRequest
    assert.equal(disposedLock.doc.pointerLockElement, null, 'a lock granted after unmount is released')

    const lateFullscreen = createHarness(), pendingFullscreen = deferred()
    lateFullscreen.host.requestFullscreen = () => pendingFullscreen.promise
    const fullscreenRequest = lateFullscreen.navigation.toggleFullscreen()
    lateFullscreen.navigation.dispose()
    lateFullscreen.grantFullscreen(); pendingFullscreen.resolve(); await fullscreenRequest
    assert.equal(lateFullscreen.doc.fullscreenElement, null, 'fullscreen granted after unmount is released')
    const hiddenFullscreen = createHarness(), hiddenPending = deferred()
    hiddenFullscreen.host.requestFullscreen = () => hiddenPending.promise
    const hiddenRequest = hiddenFullscreen.navigation.toggleFullscreen()
    hiddenFullscreen.doc.visibilityState = 'hidden'; hiddenFullscreen.doc.dispatchEvent(event('visibilitychange'))
    hiddenFullscreen.grantFullscreen(); hiddenPending.resolve(); await hiddenRequest
    assert.equal(hiddenFullscreen.doc.fullscreenElement, null, 'a fullscreen request finishing in a hidden view is released')

    await h.enter(); await h.navigation.toggleFullscreen(); h.key('KeyW')
    h.navigation.dispose()
    assert.deepEqual(h.navigation.state, { mode: 'orbit', pointerLocked: false, fullscreen: false, error: '' })
    assert.equal(h.doc.pointerLockElement, null)
    assert.equal(h.doc.fullscreenElement, null)
    assert.equal(h.doc.listenerCount + h.win.listenerCount + h.canvas.listenerCount, 0, 'unmount releases every input listener')
    const disposedEye = h.eye(); h.key('KeyW'); close(h.step(), disposedEye, 'disposed controls cannot move the camera')
    h.navigation.dispose()
    console.log('3D navigation regressions passed: explicit pointer lock, eye-relative look, WASD/Space/Shift, focus guards, cancellation, fullscreen errors/resizing, orbit restoration and disposal.')
  } finally {
    for (const h of harnesses) h.navigation.dispose()
    scene.dispose(); engine.dispose()
  }
}
