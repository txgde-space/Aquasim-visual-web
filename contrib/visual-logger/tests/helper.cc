#include "../helper/visual-log-helper.h"
#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/mobility-module.h"
#include "../adapters/observed-cache.h"
#include "ns3/aqua-sim-helper.h"
#include "ns3/aqua-sim-mac-broadcast.h"
#include "ns3/aqua-sim-trailer.h"
using namespace ns3;
static uint32_t delivered = 0;
class HelperSinkMac : public AquaSimBroadcastMac {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualHelperSinkMac").SetParent<AquaSimBroadcastMac>()
            .AddConstructor<HelperSinkMac>();
        return tid;
    }
    bool RecvProcess(Ptr<Packet>) override { ++delivered; return true; }
};
NS_OBJECT_ENSURE_REGISTERED(HelperSinkMac);
static void Send(Ptr<AquaSimNetDevice> device) {
    auto packet = Create<Packet>(40);
    AquaSimTrailer trailer;
    trailer.SetModeId(1); trailer.SetBandId(0);
    trailer.SetNextHop(AquaSimAddress::GetBroadcast());
    packet->AddTrailer(trailer);
    device->GetMac()->TxProcess(packet);
}
int main(int argc, char** argv) {
    std::string directory = "replay-logs", mode = "both", phy = "ns3::AquaSimPhyCmn";
    bool enabled = true, collision = false, explicitFlush = false;
    double stopSeconds = 19;
    CommandLine cmd;
    cmd.AddValue("directory", "Output directory", directory);
    cmd.AddValue("mode", "network/node/both/single/sender", mode);
    cmd.AddValue("phy", "Installed PHY", phy);
    cmd.AddValue("enabled", "Logging enabled", enabled);
    cmd.AddValue("collision", "Two senders", collision);
    cmd.AddValue("flush", "Explicit flush before Destroy", explicitFlush);
    cmd.AddValue("stop", "Actual stop", stopSeconds);
    cmd.Parse(argc, argv);
    NodeContainer nodes; nodes.Create(4);
    MobilityHelper mobility;
    mobility.SetMobilityModel("ns3::ConstantVelocityMobilityModel");
    mobility.Install(nodes);
    nodes.Get(0)->GetObject<MobilityModel>()->SetPosition(Vector(-500, 0, 0));
    nodes.Get(1)->GetObject<MobilityModel>()->SetPosition(Vector(500, 0, 0));
    auto moving = nodes.Get(3)->GetObject<ConstantVelocityMobilityModel>();
    moving->SetPosition(Vector(10000, 0, 0)); moving->SetVelocity(Vector(2, 0, 0));
    AquaSimChannelHelper channels;
    AquaSimHelper helper;
    helper.SetChannel(channels.Create());
    helper.SetPhy(phy, "transRange", DoubleValue(600));
    helper.SetMac("ns3::AquaVisualHelperSinkMac");
    helper.SetSignalCache("ns3::AquaVisualSignalCacheRange");
    NetDeviceContainer devices;
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        auto device = helper.Create(nodes.Get(i), CreateObject<AquaSimNetDevice>());
        device->SetAddress(AquaSimAddress((i + 1) * 10)); devices.Add(device);
    }
    // Schedule Stop BEFORE installation: final logging must not depend on the
    // relative ordering of normal events at the same simulation timestamp.
    Simulator::Stop(Seconds(stopSeconds));
    {
        VisualLogHelper log;
        log.SetEnabled(enabled);
        log.SetOutputDir(directory); log.SetRunId("test-run");
        log.SetLogScope(mode == "network" ? VisualLogScope::NETWORK : mode == "both" ? VisualLogScope::BOTH : VisualLogScope::NODE);
        if (mode == "single") log.SetLocalNodeId(30);
        if (mode == "sender") log.SetLocalNodeId(10);
        log.SetNodeModelType(10, "auv"); log.SetNodeModelType(20, "sensor");
        log.SetNodeModelType(30, "buoy"); log.SetNodeModelType(40, "vessel");
        log.SetNodeName(30, "接收浮标");
        log.InstallAll(Seconds(19)); // final time follows actual stop, including early termination
        Simulator::Schedule(Seconds(10), &Send, DynamicCast<AquaSimNetDevice>(devices.Get(0)));
        if (collision) Simulator::Schedule(Seconds(10), &Send, DynamicCast<AquaSimNetDevice>(devices.Get(1)));
        Simulator::Schedule(Seconds(12), &Send, DynamicCast<AquaSimNetDevice>(devices.Get(3)));
        if (explicitFlush) { Simulator::Run(); log.Flush(); }
    } // Helper may go out of scope; scheduled flush still owns the collector.
    if (!explicitFlush) Simulator::Run();
    Simulator::Destroy();
    std::cout << "delivered=" << delivered << '\n';
}
