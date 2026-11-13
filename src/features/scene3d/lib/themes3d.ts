import { Color3, Color4, Vector3 } from '@babylonjs/core'

/** Physical equipment finishes; packet/status colors remain independent. */
export interface NodeModelPalette {
  yellow: Color3
  yellowLight: Color3
  orange: Color3
  white: Color3
  steel: Color3
  darkMetal: Color3
  rubber: Color3
  glass: Color3
  deck: Color3
  solar: Color3
  lens: Color3
  lamp: Color3
}

export interface OceanPalette {
  seabed: Color3
  rock: Color3
  water: Color3
  glint: Color3
  haze: Color3
  skyZenith: Color3
  skyHorizon: Color3
  sunlight: Color3
  vegetation: Color3
  coral: Color3
}

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
  model: NodeModelPalette
  ocean: OceanPalette
  markerAlpha: number
}

/** World units per meter of node depth (physical z maps to Y). */
export const DEPTH_SCALE = 1
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
    model: {
      yellow: color3('#dcae28'),
      yellowLight: color3('#f3d775'),
      orange: color3('#ce6f28'),
      white: color3('#d8dfe0'),
      steel: color3('#87969b'),
      darkMetal: color3('#303e45'),
      rubber: color3('#182126'),
      glass: color3('#172c36'),
      deck: color3('#54636a'),
      solar: color3('#20394c'),
      lens: color3('#8cbbbf'),
      lamp: color3('#ffe2ab'),
    },
    ocean: {
      seabed: color3('#a7b4a0'),
      rock: color3('#82958b'),
      water: color3('#16788f'),
      glint: color3('#c4edf0'),
      haze: color3('#397f98'),
      skyZenith: color3('#438fc9'),
      skyHorizon: color3('#d3edf0'),
      sunlight: color3('#fff5db'),
      vegetation: color3('#537d64'),
      coral: color3('#b78f70'),
    },
    markerAlpha: 0.42,
  },
})

export const DEFAULT_THEME_3D_KEY = 'industrial-scada'

export const theme3DFor = (key: string): Theme3DPalette => THEME_3D[key] || THEME_3D[DEFAULT_THEME_3D_KEY]

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

/** Map a replay node (x, y planar, z depth) into Babylon world space. */
export const worldPos = (node: { x: number; y: number; z?: number }): Vector3 =>
  new Vector3(node.x, (node.z ?? 0) * DEPTH_SCALE, node.y)

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
  if (receiver.status === 'ok' || receiver.reason === 'reception_incomplete' || receiver.reason === 'outcome_unreported') return palette.rx
  if (receiver.reason === 'collision_rx_rx') {
    const collisionAt = receiver.collision_start_us ?? receiver.rx_start_us
    return now < collisionAt ? palette.rx : palette.bad
  }
  if (receiver.reason === 'collision_rx_tx') {
    return now < receiver.rx_start_us ? palette.tx : palette.bad
  }
  return palette.bad
}
