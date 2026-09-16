import type { ThemeProfile } from '../themes'
import { colorMix, roundedRectPath, strokeCircle } from './primitives'

interface ScreenPoint {
  x: number
  y: number
}

export const drawSubmarineNode = (
  ctx: CanvasRenderingContext2D,
  p: ScreenPoint,
  fillColor: string,
  strokeColor: string,
  profile: ThemeProfile,
  pulse: number,
): void => {
  const hullW = 38
  const hullH = 16
  roundedRectPath(ctx, p.x - (hullW / 2), p.y - (hullH / 2), hullW, hullH, 8)
  ctx.fillStyle = fillColor
  ctx.shadowColor = profile.ring
  ctx.shadowBlur = 12 + (pulse * 5)
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.4
  ctx.stroke()

  roundedRectPath(ctx, p.x - 6, p.y - 16, 12, 8, 3)
  ctx.fillStyle = colorMix(fillColor, '#ffffff', 0.15)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(p.x - 19, p.y)
  ctx.lineTo(p.x - 26, p.y - 5)
  ctx.lineTo(p.x - 26, p.y + 5)
  ctx.closePath()
  ctx.fillStyle = strokeColor
  ctx.fill()

  ctx.beginPath()
  ctx.arc(p.x + 8, p.y, 2.2, 0, Math.PI * 2)
  ctx.fillStyle = '#dbeafe'
  ctx.fill()
}

export const drawCarrierNode = (
  ctx: CanvasRenderingContext2D,
  p: ScreenPoint,
  fillColor: string,
  strokeColor: string,
  profile: ThemeProfile,
  phase: number,
): void => {
  const hullW = 78
  const hullH = 24
  const wakePulse = 0.5 + (Math.sin((phase * 5.8) + (p.x * 0.01)) * 0.5)

  ctx.save()
  ctx.translate(p.x, p.y)

  ctx.strokeStyle = colorMix(profile.ring, '#ffffff', 0.12)
  ctx.lineWidth = 1.1
  for (let i = 0; i < 3; i += 1) {
    ctx.globalAlpha = 0.28 - (i * 0.08)
    ctx.beginPath()
    ctx.moveTo(-(hullW * 0.65) - (i * 6), -(hullH * 0.12))
    ctx.quadraticCurveTo(-(hullW * 0.82) - (i * 8), 0, -(hullW * 0.65) - (i * 6), hullH * 0.12)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  const hullGradient = ctx.createLinearGradient(-(hullW * 0.6), 0, hullW * 0.6, 0)
  hullGradient.addColorStop(0, colorMix(fillColor, '#1e293b', 0.5))
  hullGradient.addColorStop(0.55, fillColor)
  hullGradient.addColorStop(1, colorMix(fillColor, '#ffffff', 0.2))
  ctx.fillStyle = hullGradient
  ctx.shadowColor = profile.ring
  ctx.shadowBlur = 18
  ctx.beginPath()
  ctx.moveTo(-(hullW * 0.58), -(hullH * 0.34))
  ctx.lineTo(hullW * 0.3, -(hullH * 0.44))
  ctx.quadraticCurveTo(hullW * 0.52, -(hullH * 0.2), hullW * 0.6, 0)
  ctx.quadraticCurveTo(hullW * 0.52, hullH * 0.2, hullW * 0.3, hullH * 0.44)
  ctx.lineTo(-(hullW * 0.58), hullH * 0.34)
  ctx.quadraticCurveTo(-(hullW * 0.7), 0, -(hullW * 0.58), -(hullH * 0.34))
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 1.8
  ctx.stroke()

  roundedRectPath(ctx, -(hullW * 0.5), -(hullH * 0.18), hullW * 0.84, hullH * 0.36, 5)
  ctx.fillStyle = colorMix(fillColor, '#ffffff', 0.18)
  ctx.fill()
  ctx.strokeStyle = colorMix(strokeColor, '#ffffff', 0.18)
  ctx.lineWidth = 1
  ctx.stroke()

  roundedRectPath(ctx, -(hullW * 0.06), -(hullH * 0.66), 18, 13, 3)
  ctx.fillStyle = colorMix(fillColor, '#ffffff', 0.33)
  ctx.fill()
  roundedRectPath(ctx, (hullW * 0.03), -(hullH * 0.95), 8, 10, 2)
  ctx.fillStyle = colorMix(fillColor, '#ffffff', 0.5)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(-(hullW * 0.38), 0)
  ctx.lineTo(hullW * 0.44, 0)
  ctx.strokeStyle = '#f8fafc'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.stroke()
  ctx.setLineDash([])

  ctx.beginPath()
  ctx.moveTo(8, -(hullH * 0.72))
  ctx.lineTo(8, -(hullH * 1.2))
  ctx.strokeStyle = colorMix(profile.ring, '#ffffff', 0.34)
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(8, -(hullH * 1.23), 3.2 + (wakePulse * 1.8), 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(219, 234, 254, 0.9)'
  ctx.fill()

  ctx.restore()

  strokeCircle(ctx, p.x, p.y, 20 + (wakePulse * 11), profile.ring, 1.2, 0.34)
  strokeCircle(ctx, p.x, p.y, 30 + (wakePulse * 8), profile.ring, 0.9, 0.2)
}
