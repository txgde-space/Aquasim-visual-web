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
  },
})
