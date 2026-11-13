import { NODE_MODEL_DIMENSIONS, type NodeModelType } from '@/shared/nodeModel'
import type { ThemeProfile } from '../themes'
import { roundedRectPath } from './primitives'
import { nodeModelMaterials, type NodeModelMaterials } from './nodeModelMaterials'

interface ScreenPoint { x: number; y: number }
type Paint = string | CanvasGradient

const polygon = (ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[]): void => {
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath()
}
const finish = (ctx: CanvasRenderingContext2D, fill: Paint, edge: string, width = 0.035): void => {
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = edge
  ctx.lineWidth = width
  ctx.stroke()
}
const box = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: Paint, edge: string, radius = 0.04): void => {
  roundedRectPath(ctx, x, y, w, h, radius)
  finish(ctx, fill, edge)
}
const ellipse = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: Paint, edge: string): void => {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  finish(ctx, fill, edge)
}
const line = (ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], color: string, width = 0.035): void => {
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}
const light = (ctx: CanvasRenderingContext2D, x: number, y: number, m: NodeModelMaterials): void => {
  ellipse(ctx, x, y, 0.045, 0.045, m.indicator, m.palette.graphiteDark)
}

const drawAuv = (ctx: CanvasRenderingContext2D, m: NodeModelMaterials): void => {
  const c = m.palette
  // Small tail surfaces and shrouded propulsor behind the pressure hull.
  for (const sign of [-1, 1]) {
    polygon(ctx, [[-0.72, sign * 0.18], [-1.03, sign * 0.65], [-1.3, sign * 0.65], [-1.13, sign * 0.11]])
    finish(ctx, m.graphite, c.edge)
    line(ctx, [[-1.02, sign * 0.29], [-1.17, sign * 0.57]], c.metal, 0.025)
  }
  box(ctx, -1.41, -0.12, 0.3, 0.24, m.metal, c.edge)
  ellipse(ctx, -1.4, 0, 0.075, 0.23, m.graphite, c.edge)
  line(ctx, [[-1.42, -0.14], [-1.37, 0.14]], c.metalLight, 0.025)
  ctx.beginPath()
  ctx.moveTo(-1.2, -0.15)
  ctx.quadraticCurveTo(-0.83, -0.35, 0.76, -0.32)
  ctx.bezierCurveTo(1.1, -0.32, 1.38, -0.29, 1.38, 0)
  ctx.bezierCurveTo(1.38, 0.29, 1.1, 0.32, 0.76, 0.32)
  ctx.quadraticCurveTo(-0.83, 0.35, -1.2, 0.15)
  ctx.closePath()
  finish(ctx, m.yellow, c.edge, 0.045)
  // Dark sonar nose and instrument bands give the long hull a physical scale.
  ctx.beginPath()
  ctx.moveTo(0.94, -0.29)
  ctx.bezierCurveTo(1.17, -0.29, 1.38, -0.25, 1.38, 0)
  ctx.bezierCurveTo(1.38, 0.25, 1.17, 0.29, 0.94, 0.29)
  ctx.quadraticCurveTo(1.04, 0, 0.94, -0.29)
  finish(ctx, m.graphite, c.edge)
  box(ctx, -0.87, -0.265, 0.18, 0.53, m.graphite, c.edge, 0.025)
  line(ctx, [[0.55, -0.315], [0.55, 0.315]], c.yellowDark, 0.03)
  line(ctx, [[-0.61, -0.17], [0.78, -0.16]], c.yellowLight, 0.035)
  box(ctx, -0.08, -0.17, 0.34, 0.13, m.metal, c.metalDark, 0.025)
  box(ctx, -0.26, 0.1, 0.55, 0.065, c.graphite, c.edge, 0.015)
  light(ctx, 0.4, -0.1, m)
}

