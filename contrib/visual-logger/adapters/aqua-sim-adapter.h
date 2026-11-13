// Adapter for AquaSimPhy Tx/Rx(Ptr<Packet>, double), calcTxTime and
// a Tx packet whose leading header is AquaSimPacketStamp. See README.md.
#pragma once
#include "../model/visual-logger.h"
#include "ns3/aqua-sim-phy.h"
#include "ns3/aqua-sim-header.h"
#include "ns3/aqua-sim-net-device.h"
#include "ns3/aqua-sim-signal-cache.h"
#include "ns3/aqua-sim-address.h"

namespace ns3 {
static Time VisualLoggerAirtime(Ptr<AquaSimPhy> phy, Ptr<Packet> packet) {
    auto copy = packet->Copy();
    AquaSimPacketStamp stamp;
    copy->RemoveHeader(stamp);
    return phy->calcTxTime(copy);
}
static std::vector<uint16_t> VisualLoggerNodeIds(const NetDeviceContainer& devices) {
    std::vector<uint16_t> ids;
    for (uint32_t i = 0; i < devices.GetN(); ++i) {
        auto device = DynamicCast<AquaSimNetDevice>(devices.Get(i));
        if (!device) throw std::runtime_error("Expected AquaSimNetDevice");
        ids.push_back(AquaSimAddress::ConvertFrom(device->GetAddress()).GetAsInt());
    }
    return ids;
}
// nodes and devices must have matching order, one Aqua-Sim device per logged node.
inline void AttachAquaSim(VisualLogger& logger, const NodeContainer& nodes,
                          const NetDeviceContainer& devices) {
    if (nodes.GetN() != devices.GetN()) throw std::runtime_error("Node/device counts differ");
    const auto ids = VisualLoggerNodeIds(devices);
    for (uint32_t i = 0; i < devices.GetN(); ++i) {
        auto device = DynamicCast<AquaSimNetDevice>(devices.Get(i));
        if (device->GetNode() != nodes.Get(i) || !device->GetPhy())
            throw std::runtime_error("Node/device order differs or PHY is missing");
        auto phy = device->GetPhy();
        const bool events = logger.AttachPhy(ids[i], phy,
            MakeBoundCallback(&VisualLoggerAirtime, phy), phy->GetSignalCache());
        std::clog << "[visual-logger] node " << ids[i] << ": "
                  << (events ? "receive events connected" : "Tx/Rx only; collision/drop events unavailable") << '\n';
    }
}
} // namespace ns3
