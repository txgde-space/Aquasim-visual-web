import { Vector3, type ArcRotateCamera } from '@babylonjs/core'

export interface SceneNavigationState {
  mode: 'orbit' | 'roam'
  pointerLocked: boolean
  fullscreen: boolean
  error: string
}
interface NavigationDeps {
  canvas: HTMLCanvasElement
  host: HTMLElement | null
  getCamera: () => ArcRotateCamera | null
  getActive?: () => boolean
  onResize: () => void
  onStateChange?: (state: SceneNavigationState) => void
}
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'])
const LOOK_SENSITIVITY = 0.0022

/** Camera navigation owns input only; it never changes node/world positions. */
export const createSceneNavigation = ({ canvas, host, getCamera, getActive, onResize, onStateChange }: NavigationDeps) => {
  const doc = canvas.ownerDocument || document
  const win = doc.defaultView || window
  const pressedKeys = new Set<string>()
  let gestureScale = 1
  let gestureActive = false
  let disposed = false
  let requestVersion = 0
  const state: SceneNavigationState = { mode: 'orbit', pointerLocked: false, fullscreen: false, error: '' }
  const publish = () => onStateChange?.({ ...state })
  const clearKeys = () => { pressedKeys.clear(); gestureActive = false; gestureScale = 1 }
  const canNavigate = () => !disposed && getActive?.() !== false && doc.visibilityState !== 'hidden'
  const focusIsCanvas = () => doc.activeElement === canvas
  const clearInertia = () => {
    const camera = getCamera()
    if (!camera) return
    camera.inertialAlphaOffset = 0; camera.inertialBetaOffset = 0; camera.inertialRadiusOffset = 0
    camera.inertialPanningX = 0; camera.inertialPanningY = 0
  }
  const attachOrbit = () => {
    const camera = getCamera()
    if (!camera || disposed) return
    camera.attachControl(canvas, false)
    const pointers = camera.inputs?.attached?.pointers as { buttons?: number[] } | undefined
    if (pointers) pointers.buttons = [0]
  }
  const releaseLock = () => {
    if (doc.pointerLockElement === canvas && typeof doc.exitPointerLock === 'function') doc.exitPointerLock()
  }
  const exitRoaming = () => {
    requestVersion++
    clearKeys(); clearInertia()
    const wasRoaming = state.mode === 'roam'
    state.mode = 'orbit'; state.pointerLocked = false
    releaseLock()
    if (wasRoaming) attachOrbit()
    publish()
  }
  const suspend = () => { clearKeys(); exitRoaming() }
  const requestRoaming = async () => {
    if (!canNavigate()) return
    const camera = getCamera()
    if (!camera) return
    state.error = ''
    if (typeof canvas.requestPointerLock !== 'function') {
      state.error = '当前浏览器不支持漫游'; publish(); return
    }
    const version = ++requestVersion
    clearKeys(); clearInertia(); canvas.focus({ preventScroll: true })
    camera.detachControl()
    state.mode = 'roam'; publish()
    try {
      // This call is synchronous with the explicit button gesture, before awaiting.
      await canvas.requestPointerLock()
      if (disposed || version !== requestVersion || !canNavigate()) { releaseLock(); return }
      state.pointerLocked = doc.pointerLockElement === canvas
      publish()
    } catch {
      if (disposed || version !== requestVersion) return
      exitRoaming(); state.error = '无法锁定鼠标，请重试'; publish()
    }
  }
  const toggleFullscreen = async () => {
    if (!canNavigate() || !host) return
    state.error = ''
    try {
      if (doc.fullscreenElement === host) await doc.exitFullscreen()
      else if (typeof host.requestFullscreen === 'function') await host.requestFullscreen()
      else { state.error = '当前浏览器不支持全屏'; publish(); return }
      if (disposed || !canNavigate()) {
        if (doc.fullscreenElement === host) await doc.exitFullscreen()
        return
      }
      state.fullscreen = doc.fullscreenElement === host
      onResize(); publish()
    } catch {
      if (disposed) return
      state.error = '无法切换全屏，请重试'; publish()
    }
  }
  const onPointerLockChange = () => {
    const locked = doc.pointerLockElement === canvas
    if (locked && (state.mode !== 'roam' || !canNavigate())) { releaseLock(); return }
    if (!locked && state.mode === 'roam') { exitRoaming(); return }
    state.pointerLocked = locked; publish()
  }
  const onPointerLockError = () => {
    if (state.mode !== 'roam') return
    exitRoaming(); state.error = '无法锁定鼠标，请重试'; publish()
  }
  const onMouseMove = (event: MouseEvent) => {
    if (!canNavigate() || !state.pointerLocked || state.mode !== 'roam') return
    const camera = getCamera()
    if (!camera || !Number.isFinite(event.movementX) || !Number.isFinite(event.movementY)) return
    camera.getViewMatrix(true)
    const eye = camera.position.clone()
    camera.alpha -= event.movementX * LOOK_SENSITIVITY
    camera.beta = Math.max(0.06, Math.min(Math.PI - 0.06, camera.beta - event.movementY * LOOK_SENSITIVITY))
    const offset = new Vector3(
      Math.cos(camera.alpha) * Math.sin(camera.beta), Math.cos(camera.beta), Math.sin(camera.alpha) * Math.sin(camera.beta),
    ).scale(camera.radius)
    camera.setTarget(eye.subtract(offset), false, true, true)
    camera.getViewMatrix(true)
  }
  const zoomCamera = (factor: number) => {
    const camera = getCamera()
    if (!camera || !Number.isFinite(factor) || factor <= 0) return
    camera.inertialRadiusOffset = 0
    camera.radius = Math.max(camera.lowerRadiusLimit ?? 1, Math.min(camera.upperRadiusLimit ?? Infinity, camera.radius * factor))
  }
  const onPinchWheel = (event: WheelEvent) => {
    if (!canNavigate() || !event.ctrlKey) return
    event.preventDefault(); event.stopImmediatePropagation()
    if (!gestureActive) zoomCamera(Math.exp(Math.max(-1, Math.min(1, event.deltaY * 0.008))))
  }
  const onGestureStart = (event: Event) => {
    if (!canNavigate()) return
    event.preventDefault(); gestureActive = true
    gestureScale = (event as Event & { scale?: number }).scale || 1
  }
  const onGestureChange = (event: Event) => {
    if (!canNavigate()) return
    event.preventDefault()
    const scale = (event as Event & { scale?: number }).scale
    if (!Number.isFinite(scale) || !scale || scale <= 0) return
    zoomCamera(gestureScale / scale); gestureScale = scale
  }
  const onGestureEnd = (event: Event) => {
    if (canNavigate()) event.preventDefault()
    gestureActive = false; gestureScale = 1
  }
  const onPointerDown = () => { if (canNavigate()) canvas.focus({ preventScroll: true }) }
  const onKeyDown = (event: KeyboardEvent) => {
    if (!canNavigate() || !focusIsCanvas() || event.defaultPrevented || event.isComposing) return
    if (event.key === 'Escape') { exitRoaming(); return }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (!MOVE_KEYS.has(event.code)) return
    event.preventDefault()
    pressedKeys.add(event.code)
  }
  const onKeyUp = (event: KeyboardEvent) => pressedKeys.delete(event.code)
  const onFullscreenChange = () => {
    if (disposed) return
    state.fullscreen = doc.fullscreenElement === host && host !== null
    clearKeys(); onResize(); publish()
  }
  const onVisibilityChange = () => { if (doc.visibilityState === 'hidden') suspend() }
  const onFocusIn = () => { if (!focusIsCanvas()) suspend() }
  const moveFromKeyboard = (seconds: number) => {
    if (!canNavigate() || !focusIsCanvas()) { clearKeys(); return }
    const camera = getCamera()
    if (!camera || !pressedKeys.size || !Number.isFinite(seconds) || seconds <= 0) return
    const forward = camera.getTarget().subtract(camera.position)
    forward.y = 0
    if (forward.lengthSquared() < 1e-6) forward.set(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha))
    forward.normalize()
    const right = Vector3.Cross(Vector3.Up(), forward).normalize()
    const direction = forward.scale(Number(pressedKeys.has('KeyW')) - Number(pressedKeys.has('KeyS')))
      .add(right.scale(Number(pressedKeys.has('KeyD')) - Number(pressedKeys.has('KeyA'))))
      .add(Vector3.Up().scale(Number(pressedKeys.has('Space')) - Number(pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight'))))
    if (direction.lengthSquared() === 0) return
    const speed = Math.max(0.35, Math.min(2400, camera.radius * 0.18))
    const distance = speed * Math.min(seconds, 0.05)
    camera.setTarget(camera.getTarget().add(direction.normalize().scale(distance)), false, false, true)
  }

  canvas.addEventListener('wheel', onPinchWheel, { passive: false, capture: true })
  canvas.addEventListener('gesturestart', onGestureStart, { passive: false })
  canvas.addEventListener('gesturechange', onGestureChange, { passive: false })
  canvas.addEventListener('gestureend', onGestureEnd, { passive: false })
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('keydown', onKeyDown)
  canvas.addEventListener('blur', suspend)
  win.addEventListener('keyup', onKeyUp)
  win.addEventListener('blur', suspend)
  doc.addEventListener('pointerlockchange', onPointerLockChange)
  doc.addEventListener('pointerlockerror', onPointerLockError)
  doc.addEventListener('mousemove', onMouseMove)
  doc.addEventListener('fullscreenchange', onFullscreenChange)
  doc.addEventListener('visibilitychange', onVisibilityChange)
  doc.addEventListener('focusin', onFocusIn)
  publish()

  return {
    get state(): Readonly<SceneNavigationState> { return state },
    requestRoaming, exitRoaming, toggleFullscreen, moveFromKeyboard, suspend,
    dispose: () => {
      if (disposed) return
      disposed = true; requestVersion++; clearKeys(); releaseLock()
      if (host && doc.fullscreenElement === host && typeof doc.exitFullscreen === 'function') void doc.exitFullscreen().catch(() => {})
      canvas.removeEventListener('wheel', onPinchWheel, true)
      canvas.removeEventListener('gesturestart', onGestureStart)
      canvas.removeEventListener('gesturechange', onGestureChange)
      canvas.removeEventListener('gestureend', onGestureEnd)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('blur', suspend)
      win.removeEventListener('keyup', onKeyUp); win.removeEventListener('blur', suspend)
      doc.removeEventListener('pointerlockchange', onPointerLockChange); doc.removeEventListener('pointerlockerror', onPointerLockError)
      doc.removeEventListener('mousemove', onMouseMove); doc.removeEventListener('fullscreenchange', onFullscreenChange)
      doc.removeEventListener('visibilitychange', onVisibilityChange); doc.removeEventListener('focusin', onFocusIn)
      state.mode = 'orbit'; state.pointerLocked = false; state.fullscreen = false; publish()
    },
  }
}

export type SceneNavigation = ReturnType<typeof createSceneNavigation>
