import fs from 'node:fs'
import path from 'node:path'
import type { CatalogItem, CatalogLayer, ProtocolAttribute } from '../src/features/experiment/lib/typeIdCatalog'
import { TYPEID_LAYERS } from '../src/features/experiment/lib/typeIdCatalog'

export const catalogProbe = fs.readFileSync(new URL('./templates/typeidCatalog.cc', import.meta.url), 'utf8')
const catalogs = new Map<string, { signature: string; layers: CatalogLayer[] }>()
export const invalidateCatalog = (home: string) => { catalogs.delete(home) }
const signature = (home: string) => {
  const lib = path.join(home, 'build/lib')
  try {
    return fs.readdirSync(lib).filter((name) => name.includes('aqua-sim')).map((name) => {
      const stat = fs.statSync(path.join(lib, name)); return `${name}:${stat.size}:${stat.mtimeMs}`
    }).join('|')
  } catch { return '' }
}
export const cachedCatalog = (home: string) => {
  const cached = catalogs.get(home)
  return cached?.signature === signature(home) ? cached.layers : null
}

export const saveCatalog = (home: string, stdout: string): CatalogLayer[] => {
  const match = stdout.match(/AQUASIM_CATALOG_BEGIN\s*([\s\S]*?)\s*AQUASIM_CATALOG_END/)
  if (!match) throw new Error('未能读取 ns-3 注册协议，请查看编译输出')
  const rows = JSON.parse(match[1]) as Array<{ layer: string; typeId: string; attributes: ProtocolAttribute[] }>
  const layers: CatalogLayer[] = TYPEID_LAYERS.map((layer) => ({ ...layer, items: layer.id === 'app' ? [{ id: 'none', typeId: '', label: '无独立应用', source: '' }] : [] }))
  for (const row of rows) {
    const layer = layers.find((item) => item.id === (row.layer === 'propagation' ? 'channel' : row.layer))
    if (!layer || !/^ns3::[A-Za-z0-9_:]+$/.test(row.typeId)) continue
    const known = TYPEID_LAYERS.flatMap((item) => item.items).find((item) => item.typeId === row.typeId)
    const item: CatalogItem = {
      id: known?.id || row.typeId, typeId: row.typeId,
      label: known?.label || row.typeId.replace('ns3::', ''), source: known?.source || '',
      field: row.layer === 'propagation' ? 'propagationId' : layer.field,
      attributes: row.attributes,
      requirement: row.typeId.includes('Bellhop') ? '需要所选目录内的 Bellhop 可执行程序和环境文件。'
        : row.typeId === 'ns3::AquaSimPhyModem' ? '需要真实串口调制解调器；在协议属性中设置 devName。' : '',
    }
    layer.items.push(item)
  }
  if (!layers.find((layer) => layer.id === 'mac')?.items.length) throw new Error('当前 ns-3 未注册可用的 Aqua-Sim MAC')
  catalogs.set(home, { signature: signature(home), layers })
  return layers
}
