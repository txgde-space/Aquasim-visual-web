import type { Projection } from '../coordinate'
import type { ThemeProfile } from '../themes'
import { colorMix, fillCircle, strokeCircle } from './primitives'
import { drawCarrierNode, drawSubmarineNode } from './nodes'
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

/** Extra pixels beyond the radius of the idle gradient around a node. */
const IDLE_GRADIENT_OUTER_EXTRA_PX = 6
/** Base extra pixels beyond the node radius for the ambient pulse ring. */
const PULSE_RING_BASE_EXTRA_PX = 4
/** Extra pixels added to the pulse ring radius by the pulse animation. */
const PULSE_RING_PULSE_EXTRA_PX = 3
/** Base extra pixels beyond the node radius for the fx-level outer ring. */
const FX_RING_BASE_EXTRA_PX = 10
/** Extra pixels added to the fx outer ring radius by the pulse animation. */
const FX_RING_PULSE_EXTRA_PX = 6
/** Base extra pixels beyond the node radius for the tx progress ring. */
const TX_RING_BASE_EXTRA_PX = 8
/** Extra pixels added to the tx ring radius by the pulse animation. */
const TX_RING_PULSE_EXTRA_PX = 5
/** Base extra pixels beyond the node radius for the rx progress ring. */
const RX_RING_BASE_EXTRA_PX = 7
/** Extra pixels added to the rx ring radius by the pulse animation. */
const RX_RING_PULSE_EXTRA_PX = 4
/** Base extra pixels beyond the node radius for the collision ring. */
const COLLISION_RING_BASE_EXTRA_PX = 10
/** Extra pixels added to the collision ring radius by the pulse animation. */
const COLLISION_RING_PULSE_EXTRA_PX = 4
/** Number of expanding collision wave rings at fx level above 1. */
const COLLISION_WAVE_COUNT = 3
/** Base extra pixels beyond the node radius for the first collision wave. */
const COLLISION_WAVE_BASE_EXTRA_PX = 13
/** Extra pixels between successive collision wave rings. */
const COLLISION_WAVE_STEP_EXTRA_PX = 7
/** Modulo applied to the phase offset so wave radii wrap within this span. */
const COLLISION_WAVE_PHASE_MODULO_PX = 10
/** Screen-space speed of the collision wave phase animation. */
const COLLISION_WAVE_PHASE_SPEED_PX = 42
/** Per-wave phase offset for the collision wave animation. */
const COLLISION_WAVE_PHASE_OFFSET_PX = 8
/** Vertical offset of the node id text at fx level above 1. */
const ID_TEXT_OFFSET_FX_PX = 20
/** Label offset beyond the node radius for the node name at fx level above 1. */
const LABEL_NAME_OFFSET_FX_EXTRA_PX = 14
/** Label offset beyond the node radius for the node name at standard fx. */
const LABEL_NAME_OFFSET_EXTRA_PX = 10
/** Vertical offset of the depth label below the node name. */
const LABEL_DEPTH_OFFSET_EXTRA_PX = 16
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

const ID_FONT_FX = '700 10px "IBM Plex Sans", "Segoe UI", sans-serif'
const ID_FONT_STANDARD = '600 11px "IBM Plex Sans", "Segoe UI", sans-serif'
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