const drawRov = (ctx: CanvasRenderingContext2D, m: NodeModelMaterials): void => {
  const c = m.palette
  // Open steel chassis; flotation blocks remain separate from its machinery.
  box(ctx, -0.97, -0.59, 1.82, 1.18, c.shadow, c.metalDark, 0.1)
  for (const y of [-0.57, 0.57]) {
    line(ctx, [[-0.94, y], [0.83, y]], c.metalDark, 0.115)
    line(ctx, [[-0.94, y - 0.025], [0.83, y - 0.025]], c.metalLight, 0.035)
  }
  for (const x of [-0.81, 0.64]) line(ctx, [[x, -0.6], [x, 0.6]], c.metal, 0.09)
  for (const y of [-0.72, 0.72]) {
    for (const x of [-0.63, 0.42]) {
      box(ctx, x - 0.24, y - 0.17, 0.48, 0.34, m.graphite, c.edge, 0.09)
      ellipse(ctx, x + 0.17, y, 0.055, 0.125, c.graphiteDark, c.metalDark)
      line(ctx, [[x - 0.18, y - 0.085], [x + 0.13, y - 0.085]], c.graphiteLight, 0.025)
    }
  }
  box(ctx, -0.68, -0.3, 1.03, 0.6, m.metal, c.edge, 0.16)
  box(ctx, -0.18, -0.21, 0.45, 0.42, m.graphite, c.edge)
  for (const y of [-0.5, 0.28]) {
    box(ctx, -0.8, y, 1.32, 0.22, m.yellow, c.yellowDark, 0.065)
    line(ctx, [[-0.6, y + 0.03], [0.31, y + 0.03]], c.yellowLight, 0.035)
    for (const x of [-0.55, 0.29]) box(ctx, x, y, 0.065, 0.22, c.graphite, c.edge, 0.01)
  }
  // Forward camera and articulated manipulator.
  box(ctx, 0.5, -0.15, 0.36, 0.3, m.graphite, c.edge, 0.06)
  ellipse(ctx, 0.79, 0, 0.07, 0.105, c.glassLight, c.graphiteDark)
  line(ctx, [[0.6, 0.35], [0.98, 0.61], [1.25, 0.38]], c.edge, 0.13)
  line(ctx, [[0.6, 0.33], [0.98, 0.58], [1.25, 0.36]], c.metal, 0.075)
  ellipse(ctx, 0.98, 0.58, 0.075, 0.075, m.metal, c.edge)
  line(ctx, [[1.25, 0.36], [1.39, 0.19], [1.49, 0.22]], c.metalLight, 0.045)
  line(ctx, [[1.25, 0.36], [1.43, 0.4], [1.49, 0.33]], c.metal, 0.045)
  light(ctx, 0.37, -0.17, m)
}

const vesselHull = (ctx: CanvasRenderingContext2D): void => {
  ctx.beginPath()
  ctx.moveTo(-1.27, -0.45)
  ctx.lineTo(0.3, -0.5)
  ctx.quadraticCurveTo(0.98, -0.4, 1.48, 0)
  ctx.quadraticCurveTo(0.98, 0.4, 0.3, 0.5)
  ctx.lineTo(-1.27, 0.45)
  ctx.closePath()
}
const drawVessel = (ctx: CanvasRenderingContext2D, m: NodeModelMaterials): void => {
  const c = m.palette
  vesselHull(ctx)
  finish(ctx, m.white, c.graphiteDark, 0.055)
  polygon(ctx, [[-1.17, -0.36], [0.27, -0.4], [0.79, -0.25], [1.22, 0], [0.79, 0.25], [0.27, 0.4], [-1.17, 0.36]])
  finish(ctx, c.deck, c.metalDark, 0.025)
  // Working aft deck, inset hatch and wheelhouse towards the bow.
  box(ctx, -0.99, -0.27, 0.55, 0.54, m.metal, c.metalDark, 0.025)
  for (const x of [-0.88, -0.72, -0.56]) line(ctx, [[x, -0.21], [x, 0.21]], c.metalDark, 0.02)
  box(ctx, -0.32, -0.33, 0.87, 0.66, c.shadow, c.metalDark, 0.075)
  box(ctx, -0.39, -0.36, 0.88, 0.64, m.white, c.metalDark, 0.06)
  polygon(ctx, [[0.3, -0.29], [0.44, -0.23], [0.44, 0.18], [0.3, 0.23]])
  finish(ctx, c.glass, c.graphite, 0.025)
  for (const y of [-0.3, 0.2]) box(ctx, -0.24, y, 0.4, 0.055, c.glass, c.graphite, 0.012)
  box(ctx, -0.22, -0.2, 0.39, 0.3, m.white, c.whiteDark, 0.025)
  line(ctx, [[-0.02, -0.18], [-0.02, 0.09]], c.metalDark, 0.035)
  line(ctx, [[-0.14, -0.1], [0.1, -0.1]], c.metalLight, 0.045)
  box(ctx, 0.68, -0.085, 0.2, 0.17, m.metal, c.edge, 0.025)
  line(ctx, [[0.94, 0], [1.16, 0]], c.graphite, 0.03)
  for (const y of [-0.32, 0.32]) box(ctx, -1.24, y - 0.04, 0.14, 0.08, c.graphite, c.edge, 0.025)
  light(ctx, 0.1, -0.22, m)
}

