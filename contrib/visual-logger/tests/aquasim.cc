// Real PHY/channel/cache integration smoke test, for the documented adapter API.
// The sink MAC counts deliveries without requiring an application or routing file.
#include "../adapters/aqua-sim-adapter.h"
#include "../adapters/observed-cache.h"
#include "ns3/aqua-sim-helper.h"
#include "ns3/aqua-sim-mac-broadcast.h"
#include "ns3/aqua-sim-trailer.h"
#include <memory>
using namespace ns3;
static uint32_t delivered = 0;
class CountingMac : public AquaSimBroadcastMac {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualSmokeMac").SetParent<AquaSimBroadcastMac>()
            .AddConstructor<CountingMac>();
        return tid;
    }
    bool RecvProcess(Ptr<Packet>) override { ++delivered; return true; }
};
NS_OBJECT_ENSURE_REGISTERED(CountingMac);
static void Send(Ptr<AquaSimNetDevice> device) {
    auto packet = Create<Packet>(40);
    AquaSimTrailer trailer;
    trailer.SetModeId(1);
    trailer.SetBandId(0);
    trailer.SetNextHop(AquaSimAddress::GetBroadcast());
    packet->AddTrailer(trailer);
    device->GetMac()->TxProcess(packet);
}
int main(int argc, char** argv) {
    std::string output = "net.logger-aquasim.json", phy = "ns3::AquaSimPhyCmn";
    bool observe = false, collision = false, logging = true;
    double stopSeconds = 19;
    CommandLine cmd;
    cmd.AddValue("output", "Replay filename", output);
    cmd.AddValue("phy", "Installed PHY TypeId for this smoke scenario", phy);
    cmd.AddValue("observe", "Explicitly select observed native Range cache", observe);
    cmd.AddValue("collision", "Send from two opposing nodes at the same time", collision);
    cmd.AddValue("logging", "Enable logger for control comparison", logging);
    cmd.AddValue("stop", "Simulation duration in seconds", stopSeconds);
    cmd.Parse(argc, argv);
    NodeContainer nodes; nodes.Create(3);
    MobilityHelper mobility;
    mobility.SetMobilityModel("ns3::ConstantPositionMobilityModel");
    mobility.Install(nodes);
    nodes.Get(0)->GetObject<MobilityModel>()->SetPosition(Vector(-500, 0, 0));
    nodes.Get(1)->GetObject<MobilityModel>()->SetPosition(Vector(500, 0, 0));
    AquaSimChannelHelper channels;
    AquaSimHelper helper;
    helper.SetChannel(channels.Create());
    helper.SetPhy(phy, "transRange", DoubleValue(600));
    helper.SetMac("ns3::AquaVisualSmokeMac");
    helper.SetSignalCache(observe ? "ns3::AquaVisualSignalCacheRange" : "ns3::AquaSimSignalCacheRange");
    NetDeviceContainer devices;
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        auto device = helper.Create(nodes.Get(i), CreateObject<AquaSimNetDevice>());
        device->SetAddress(AquaSimAddress(i + 1));
        devices.Add(device);
    }
    const Time stop = Seconds(stopSeconds);
    std::unique_ptr<VisualLogger> logger;
    if (logging) {
        logger.reset(new VisualLogger(nodes, VisualLoggerNodeIds(devices), stop));
        AttachAquaSim(*logger, nodes, devices);
    }
    Simulator::Schedule(Seconds(10), &Send, DynamicCast<AquaSimNetDevice>(devices.Get(0)));
    if (collision) Simulator::Schedule(Seconds(10), &Send, DynamicCast<AquaSimNetDevice>(devices.Get(1)));
    Simulator::Stop(stop);
    Simulator::Run();
    if (logger) logger->Write(output);
    logger.reset();
    std::cout << "delivered=" << delivered << '\n';
    Simulator::Destroy();
}
