import { GRID_TARGET_PX, MIN_GRID_STEP_METERS, toScreenPoint, toWorldPoint, type Projection } from '../coordinate'

export const pickWorldGridStep = (pxPerMeter: number): number => {
  const raw = GRID_TARGET_PX / Math.max(pxPerMeter, 1e-9)
  const nice = [MIN_GRID_STEP_METERS, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000, 100000]
  for (const value of nice) {
    if (value >= raw * 0.85) return value
  }
  return nice[nice.length - 1]
}

export const drawWorldGrid = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  proj: Projection,
): void => {
  const toWorld = (x: number, y: number) => toWorldPoint(x, y, proj)
  const toScreen = (x: number, y: number) => toScreenPoint(x, y, proj)

  const topLeft = toWorld(0, 0)
  const topRight = toWorld(w, 0)
  const bottomLeft = toWorld(0, h)
  const bottomRight = toWorld(w, h)
  const minX = Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)
  const maxX = Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x)
  const minY = Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)
  const maxY = Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y)
  const step = pickWorldGridStep(proj.scale)
  const majorStep = step * 4
  const startX = Math.floor(minX / step) * step
  const startY = Math.floor(minY / step) * step
  const startMajorX = Math.floor(minX / majorStep) * majorStep
  const startMajorY = Math.floor(minY / majorStep) * majorStep

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  ctx.clip()

  ctx.strokeStyle = 'rgba(191, 219, 254, 0.12)'
  ctx.lineWidth = 1
  for (let x = startX; x <= maxX + (step * 0.01); x += step) {
    const a = toScreen(x, minY)
    const b = toScreen(x, maxY)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  for (let y = startY; y <= maxY + (step * 0.01); y += step) {
    const a = toScreen(minX, y)
    const b = toScreen(maxX, y)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(191, 219, 254, 0.2)'
  ctx.lineWidth = 1.2
  for (let x = startMajorX; x <= maxX + (majorStep * 0.01); x += majorStep) {
    const a = toScreen(x, minY)
    const b = toScreen(x, maxY)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  for (let y = startMajorY; y <= maxY + (majorStep * 0.01); y += majorStep) {
    const a = toScreen(minX, y)
    const b = toScreen(maxX, y)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.restore()
}
