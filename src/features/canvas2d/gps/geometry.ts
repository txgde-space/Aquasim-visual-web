import type { Bounds, Projection } from '../lib/coordinate'

export const EARTH_RADIUS = 6378137
export const MERCATOR_LIMIT = 85.0511287798066
const DEG = Math.PI / 180
const E2 = 6.6943799901413165e-3
const B = EARTH_RADIUS * Math.sqrt(1 - E2)
export interface GeoPoint { lon: number; lat: number }
export interface XY { x: number; y: number }
export interface GpsMapInfo {
  name: string
  format: string
  bounds: [number, number, number, number]
  zooms: number[]
  attribution: string
}
export const mercator = ({ lon, lat }: GeoPoint): XY => ({ x: EARTH_RADIUS * lon * DEG, y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2)) })
export const geographic = ({ x, y }: XY): GeoPoint => ({ lon: x / EARTH_RADIUS / DEG, lat: (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) / DEG })
const frame = ({ lon, lat }: GeoPoint) => {
  const l = lon * DEG, p = lat * DEG, c = Math.cos(p), s = Math.sin(p)
  const n = EARTH_RADIUS / Math.sqrt(1 - E2 * s * s)
  return { o: [n * c * Math.cos(l), n * c * Math.sin(l), n * (1 - E2) * s],
    e: [-Math.sin(l), Math.cos(l), 0], n: [-s * Math.cos(l), -s * Math.sin(l), c], u: [c * Math.cos(l), c * Math.sin(l), s] }
}
/** WGS84 surface coordinates in a local east/north metric frame. Z remains simulation depth. */
export const geoToLocal = (point: GeoPoint, origin: GeoPoint): XY => {
  const f = frame(origin), p = frame(point).o, d = p.map((v, i) => v - f.o[i]!)
  return { x: d.reduce((sum, v, i) => sum + v * f.e[i]!, 0), y: d.reduce((sum, v, i) => sum + v * f.n[i]!, 0) }
}
/** Intersect the origin's up-axis through EN with the WGS84 ellipsoid (near hemisphere). */
export const localToGeo = ({ x, y }: XY, origin: GeoPoint): GeoPoint => {
  const f = frame(origin), p = f.o.map((v, i) => v + x * f.e[i]! + y * f.n[i]!)
  const q = [1 / EARTH_RADIUS ** 2, 1 / EARTH_RADIUS ** 2, 1 / B ** 2]
  const a = f.u.reduce((sum, v, i) => sum + v * v * q[i]!, 0)
  const b = 2 * p.reduce((sum, v, i) => sum + v * f.u[i]! * q[i]!, 0)
  const c = p.reduce((sum, v, i) => sum + v * v * q[i]!, 0) - 1
  const disc = b * b - 4 * a * c
  if (disc < 0) return { lon: NaN, lat: NaN }
  const up = -2 * c / (b + Math.sqrt(disc))
  const [ex, ey, ez] = p.map((v, i) => v + up * f.u[i]!) as [number, number, number]
  return { lon: Math.atan2(ey, ex) / DEG, lat: Math.atan2(ez, Math.hypot(ex, ey) * (1 - E2)) / DEG }
}
export const projectedBounds = (b: GpsMapInfo['bounds']): Bounds => {
  const sw = mercator({ lon: b[0], lat: b[1] }), ne = mercator({ lon: b[2], lat: b[3] })
  return { minX: sw.x, maxX: ne.x, minY: sw.y, maxY: ne.y, spanX: ne.x - sw.x, spanY: ne.y - sw.y }
}
export const constrainMapPan = (pan: XY, proj: Projection, width: number, height: number): XY => {
  const clamp = (v: number, size: number, span: number, offset: number) => span < size ? (size - span) / 2 - offset : Math.min(-offset, Math.max(size - span - offset, v))
  return { x: clamp(pan.x, width, proj.bounds.spanX * proj.scale, proj.origin.x), y: clamp(pan.y, height, proj.bounds.spanY * proj.scale, proj.origin.y) }
}
/** Horizontal ground scale on the WGS84 ellipsoid at the requested latitude. */
export const groundResolution = (scale: number, lat: number) => Math.cos(lat * DEG) / Math.sqrt(1 - E2 * Math.sin(lat * DEG) ** 2) / scale
export const niceScaleBar = (metersPerPixel: number) => {
  const target = metersPerPixel * 90, power = 10 ** Math.floor(Math.log10(target))
  const meters = [1, 2, 5, 10].map(v => v * power).filter(v => v <= target).at(-1) ?? power
  return { width: meters / metersPerPixel, label: meters >= 1000 ? `${Number((meters / 1000).toPrecision(3))} km` : `${Number(meters.toPrecision(3))} m`, meters }
}
export const tileBounds = (z: number, x: number, y: number) => {
  const span = 2 * Math.PI * EARTH_RADIUS / 2 ** z
  return { x: -Math.PI * EARTH_RADIUS + x * span, y: Math.PI * EARTH_RADIUS - y * span, span }
}
export const visibleTiles = (proj: Projection, width: number, height: number, zooms: number[]) => {
  const desired = Math.log2(2 * Math.PI * EARTH_RADIUS * proj.scale / 256)
  let z = zooms.reduce((best, v) => Math.abs(v - desired) < Math.abs(best - desired) ? v : best, zooms[0]!)
  const range = (level: number) => {
    const n = 2 ** level, span = 2 * Math.PI * EARTH_RADIUS / n
    const left = proj.bounds.minX - (proj.origin.x + proj.pan.x) / proj.scale
    const top = proj.bounds.maxY + (proj.origin.y + proj.pan.y) / proj.scale
    return { x0: Math.max(0, Math.floor((left + Math.PI * EARTH_RADIUS) / span)), x1: Math.min(n - 1, Math.floor((left + width / proj.scale + Math.PI * EARTH_RADIUS) / span)), y0: Math.max(0, Math.floor((Math.PI * EARTH_RADIUS - top) / span)), y1: Math.min(n - 1, Math.floor((Math.PI * EARTH_RADIUS - top + height / proj.scale) / span)) }
  }
  let r = range(z)
  while ((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1) > 256 && zooms.some(v => v < z)) { z = zooms.filter(v => v < z).at(-1)!; r = range(z) }
  const tiles: { z: number; x: number; y: number; key: string }[] = []
  for (let y = r.y0; y <= r.y1 && tiles.length < 256; y++) for (let x = r.x0; x <= r.x1 && tiles.length < 256; x++) tiles.push({ z, x, y, key: `${z}/${x}/${y}` })
  return tiles
}

/** Fit without exposing outside the file; files without overview levels need a bounded tile budget. */
export const minimumMapScale = (bounds: Bounds, width: number, height: number, minTileZoom: number) => Math.max(
  width / bounds.spanX, height / bounds.spanY,
  Math.max(width, height) * 2 ** minTileZoom / (12 * 2 * Math.PI * EARTH_RADIUS),
)
export const supportsLocalFrame = (bounds: GpsMapInfo['bounds'], origin: GeoPoint) => {
  const f = frame(origin)
  return [bounds[0], bounds[2]].every(lon => [bounds[1], bounds[3]].every(lat => {
    const normal = frame({ lon, lat }).u
    return normal.reduce((sum, v, i) => sum + v * f.u[i]!, 0) > 0.1
  }))
}
