import type { NodeModelPalette } from '../themes'

export interface NodeModelMaterials {
  palette: NodeModelPalette
  yellow: CanvasGradient
  orange: CanvasGradient
  metal: CanvasGradient
  graphite: CanvasGradient
  white: CanvasGradient
  indicator: string
}

/** Fixed device finishes; communication state only changes the small indicator. */
export const nodeModelMaterials = (
  ctx: CanvasRenderingContext2D,
  palette: NodeModelPalette,
  indicator: string,
): NodeModelMaterials => {
  const cylinder = (light: string, mid: string, dark: string) => {
    const gradient = ctx.createLinearGradient(0, -0.48, 0, 0.5)
    gradient.addColorStop(0, mid)
    gradient.addColorStop(0.22, light)
    gradient.addColorStop(0.55, mid)
    gradient.addColorStop(1, dark)
    return gradient
  }
  return {
    palette, indicator,
    yellow: cylinder(palette.yellowLight, palette.yellow, palette.yellowDark),
    orange: cylinder(palette.orangeLight, palette.orange, palette.orangeDark),
    metal: cylinder(palette.metalLight, palette.metal, palette.metalDark),
    graphite: cylinder(palette.graphiteLight, palette.graphite, palette.graphiteDark),
    white: cylinder(palette.whiteLight, palette.white, palette.whiteDark),
  }
}
