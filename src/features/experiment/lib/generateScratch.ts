import { REPLAY_TRACE_CC } from './replayTrace'
import type { ExperimentSpec } from '../../../shared/types/experiment'
import { TYPEID_LAYERS, type CatalogItem, type CatalogLayer } from './typeIdCatalog'

const num = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
const quoted = (value: string) => JSON.stringify(value)
const timeLit = (value: unknown, fallback: string): string => {
  const text = String(value || fallback).trim()
  return /^\+?\d+(\.\d+)?(?:e[+-]?\d+)?(ns|us|ms|s|min|h)$/i.test(text) ? text : fallback
}

/** Generate only types registered in the selected layer; never silently substitute a protocol. */
export const generateAquaVisualCc = (spec: ExperimentSpec, layers: CatalogLayer[] = TYPEID_LAYERS, logName = 'net.aqua-visual.json'): string => {
  const find = (layer: string, value: string, propagation = false): CatalogItem => {
    const item = layers.find((entry) => entry.id === layer)?.items.find((entry) => entry.typeId === value &&
      (layer !== 'channel' || (entry.field === 'propagationId') === propagation))
    if (!item) throw new Error(`${layer} 未注册协议：${value}，请先预编译并重新选择协议`)
    return item
  }
  const nodes = Array.isArray(spec?.nodes) ? spec.nodes.slice(0, 64) : []
  if (Array.isArray(spec?.nodes) && spec.nodes.length > 64) throw new Error('最多支持 64 个节点')
  if (nodes.length < 2) throw new Error('至少需要两个节点')
  if (new Set(nodes.map((node) => node.id)).size !== nodes.length || nodes.some((node) => !Number.isInteger(node.id) || node.id < 1 || node.id > 65534)) {
    throw new Error('节点编号必须是互不重复的 1–65534 整数')
  }
  const phy = find('phy', spec.stack.phy.type)
  const mac = find('mac', spec.stack.mac.type)
  const routing = find('routing', spec.stack.routing.type)
  const channel = find('channel', spec.channel.type)
  const propagation = find('channel', spec.channel.propagation, true)
  const extras = spec.protocolAttributes || {}
  const attrsFor = (item: CatalogItem, attrs: Record<string, unknown>) => Object.entries(attrs).map(([key, value]) => {
    if (item.attributes && !item.attributes.some((attr) => attr.name === key)) throw new Error(`${item.typeId} 没有属性 ${key}`)
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error(`${key} 属性值无效`)
    return `, ${quoted(key)}, StringValue(${quoted(String(value))})`
  }).join('')
  const macAttrs = { ...spec.stack.mac.attrs, ...(extras[mac.typeId] || {}) }
  const phyAttrs = { transRange: num(spec.stack.phy.attrs.transRange, 1200), ...(extras[phy.typeId] || {}) }
  const simStop = timeLit(spec.simStop, '30s')
  const stopUnit = simStop.match(/(ns|us|ms|s|min|h)$/i)![0].toLowerCase()
  const stopUs = parseFloat(simStop) * ({ ns: 0.001, us: 1, ms: 1000, s: 1e6, min: 60e6, h: 3600e6 }[stopUnit] || 1e6)
  const traffic = spec.traffic
  const active = traffic && traffic.preset !== 'none' && 'src' in traffic
  const src = active ? Number(traffic.src) : nodes[0].id
  const dst = active ? Number(traffic.dst) : undefined
  if (active && !nodes.some((node) => node.id === src)) throw new Error('流量源不在拓扑中')
  const rate = Math.max(1, Math.round(num(active ? traffic.rate_bps : undefined, 80)))
  const packetSize = Math.max(1, Math.round(num(active ? traffic.pkt : undefined, 50)))
  const start = timeLit(active ? traffic.start : '', active ? '1s' : '0s')
  const stop = timeLit(active ? traffic.stop : '', simStop)
  const apps = nodes.map((node, index) => {
    const appType = node.app || (active && node.id === src ? 'ns3::OnOffNDApplication' : '')
    if (!appType) return ''
    const destination = node.appDestination ?? dst
    if (destination === undefined) throw new Error(`请为节点 ${node.id} 的应用选择目的节点`)
    if (!nodes.some((target) => target.id === destination)) throw new Error(`节点 ${node.id} 的应用目的节点 ${destination} 不在拓扑中`)
    const item = find('app', appType)
    const hasAttribute = (name: string) => !item.attributes || item.attributes.some((attr) => attr.name === name)
    const attrs = { ...(active ? extras[appType] || {} : {}), ...(node.appAttrs || {}) }
    const trafficGen = appType === 'ns3::AquaSimTrafficGen'
    const defaults: Record<string, unknown> = !active
      ? (appType === 'ns3::OnOffNDApplication' ? { Nsend: nodes.length } : {})
      : trafficGen ? { Delay: packetSize * 8 / rate, PacketSize: packetSize }
      : appType === 'ns3::OnOffNDApplication' ? {
          DataRate: `${rate}bps`, PacketSize: packetSize, Nsend: nodes.length,
          traffic: rate / (packetSize * 8), mode: active && traffic.preset === 'periodic' ? 0 : 1,
          OffTime: 'ns3::ConstantRandomVariable[Constant=0]',
        } : {}
    // These are wired to the topology, not free-form serialized socket addresses.
    delete attrs.Protocol; delete attrs.Remote
    const appStart = timeLit(attrs.StartTime, start)
    const appStop = timeLit(attrs.StopTime, stop)
    delete attrs.StartTime; delete attrs.StopTime
    const pairs = attrsFor(item, { ...defaults, ...attrs })
    return `    {
        AquaSimSocketAddress remote;
        remote.SetAllDevices();
        remote.SetDestinationAddress(AquaSimAddress(${destination}));
        remote.SetProtocol(0);
        ObjectFactory factory;
        factory.SetTypeId(${quoted(appType)});
        ${hasAttribute('Protocol') ? `factory.Set("Protocol", StringValue("ns3::${trafficGen ? 'AquaVisualBoundSocketFactory' : 'AquaSimSocketFactory'}"));` : ''}
        ${hasAttribute('Remote') ? 'factory.Set("Remote", AddressValue(remote));' : ''}
        ${pairs ? `factory.Set(${pairs.slice(2)});` : ''}
        auto app = factory.Create<Application>();
        if (app->GetInstanceTypeId().GetName() == "ns3::OnOffNDApplication" && ${'stopSend' in attrs ? 'false' : 'true'})
            app->SetAttribute("stopSend", DoubleValue(std::min(Time(${quoted(appStop)}), simStop).GetSeconds()));
        nodesCon.Get(${index})->AddApplication(app);
        app->SetStartTime(Time(${quoted(appStart)}));
        app->SetStopTime(std::min(Time(${quoted(appStop)}), simStop));
    }`
  }).join('\n')
  const metadata = JSON.stringify({ meta: { schema: 'uan-vis-packet-log/v2', time_unit: 'us', sim_end_us: Math.round(stopUs), distance_unit: 'm', trace_scope: 'phy-success', protocols: { phy: [phy.typeId], mac: [mac.typeId], routing: [routing.typeId], channel: [channel.typeId] } }, nodes: nodes.map((node) => ({ node_id: node.id, name: node.name || `Node-${node.id}`, x: num(node.x), y: num(node.y), z: num(node.z), role: node.role || 'node' })) }).slice(0, -1)
  return `/** Generated by Aquasim Visual. */
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/core-module.h"
#include "ns3/mobility-module.h"
#include "ns3/network-module.h"
#include <algorithm>
#include <iostream>
#include <fstream>
#include <vector>
using namespace ns3;
${REPLAY_TRACE_CC}
// TrafficGen does not bind AquaSimSocketAddress before Connect; supply a bound socket.
class AquaVisualBoundSocketFactory : public SocketFactory {
  public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualBoundSocketFactory")
            .SetParent<SocketFactory>().AddConstructor<AquaVisualBoundSocketFactory>();
        return tid;
    }
    Ptr<Socket> CreateSocket() override {
        auto socket = CreateObject<AquaSimSocket>();
        socket->SetNode(GetObject<Node>());
        NS_ABORT_MSG_IF(socket->Bind() != 0, "Cannot bind Aqua-Sim traffic socket");
        return socket;
    }
};
int main(int argc, char* argv[]) {
${phy.typeId === 'ns3::AquaSimPhyModem' ? '    GlobalValue::Bind("SimulatorImplementationType", StringValue("ns3::RealtimeSimulatorImpl"));' : ''}
    CommandLine cmd; cmd.Parse(argc, argv);
    const Time simStop(${quoted(simStop)});
    const std::string macLog = ${quoted(mac.typeId.replace(/^ns3::/, ''))};
    if (LogComponent::GetComponentList()->count(macLog)) {
        LogComponentEnable(macLog, LOG_LEVEL_INFO);
        LogComponentEnable(macLog, LOG_PREFIX_TIME);
    }
    NodeContainer nodesCon; nodesCon.Create(${nodes.length});
    Ptr<ListPositionAllocator> positions = CreateObject<ListPositionAllocator>();
${nodes.map((node) => `    positions->Add(Vector(${num(node.x)}, ${num(node.y)}, ${num(node.z)}));`).join('\n')}
    MobilityHelper mobility;
    mobility.SetPositionAllocator(positions);
    mobility.SetMobilityModel("ns3::ConstantPositionMobilityModel");
    mobility.Install(nodesCon);
    AquaSimChannelHelper channel;
    channel.SetChannel(${quoted(channel.typeId)}${attrsFor(channel, extras[channel.typeId] || {})});
    channel.SetPropagation(${quoted(propagation.typeId)}${attrsFor(propagation, extras[propagation.typeId] || {})});
    AquaSimHelper helper;
    helper.SetChannel(channel.Create());
    helper.SetPhy(${quoted(phy.typeId)}${attrsFor(phy, phyAttrs)});
    helper.SetMac(${quoted(mac.typeId)}${attrsFor(mac, macAttrs)});
    helper.SetRouting(${quoted(routing.typeId)}${attrsFor(routing, extras[routing.typeId] || {})});
    auto devices = helper.Install(nodesCon);
${nodes.map((node, index) => `    devices.Get(${index})->SetAddress(AquaSimAddress(${node.id}));`).join('\n')}
    for (uint32_t i = 0; i < devices.GetN(); ++i) {
        auto device = DynamicCast<AquaSimNetDevice>(devices.Get(i));
        auto id = AquaSimAddress::ConvertFrom(device->GetAddress()).GetAsInt();
        device->GetPhy()->TraceConnectWithoutContext("Tx", MakeBoundCallback(&VisualTxTrace, uint32_t(id), device->GetPhy()));
        device->GetPhy()->TraceConnectWithoutContext("Rx", MakeBoundCallback(&VisualRxTrace, uint32_t(id)));
    }
    AquaSimSocketHelper socketHelper; socketHelper.Install(nodesCon);
    for (auto node : nodesCon) node->AggregateObject(CreateObject<AquaVisualBoundSocketFactory>());
${apps}
    std::cout << "Running ${mac.typeId} / ${phy.typeId} / ${propagation.typeId}\\n";
    Simulator::Stop(simStop);
    Simulator::Run();
    Simulator::Destroy();
    std::ofstream replay(${quoted(logName)});
    replay << ${quoted(metadata)};
    WriteVisualPackets(replay);
    std::cout << "fin.\\n";
    return 0;
}
`
}
