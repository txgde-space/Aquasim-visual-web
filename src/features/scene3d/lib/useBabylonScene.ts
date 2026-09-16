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

  const getEngine = () => engine
  const getScene = () => scene
  const getCamera = () => camera

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

  const mount = () => {
    const canvas = canvasRef.value
    if (!canvas) return

    engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
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

    engine.runRenderLoop(() => {
      if (!scene || !camera) return
      onFrame()
      scene.render()
    })

    resizeObserver = new ResizeObserver(() => resize())
    if (hostRef.value) resizeObserver.observe(hostRef.value)
  }

  const dispose = () => {
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
    focusCamera,
    resetCameraView,
    resize,
  }
}

export type BabylonScene = ReturnType<typeof useBabylonScene>
