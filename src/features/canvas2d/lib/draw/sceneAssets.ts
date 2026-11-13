import type { SceneAsset } from '@/shared/sceneAssets'
import { ASSET_FINISHES, sceneAssetParts, sceneAssetBounds } from '@/shared/sceneAssetGeometry'
import type { ThemeProfile } from '../themes'

/** Static top views in world metres, below packets and communication nodes. */
export const drawSceneAssets = (ctx: CanvasRenderingContext2D, assets: readonly SceneAsset[],
  toScreen: (x: number, y: number) => { x: number; y: number }, scale: number,
  profile: ThemeProfile, selectedId: string | null) => {
  for (const asset of [...assets].filter(a => a.visible).sort((a, b) => a.z - b.z)) {
    const anchor = toScreen(asset.x, asset.y), pixels = scale * asset.scale
    ctx.save()
    ctx.translate(anchor.x, anchor.y)
    ctx.rotate(-asset.heading * Math.PI / 180)
    ctx.scale(pixels, -pixels)
    for (const part of [...sceneAssetParts(asset.type)].sort((a, b) => a.at[2] - b.at[2])) {
      const [x, y] = part.at, [w, d, h] = part.size
      ctx.save(); ctx.translate(x, y); ctx.rotate(part.yaw ?? 0)
      ctx.beginPath()
      if (part.outline) {
        part.outline!.forEach(([px, py], index) => index ? ctx.lineTo(px, py) : ctx.moveTo(px, py))
        ctx.closePath()
      } else if (part.shape === 'ellipsoid' || part.shape === 'cylinder') {
        ctx.ellipse(0, 0, (part.axis === 'x' ? h : w) / 2, d / 2, 0, 0, Math.PI * 2)
      } else ctx.rect(-w / 2, -d / 2, w, d)
      ctx.fillStyle = ASSET_FINISHES[part.finish].color
      ctx.fill()
      ctx.strokeStyle = ASSET_FINISHES.dark.color
      ctx.lineWidth = Math.min(0.6 / Math.max(pixels, 0.001), Math.max(0.008, Math.min(w, d) * 0.08))
      ctx.stroke(); ctx.restore()
    }
    if (selectedId === asset.id) {
      const { min, size } = sceneAssetBounds(asset.type)
      ctx.strokeStyle = profile.idleInner; ctx.lineWidth = 1.5 / Math.max(pixels, 0.001)
      ctx.setLineDash([5 / pixels, 4 / pixels])
      ctx.strokeRect(min[0] - 5 / pixels, min[1] - 5 / pixels, size[0] + 10 / pixels, size[1] + 10 / pixels)
    }
    ctx.restore()
    ctx.save(); ctx.font = '11px "IBM Plex Sans", sans-serif'; ctx.fillStyle = profile.label
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText(asset.name, anchor.x, anchor.y - Math.max(13, sceneAssetBounds(asset.type).size[1] * pixels * 0.5 + 4))
    ctx.restore()
  }
}

export const pickSceneAsset = (assets: readonly SceneAsset[], x: number, y: number, tolerance: number): SceneAsset | undefined =>
  [...assets].reverse().find(asset => {
    if (!asset.visible) return false
    const angle = -asset.heading * Math.PI / 180, dx = x - asset.x, dy = y - asset.y
    const localX = dx * Math.cos(angle) - dy * Math.sin(angle), localY = dx * Math.sin(angle) + dy * Math.cos(angle)
    const { min, max } = sceneAssetBounds(asset.type)
    return localX >= min[0]*asset.scale-tolerance && localX <= max[0]*asset.scale+tolerance
      && localY >= min[1]*asset.scale-tolerance && localY <= max[1]*asset.scale+tolerance
  })
