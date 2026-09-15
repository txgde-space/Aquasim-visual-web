import { TYPEID_LAYERS } from './typeIdCatalog.js'

const TYPE_IDS = new Set(
  TYPEID_LAYERS.flatMap((layer) => layer.items.map((item) => item.typeId).filter(Boolean)),
)

const num = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const timeLit = (value, fallback = '30s') => {
  const text = String(value || fallback).trim()
  if (!/^\d+(\.\d+)?s$/.test(text)) return fallback
  return text
}

const typeLit = (value, fallback) => (TYPE_IDS.has(value) ? value : fallback)

export const generateAquaVisualCc = (spec) => {
  const nodes = Array.isArray(spec?.nodes) ? spec.nodes.slice(0, 64) : []
  const nodeNum = Math.max(2, nodes.length)
  const simStop = timeLit(spec?.simStop, '30s')
  const phyType = typeLit(spec?.stack?.phy?.type, 'ns3::AquaSimPhyFDM')
  const macType = typeLit(spec?.stack?.mac?.type, 'ns3::AquaSimSwarmM')
  const routingType = typeLit(spec?.stack?.routing?.type, 'ns3::AquaSimStaticRouting')
  const channelType = typeLit(spec?.channel?.type, 'ns3::AquaSimChannel')
  const propType = typeLit(spec?.channel?.propagation, 'ns3::AquaSimRangePropagation')
  const transRange = num(spec?.stack?.phy?.attrs?.transRange, 1200)
  const slotNum = Math.min(8, Math.max(1, Math.round(num(spec?.stack?.mac?.attrs?.SlotNum, nodeNum))))
  const slotLen = timeLit(spec?.stack?.mac?.attrs?.SlotLen, '5s')
  const initialRoundDelay = timeLit(spec?.stack?.mac?.attrs?.InitialRoundDelay, '1s')
  const traffic = spec?.traffic || { preset: 'none' }
  const logName = macType.replace(/^ns3::/, '')

  const positions = nodes.map((node) => {
    const x = num(node.x)
    const y = num(node.y)
    const z = num(node.z)
    return `    positions->Add(Vector(${x}, ${y}, ${z}));`
  }).join('\n')

  let macBlock = `    asHelper.SetMac("${macType}");`
  if (macType === 'ns3::AquaSimSwarmM') {
    macBlock = `    asHelper.SetMac("${macType}",
                    "NodeCount",
                    UintegerValue(${nodeNum}),
                    "SlotLen",
                    TimeValue(Time("${slotLen}")),
                    "PhaseGap",
                    TimeValue(Seconds(1)),
                    "RoundGuard",
                    TimeValue(Seconds(2)),
                    "InitialRoundDelay",
                    TimeValue(Time("${initialRoundDelay}")));`
  } else if (macType === 'ns3::AquaSimTDMA') {
    macBlock = `    asHelper.SetMac("${macType}",
                    "SlotLen",
                    TimeValue(Time("${slotLen}")),
                    "SlotNum",
                    UintegerValue(${slotNum}));`
  }

  const destId = Math.max(1, Math.round(num(traffic.dst, nodeNum)))
  const useTraffic = traffic.preset && traffic.preset !== 'none'
  const srcId = Math.max(1, Math.round(num(traffic.src, 1)))
  const rate = Math.max(1, Math.round(num(traffic.rate_bps, 80)))
  const pkt = Math.max(1, Math.round(num(traffic.pkt, 50)))

  const appBlock = useTraffic
    ? `    AquaSimSocketAddress socket;
    socket.SetAllDevices();
    socket.SetDestinationAddress(AquaSimAddress(${destId}));
    socket.SetProtocol(0);

    OnOffNdHelper app("ns3::AquaSimSocketFactory", Address(socket));
    app.SetAttribute("OffTime", StringValue("ns3::ConstantRandomVariable[Constant=0]"));
    app.SetAttribute("DataRate", DataRateValue(${rate}));
    app.SetAttribute("PacketSize", UintegerValue(${pkt}));
    app.SetAttribute("Nsend", UintegerValue(1));
    app.SetAttribute("stopSend", DoubleValue(appStop.GetSeconds()));

    ApplicationContainer apps = app.Install(nodesCon.Get(${srcId - 1}));
    apps.Start(appStart);
    apps.Stop(appStop);`
    : `    AquaSimSocketAddress socket;
    socket.SetAllDevices();
    socket.SetDestinationAddress(AquaSimAddress(${Math.min(nodeNum, 4)}));
    socket.SetProtocol(0);

    OnOffNdHelper app("ns3::AquaSimSocketFactory", Address(socket));
    app.SetAttribute("OffTime", StringValue("ns3::ConstantRandomVariable[Constant=0]"));
    app.SetAttribute("Nsend", UintegerValue(0));
    app.SetAttribute("stopSend", DoubleValue(appStop.GetSeconds()));

    ApplicationContainer apps = app.Install(nodesCon);
    apps.Start(appStart);
    apps.Stop(appStop);`

  return `/**
 * Generated from Aquasim Visual experiment.json
 * Do not edit by hand; overwritten on 运行仿真.
 */

#include "ns3/applications-module.h"
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/core-module.h"
#include "ns3/log.h"
#include "ns3/mobility-module.h"
#include "ns3/network-module.h"

#include <iostream>

using namespace ns3;

NS_LOG_COMPONENT_DEFINE("AquaVisual");

int
main(int argc, char* argv[])
{
    Time appStart{"1s"};
    Time appStop{"${simStop}"};
    Time simStop{"${simStop}"};
    uint32_t nodeNum = ${nodeNum};

    LogComponentEnable("${logName}", LOG_LEVEL_INFO);
    LogComponentEnable("${logName}", LOG_PREFIX_TIME);

    CommandLine cmd;
    cmd.Parse(argc, argv);

    std::cout << "-----------Initializing simulation-----------\\n";

    NodeContainer nodesCon;
    nodesCon.Create(nodeNum);

    Ptr<ListPositionAllocator> positions = CreateObject<ListPositionAllocator>();
${positions}

    AquaSimChannelHelper channel;
    channel.SetChannel("${channelType}");
    channel.SetPropagation("${propType}");
    AquaSimHelper asHelper;
    asHelper.SetChannel(channel.Create());
    asHelper.SetPhy("${phyType}", "transRange", DoubleValue(${transRange}));
    asHelper.SetRouting("${routingType}");
${macBlock}

    NetDeviceContainer devices = asHelper.Install(nodesCon);

    MobilityHelper mobility;
    mobility.SetPositionAllocator(positions);
    mobility.SetMobilityModel("ns3::ConstantPositionMobilityModel");
    mobility.Install(nodesCon);

    AquaSimSocketHelper socketHelper;
    socketHelper.Install(nodesCon);

${appBlock}

    Packet::EnablePrinting();
    std::cout << "-----------Running Simulation-----------\\n";
    Simulator::Stop(simStop);
    Simulator::Run();
    Simulator::Destroy();
    std::cout << "fin.\\n";
    return 0;
}
`
}
