import { onMounted, onBeforeUnmount, type Ref } from 'vue'
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  PointerEventTypes,
  Scene,
  Vector3,
  type Observer,
  type PointerInfo,
} from '@babylonjs/core'

/** Initial spherical coordinates and radius of the default camera pose. */
const CAMERA_ALPHA = -Math.PI / 3
const CAMERA_BETA = Math.PI / 2.9
const CAMERA_RADIUS = 9200
const CAMERA_LOWER_RADIUS_LIMIT = 2200
const CAMERA_UPPER_RADIUS_LIMIT = 45000
const CAMERA_WHEEL_DELTA_PERCENTAGE = 0.015
const CAMERA_MIN_Z = 1
const CAMERA_MAX_Z = 200000
const LIGHT_INTENSITY = 1.1
const LIGHT_GROUND_COLOR = new Color3(0.1, 0.14, 0.2)
const CAMERA_MOVE_SPEED_RATIO = 0.45
const CAMERA_FAST_MULTIPLIER = 2.5
const CAMERA_MAX_FRAME_SECONDS = 0.05
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'])

interface CameraPose {
  alpha: number
  beta: number
  radius: number
  target: Vector3
}

interface BabylonSceneDeps {
  canvasRef: Ref<HTMLCanvasElement | null>
  hostRef: Ref<HTMLElement | null>
  getClearColor: () => Color4
  getActive?: () => boolean
  /** Called for POINTERPICK with the picked mesh's nodeId, or null on empty pick. */
  onPick: (nodeId: number | null) => void
  /** Called every render frame before scene.render() (tooltip sync, axes widget). */
  onFrame: () => void
  /** Called first during disposal so owned meshes/materials release before the scene. */
  cleanup?: () => void
}

/**
 * Owns the Babylon engine/scene/camera lifecycle: creation, render loop,
 * resize observation, pointer picking and disposal. The caller registers
 * mount/unmount by using this composable inside setup().
 */
