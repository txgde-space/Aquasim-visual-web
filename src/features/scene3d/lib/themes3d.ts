import { Color3, Color4, Vector3 } from '@babylonjs/core'

export interface Theme3DPalette {
  clear: Color4
  idleDiffuse: Color3
  idleEmissive: Color3
  tx: Color3
  rx: Color3
  bad: Color3
  line: Color3
  /** 船体/艇身细节（深色钢结构） */
  hull: Color3
  /** 舰桥等上层建筑（浅色） */
  superstructure: Color3
  /** 航行灯 / beacon 自发光 */
  beacon: Color3
  markerAlpha: number
}

/** World units per meter of node depth (z is flipped into -Y). */
export const DEPTH_SCALE = 38
/** Diameter of the cylinder block travelling along a packet path. */
export const PATH_BLOCK_DIAMETER = 34
/** Scale of the progress core sphere when fully filled. */
export const PROGRESS_CORE_SCALE = 0.94

export const AXIS_X_COLOR = new Color3(0.9725, 0.4431, 0.4431)
export const AXIS_Y_COLOR = new Color3(0.2902, 0.8706, 0.502)
export const AXIS_Z_COLOR = new Color3(0.3765, 0.6471, 0.9804)

const color3 = (hex: string): Color3 => Color3.FromHexString(hex)

export const THEME_3D: Record<string, Theme3DPalette> = Object.freeze({
  'industrial-scada': {
    clear: new Color4(0.04, 0.08, 0.12, 1),
    idleDiffuse: color3('#0ea5e9'),
    idleEmissive: color3('#164e63'),
    tx: color3('#f97316'),
    rx: color3('#14b8a6'),
    bad: color3('#ef4444'),
    line: color3('#6d90a6'),
    hull: color3('#3b5568'),
    superstructure: color3('#c8d6e2'),
    beacon: color3('#ffb454'),
    markerAlpha: 0.42,
  },
})

export const DEFAULT_THEME_3D_KEY = 'industrial-scada'

export const theme3DFor = (key: string): Theme3DPalette => THEME_3D[key] || THEME_3D[DEFAULT_THEME_3D_KEY]

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

/** Map a replay node (x, y planar, z depth) into Babylon world space. */
export const worldPos = (node: { x: number; y: number; z?: number }): Vector3 =>
  new Vector3(node.x, -(node.z ?? 0) * DEPTH_SCALE, node.y)

export interface PacketReceiverTiming {
  rx_start_us: number
  status: string
  reason: string | null
  collision_start_us?: number
}

export const packetColor = (
  receiver: PacketReceiverTiming,
  now: number,
  palette: Theme3DPalette,
): Color3 => {
  if (now < receiver.rx_start_us) return palette.tx
  if (receiver.status === 'ok') return palette.rx
  if (receiver.reason === 'collision_rx_rx') {
    const collisionAt = receiver.collision_start_us ?? receiver.rx_start_us
    return now < collisionAt ? palette.rx : palette.bad
  }
  if (receiver.reason === 'collision_rx_tx') {
    return now < receiver.rx_start_us ? palette.tx : palette.bad
  }
  return palette.bad
}
