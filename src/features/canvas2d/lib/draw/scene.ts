import type { Projection } from '../coordinate'
import type { ThemeProfile } from '../themes'
import { fillCircle, roundedRectPath, strokeCircle } from './primitives'
import { drawNodeModel } from './nodes'
import { resolveNodeModel, type NodeModelType } from '@/shared/nodeModel'
import { motionAngles } from '@/shared/nodeMotion'
import type { Point3D } from '@/shared/types/replay'
import { nodeSpriteLayout } from '../nodeSpriteLayout'
import { drawWorldGrid } from './grid'
import { drawPacketRect } from './packets'
import { drawMeasurementLines } from './measure'

interface ScreenPoint {
  x: number
  y: number
}

export interface SceneNode {
  node_id: number
  x: number
  y: number
  z?: number
  role?: string
  name?: string
  modelType?: NodeModelType
  motionDirection?: Point3D
}

export interface SceneNodeVisual {
  mode: string
  fillProgress: number
  fade?: number
  overlay?: { kind?: string } | null
}

export interface OriginalPosition {
  node_id: number
  x: number
  y: number
}

export interface ScenePacket {
  packet_id: number | string
  src: number
  tx_start_us: number
  tx_duration_us: number
  receivers: ScenePacketReceiver[]
}

export interface ScenePacketReceiver {
  dst: number
  rx_start_us: number
  rx_end_us: number
  rx_duration_us: number
  status: string
  reason: string | null
  collision_start_us?: number
}

/** Radius of the circle marking an original (pre-drag) node position. */
const GHOST_CIRCLE_RADIUS_PX = 8
const GHOST_STROKE_STYLE = 'rgba(245, 158, 11, 0.78)'
const GHOST_FILL_STYLE = 'rgba(245, 158, 11, 0.12)'
/** Selected nodes thicken their existing outer ring rather than adding a ring. */
const SELECTED_OUTER_RING_LINE_WIDTH_PX = 3.5
const MARQUEE_FILL_STYLE = 'rgba(56, 189, 248, 0.12)'
const MARQUEE_STROKE_STYLE = 'rgba(125, 211, 252, 0.9)'
/** Left margin of the HUD text block. */
const HUD_MARGIN_X_PX = 18
/** Baseline y of the HUD time line. */
const HUD_TIME_BASELINE_Y_PX = 22
/** Baseline y of the HUD focus line. */
const HUD_FOCUS_BASELINE_Y_PX = 42

const ID_FONT = '600 11px "IBM Plex Mono", monospace'
const NAME_FONT = '12px "IBM Plex Sans", "Segoe UI", sans-serif'
const DEPTH_FONT = '10px "IBM Plex Sans", "Segoe UI", sans-serif'

/**
 * Match the canvas backing store to the CSS size times the device pixel ratio
 * and return a 2D context. Returns null when the canvas has no 2D context.
 */
export const syncCanvasContext = (
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
): CanvasRenderingContext2D | null => {
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const dpr = window.devicePixelRatio || 1
  if (
    canvas.width !== Math.floor(width * dpr)
    || canvas.height !== Math.floor(height * dpr)
  ) {
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  return ctx
}

/** Fill the viewport with the theme background gradient and world grid. */
export const paintSceneBackdrop = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  profile: ThemeProfile,
  projection: Projection,
): void => {
  const background = ctx.createRadialGradient(width * 0.2, height * 0.18, 0, width * 0.2, height * 0.18, Math.max(width, height))
  background.addColorStop(0, profile.bg[0])
  background.addColorStop(0.45, profile.bg[1])
  background.addColorStop(1, profile.bg[2])
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  drawWorldGrid(ctx, width, height, projection)
}

/** Draw every visible packet path between its source and receivers. */
export const drawVisiblePacketSet = (
  ctx: CanvasRenderingContext2D,
  packets: ScenePacket[],
  now: number,
  getNodeById: (nodeId: number) => SceneNode | undefined,
  toScreen: (x: number, y: number) => ScreenPoint,
  profile: ThemeProfile,
  phase: number,
  fx: number,
): void => {
  for (const packet of packets) {
    for (const receiver of packet.receivers) {
      if (now < packet.tx_start_us || now > receiver.rx_end_us) continue
      const srcNode = getNodeById(packet.src)
      const dstNode = getNodeById(receiver.dst)
      if (!srcNode || !dstNode) continue
      drawPacketRect(
        ctx,
        { src: toScreen(srcNode.x, srcNode.y), dst: toScreen(dstNode.x, dstNode.y) },
        packet,
        receiver,
        now,
        profile,
        phase,
        fx,
      )
    }
  }
}

