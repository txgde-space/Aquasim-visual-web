import type { SnapGuide } from '../nodeSnapping'
import type { ThemeProfile } from '../themes'
import { roundedRectPath } from './primitives'

interface Point { x: number; y: number }
interface Box { x: number; y: number; width: number; height: number }
const finitePoint = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y)

/** Clip the segment itself so offscreen endpoints never pull labels offscreen. */
const clipSegment = (from: Point, to: Point, width: number, height: number): [Point, Point] | null => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  let start = 0
  let end = 1
  for (const [direction, distance] of [[-dx, from.x], [dx, width - from.x], [-dy, from.y], [dy, height - from.y]]) {
    if (direction === 0) {
      if (distance < 0) return null
    } else {
      const fraction = distance / direction
      if (direction < 0) start = Math.max(start, fraction)
      else end = Math.min(end, fraction)
      if (start > end) return null
    }
  }
  return [{ x: from.x + start * dx, y: from.y + start * dy }, { x: from.x + end * dx, y: from.y + end * dy }]
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y

/** Screen-space hints only. The caller draws them below node bodies and labels. */
export const drawSnapGuides = (
  ctx: CanvasRenderingContext2D,
  guides: readonly SnapGuide[],
  toScreen: (x: number, y: number) => Point,
  profile: ThemeProfile,
  viewport: { width: number; height: number },
): void => {
  const { width, height } = viewport
  if (!guides.length || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
  const labels: Box[] = []
  ctx.save()
  try {
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    ctx.clip()
    ctx.lineWidth = 1.2
    ctx.lineCap = 'butt'
    ctx.font = '11px "IBM Plex Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const guide of guides) {
      if (!finitePoint(guide.from) || !finitePoint(guide.to)) continue
      const from = toScreen(guide.from.x, guide.from.y)
      const to = toScreen(guide.to.x, guide.to.y)
      if (!finitePoint(from) || !finitePoint(to)) continue
      const clipped = clipSegment(from, to, width, height)
      if (!clipped) continue
      const [start, end] = clipped
      const length = Math.hypot(to.x - from.x, to.y - from.y)
      const pointGuide = length < 0.5
      let normal = pointGuide ? { x: 0, y: -1 } : { x: -(to.y - from.y) / length, y: (to.x - from.x) / length }
      // Prefer labels above horizontal guides and right of vertical guides.
      if (normal.y > 0 || (normal.y === 0 && normal.x < 0)) normal = { x: -normal.x, y: -normal.y }
      const color = guide.kind === 'alignment' ? profile.rx : guide.kind === 'spacing' ? profile.tx : profile.depth
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.9
      ctx.setLineDash(pointGuide ? [] : [5, 4])
      ctx.beginPath()
      if (pointGuide) {
        ctx.moveTo(from.x - 5, from.y)
        ctx.lineTo(from.x + 5, from.y)
        ctx.moveTo(from.x, from.y - 5)
        ctx.lineTo(from.x, from.y + 5)
      } else {
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      if (!pointGuide) {
        ctx.beginPath()
        for (const point of [from, to]) {
          if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) continue
          ctx.moveTo(point.x - normal.x * 4, point.y - normal.y * 4)
          ctx.lineTo(point.x + normal.x * 4, point.y + normal.y * 4)
        }
        ctx.stroke()
      }

      const text = guide.label?.trim()
      if (!text || width < 40 || height < 28) continue
      const boxWidth = Math.min(ctx.measureText(text).width + 12, width - 8)
      const boxHeight = 20
      const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
      const offset = 24 + (Math.abs(normal.x) * boxWidth + Math.abs(normal.y) * boxHeight) / 2
      const endpointBoxes = [from, to].map((point) => ({ x: point.x - 22, y: point.y - 22, width: 44, height: 44 }))
      // Clamping may bring a label back onto a node at a viewport edge. Try the
      // other side, then omit the label if neither side has room.
      let box: Box | undefined
      for (const side of [1, -1]) {
        const candidate = {
          x: Math.max(4, Math.min(width - boxWidth - 4, middle.x + normal.x * offset * side - boxWidth / 2)),
          y: Math.max(4, Math.min(height - boxHeight - 4, middle.y + normal.y * offset * side - boxHeight / 2)),
          width: boxWidth,
          height: boxHeight,
        }
        if (!endpointBoxes.some((endpoint) => overlaps(candidate, endpoint)) && !labels.some((label) => overlaps(candidate, label))) {
          box = candidate
          break
        }
      }
      if (!box) continue
      labels.push(box)
      ctx.globalAlpha = 0.94
      ctx.fillStyle = profile.bg[1] || profile.bg[0] || profile.idleOuter
      roundedRectPath(ctx, box.x, box.y, box.width, box.height, 4)
      ctx.fill()
      ctx.globalAlpha = 0.8
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = profile.label
      ctx.fillText(text, box.x + box.width / 2, box.y + box.height / 2, box.width - 12)
    }
  } finally {
    ctx.restore()
  }
}
