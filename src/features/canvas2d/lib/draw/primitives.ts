/** Low-level canvas primitives shared by all canvas2d draw modules. */

export const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export const fillCircle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  fillStyle: string | CanvasGradient,
  alpha = 1,
): void => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = fillStyle
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export const strokeCircle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  strokeStyle: string,
  lineWidth: number,
  alpha = 1,
): void => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export const drawPlanePulse = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  size: number,
  alpha = 1,
): void => {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(size * 1.2, 0)
  ctx.lineTo(-size * 0.55, size * 0.4)
  ctx.lineTo(-size * 0.2, 0)
  ctx.lineTo(-size * 0.55, -size * 0.4)
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(-size * 0.2, 0)
  ctx.lineTo(-size * 0.9, size * 0.65)
  ctx.lineTo(-size * 0.72, 0)
  ctx.lineTo(-size * 0.9, -size * 0.65)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export const drawShellBurst = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  phase: number,
  power = 1,
): void => {
  const pulse = 0.5 + (Math.sin(phase * 18) * 0.5)
  const r = (16 + (pulse * 12)) * power
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.1)
  glow.addColorStop(0, color)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, r * 2.1, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  for (let i = 0; i < 3; i += 1) {
    ctx.globalAlpha = 0.58 - (i * 0.16)
    ctx.beginPath()
    ctx.arc(x, y, r + (i * 8), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

export const colorMix = (hexA: string, hexB: string, ratio = 0.5): string => {
  const parse = (hex: string): number[] => {
    const clean = hex.replace('#', '')
    const expanded = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean
    const num = parseInt(expanded, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }
  try {
    const a = parse(hexA)
    const b = parse(hexB)
    const m = a.map((v, i) => Math.round((v * (1 - ratio)) + (b[i] * ratio)))
    return `rgb(${m[0]} ${m[1]} ${m[2]})`
  } catch {
    return hexA
  }
}
