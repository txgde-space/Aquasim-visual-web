import { geographic, MERCATOR_LIMIT, tileBounds, type GpsMapInfo } from './geometry'

export interface MapDatabase {
  query(sql: string, params?: (number | string)[]): Promise<unknown[][]>
}
export const readMapInfo = async (db: MapDatabase): Promise<GpsMapInfo> => {
  const metadata = Object.fromEntries((await db.query('SELECT name, value FROM metadata')).map(([k, v]) => [String(k), String(v)]))
  const format = metadata.format?.toLowerCase()
  if (!['png', 'jpg', 'jpeg', 'webp', 'image/png', 'image/jpeg', 'image/webp'].includes(format ?? '')) throw new Error('需要 PNG / JPEG / WebP 栅格 MBTiles；矢量 PBF 底图暂不支持。')
  if (metadata.scheme && metadata.scheme !== 'tms') throw new Error('底图必须使用 MBTiles 标准 TMS 行号。')
  // Seek distinct levels through the tile index instead of scanning every tile/index row.
  const zooms: number[] = []
  let row = (await db.query('SELECT zoom_level FROM tiles ORDER BY zoom_level LIMIT 1'))[0]
  while (row) {
    const z = Number(row[0])
    if (!Number.isInteger(z) || z < 0 || z > 24 || zooms.length >= 25) throw new Error('底图层级无效（0–24）。')
    zooms.push(z)
    row = (await db.query('SELECT zoom_level FROM tiles WHERE zoom_level > ? ORDER BY zoom_level LIMIT 1', [z]))[0]
  }
  if (!zooms.length || zooms.some(z => !Number.isInteger(z) || z < 0 || z > 24)) throw new Error('底图没有有效的瓦片层级（0–24）。')
  let bounds = metadata.bounds?.split(',').map(value => value.trim() ? Number(value) : NaN)
  if (!bounds) {
    const z = zooms[0]!, row = (await db.query('SELECT MIN(tile_column), MAX(tile_column), MIN(tile_row), MAX(tile_row) FROM tiles WHERE zoom_level = ?', [z]))[0]
    if (!row) throw new Error('无法读取底图范围。')
    const nw = tileBounds(z, Number(row[0]), 2 ** z - 1 - Number(row[3]))
    const se = tileBounds(z, Number(row[1]) + 1, 2 ** z - Number(row[2]))
    const a = geographic(nw), b = geographic(se)
    bounds = [a.lon, b.lat, b.lon, a.lat]
  }
  if (bounds.length !== 4 || bounds.some(v => !Number.isFinite(v)) || bounds[0]! < -180 || bounds[2]! > 180 || bounds[1]! < -MERCATOR_LIMIT - 1e-8 || bounds[3]! > MERCATOR_LIMIT + 1e-8 || bounds[0]! >= bounds[2]! || bounds[1]! >= bounds[3]!) throw new Error('底图 bounds 无效，或跨越日期变更线。')
  return { name: metadata.name || 'MBTiles 底图', format: format!, bounds: bounds as GpsMapInfo['bounds'], zooms, attribution: metadata.attribution || '' }
}
export const readTile = async (db: MapDatabase, z: number, x: number, y: number): Promise<Uint8Array | null> => {
  const row = (await db.query('SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1', [z, x, 2 ** z - 1 - y]))[0]?.[0]
  return row instanceof Uint8Array ? row : null
}
