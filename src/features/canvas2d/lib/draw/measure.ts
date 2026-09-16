import { fillCircle, roundedRectPath } from './primitives'

interface ScreenPoint {
  x: number
  y: number
}

/** A measurement line with its endpoints already projected to screen space. */
export interface MeasureLineView {
  id: number | string
  start: ScreenPoint
  end: ScreenPoint
  distanceText: string
  isSelected: boolean
}

export const drawMeasurementLines = (
  ctx: CanvasRenderingContext2D,
  lines: MeasureLineView[],
  pendingPoint: ScreenPoint | null,
  width: number,
  height: number,
): void => {
  for (const item of lines) {
    const p1 = item.start
    const p2 = item.end
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    const isSelected = item.isSelected

    ctx.save()
    ctx.strokeStyle = isSelected ? 'rgba(251, 191, 36, 0.98)' : 'rgba(56, 189, 248, 0.94)'
    ctx.setLineDash([8, 8])
    ctx.lineWidth = isSelected ? 3 : 2.2
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
    ctx.restore()

    fillCircle(ctx, p1.x, p1.y, isSelected ? 5.5 : 4.5, isSelected ? 'rgba(251, 191, 36, 0.98)' : 'rgba(56, 189, 248, 0.95)')
    fillCircle(ctx, p2.x, p2.y, isSelected ? 5.5 : 4.5, isSelected ? 'rgba(251, 191, 36, 0.98)' : 'rgba(56, 189, 248, 0.95)')

    const labelText = item.distanceText
    const midX = (p1.x + p2.x) / 2
    const midY = (p1.y + p2.y) / 2
    ctx.save()
    ctx.font = '11px "IBM Plex Sans", "Segoe UI", sans-serif'
    const textWidth = ctx.measureText(labelText).width
    const boxX = midX - (textWidth / 2) - 6
    const boxY = midY - 19
    roundedRectPath(ctx, boxX, boxY, textWidth + 12, 18, 8)
    ctx.fillStyle = isSelected ? 'rgba(66, 32, 6, 0.92)' : 'rgba(8, 18, 34, 0.88)'
    ctx.fill()
    ctx.strokeStyle = isSelected ? 'rgba(251, 191, 36, 0.62)' : 'rgba(56, 189, 248, 0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(labelText, midX, boxY + 9.5)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#60a5fa'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(midX - 5, midY - 12)
    ctx.lineTo(midX + 5, midY - 12)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(midX - 5, midY - 12)
    ctx.lineTo(midX - 5 + (Math.cos(angle) * 10), midY - 12 + (Math.sin(angle) * 10))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(midX + 5, midY - 12)
    ctx.lineTo(midX + 5 + (Math.cos(angle) * 10), midY - 12 + (Math.sin(angle) * 10))
    ctx.stroke()
    ctx.restore()
  }

  if (pendingPoint) {
    const p = pendingPoint
    ctx.save()
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
    ctx.fillStyle = 'rgba(251, 191, 36, 0.95)'
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p.y)
    ctx.lineTo(width, p.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(p.x, 0)
    ctx.lineTo(p.x, height)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = '12px "IBM Plex Sans", "Segoe UI", sans-serif'
    ctx.fillText('起点', p.x + 10, p.y - 10)
    ctx.restore()
  }
}