const drawBuoy = (ctx: CanvasRenderingContext2D, m: NodeModelMaterials): void => {
  const c = m.palette
  // Side elevation exposes the heavy float, lattice mast and solar panels.
  line(ctx, [[0, 0.46], [0, 0.99]], c.metalDark, 0.08)
  ellipse(ctx, 0, 0.96, 0.14, 0.055, m.metal, c.edge)
  ellipse(ctx, 0, 0.39, 0.78, 0.34, m.graphite, c.edge)
  box(ctx, -0.78, 0.11, 1.56, 0.32, m.orange, c.orangeDark, 0.08)
  ellipse(ctx, 0, 0.1, 0.78, 0.25, m.orange, c.orangeDark)
  ellipse(ctx, 0, 0.11, 0.43, 0.145, m.yellow, c.yellowDark)
  for (const x of [-0.19, 0.19]) line(ctx, [[x, 0.1], [x * 0.5, -0.7]], c.metalDark, 0.07)
  for (const y of [-0.13, -0.39, -0.62]) line(ctx, [[-0.14, y], [0.14, y]], c.metal, 0.035)
  line(ctx, [[-0.16, 0], [0.13, -0.39], [-0.1, -0.67]], c.metalLight, 0.025)
  for (const sign of [-1, 1]) {
    const x = sign < 0 ? -0.66 : 0.2
    polygon(ctx, [[x, -0.54], [x + 0.46, -0.54], [x + 0.42, -0.26], [x - 0.04, -0.26]])
    finish(ctx, c.solar, c.metal, 0.04)
    for (const dx of [0.12, 0.25, 0.37]) line(ctx, [[x + dx, -0.51], [x + dx - 0.035, -0.29]], c.solarGrid, 0.012)
    line(ctx, [[x - 0.015, -0.4], [x + 0.435, -0.4]], c.solarGrid, 0.012)
  }
  box(ctx, -0.13, -0.77, 0.26, 0.12, m.yellow, c.yellowDark, 0.035)
  line(ctx, [[0.07, -0.77], [0.07, -1.01]], c.metalLight, 0.025)
  light(ctx, -0.035, -0.83, m)
}

const drawSensor = (ctx: CanvasRenderingContext2D, m: NodeModelMaterials): void => {
  const c = m.palette
  // Three splayed feet support a pressure canister, connector and cabled probe.
  for (const [x, y] of [[-0.92, 0.84], [0.92, 0.84], [0, 0.99]]) {
    line(ctx, [[x * 0.14, 0.22], [x, y]], c.edge, 0.125)
    line(ctx, [[x * 0.14 - 0.02, 0.2], [x - 0.02, y - 0.03]], c.metal, 0.07)
    box(ctx, x - 0.15, y - 0.035, 0.3, 0.07, m.metal, c.edge, 0.02)
  }
  box(ctx, -0.38, -0.43, 0.76, 0.99, m.metal, c.metalDark, 0.14)
  ellipse(ctx, 0, -0.42, 0.37, 0.12, m.metal, c.metalDark)
  for (const y of [-0.24, 0.34]) box(ctx, -0.39, y, 0.78, 0.085, m.graphite, c.edge, 0.025)
  line(ctx, [[-0.21, -0.17], [-0.21, 0.29]], c.metalLight, 0.06)
  box(ctx, -0.15, -0.67, 0.3, 0.25, m.graphite, c.edge, 0.04)
  ellipse(ctx, 0, -0.67, 0.15, 0.065, c.graphiteDark, c.graphiteLight)
  box(ctx, -0.13, -0.05, 0.26, 0.22, c.graphite, c.metalDark, 0.02)
  line(ctx, [[-0.08, 0.01], [0.07, 0.01]], c.metal, 0.02)
  ctx.beginPath()
  ctx.moveTo(0.3, -0.31)
  ctx.bezierCurveTo(0.88, -0.11, 0.48, 0.48, 0.79, 0.36)
  ctx.bezierCurveTo(0.98, 0.28, 0.7, -0.48, 0.72, -0.65)
  ctx.strokeStyle = c.graphiteDark
  ctx.lineWidth = 0.055
  ctx.stroke()
  box(ctx, 0.65, -0.91, 0.15, 0.36, m.graphite, c.edge, 0.035)
  box(ctx, 0.64, -0.88, 0.17, 0.09, m.metal, c.metalDark, 0.02)
  light(ctx, 0.07, -0.47, m)
}

