/** Ideal terrestrial link: finite airtime, light-speed propagation and overlap collisions. */
export const TERRESTRIAL_RADIO_CC = String.raw`
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/abort.h"
#include "ns3/data-rate.h"
#include "ns3/mobility-model.h"
#include "ns3/simulator.h"
#include "ns3/tag.h"
#include <algorithm>
#include <cmath>
#include <memory>
#include <vector>

namespace ns3 {

// Packet tags do not count as transmitted bytes. Keep the sender's precise
// airtime even if the receiving node has a different configured data rate.
class AquaSimRadioDurationTag : public Tag {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimRadioDurationTag")
            .SetParent<Tag>().AddConstructor<AquaSimRadioDurationTag>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    uint32_t GetSerializedSize() const override { return 8; }
    void Serialize(TagBuffer buffer) const override { buffer.WriteU64(nanoseconds); }
    void Deserialize(TagBuffer buffer) override { nanoseconds = buffer.ReadU64(); }
    void Print(std::ostream& out) const override { out << nanoseconds << "ns"; }
    uint64_t nanoseconds = 0;
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimRadioDurationTag);

class AquaSimRadioPhy : public AquaSimPhy {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimRadioPhy")
            .SetParent<AquaSimPhy>().AddConstructor<AquaSimRadioPhy>()
            .AddAttribute("DataRate", "Ideal radio bit rate; no acoustic OFDM or preamble overhead.",
                DataRateValue(DataRate("1Mbps")),
                MakeDataRateAccessor(&AquaSimRadioPhy::SetDataRate, &AquaSimRadioPhy::GetDataRate),
                MakeDataRateChecker());
        return tid;
    }
    void SetDataRate(DataRate rate) {
        NS_ABORT_MSG_IF(rate.GetBitRate() == 0, "Radio DataRate must be greater than zero");
        m_rate = rate;
    }
    DataRate GetDataRate() const { return m_rate; }
    Time calcTxTime(uint32_t bytes) override {
        return std::max(NanoSeconds(1), m_rate.CalculateBytesTxTime(bytes));
    }
    Time calcTxTime(uint32_t bytes, int) override { return calcTxTime(bytes); }
    Time calcTxTime(Ptr<Packet> packet) override {
        AquaSimTrailer trailer;
        const uint32_t metadataBytes = trailer.GetSerializedSize();
        NS_ABORT_MSG_IF(packet->GetSize() < metadataBytes, "Radio packet is missing its AquaSim trailer");
        // Transport/routing/MAC headers are on-air bytes. The simulator-only
        // trailer and PacketStamp are not; this call precedes StampTxInfo.
        return calcTxTime(packet->GetSize() - metadataBytes);
    }
    double CalcPktSize(double seconds, int) override {
        return std::max(0.0, seconds) * static_cast<double>(m_rate.GetBitRate()) / 8.0;
    }
    int64_t AssignStreams(int64_t) override { return 0; }
    std::vector<double> getBandWidth() override { return {1}; }
    std::vector<double> getFreq() override { return {1}; }

    Ptr<Packet> StampTxInfo(Ptr<Packet> packet) override {
        AquaSimRadioDurationTag tag;
        packet->RemovePacketTag(tag);
        tag.nanoseconds = static_cast<uint64_t>(calcTxTime(packet).GetNanoSeconds());
        packet->AddPacketTag(tag);
        // Compatibility envelope only. These safe nonnegative placeholders are
        // not RF frequency/power; neither radio propagation nor RX uses them.
        AquaSimPacketStamp stamp;
        stamp.SetPt(1); stamp.SetPr(1); stamp.SetTxRange(GetTransRange());
        stamp.SetFreq(1); stamp.SetBandWidth(1);
        stamp.SetBandId(0); stamp.SetBandNum(1);
        packet->AddHeader(stamp);
        return packet;
    }
    bool txProcess(Ptr<Packet> packet) override {
        const auto status = GetDevice()->GetTransmissionStatus();
        if ((status == RECV && !HasActiveReceptions()) || (status == SEND && Simulator::Now() >= m_txEnd)) setStatus(NIDLE, 0);
        if (GetDevice()->GetTransmissionStatus() != NIDLE || HasActiveReceptions()) return false;
        m_txEnd = Simulator::Now() + calcTxTime(packet);
        GetDevice()->SetTransmissionStatus(SEND);
        // Preserve the base Tx trace used by the web replay adapter.
        const bool sent = AquaSimPhy::PktTransmit(packet);
        if (!sent) { m_txEnd = Simulator::Now(); setStatus(NIDLE, 0); }
        return sent;
    }
    bool recvProcess(Ptr<Packet> packet) override {
        AquaSimRadioDurationTag tag;
        if (!packet->PeekPacketTag(tag) || tag.nanoseconds == 0 || GetDevice()->FailureStatus()
            || GetDevice()->GetTransmissionStatus() == SLEEP) return false;
        AquaSimPacketStamp stamp;
        packet->RemoveHeader(stamp);
        auto reception = std::make_shared<Reception>();
        reception->packet = packet;
        reception->end = Simulator::Now() + NanoSeconds(tag.nanoseconds);
        reception->collided = Simulator::Now() < m_txEnd;
        for (const auto& other : m_receiving) {
            if (other->end > Simulator::Now()) { other->collided = true; reception->collided = true; }
        }
        m_receiving.push_back(reception);
        setStatus(NIDLE, 0);
        reception->event = Simulator::Schedule(NanoSeconds(tag.nanoseconds),
            &AquaSimRadioPhy::FinishReceive, this, reception);
        return true;
    }
    void setStatus(TransStatus requested, uint8_t) override {
        if (requested == NIDLE) {
            requested = Simulator::Now() < m_txEnd ? SEND : HasActiveReceptions() ? RECV : NIDLE;
        }
        GetDevice()->SetTransmissionStatus(requested);
    }

protected:
    bool matchPkt(Ptr<Packet> packet) override {
        AquaSimRadioDurationTag tag;
        return packet->PeekPacketTag(tag);
    }
    // This ideal model has no electrical consumption model. Do not silently use
    // the inherited underwater modem power, noise cache or BER assumptions.
    void UpdateTxEnergy(Time, double) override {}
    void UpdateRxEnergy(Time) override {}
    void UpdateIdleEnergy() override {}
    void DoDispose() override {
        for (const auto& reception : m_receiving) Simulator::Cancel(reception->event);
        m_receiving.clear();
        AquaSimPhy::DoDispose();
    }

private:
    struct Reception { Ptr<Packet> packet; EventId event; Time end; bool collided = false; };
    bool HasActiveReceptions() const {
        return std::any_of(m_receiving.begin(), m_receiving.end(), [](const auto& reception) {
            return reception->end > Simulator::Now();
        });
    }
    void FinishReceive(std::shared_ptr<Reception> reception) {
        m_receiving.erase(std::remove(m_receiving.begin(), m_receiving.end(), reception), m_receiving.end());
        const bool sleeping = GetDevice()->GetTransmissionStatus() == SLEEP;
        if (!sleeping) setStatus(NIDLE, 0);
        if (!reception->collided && !sleeping && !GetDevice()->FailureStatus()) {
            // Preserve the base Rx trace and normal MAC/application delivery.
            SendPktUp(reception->packet);
        }
    }
    DataRate m_rate{1000000};
    Time m_txEnd{Seconds(0)};
    std::vector<std::shared_ptr<Reception>> m_receiving;
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimRadioPhy);

class AquaSimRadioPropagation : public AquaSimPropagation {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimRadioPropagation")
            .SetParent<AquaSimPropagation>().AddConstructor<AquaSimRadioPropagation>();
        return tid;
    }
    Time PDelay(Ptr<MobilityModel> sender, Ptr<MobilityModel> receiver) override {
        return Seconds(sender->GetDistanceFrom(receiver) / 299792458.0);
    }
    std::vector<PktRecvUnit>* ReceivedCopies(Ptr<AquaSimNetDevice> sender, Ptr<Packet>,
        std::vector<Ptr<AquaSimNetDevice>> devices) override {
        auto copies = new std::vector<PktRecvUnit>;
        const double range = sender->GetPhy()->GetTransRange();
        NS_ABORT_MSG_IF(!std::isfinite(range) || range < 0, "Radio transRange must be finite and nonnegative");
        auto from = sender->GetNode()->GetObject<MobilityModel>();
        for (const auto& receiver : devices) {
            if (receiver == sender || !receiver->GetPhy()) continue;
            auto to = receiver->GetNode()->GetObject<MobilityModel>();
            if (from->GetDistanceFrom(to) > range) continue;
            PktRecvUnit copy;
            copy.recver = receiver;
            copy.pR = 1; // No attenuation/sensitivity model in this ideal link.
            copy.pDelay = PDelay(from, to);
            copies->push_back(copy);
        }
        return copies;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimRadioPropagation);

class AquaSimRadioChannel : public AquaSimChannel {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaSimRadioChannel")
            .SetParent<AquaSimChannel>().AddConstructor<AquaSimRadioChannel>();
        return tid;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaSimRadioChannel);

} // namespace ns3
`
