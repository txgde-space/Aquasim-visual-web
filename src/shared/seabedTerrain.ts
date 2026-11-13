/** Deterministic bathymetry in metres; independent of node placement and playback time. */
export const SEABED_LEVEL_METERS = -10000
export const SEABED_RELIEF_METERS = 2200

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
const hash = (x: number, y: number): number => {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 7919
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}
const noise = (x: number, y: number): number => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy)
  const a = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx
  const b = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx
  return (a * (1 - fy) + b * fy) * 2 - 1
}
const fbm = (x: number, y: number): number => {
  let value = 0, amplitude = 0.55
  for (let octave = 0; octave < 5; octave++) {
    value += noise(x, y) * amplitude
    const nx = x * 1.72 - y * 1.13 + 17.3
    y = x * 1.13 + y * 1.72 - 9.7; x = nx; amplitude *= 0.48
  }
  return value
}

export const seabedElevationMeters = (x: number, y: number): number => {
  // Low-frequency domain warping breaks up parallel/repeating bands.
  const wx = x + fbm(x / 11000 + 8, y / 11000) * 1800
  const wy = y + fbm(x / 10000 - 3, y / 10000 + 7) * 1800
  const broad = fbm(wx / 6500, wy / 6500)
  const rough = fbm(wx / 1300 + 13, wy / 1300 - 8)
  const ridge = Math.pow(1 - Math.abs(noise(wx / 4200, wy / 4200)), 3)
  const trenchAxis = wx + 2500 + Math.sin(wy / 5200) * 2300 + noise(wy / 3300, 4) * 600
  const trench = Math.exp(-Math.pow(trenchAxis / 1200, 2))
  const relief = Math.max(-1, Math.min(1, broad * 0.65 + rough * 0.18 + ridge * 0.5 - trench * 0.95 - 0.1))
  return SEABED_LEVEL_METERS + relief * SEABED_RELIEF_METERS
}
