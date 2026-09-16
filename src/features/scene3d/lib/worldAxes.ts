import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type ArcRotateCamera,
  type LinesMesh,
  type Mesh,
  type Scene,
} from '@babylonjs/core'
import { makeMaterial } from './factories'
import {
  AXIS_X_COLOR,
  AXIS_Y_COLOR,
  AXIS_Z_COLOR,
  DEPTH_SCALE,
} from './themes3d'

export interface WorldAxisLabelEntry {
  plane: Mesh
  texture: DynamicTexture
  material: StandardMaterial
}

export interface WorldAxisEntry {
  line: LinesMesh
  tip: Mesh
  ticks: LinesMesh[]
  labels: WorldAxisLabelEntry[]
}

const AXIS_TICK_COUNT = 5
/** Minimum axis padding in world units. */
const AXIS_MIN_PADDING = 220
/** Axis padding as a fraction of the node span. */
const AXIS_PADDING_FRACTION = 0.08
/** Minimum half-length of an axis tick mark. */
const AXIS_TICK_MIN_LEN = 36
/** Tick length as a fraction of the axis length. */
const AXIS_TICK_LEN_FRACTION = 0.012
const AXIS_LINE_ALPHA = 0.24
const AXIS_TICK_ALPHA = 0.18
const AXIS_TIP_DIAMETER = 34
const AXIS_LABEL_WIDTH = 190
const AXIS_LABEL_HEIGHT = 72
const AXIS_LABEL_TEXTURE_WIDTH = 256
const AXIS_LABEL_TEXTURE_HEIGHT = 96
const AXIS_LABEL_ALPHA = 0.48
const AXIS_LABEL_FONT = '600 42px "IBM Plex Sans", sans-serif'
const AXIS_LABEL_OFFSET_FACTOR = 2.35

/**
 * Build or update the world axis lines, tips, ticks and DynamicTexture labels
 * for the current node set.
 *
 * NOTE: preserved as-is from the pre-refactor component, where this function
 * was defined but never wired into the refresh path (worldAxesMap therefore
 * stays empty). Decide separately whether to wire it into refreshScene or
 * delete it.
 */
export const syncWorldAxes = (
  scene: Scene,
  nodes: Array<{ x: number; y: number; z?: number }>,
  worldAxesMap: Map<string, WorldAxisEntry>,
): void => {
  if (!nodes.length) return

  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const zs = nodes.map((node) => -(node.z ?? 0) * DEPTH_SCALE)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...zs)
  const maxY = Math.max(...zs)
  const minZ = Math.min(...ys)
  const maxZ = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1)
  const padding = Math.max(AXIS_MIN_PADDING, span * AXIS_PADDING_FRACTION)
  const axisLen = Math.max(maxX - minX, maxY - minY, maxZ - minZ) + (padding * 2)
  const origin = new Vector3(
    minX - padding,
    minY - padding,
    minZ - padding,
  )

  const specs = [
    {
      key: 'x',
      color: AXIS_X_COLOR,
      end: new Vector3(origin.x + axisLen, origin.y, origin.z),
      unit: new Vector3(1, 0, 0),
    },
    {
      key: 'y',
      color: AXIS_Y_COLOR,
      end: new Vector3(origin.x, origin.y + axisLen, origin.z),
      unit: new Vector3(0, 1, 0),
    },
    {
      key: 'z',
      color: AXIS_Z_COLOR,
      end: new Vector3(origin.x, origin.y, origin.z + axisLen),
      unit: new Vector3(0, 0, 1),
    },
  ]
  const tickSpacing = axisLen / AXIS_TICK_COUNT
  const tickLen = Math.max(AXIS_TICK_MIN_LEN, axisLen * AXIS_TICK_LEN_FRACTION)
  const tickOffsets: Record<string, Vector3> = {
    x: new Vector3(0, tickLen, 0),
    y: new Vector3(tickLen, 0, 0),
    z: new Vector3(0, tickLen, 0),
  }

  for (const spec of specs) {
    let entry = worldAxesMap.get(spec.key)
    if (!entry) {
      const line = MeshBuilder.CreateLines(`world-axis-${spec.key}`, {
        points: [origin, spec.end],
        updatable: true,
      }, scene)
      line.color = spec.color
      line.alpha = AXIS_LINE_ALPHA

      const tip = MeshBuilder.CreateSphere(`world-axis-${spec.key}-tip`, {
        diameter: AXIS_TIP_DIAMETER,
        segments: 10,
      }, scene)
      tip.material = makeMaterial(scene, `world-axis-${spec.key}-tip-mat`, spec.color, spec.color.scale(0.08), 0.28)

      const ticks = Array.from({ length: AXIS_TICK_COUNT - 1 }, (_, index) => {
        const tick = MeshBuilder.CreateLines(`world-axis-${spec.key}-tick-${index}`, {
          points: [origin, origin],
          updatable: true,
        }, scene)
        tick.color = spec.color
        tick.alpha = AXIS_TICK_ALPHA
        return tick
      })

      const labels = Array.from({ length: AXIS_TICK_COUNT - 1 }, (_, index) => {
        const plane = MeshBuilder.CreatePlane(`world-axis-${spec.key}-label-${index}`, {
          width: AXIS_LABEL_WIDTH,
          height: AXIS_LABEL_HEIGHT,
        }, scene)
        plane.billboardMode = 7
        const texture = new DynamicTexture(`world-axis-${spec.key}-label-tex-${index}`, { width: AXIS_LABEL_TEXTURE_WIDTH, height: AXIS_LABEL_TEXTURE_HEIGHT }, scene, true)
        const material = new StandardMaterial(`world-axis-${spec.key}-label-mat-${index}`, scene)
        material.diffuseTexture = texture
        material.emissiveTexture = texture
        material.opacityTexture = texture
        material.specularColor = Color3.Black()
        material.backFaceCulling = false
        material.alpha = 0.52
        plane.material = material
        return { plane, texture, material }
      })

      entry = { line, tip, ticks, labels }
      worldAxesMap.set(spec.key, entry)
    }

    MeshBuilder.CreateLines('', {
      points: [origin, spec.end],
      instance: entry.line,
    })
    entry.line.setEnabled(true)
    entry.tip.position.copyFrom(spec.end)
    entry.tip.setEnabled(true)

    const tickOffset = tickOffsets[spec.key]
    entry.ticks.forEach((tick, index) => {
      const tickCenter = origin.add(spec.unit.scale(tickSpacing * (index + 1)))
      MeshBuilder.CreateLines('', {
        points: [tickCenter.subtract(tickOffset), tickCenter.add(tickOffset)],
        instance: tick,
      })
      tick.setEnabled(true)
    })

    entry.labels.forEach((labelEntry, index) => {
      const tickCenter = origin.add(spec.unit.scale(tickSpacing * (index + 1)))
      const labelOffset = tickOffset.scale(AXIS_LABEL_OFFSET_FACTOR)
      labelEntry.plane.position.copyFrom(tickCenter.add(labelOffset))
      labelEntry.plane.setEnabled(true)
      labelEntry.material.alpha = AXIS_LABEL_ALPHA
      labelEntry.texture.clear()
      labelEntry.texture.drawText(
        `${Math.round(tickSpacing * (index + 1))}`,
        null,
        62,
        AXIS_LABEL_FONT,
        spec.key === 'x' ? '#fca5a5' : spec.key === 'y' ? '#86efac' : '#93c5fd',
        'transparent',
        true,
        true,
      )
    })
  }
}

