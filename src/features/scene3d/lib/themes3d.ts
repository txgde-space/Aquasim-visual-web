import { Color3, Color4, Vector3 } from '@babylonjs/core'

export interface Theme3DPalette {
  clear: Color4
  idleDiffuse: Color3
  idleEmissive: Color3
  tx: Color3
  rx: Color3
  bad: Color3
  line: Color3
  markerAlpha: number
}

/** Base radius of a node sphere in world units. */
export const NODE_RADIUS = 130
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
  'ocean-sonar': {
    clear: new Color4(0.03, 0.07, 0.13, 1),
    idleDiffuse: color3('#2963eb'),
    idleEmissive: color3('#123066'),
    tx: color3('#f59e0b'),
    rx: color3('#22c55e'),
    bad: color3('#dc2626'),
    line: color3('#6f8bbd'),
    markerAlpha: 0.45,
  },
  'research-lab': {
    clear: new Color4(0.05, 0.08, 0.16, 1),
    idleDiffuse: color3('#3b82f6'),
    idleEmissive: color3('#1e3a8a'),
    tx: color3('#f59e0b'),
    rx: color3('#10b981'),
    bad: color3('#ef4444'),
    line: color3('#7b9ac8'),
    markerAlpha: 0.42,
  },
  'tactical-ops': {
    clear: new Color4(0.04, 0.08, 0.04, 1),
    idleDiffuse: color3('#65a30d'),
    idleEmissive: color3('#1f4c2c'),
    tx: color3('#f59e0b'),
    rx: color3('#4ade80'),
    bad: color3('#ef4444'),
    line: color3('#7faa4b'),
    markerAlpha: 0.45,
  },
  'industrial-scada': {
    clear: new Color4(0.04, 0.08, 0.12, 1),
    idleDiffuse: color3('#0ea5e9'),
    idleEmissive: color3('#164e63'),
    tx: color3('#f97316'),
    rx: color3('#14b8a6'),
    bad: color3('#ef4444'),
    line: color3('#6d90a6'),
    markerAlpha: 0.42,
  },
  'cyber-neon': {
    clear: new Color4(0.08, 0.03, 0.12, 1),
    idleDiffuse: color3('#c026d3'),
    idleEmissive: color3('#4a145f'),
    tx: color3('#f97316'),
    rx: color3('#2dd4bf'),
    bad: color3('#fb7185'),
    line: color3('#b26ac6'),
    markerAlpha: 0.48,
  },
  'light-minimal': {
    clear: new Color4(0.84, 0.9, 0.97, 1),
    idleDiffuse: color3('#2563eb'),
    idleEmissive: color3('#93c5fd'),
    tx: color3('#f97316'),
    rx: color3('#16a34a'),
    bad: color3('#dc2626'),
    line: color3('#64748b'),
    markerAlpha: 0.36,
  },
  'gis-map': {
    clear: new Color4(0.05, 0.11, 0.1, 1),
    idleDiffuse: color3('#0f766e'),
    idleEmissive: color3('#14532d'),
    tx: color3('#f59e0b'),
    rx: color3('#22c55e'),
    bad: color3('#ef4444'),
    line: color3('#6ba58c'),
    markerAlpha: 0.44,
  },
  'timeline-story': {
    clear: new Color4(0.08, 0.07, 0.14, 1),
    idleDiffuse: color3('#4f46e5'),
    idleEmissive: color3('#312e81'),
    tx: color3('#f59e0b'),
    rx: color3('#60a5fa'),
    bad: color3('#f43f5e'),
    line: color3('#9f8fc6'),
    markerAlpha: 0.45,
  },
})

export const DEFAULT_THEME_3D_KEY = 'ocean-sonar'

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
