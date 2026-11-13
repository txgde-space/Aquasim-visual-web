import { onMounted, onBeforeUnmount, ref, type Ref } from 'vue'
import { createSceneNavigation, type SceneNavigation } from './sceneNavigation'
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
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
const CAMERA_LOWER_RADIUS_LIMIT = 0.2
const CAMERA_UPPER_RADIUS_LIMIT = 100000
const CAMERA_WHEEL_DELTA_PERCENTAGE = 0.015
const CAMERA_MIN_Z = 1
const CAMERA_MAX_Z = 400000
const LIGHT_INTENSITY = 0.55
const KEY_LIGHT_INTENSITY = 1.25
const RIM_LIGHT_INTENSITY = 0.35
const LIGHT_GROUND_COLOR = new Color3(0.1, 0.14, 0.2)
const CAMERA_MAX_FRAME_SECONDS = 0.05

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
  /** Called for POINTERTAP with the picked mesh's nodeId, or null on empty pick. */
  onPick: (nodeId: number | null, sceneAssetId?: string) => void
  /** Called before scene.render() to flush pending mesh data and sync overlays. */
  onFrame: () => void
  /** Report initialization/render failures to the scene's loading boundary. */
  onError?: (error: unknown) => void
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
  onError,
  cleanup,
}: BabylonSceneDeps) => {
  let engine: Engine | null = null
  let scene: Scene | null = null
  let camera: ArcRotateCamera | null = null
  let resizeObserver: ResizeObserver | null = null
  let pointerObserver: Observer<PointerInfo> | null = null
  let defaultCameraState: CameraPose | null = null
  let navigation: SceneNavigation | null = null
  const navigationMode = ref<'orbit' | 'roam'>('orbit')
  const pointerLocked = ref(false)
  const fullscreen = ref(false)
  const navigationError = ref('')
  let lastFrameTime = 0
  let failed = false

  const getEngine = () => engine
  const getScene = () => scene
  const getCamera = () => camera

  const translateCamera = (delta: Vector3) => {
    if (!camera) return
    // Preserve orbit angles and radius; keyboard/middle-button movement should
    // not replace the topology center saved for “reset view”.
    camera.setTarget(camera.getTarget().add(delta), false, false, true)
  }

  const renderLoop = () => {
    if (!scene || !camera || getActive?.() === false) return
    try {
      const now = performance.now()
      const dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, CAMERA_MAX_FRAME_SECONDS) : 0
      lastFrameTime = now
      navigation?.moveFromKeyboard(dt)
      onFrame()
      scene.render()
    } catch (error) {
      reportFailure(error)
    }
  }

  /* 视图常驻（v-show）时隐藏期间停掉 renderLoop，避免不可见场景的 GPU/CPU
     空转；重新激活时恢复循环并补一次 resize（隐藏期间宿主尺寸可能变过） */
  const setActive = (active: boolean) => {
    if (!engine) return
    engine.stopRenderLoop()
    navigation?.suspend()
    lastFrameTime = 0
    if (!active) return
    engine.runRenderLoop(renderLoop)
    engine.resize()
  }

  const setClearColor = (color: Color4) => {
    if (scene) scene.clearColor = color.clone()
  }

  /** Recenter the camera target and remember it as the default pose. */
  const focusCamera = (target: Vector3, radius?: number) => {
    if (!camera) return
    const alpha = camera.alpha, beta = camera.beta
    camera.setTarget(target)
    camera.alpha = alpha; camera.beta = beta
    if (radius !== undefined) camera.radius = Math.max(CAMERA_LOWER_RADIUS_LIMIT, Math.min(CAMERA_UPPER_RADIUS_LIMIT, radius))
    if (defaultCameraState) {
      defaultCameraState.target = target.clone()
      defaultCameraState.radius = camera.radius
    }
  }

  const resetCameraView = () => {
    if (!camera || !defaultCameraState) return
    camera.lowerRadiusLimit = CAMERA_LOWER_RADIUS_LIMIT
    camera.minZ = CAMERA_MIN_Z
    camera.setTarget(defaultCameraState.target.clone())
    camera.alpha = defaultCameraState.alpha
    camera.beta = defaultCameraState.beta
    camera.radius = defaultCameraState.radius
  }

  const resize = () => {
    if (!engine) return
    try {
      engine.resize()
      onFrame()
    } catch (error) {
      reportFailure(error)
    }
  }

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
    // Retain metre-sized equipment and the 10 km seabed in the same view.
    engine.useReverseDepthBuffer = true
    scene = new Scene(engine)
    scene.clearColor = getClearColor().clone()

    camera = new ArcRotateCamera('camera', CAMERA_ALPHA, CAMERA_BETA, CAMERA_RADIUS, Vector3.Zero(), scene)
    camera.lowerRadiusLimit = CAMERA_LOWER_RADIUS_LIMIT
    camera.upperRadiusLimit = CAMERA_UPPER_RADIUS_LIMIT
    camera.wheelDeltaPercentage = CAMERA_WHEEL_DELTA_PERCENTAGE
    camera.panningSensibility = 0
    camera.minZ = CAMERA_MIN_Z
    camera.maxZ = CAMERA_MAX_Z
    camera.attachControl(canvas, false)
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

    // Direct highlights reveal the PBR hull curvature and material roughness.
    // Keep ambient fill for dark faces; these three lights need no shadow maps,
    // environment downloads or post-processing and are owned by the scene.
    const keyLight = new DirectionalLight('model-key-light', new Vector3(-0.45, -1, 0.35).normalize(), scene)
    keyLight.intensity = KEY_LIGHT_INTENSITY
    const rimLight = new DirectionalLight('model-rim-light', new Vector3(0.7, -0.35, -0.6).normalize(), scene)
    rimLight.intensity = RIM_LIGHT_INTENSITY

    navigation = createSceneNavigation({
      canvas, host: hostRef.value, getCamera, getActive, onResize: resize,
      onStateChange: (state) => {
        navigationMode.value = state.mode; pointerLocked.value = state.pointerLocked
        fullscreen.value = state.fullscreen; navigationError.value = state.error
      },
    })

    pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
      if (getActive?.() === false || pointerInfo.type !== PointerEventTypes.POINTERTAP || pointerInfo.event.button !== 0) return
      const picked = pointerInfo.pickInfo?.pickedMesh
      const nodeId = picked?.metadata?.nodeId
      onPick(nodeId ?? null, picked?.metadata?.sceneAssetId)
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
    engine?.stopRenderLoop()
    navigation?.dispose()
    navigation = null
    if (scene && pointerObserver) scene.onPointerObservable.remove(pointerObserver)
    pointerObserver = null
    if (resizeObserver) resizeObserver.disconnect()
    resizeObserver = null
    const oldScene = scene
    const oldEngine = engine
    scene = null
    camera = null
    defaultCameraState = null
    engine = null
    // Release partial initialization too, and still dispose the engine if an
    // owned mesh or scene throws during cleanup.
    try {
      cleanup?.()
    } finally {
      try {
        oldScene?.dispose()
      } finally {
        oldEngine?.dispose()
      }
    }
  }

  const reportFailure = (error: unknown) => {
    if (failed) return
    failed = true
    let failure = error
    try {
      dispose()
    } catch (cleanupError) {
      failure = new AggregateError([error, cleanupError], error instanceof Error ? error.message : '3D 场景初始化失败')
    }
    if (onError) onError(failure)
    else throw failure
  }

  onMounted(() => {
    try {
      mount()
    } catch (error) {
      reportFailure(error)
    }
  })
  onBeforeUnmount(dispose)

  return {
    navigationMode, pointerLocked, fullscreen, navigationError,
    requestRoaming: () => navigation?.requestRoaming(),
    exitRoaming: () => navigation?.exitRoaming(),
    toggleFullscreen: () => navigation?.toggleFullscreen(),
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