const MODEL_DRAWERS: Record<NodeModelType, (ctx: CanvasRenderingContext2D, materials: NodeModelMaterials) => void> = {
  auv: drawAuv, rov: drawRov, vessel: drawVessel, buoy: drawBuoy, sensor: drawSensor,
}

/** Static device models stay inside the common model hit bounds. */
export const drawNodeModel = (
  ctx: CanvasRenderingContext2D,
  kind: NodeModelType,
  p: ScreenPoint,
  radius: number,
  profile: ThemeProfile,
  fillColor: string,
  _strokeColor: string,
): void => {
  if (!Number.isFinite(radius) || radius <= 0) return
  ctx.save()
  try {
    ctx.translate(p.x, p.y)
    ctx.scale(radius, radius)
    if (kind === 'buoy') ctx.scale(0.96, 1.18)
    if (kind === 'sensor') ctx.scale(1, 1.14)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.setLineDash([])
    ctx.shadowBlur = 0
    MODEL_DRAWERS[kind](ctx, nodeModelMaterials(ctx, profile.model, fillColor))
  } finally {
    ctx.restore()
  }
}

/** Plan view in metres, independent of the selectable screen-space node marker. */
export const drawNodeModelMeters = (ctx: CanvasRenderingContext2D, kind: NodeModelType, p: ScreenPoint,
  pixelsPerMetre: number, profile: ThemeProfile): void => {
  if (!Number.isFinite(pixelsPerMetre) || pixelsPerMetre <= 0) return
  const size = NODE_MODEL_DIMENSIONS[kind]
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.scale(pixelsPerMetre, pixelsPerMetre)
  if (kind === 'buoy' || kind === 'sensor') {
    const m = nodeModelMaterials(ctx, profile.model, profile.idleInner), c = m.palette
    if (kind === 'buoy') {
      ellipse(ctx, 0, 0, .95, .95, m.orange, c.orangeDark)
      ellipse(ctx, 0, 0, .6, .6, m.graphite, c.metal)
      for (const side of [-1, 1]) {
        box(ctx, -.38, side * .48 - .2, .76, .4, c.solar, c.metal, .015)
        for (let i=0;i<4;i++) line(ctx,[[-.3+i*.2,side*.48-.18],[-.3+i*.2,side*.48+.18]],c.solarGrid,.008)
      }
      ellipse(ctx,0,0,.12,.12,m.metal,c.edge)
    } else {
      ctx.scale(size.length / 1.23, size.width / (Math.sqrt(3) * .66 + .24))
      for (let i=0;i<3;i++) {
        const a=i*Math.PI*2/3, x=Math.cos(a)*.66, y=Math.sin(a)*.66
        line(ctx,[[0,0],[x,y]],c.metal,.045)
        ellipse(ctx,x,y,.12,.12,m.metal,c.edge)
      }
      ellipse(ctx,0,0,.25,.25,m.metal,c.edge)
      ellipse(ctx,0,0,.14,.14,m.graphite,c.metal)
      for(let i=0;i<8;i++) { const a=i*Math.PI/4; ellipse(ctx,Math.cos(a)*.21,Math.sin(a)*.21,.012,.012,c.metalDark,c.edge) }
    }
  } else {
    // Original industrial outlines, calibrated by their complete plan envelope.
    const envelope = kind === 'auv' ? [2.9,1.3] : kind === 'rov' ? [2.75,1.8] : [2.75,1]
    ctx.scale(size.length / envelope[0]!, size.width / envelope[1]!)
    drawNodeModel(ctx,kind,{x:0,y:0},1,profile,profile.idleInner,profile.label)
  }
  ctx.restore()
}
