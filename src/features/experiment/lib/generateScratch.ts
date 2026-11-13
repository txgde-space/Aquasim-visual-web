import { REPLAY_TRACE_CC } from './replayTrace'
import { BUILTIN_PROTOCOL_CC } from './builtinProtocols'
import { PROTOCOL_RUNTIME_CC } from './protocolRuntime'
import { SIMULATION_PROGRESS_CC } from './simulationProgress'
import { MOBILITY_TRACE_CC } from './mobilityTrace'
import { hasSocketInterface, protocolMetadataIssues } from './protocolMetadata'
import { normalizeLegacyTrafficSpec } from './legacyExperiment'
import { deviceProtocolConfigurations } from './protocolConfiguration'
import type { ExperimentSpec } from '../../../shared/types/experiment'
import { TYPEID_LAYERS, type CatalogItem, type CatalogLayer } from './typeIdCatalog'
import { experimentTimeIssues, MIN_NODE_COUNT, parseExperimentTime, topologyIssues } from './experimentValidation'

import { attributeLiteral, nonBlankAttributes } from './protocolUnits'

const num = (value: unknown): number => Number(value) || 0
const quoted = (value: string) => JSON.stringify(value)

/** Assemble registered interfaces uniformly; legacy presets are normalized before this boundary. */
export const generateAquaVisualCc = (input: ExperimentSpec, layers: CatalogLayer[] = TYPEID_LAYERS, logName = 'net.aqua-visual.json'): string => {
  const spec = normalizeLegacyTrafficSpec(input)
  const nodes = Array.isArray(spec?.nodes) ? spec.nodes : []
  const issues = [...topologyIssues(nodes, MIN_NODE_COUNT), ...protocolMetadataIssues(spec, layers), ...experimentTimeIssues(spec, layers)]
  if (issues.length) throw new Error(issues.join('；'))
  const find = (layer: string, value: string, propagation = false): CatalogItem => {
    const item = layers.find((entry) => entry.id === layer)?.items.find((entry) => entry.typeId === value &&
      (layer !== 'channel' || (entry.field === 'propagationId') === propagation))
    if (!item) throw new Error(`${layer} 未注册协议：${value}，请先预编译`)
    return item
  }
  const phy = find('phy', spec.stack.phy.type)
  const mac = find('mac', spec.stack.mac.type)
  const routing = find('routing', spec.stack.routing.type)
  const channel = find('channel', spec.channel.type)
  const propagation = find('channel', spec.channel.propagation, true)
  const extras = spec.protocolAttributes || {}
  const attrsFor = (item: CatalogItem, attrs: Record<string, unknown>) => `{${Object.entries(nonBlankAttributes(attrs)).map(([key, value]) => {
    const attr = item.attributes?.find((entry) => entry.name === key)
    const text = attr ? attributeLiteral(attr, value) : String(value)
    return `{${quoted(key)}, ${quoted(text)}}`
  }).join(', ')}}`
  const factoryFor = (item: CatalogItem, attrs: Record<string, unknown>) => `VisualFactory(${quoted(item.typeId)}, ${attrsFor(item, attrs)})`
  const deviceAttributes = [phy, mac, routing].map((item, index) => `    const std::vector<VisualAttributes> node${['Phy', 'Mac', 'Routing'][index]}Attributes = {
${nodes.map((node) => `        ${attrsFor(item, deviceProtocolConfigurations(spec, node)[index]!.attributes)}`).join(',\n')}
    };`).join('\n')
  const simulationTime = parseExperimentTime(spec.simStop, '仿真时长 simStop')
  const simStop = simulationTime.literal
  const mobility = nodes.map((node, index) => {
    const item = node.mobility ? find('mobility', node.mobility.type) : null
    const type = item?.typeId || 'ns3::ConstantPositionMobilityModel'
    const attributes = item ? attrsFor(item, node.protocolAttributes?.[item.typeId] || {}) : '{}'
    return `    nodesCon.Get(${index})->AggregateObject(VisualCreateMobility(${quoted(type)}, ${attributes}, ${node.id}, Vector(${num(node.x)}, ${num(node.y)}, ${num(node.z)})));`
  }).join('\n')
  const apps = nodes.map((node, index) => {
    if (!node.app) return ''
    const item = find('app', node.app)
    const socket = hasSocketInterface(item)
    return `    {
        auto factory = ${factoryFor(item, node.appAttrs || {})};
${socket ? `        AquaSimSocketAddress remote;
        remote.SetAllDevices();
        remote.SetDestinationAddress(AquaSimAddress(${node.appDestination}));
        remote.SetProtocol(0);
        factory.Set("Protocol", TypeIdValue(AquaVisualSocketFactory::GetTypeId()));
        factory.Set("Remote", AddressValue(remote));
` : ''}        nodesCon.Get(${index})->AddApplication(factory.Create<Application>());
    }`
  }).join('\n')
  const metadata = JSON.stringify({ meta: {
    schema: 'uan-vis-packet-log/v2', time_unit: 'us', time_precision_us: 0.001,
    sim_end_us: Math.round(simulationTime.seconds * 1e6), distance_unit: 'm',
    protocols: { phy: [phy.typeId], mac: [mac.typeId], routing: [routing.typeId], channel: [channel.typeId] },
  } }).slice(0, -2)
  const nodeMetadata = JSON.stringify(nodes.map((node) => ({
    node_id: node.id, name: node.name || `Node-${node.id}`, x: num(node.x), y: num(node.y), z: num(node.z), role: node.role || 'node',
    ...(node.modelType === undefined ? {} : { modelType: node.modelType }),
    ...(node.mobility === undefined ? {} : {
      mobility: { type: node.mobility.type },
      protocolAttributes: { [node.mobility.type]: node.protocolAttributes?.[node.mobility.type] || {} },
    }),
  })))
  return `/** Generated by Aquasim Visual. */
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/core-module.h"
#include "ns3/mobility-module.h"
#include "ns3/network-module.h"
#include <cmath>
#include <iomanip>
#include <iostream>
#include <fstream>
#include <vector>
using namespace ns3;
${BUILTIN_PROTOCOL_CC}
${PROTOCOL_RUNTIME_CC}
${REPLAY_TRACE_CC}
${MOBILITY_TRACE_CC}
${SIMULATION_PROGRESS_CC}
int main(int argc, char* argv[]) {
    try {
    CommandLine cmd; cmd.Parse(argc, argv);
    auto progressGuard = CreateObject<AquaVisualGuardedSimulator>();
    Simulator::SetImplementation(progressGuard);
    const Time simStop(${quoted(simStop)});
    auto channelFactory = ${factoryFor(channel, extras[channel.typeId] || {})};
    auto propagationFactory = ${factoryFor(propagation, extras[propagation.typeId] || {})};
    auto sharedChannel = channelFactory.Create<AquaSimChannel>();
    sharedChannel->SetPropagation(propagationFactory.Create<AquaSimPropagation>());
    if (!sharedChannel->GetNoiseGen()) sharedChannel->SetNoiseGenerator(CreateObject<AquaSimConstNoiseGen>());
    // Query the selected propagation interface; never infer speed from a model name.
    double propagationSpeed = 0;
    PointerValue propagationValue;
    if (sharedChannel->GetAttributeFailSafe("SetProp", propagationValue)) {
        auto model = propagationValue.Get<AquaSimPropagation>();
        if (model) {
            auto from = CreateObject<ConstantPositionMobilityModel>();
            auto to = CreateObject<ConstantPositionMobilityModel>();
            to->SetPosition(Vector(1000, 0, 0));
            const double delay = model->PDelay(from, to).GetSeconds();
            if (std::isfinite(delay) && delay > 0) propagationSpeed = 1000 / delay;
        }
    }
    NodeContainer nodesCon; nodesCon.Create(${nodes.length});
${mobility}
    NetDeviceContainer devices;
    const std::vector<uint16_t> nodeAddresses = {${nodes.map((node) => node.id).join(', ')}};
${deviceAttributes}
    for (uint32_t i = 0; i < nodesCon.GetN(); ++i) {
        auto node = nodesCon.Get(i);
        // A fresh factory per node also gives nested PointerValue objects their own ownership.
        auto phyFactory = VisualNodeFactory(${quoted(phy.typeId)}, nodePhyAttributes[i], nodeAddresses[i]);
        auto macFactory = VisualNodeFactory(${quoted(mac.typeId)}, nodeMacAttributes[i], nodeAddresses[i]);
        auto routingFactory = VisualNodeFactory(${quoted(routing.typeId)}, nodeRoutingAttributes[i], nodeAddresses[i]);
        auto device = CreateObject<AquaSimNetDevice>();
        node->AddDevice(device);
        auto phy = phyFactory.Create<AquaSimPhy>();
        auto signalCache = phy->GetSignalCache();
        if (!signalCache) signalCache = CreateObject<AquaVisualSignalCacheRange>();
        phy->SetSignalCache(signalCache);
        phy->SetSinrChecker(CreateObject<AquaSimThresholdSinrChecker>());
        device->SetPhy(phy);
        device->SetChannel(sharedChannel);
        device->SetEnergyModel(CreateObject<AquaSimEnergyModel>());
        device->SetMac(macFactory.Create<AquaSimMac>());
        device->SetRouting(routingFactory.Create<AquaSimRouting>());
        devices.Add(device);
    }
${nodes.map((node, index) => `    devices.Get(${index})->SetAddress(AquaSimAddress(${node.id}));`).join('\n')}
    for (uint32_t i = 0; i < devices.GetN(); ++i) {
        auto device = DynamicCast<AquaSimNetDevice>(devices.Get(i));
        auto id = AquaSimAddress::ConvertFrom(device->GetAddress()).GetAsInt();
        device->GetPhy()->TraceConnectWithoutContext("Tx", MakeBoundCallback(&VisualTxTrace, uint32_t(id), device->GetPhy()));
        VisualConnectReceptionEvents(uint32_t(id), device->GetPhy());
        // Optional common interface: on-air completion may precede MAC delivery.
        if (device->GetPhy()->TraceConnectWithoutContext("RxComplete", MakeBoundCallback(&VisualRxTrace, uint32_t(id)))) {
            device->GetPhy()->TraceConnectWithoutContext("Rx", MakeBoundCallback(&VisualRxDeliveryTrace, uint32_t(id)));
        } else {
            device->GetPhy()->TraceConnectWithoutContext("Rx", MakeBoundCallback(&VisualRxTrace, uint32_t(id)));
        }
    }
    AquaSimSocketHelper socketHelper; socketHelper.Install(nodesCon);
    for (auto node : nodesCon) node->AggregateObject(CreateObject<AquaVisualSocketFactory>());
${apps}
    // Bound periodic observations to about 20k samples across all nodes; exact
    // CourseChange events remain separately observed and collinear runs merge.
    const Time mobilitySampleInterval = Seconds(std::max(0.1, simStop.GetSeconds() * nodesCon.GetN() / 20000.0));
    VisualStartMobilityTrace(nodesCon, nodeAddresses, mobilitySampleInterval, simStop);
    std::cout << "Running ${mac.typeId} / ${phy.typeId} / ${propagation.typeId}\\n";
    Simulator::Stop(simStop);
    Simulator::Run();
    VisualFinishMobilityTrace();
    Simulator::Destroy();
    progressGuard->CheckProgress();
    std::ofstream replay(${quoted(logName)});
    replay << ${quoted(metadata)};
    replay << ',' << char(34) << "mobility_sample_interval_us" << char(34) << ':'
           << std::setprecision(17) << mobilitySampleInterval.GetNanoSeconds() / 1000.0;
    replay << ",\\"trace_scope\\":\\"" << (visualReceiveEvents ? "phy-events" : "phy-success") << char(34);
    if (std::isfinite(propagationSpeed) && propagationSpeed > 0)
        replay << ",\\"propagation_speed_mps\\":" << std::setprecision(17) << propagationSpeed;
    replay << "},\\"nodes\\":" << ${quoted(nodeMetadata)};
    WriteVisualMovements(replay);
    WriteVisualPackets(replay);
    std::cout << "fin.\\n";
    return 0;
    } catch (const std::exception& error) {
        std::cerr << "Simulation error: " << error.what() << '\\n';
        return 1;
    }
}
`
}