/** Full node sprite: idle body, mode fill/rings, fx hull, id and labels. */
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
  const r = radius
  const idleGradient = ctx.createRadialGradient(p.x - 5, p.y - 6, 2, p.x, p.y, r + IDLE_GRADIENT_OUTER_EXTRA_PX)
  idleGradient.addColorStop(0, profile.idleInner)
  idleGradient.addColorStop(1, profile.idleOuter)

  const isSink = node.role === 'sink' || /sink/i.test(String(node.name || ''))
  fillCircle(ctx, p.x, p.y, r, idleGradient, 0.92)
  strokeCircle(ctx, p.x, p.y, r, profile.nodeStroke, 1.4, 0.9)

  const pulse = 0.5 + (Math.sin((phase * (4.2 + (fx * 0.8))) + (node.node_id * 0.6)) * 0.5)
  strokeCircle(ctx, p.x, p.y, r + PULSE_RING_BASE_EXTRA_PX + (pulse * PULSE_RING_PULSE_EXTRA_PX), profile.ring, selected ? SELECTED_OUTER_RING_LINE_WIDTH_PX : 1, 0.35 + (pulse * 0.3))
  if (fx > 1) {
    strokeCircle(ctx, p.x, p.y, r + FX_RING_BASE_EXTRA_PX + (pulse * FX_RING_PULSE_EXTRA_PX), profile.ring, 1.2, 0.3)
  }

  if (visual.mode === 'tx') {
    const progressRadius = 3 + ((r - 3) * visual.fillProgress)
    fillCircle(ctx, p.x, p.y, progressRadius, profile.tx, 0.98)
    strokeCircle(ctx, p.x, p.y, r + TX_RING_BASE_EXTRA_PX + (pulse * TX_RING_PULSE_EXTRA_PX), profile.tx, 1.2, 0.35)

    if (visual.overlay?.kind === 'collision_rx_tx') {
      fillCircle(ctx, p.x, p.y, r * 0.8, profile.bad, 0.78)
    }
  } else if (visual.mode === 'rx' || visual.mode === 'rx-done') {
    const progressRadius = visual.mode === 'rx-done'
      ? r
      : 3 + ((r - 3) * visual.fillProgress)
    fillCircle(ctx, p.x, p.y, progressRadius, profile.rx, visual.fade ?? 1)
    strokeCircle(ctx, p.x, p.y, r + RX_RING_BASE_EXTRA_PX + (pulse * RX_RING_PULSE_EXTRA_PX), profile.rx, 1, 0.28)
  } else if (visual.mode === 'collision' || visual.mode === 'collision-linger') {
    fillCircle(ctx, p.x, p.y, r, profile.bad, visual.fade ?? 1)
    strokeCircle(ctx, p.x, p.y, r + COLLISION_RING_BASE_EXTRA_PX + (pulse * COLLISION_RING_PULSE_EXTRA_PX), profile.bad, 1.6, 0.5)
    if (fx > 1) {
      for (let i = 0; i < COLLISION_WAVE_COUNT; i += 1) {
        const rr = r + COLLISION_WAVE_BASE_EXTRA_PX + (i * COLLISION_WAVE_STEP_EXTRA_PX)
          + (((phase * COLLISION_WAVE_PHASE_SPEED_PX) + (i * COLLISION_WAVE_PHASE_OFFSET_PX)) % COLLISION_WAVE_PHASE_MODULO_PX)
        strokeCircle(ctx, p.x, p.y, rr, profile.bad, 1.1, 0.22 - (i * 0.05))
      }
    }
  }

  if (fx > 1) {
    const baseColor = visual.mode === 'collision' || visual.mode === 'collision-linger'
      ? profile.bad
      : visual.mode === 'tx'
        ? profile.tx
        : visual.mode === 'rx' || visual.mode === 'rx-done'
          ? profile.rx
          : profile.idleInner
    const strokeColor = colorMix(baseColor, '#ffffff', 0.32)
    ctx.save()
    if (isSink) drawCarrierNode(ctx, p, baseColor, strokeColor, profile, phase)
    else drawSubmarineNode(ctx, p, baseColor, strokeColor, profile, pulse)
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = '#f8fafc'
  ctx.font = fx > 1 ? ID_FONT_FX : ID_FONT_STANDARD
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(node.node_id), p.x, p.y + (fx > 1 ? ID_TEXT_OFFSET_FX_PX : 0.5))
  ctx.restore()

  ctx.save()
  ctx.fillStyle = profile.label
  ctx.font = NAME_FONT
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  const labelOffset = fx > 1 ? r + LABEL_NAME_OFFSET_FX_EXTRA_PX : r + LABEL_NAME_OFFSET_EXTRA_PX
  ctx.fillText(String(node.name), p.x + labelOffset, p.y + 2)
  ctx.fillStyle = profile.depth
  ctx.font = DEPTH_FONT
  ctx.fillText(`z ${Number(node.z ?? 0).toFixed(2)}m`, p.x + labelOffset, p.y + LABEL_DEPTH_OFFSET_EXTRA_PX)
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
