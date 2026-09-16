import type { ThemeProfile } from '../themes'
import { drawPlanePulse, drawShellBurst, fillCircle } from './primitives'

interface ScreenPoint {
  x: number
  y: number
}

export interface PacketEndpoints {
  src: ScreenPoint
  dst: ScreenPoint
}

export const packetSegmentColor = (
  receiver: {
    rx_start_us: number
    status: string
    reason: string | null
    collision_start_us?: number
  },
  now: number,
  profile: Pick<ThemeProfile, 'tx' | 'rx' | 'bad'>,
): string => {
  const txColor = profile.tx
  const rxColor = profile.rx
  const collisionColor = profile.bad

  if (now < receiver.rx_start_us) {
    return txColor
  }

  if (receiver.status === 'ok') {
    return rxColor
  }

  if (receiver.reason === 'collision_rx_rx') {
    const collisionAt = receiver.collision_start_us ?? receiver.rx_start_us
    return now < collisionAt ? rxColor : collisionColor
  }

  if (receiver.reason === 'collision_rx_tx') {
    return now < receiver.rx_start_us ? txColor : collisionColor
  }

  return collisionColor
}

export const drawPacketRect = (
  ctx: CanvasRenderingContext2D,
  endpoints: PacketEndpoints,
  packet: { tx_start_us: number; tx_duration_us: number },
  receiver: {
    rx_start_us: number
    rx_end_us: number
    rx_duration_us: number
    status: string
    reason: string | null
    collision_start_us?: number
  },
  now: number,
  profile: Pick<ThemeProfile, 'ring' | 'tx' | 'rx' | 'bad'>,
  phase: number,
  fx: number,
): void => {
  const { src, dst } = endpoints
  const dx = dst.x - src.x
  const dy = dst.y - src.y
  const pathLength = Math.hypot(dx, dy)
  if (pathLength < 1) return

  const ux = dx / pathLength
  const uy = dy / pathLength
  const nx = -uy
  const ny = ux
  const pathDuration = Math.max(1, receiver.rx_start_us - packet.tx_start_us)
  const frontRatio = Math.max(0, Math.min(1, (now - packet.tx_start_us) / pathDuration))
  const tailRatio = Math.max(0, Math.min(1, (now - (packet.tx_start_us + packet.tx_duration_us)) / pathDuration))
  const startRatio = Math.min(tailRatio, frontRatio)
  const endRatio = Math.max(tailRatio, frontRatio)
  if (endRatio <= 0) return

  const segStartX = src.x + (dx * startRatio)
  const segStartY = src.y + (dy * startRatio)
  const segEndX = src.x + (dx * endRatio)
  const segEndY = src.y + (dy * endRatio)
  const pulse = 0.7 + (Math.sin((phase * (8 + fx)) + (packet.tx_start_us * 0.000001)) * 0.3)
  const halfWidth = (2.6 + (pulse * 1.6)) * (fx > 1 ? 1.26 : 1)
  const color = packetSegmentColor(receiver, now, profile)
  const angle = Math.atan2(dy, dx)

  ctx.save()
  ctx.setLineDash([2, 7])
  ctx.lineDashOffset = -((phase * 48) + (packet.tx_start_us * 0.000002))
  ctx.lineCap = 'round'
  ctx.strokeStyle = profile.ring
  ctx.globalAlpha = 0.72
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(src.x, src.y)
  ctx.lineTo(dst.x, dst.y)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = (8 + (pulse * 10)) * (fx > 1 ? 1.8 : 1)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(segStartX + (nx * halfWidth), segStartY + (ny * halfWidth))
  ctx.lineTo(segEndX + (nx * halfWidth), segEndY + (ny * halfWidth))
  ctx.lineTo(segEndX - (nx * halfWidth), segEndY - (ny * halfWidth))
  ctx.lineTo(segStartX - (nx * halfWidth), segStartY - (ny * halfWidth))
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  if (now >= receiver.rx_start_us) {
    const linger = Math.max(0, 1 - ((now - receiver.rx_start_us) / Math.max(150_000, receiver.rx_duration_us * 0.75)))
    if (linger > 0) {
      fillCircle(ctx, dst.x, dst.y, 2.8, color, 0.45 + (linger * 0.3))
    }
  }

  const headRatio = Math.max(0, Math.min(1, frontRatio))
  const headX = src.x + (dx * headRatio)
  const headY = src.y + (dy * headRatio)
  fillCircle(ctx, headX, headY, (1.5 + (pulse * 1.8)) * (fx > 1 ? 1.6 : 1), color, fx > 1 ? 0.95 : 0.85)

  if (fx > 1) {
    const trailCount = 3
    for (let i = 1; i <= trailCount; i += 1) {
      const t = Math.max(0, headRatio - (i * 0.05))
      const tx = src.x + (dx * t)
      const ty = src.y + (dy * t)
      fillCircle(
        ctx,
        tx,
        ty,
        Math.max(1.2, 2.8 - (i * 0.65)),
        color,
        0.3 - (i * 0.07),
      )
    }

    drawPlanePulse(
      ctx,
      headX,
      headY,
      angle,
      color,
      5.5 + (pulse * 1.6),
      0.92,
    )

    if (receiver.status !== 'ok') {
      const collisionAt = receiver.collision_start_us ?? receiver.rx_start_us
      if (now >= collisionAt) {
        const impactRatio = Math.max(0, Math.min(1, (now - collisionAt) / Math.max(1, receiver.rx_duration_us)))
        const shellX = src.x + (dx * (0.72 + (impactRatio * 0.28)))
        const shellY = src.y + (dy * (0.72 + (impactRatio * 0.28)))
        fillCircle(ctx, shellX, shellY, 3.6, '#fb923c', 0.92)
        fillCircle(ctx, shellX - (ux * 8), shellY - (uy * 8), 2.2, '#fdba74', 0.5)
        drawShellBurst(ctx, dst.x, dst.y, '#ef4444', phase + impactRatio, 1.05)
      }
    }
  }
}
