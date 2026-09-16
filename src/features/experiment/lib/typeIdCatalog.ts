export interface CatalogItem {
  id: string
  typeId: string
  label: string
  source: string
  /**
   * False when the scratch generator has no real branch for this item, i.e.
   * assigning it changes nothing (or emits code known not to work). The
   * drawer greys these out. Calibrated against generateScratch's branches.
   */
  supported?: boolean
}

export interface CatalogLayer {
  id: string
  label: string
  field: string
  scope?: string
  items: CatalogItem[]
}

export const TYPEID_LAYERS: CatalogLayer[] = [
  {
    id: 'phy',
    label: '物理层',
    field: 'phyId',
    items: [
      { id: 'phy-fdm', typeId: 'ns3::AquaSimPhyFDM', label: 'Phy FDM', source: 'src/aqua-sim-tg/model/aqua-sim-phy-FDM.cc' },
      { id: 'phy-cmn', typeId: 'ns3::AquaSimPhyCmn', label: 'Phy Cmn', source: 'src/aqua-sim-tg/model/aqua-sim-phy-cmn.cc' },
    ],
  },
  {
    id: 'mac',
    label: 'MAC',
    field: 'macId',
    items: [
      { id: 'swarm', typeId: 'ns3::AquaSimSwarmM', label: 'Swarm', source: 'src/aqua-sim-tg/model/aqua-sim-mac-swarm-m.cc' },
      { id: 'tdma', typeId: 'ns3::AquaSimTDMA', label: 'TDMA', source: 'src/aqua-sim-tg/model/aqua-sim-mac-TDMA.cc' },
      { id: 'broadcast', typeId: 'ns3::AquaSimBroadcastMac', label: 'Broadcast', source: 'src/aqua-sim-tg/model/aqua-sim-mac-broadcast.cc', supported: false },
      { id: 'aloha', typeId: 'ns3::AquaSimPAloha', label: 'Pure Aloha', source: 'src/aqua-sim-tg/model/aqua-sim-mac-aloha-pure.cc', supported: false },
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
      { id: 'none', typeId: '', label: 'None', source: '' },
      { id: 'traffic-gen', typeId: 'ns3::AquaSimTrafficGen', label: 'Traffic Gen', source: 'src/aqua-sim-tg/model/aqua-sim-traffic-gen.cc', supported: false },
      { id: 'onoff', typeId: 'ns3::OnOffNDApplication', label: 'OnOff ND', source: 'src/aqua-sim-tg/model/ndn/onoff-nd-application.cc', supported: false },
      { id: 'sink', typeId: 'ns3::AquaSimSink', label: 'Sink', source: 'src/aqua-sim-tg/model/aqua-sim-sink.cc', supported: false },
    ],
  },
  {
    id: 'channel',
    label: '信道',
    field: 'channelId',
    scope: 'scene',
    items: [
      { id: 'channel', typeId: 'ns3::AquaSimChannel', label: 'Channel', source: 'src/aqua-sim-tg/model/aqua-sim-channel.cc' },
      { id: 'range', typeId: 'ns3::AquaSimRangePropagation', label: 'Range Propagation', source: 'src/aqua-sim-tg/model/aqua-sim-propagation-range.cc' },
      { id: 'simple', typeId: 'ns3::AquaSimSimplePropagation', label: 'Simple Propagation', source: 'src/aqua-sim-tg/model/aqua-sim-propagation-simple.cc', supported: false },
      { id: 'bellhop', typeId: 'ns3::AquaSimBellhopPropagation', label: 'Bellhop', source: 'src/aqua-sim-tg/model/aqua-sim-propagation-bellhop.cc', supported: false },
    ],
  },
]

export const layerById = (id: string): CatalogLayer | null => TYPEID_LAYERS.find((layer) => layer.id === id) || null

export const catalogItemById = (layerId: string, itemId: string): CatalogItem | null => {
  const layer = layerById(layerId)
  return layer?.items.find((item) => item.id === itemId) || null
}

export const catalogItemByTypeId = (typeId: string): { layer: CatalogLayer; item: CatalogItem } | null => {
  for (const layer of TYPEID_LAYERS) {
    const item = layer.items.find((entry) => entry.typeId === typeId)
    if (item) return { layer, item }
  }
  return null
}

export const AQUA_ITEM_MIME = 'application/x-aqua-item'
