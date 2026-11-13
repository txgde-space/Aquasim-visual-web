import type { ThemeProfile } from '../themes'
import { rangeDistanceLabel, type NodeRangeSettings } from '../nodeRange'
import { roundedRectPath } from './primitives'

interface RangeEntry { node: { node_id: number; x: number; y: number }; radius: number; settings: Readonly<NodeRangeSettings> }

/** Meter-accurate XY footprints, always painted below packets, measurements and nodes. */
export const drawNodeRanges = (ctx: CanvasRenderingContext2D, ranges: readonly RangeEntry[],
  project: (x: number, y: number) => { x: number; y: number }, scale: number, profile: ThemeProfile,
  viewport: { width: number; height: number }, nonlinearProjection = false): void => {
  if (!ranges.length || !Number.isFinite(scale) || scale <= 0) return
  const { width, height } = viewport
  ctx.save()
  try {
    ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip()
    for (const { node, radius, settings } of ranges) {
      if (nonlinearProjection) {
        // Reproject the metric footprint, instead of scaling a Mercator pixel circle.
        const points = Array.from({ length: 129 }, (_, i) => project(node.x + radius * Math.cos(i * Math.PI / 64), node.y + radius * Math.sin(i * Math.PI / 64)))
        if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) continue
        ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath()
        if (settings.filled) { ctx.globalAlpha = settings.opacity; ctx.fillStyle = profile.rangeFill; ctx.fill() }
        ctx.globalAlpha = 0.65; ctx.strokeStyle = profile.rangeStroke; ctx.lineWidth = 1.2; ctx.setLineDash([5, 6]); ctx.stroke(); ctx.setLineDash([])
        const top = points.reduce((best, p) => p.y < best.y ? p : best, points[0]!)
        if (settings.showLabel) { ctx.globalAlpha = 1; ctx.fillStyle = profile.label; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(rangeDistanceLabel(radius), top.x, top.y - 8) }
        continue
      }
      const p = project(node.x, node.y)
      const r = radius * scale
      if (![p.x, p.y, r].every(Number.isFinite) || r <= 0) continue
      if (p.x + r < 0 || p.x - r > width || p.y + r < 0 || p.y - r > height) continue
      const opacity = Number.isFinite(settings.opacity) ? Math.min(0.3, Math.max(0.04, settings.opacity)) : 0.14
      const coversViewport = Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => Math.hypot(p.x - x!, p.y - y!))) < r
      if (settings.filled) {
        ctx.globalAlpha = opacity
        ctx.fillStyle = profile.rangeFill
        if (coversViewport) ctx.fillRect(0, 0, width, height)
        else {
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
          gradient.addColorStop(0, profile.rangeClear)
          gradient.addColorStop(0.7, profile.rangeFill)
          gradient.addColorStop(1, profile.rangeFill)
          ctx.fillStyle = gradient
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill()
        }
      }
      if (coversViewport) continue
      ctx.globalAlpha = 0.65
      ctx.strokeStyle = profile.rangeStroke
      ctx.lineWidth = 1.2
      ctx.setLineDash([5, 6])
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke()
      ctx.setLineDash([])
      if (r >= 20) {
        ctx.beginPath()
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2
          ctx.moveTo(p.x + Math.cos(a) * (r - 4), p.y + Math.sin(a) * (r - 4))
          ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)
        }
        ctx.stroke()
      }
      if (!settings.showLabel || r < 36) continue
      const label = rangeDistanceLabel(radius)
      ctx.font = '10px "IBM Plex Mono", monospace'
      const textWidth = ctx.measureText(label).width + 16
      const x = p.x - textWidth / 2
      const y = p.y - r - 24
      // Keep labels attached to their circumference; do not clamp them onto node IDs.
      if (x < 4 || x + textWidth > width - 4 || y < 4 || y + 20 > height - 4) continue
      ctx.globalAlpha = 0.94; ctx.fillStyle = profile.bg[1]!
      roundedRectPath(ctx, x, y, textWidth, 20, 5); ctx.fill()
      ctx.globalAlpha = 0.8; ctx.stroke()
      ctx.globalAlpha = 1; ctx.fillStyle = profile.label
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(label, p.x, y + 10)
    }
  } finally { ctx.restore() }
}
