import type {
  ExperimentForm,
  ExperimentNodeSpec,
  ExperimentSpec,
  TopologyNode,
  ValidationWarning,
} from '../../../shared/types/experiment'
import { catalogItemById, TYPEID_LAYERS, type CatalogLayer } from './typeIdCatalog'
import { experimentTimeIssues, MIN_NODE_COUNT, topologyIssues } from './experimentValidation'
import { protocolMetadataIssues } from './protocolMetadata'

export { MIN_NODE_COUNT, MAX_NODE_COUNT, MIN_NODE_ID, MAX_NODE_ID } from './experimentValidation'

export const createDefaultTopology = (count = 5, spacing = 1000): TopologyNode[] => (
  Array.from({ length: count }, (_, index) => ({
    node_id: index + 1,
    name: `Node-${index + 1}`,
    x: spacing * index,
    y: 0,
    z: 0,
    role: 'node',
    phyId: 'ns3::AquaSimPhyFDM',
    macId: 'ns3::AquaSimSwarm',
    routingId: 'ns3::AquaSimStaticRouting',
    appId: 'none',
  }))
)

/** Missing overrides use the simulator's registered defaults. */
export const createDefaultProtocolAttributes = (): NonNullable<ExperimentForm['protocolAttributes']> => ({})

export const createDefaultExperimentForm = (): ExperimentForm => ({
  macId: 'ns3::AquaSimSwarm',
  phyId: 'ns3::AquaSimPhyFDM',
  routingId: 'ns3::AquaSimStaticRouting',
  channelId: 'ns3::AquaSimChannel',
  propagationId: 'ns3::AquaSimRangePropagation',
  simStop: '30s',
  txPower: 1.1,
  protocolAttributes: createDefaultProtocolAttributes(),

})

const roundCoord = (value: unknown): number => Math.round((Number(value) || 0) * 100) / 100

// Resolve only the supplied catalog. Unknown selections remain available for correction.
const typeOf = (layerId: string, itemId: string, layers = TYPEID_LAYERS): string =>
  itemId === 'none' && layerId === 'app' ? '' : catalogItemById(layerId, itemId, layers)?.typeId ?? itemId

export const nodesToSpec = (nodes: TopologyNode[] | undefined, layers = TYPEID_LAYERS): ExperimentNodeSpec[] => (
  (nodes || []).map((node) => ({
    id: Number(node.node_id),
    name: node.name || `Node-${node.node_id}`,
    x: roundCoord(node.x),
    y: roundCoord(node.y),
    z: roundCoord(node.z),
    role: node.role || 'node',
    app: typeOf('app', node.appId || 'none', layers),
    appAttrs: node.appAttrs,
    appDestination: node.appDestination,
  }))
)

export const buildExperimentSpec = (form: ExperimentForm, nodes: TopologyNode[], layers: CatalogLayer[] = TYPEID_LAYERS): ExperimentSpec => {
  const nodeList = nodesToSpec(nodes, layers)
  const { macId, phyId, routingId } = form

  return {
    schema: 'aqua-sim-experiment/v0',
    protocolAttributes: form.protocolAttributes || {},
    simStop: form.simStop,
    channel: {
      type: typeOf('channel', form.channelId, layers),
      propagation: typeOf('channel', form.propagationId, layers),
    },
    stack: {
      phy: {
        type: typeOf('phy', phyId, layers),
        attrs: {
          // Retain the unused legacy JSON field without treating it as a PHY setting.
          txPower: Number(form.txPower) || 0,
        },
      },
      mac: {
        type: typeOf('mac', macId, layers),
        attrs: {},
      },
      routing: { type: typeOf('routing', routingId, layers) },
    },
    nodes: nodeList,
    traffic: { preset: 'none' },
  }
}

export const validateExperiment = (spec: ExperimentSpec, layers: CatalogLayer[] = TYPEID_LAYERS): ValidationWarning[] => {
  const nodes = spec.nodes || []
  return [...topologyIssues(nodes, MIN_NODE_COUNT), ...experimentTimeIssues(spec, layers), ...protocolMetadataIssues(spec, layers)]
}
