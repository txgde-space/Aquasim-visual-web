import { RADIO_TYPE_IDS } from './radioEnvironment'

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

const LAYER_ORDER = ['app', 'routing', 'mac', 'phy', 'channel']

/** One presentation order for both discovered and placeholder catalogs. Unknown layers stay stable. */
export const orderCatalogLayers = (layers: readonly CatalogLayer[]): CatalogLayer[] => {
  const rank = (id: string) => { const index = LAYER_ORDER.indexOf(id); return index < 0 ? LAYER_ORDER.length : index }
  return [...layers].sort((a, b) => rank(a.id) - rank(b.id))
}

export const TYPEID_LAYERS: CatalogLayer[] = orderCatalogLayers([
  {
    id: 'phy',
    label: '物理层',
    field: 'phyId',
    items: [
      { id: 'phy-fdm', typeId: 'ns3::AquaSimPhyFDM', label: 'Phy FDM', source: 'src/aqua-sim-tg/model/aqua-sim-phy-FDM.cc' },
      { id: 'phy-cmn', typeId: 'ns3::AquaSimPhyCmn', label: 'Phy Cmn', source: 'src/aqua-sim-tg/model/aqua-sim-phy-cmn.cc' },
      { id: 'phy-radio', typeId: RADIO_TYPE_IDS.phy, label: '陆地无线电 PHY（理想）', source: 'builtin/terrestrial-radio.cc', requirement: '理想通用无线电，保留现有 MAC 与应用；参数以已注册属性为准。' },
    ],
  },
  {
    id: 'mac',
    label: 'MAC',
    field: 'macId',
    items: [
      { id: 'swarm', typeId: 'ns3::AquaSimSwarm', label: 'Swarm', source: 'src/aqua-sim-tg/model/aqua-sim-mac-swarm.cc' },
      { id: 'tdma', typeId: 'ns3::AquaSimTDMA', label: 'TDMA', source: 'src/aqua-sim-tg/model/aqua-sim-mac-TDMA.cc' },
      { id: 'broadcast', typeId: 'ns3::AquaSimBroadcastMac', label: 'Broadcast', source: 'src/aqua-sim-tg/model/aqua-sim-mac-broadcast.cc' },
      { id: 'aloha', typeId: 'ns3::AquaSimPAloha', label: 'Pure Aloha', source: 'src/aqua-sim-tg/model/aqua-sim-mac-aloha-pure.cc' },
    ],
  },
  {
    id: 'routing',
    label: '路由',
    field: 'routingId',
    items: [
      { id: 'static', typeId: 'ns3::AquaSimStaticRouting', label: 'Static Routing', source: 'src/aqua-sim-tg/model/aqua-sim-routing-static.cc' },
    ],
  },
  {
    id: 'app',
    label: '应用层',
    field: 'appId',
    items: [
      { id: 'none', typeId: '', label: '无独立应用', source: '' },
      { id: 'traffic-gen', typeId: 'ns3::AquaSimTrafficGen', label: 'Traffic Gen', source: 'src/aqua-sim-tg/model/aqua-sim-traffic-gen.cc' },
      { id: 'onoff', typeId: 'ns3::OnOffNDApplication', label: 'OnOff ND', source: 'src/aqua-sim-tg/model/ndn/onoff-nd-application.cc' },
    ],
  },
  {
    id: 'channel',
    label: '信道',
    field: 'channelId',
    scope: 'scene',
    items: [
      { id: 'channel', typeId: 'ns3::AquaSimChannel', label: 'Channel', source: 'src/aqua-sim-tg/model/aqua-sim-channel.cc' },
      { id: 'range', typeId: 'ns3::AquaSimRangePropagation', label: 'Range Propagation', source: 'src/aqua-sim-tg/model/aqua-sim-propagation-range.cc', field: 'propagationId' },
      { id: 'simple', typeId: 'ns3::AquaSimSimplePropagation', label: 'Simple Propagation', field: 'propagationId', source: 'src/aqua-sim-tg/model/aqua-sim-propagation-simple.cc' },
      { id: 'bellhop', typeId: 'ns3::AquaSimBellhopPropagation', label: 'Bellhop', field: 'propagationId', source: 'src/aqua-sim-tg/model/aqua-sim-propagation-bellhop.cc' },
      { id: 'radio-channel', typeId: RADIO_TYPE_IDS.channel, label: '陆地无线电信道（理想）', source: 'builtin/terrestrial-radio.cc', requirement: '独立选择信道与传播模型；通信范围内理想传输，保持半双工和碰撞行为。' },
      { id: 'radio-propagation', typeId: RADIO_TYPE_IDS.propagation, label: '陆地光速传播（理想）', field: 'propagationId', source: 'builtin/terrestrial-radio.cc', requirement: '以光速传播，通信范围内不计算路径损耗或随机误码；不是完整 Wi-Fi 标准模型。' },
    ],
  },
])

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