/** Draw ghost markers at original positions and lines to current positions. */
export const drawEditGhosts = (
  ctx: CanvasRenderingContext2D,
  originals: OriginalPosition[],
  getCurrentNode: (nodeId: number) => SceneNode | undefined,
  toScreen: (x: number, y: number) => ScreenPoint,
): void => {
  ctx.save()
  ctx.lineCap = 'butt'
  ctx.setLineDash([11, 5])
  ctx.lineWidth = 1.7
  ctx.strokeStyle = GHOST_STROKE_STYLE
  for (const original of originals) {
    const current = getCurrentNode(original.node_id)
    const from = toScreen(original.x, original.y)
    ctx.beginPath()
    ctx.arc(from.x, from.y, GHOST_CIRCLE_RADIUS_PX, 0, Math.PI * 2)
    ctx.fillStyle = GHOST_FILL_STYLE
    ctx.fill()
    ctx.stroke()
    if (!current) continue
    const to = toScreen(current.x, current.y)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }
  ctx.restore()
}

/** Model and status share the same projected anchor; model type never changes coordinates. */
export const drawNodeBody = (
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  visual: SceneNodeVisual,
  profile: ThemeProfile,
  phase: number,
  fx: number,
  radius: number,
  p: ScreenPoint,
  selected = false,
): void => {
  const layout = nodeSpriteLayout(radius, node.node_id)
  const collision = visual.mode === 'collision' || visual.mode === 'collision-linger'
    || (visual.mode === 'tx' && visual.overlay?.kind === 'collision_rx_tx')
  const receiving = visual.mode === 'rx' || visual.mode === 'rx-done'
  const statusColor = collision ? profile.bad : visual.mode === 'tx' ? profile.tx : receiving ? profile.rx : null
  const fade = Math.max(0, Math.min(1, visual.fade ?? 1))
  const progress = Math.max(0, Math.min(1, visual.fillProgress))
  const pulse = 0.5 + Math.sin(phase * 5 + node.node_id * 0.6) * 0.5

  ctx.save()
  // Keep a single existing outline for selection; status arcs sit outside it.
  strokeCircle(ctx, p.x, p.y, layout.ringRadius, profile.nodeStroke,
    selected ? SELECTED_OUTER_RING_LINE_WIDTH_PX : 1, selected ? 1 : 0.42)
  if (statusColor) {
    fillCircle(ctx, p.x, p.y, layout.ringRadius - 1, statusColor, 0.1 * fade)
    const ringRadius = layout.ringRadius + 4
    strokeCircle(ctx, p.x, p.y, ringRadius, statusColor, 1, 0.18 * fade)
    ctx.strokeStyle = statusColor
    ctx.lineWidth = collision ? 2.5 : 2
    ctx.globalAlpha = fade
    ctx.beginPath()
    const amount = collision || visual.mode === 'rx-done' ? 1 : progress
    ctx.arc(p.x, p.y, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * amount)
    ctx.stroke()
    ctx.globalAlpha = 1
    if (fx > 1) strokeCircle(ctx, p.x, p.y, ringRadius + 3 + pulse * 4, statusColor, 1, 0.22 * fade)
  }

  ctx.lineWidth = 1.2
  const kind = resolveNodeModel(node)
  const motion = motionAngles(node.motionDirection)
  // A network diagram uses readable device symbols at every map scale.
  const modelAt = (point: ScreenPoint) => drawNodeModel(ctx, kind, point, radius, profile, profile.idleInner, profile.label)
  // Rotate equipment only. Labels, the ID plate, hit circle and state arc stay upright.
  if (motion && (kind === 'auv' || kind === 'vessel' || kind === 'rov')) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(-motion.heading)
    modelAt({ x: 0, y: 0 })
    ctx.restore()
  } else {
    modelAt(p)
  }

  // A separate ID plate stays legible for the full 1–65534 ID range at small node sizes.
  const idY = p.y + layout.idY
  roundedRectPath(ctx, p.x - layout.idWidth / 2, idY - layout.idHeight / 2,
    layout.idWidth, layout.idHeight, 4)
  ctx.fillStyle = profile.bg[2]
  ctx.fill()
  ctx.fillStyle = profile.label
  ctx.font = ID_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(node.node_id), p.x, idY)

  ctx.fillStyle = profile.label
  ctx.font = NAME_FONT
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(String(node.name ?? ''), p.x + layout.labelX, p.y + 2)
  ctx.fillStyle = profile.depth
  ctx.font = DEPTH_FONT
  ctx.fillText(`z ${Number(node.z ?? 0).toFixed(2)}m`, p.x + layout.labelX, p.y + 18)
  ctx.restore()
}

