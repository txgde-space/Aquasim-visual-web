import assert from 'node:assert/strict'
import initSqlJs from 'sql.js'
import SQLiteFactory from 'wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from 'wa-sqlite'
import { readFileSync } from 'node:fs'

export async function checkGpsMap(server) {
  const g = await server.ssrLoadModule('/src/features/canvas2d/gps/geometry.ts')
  const { BlobFileVfs } = await server.ssrLoadModule('/src/features/canvas2d/gps/blobVfs.ts')
  const { readMapInfo, readTile } = await server.ssrLoadModule('/src/features/canvas2d/gps/mbtiles.ts')
  const { toScreenPoint, toWorldPoint } = await server.ssrLoadModule('/src/features/canvas2d/lib/coordinate.ts')
  const { useCanvasView } = await server.ssrLoadModule('/src/features/canvas2d/composables/useCanvasView.ts')
  const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)
  for (const origin of [{ lon: 111.5, lat: 32.5 }, { lon: 0, lat: 0 }, { lon: -75, lat: 70 }]) {
    for (const point of [{ x: 0, y: 0 }, { x: 1000, y: -1500 }, { x: -30000, y: 20000 }]) {
      const geo = g.localToGeo(point, origin), local = g.geoToLocal(geo, origin)
      close(local.x, point.x); close(local.y, point.y)
    }
    const base = g.mercator(origin), east = g.mercator(g.localToGeo({ x: 100, y: 0 }, origin))
    close((east.x - base.x) * g.groundResolution(1, origin.lat), 100, 0.0001)
  }
  // Independent WGS84 equator reference: one degree east projected into the tangent plane.
  close(g.geoToLocal({ lon: 1, lat: 0 }, { lon: 0, lat: 0 }).x, 111313.83923667614, 1e-6)
  const info = { bounds: [111.45, 32.45, 111.55, 32.55], zooms: [12, 14, 16] }
  const b = g.projectedBounds(info.bounds), origin = { lon: 111.5, lat: 32.5 }
  const proj = { bounds: b, origin: { x: 0, y: 0 }, scale: .2, pan: { x: 0, y: 0 }, geoOrigin: origin }
  for (const point of [{ x: 0, y: 0 }, { x: 1234, y: -3456 }]) {
    const screen = toScreenPoint(point.x, point.y, proj), result = toWorldPoint(screen.x, screen.y, proj)
    close(result.x, point.x); close(result.y, point.y)
  }
  for (const pan of [{ x: 1e9, y: -1e9 }, { x: -1e9, y: 1e9 }]) {
    const constrained = g.constrainMapPan(pan, proj, 900, 500)
    assert.ok(constrained.x <= 0 && constrained.y <= 0)
    assert.ok(constrained.x + b.spanX * proj.scale >= 900 - 1e-8)
    assert.ok(constrained.y + b.spanY * proj.scale >= 500 - 1e-8)
  }
  let view
  const getProjection = () => ({ ...proj, scale: .1 * view.zoom.value, pan: view.pan.value })
  view = useCanvasView({ getProjection, getBaseScale: () => .1, getCanvasEl: () => null, scheduleDraw() {}, getZoomLimits: () => ({ min: 1, max: 100 }) })
  const anchor = toWorldPoint(450, 250, getProjection())
  view.setZoomAt(3, 450, 250)
  const after = toWorldPoint(450, 250, getProjection())
  close(anchor.x, after.x); close(anchor.y, after.y)
  view.setZoomAt(.001, 450, 250); assert.equal(view.zoom.value, 1)
  view.setZoomAt(1000, 450, 250); assert.equal(view.zoom.value, 100)
  const low = g.niceScaleBar(g.groundResolution(.1, 0)), high = g.niceScaleBar(g.groundResolution(.1, 60))
  assert.ok(high.meters < low.meters, 'ground scale compensates for latitude')
  const sparseScale = g.minimumMapScale(b, 1440, 1000, 22)
  assert.ok(g.visibleTiles({ ...proj, scale: sparseScale }, 1440, 1000, [22]).length < 256, 'no overview files stay within visible tile budget')
  assert.equal(g.supportsLocalFrame(info.bounds, origin), true)
  assert.equal(g.supportsLocalFrame([-170, -80, 170, 80], origin), false)
  const tiles = g.visibleTiles(proj, 900, 500, info.zooms)
  assert.ok(tiles.length > 0 && tiles.length <= 256)
  assert.ok(tiles.every(t => info.zooms.includes(t.z)))

  const SQL = await initSqlJs(), db = new SQL.Database()
  const source = { query: async (sql, params) => db.exec(sql, params)[0]?.values ?? [] }
  try {
    db.run('CREATE TABLE metadata(name TEXT, value TEXT); CREATE TABLE raw_tiles(zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB); CREATE VIEW tiles AS SELECT * FROM raw_tiles;')
    db.run("INSERT INTO metadata VALUES ('name','Fixture'),('format','png'),('bounds','111.45,32.45,111.55,32.55')")
    db.run('INSERT INTO raw_tiles VALUES (?, ?, ?, ?)', [14, 13265, 9757, new Uint8Array([1, 2, 3])])
    assert.deepEqual((await readMapInfo(source)).zooms, [14])
    assert.deepEqual([...await readTile(source, 14, 13265, 2 ** 14 - 1 - 9757)], [1, 2, 3], 'TMS row flips exactly once')
    assert.equal(await readTile(source, 14, 13265, 9757), null)
    // Exercise the same SQLite engine and VFS used in the browser, including views.
    const bytes = db.export()
    const sqlite = SQLite.Factory(await SQLiteFactory({ wasmBinary: readFileSync(new URL('../../node_modules/wa-sqlite/dist/wa-sqlite.wasm', import.meta.url)) }))
    const vfs = new BlobFileVfs({ size: bytes.length, read: (offset, length) => bytes.slice(offset, offset + length) })
    sqlite.vfs_register(vfs)
    const handle = await sqlite.open_v2('map.mbtiles', SQLite.SQLITE_OPEN_READONLY, vfs.name)
    try {
      const fileDb = { query: async (sql, params) => (await sqlite.execWithParams(handle, sql, params)).rows }
      assert.deepEqual((await readMapInfo(fileDb)).zooms, [14])
      assert.deepEqual([...await readTile(fileDb, 14, 13265, 2 ** 14 - 1 - 9757)], [1, 2, 3])
      await assert.rejects(() => sqlite.exec(handle, 'DELETE FROM tiles'))
    } finally { await sqlite.close(handle) }
    db.run("UPDATE metadata SET value='pbf'  WHERE name='format'")
    await assert.rejects(() => readMapInfo(source), /PBF/)
    db.run("UPDATE metadata SET value='png' WHERE name='format'; UPDATE metadata SET value='bad' WHERE name='bounds'")
    await assert.rejects(() => readMapInfo(source), /bounds/)
    db.run("DELETE FROM metadata WHERE name='bounds'")
    assert.ok((await readMapInfo(source)).bounds.every(Number.isFinite), 'derive coverage from actual tiles when metadata omits bounds')
    db.run('DELETE FROM raw_tiles')
    await assert.rejects(() => readMapInfo(source), /层级/)
  } finally { db.close() }
  // Reads beyond both 2 GiB and 4 GiB must never wrap via JS bitwise arithmetic.
  const offsets = []
  const large = new BlobFileVfs({ size: 5 * 1024 ** 3 + 7, read: (offset, length) => {
    offsets.push(offset); return new Uint8Array(length).fill(Math.floor(offset / 2 ** 32) + 11)
  } })
  const output = new Uint8Array(10)
  assert.equal(large.xRead(1, output, 2 ** 32 + 123), SQLite.SQLITE_OK)
  assert.equal(output[0], 12); assert.equal(offsets[0], 2 ** 32)
  assert.equal(large.xRead(1, output, 2 ** 31 + 123), SQLite.SQLITE_OK)
  assert.equal(output[0], 11); assert.equal(offsets[1], 2 ** 31)
  const size = new DataView(new ArrayBuffer(8)); large.xFileSize(1, size)
  assert.equal(size.getBigInt64(0, true), BigInt(5 * 1024 ** 3 + 7))
  for (let i = 0; i < 150; i++) large.xRead(1, output, i * 65536)
  assert.ok(large.stats.cacheBytes <= 8 * 1024 ** 2)
  assert.equal(large.xRead(1, output, 5 * 1024 ** 3 + 5), SQLite.SQLITE_IOERR_SHORT_READ)
  assert.deepEqual([...output.slice(2)], Array(8).fill(0))
  assert.equal(large.xWrite(), SQLite.SQLITE_READONLY)
  large.xClose(); assert.equal(large.stats.cacheBytes, 0)
  console.log('GPS map regressions passed: WGS84 metric frame, geographic projection round trips, latitude-aware scale, zoom anchor/limits, pan bounds, MBTiles views, TMS rows and malformed metadata.')
}