/** Dispose one axis entry: line, tip, ticks, label planes, textures, materials. */
export const disposeWorldAxisEntry = (entry: WorldAxisEntry): void => {
  entry.line.dispose()
  const tipMaterial = entry.tip.material as StandardMaterial | null
  if (tipMaterial) tipMaterial.dispose()
  entry.tip.dispose()
  for (const tick of entry.ticks) tick.dispose()
  for (const label of entry.labels) {
    label.texture.dispose()
    label.material.dispose()
    label.plane.dispose()
  }
}

const AXES_WIDGET_BG = 'rgba(8, 15, 28, 0.78)'
const AXES_WIDGET_RADIUS = 16
/** Half-length of a projected axis line in widget pixels. */
const AXES_WIDGET_AXIS_SCALE_PX = 22
const AXES_WIDGET_LINE_WIDTH_PX = 2
const AXES_WIDGET_DOT_RADIUS_PX = 3.4
const AXES_WIDGET_LABEL_FONT = '600 11px "IBM Plex Sans", sans-serif'
const AXES_WIDGET_LABEL_OFFSET_PX = 5
const AXES_WIDGET_LABEL_BASELINE_PX = 4

/** Paint the small 2D axis-orientation widget overlay. */
export const drawAxesWidget = (canvas: HTMLCanvasElement, camera: ArcRotateCamera): void => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = AXES_WIDGET_BG
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, AXES_WIDGET_RADIUS)
  ctx.fill()

  const center = { x: w / 2, y: h / 2 }
  const view = camera.getViewMatrix()
  const projectAxis = (axis: Vector3) => {
    const transformed = Vector3.TransformNormal(axis, view).normalize()
    return {
      x: transformed.x,
      y: transformed.y,
      z: transformed.z,
    }
  }
  const axes = [
    { label: 'X', color: '#f87171', vec: projectAxis(new Vector3(1, 0, 0)) },
    { label: 'Y', color: '#4ade80', vec: projectAxis(new Vector3(0, 1, 0)) },
    { label: 'Z', color: '#60a5fa', vec: projectAxis(new Vector3(0, 0, 1)) },
  ]

  for (const axis of axes) {
    const endX = center.x + (axis.vec.x * AXES_WIDGET_AXIS_SCALE_PX)
    const endY = center.y - (axis.vec.y * AXES_WIDGET_AXIS_SCALE_PX)
    ctx.strokeStyle = axis.color
    ctx.lineWidth = AXES_WIDGET_LINE_WIDTH_PX
    ctx.beginPath()
    ctx.moveTo(center.x, center.y)
    ctx.lineTo(endX, endY)
    ctx.stroke()
    ctx.fillStyle = axis.color
    ctx.beginPath()
    ctx.arc(endX, endY, AXES_WIDGET_DOT_RADIUS_PX, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = AXES_WIDGET_LABEL_FONT
    ctx.fillText(axis.label, endX + AXES_WIDGET_LABEL_OFFSET_PX, endY + AXES_WIDGET_LABEL_BASELINE_PX)
  }
}
