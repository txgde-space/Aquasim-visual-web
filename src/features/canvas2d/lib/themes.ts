export interface NodeModelPalette {
  edge: string
  shadow: string
  metalLight: string
  metal: string
  metalDark: string
  graphiteLight: string
  graphite: string
  graphiteDark: string
  yellowLight: string
  yellow: string
  yellowDark: string
  orangeLight: string
  orange: string
  orangeDark: string
  whiteLight: string
  white: string
  whiteDark: string
  deck: string
  glass: string
  glassLight: string
  solar: string
  solarGrid: string
}

export interface ThemeProfile {
  effect: string
  bg: readonly string[]
  tx: string
  rx: string
  bad: string
  idleInner: string
  idleOuter: string
  nodeStroke: string
  lane: string
  sweep: string
  ring: string
  particle: string
  label: string
  depth: string
  rangeStroke: string
  rangeFill: string
  rangeClear: string
  model: NodeModelPalette
}

export const THEME_PROFILES: Readonly<Record<string, ThemeProfile>> = Object.freeze({
  'industrial-scada': {
    effect: 'scanline',
    bg: ['#1f2937', '#111827', '#0b1220'],
    tx: '#f97316',
    rx: '#14b8a6',
    bad: '#ef4444',
    idleInner: '#67e8f9',
    idleOuter: '#0369a1',
    nodeStroke: 'rgba(165, 243, 252, 0.5)',
    lane: 'rgba(148, 163, 184, 0.24)',
    sweep: 'rgba(45, 212, 191, 0.06)',
    ring: 'rgba(45, 212, 191, 0.22)',
    particle: 'rgba(153, 246, 228, 0.45)',
    label: '#ccfbf1',
    depth: 'rgba(153, 246, 228, 0.62)',
    rangeStroke: '#2dd4bf',
    rangeFill: '#14b8a6',
    rangeClear: 'rgba(20, 184, 166, 0)',
    model: {
      edge: '#18252c', shadow: 'rgba(5, 13, 19, 0.42)',
      metalLight: '#d8dfe0', metal: '#87969b', metalDark: '#4d5d65',
      graphiteLight: '#596a72', graphite: '#303e45', graphiteDark: '#18242b',
      yellowLight: '#f3d775', yellow: '#dcae28', yellowDark: '#8d681a',
      orangeLight: '#f2b457', orange: '#ce6f28', orangeDark: '#8c411c',
      whiteLight: '#eef0e9', white: '#c6cecc', whiteDark: '#879598',
      deck: '#737f81', glass: '#172c36', glassLight: '#476574',
      solar: '#203747', solarGrid: '#627d88',
    },
  },
})
