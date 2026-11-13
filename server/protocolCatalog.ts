import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { CatalogItem, CatalogLayer, ProtocolAttribute } from '../src/features/experiment/lib/typeIdCatalog'
import { PROTOCOL_LABELS, TYPEID_LAYERS } from '../src/features/experiment/lib/typeIdCatalog'
import { BUILTIN_PROTOCOL_CC } from '../src/features/experiment/lib/builtinProtocols'

export const catalogProbe = `${BUILTIN_PROTOCOL_CC}\n${fs.readFileSync(new URL('./templates/typeidCatalog.cc', import.meta.url), 'utf8')}`
const probeSignature = createHash('sha256').update(catalogProbe).digest('hex')
const catalogs = new Map<string, { signature: string; layers: CatalogLayer[] }>()
export const invalidateCatalog = (home: string) => { catalogs.delete(home) }
export const catalogSignature = (home: string) => {
  const lib = path.join(home, 'build/lib')
  try {
    return `${probeSignature}|${fs.readdirSync(lib).filter((name) => /\.(?:a|dylib|dll|so(?:\.\d+)*)$/.test(name)).sort().map((name) => {
      const stat = fs.statSync(path.join(lib, name)); return `${name}:${stat.size}:${stat.mtimeMs}`
    }).join('|')}`
  } catch { return probeSignature }
}
export const cachedCatalog = (home: string) => {
  const cached = catalogs.get(home)
  return cached?.signature === catalogSignature(home) ? cached.layers : null
}

export const saveCatalog = (home: string, stdout: string): CatalogLayer[] => {
  const match = stdout.match(/AQUASIM_CATALOG_BEGIN\s*([\s\S]*?)\s*AQUASIM_CATALOG_END/)
  if (!match) throw new Error('未能读取 ns-3 注册协议，请查看编译输出')
  const rows = JSON.parse(match[1]) as Array<{ layer: string; typeId: string; parentTypeId?: string; groupName?: string; attributes: ProtocolAttribute[] }>
  const layers: CatalogLayer[] = TYPEID_LAYERS.map((layer) => ({ ...layer, items: layer.id === 'app' ? [{ id: 'none', typeId: '', label: '无独立应用', source: '' }] : [] }))
  for (const row of rows) {
    const layer = layers.find((item) => item.id === (row.layer === 'propagation' ? 'channel' : row.layer))
    if (!layer || !/^ns3::[A-Za-z0-9_:]+$/.test(row.typeId)) continue
    const item: CatalogItem = {
      id: row.typeId, typeId: row.typeId,
      label: PROTOCOL_LABELS[row.typeId] || row.typeId.replace('ns3::', ''), source: '',
      field: row.layer === 'propagation' ? 'propagationId' : layer.field,
      attributes: row.attributes,
      parentTypeId: row.parentTypeId,
      groupName: row.groupName,
    }
    layer.items.push(item)
  }
  if (!layers.find((layer) => layer.id === 'mac')?.items.length) throw new Error('当前 ns-3 未注册可用的 Aqua-Sim MAC')
  catalogs.set(home, { signature: catalogSignature(home), layers })
  return layers
}

export const restoreCatalog = (home: string, layers: CatalogLayer[]) => {
  catalogs.set(home, { signature: catalogSignature(home), layers })
}
