import SQLiteFactory from 'wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from 'wa-sqlite'
import wasmUrl from 'wa-sqlite/dist/wa-sqlite.wasm?url'
import { BlobFileVfs } from './blobVfs'
import { readMapInfo, readTile, type MapDatabase } from './mbtiles'

// FileReaderSync is only available in workers; do not add WebWorker globals to app tsconfig.
declare const FileReaderSync: { new(): { readAsArrayBuffer(blob: Blob): ArrayBuffer } }
let db: MapDatabase | null = null
let vfs: BlobFileVfs | null = null
let queue = Promise.resolve()

const handle = async (data: { type: string; file?: File; tiles?: { z: number; x: number; y: number; key: string }[] }) => {
  try {
    if (data.type === 'open' && data.file) {
      const file = data.file, reader = new FileReaderSync()
      const module = await SQLiteFactory({ locateFile: () => wasmUrl })
      const sqlite = SQLite.Factory(module)
      vfs = new BlobFileVfs({ size: file.size, read: (offset, length) => new Uint8Array(reader.readAsArrayBuffer(file.slice(offset, offset + length))) })
      sqlite.vfs_register(vfs)
      const handle = await sqlite.open_v2('map.mbtiles', SQLite.SQLITE_OPEN_READONLY, vfs.name)
      sqlite.limit(handle, SQLite.SQLITE_LIMIT_LENGTH, 32 * 1024 * 1024)
      await sqlite.exec(handle, 'PRAGMA cache_size=-8192; PRAGMA mmap_size=0; PRAGMA temp_store=MEMORY; PRAGMA query_only=ON;')
      db = {
        query: async (sql, params = []) => {
          const deadline = performance.now() + 15000
          sqlite.progress_handler(handle, 10000, () => performance.now() > deadline ? 1 : 0, null)
          try { return (await sqlite.execWithParams(handle, sql, params)).rows }
          finally { sqlite.progress_handler(handle, 0, () => 0, null) }
        },
      }
      const info = await readMapInfo(db)
      self.postMessage({ type: 'ready', info, stats: vfs.stats })
    } else if (data.type === 'tiles' && db && data.tiles) {
      // Stream one tile at a time: a large batch must not accumulate decoded/blob data.
      for (const { z, x, y, key } of data.tiles) {
        const bytes = await readTile(db, z, x, y)
        self.postMessage({ type: 'tiles', tiles: [{ key, bytes }], stats: vfs?.stats }, { transfer: bytes ? [bytes.buffer as ArrayBuffer] : [] })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    self.postMessage({ type: 'error', keys: data.tiles?.map(t => t.key), message: /interrupted/i.test(message)
      ? '查询超时，请检查底图的瓦片索引是否完整。' : /disk I\/O/i.test(message)
        ? '文件读取失败；若底图已被移动、替换或仍在写入，请完成后重新选择。' : message })
  }
}
// The WASM API is async even for a synchronous VFS. Serialize statements across messages.
self.onmessage = ({ data }) => { queue = queue.then(() => handle(data)) }
