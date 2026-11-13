import { PHY_PACKET_TIMING_CC } from './phyPacketTiming'

/** Constant-rate underwater PHY. The installed Cmn PHY owns all medium behavior. */
export const SIMPLE_UNDERWATER_PHY_CC = PHY_PACKET_TIMING_CC + String.raw`
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/data-rate.h"
#include "ns3/nstime.h"
#include "ns3/simulator.h"
#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <vector>

namespace ns3 {
class AquaSimPhySimple : public AquaSimPhyCmn {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimPhySimple")
            .SetParent<AquaSimPhyCmn>().AddConstructor<AquaSimPhySimple>()
            .AddAttribute("DataRate",
                "On-air bit rate (bit/s). Airtime is 8 * transmitted bytes / DataRate, without OFDM framing overhead.",
                DataRateValue(DataRate("10kbps")),
                MakeDataRateAccessor(&AquaSimPhySimple::SetDataRate, &AquaSimPhySimple::GetDataRate),
                MakeDataRateChecker())
            .AddAttribute("RxProcessingDelay",
                "Per-packet delay after successful on-air reception and inherited error checks, before delivery to MAC. Does not occupy the acoustic medium.",
                TimeValue(Seconds(0)),
                MakeTimeAccessor(&AquaSimPhySimple::m_rxProcessingDelay),
                MakeTimeChecker(Seconds(0)))
            .AddTraceSource("RxComplete",
                "Successful on-air reception before receiver processing and MAC delivery.",
                MakeTraceSourceAccessor(&AquaSimPhySimple::m_rxComplete),
                "ns3::AquaSimPhy::TracedCallback");
        return tid;
    }
    void SetDataRate(DataRate rate) {
        if (rate.GetBitRate() == 0)
            throw std::invalid_argument("AquaSimPhySimple.DataRate must be greater than zero");
        m_dataRate = rate;
    }
    DataRate GetDataRate() const { return m_dataRate; }
    Time calcTxTime(uint32_t bytes) override {
        return std::max(NanoSeconds(1), m_dataRate.CalculateBytesTxTime(bytes));
    }
    Time calcTxTime(uint32_t bytes, int) override { return calcTxTime(bytes); }
    Time calcTxTime(Ptr<Packet> packet) override {
        // The base receive path calls this for RX status, energy and cache timing.
        // Use the transmitter's actual airtime, even with different node rates.
        AquaVisualPhyTimingTag timing;
        if (m_receiving && packet->PeekPacketTag(timing) && timing.airtimeNs > 0)
            return NanoSeconds(timing.airtimeNs);
        AquaSimTrailer trailer;
        const uint32_t metadataBytes = trailer.GetSerializedSize();
        if (packet->GetSize() < metadataBytes)
            throw std::invalid_argument("AquaSimPhySimple packet is missing its AquaSim trailer");
        // MAC, routing and transport headers are on-air; simulator trailer is not.
        return calcTxTime(packet->GetSize() - metadataBytes);
    }
    double CalcPktSize(double seconds, int) override {
        if (!std::isfinite(seconds) || seconds < 0)
            throw std::invalid_argument("AquaSimPhySimple duration must be finite and nonnegative");
        return seconds * static_cast<double>(m_dataRate.GetBitRate()) / 8.0;
    }
    Ptr<Packet> StampTxInfo(Ptr<Packet> packet) override {
        AquaVisualPhyTimingTag timing;
        packet->RemovePacketTag(timing);
        timing = AquaVisualPhyTimingTag();
        timing.airtimeNs = static_cast<uint64_t>(calcTxTime(packet).GetNanoSeconds());
        packet->AddPacketTag(timing);
        // Preserve inherited underwater power, frequency, bandwidth and range.
        return AquaSimPhyCmn::StampTxInfo(packet);
    }
    bool recvProcess(Ptr<Packet> packet) override {
        // Scoped because base validation and signal-cache admission are synchronous.
        struct ReceiveScope {
            bool& flag;
            const bool previous;
            explicit ReceiveScope(bool& value) : flag(value), previous(value) { flag = true; }
            ~ReceiveScope() { flag = previous; }
        } receiving(m_receiving);
        return AquaSimPhyCmn::recvProcess(packet);
    }
    void SendPktUp(Ptr<Packet> packet) override {
        // Called by the inherited signal-cache/BER path only after a successful RX.
        AquaVisualPhyTimingTag timing;
        packet->RemovePacketTag(timing);
        timing.hasReception = true;
        timing.receptionEndNs = static_cast<uint64_t>(Simulator::Now().GetNanoSeconds());
        timing.processingNs = static_cast<uint64_t>(m_rxProcessingDelay.GetNanoSeconds());
        packet->AddPacketTag(timing);
        m_rxComplete(packet, GetSignalCache()->GetNoise());
        if (m_rxProcessingDelay.IsZero()) {
            DeliverToMac(packet);
            return;
        }
        m_deliveries.erase(std::remove_if(m_deliveries.begin(), m_deliveries.end(),
            [](const EventId& event) { return !event.IsPending(); }), m_deliveries.end());
        m_deliveries.push_back(Simulator::Schedule(m_rxProcessingDelay,
            &AquaSimPhySimple::DeliverToMac, this, packet));
    }
protected:
    void DoDispose() override {
        for (const auto& event : m_deliveries) Simulator::Cancel(event);
        m_deliveries.clear();
        AquaSimPhyCmn::DoDispose();
    }
private:
    void DeliverToMac(Ptr<Packet> packet) { AquaSimPhyCmn::SendPktUp(packet); }
    DataRate m_dataRate{10000};
    Time m_rxProcessingDelay{Seconds(0)};
    bool m_receiving = false;
    std::vector<EventId> m_deliveries;
    ns3::TracedCallback<Ptr<Packet>, double> m_rxComplete;
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimPhySimple);
} // namespace ns3
`
