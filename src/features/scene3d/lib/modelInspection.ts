import type { ArcRotateCamera, Vector3 } from '@babylonjs/core'

/** Set the target first: Babylon recalculates radius when the target changes. */
export const inspectModel = (camera: ArcRotateCamera, target: Vector3, spanMetres: number): void => {
  const radius = Math.max(3, spanMetres * 1.8)
  camera.inertialAlphaOffset = 0
  camera.inertialBetaOffset = 0
  camera.inertialRadiusOffset = 0
  camera.lowerRadiusLimit = Math.min(camera.lowerRadiusLimit ?? radius / 8, radius / 8)
  const alpha = camera.alpha, beta = camera.beta
  camera.setTarget(target)
  camera.alpha = alpha; camera.beta = beta
  camera.radius = Math.min(camera.upperRadiusLimit ?? Infinity, radius)
}

/** Follow a moving model while retaining the viewer's orbit, zoom and pan offset. */
export const followModelMovement = (camera: ArcRotateCamera, previous: Vector3, current: Vector3): void => {
  camera.setTarget(camera.getTarget().add(current.subtract(previous)), false, false, true)
}

/** Near inspection must retain the same distant ocean and fleet. */
export const syncInspectionDepth = (camera: ArcRotateCamera): void => {
  camera.minZ = Math.min(1, Math.max(.03, camera.radius / 80))
  camera.maxZ = 400000
}
