import * as SQLite from 'wa-sqlite'

export interface RandomAccessSource {
  size: number
  read: (offset: number, length: number) => Uint8Array
}
const BLOCK_SIZE = 64 * 1024
const CACHE_BLOCKS = 128

/** Read-only SQLite VFS: offsets remain JS numbers (never signed 32-bit integers). */
export class BlobFileVfs implements SQLiteVFS {
  readonly name = 'mbtiles-file'
  readonly mxPathName = 64
  readonly stats = { bytesRead: 0, reads: 0, maxOffset: 0, cacheBytes: 0 }
  private blocks = new Map<number, Uint8Array>()
  constructor(private source: RandomAccessSource) {}
  xOpen(name: string | null, _fileId: number, flags: number, out: DataView) {
    if (name !== 'map.mbtiles' || !(flags & SQLite.SQLITE_OPEN_MAIN_DB)) return SQLite.SQLITE_CANTOPEN
    out.setInt32(0, SQLite.SQLITE_OPEN_READONLY, true)
    return SQLite.SQLITE_OK
  }
  xRead(_fileId: number, output: Uint8Array, offset: number) {
    if (!Number.isSafeInteger(offset) || offset < 0) return SQLite.SQLITE_IOERR_READ
    try {
      output.fill(0)
      const end = Math.min(offset + output.length, this.source.size)
      for (let pos = offset; pos < end;) {
        const start = Math.floor(pos / BLOCK_SIZE) * BLOCK_SIZE
        let block = this.blocks.get(start)
        if (!block) {
          block = this.source.read(start, Math.min(BLOCK_SIZE, this.source.size - start))
          if (block.length !== Math.min(BLOCK_SIZE, this.source.size - start)) return SQLite.SQLITE_IOERR_SHORT_READ
          this.stats.bytesRead += block.length; this.stats.reads++; this.stats.maxOffset = Math.max(this.stats.maxOffset, start)
          this.stats.cacheBytes += block.length
        } else this.blocks.delete(start)
        this.blocks.set(start, block)
        while (this.blocks.size > CACHE_BLOCKS) {
          const key = this.blocks.keys().next().value!
          this.stats.cacheBytes -= this.blocks.get(key)!.length; this.blocks.delete(key)
        }
        const count = Math.min(end - pos, block.length - (pos - start))
        output.set(block.subarray(pos - start, pos - start + count), pos - offset)
        pos += count
      }
      return end - offset < output.length ? SQLite.SQLITE_IOERR_SHORT_READ : SQLite.SQLITE_OK
    } catch { return SQLite.SQLITE_IOERR_READ }
  }
  xFileSize(_id: number, out: DataView) { out.setBigInt64(0, BigInt(this.source.size), true); return SQLite.SQLITE_OK }
  xClose() { this.blocks.clear(); this.stats.cacheBytes = 0; return SQLite.SQLITE_OK }
  xWrite() { return SQLite.SQLITE_READONLY }
  xTruncate() { return SQLite.SQLITE_READONLY }
  xDelete() { return SQLite.SQLITE_READONLY }
  xSync() { return SQLite.SQLITE_OK }
  xLock() { return SQLite.SQLITE_OK }
  xUnlock() { return SQLite.SQLITE_OK }
  xCheckReservedLock(_id: number, out: DataView) { out.setInt32(0, 0, true); return SQLite.SQLITE_OK }
  xFileControl() { return SQLite.SQLITE_NOTFOUND }
  xDeviceCharacteristics() { return SQLite.SQLITE_IOCAP_IMMUTABLE }
  xSectorSize() { return 4096 }
  xAccess(name: string, flags: number, out: DataView) {
    out.setInt32(0, name === 'map.mbtiles' && flags !== SQLite.SQLITE_ACCESS_READWRITE ? 1 : 0, true)
    return SQLite.SQLITE_OK
  }
}
