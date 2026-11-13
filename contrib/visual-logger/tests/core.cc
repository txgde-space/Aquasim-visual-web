// Trace-adapter contract test using real ns-3 scheduling and Packet copies.
// Events here are synthetic; the separate aquasim.cc test exercises real PHYs.
#include "../model/visual-logger.h"
using namespace ns3;
int main(int argc, char** argv) {
    std::string output = argc > 1 ? argv[1] : "net.logger-core.json";
    NodeContainer nodes; nodes.Create(3);
    MobilityHelper mobility;
    mobility.SetMobilityModel("ns3::ConstantVelocityMobilityModel");
    mobility.Install(nodes);
    auto moving = nodes.Get(0)->GetObject<ConstantVelocityMobilityModel>();
    moving->SetVelocity(Vector(2, 0, 0));
    const Time stop = Seconds(5);
    VisualLogger logger(nodes, {11, 22, 33}, stop);
    logger.SetNodeDisplay(11, "节点\"一\\\n", "auv");
    logger.SetPropagationSpeed(1500);
    auto packet = Create<Packet>(40);
    Ptr<Packet> firstCopy;
    Simulator::Schedule(Seconds(1), [&] {
        logger.Tx(11, packet, MilliSeconds(100));
        firstCopy = packet->Copy();
    });
    Simulator::Schedule(Seconds(1.2), [&] { logger.RxBegin(22, firstCopy, MilliSeconds(100)); });
    Simulator::Schedule(Seconds(1.3), [&] { logger.RxSuccess(22, firstCopy); logger.RxEnd(22, firstCopy); });
    // Reuse the SAME UID for a new hop: it must have a different sending event ID.
    Simulator::Schedule(Seconds(2), [&] { logger.Tx(22, packet, MilliSeconds(100)); });
    Simulator::Schedule(Seconds(2.2), [&] { logger.RxBegin(33, packet, MilliSeconds(100)); });
    Simulator::Schedule(Seconds(2.25), [&] { logger.RxCollision(33, packet, firstCopy, "collision_rx_rx"); });
    Simulator::Schedule(Seconds(2.3), [&] { logger.RxDrop(33, packet, "collision_rx_rx"); logger.RxEnd(33, packet); });
    auto pending = Create<Packet>(10);
    Simulator::Schedule(Seconds(4.9), [&] { logger.Tx(11, pending, Seconds(1)); logger.RxBegin(33, pending, Seconds(1)); });
    Simulator::Stop(stop);
    Simulator::Run();
    logger.Write(output);
    Simulator::Destroy();
}