/** Box-select marquee rectangle. */
export const drawMarqueeBox = (
  ctx: CanvasRenderingContext2D,
  box: { x0: number; y0: number; x1: number; y1: number },
): void => {
  const x = Math.min(box.x0, box.x1)
  const y = Math.min(box.y0, box.y1)
  const wBox = Math.abs(box.x1 - box.x0)
  const hBox = Math.abs(box.y1 - box.y0)
  ctx.save()
  ctx.fillStyle = MARQUEE_FILL_STYLE
  ctx.strokeStyle = MARQUEE_STROKE_STYLE
  ctx.lineWidth = 1.2
  ctx.setLineDash([5, 4])
  ctx.fillRect(x, y, wBox, hBox)
  ctx.strokeRect(x, y, wBox, hBox)
  ctx.restore()
}

/** HUD text: current replay time and single-packet focus indicator. */
export const drawHudText = (
  ctx: CanvasRenderingContext2D,
  profile: ThemeProfile,
  currentTimeUs: number,
  packets: Array<Pick<ScenePacket, 'packet_id'>>,
): void => {
  ctx.save()
  ctx.fillStyle = profile.label
  ctx.font = NAME_FONT
  ctx.fillText(`time: ${(currentTimeUs / 1000).toFixed(1)} ms`, HUD_MARGIN_X_PX, HUD_TIME_BASELINE_Y_PX)
  if (packets.length === 1) {
    ctx.fillStyle = profile.idleInner
    ctx.fillText(`focus: ${packets[0].packet_id}`, HUD_MARGIN_X_PX, HUD_FOCUS_BASELINE_Y_PX)
  }
  ctx.restore()
}

export interface MeasureOverlayPoint {
  x: number
  y: number
  z?: number
  nodeId?: number | null
}

interface MeasureOverlayOptions {
  /** Snap a stored point to its referenced node when it still exists. */
  resolvePoint: (point: MeasureOverlayPoint) => { x: number; y: number; z: number }
  distanceOf: (a: MeasureOverlayPoint, b: MeasureOverlayPoint) => number
  toScreen: (x: number, y: number) => ScreenPoint
  selectedId: string | null
  pendingPoint: MeasureOverlayPoint | null
  /** Whether the measure tool is active (controls the pending point preview). */
  showPending: boolean
  width: number
  height: number
}

/** Project measurement lines to screen space and paint the overlay. */
export const paintMeasurementOverlay = (
  ctx: CanvasRenderingContext2D,
  items: Array<{ id: string; start: MeasureOverlayPoint; end: MeasureOverlayPoint }>,
  options: MeasureOverlayOptions,
): void => {
  const lines = items.map((item) => {
    const start = options.resolvePoint(item.start)
    const end = options.resolvePoint(item.end)
    return {
      id: item.id,
      start: options.toScreen(start.x, start.y),
      end: options.toScreen(end.x, end.y),
      distanceText: `${options.distanceOf(item.start, item.end).toFixed(0)} m`,
      isSelected: options.selectedId === item.id,
    }
  })
  let pendingPoint = null
  if (options.showPending && options.pendingPoint) {
    const pending = options.resolvePoint(options.pendingPoint)
    pendingPoint = options.toScreen(pending.x, pending.y)
  }
  drawMeasurementLines(ctx, lines, pendingPoint, options.width, options.height)
}