export const useBabylonScene = ({
  canvasRef,
  hostRef,
  getClearColor,
  getActive,
  onPick,
  onFrame,
  cleanup,
}: BabylonSceneDeps) => {
  let engine: Engine | null = null
  let scene: Scene | null = null
  let camera: ArcRotateCamera | null = null
  let resizeObserver: ResizeObserver | null = null
  let pointerObserver: Observer<PointerInfo> | null = null
  let defaultCameraState: CameraPose | null = null
  const pressedKeys = new Set<string>()
  let lastFrameTime = 0

  const getEngine = () => engine
  const getScene = () => scene
  const getCamera = () => camera

  const translateCamera = (delta: Vector3) => {
    if (!camera) return
    // Preserve orbit angles and radius; keyboard/middle-button movement should
    // not replace the topology center saved for “reset view”.
    camera.setTarget(camera.getTarget().add(delta), false, false, true)
  }

  const moveFromKeyboard = (dt: number) => {
    if (!camera || !pressedKeys.size || dt <= 0) return
    const forward = camera.getTarget().subtract(camera.position)
    forward.y = 0
    if (forward.lengthSquared() < 1e-6) forward.set(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha))
    forward.normalize()
    const right = Vector3.Cross(Vector3.Up(), forward).normalize()
    const direction = forward.scale(Number(pressedKeys.has('KeyW')) - Number(pressedKeys.has('KeyS')))
      .add(right.scale(Number(pressedKeys.has('KeyD')) - Number(pressedKeys.has('KeyA'))))
      .add(Vector3.Up().scale(Number(pressedKeys.has('KeyE')) - Number(pressedKeys.has('KeyQ'))))
    if (direction.lengthSquared() === 0) return
    const fast = pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight')
    const distance = camera.radius * CAMERA_MOVE_SPEED_RATIO * (fast ? CAMERA_FAST_MULTIPLIER : 1) * dt
    translateCamera(direction.normalize().scale(distance))
  }

  const renderLoop = () => {
    if (!scene || !camera) return
    const now = performance.now()
    const dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, CAMERA_MAX_FRAME_SECONDS) : 0
    lastFrameTime = now
    moveFromKeyboard(dt)
    onFrame()
    scene.render()
  }

  /* 视图常驻（v-show）时隐藏期间停掉 renderLoop，避免不可见场景的 GPU/CPU
     空转；重新激活时恢复循环并补一次 resize（隐藏期间宿主尺寸可能变过） */
  const setActive = (active: boolean) => {
    if (!engine) return
    engine.stopRenderLoop()
    pressedKeys.clear()
    lastFrameTime = 0
    if (!active) return
    engine.runRenderLoop(renderLoop)
    engine.resize()
  }

  const setClearColor = (color: Color4) => {
    if (scene) scene.clearColor = color.clone()
  }

  /** Recenter the camera target and remember it as the default pose. */
  const focusCamera = (target: Vector3) => {
    if (!camera) return
    camera.setTarget(target)
    if (defaultCameraState) {
      defaultCameraState.target = target.clone()
    }
  }

  const resetCameraView = () => {
    if (!camera || !defaultCameraState) return
    camera.alpha = defaultCameraState.alpha
    camera.beta = defaultCameraState.beta
    camera.radius = defaultCameraState.radius
    camera.setTarget(defaultCameraState.target.clone())
  }

  const resize = () => {
    if (!engine) return
    engine.resize()
    onFrame()
  }

  const onCanvasPointerDown = () => canvasRef.value?.focus()
  const onCanvasKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (!MOVE_KEYS.has(event.code) && event.code !== 'ShiftLeft' && event.code !== 'ShiftRight') return
    if (MOVE_KEYS.has(event.code)) event.preventDefault()
    pressedKeys.add(event.code)
  }
  const onWindowKeyUp = (event: KeyboardEvent) => pressedKeys.delete(event.code)
  const clearKeys = () => pressedKeys.clear()

  const mount = () => {
    const canvas = canvasRef.value
    if (!canvas) return

    engine = new Engine(canvas, true, {
      /* preserveDrawingBuffer: true —— 岛屿面板的 backdrop-filter blur 扫过
         WebGL canvas 时，合成器需要采样帧纹理；false 时 swap 后内容失效，
         真机 GPU 下采样到空纹理表现为一帧黑/空闪（软渲染复现不了）。
         true 让合成器始终拿到有效帧，代价是每帧纹理拷贝而非交换，
         本场景 mesh 量级下可忽略 */
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    })
    scene = new Scene(engine)
    scene.clearColor = getClearColor().clone()

    camera = new ArcRotateCamera('camera', CAMERA_ALPHA, CAMERA_BETA, CAMERA_RADIUS, Vector3.Zero(), scene)
    camera.lowerRadiusLimit = CAMERA_LOWER_RADIUS_LIMIT
    camera.upperRadiusLimit = CAMERA_UPPER_RADIUS_LIMIT
    camera.wheelDeltaPercentage = CAMERA_WHEEL_DELTA_PERCENTAGE
    camera.panningSensibility = 0
    camera.minZ = CAMERA_MIN_Z
    camera.maxZ = CAMERA_MAX_Z
    camera.attachControl(canvas, true)
    canvas.addEventListener('pointerdown', onCanvasPointerDown)
    canvas.addEventListener('keydown', onCanvasKeyDown)
    canvas.addEventListener('blur', clearKeys)
    window.addEventListener('keyup', onWindowKeyUp)
    window.addEventListener('blur', clearKeys)
    const pointerInput = camera.inputs?.attached?.pointers as { buttons?: number[] } | undefined
    if (pointerInput) {
      pointerInput.buttons = [0]
    }
    defaultCameraState = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.getTarget().clone(),
    }

    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
    light.intensity = LIGHT_INTENSITY
    light.groundColor = LIGHT_GROUND_COLOR.clone()

    pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return
      const picked = pointerInfo.pickInfo?.pickedMesh
      const nodeId = picked?.metadata?.nodeId
      onPick(nodeId ?? null)
    })

    if (getActive?.() !== false) engine.runRenderLoop(renderLoop)

    resizeObserver = new ResizeObserver(() => {
      /* 常驻视图被 v-show 隐藏（display:none）时宿主尺寸归零：保持 backbuffer，
         不把 WebGL 画布缩到 0，重新显示时无缝恢复 */
      const host = hostRef.value
      if (host && (host.clientWidth < 2 || host.clientHeight < 2)) return
      resize()
    })
    if (hostRef.value) resizeObserver.observe(hostRef.value)
  }

  const dispose = () => {
    canvasRef.value?.removeEventListener('pointerdown', onCanvasPointerDown)
    canvasRef.value?.removeEventListener('keydown', onCanvasKeyDown)
    canvasRef.value?.removeEventListener('blur', clearKeys)
    window.removeEventListener('keyup', onWindowKeyUp)
    window.removeEventListener('blur', clearKeys)
    pressedKeys.clear()
    cleanup?.()
    if (scene && pointerObserver) scene.onPointerObservable.remove(pointerObserver)
    pointerObserver = null
    if (resizeObserver) resizeObserver.disconnect()
    resizeObserver = null
    if (scene) scene.dispose()
    scene = null
    camera = null
    defaultCameraState = null
    if (engine) engine.dispose()
    engine = null
  }

  onMounted(mount)
  onBeforeUnmount(dispose)

  return {
    getEngine,
    getScene,
    getCamera,
    setClearColor,
    setActive,
    focusCamera,
    translateCamera,
    resetCameraView,
    resize,
  }
}

export type BabylonScene = ReturnType<typeof useBabylonScene>
