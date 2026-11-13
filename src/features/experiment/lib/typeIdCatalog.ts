export interface ProtocolAttribute {
  name: string
  help: string
  valueType: string
  defaultValue: string
  ownerTypeId?: string
  constructible?: boolean
  readable?: boolean
  writable?: boolean
  underlyingType?: string
  pointeeTypeId?: string
}

export interface CatalogItem {
  id: string
  typeId: string
  label: string
  source: string
  field?: string
  attributes?: ProtocolAttribute[]
  requirement?: string
  parentTypeId?: string
  groupName?: string
}

export interface CatalogLayer {
  id: string
  label: string
  field: string
  scope?: string
  items: CatalogItem[]
}

const LAYER_ORDER = ['app', 'routing', 'mac', 'phy', 'channel', 'mobility']

/** One presentation order for discovered catalogs and empty layer navigation. Unknown layers stay stable. */
export const orderCatalogLayers = (layers: readonly CatalogLayer[]): CatalogLayer[] => {
  const rank = (id: string) => { const index = LAYER_ORDER.indexOf(id); return index < 0 ? LAYER_ORDER.length : index }
  return [...layers].sort((a, b) => rank(a.id) - rank(b.id))
}

/** Layer navigation only. Protocol items must come from the selected simulator's probe. */
export const TYPEID_LAYERS: CatalogLayer[] = orderCatalogLayers([
  { id: 'phy', label: '物理层', field: 'phyId', items: [] },
  { id: 'mac', label: 'MAC', field: 'macId', items: [] },
  { id: 'routing', label: '路由', field: 'routingId', items: [] },
  { id: 'app', label: '应用层', field: 'appId', items: [] },
  { id: 'channel', label: '信道', field: 'channelId', scope: 'scene', items: [] },
  { id: 'mobility', label: '移动模型', field: 'mobilityId', scope: 'node', items: [] },
])

/** Optional display labels only: never a source of protocol availability, IDs or attributes. */
export const PROTOCOL_LABELS: Record<string, string> = {
  'ns3::AquaSimPhyFDM': 'Phy FDM',
  'ns3::AquaSimPhyCmn': 'Phy Cmn',
  'ns3::AquaSimPhySimple': 'AquaSim Phy Simple',
  'ns3::AquaSimRadioPhy': '陆地无线电 PHY（理想）',
  'ns3::AquaSimSwarm': 'Swarm',
  'ns3::AquaSimTDMA': 'TDMA',
  'ns3::AquaSimBroadcastMac': 'Broadcast',
  'ns3::AquaSimPAloha': 'Pure Aloha',
  'ns3::AquaSimStaticRouting': 'Static Routing',
  'ns3::AquaSimTrafficGen': 'Traffic Gen',
  'ns3::OnOffNDApplication': 'OnOff ND',
  'ns3::AquaSimChannel': 'Channel',
  'ns3::AquaSimRangePropagation': 'Range Propagation',
  'ns3::AquaSimSimplePropagation': 'Simple Propagation',
  'ns3::AquaSimBellhopPropagation': 'Bellhop',
  'ns3::AquaSimRadioChannel': '陆地无线电信道（理想）',
  'ns3::AquaSimRadioPropagation': '陆地光速传播（理想）',
}

export const layerById = (id: string): CatalogLayer | null => TYPEID_LAYERS.find((layer) => layer.id === id) || null

export const catalogItemById = (layerId: string, itemId: string, layers = TYPEID_LAYERS): CatalogItem | null => {
  const layer = layers.find((layer) => layer.id === layerId)
  return layer?.items.find((item) => item.id === itemId || item.typeId === itemId) || null
}

export const catalogItemByTypeId = (typeId: string): { layer: CatalogLayer; item: CatalogItem } | null => {
  for (const layer of TYPEID_LAYERS) {
    const item = layer.items.find((entry) => entry.typeId === typeId)
    if (item) return { layer, item }
  }
  return null
}

export const AQUA_ITEM_MIME = 'application/x-aqua-item'
