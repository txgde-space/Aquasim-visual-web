(function() {


//#region src/features/experiment/lib/replayTrace.ts
/** Public trace-interface adapter; records observed reception attempts and outcomes, never inferred geometry. */
	const REPLAY_TRACE_CC = String.raw`
#include <set>
class AquaVisualTxTag : public Tag {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualTxTag")
            .SetParent<Tag>().AddConstructor<AquaVisualTxTag>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    uint32_t GetSerializedSize() const override { return 8; }
    void Serialize(TagBuffer buffer) const override { buffer.WriteU64(eventId); }
    void Deserialize(TagBuffer buffer) override { eventId = buffer.ReadU64(); }
    void Print(std::ostream& output) const override { output << eventId; }
    uint64_t eventId = 0;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualTxTag);

struct VisualRx {
    uint32_t dst; int64_t startNs; int64_t durationNs;
    int64_t processingNs = 0; int64_t deliveryNs = -1; int64_t collisionNs = -1; int64_t dropNs = -1;
    bool hasProcessing = false; bool cacheEnded = false;
    std::string status = "pending"; std::string reason;
    std::set<uint64_t> interferers;
};
struct VisualTx { uint32_t src; int64_t startNs; int64_t durationNs; std::vector<VisualRx> receivers; };
static std::vector<VisualTx> visualPackets;
static bool visualReceiveEvents = false;
static std::string VisualJsonString(const std::string& value) {
    const char* hex = "0123456789abcdef";
    std::string encoded(1, '"');
    for (const unsigned char c : value) {
        if (c == '"' || c == '\\') { encoded.push_back('\\'); encoded.push_back(c); }
        else if (c < 32) { encoded += "\\u00"; encoded.push_back(hex[c >> 4]); encoded.push_back(hex[c & 15]); }
        else encoded.push_back(c);
    }
    encoded.push_back('"'); return encoded;
}
static VisualTx* VisualTransmission(Ptr<Packet> packet) {
    AquaVisualTxTag tag;
    if (!packet || !packet->PeekPacketTag(tag) || tag.eventId >= visualPackets.size()) return nullptr;
    return &visualPackets[static_cast<size_t>(tag.eventId)];
}
static VisualRx* VisualReceiver(VisualTx* tx, uint32_t id) {
    if (!tx || tx->src == id) return nullptr;
    for (auto& rx : tx->receivers) if (rx.dst == id) return &rx;
    return nullptr;
}
static void VisualTxTrace(uint32_t id, Ptr<AquaSimPhy> phy, Ptr<Packet> packet, double noise) {
    auto copy = packet->Copy();
    AquaSimPacketStamp stamp; copy->RemoveHeader(stamp);
    auto durationNs = phy->calcTxTime(copy).GetNanoSeconds();
    AquaVisualPhyTimingTag timing;
    if (packet->RemovePacketTag(timing)) {
        timing.airtimeNs = static_cast<uint64_t>(durationNs);
        timing.hasReception = false; timing.receptionEndNs = 0; timing.processingNs = 0;
        packet->AddPacketTag(timing);
    }
    AquaVisualTxTag tag;
    packet->RemovePacketTag(tag);
    tag.eventId = visualPackets.size();
    packet->AddPacketTag(tag);
    visualPackets.push_back({id, Simulator::Now().GetNanoSeconds(), durationNs, {}});
}
static void VisualRxBeginTrace(uint32_t id, Ptr<Packet> packet, Time duration) {
    auto tx = VisualTransmission(packet);
    if (!tx || tx->src == id || VisualReceiver(tx, id)) return;
    tx->receivers.push_back({id, Simulator::Now().GetNanoSeconds(), duration.GetNanoSeconds()});
}
static void VisualRxCollisionTrace(uint32_t id, Ptr<Packet> packet, Ptr<Packet> interferer, std::string reason) {
    auto rx = VisualReceiver(VisualTransmission(packet), id);
    if (!rx) return;
    const auto now = Simulator::Now().GetNanoSeconds();
    if (rx->collisionNs < 0 || now < rx->collisionNs) rx->collisionNs = now;
    if (rx->reason.empty() || reason == "collision_rx_tx") rx->reason = reason;
    rx->status = "fail";
    AquaVisualTxTag other;
    if (interferer && interferer->PeekPacketTag(other) && other.eventId < visualPackets.size())
        rx->interferers.insert(other.eventId);
}
static void VisualRxDropTrace(uint32_t id, Ptr<Packet> packet, std::string reason) {
    auto rx = VisualReceiver(VisualTransmission(packet), id);
    if (!rx) return;
    rx->status = "fail";
    if (rx->reason.empty()) rx->reason = reason;
    rx->dropNs = Simulator::Now().GetNanoSeconds();
}
static void VisualRxEndTrace(uint32_t id, Ptr<Packet> packet) {
    auto rx = VisualReceiver(VisualTransmission(packet), id);
    if (rx) rx->cacheEnded = true;
}
static void VisualRxTrace(uint32_t id, Ptr<Packet> packet, double noise) {
    auto tx = VisualTransmission(packet);
    if (!tx || tx->src == id) return;
    AquaVisualPhyTimingTag timing;
    const bool annotated = packet->PeekPacketTag(timing) && timing.hasReception;
    const auto completionNs = annotated ? static_cast<int64_t>(timing.receptionEndNs) : Simulator::Now().GetNanoSeconds();
    auto rx = VisualReceiver(tx, id);
    if (!rx) {
        tx->receivers.push_back({id, std::max(tx->startNs, completionNs - tx->durationNs), tx->durationNs});
        rx = &tx->receivers.back();
    }
    rx->status = "ok"; rx->reason.clear();
    rx->hasProcessing = annotated;
    if (annotated) rx->processingNs = static_cast<int64_t>(timing.processingNs);
}
static void VisualRxDeliveryTrace(uint32_t id, Ptr<Packet> packet, double noise) {
    auto rx = VisualReceiver(VisualTransmission(packet), id);
    if (rx) rx->deliveryNs = Simulator::Now().GetNanoSeconds();
}
// Verify the declared callback contract before binding an optional public trace.
static bool VisualConnectTrace(Ptr<Object> source, const std::string& name, const std::string& contract, const CallbackBase& callback) {
    if (!source) return false;
    for (auto tid = source->GetInstanceTypeId(); ; tid = tid.GetParent()) {
        for (std::size_t i = 0; i < tid.GetTraceSourceN(); ++i) {
            const auto info = tid.GetTraceSource(i);
            if (info.name == name) return info.callback == contract && source->TraceConnectWithoutContext(name, callback);
        }
        if (tid.GetParent() == tid) break;
    }
    return false;
}
static void VisualConnectReceptionEvents(uint32_t id, Ptr<AquaSimPhy> phy) {
    Ptr<Object> source = phy;
    const auto begin = MakeBoundCallback(&VisualRxBeginTrace, id);
    if (!VisualConnectTrace(source, "RxBegin", "ns3::AquaVisualRxBeginCallback", begin)) {
        source = phy->GetSignalCache();
        if (!VisualConnectTrace(source, "RxBegin", "ns3::AquaVisualRxBeginCallback", begin)) return;
    }
    visualReceiveEvents = true;
    VisualConnectTrace(source, "RxCollision", "ns3::AquaVisualRxCollisionCallback", MakeBoundCallback(&VisualRxCollisionTrace, id));
    VisualConnectTrace(source, "RxDrop", "ns3::AquaVisualRxDropCallback", MakeBoundCallback(&VisualRxDropTrace, id));
    VisualConnectTrace(source, "RxEnd", "ns3::AquaVisualRxEndCallback", MakeBoundCallback(&VisualRxEndTrace, id));
}
static void WriteVisualPackets(std::ostream& output) {
    const auto previousPrecision = output.precision(17);
    output << ",\"packets\":[";
    for (size_t i = 0; i < visualPackets.size(); ++i) {
        if (i) output << ',';
        const auto& tx = visualPackets[i];
        output << "{\"packet_id\":\"phy-" << i << "\",\"src\":" << tx.src
               << ",\"tx_start_us\":" << tx.startNs / 1000.0 << ",\"tx_duration_us\":" << tx.durationNs / 1000.0 << ",\"receivers\":[";
        for (size_t j = 0; j < tx.receivers.size(); ++j) {
            if (j) output << ',';
            const auto& rx = tx.receivers[j];
            const bool pending = rx.status == "pending";
            const std::string status = pending ? "fail" : rx.status;
            const std::string reason = pending ? (rx.cacheEnded ? "outcome_unreported" : "reception_incomplete") : rx.reason;
            output << "{\"dst\":" << rx.dst << ",\"rx_start_us\":" << rx.startNs / 1000.0
                   << ",\"rx_duration_us\":" << rx.durationNs / 1000.0 << ",\"status\":\"" << status << '"';
            if (status != "ok") output << ",\"reason\":" << VisualJsonString(reason);
            if (rx.collisionNs >= 0) output << ",\"collision_start_us\":" << rx.collisionNs / 1000.0;
            if (rx.dropNs >= 0) output << ",\"rx_drop_us\":" << rx.dropNs / 1000.0;
            if (!rx.interferers.empty()) {
                output << ",\"with\":["; bool first = true;
                for (const auto event : rx.interferers) { if (!first) output << ','; first = false; output << "\"phy-" << event << '"'; }
                output << ']';
            }
            if (rx.hasProcessing) output << ",\"rx_processing_duration_us\":" << rx.processingNs / 1000.0;
            if (rx.hasProcessing && rx.deliveryNs >= 0) output << ",\"rx_delivery_us\":" << rx.deliveryNs / 1000.0;
            output << '}';
        }
        output << "]}";
    }
    output << "]}";
    output.precision(previousPrecision);
}
`;

//#endregion
//#region src/features/experiment/lib/observedSignalCache.ts
/** Observability-only subclasses: all reception/collision decisions stay in the selected native cache. */
	const OBSERVED_SIGNAL_CACHE_CC = String.raw`
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/traced-callback.h"
#include <map>
#include <string>
#include <vector>

namespace ns3 {
template <typename Cache>
class AquaVisualObservedCache : public Cache {
public:
    template <typename Concrete>
    static TypeId Register(const char* name) {
        return TypeId(name).template SetParent<Cache>().template AddConstructor<Concrete>()
            .AddTraceSource("RxBegin", "Packet admitted to the native signal cache; actual arrival and receiver airtime.",
                MakeTraceSourceAccessor(&AquaVisualObservedCache::m_rxBegin), "ns3::AquaVisualRxBeginCallback")
            .AddTraceSource("RxCollision", "Native PHY/cache changed this packet to collision; includes an observed interferer when available.",
                MakeTraceSourceAccessor(&AquaVisualObservedCache::m_rxCollision), "ns3::AquaVisualRxCollisionCallback")
            .AddTraceSource("RxDrop", "Packet discarded by the native signal-cache status check.",
                MakeTraceSourceAccessor(&AquaVisualObservedCache::m_rxDrop), "ns3::AquaVisualRxDropCallback")
            .AddTraceSource("RxEnd", "Native signal-cache processing returned; success is reported separately by the PHY.",
                MakeTraceSourceAccessor(&AquaVisualObservedCache::m_rxEnd), "ns3::AquaVisualRxEndCallback");
    }
    void SubmitPkt(Ptr<IncomingPacket> incoming) override {
        auto packet = incoming->packet;
        const auto status = incoming->status;
        const auto found = m_reasons.find(PeekPointer(incoming));
        const std::string reason = found == m_reasons.end() ? "phy_rejected" : found->second;
        if (status != AquaSimPacketStamp::RECEPTION) m_rxDrop(packet, reason);
        Cache::SubmitPkt(incoming);
        m_rxEnd(packet);
        m_reasons.erase(PeekPointer(incoming));
    }
protected:
    void UpdatePacketStatus(Ptr<IncomingPacket> incoming) override {
        struct Before { Ptr<IncomingPacket> packet; AquaSimPacketStamp::PacketStatus status; };
        std::vector<Before> previous;
        for (const auto& band : this->heads) {
            for (auto p = band.second->next; p; p = p->next) {
                if (p != incoming) previous.push_back({p, p->status});
            }
        }
        const bool initiallyCollided = incoming->status == AquaSimPacketStamp::COLLISION;
        std::string initialReason;
        if (initiallyCollided) {
            const auto status = this->m_phy->GetDevice()->GetTransmissionStatus();
            initialReason = status == SEND ? "collision_rx_tx" : status == RECV ? "collision_rx_rx" : "collision";
        }
        m_rxBegin(incoming->packet, this->m_phy->calcTxTime(incoming->packet));
        // Delegate exactly once. No reception status, interference or timing is rewritten here.
        Cache::UpdatePacketStatus(incoming);
        bool paired = false;
        for (const auto& before : previous) {
            if (before.status != AquaSimPacketStamp::COLLISION && before.packet->status == AquaSimPacketStamp::COLLISION) {
                Collision(before.packet, incoming->packet, "collision_rx_rx");
                if (incoming->status == AquaSimPacketStamp::COLLISION) {
                    Collision(incoming, before.packet->packet, initialReason.empty() ? "collision_rx_rx" : initialReason);
                    paired = true;
                }
            }
        }
        if (incoming->status == AquaSimPacketStamp::COLLISION && !paired)
            Collision(incoming, nullptr, initialReason.empty() ? "collision_rx_rx" : initialReason);
    }
    void DoDispose() override {
        m_reasons.clear();
        Cache::DoDispose();
    }
private:
    void Collision(Ptr<IncomingPacket> incoming, Ptr<Packet> interferer, const std::string& reason) {
        auto& known = m_reasons[PeekPointer(incoming)];
        if (known.empty() || reason == "collision_rx_tx") known = reason;
        m_rxCollision(incoming->packet, interferer, known);
    }
    std::map<const IncomingPacket*, std::string> m_reasons;
    ns3::TracedCallback<Ptr<Packet>, Time> m_rxBegin;
    ns3::TracedCallback<Ptr<Packet>, Ptr<Packet>, std::string> m_rxCollision;
    ns3::TracedCallback<Ptr<Packet>, std::string> m_rxDrop;
    ns3::TracedCallback<Ptr<Packet>> m_rxEnd;
};
class AquaVisualSignalCacheRange : public AquaVisualObservedCache<AquaSimSignalCacheRange> {
public:
    static TypeId GetTypeId() {
        static TypeId tid = Register<AquaVisualSignalCacheRange>("ns3::AquaVisualSignalCacheRange");
        return tid;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSignalCacheRange);
class AquaVisualSignalCacheSINR : public AquaVisualObservedCache<AquaSimSignalCacheSINR> {
public:
    static TypeId GetTypeId() {
        static TypeId tid = Register<AquaVisualSignalCacheSINR>("ns3::AquaVisualSignalCacheSINR");
        return tid;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSignalCacheSINR);
} // namespace ns3
`;

//#endregion
//#region src/features/experiment/lib/phyPacketTiming.ts
/** Shared optional packet timing contract for PHY models and the trace adapter. */
	const PHY_PACKET_TIMING_CC = String.raw`
#include "ns3/tag.h"
namespace ns3 {
// Tags are simulator metadata, never transmitted bytes. A receiver may annotate
// successful on-air completion separately from later delivery to the MAC.
class AquaVisualPhyTimingTag : public Tag {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualPhyTimingTag")
            .SetParent<Tag>().AddConstructor<AquaVisualPhyTimingTag>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    uint32_t GetSerializedSize() const override { return 25; }
    void Serialize(TagBuffer buffer) const override {
        buffer.WriteU64(airtimeNs); buffer.WriteU64(receptionEndNs);
        buffer.WriteU64(processingNs); buffer.WriteU8(hasReception ? 1 : 0);
    }
    void Deserialize(TagBuffer buffer) override {
        airtimeNs = buffer.ReadU64(); receptionEndNs = buffer.ReadU64();
        processingNs = buffer.ReadU64(); hasReception = buffer.ReadU8() != 0;
    }
    void Print(std::ostream& out) const override {
        out << "airtime=" << airtimeNs << "ns rxEnd=" << receptionEndNs
            << "ns processing=" << processingNs << "ns";
    }
    uint64_t airtimeNs = 0;
    uint64_t receptionEndNs = 0;
    uint64_t processingNs = 0;
    bool hasReception = false;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualPhyTimingTag);
} // namespace ns3
`;

//#endregion
//#region src/features/experiment/lib/simpleUnderwaterPhy.ts
/** Constant-rate underwater PHY. The installed Cmn PHY owns all medium behavior. */
	const SIMPLE_UNDERWATER_PHY_CC = PHY_PACKET_TIMING_CC + String.raw`
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
`;

//#endregion
//#region src/features/experiment/lib/terrestrialRadio.ts
/** Ideal terrestrial link: finite airtime, light-speed propagation and overlap collisions. */
	const TERRESTRIAL_RADIO_CC = String.raw`
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/abort.h"
#include "ns3/data-rate.h"
#include "ns3/mobility-model.h"
#include "ns3/simulator.h"
#include "ns3/tag.h"
#include <algorithm>
#include <cmath>
#include <memory>
#include <stdexcept>
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
                MakeDataRateChecker())
            .AddTraceSource("RxBegin", "Actual ideal-radio reception attempt.",
                MakeTraceSourceAccessor(&AquaSimRadioPhy::m_rxBegin), "ns3::AquaVisualRxBeginCallback")
            .AddTraceSource("RxCollision", "Collision observed by the ideal-radio medium.",
                MakeTraceSourceAccessor(&AquaSimRadioPhy::m_rxCollision), "ns3::AquaVisualRxCollisionCallback")
            .AddTraceSource("RxDrop", "Actual failed radio reception.",
                MakeTraceSourceAccessor(&AquaSimRadioPhy::m_rxDrop), "ns3::AquaVisualRxDropCallback")
            .AddTraceSource("RxEnd", "Radio reception has ended.",
                MakeTraceSourceAccessor(&AquaSimRadioPhy::m_rxEnd), "ns3::AquaVisualRxEndCallback");
        return tid;
    }
    void SetDataRate(DataRate rate) {
        NS_ABORT_MSG_IF(rate.GetBitRate() == 0, "Radio DataRate must be greater than zero");
        m_rate = rate;
    }
    DataRate GetDataRate() const { return m_rate; }
    void addModulation(Ptr<AquaSimModulation>, int) override {
        throw std::invalid_argument("Ideal radio PHY uses DataRate and does not support acoustic modulation objects");
    }
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
        m_rxBegin(packet, NanoSeconds(tag.nanoseconds));
        reception->collided = Simulator::Now() < m_txEnd;
        if (reception->collided) {
            reception->reason = "collision_rx_tx";
            m_rxCollision(packet, nullptr, reception->reason);
        }
        for (const auto& other : m_receiving) {
            if (other->end > Simulator::Now()) {
                other->collided = true; reception->collided = true;
                if (other->reason.empty()) other->reason = "collision_rx_rx";
                if (reception->reason.empty()) reception->reason = "collision_rx_rx";
                m_rxCollision(other->packet, packet, other->reason);
                m_rxCollision(packet, other->packet, reception->reason);
            }
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
    // Airtime comes directly from DataRate; no acoustic modulation table is needed.
    void initmodulations() override {}
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
    struct Reception { Ptr<Packet> packet; EventId event; Time end; bool collided = false; std::string reason; };
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
        } else {
            m_rxDrop(reception->packet, reception->reason.empty() ? std::string("receiver_unavailable") : reception->reason);
        }
        m_rxEnd(reception->packet);
    }
    ns3::TracedCallback<Ptr<Packet>, Time> m_rxBegin;
    ns3::TracedCallback<Ptr<Packet>, Ptr<Packet>, std::string> m_rxCollision;
    ns3::TracedCallback<Ptr<Packet>, std::string> m_rxDrop;
    ns3::TracedCallback<Ptr<Packet>> m_rxEnd;
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
`;

//#endregion
//#region src/features/experiment/lib/vectorBasedForwarding.ts
/**
	* VBF source package, GPL-2.0-only; original copyright notices retained below.
	* Upstream: https://github.com/spinachAn/aqua-sim-dev
	* Revision: fa7a655f7fbf2c1c2e5a9f1329893d759f1d2f0f
	* Files: src/aqua-sim-tg/model/aqua-sim-routing-vbf.{h,cc}
	* Port details and validation: docs/protocols/vbf.md
	*/
	const VECTOR_BASED_FORWARDING_CC = String.raw`
// Private header retains the upstream byte layout, with signed millimeter coordinates
// and initialized fields. It does not change the installed legacy VBHeader globally.
#include "ns3/aqua-sim-tg-module.h"
#include "ns3/header.h"
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
namespace ns3 {
class AquaVisualVbfHeader : public VBHeader {
public:
    AquaVisualVbfHeader() {
        SetMessType(0); SetPkNum(0); SetTargetAddr(AquaSimAddress(0));
        SetSenderAddr(AquaSimAddress(0)); SetForwardAddr(AquaSimAddress(0));
        SetDataType(0); SetNumForwards(0); SetOriginalSource(Vector());
        SetToken(0); SetTs(0); SetRange(0);
        SetExtraInfo_o(Vector()); SetExtraInfo_f(Vector());
        SetExtraInfo_t(Vector()); SetExtraInfo_d(Vector());
    }
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualVbfHeader")
            .SetParent<VBHeader>().AddConstructor<AquaVisualVbfHeader>();
        return tid;
    }
    TypeId GetInstanceTypeId() const override { return GetTypeId(); }
    void Serialize(Buffer::Iterator i) const override {
        // Legacy getters are non-const; serialize a value copy.
        auto h = *this;
        i.WriteU8(h.GetMessType()); i.WriteU32(h.GetPkNum());
        i.WriteU16(h.GetTargetAddr().GetAsInt()); i.WriteU16(h.GetSenderAddr().GetAsInt());
        i.WriteU16(h.GetForwardAddr().GetAsInt()); i.WriteU8(h.GetDataType());
        i.WriteU16(h.GetNumForwards()); WriteVector(i, h.GetOriginalSource());
        i.WriteU32(h.GetToken()); i.WriteU32(h.GetTs()); i.WriteU32(h.GetRange());
        auto extra = h.GetExtraInfo();
        WriteVector(i, extra.o); WriteVector(i, extra.f);
        WriteVector(i, extra.t); WriteVector(i, extra.d);
    }
    uint32_t Deserialize(Buffer::Iterator i) override {
        SetMessType(i.ReadU8()); SetPkNum(i.ReadU32());
        SetTargetAddr(AquaSimAddress(i.ReadU16())); SetSenderAddr(AquaSimAddress(i.ReadU16()));
        SetForwardAddr(AquaSimAddress(i.ReadU16())); SetDataType(i.ReadU8());
        SetNumForwards(i.ReadU16()); SetOriginalSource(ReadVector(i));
        SetToken(i.ReadU32()); SetTs(i.ReadU32()); SetRange(i.ReadU32());
        SetExtraInfo_o(ReadVector(i)); SetExtraInfo_f(ReadVector(i));
        SetExtraInfo_t(ReadVector(i)); SetExtraInfo_d(ReadVector(i));
        return GetSerializedSize();
    }
private:
    static void WriteVector(Buffer::Iterator& i, const Vector& v) {
        for (const auto value : {v.x, v.y, v.z}) {
            const double mm = std::round(value * 1000.0);
            if (!std::isfinite(mm) || mm < std::numeric_limits<int32_t>::min()
                || mm > std::numeric_limits<int32_t>::max())
                throw std::runtime_error("VBF coordinate exceeds signed millimeter header range");
            i.WriteU32(static_cast<uint32_t>(static_cast<int32_t>(mm)));
        }
    }
    static Vector ReadVector(Buffer::Iterator& i) {
        const auto read = [&i]() {
            const uint32_t raw = i.ReadU32();
            const int64_t mm = raw <= INT32_MAX ? int64_t(raw) : int64_t(raw) - (int64_t(1) << 32);
            return static_cast<double>(mm) / 1000.0;
        };
        const double x = read(), y = read(), z = read();
        return Vector(x, y, z);
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualVbfHeader);
} // namespace ns3

/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/*
 * Copyright (c) 2016 University of Connecticut
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation;
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 * Author: Robert Martin <robert.martin@engr.uconn.edu>
 */

#ifndef AQUA_SIM_ROUTING_VBF_H
#define AQUA_SIM_ROUTING_VBF_H

#include "ns3/aqua-sim-address.h"
#include "ns3/aqua-sim-channel.h"
#include "ns3/aqua-sim-datastructure.h"
#include "ns3/aqua-sim-routing.h"

#include "ns3/packet.h"
#include "ns3/random-variable-stream.h"
#include "ns3/vector.h"

#include <map>

namespace ns3
{


struct vbf_neighborhood
{
    int number;
    Vector neighbor[MAX_NEIGHBOR];
};

typedef std::pair<AquaSimAddress, unsigned int> hash_entry;

/**
 * \ingroup aqua-sim-ng
 *
 * \brief Packet Hash table for VBF to assist in specialized tables.
 */
class AquaSimPktHashTable
{
  public:
    std::map<hash_entry, vbf_neighborhood*> m_htable;
    // std::map<hash_t, hash_entry> m_htable;

    AquaSimPktHashTable();
    ~AquaSimPktHashTable();

    int m_windowSize{WINDOW_SIZE};
    void Reset();
    void PutInHash(AquaSimAddress sAddr, unsigned int pkNum);
    void PutInHash(AquaSimAddress sAddr, unsigned int pkNum, Vector p);
    vbf_neighborhood* GetHash(AquaSimAddress senderAddr, unsigned int pkt_num);
    // private:
    // int lower_counter;
}; // class AquaSimPktHashTable

/**
 * \brief Packet Hash table for VBF to assist in specialized tables.
 */
class AquaSimDataHashTable
{
  public:
    std::map<int*, int*> m_htable;
    // Tcl_HashTable htable;

    AquaSimDataHashTable();
    ~AquaSimDataHashTable();

    void Reset();
    void PutInHash(int* attr);
    int* GetHash(int* attr);
}; // class AquaSimDataHashTable

/**
 * \brief Vector Based Forwarding
 * http://engr.uconn.edu/~jcui/UWSN_papers/vbf_networking2006.pdf
 */
class AquaSimVBF : public AquaSimRouting
{
  public:
    AquaSimVBF();
    static TypeId GetTypeId();
    int64_t AssignStreams(int64_t stream) override;
    bool TxProcess(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber) override;
    bool Recv(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber) override;

    void SetTargetPos(Vector pos);
    // AquaSimVBF_Entry routing_table[MAX_DATA_TYPE];

  protected:
    int m_pkCount;
    int m_counter;
    int m_hopByHop;
    int m_enableRouting; // if true, VBF can perform routing functionality. Otherwise, not perform
    // int m_useOverhear;
    double m_priority;
    bool m_measureStatus;
    // int m_portNumber;
    AquaSimPktHashTable PktTable;
    AquaSimPktHashTable SourceTable;
    AquaSimPktHashTable Target_discoveryTable;
    AquaSimPktHashTable SinkTable;

    double m_width;
    // the width is used to test if the node is close enough to the path specified by the packet
    Vector m_targetPos;
    Ptr<UniformRandomVariable> m_rand;

    void Terminate();
    void Reset();
    void ConsiderNew(Ptr<Packet> pkt);
    void SetDelayTimer(Ptr<Packet>, double);
    void Timeout(Ptr<Packet>);
    double Advance(Ptr<Packet>);
    double Distance(Ptr<Packet>);
    double Projection(Ptr<Packet>);
    double CalculateDelay(Ptr<Packet>, Vector*);
    // double RecoveryDelay(Ptr<Packet>, Vector*);
    void CalculatePosition(Ptr<Packet>);
    void SetMeasureTimer(Ptr<Packet>, double);
    bool IsTarget(Ptr<Packet>);
    bool IsCloseEnough(Ptr<Packet>);

    Ptr<Packet> CreatePacket();
    Ptr<Packet> PrepareMessage(unsigned int dtype, AquaSimAddress to_addr, int msg_type);

    void DataForSink(Ptr<Packet> pkt);
    void StopSource();
    void MACprepare(Ptr<Packet> pkt);
    void MACsend(Ptr<Packet> pkt, double delay = 0);

    void DoDispose() override;
}; // class AquaSimVBF

} // namespace ns3

#endif /* AQUA_SIM_ROUTING_VBF_H */

/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/*
 * Copyright (c) 2016 University of Connecticut
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation;
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 * Author: Robert Martin <robert.martin@engr.uconn.edu>
 */


#include "ns3/aqua-sim-header-routing.h"
#include "ns3/aqua-sim-header.h"
#include "ns3/aqua-sim-propagation.h"
#include "ns3/aqua-sim-pt-tag.h"
#include "ns3/aqua-sim-trailer.h"

#include "ns3/double.h"
#include "ns3/integer.h"
#include "ns3/log.h"
#include "ns3/mobility-model.h"
#include "ns3/simulator.h"

#include <iostream>
namespace ns3 {

NS_LOG_COMPONENT_DEFINE("AquaSimVBF");

AquaSimPktHashTable::AquaSimPktHashTable()
{
    NS_LOG_FUNCTION(this);
    //  lower_counter=0;
    // 50 items in the hash table, however, because it begins by 0, so, minus 1
    // Tcl_InitHashTable(&m_htable, 3);
}

AquaSimPktHashTable::~AquaSimPktHashTable()
{
    NS_LOG_FUNCTION(this);
    for (std::map<hash_entry, vbf_neighborhood*>::iterator it = m_htable.begin();
         it != m_htable.end();
         ++it)
    {
        delete it->second;
    }
    m_htable.clear();
}

void
AquaSimPktHashTable::Reset()
{
    for (const auto& entry : m_htable) delete entry.second;
    m_htable.clear();
    /*
      vbf_neighborhood *hashPtr;
      Tcl_HashEntry *entryPtr;
      Tcl_HashSearch searchPtr;

      entryPtr = Tcl_FirstHashEntry(&m_htable, &searchPtr);
      while (entryPtr != NULL) {
          hashPtr = (vbf_neighborhood *)Tcl_GetHashValue(entryPtr);
          delete hashPtr;
          Tcl_DeleteHashEntry(entryPtr);
          entryPtr = Tcl_NextHashEntry(&searchPtr);
      }
    */
}

vbf_neighborhood*
AquaSimPktHashTable::GetHash(AquaSimAddress senderAddr, unsigned int pk_num)
{
    hash_entry entry = std::make_pair(senderAddr, pk_num);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;

    it = m_htable.find(entry);

    if (it == m_htable.end())
    {
        return NULL;
    }

    return it->second;
    /*
    unsigned int key[3];

      key[0] = senderAddr;
      key[1] = 0; //sender_id.port_;
      key[2] = pk_num;

      Tcl_HashEntry *entryPtr = Tcl_FindHashEntry(&m_htable, (char *)key);

      if (entryPtr == NULL )
          return NULL;

      return (vbf_neighborhood *)Tcl_GetHashValue(entryPtr);
    */
}

void
AquaSimPktHashTable::PutInHash(AquaSimAddress sAddr, unsigned int pkNum)
{
    // Tcl_HashEntry *entryPtr;
    //  Pkt_Hash_Entry    *hashPtr;
    vbf_neighborhood* hashPtr;
    // unsigned int key[3];
    // bool newPtr = true;

    // key[1]=0; //(vbh->sender_id).port_;
    hash_entry entry = std::make_pair(sAddr, pkNum);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;

    const auto k = pkNum > static_cast<unsigned>(m_windowSize) ? pkNum - m_windowSize : 0;
    if (k > 0) // TODO verify this in future work
    {
        auto old = m_htable.lower_bound(std::make_pair(sAddr, 0u));
        while (old != m_htable.end() && old->first.first == sAddr && old->first.second < k)
        {
            delete old->second;
            old = m_htable.erase(old);
        }
    }

    entry.second = pkNum;
    hashPtr = GetHash(sAddr, pkNum);
    // entryPtr = Tcl_CreateHashEntry(&m_htable, (char *)key, &newPtr);
    if (hashPtr != NULL)
    {
        int m = hashPtr->number;
        if (m < MAX_NEIGHBOR)
        {
            hashPtr->number++;
            hashPtr->neighbor[m].x = 0;
            hashPtr->neighbor[m].y = 0;
            hashPtr->neighbor[m].z = 0;
        }
        return;
    }
    hashPtr = new vbf_neighborhood();
    hashPtr->number = 1;
    hashPtr->neighbor[0].x = 0;
    hashPtr->neighbor[0].y = 0;
    hashPtr->neighbor[0].z = 0;
    std::pair<hash_entry, vbf_neighborhood*> newPair;
    newPair.first = entry;
    newPair.second = hashPtr;
    if (m_htable.insert(newPair).second == false)
    {
        delete newPair.second;
    }
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

void
AquaSimPktHashTable::PutInHash(AquaSimAddress sAddr, unsigned int pkNum, Vector p)
{
    NS_LOG_DEBUG("PutinHash begin:" << sAddr << "," << pkNum << ",(" << p.x << "," << p.y << ","
                                    << p.z << ")");
    // Tcl_HashEntry *entryPtr;
    //  Pkt_Hash_Entry    *hashPtr;
    vbf_neighborhood* hashPtr;
    // unsigned int key[3];
    // bool newPtr = true;

    // key[1]=0; //(vbh->sender_id).port_;
    hash_entry entry = std::make_pair(sAddr, pkNum);
    std::map<hash_entry, vbf_neighborhood*>::iterator it;
    const auto k = pkNum > static_cast<unsigned>(m_windowSize) ? pkNum - m_windowSize : 0;
    if (k > 0)
    {
        auto old = m_htable.lower_bound(std::make_pair(sAddr, 0u));
        while (old != m_htable.end() && old->first.first == sAddr && old->first.second < k)
        {
            delete old->second;
            old = m_htable.erase(old);
        }
    }

    entry.second = pkNum;
    hashPtr = GetHash(sAddr, pkNum);
    // entryPtr = Tcl_CreateHashEntry(&m_htable, (char *)key, &newPtr);
    if (hashPtr != NULL)
    {
        int m = hashPtr->number;
        // printf("hash_table: this is not old item, there are %d item inside\n",m);
        if (m < MAX_NEIGHBOR)
        {
            hashPtr->number++;
            hashPtr->neighbor[m].x = p.x;
            hashPtr->neighbor[m].y = p.y;
            hashPtr->neighbor[m].z = p.z;
        }
        return;
    }
    hashPtr = new vbf_neighborhood();
    hashPtr->number = 1;
    hashPtr->neighbor[0].x = p.x;
    hashPtr->neighbor[0].y = p.y;
    hashPtr->neighbor[0].z = p.z;
    std::pair<hash_entry, vbf_neighborhood*> newPair;
    newPair.first = entry;
    newPair.second = hashPtr;
    if (m_htable.insert(newPair).second == false)
    {
        delete newPair.second;
    }
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

AquaSimDataHashTable::AquaSimDataHashTable()
{
    NS_LOG_FUNCTION(this);
    Reset();
    // Tcl_InitHashTable(&htable, MAX_ATTRIBUTE);
}

AquaSimDataHashTable::~AquaSimDataHashTable()
{
    NS_LOG_FUNCTION(this);
    Reset();
}

void
AquaSimDataHashTable::Reset()
{
    for (std::map<int*, int*>::iterator it = m_htable.begin(); it != m_htable.end(); ++it)
    {
        delete it->first;
        delete it->second;
    }
    m_htable.clear();
    /*
      Tcl_HashEntry *entryPtr;
      Tcl_HashSearch searchPtr;

      entryPtr = Tcl_FirstHashEntry(&htable, &searchPtr);
      while (entryPtr != NULL) {
          Tcl_DeleteHashEntry(entryPtr);
          entryPtr = Tcl_NextHashEntry(&searchPtr);
      }
    */
}

int*
AquaSimDataHashTable::GetHash(int* attr)
{
    std::map<int*, int*>::iterator it;
    it = m_htable.find(attr);
    if (it == m_htable.end())
    {
        return NULL;
    }

    return it->second;
}

void
AquaSimDataHashTable::PutInHash(int* attr)
{
    // bool newPtr = true;

    // Tcl_HashEntry* entryPtr=Tcl_CreateHashEntry(&htable, (char *)attr, &newPtr);
    if (m_htable.count(attr) > 0)
    {
        return;
    }

    int* hashPtr = new int[1];
    hashPtr[0] = 1;
    m_htable.insert(std::pair<int*, int*>(attr, hashPtr));
    // Tcl_SetHashValue(entryPtr, hashPtr);
}

NS_OBJECT_ENSURE_REGISTERED(AquaSimVBF);

AquaSimVBF::AquaSimVBF()
{
    // Initialize variables.
    //  printf("VB initialized\n");
    m_pkCount = 0;
    // TODO
    m_width = 2500;
    // m_width=0;
    m_counter = 0;
    m_priority = 1.2;
    // m_priority=2;
    // m_useOverhear = 0;
    m_enableRouting = 1;
    m_targetPos = Vector();
    m_rand = CreateObject<UniformRandomVariable>();
}

TypeId
AquaSimVBF::GetTypeId()
{
    static TypeId tid = TypeId("ns3::AquaSimVBF")
                            .SetParent<AquaSimRouting>()
                            .AddConstructor<AquaSimVBF>()
                            .AddAttribute("HopByHop",
                                          "Hop by hop VBF setting. Default 0 is false.",
                                          IntegerValue(0),
                                          MakeIntegerAccessor(&AquaSimVBF::m_hopByHop),
                                          MakeIntegerChecker<int>())
                            .AddAttribute("EnableRouting",
                                          "Enable routing VBF setting. Default 1 is true.",
                                          IntegerValue(1),
                                          MakeIntegerAccessor(&AquaSimVBF::m_enableRouting),
                                          MakeIntegerChecker<int>())
                            .AddAttribute("Width",
                                          "Radius of the VBF forwarding pipe in meters. Default is 2500.",
                                          DoubleValue(2500),
                                          // DoubleValue(100),
                                          MakeDoubleAccessor(&AquaSimVBF::m_width),
                                          MakeDoubleChecker<double>(std::numeric_limits<double>::min()))
                            .AddAttribute("TargetPos",
                                          "Position of target sink (x,y,z).",
                                          Vector3DValue(),
                                          MakeVector3DAccessor(&AquaSimVBF::m_targetPos),
                                          MakeVector3DChecker());
    return tid;
    // bind("m_useOverhear_", &m_useOverhear);
}

int64_t
AquaSimVBF::AssignStreams(int64_t stream)
{
    NS_LOG_FUNCTION(this << stream);
    m_rand->SetStream(stream);
    return 1;
}

// 传输层调用Txprocess
bool
AquaSimVBF::TxProcess(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber)
{
    AquaVisualVbfHeader vbh;

    vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(m_device->GetAddress()));
    vbh.SetTargetAddr(AquaSimAddress::ConvertFrom(dest));
    packet->AddHeader(vbh);

    return Recv(packet, dest, protocolNumber);
}

// MAC层的包调用Recv
bool
AquaSimVBF::Recv(Ptr<Packet> packet, const Address& dest, uint16_t protocolNumber)
{
    NS_LOG_FUNCTION(this);
    NS_LOG_DEBUG("================Recv=================\n");

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    packet->RemoveHeader(vbh);
    packet->RemoveTrailer(tra);
    // std::cout<<"Recv packet:"<<packet<<"\n";
    // std::cout<<"ash.GetNumForwards:"<<ash.GetNumForwards()<<"\n";
    if (vbh.GetMessType() != AS_DATA)
    {
        // no headers //TODO create specalized Application instead of using this hack.// how many
        // times this pkt was forwarded
        tra.SetNextHop(AquaSimAddress::GetBroadcast());
        tra.SetSAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        tra.SetDAddr(AquaSimAddress::ConvertFrom(dest));

        vbh.SetMessType(AS_DATA);
        vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
        vbh.SetTargetAddr(AquaSimAddress::ConvertFrom(dest));
        vbh.SetPkNum(packet->GetUid());

        // set position error    //todo

        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();

        // todo
        // GetDevice()->SetRouting(this);
        vbh.SetOriginalSource(sModel->GetPosition());
        vbh.SetExtraInfo_f(sModel->GetPosition());

        vbh.SetExtraInfo_t(m_targetPos);
        vbh.SetExtraInfo_o(sModel->GetPosition());
        NS_LOG_DEBUG("source position:x:" << sModel->GetPosition().x
                  << " y:" << sModel->GetPosition().y << " z:" << sModel->GetPosition().z);
        NS_LOG_DEBUG("Recv-addheader\n");

        packet->AddHeader(vbh);
    }
    else
    {
        packet->AddHeader(vbh);
        packet->PeekHeader(vbh);
        // ignoring forward iterator, but this can be simply changed if necessary
    }

    packet->AddTrailer(tra);
    // unsigned char msg_type =vbh.GetMessType();  //unused
    // unsigned int dtype = vbh.GetDataType();  //unused
    // double t1=vbh.GetTs();  //unused

    if (!m_enableRouting)
    {
        if (vbh.GetMessType() != AS_DATA)
        {
            packet = 0;
            NS_LOG_DEBUG("vbf recv vbh.GetMessType() != AS_DATA vbh.GetMessType():"
                      << vbh.GetMessType());
            return false;
        }
        NS_LOG_DEBUG("vbh.GetTargetAddr():" << vbh.GetTargetAddr() << " GetDevice()->GetAddress()"
                  << GetDevice()->GetAddress());

        if (vbh.GetSenderAddr() == GetDevice()->GetAddress())
        {
            MACprepare(packet);
            MACsend(packet, (m_rand->GetValue() * JITTER));
            NS_LOG_DEBUG("Recv macsend\n");
        }
        else if (vbh.GetTargetAddr() == GetDevice()->GetAddress())
        {
            DataForSink(packet);
            NS_LOG_DEBUG("Recv data for sink\n");
        }
        return true;
    }

    vbf_neighborhood* hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
    // Received this packet before ?

    if (hashPtr != NULL)
    {
        PktTable.PutInHash(vbh.GetSenderAddr(), vbh.GetPkNum(), vbh.GetExtraInfo().f);
        packet = 0;
        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();
        NS_LOG_DEBUG("hashPtr != NULL position.x:" << sModel->GetPosition().x
                  << "position.y:" << sModel->GetPosition().y
                  << "position.z:" << sModel->GetPosition().z);
        NS_LOG_DEBUG("vbf hashPtr != null");
        return false;
        // printf("vectrobasedforward: this is duplicate packet\n");
    }
    else
    {
        // Never receive it before ? Put in hash table.
        // printf("vectrobasedforward: this is new packet\n");
        NS_LOG_DEBUG("Recv nevev receive it before\n");
        PktTable.PutInHash(vbh.GetSenderAddr(), vbh.GetPkNum(), vbh.GetExtraInfo().f);

        Ptr<Object> sObject = GetDevice()->GetNode();
        Ptr<MobilityModel> sModel = sObject->GetObject<MobilityModel>();
        // Todo
        NS_LOG_DEBUG("position.x:" << sModel->GetPosition().x
                  << "position.y:" << sModel->GetPosition().y
                  << "position.z:" << sModel->GetPosition().z);
        // todo end
        Vector forwarder = vbh.GetExtraInfo().f;

        packet->RemoveHeader(vbh);
        Vector d = Vector(sModel->GetPosition().x - forwarder.x,
                          sModel->GetPosition().y - forwarder.y,
                          sModel->GetPosition().z - forwarder.z);
        vbh.SetExtraInfo_d(d);
        packet->AddHeader(vbh);

        ConsiderNew(packet);
    }

    return true;
}

void
AquaSimVBF::ConsiderNew(Ptr<Packet> pkt)
{
    // std::cout << "===========vbf: considerNew===========\n";
    NS_LOG_FUNCTION(this);

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->PeekHeader(vbh);
    // Todo
    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;
    NS_LOG_DEBUG("consider new begin : Advance target position is:" << tx << "," << ty << "," << tz
              << '\n');
    Vector pos = GetDevice()->GetPosition();
    NS_LOG_DEBUG("consider new begin : Advance current position is:" << pos.x << "," << pos.y << ","
              << pos.z << '\n');
    // todo end

    unsigned char msg_type = vbh.GetMessType();
    // unsigned int dtype = vbh.GetDataType();  //unused
    double l; //,h;  //unused
              // JITTER=0.1;use to generate random
    // Pkt_Hash_Entry *hashPtr;
    vbf_neighborhood* hashPtr;
    //  Agent_List *agentPtr;
    // PrvCurPtr  RetVal;
    AquaSimAddress from_nodeAddr; //, forward_nodeAddr;zhuan fa qi

    Ptr<Packet> gen_pkt;
    AquaVisualVbfHeader gen_vbh;

    //  printf("Vectorbasedforward:oops!\n");
    switch (msg_type)
    {
    case INTEREST:
        NS_LOG_DEBUG("===========vbf: INTEREST===========\n");
        // printf("Vectorbasedforward:it is interest packet!\n");
        hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
        NS_LOG_INFO("ConsiderNew: INTEREST, hashptr #=" << hashPtr->number);
        // Check if it comes from sink agent of this node
        // If so we have to keep it in sink list

        from_nodeAddr = vbh.GetSenderAddr();
        // forward_nodeAddr = vbh.GetForwardAddr();
        //   printf("Vectorbasedforward:it the from_nodeaddr is %d %d  and theb this node id is %d
        //   ,%d!\n", from_nodeAddr,from_nodeID.port_,THIS_NODE.addr_,THIS_NODE.port_ );

        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
            //  printf("vectorbasedforward: after MACprepare(pkt)\n");
        }
        else
        {
            // CalculatePosition(pkt); not necessary with mobilitymodel
            // printf("vectorbasedforward: This packet is from different node\n");
            if (IsTarget(pkt))
            {
                // If this node is target?
                l = Advance(pkt); // l=0?

                //    if (!SendUp(p))
                //	     NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to
                // dmux.");
                //  printf("vectorbasedforward:%d send out the source-discovery \n",here_.addr_);
                //  pkt->RemoveHeader(ash);
                pkt->RemoveHeader(vbh);
                vbh.SetMessType(SOURCE_DISCOVERY);
                pkt->AddHeader(vbh);
                // pkt->AddHeader(ash);
                SetDelayTimer(pkt, l * JITTER);
                // !!! need to re-think
            }
            else
            {
                // CalculatePosition(pkt);
                // No the target forwared
                l = Advance(pkt);
                // h=Projection(pkt);  //never used...
                if (IsCloseEnough(pkt))
                {
                    // printf("vectorbasedforward:%d I am close enough for the
                    // interest\n",here_.addr_);
                    MACprepare(pkt);
                    MACsend(pkt, m_rand->GetValue() * JITTER); //!!!! need to re-think
                }
                else
                {
                    //  printf("vectorbasedforward:%d I am not close enough for the interest
                    //  \n",here_.addr_);
                    pkt = 0;
                }
            }
        }
        // pkt=0;
        return;

    case TARGET_DISCOVERY:
        NS_LOG_DEBUG("===========vbf: Target_DISCOVERY==========\n");
        // from other nodes hitted by the packet, it is supposed
        // to be the one hop away from the sink

        // printf("Vectorbasedforward(%d,%d):it is target-discovery  packet(%d)! it target id is %d
        // coordinate is %f,%f,%f and range is
        // %f\n",here_.addr_,here_.port_,vbh.GetPkNum(),vbh.GetTargetAddr(),vbh.GetExtraInfo().t.x,
        // vbh.GetExtraInfo().t.y,vbh.GetExtraInfo().t.z,vbh.GetRange());
        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            // printf("Vectorbasedforward(%d,??%d):it is target-discovery  packet(%d)! it target id
            // is %d  coordinate is %f,%f,%f and range is
            // %f\n",here_.addr_,here_.port_,vbh.GetPkNum(),vbh.GetTargetAddr(),vbh.GetExtraInfo().t.x,
            // vbh.GetExtraInfo().t.y,vbh.GetExtraInfo().t.z,vbh.GetRange());
            //  AquaSimAddress *hashPtr= PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
            //  Received this packet before ?
            //  if (hashPtr == NULL) {

            // CalculatePosition(pkt); not necessary with mobilitymodel
            DataForSink(pkt);
            NS_LOG_INFO("AquaSimVBF::ConsiderNew: target is " << GetDevice()->GetAddress());
            // } //New data Process this data
            //
        }
        else
        {
            pkt = 0;
        }
        return;

    case SOURCE_DISCOVERY:
        NS_LOG_DEBUG("===========vbf: source_discovery===========\n");
        pkt = 0;
        // other nodes already claim to be the source of this interest
        //   SourceTable.PutInHash(vbh);
        return;

    case DATA_READY:
        NS_LOG_DEBUG("===========vbf:data_ready==========\n");
        //  printf("Vectorbasedforward(%d,%d):it is data ready packet(%d)! it target id is %d
        //  \n",here_.addr_,here_.port_,vbh->pk_num,vbh->target_id.addr_);
        from_nodeAddr = vbh.GetSenderAddr();
        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            // come from the same node, broadcast it
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
            return;
        }
        // CalculatePosition(pkt); not necessary with mobilitymodel
        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            NS_LOG_INFO("AquaSimVBF::ConsiderNew: target is " << GetDevice()->GetAddress());
            DataForSink(pkt); // process it
        }
        else
        {
            // printf("Vectorbasedforward: %d is the not  target\n", here_.addr_);
            MACprepare(pkt);
            MACsend(pkt, m_rand->GetValue() * JITTER);
        }
        return;

        /*
           case DATA_READY :

           // put source_agent in source list of routing table
           agentPtr = new Agent_List;
           AGT_ADDR(agentPtr) = vbh.GetSenderAddr();
           agentPtr->next = routing_table[dtype].source;
           routing_table[dtype].source = agentPtr;

           // !! this part will be modified later
           God::instance()->AddSource(dtype, (vbh.GetSenderAddr()));

           gen_pkt = PrepareMessage(dtype, vbh.GetSenderAddr(), DATA_REQUEST);
           gen_vbh = HDR_UWVB(gen_pkt);
           //      gen_vbh->report_rate = ORIGINAL;
         if (!SendUp(p))
            NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to dmux.");
           pkt=0;
           return;
         */

    case AS_DATA:
        NS_LOG_DEBUG("===========vbf: as data===========\n");
        NS_LOG_INFO("AquaSimVBF::ConsiderNew: data packet");

        // std::cout<<"considerNew as_data current
        // node:"<<GetDevice()->GetNode()->GetObject<Node>()->GetId()<<"\n"; std::cout<< "Node
        // "<<AquaSimAddress::ConvertFrom(m_device->GetAddress()).GetAsInt()<<" MAC Layer Send
        // down"<<std::endl; std::cout<<"considerNew as_data current node
        // position:"<<GetDevice()->GetAddress()<<"\n"; printf("Vectorbasedforward(%d,%d):it is data
        // packet(%d)! it target id is %d  coordinate is %f,%f,%f and range is
        // %f\n",here_.addr_,here_.port_,vbh->pk_num,vbh->target_id.addr_,vbh->info.tx,
        // vbh->info.ty,vbh->info.tz,vbh->range); printf("Vectorbasedforward(%d):it is data
        // packet(%d)\n",here_.addr_,vbh->pk_num);
        from_nodeAddr = vbh.GetSenderAddr();
        // TODO
        if (GetDevice()->GetAddress() == from_nodeAddr)
        {
            // come from the same node, broadcast it
            NS_LOG_DEBUG("considerNew_MACsssend\n");
            MACprepare(pkt);
            MACsend(pkt, 0);
            return;
        }
        // CalculatePosition(pkt); not necessary with mobilitymodel
        //   printf("vectorbasedforward: after MACprepare(pkt)\n");
        l = Advance(pkt);
        // h=Projection(pkt);  //never used...
        NS_LOG_DEBUG("considerNew as_data forwardnodeaddr:" << vbh.GetSenderAddr() << "\n");
        NS_LOG_DEBUG("considerNew_as_data l:" << l << "\n");

        if (GetDevice()->GetAddress() == vbh.GetTargetAddr())
        {
            // printf("Vectorbasedforward: %d is the target\n", here_.addr_);
            DataForSink(pkt); // process it
            NS_LOG_DEBUG("considerNew_as_data data for sink\n");
        }

        else
        {
            //  printf("Vectorbasedforward: %d is the not  target\n", here_.addr_);
            // TODO iscloseenough return false,surely,so pkt=0
            if (IsCloseEnough(pkt))
            {
                NS_LOG_DEBUG("ConsiderNew as_data isclosenough\n");
                Vector* p1;
                p1 = new Vector[1];
                p1[0].x = vbh.GetExtraInfo().f.x;
                p1[0].y = vbh.GetExtraInfo().f.y;
                p1[0].z = vbh.GetExtraInfo().f.z;
                double delay = CalculateDelay(
                    pkt,
                    p1); // TODO should just pass the Vector for easier memory management here.
                delete[] p1;
                double d2 = (Distance(pkt) - m_device->GetPhy()->GetTransRange()) /
                            ns3::SOUND_SPEED_IN_WATER; // gettransrange=0
                // printf("Vectorbasedforward: I am  not  target delay is %f d2=%f
                // distance=%f\n",(sqrt(delay)*DELAY+d2*2),d2,Distance(pkt)); std::cout << "DElay is
                // " << (sqrt(delay)*DELAY+d2*2) << " d2 is " << d2 << " distance is " <<
                // Distance(pkt) << "\n";
                SetDelayTimer(pkt, (sqrt(delay) * DELAY + d2 * 2)); // set Tdelay=1.0
            }
            else
            {
                pkt = 0;
            }
        }
        return;

    default:

        pkt = 0;
        break;
    }
}

void
AquaSimVBF::Reset()
{
    PktTable.Reset();
    /*
       for (int i=0; i<MAX_DATA_TYPE; i++) {
       routing_table[i].Reset();
       }
     */
}

void
AquaSimVBF::Terminate()
{
    NS_LOG_DEBUG("AquaSimVBF::Terminate: Node="
                 << GetDevice()->GetAddress()
                 << ": remaining energy=" << GetDevice()->GetEnergyModel()->GetEnergy()
                 << ", initial energy=" << GetDevice()->GetEnergyModel()->GetInitialEnergy());
}

void
AquaSimVBF::StopSource()
{
    /*
       Agent_List *cur;

       for (int i=0; i<MAX_DATA_TYPE; i++) {
       for (cur=routing_table[i].source; cur!=NULL; cur=AGENT_NEXT(cur) ) {
       SEND_MESSAGE(i, AGT_ADDR(cur), DATA_STOP);
       }
       }
     */
}

Ptr<Packet>
AquaSimVBF::CreatePacket()
{
    NS_LOG_FUNCTION(this);

    Ptr<Packet> pkt = Create<Packet>();

    if (!pkt)
    {
        return NULL;
    }

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;
    // ash.SetSize(36);
    vbh.SetTs(Simulator::Now().ToDouble(Time::S));

    //!! I add new part

    vbh.SetExtraInfo_o(GetDevice()->GetPosition());
    vbh.SetExtraInfo_f(GetDevice()->GetPosition());

    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);
    return pkt;
}

Ptr<Packet>
AquaSimVBF::PrepareMessage(unsigned int dtype, AquaSimAddress to_addr, int msg_type)
{
    NS_LOG_DEBUG("-----------vbf PrepareMessage-----------\n");
    Ptr<Packet> pkt = Create<Packet>();
    AquaVisualVbfHeader vbh;

    vbh.SetMessType(msg_type);
    vbh.SetPkNum(m_pkCount);
    m_pkCount++;
    vbh.SetSenderAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));
    vbh.SetDataType(dtype);
    vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));

    vbh.SetTs(Simulator::Now().ToDouble(Time::S));
    //    vbh->num_next = 1;
    // I am not sure if we need this
    // vbh->next_nodes[0] = to_addr;

    // I am not sure if we need it?
    /*
       iph->src_ = here_;
       iph->dst_ = to_addr;
     */
    pkt->AddHeader(vbh);

    return pkt;
}

void
AquaSimVBF::MACprepare(Ptr<Packet> pkt)
{
    // std::cout << "-----------vbf MACprepare-----------\n";
    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->RemoveHeader(vbh);
    pkt->RemoveTrailer(tra);
    vbh.SetForwardAddr(AquaSimAddress::ConvertFrom(GetDevice()->GetAddress()));

    // printf("vectorbased: the mac_Broadcast is:%d\n",MAC_BROADCAST);
    tra.SetNextHop(AquaSimAddress::GetBroadcast());
    // ash.addr_type() = NS_AF_ILINK;
    //  ash.SetTxTime(Seconds(0));
    //  printf("vectorbased: the address type is :%d and suppose to be %d and  nexthop %d MAC_BROAD
    //  %d\n", ash->addr_type(),NS_AF_ILINK,ash->next_hop(),MAC_BROADCAST);
    // ash.SetDirection(AquaSimHeader::DOWN);

    /*if(!GetDevice()->GetSinkStatus()) {       //!! I add new part
    f = Vector(GetDevice()->CX(),
                  GetDevice()->CY(),
                  GetDevice()->CZ());
    }
    else{*/
    Ptr<MobilityModel> model = GetDevice()->GetNode()->GetObject<MobilityModel>();
    //}
    vbh.SetExtraInfo_f(model->GetPosition());

    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);
    // printf("vectorbasedforward: last line MACprepare\n");
}

void
AquaSimVBF::MACsend(Ptr<Packet> pkt, double delay)
{
    // std::cout << "-----------vbf MACsend-----------\n";
    NS_LOG_INFO("MACsend: delay " << delay << " at time " << Simulator::Now().GetSeconds());

    AquaVisualVbfHeader vbh;
    AquaSimTrailer tra;

    pkt->RemoveTrailer(tra);
    pkt->RemoveHeader(vbh);
    // pkt->RemovePacketTag(ptag);

    // I don't understand why it works like this way
    /*
       if (vbh.GetMessType() == AS_DATA)
       ash->size() = (God::instance()->data_pkt_size) + 4*(vbh.GetPkNum() - 1);
       else
       ash->size() = 36 + 4*(vbh.GetPkNum() -1);
     */

    /*
       if (vbh.GetMessType() == AS_DATA)
       // ash->size() = (God::instance()->data_pkt_size)+12 ;
       ash->size() = 65+12 ;
       else
       ash->size() =32;
     */

    // if(!ll) printf("ok, the LL is empty\n");
    // ptag.SetPacketType(PT_UWVB);
    // printf("vectorbased: the address type is :%d uid is %d\n", ash->addr_type(),pkt->uid_);
    // printf("vectorbased: the packet type is :%d\n", ptag.GetPacketType());
    //  ll->handle(pkt);
    pkt->AddHeader(vbh);
    pkt->AddTrailer(tra);

    Simulator::Schedule(Seconds(delay),
                        &AquaSimRouting::SendDown,
                        this,
                        pkt,
                        AquaSimAddress::GetBroadcast(),
                        Seconds(0));
}

void
AquaSimVBF::DataForSink(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->RemoveHeader(vbh);
    if (!SendUp(pkt))
    {
        NS_LOG_WARN("DataForSink: Something went wrong when passing packet up to dmux.");
    }
}

void
AquaSimVBF::SetDelayTimer(Ptr<Packet> pkt, double c)
{
    NS_LOG_FUNCTION(this << c);
    if (c < 0)
    {
        c = 0;
    }
    Simulator::Schedule(Seconds(c), &AquaSimVBF::Timeout, this, pkt);
}

void
AquaSimVBF::Timeout(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;

    pkt->PeekHeader(vbh);

    unsigned char msg_type = vbh.GetMessType();
    NS_LOG_DEBUG("Timeout:" << msg_type << "\n");
    vbf_neighborhood* hashPtr;
    // Ptr<Packet> p1;

    switch (msg_type)
    {
    case AS_DATA:
        hashPtr = PktTable.GetHash(vbh.GetSenderAddr(), vbh.GetPkNum());
        if (hashPtr != NULL)
        {
            int num_neighbor = hashPtr->number;
            NS_LOG_DEBUG("Timeout as_data n-neighbor:" << num_neighbor << "\n");
            // printf("vectorbasedforward: node %d have received %d when wake up at
            // %f\n",here_.addr_,num_neighbor,NOW);
            if (num_neighbor != 1)
            {
                /*AlohaOverhear can guarantee that the packet be successfully deliveried to next
                 * hop, so we release the pkt if overhearing other neighbors send this pkt.
                 */
                /* if( m_useOverhear )
                   {
                         pkt=0;
                         return;
                   }*/

                // Some guys transmit the data before me
                if (num_neighbor == MAX_NEIGHBOR)
                {
                    // I have too many neighbors, I quit
                    pkt = 0;
                    return;
                }
                else // I need to calculate my delay time again
                {
                    int i = 0;
                    Vector* tp;
                    tp = new Vector[1];

                    tp[0].x = hashPtr->neighbor[i].x;
                    tp[0].y = hashPtr->neighbor[i].y;
                    tp[0].z = hashPtr->neighbor[i].z;
                    double tdelay = CalculateDelay(pkt, tp);
                    // neighbor's tdelay
                    //  double tdelay=5;
                    i++;
                    double c = 1;
                    while (i < num_neighbor)
                    {
                        c = c * 2;
                        tp[0].x = hashPtr->neighbor[i].x;
                        tp[0].y = hashPtr->neighbor[i].y;
                        tp[0].z = hashPtr->neighbor[i].z;
                        double t2delay = CalculateDelay(pkt, tp);
                        if (t2delay < tdelay)
                        {
                            tdelay = t2delay;
                        }
                        i++;
                        NS_LOG_DEBUG("Timeout i:" << i << "calculatedelay:" << tdelay << "\n");
                    }

                    delete[] tp;
                    if (tdelay <= (m_priority / c))
                    {
                        MACprepare(pkt);
                        MACsend(pkt, 0);
                        NS_LOG_DEBUG("Timeout delay=a less than priority,then macsend\n");
                    }
                    else
                    {
                        pkt = 0; // to much overlap, don;t send
                    }
                } // end of calculate my new delay time
            }
            else
            { // I am the only neighbor
                Vector* tp;
                tp = new Vector[1];
                tp[0].x = vbh.GetExtraInfo().f.x;
                tp[0].y = vbh.GetExtraInfo().f.y;
                tp[0].z = vbh.GetExtraInfo().f.z;
                double delay = CalculateDelay(pkt, tp);
                NS_LOG_DEBUG("Timeout only neighbor delay:" << delay << "\n");
                delete[] tp;
                if (delay <= m_priority)
                {
                    // printf("vectorbasedforward: !!%f\n",delay);
                    MACprepare(pkt);
                    MACsend(pkt, 0);
                    NS_LOG_DEBUG("Timeout only neighbor and delay=a less than priority,then macsend\n");
                }
                else
                {
                    pkt = 0;
                }
                // printf("vectorbasedforward:  I%d am the only neighbor, I send it out at
                // %f\n",here_.addr_,NOW);
                return;
            }
        }
        break;
    default:
        pkt = 0;
        break;
    }
}

void
AquaSimVBF::CalculatePosition(Ptr<Packet> pkt)
{
    // not used.
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);
    auto f = vbh.GetExtraInfo().f;
    auto d = vbh.GetExtraInfo().d;
    auto c = f + d;
    // GetDevice()->SetPosition(c);
    printf("vectorbased: my position is computed as (%f,%f,%f)\n", c.x, c.y, c.z);
}

double
AquaSimVBF::CalculateDelay(Ptr<Packet> pkt, Vector* p1) // calculate a,rather than delay
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double fx = p1->x;
    double fy = p1->y;
    double fz = p1->z;

    Vector pos = GetDevice()->GetPosition();
    double dx = pos.x - fx;
    double dy = pos.y - fy;
    double dz = pos.z - fz;

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;

    double dtx = tx - fx;
    double dty = ty - fy;
    double dtz = tz - fz;

    double dp = dx * dtx + dy * dty + dz * dtz;

    // double a=Advance(pkt);
    double p = Projection(pkt);
    double d = sqrt((dx * dx) + (dy * dy) + (dz * dz));
    double l = sqrt((dtx * dtx) + (dty * dty) + (dtz * dtz));
    double cos_theta;
    if (d == 0 || l == 0)
    {
        cos_theta = 0;
    }
    else
    {
        cos_theta = dp / (d * l);
    }
    // double delay=(TRANSMISSION_DISTANCE-d*cos_theta)/TRANSMISSION_DISTANCE;
    const double range = m_device->GetPhy()->GetTransRange();
    if (!std::isfinite(range) || range <= 0)
        throw std::runtime_error("VBF requires a positive finite PHY transRange");
    double delay = (p / m_width) + ((m_device->GetPhy()->GetTransRange() - d * cos_theta) /
                                    m_device->GetPhy()->GetTransRange());
    // double delay=(p/m_width) +((TRANSMISSION_DISTANCE-d)/TRANSMISSION_DISTANCE)+(1-cos_theta);
    // printf("vectorbased: node(%d) projection is %f, and cos is %f, and d is %f)\n",here_.addr_,p,
    // cos_theta, d);
    NS_LOG_DEBUG("CalculateDelay(" << GetDevice()->GetAddress() << ") projection is " << p
                                   << ", cos is " << cos_theta << " and d is " << d
                                   << " and total delay is " << delay);
    return std::max(0.0, delay);
}

double
AquaSimVBF::Distance(Ptr<Packet> pkt) // d
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().f.x;
    double ty = vbh.GetExtraInfo().f.y;
    double tz = vbh.GetExtraInfo().f.z;
    // printf("vectorbased: the target is %lf,%lf,%lf \n",tx,ty,tz);
    Vector pos = GetDevice()->GetPosition();
    // double x=GetDevice()->CX(); //change later
    // double y=GetDevice()->CY();// printf(" Vectorbasedforward: I am in advanced\n");
    // double z=GetDevice()->CZ();
    //  printf("the target is %lf,%lf,%lf and my coordinates are %lf,%lf,%lf\n",tx,ty,tz,x,y,z);
    return sqrt((tx - pos.x) * (tx - pos.x) + (ty - pos.y) * (ty - pos.y) +
                (tz - pos.z) * (tz - pos.z));
}

double
AquaSimVBF::Advance(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;
    // TODO
    NS_LOG_DEBUG("Advance target position is:" << tx << "," << ty << "," << tz << '\n');
    // printf("vectorbased: the target is %lf,%lf,%lf \n",tx,ty,tz);
    Vector pos = GetDevice()->GetPosition();
    NS_LOG_DEBUG("Advance current position is:" << pos.x << "," << pos.y << "," << pos.z << '\n');
    // double x=GetDevice()->CX(); //change later
    // double y=GetDevice()->CY();// printf(" Vectorbasedforward: I am in advanced\n");
    // double z=GetDevice()->CZ();
    //  printf("the target is %lf,%lf,%lf and my coordinates are %lf,%lf,%lf\n",tx,ty,tz,x,y,z);
    return sqrt((tx - pos.x) * (tx - pos.x) + (ty - pos.y) * (ty - pos.y) +
                (tz - pos.z) * (tz - pos.z));
}

double
AquaSimVBF::Projection(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    double tx = vbh.GetExtraInfo().t.x;
    double ty = vbh.GetExtraInfo().t.y;
    double tz = vbh.GetExtraInfo().t.z;

    Vector o;
    // double ox, oy, oz;
    NS_LOG_DEBUG("m_hopByHop:" << m_hopByHop);
    if (!m_hopByHop)
    {
        NS_LOG_DEBUG("enter !m_hopByHop");
        // printf("vbf is used\n");
        o.x = vbh.GetExtraInfo().o.x;
        o.y = vbh.GetExtraInfo().o.y;
        o.z = vbh.GetExtraInfo().o.z;
    }
    else
    {
        NS_LOG_DEBUG("not enter !m_hopByHop");
        // printf("m_hopByHop vbf is used\n");
        o.x = vbh.GetExtraInfo().f.x;
        o.y = vbh.GetExtraInfo().f.y;
        o.z = vbh.GetExtraInfo().f.z;
    }

    // NOTE below may not work if the nodes are mobile.
    /*double x=GetDevice()->CX();
    double y=GetDevice()->CY();
    double z=GetDevice()->CZ();
  */
    Vector myPos = GetDevice()->GetPosition();

    double wx = tx - o.x;
    double wy = ty - o.y;
    double wz = tz - o.z;

    double vx = myPos.x - o.x;
    double vy = myPos.y - o.y;
    double vz = myPos.z - o.z;
    // xiang liang cha cheng qiu mian ji,ci chu qiu wan hai shi xiang liang
    double cross_product_x = vy * wz - vz * wy;
    double cross_product_y = vz * wx - vx * wz;
    double cross_product_z = vx * wy - vy * wx;
    NS_LOG_DEBUG("cross_product_x:" << cross_product_x);
    NS_LOG_DEBUG("cross_product_y:" << cross_product_y);
    NS_LOG_DEBUG("cross_product_z:" << cross_product_z);

    NS_LOG_DEBUG("vx-vy-vz:" << vx << "-" << vy << "-" << vz);
    NS_LOG_DEBUG("wx-wy-wz:" << wx << "-" << wy << "-" << wz);
    NS_LOG_DEBUG("vy*wz:" << vy * wz);
    NS_LOG_DEBUG("vz*wy:" << vz * wy);
    // mian ji wei cha cheng hou de mo
    double area = sqrt(cross_product_x * cross_product_x + cross_product_y * cross_product_y +
                       cross_product_z * cross_product_z);
    double length =
        sqrt((tx - o.x) * (tx - o.x) + (ty - o.y) * (ty - o.y) + (tz - o.z) * (tz - o.z));
    // printf("vectorbasedforward: the area is %f and length is %f\n",area,length);
    NS_LOG_DEBUG("Projection: area is " << area << " length is " << length);
    NS_LOG_DEBUG("Projection: area is " << area << " length is " << length);
    if (length == 0)
    {
        return 0;
    }
    NS_LOG_DEBUG("Projection=" << area / length);
    return area / length;
}

bool
AquaSimVBF::IsTarget(Ptr<Packet> pkt)
{
    AquaVisualVbfHeader vbh;
    pkt->PeekHeader(vbh);

    // TODO
    // if (vbh.GetTargetAddr().GetAsInt()==1) {
    if (vbh.GetTargetAddr().GetAsInt() == 0)
    {
        //  printf("vectorbased: advanced is %lf and my range is %f\n",Advance(pkt),vbh.GetRange());
        return (Advance(pkt) < vbh.GetRange());
    }
    else
    {
        return (GetDevice()->GetAddress() == vbh.GetTargetAddr());
    }
}

bool
AquaSimVBF::IsCloseEnough(Ptr<Packet> pkt)
{
    // AquaVisualVbfHeader vbh;
    // AquaSimHeader ash;
    // pkt->RemoveHeader(ash);
    // pkt->PeekHeader(vbh);
    // pkt->AddHeader(ash);

    // double range=vbh.GetRange();  //unused
    // double range=m_width;

    //  printf("underwatersensor: The m_width is %f\n",range);
    // double ox=vbh.GetExtraInfo().o.x;  //unused
    // double oy=vbh.GetExtraInfo().o.y;  //unused
    // double oz=vbh.GetExtraInfo().o.z;  //unused

    /*
  double tx=vbh.GetExtraInfo().t.x;
    double ty=vbh.GetExtraInfo().t.y;
    double tz=vbh.GetExtraInfo().t.z;

    double fx=vbh.GetExtraInfo().f.x;
    double fy=vbh.GetExtraInfo().f.y;
    double fz=vbh.GetExtraInfo().f.z;
  */ // currently unused...

    // double x=GetDevice()->CX();  //unused  //change later
    // double y=GetDevice()->CY();  //unused
    // double z=GetDevice()->CZ();  //unused

    // double d=sqrt((tx-fx)*(tx-fx)+(ty-fy)*(ty-fy)+(tz-fz)*(tz-fz));  //unused
    // double l=sqrt((tx-ox)*(tx-ox)+(ty-oy)*(ty-oy)+ (tz-oz)*(tz-oz));
    // double l=Advance(pkt);  //unused
    //  if (l<range)
    //  {
    //  printf("vectorbasedforward: IsClose?too close! it should be target!\n");
    //  return true;
    //  }
    //  else {
    // double c=d/l;
    return Projection(pkt) <= m_width;
}

void
AquaSimVBF::DoDispose()
{
    m_rand = 0;
    AquaSimRouting::DoDispose();
}

void
AquaSimVBF::SetTargetPos(Vector pos)
{
    m_targetPos = pos;
}

// Some methods for Flooding Entry

/*
   void Vectorbasedforward_Entry::reset()
   {
   clear_agentlist(source);
   clear_agentlist(sink);
   source = NULL;
   sink = NULL;
   }

   void Vectorbasedforward_Entry::clear_agentlist(Agent_List *list)
   {
   Agent_List *cur=list;
   Agent_List *temp = NULL;

   while (cur != NULL) {
   temp = AGENT_NEXT(cur);
   delete cur;
   cur = temp;
   }
   }

 */

} // namespace ns3
`;

//#endregion
//#region src/features/experiment/lib/linearMobility.ts
/** Attribute-configurable constant velocity using the public ns-3 mobility interface. */
	const LINEAR_MOBILITY_CC = String.raw`
#include "ns3/mobility-module.h"

namespace ns3 {
class AquaVisualLinearMobilityModel : public ConstantVelocityMobilityModel {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualLinearMobilityModel")
            .SetParent<ConstantVelocityMobilityModel>()
            .SetGroupName("Mobility")
            .AddConstructor<AquaVisualLinearMobilityModel>()
            .AddAttribute("InitialVelocity", "Initial velocity vector [unit=m/s].",
                VectorValue(Vector(0, 0, 0)),
                MakeVectorAccessor(&AquaVisualLinearMobilityModel::SetInitialVelocity,
                                   &AquaVisualLinearMobilityModel::GetInitialVelocity),
                MakeVectorChecker());
        return tid;
    }
    void SetInitialVelocity(const Vector& velocity) {
        m_initialVelocity = velocity;
        if (IsInitialized()) SetVelocity(velocity);
    }
    Vector GetInitialVelocity() const { return m_initialVelocity; }
    Ptr<MobilityModel> Copy() const override {
        auto copy = CreateObject<AquaVisualLinearMobilityModel>();
        copy->SetPosition(GetPosition());
        copy->SetInitialVelocity(GetVelocity());
        copy->SetVelocity(GetVelocity());
        return copy;
    }
protected:
    void DoInitialize() override {
        // ConstantVelocity's SetPosition clears its helper velocity. Apply the
        // registered initial velocity after generic installation sets coordinates.
        SetVelocity(m_initialVelocity);
        ConstantVelocityMobilityModel::DoInitialize();
    }
private:
    Vector m_initialVelocity;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualLinearMobilityModel);
}
`;

//#endregion
//#region src/features/experiment/lib/builtinProtocols.ts
/** Source packages are compiled and discovered through the same TypeId probe as installed models. */
	const BUILTIN_PROTOCOL_SOURCES = [
		{
			path: "builtin/observed-signal-cache.cc",
			code: OBSERVED_SIGNAL_CACHE_CC
		},
		{
			path: "builtin/aqua-sim-phy-simple.cc",
			code: SIMPLE_UNDERWATER_PHY_CC
		},
		{
			path: "builtin/terrestrial-radio.cc",
			code: TERRESTRIAL_RADIO_CC
		},
		{
			path: "builtin/aqua-sim-routing-vbf.cc",
			code: VECTOR_BASED_FORWARDING_CC
		},
		{
			path: "builtin/aqua-visual-linear-mobility.cc",
			code: LINEAR_MOBILITY_CC
		}
	];
	const BUILTIN_PROTOCOL_CC = BUILTIN_PROTOCOL_SOURCES.map((source) => source.code).join("\n");

//#endregion
//#region src/features/experiment/lib/protocolRuntime.ts
/** Shared ns-3 attribute checking and socket assembly; no protocol-specific parameter rules. */
	const PROTOCOL_RUNTIME_CC = String.raw`
#include <stdexcept>
#include <utility>

using VisualAttributes = std::vector<std::pair<std::string, std::string>>;

static std::string VisualTrim(const std::string& text) {
    const auto first = text.find_first_not_of(" \t\r\n");
    return first == std::string::npos ? "" : text.substr(first, text.find_last_not_of(" \t\r\n") - first + 1);
}

static TypeId VisualType(const std::string& name) {
    TypeId tid;
    if (!TypeId::LookupByNameFailSafe(name, &tid) || !tid.HasConstructor()) {
        throw std::runtime_error("Unregistered or non-constructible TypeId: " + name);
    }
    return tid;
}

static ObjectFactory VisualFactory(const std::string&, const VisualAttributes&, unsigned = 0);

// Parse the public ObjectFactory text syntax before construction. In ns-3's
// PointerValue parser an unknown TypeId otherwise terminates the process.
static Ptr<AttributeValue> VisualPointer(const std::string& text, const PointerChecker& checker, unsigned depth) {
    const std::string value = VisualTrim(text);
    if (value == "0") return Create<PointerValue>();
    const auto bracket = value.find('[');
    const std::string type = VisualTrim(value.substr(0, bracket));
    const TypeId tid = VisualType(type);
    const TypeId expected = checker.GetPointeeTypeId();
    if (tid != expected && !tid.IsChildOf(expected)) {
        throw std::runtime_error(type + " does not implement " + expected.GetName());
    }
    VisualAttributes attributes;
    if (bracket != std::string::npos) {
        if (value.back() != ']') throw std::runtime_error("Unclosed ObjectFactory attribute list");
        const auto body = value.substr(bracket + 1, value.size() - bracket - 2);
        std::size_t begin = 0;
        int nesting = 0;
        for (std::size_t i = 0; i <= body.size(); ++i) {
            if (i < body.size()) {
                if (body[i] == '[') ++nesting;
                if (body[i] == ']') --nesting;
                if (nesting < 0) throw std::runtime_error("Invalid ObjectFactory brackets");
            }
            if (i == body.size() || (body[i] == '|' && nesting == 0)) {
                const auto entry = body.substr(begin, i - begin);
                if (!entry.empty()) {
                    const auto equals = entry.find('=');
                    if (equals == std::string::npos) throw std::runtime_error("ObjectFactory attributes require name=value");
                    attributes.emplace_back(VisualTrim(entry.substr(0, equals)), entry.substr(equals + 1));
                }
                begin = i + 1;
            }
        }
        if (nesting != 0) throw std::runtime_error("Invalid ObjectFactory brackets");
    }
    return Create<PointerValue>(VisualFactory(type, attributes, depth + 1).Create<Object>());
}

static ObjectFactory VisualFactory(const std::string& type, const VisualAttributes& attributes, unsigned depth) {
    if (depth > 32) throw std::runtime_error("ObjectFactory nesting exceeds 32 levels");
    const TypeId tid = VisualType(type);
    ObjectFactory factory;
    factory.SetTypeId(tid);
    for (const auto& [name, text] : attributes) {
        TypeId::AttributeInformation info;
        if (!tid.LookupAttributeByName(name, &info) || !(info.flags & TypeId::ATTR_CONSTRUCT)) {
            throw std::runtime_error(type + "." + name + " is not a constructible attribute");
        }
        Ptr<AttributeValue> value;
        try {
            if (auto pointer = dynamic_cast<const PointerChecker*>(PeekPointer(info.checker))) {
                value = VisualPointer(text, *pointer, depth);
                if (!info.checker->Check(*value)) value = nullptr;
            } else {
                value = info.checker->CreateValidValue(StringValue(text));
            }
        } catch (const std::exception& error) {
            throw std::runtime_error(type + "." + name + " = " + text + ": " + error.what());
        }
        if (!value) {
            const auto constraint = info.checker->HasUnderlyingTypeInformation()
                ? info.checker->GetUnderlyingTypeInformation() : info.checker->GetValueTypeName();
            throw std::runtime_error("Invalid attribute " + type + "." + name + " = " + text + " (expected " + constraint + ")");
        }
        factory.Set(name, *value);
    }
    return factory;
}

static ObjectFactory VisualNodeFactory(const std::string& type, const VisualAttributes& attributes, uint32_t nodeId) {
    try { return VisualFactory(type, attributes); }
    catch (const std::exception& error) {
        throw std::runtime_error("Node " + std::to_string(nodeId) + ": " + error.what());
    }
}

static Ptr<MobilityModel> VisualCreateMobility(const std::string& type, const VisualAttributes& attributes,
                                             uint32_t nodeId, const Vector& position) {
    const TypeId tid = VisualType(type);
    if (!tid.IsChildOf(MobilityModel::GetTypeId())) {
        throw std::runtime_error("Node " + std::to_string(nodeId) + ": " + type + " does not implement ns3::MobilityModel");
    }
    for (const auto& attribute : attributes) {
        if (attribute.first == "Position") {
            throw std::runtime_error("Node " + std::to_string(nodeId) + ": mobility Position is managed by node coordinates");
        }
    }
    auto model = VisualNodeFactory(type, attributes, nodeId).Create<MobilityModel>();
    model->SetPosition(position);
    return model;
}

class AquaVisualSocket : public AquaSimSocket {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualSocket")
            .SetParent<AquaSimSocket>().AddConstructor<AquaVisualSocket>();
        return tid;
    }
    int Bind() override {
        const int result = AquaSimSocket::Bind();
        if (result == 0) m_bound = true;
        return result;
    }
    int Bind(const Address& address) override {
        const int result = AquaSimSocket::Bind(address);
        if (result == 0) m_bound = true;
        return result;
    }
    int Bind6() override { return Bind(); }
    int Connect(const Address& address) override {
        if (!m_bound && Bind() != 0) return -1;
        return AquaSimSocket::Connect(address);
    }
    int Close() override { m_bound = false; return AquaSimSocket::Close(); }
private:
    bool m_bound = false;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSocket);

class AquaVisualSocketFactory : public SocketFactory {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualSocketFactory")
            .SetParent<SocketFactory>().AddConstructor<AquaVisualSocketFactory>();
        return tid;
    }
    Ptr<Socket> CreateSocket() override {
        auto socket = CreateObject<AquaVisualSocket>();
        socket->SetNode(GetObject<Node>());
        return socket;
    }
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualSocketFactory);
`;

//#endregion
//#region src/features/experiment/lib/simulationProgress.ts
/** Shared execution bound, independent of protocol names or parameter semantics. */
	const SIMULATION_PROGRESS_CC = String.raw`
#include "ns3/default-simulator-impl.h"
#include "ns3/event-id.h"
#include <stdexcept>

class AquaVisualGuardedSimulator : public DefaultSimulatorImpl {
public:
    static TypeId GetTypeId() {
        static TypeId tid = TypeId("ns3::AquaVisualGuardedSimulator")
            .SetParent<DefaultSimulatorImpl>().AddConstructor<AquaVisualGuardedSimulator>();
        return tid;
    }
    void PreEventHook(const EventId& event) override {
        const auto timestamp = event.GetTs();
        if (!m_count || timestamp != m_timestamp) {
            m_timestamp = timestamp;
            m_count = 0;
        }
        if (++m_count > MAX_EVENTS_AT_ONE_TIME) {
            m_stalled = true;
            // Stop through the normal simulator path. Throwing inside this hook
            // would interrupt DefaultSimulatorImpl's event ownership/accounting.
            Stop();
        }
    }
    void CheckProgress() const {
        if (m_stalled) throw std::runtime_error(
            "仿真时间未推进：在同一时刻 (" + std::to_string(m_timestamp)
            + " 个时钟步) 连续处理超过 " + std::to_string(MAX_EVENTS_AT_ONE_TIME)
            + " 个事件，已停止本次运行。请检查零间隔的循环事件；重复产包间隔应大于 0，首包启动时间与产包间隔是不同设置。");
    }
private:
    static constexpr uint64_t MAX_EVENTS_AT_ONE_TIME = 100000;
    uint64_t m_timestamp = 0;
    uint64_t m_count = 0;
    bool m_stalled = false;
};
NS_OBJECT_ENSURE_REGISTERED(AquaVisualGuardedSimulator);
`;

//#endregion
//#region src/shared/logSafety.ts
	const MAX_LOG_MOVEMENTS = 50000;

//#endregion
//#region src/features/experiment/lib/mobilityTrace.ts
/** Public MobilityModel observations; sampling never changes the simulation trajectory. */
	const MOBILITY_TRACE_CC = String.raw`
#include <algorithm>
#include <limits>
#include <map>

struct VisualMovement {
    uint32_t nodeId;
    int64_t startNs, endNs;
    Vector from, to;
};
struct VisualMobilityTrack {
    Ptr<MobilityModel> model;
    int64_t timeNs;
    Vector position;
    size_t mergeIndex = std::numeric_limits<size_t>::max();
};
static std::vector<VisualMovement> visualMovements;
static std::map<uint32_t, VisualMobilityTrack> visualMobilityTracks;
static bool visualMobilityRecording = false;
static Time visualMobilitySampleInterval;
static Time visualMobilityStop;
static EventId visualMobilitySampleEvent;

static bool VisualFinitePosition(const Vector& point) {
    return std::isfinite(point.x) && std::isfinite(point.y) && std::isfinite(point.z);
}
static bool VisualSamePosition(const Vector& a, const Vector& b) {
    return a.x == b.x && a.y == b.y && a.z == b.z;
}
static bool VisualSameVelocity(const Vector& a, const Vector& b) {
    const auto equal = [](double x, double y) {
        return std::abs(x - y) <= 1e-9 * std::max({1.0, std::abs(x), std::abs(y)});
    };
    return equal(a.x, b.x) && equal(a.y, b.y) && equal(a.z, b.z);
}
static void VisualCaptureMobility(uint32_t id, bool courseChange) {
    if (!visualMobilityRecording) return;
    auto& track = visualMobilityTracks.at(id);
    const auto now = Simulator::Now().GetNanoSeconds();
    const Vector position = track.model->GetPosition();
    if (!VisualFinitePosition(position)) {
        throw std::runtime_error("Node " + std::to_string(id) + ": mobility produced non-finite coordinates");
    }
    if (!VisualSamePosition(track.position, position)) {
        bool merged = false;
        if (now > track.timeNs && track.mergeIndex < visualMovements.size()) {
            auto& previous = visualMovements[track.mergeIndex];
            if (previous.endNs == track.timeNs && previous.endNs > previous.startNs) {
                const Vector before = (previous.to - previous.from) * (1e9 / (previous.endNs - previous.startNs));
                const Vector after = (position - track.position) * (1e9 / (now - track.timeNs));
                if (VisualSameVelocity(before, after)) {
                    previous.endNs = now;
                    previous.to = position;
                    merged = true;
                }
            }
        }
        if (!merged) {
            if (visualMovements.size() >= ${MAX_LOG_MOVEMENTS}) {
                throw std::runtime_error("Mobility trace exceeds ${MAX_LOG_MOVEMENTS} movement segments; shorten the experiment or reduce course changes");
            }
            track.mergeIndex = visualMovements.size();
            visualMovements.push_back({id, track.timeNs, now, track.position, position});
        }
    } else if (now > track.timeNs) {
        // Do not interpolate through a stationary interval as though it moved.
        track.mergeIndex = std::numeric_limits<size_t>::max();
    }
    track.timeNs = now;
    track.position = position;
    // Preserve the exact public course-change boundary after this observation.
    if (courseChange) track.mergeIndex = std::numeric_limits<size_t>::max();
}
static void VisualMobilityCourseChanged(uint32_t id, Ptr<const MobilityModel>) {
    VisualCaptureMobility(id, true);
}
static void VisualSampleMobility() {
    if (!visualMobilityRecording) return;
    for (const auto& entry : visualMobilityTracks) VisualCaptureMobility(entry.first, false);
    if (visualMobilityStop - Simulator::Now() > visualMobilitySampleInterval) {
        visualMobilitySampleEvent = Simulator::Schedule(visualMobilitySampleInterval, &VisualSampleMobility);
    }
}
static void VisualStartMobilityTrace(const NodeContainer& nodes, const std::vector<uint16_t>& addresses,
                                     Time sampleInterval, Time stop) {
    visualMobilitySampleInterval = sampleInterval;
    visualMobilityStop = stop;
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        auto model = nodes.Get(i)->GetObject<MobilityModel>();
        const Vector position = model->GetPosition();
        if (!VisualFinitePosition(position)) throw std::runtime_error("Invalid initial mobility position");
        visualMobilityTracks.emplace(addresses[i], VisualMobilityTrack{model, Simulator::Now().GetNanoSeconds(), position});
        if (!VisualConnectTrace(model, "CourseChange", "ns3::MobilityModel::TracedCallback",
                MakeBoundCallback(&VisualMobilityCourseChanged, uint32_t(addresses[i])))) {
            throw std::runtime_error("MobilityModel CourseChange trace interface is unavailable");
        }
    }
    visualMobilityRecording = true;
    if (stop - Simulator::Now() > sampleInterval) {
        visualMobilitySampleEvent = Simulator::Schedule(sampleInterval, &VisualSampleMobility);
    }
}
static void VisualFinishMobilityTrace() {
    for (const auto& entry : visualMobilityTracks) VisualCaptureMobility(entry.first, false);
    visualMobilityRecording = false;
    visualMobilitySampleEvent.Cancel();
}
static void WriteVisualMovements(std::ostream& output) {
    const auto previousPrecision = output.precision(17);
    output << ",\"movements\":[";
    for (size_t i = 0; i < visualMovements.size(); ++i) {
        if (i) output << ',';
        const auto& movement = visualMovements[i];
        output << "{\"node_id\":" << movement.nodeId
            << ",\"start_us\":" << movement.startNs / 1000.0 << ",\"end_us\":" << movement.endNs / 1000.0
            << ",\"from_x\":" << movement.from.x << ",\"from_y\":" << movement.from.y << ",\"from_z\":" << movement.from.z
            << ",\"to_x\":" << movement.to.x << ",\"to_y\":" << movement.to.y << ",\"to_z\":" << movement.to.z << '}';
    }
    output << ']';
    output.precision(previousPrecision);
}
`;

//#endregion
//#region src/shared/quantity.ts
	const units = Object.create(null);
	const register = (dimension, symbol, scale, aliases = []) => {
		for (const key of [symbol, ...aliases]) units[key] = {
			dimension,
			scale,
			symbol
		};
	};
	for (const [symbol, scale, aliases] of [
		[
			"fs",
			1e-15,
			["femtosecond", "femtoseconds"]
		],
		[
			"ps",
			1e-12,
			["picosecond", "picoseconds"]
		],
		[
			"ns",
			1e-9,
			["nanosecond", "nanoseconds"]
		],
		[
			"us",
			1e-6,
			[
				"µs",
				"μs",
				"microsecond",
				"microseconds"
			]
		],
		[
			"ms",
			.001,
			["millisecond", "milliseconds"]
		],
		[
			"s",
			1,
			[
				"sec",
				"second",
				"seconds"
			]
		],
		[
			"min",
			60,
			["minute", "minutes"]
		],
		[
			"h",
			3600,
			["hour", "hours"]
		],
		[
			"d",
			86400,
			["day", "days"]
		],
		[
			"y",
			31536e3,
			["year", "years"]
		]
	]) register("time", symbol, scale, aliases);
	for (const [symbol, scale, aliases] of [
		[
			"mm",
			.001,
			[
				"millimeter",
				"millimeters",
				"millimetre",
				"millimetres"
			]
		],
		[
			"cm",
			.01,
			[
				"centimeter",
				"centimeters",
				"centimetre",
				"centimetres"
			]
		],
		[
			"m",
			1,
			[
				"meter",
				"meters",
				"metre",
				"metres"
			]
		],
		[
			"km",
			1e3,
			[
				"kilometer",
				"kilometers",
				"kilometre",
				"kilometres"
			]
		]
	]) register("length", symbol, scale, aliases);
	for (const [symbol, scale] of [
		["Hz", 1],
		["kHz", 1e3],
		["MHz", 1e6],
		["GHz", 1e9]
	]) register("frequency", symbol, scale, [symbol.toLowerCase()]);
	for (const [symbol, scale] of [
		["W", 1],
		["mW", .001],
		["uW", 1e-6],
		["kW", 1e3]
	]) register("power", symbol, scale);
	for (const [symbol, scale] of [
		["J", 1],
		["mJ", .001],
		["kJ", 1e3]
	]) register("energy", symbol, scale);
	register("speed", "m/s", 1);
	register("speed", "km/s", 1e3);
	register("temperature", "°C", 1, ["C"]);
	register("salinity", "ppt", 1);
	register("ratio-db", "dB", 1);
	register("power-db", "dBm", 1);
	for (const [prefix, scale] of [
		["", 1],
		["k", 1e3],
		["M", 1e6],
		["G", 1e9]
	]) {
		register("rate", `${prefix}bps`, scale, [`${prefix}bit/s`, `${prefix}b/s`]);
		register("rate", `${prefix}Bps`, scale * 8, [`${prefix}B/s`]);
		register("size", `${prefix}B`, scale, prefix ? [] : ["byte", "bytes"]);
	}
	register("size", "KiB", 1024);
	register("size", "MiB", 1024 ** 2);
	register("rate", "Kbps", 1e3, ["Kb/s", "Kbit/s"]);
	register("rate", "KBps", 8e3, ["KB/s"]);
	register("size", "KB", 1e3);
	for (const [prefix, scale] of [
		["Ki", 1024],
		["Mi", 1024 ** 2],
		["Gi", 1024 ** 3]
	]) {
		register("rate", `${prefix}b/s`, scale, [`${prefix}bps`, `${prefix}bit/s`]);
		register("rate", `${prefix}B/s`, scale * 8, [`${prefix}Bps`]);
	}
	register("size", "GiB", 1024 ** 3);
	const QUANTITY_NUMBER = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";
	const pattern = new RegExp(`^(${QUANTITY_NUMBER})\\s*(.*?)$`, "i");
	const canonicalUnit = (unit) => units[unit.trim()]?.symbol ?? null;
	const isBareNumber = (text) => new RegExp(`^${QUANTITY_NUMBER}$`, "i").test(text.trim());
	const decimalParts = (text) => {
		const [mantissa, power = "0"] = text.toLowerCase().split("e");
		const fraction = mantissa.split(".")[1]?.length ?? 0;
		const coefficient = BigInt(mantissa.replace(".", ""));
		const exponent = Number(power) - fraction;
		if (coefficient !== 0n && (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1e4)) throw new Error("数值超出有效范围");
		return {
			coefficient,
			exponent: coefficient === 0n ? 0 : exponent
		};
	};
	const scaledDecimal = (text, numerator, denominator, requireInteger = false) => {
		const input = decimalParts(text), top = decimalParts(String(numerator)), bottom = decimalParts(String(denominator));
		let coefficient = input.coefficient * top.coefficient;
		let divisor = bottom.coefficient;
		let a = coefficient < 0n ? -coefficient : coefficient, b = divisor;
		while (b !== 0n) {
			const remainder = a % b;
			a = b;
			b = remainder;
		}
		coefficient /= a;
		divisor /= a;
		let exponent = input.exponent + top.exponent - bottom.exponent;
		if (requireInteger) {
			if ((exponent >= 0 ? coefficient * 10n ** BigInt(exponent) % divisor : coefficient % (divisor * 10n ** BigInt(-exponent))) !== 0n) throw new Error("换算后的数值必须是整数");
		}
		let twos = 0, fives = 0;
		while (divisor % 2n === 0n) {
			divisor /= 2n;
			twos++;
		}
		while (divisor % 5n === 0n) {
			divisor /= 5n;
			fives++;
		}
		if (divisor !== 1n) return Number(text) * numerator / denominator;
		const digits = Math.max(twos, fives);
		coefficient *= 2n ** BigInt(digits - twos) * 5n ** BigInt(digits - fives);
		exponent -= digits;
		const value = Number(`${coefficient}e${exponent}`);
		if (coefficient !== 0n && value === 0) throw new Error("数值小于可表示的范围");
		return value;
	};
	const parseQuantity = (input, defaultUnit, requireInteger = false) => {
		const base = units[defaultUnit.trim()];
		if (!base) throw new Error(`不支持的单位：${defaultUnit}`);
		const match = typeof input === "string" || typeof input === "number" ? String(input).trim().match(pattern) : null;
		if (!match) throw new Error(`请输入有效数值，省略单位按 ${base.symbol}`);
		const requested = match[2] || defaultUnit;
		const unit = units[requested] || (["time", "length"].includes(base.dimension) ? units[requested.toLowerCase()] : void 0);
		if (!unit || unit.dimension !== base.dimension) throw new Error(`单位 ${requested} 无效，需要 ${base.symbol} 或同类单位`);
		const value = scaledDecimal(match[1], unit.scale, base.scale, requireInteger);
		if (!Number.isFinite(value)) throw new Error("数值超出有效范围");
		return {
			value,
			unit: base.symbol
		};
	};
	/** Safe canonical decimal for scientific/fractional integer spellings; plain integer strings retain precision. */
	const integerLiteral = (text) => {
		const value = text.trim();
		if (!isBareNumber(value)) throw new Error("请输入有效整数");
		if (/^[+-]?\d+$/.test(value)) return value;
		const number = scaledDecimal(value, 1, 1, true);
		if (!Number.isSafeInteger(number)) throw new Error("数值必须是安全范围内的整数");
		return String(number);
	};

//#endregion
//#region src/features/experiment/lib/protocolUnits.ts
	const scalarTypes = [
		"ns3::DoubleValue",
		"ns3::IntegerValue",
		"ns3::UintegerValue"
	];
	const isNumericAttribute = (attr) => scalarTypes.includes(attr.valueType);
	/** Only registered types and explicit unit declarations carry executable unit semantics. */
	const attributeUnit = (attr) => {
		if (attr.valueType === "ns3::TimeValue") return "s";
		if (attr.valueType === "ns3::DataRateValue") return "bps";
		if (!isNumericAttribute(attr) && attr.valueType !== "ns3::Vector3DValue") return null;
		const help = attr.help || "";
		const explicit = [...help.matchAll(/\[unit\s*=\s*([^\]]+)\]/gi)];
		if (explicit.length) {
			const values = explicit.map((match) => canonicalUnit(match[1]));
			return values[0] && values.every((value) => value === values[0]) ? values[0] : null;
		}
		const found = /* @__PURE__ */ new Set();
		for (const match of help.matchAll(/\(([^()]+)\)|\[([^\[\]]+)\]|\bin\s+(meters?|metres?|seconds?|milliseconds?|bytes?)(?=\s*(?:[.;,]|$))/gi)) {
			const unit = canonicalUnit(match[1] || match[2] || match[3]);
			if (unit) found.add(unit);
		}
		return found.size === 1 ? [...found][0] : null;
	};
	const nonBlankAttributes = (attributes) => Object.fromEntries(Object.entries(attributes).filter(([, value]) => typeof value !== "string" || value.trim() !== ""));
	const attributeLiteral = (attr, input) => {
		const text = String(input).trim();
		if ((isNumericAttribute(attr) || attr.valueType === "ns3::TimeValue" || attr.valueType === "ns3::DataRateValue") && typeof input !== "string" && typeof input !== "number") throw new Error("请输入有效数值");
		const unit = attributeUnit(attr);
		if (attr.valueType === "ns3::TimeValue") {
			const seconds = parseQuantity(text, "s").value;
			if (Math.abs(seconds) > 9223372036) throw new Error("超出仿真时钟可表示的范围");
			const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµμ]*)$/i);
			return `${match[1].toLowerCase()}${canonicalUnit((match[2] || "s").toLowerCase()) || "s"}`;
		}
		if (attr.valueType === "ns3::Vector3DValue" && unit) {
			const parts = text.split(":");
			if (parts.length !== 3) throw new Error("向量需要 x:y:z 三个分量");
			return parts.map((part) => String(parseQuantity(part, unit).value)).join(":");
		}
		if (unit) {
			const integer = ["ns3::IntegerValue", "ns3::UintegerValue"].includes(attr.valueType);
			const value = parseQuantity(text, unit, integer || attr.valueType === "ns3::DataRateValue").value;
			if ([
				"ns3::IntegerValue",
				"ns3::UintegerValue",
				"ns3::DataRateValue"
			].includes(attr.valueType) && !Number.isSafeInteger(value) && !(isBareNumber(text) && /^[+-]?\d+$/.test(text))) throw new Error(`换算到 ${unit} 后必须是安全范围内的整数`);
			if (attr.valueType === "ns3::DataRateValue") {
				if (value < 0) throw new Error("速率必须非负");
				return `${isBareNumber(text) && /^[+]?\d+$/.test(text) ? text.replace(/^\+/, "") : value}bps`;
			}
			if (integer) return isBareNumber(text) ? integerLiteral(text) : String(value);
			return isBareNumber(text) ? text : String(value);
		}
		if (isNumericAttribute(attr)) {
			if (!isBareNumber(text)) throw new Error("注册信息未声明单位，请填写纯数字");
			if (["ns3::IntegerValue", "ns3::UintegerValue"].includes(attr.valueType)) return integerLiteral(text);
			if (!Number.isFinite(Number(text))) throw new Error("数值超出有效范围");
		}
		return String(input);
	};

//#endregion
//#region src/features/experiment/lib/protocolConfiguration.ts
/** These layers own a separate instance on each device; channels/propagation are shared. */
	const NODE_PROTOCOL_LAYERS = [
		"phy",
		"mac",
		"routing"
	];
	/** Single precedence rule shared by validation and code generation. */
	const deviceProtocolConfigurations = (spec, node) => NODE_PROTOCOL_LAYERS.map((layerId) => {
		const selection = spec.stack[layerId];
		const legacy = "attrs" in selection ? { ...selection.attrs } : {};
		if (layerId === "phy") delete legacy.txPower;
		return {
			layerId,
			typeId: selection.type,
			attributes: {
				...nonBlankAttributes(legacy),
				...nonBlankAttributes(spec.protocolAttributes?.[selection.type] || {}),
				...nonBlankAttributes(node?.protocolAttributes?.[selection.type] || {})
			}
		};
	});

//#endregion
//#region src/features/experiment/lib/protocolMetadata.ts
/** Public socket-application contract, identified from registered attributes rather than class names. */
	const hasSocketInterface = (item) => !!item?.attributes?.some((attr) => attr.name === "Protocol" && attr.valueType === "ns3::TypeIdValue" && attr.constructible !== false) && !!item.attributes.some((attr) => attr.name === "Remote" && attr.valueType === "ns3::AddressValue" && attr.constructible !== false);
	const attributeEditState = (item, attr, layerId) => {
		if (hasSocketInterface(item) && ["Protocol", "Remote"].includes(attr.name)) return {
			editable: false,
			managed: true,
			reason: "由节点目的地址与公共 Socket 接口连接"
		};
		if (layerId === "channel" && item.field !== "propagationId" && attr.pointeeTypeId === "ns3::AquaSimPropagation") return {
			editable: false,
			managed: true,
			reason: "由已选择的传播模型连接"
		};
		if ([
			"phy",
			"mac",
			"routing"
		].includes(layerId || "") && attr.name === "SetDevice" && attr.valueType === "ns3::PointerValue") return {
			editable: false,
			managed: true,
			reason: "由所在节点的公共设备接口连接"
		};
		if (layerId === "mobility" && attr.name === "Position" && ["ns3::VectorValue", "ns3::Vector3DValue"].includes(attr.valueType)) return {
			editable: false,
			managed: true,
			reason: "由节点坐标设置初始位置"
		};
		if (attr.constructible === false) return {
			editable: false,
			managed: false,
			reason: "注册接口不允许在构造时配置"
		};
		if (["ns3::ObjectVectorValue", "ns3::ObjectMapValue"].includes(attr.valueType)) return {
			editable: false,
			managed: false,
			reason: "对象容器暂不支持文本配置"
		};
		return {
			editable: true,
			managed: false,
			reason: ""
		};
	};
	/** Reflect interface availability and ownership; numeric/type constraints are checked by ns-3 itself. */
	const protocolMetadataIssues = (spec, layers) => {
		const issues = [];
		const extras = spec.protocolAttributes || {};
		const itemFor = (layerId, typeId, propagation = false) => layers.find((layer) => layer.id === layerId)?.items.find((item) => item.typeId === typeId && (layerId !== "channel" || item.field === "propagationId" === propagation));
		const check = (layerId, typeId, attrs, label = typeId, propagation = false) => {
			if (!typeId) {
				issues.push(`请选择${propagation ? "传播模型" : layers.find((layer) => layer.id === layerId)?.label || layerId}协议`);
				return;
			}
			const item = itemFor(layerId, typeId, propagation);
			if (!item) {
				issues.push(`${layerId} 未注册协议：${typeId}，请先预编译`);
				return;
			}
			if (!item.attributes) {
				issues.push(`${typeId} 缺少注册属性信息，请先预编译`);
				return;
			}
			for (const [name, value] of Object.entries(nonBlankAttributes(attrs))) {
				const attr = item.attributes.find((entry) => entry.name === name);
				if (!attr) {
					issues.push(`${label} 没有属性 ${name}`);
					continue;
				}
				const state = attributeEditState(item, attr, layerId);
				if (!state.editable) issues.push(`${label}.${name}：${state.reason}`);
				if (![
					"string",
					"number",
					"boolean"
				].includes(typeof value)) issues.push(`${label}.${name} 必须是标量属性值`);
				else if (state.editable) try {
					attributeLiteral(attr, value);
				} catch (error) {
					issues.push(`${label}.${name}：${error instanceof Error ? error.message : String(error)}`);
				}
			}
		};
		for (const node of spec.nodes.length ? spec.nodes : [void 0]) for (const config of deviceProtocolConfigurations(spec, node)) check(config.layerId, config.typeId, config.attributes, node ? `节点 ${node.id} 的 ${config.typeId}` : config.typeId);
		check("channel", spec.channel?.type, extras[spec.channel?.type] || {});
		check("channel", spec.channel?.propagation, extras[spec.channel?.propagation] || {}, spec.channel?.propagation, true);
		for (const item of layers.find((layer) => layer.id === "mobility")?.items || []) if (Object.keys(nonBlankAttributes(extras[item.typeId] || {})).length) issues.push(`${item.typeId} 的移动模型属性必须放在节点 protocolAttributes 中`);
		const ids = new Set(spec.nodes.map((node) => node.id));
		for (const node of spec.nodes) {
			const overrides = node.protocolAttributes;
			if (overrides !== void 0) if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) issues.push(`节点 ${node.id} 的协议覆盖必须是对象`);
			else for (const [typeId, attrs] of Object.entries(overrides)) {
				if (!attrs || typeof attrs !== "object" || Array.isArray(attrs)) {
					issues.push(`节点 ${node.id} 的 ${typeId} 覆盖必须是属性对象`);
					continue;
				}
				if (Object.values(attrs).some((value) => ![
					"string",
					"number",
					"boolean"
				].includes(typeof value))) issues.push(`节点 ${node.id} 的 ${typeId} 属性必须是标量`);
				const owner = layers.find((layer) => layer.items.some((item) => item.typeId === typeId));
				if (Object.keys(attrs).length && owner && owner.id !== "mobility" && !NODE_PROTOCOL_LAYERS.some((id) => id === owner.id)) issues.push(`节点 ${node.id} 的 ${typeId} 不支持节点协议覆盖；信道与传播模型在统一参数中配置，应用使用节点应用属性`);
			}
			if (node.mobility !== void 0) if (!node.mobility || typeof node.mobility !== "object" || Array.isArray(node.mobility) || typeof node.mobility.type !== "string") issues.push(`节点 ${node.id} 的移动模型必须包含 TypeId 字符串`);
			else {
				if (Object.keys(node.mobility).some((key) => key !== "type")) issues.push(`节点 ${node.id} 的移动模型仅保存 type；属性应放在节点 protocolAttributes 中`);
				check("mobility", node.mobility.type, overrides?.[node.mobility.type] || {}, `节点 ${node.id} 的 ${node.mobility.type}`);
			}
			if (!node.app) continue;
			check("app", node.app, node.appAttrs || {}, `节点 ${node.id} 的 ${node.app}`);
			if (hasSocketInterface(itemFor("app", node.app))) {
				if (node.appDestination === void 0) issues.push(`请为节点 ${node.id} 的应用选择目的节点`);
				else if (!ids.has(node.appDestination)) issues.push(`节点 ${node.id} 的应用目的节点不在拓扑中`);
			}
		}
		return [...new Set(issues)];
	};

//#endregion
//#region src/features/experiment/lib/typeIdCatalog.ts
	const LAYER_ORDER = [
		"app",
		"routing",
		"mac",
		"phy",
		"channel",
		"mobility"
	];
	/** One presentation order for discovered catalogs and empty layer navigation. Unknown layers stay stable. */
	const orderCatalogLayers = (layers) => {
		const rank = (id) => {
			const index = LAYER_ORDER.indexOf(id);
			return index < 0 ? LAYER_ORDER.length : index;
		};
		return [...layers].sort((a, b) => rank(a.id) - rank(b.id));
	};
	/** Layer navigation only. Protocol items must come from the selected simulator's probe. */
	const TYPEID_LAYERS = orderCatalogLayers([
		{
			id: "phy",
			label: "物理层",
			field: "phyId",
			items: []
		},
		{
			id: "mac",
			label: "MAC",
			field: "macId",
			items: []
		},
		{
			id: "routing",
			label: "路由",
			field: "routingId",
			items: []
		},
		{
			id: "app",
			label: "应用层",
			field: "appId",
			items: []
		},
		{
			id: "channel",
			label: "信道",
			field: "channelId",
			scope: "scene",
			items: []
		},
		{
			id: "mobility",
			label: "移动模型",
			field: "mobilityId",
			scope: "node",
			items: []
		}
	]);
	/** Optional display labels only: never a source of protocol availability, IDs or attributes. */
	const PROTOCOL_LABELS = {
		"ns3::AquaSimPhyFDM": "Phy FDM",
		"ns3::AquaSimPhyCmn": "Phy Cmn",
		"ns3::AquaSimPhySimple": "AquaSim Phy Simple",
		"ns3::AquaSimRadioPhy": "陆地无线电 PHY（理想）",
		"ns3::AquaSimSwarm": "Swarm",
		"ns3::AquaSimTDMA": "TDMA",
		"ns3::AquaSimBroadcastMac": "Broadcast",
		"ns3::AquaSimPAloha": "Pure Aloha",
		"ns3::AquaSimStaticRouting": "Static Routing",
		"ns3::AquaSimTrafficGen": "Traffic Gen",
		"ns3::OnOffNDApplication": "OnOff ND",
		"ns3::AquaSimChannel": "Channel",
		"ns3::AquaSimRangePropagation": "Range Propagation",
		"ns3::AquaSimSimplePropagation": "Simple Propagation",
		"ns3::AquaSimBellhopPropagation": "Bellhop",
		"ns3::AquaSimRadioChannel": "陆地无线电信道（理想）",
		"ns3::AquaSimRadioPropagation": "陆地光速传播（理想）"
	};

//#endregion
//#region src/features/experiment/lib/legacyExperiment.ts
	const legacyAppDefaults = (typeId, rate, packetSize, count, periodic) => typeId === "ns3::AquaSimTrafficGen" ? {
		Delay: String(packetSize * 8 / rate),
		PacketSize: String(packetSize)
	} : typeId === "ns3::OnOffNDApplication" ? {
		DataRate: `${rate}bps`,
		PacketSize: String(packetSize),
		Nsend: String(count),
		traffic: String(rate / (packetSize * 8)),
		mode: periodic ? "0" : "1",
		OffTime: "ns3::ConstantRandomVariable[Constant=0]"
	} : {};
	/** Compatibility boundary for old API callers. New node applications never pass through preset logic. */
	const normalizeLegacyTrafficSpec = (spec) => {
		const traffic = spec.traffic;
		if (!traffic || traffic.preset === "none" || !("src" in traffic)) return spec;
		if (!spec.nodes.some((node) => node.id === Number(traffic.src))) throw new Error("流量源不在拓扑中");
		const rate = Math.max(1, Math.round(Number(traffic.rate_bps) || 80));
		const packetSize = Math.max(1, Math.round(Number(traffic.pkt) || 50));
		return {
			...spec,
			traffic: { preset: "none" },
			nodes: spec.nodes.map((node) => {
				const app = node.app || (node.id === Number(traffic.src) ? "ns3::OnOffNDApplication" : "");
				if (!app) return node;
				return {
					...node,
					app,
					appDestination: node.appDestination ?? Number(traffic.dst),
					appAttrs: {
						...legacyAppDefaults(app, rate, packetSize, spec.nodes.length, traffic.preset === "periodic"),
						StartTime: traffic.start || "1s",
						StopTime: traffic.stop || spec.simStop,
						...spec.protocolAttributes?.[app],
						...node.appAttrs
					}
				};
			})
		};
	};

//#endregion
//#region src/shared/nodeModel.ts
	const NODE_MODEL_OPTIONS = [
		{
			value: "auv",
			label: "AUV · 自主水下航行器"
		},
		{
			value: "rov",
			label: "ROV · 遥控水下机器人"
		},
		{
			value: "vessel",
			label: "水面船"
		},
		{
			value: "buoy",
			label: "浮标"
		},
		{
			value: "sensor",
			label: "水下传感器"
		}
	];
	function isNodeModelType(value) {
		return NODE_MODEL_OPTIONS.some((option) => option.value === value);
	}

//#endregion
//#region src/features/experiment/lib/experimentValidation.ts
	const MAX_NODE_COUNT = 64;
	const MIN_NODE_ID = 1;
	const MAX_NODE_ID = 65534;
	const isNodeId = (value) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65534;
	/** Drafts may be empty; only execution requires MIN_NODE_COUNT. */
	const topologyIssues = (nodes, minimum = 0) => {
		const issues = [];
		if (nodes.length < minimum) issues.push(`至少需要 ${minimum} 个节点`);
		if (nodes.length > 64) issues.push(`最多支持 ${64} 个节点`);
		const ids = nodes.map((node) => node?.id);
		if (ids.some((id) => !isNodeId(id))) issues.push(`节点编号必须是 ${1}–${MAX_NODE_ID} 的整数`);
		if (new Set(ids).size !== ids.length) issues.push("节点编号不能重复");
		for (const node of nodes) if (node?.modelType !== void 0 && !isNodeModelType(node.modelType)) issues.push(`节点 ${node?.id} 的模型类型 modelType 无效`);
		if (nodes.some((node) => [
			node?.x,
			node?.y,
			node?.z === void 0 ? 0 : node.z
		].some((value) => typeof value !== "number" || !Number.isFinite(value)))) issues.push("节点坐标必须是有效数字");
		return issues;
	};
	const MAX_TIME_SECONDS = 9223372036;
	const parseExperimentTime = (value, label, allowNegative = false) => {
		let seconds;
		try {
			seconds = parseQuantity(value, "s").value;
		} catch (error) {
			throw new Error(`${label}：${error instanceof Error ? error.message : String(error)}`);
		}
		const match = String(value).trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµμ]*)$/i);
		const unit = canonicalUnit((match[2] || "s").toLowerCase()) || "s";
		if (!Number.isFinite(seconds) || !allowNegative && seconds < 0) throw new Error(`${label} 必须是${allowNegative ? "" : "非负的"}有效时间`);
		if (Math.abs(seconds) > MAX_TIME_SECONDS) throw new Error(`${label} 超出仿真时钟可表示的范围`);
		return {
			literal: `${match[1].toLowerCase()}${unit}`,
			seconds
		};
	};
	/** Missing optional application times use defaults; invalid supplied values never do. */
	const experimentTimeLiteral = (value, label, fallback) => {
		return parseExperimentTime((value === void 0 || typeof value === "string" && !value.trim()) && fallback !== void 0 ? fallback : value, label).literal;
	};
	const isTimeAttribute = (item, name) => !!item?.attributes?.some((attribute) => attribute.name === name && attribute.valueType === "ns3::TimeValue");
	/** Validate only actual TimeValue attributes; checker-specific ranges belong to ns-3. */
	const experimentTimeIssues = (spec, layers = TYPEID_LAYERS) => {
		const issues = [];
		const check = (action) => {
			try {
				action();
			} catch (error) {
				issues.push(error instanceof Error ? error.message : String(error));
			}
		};
		check(() => experimentTimeLiteral(spec.simStop, "仿真时长 simStop"));
		const extras = spec.protocolAttributes || {};
		const find = (typeId) => layers.flatMap((layer) => layer.items).find((item) => item.typeId === typeId);
		const attributes = (typeId, values, label = typeId) => {
			const item = find(typeId);
			for (const [name, value] of Object.entries(nonBlankAttributes(values))) if (isTimeAttribute(item, name)) check(() => parseExperimentTime(value, `${label}.${name}`, true));
		};
		for (const node of spec.nodes.length ? spec.nodes : [void 0]) for (const config of deviceProtocolConfigurations(spec, node)) if (config.typeId) attributes(config.typeId, config.attributes, node ? `节点 ${node.id} 的 ${config.typeId}` : config.typeId);
		for (const typeId of [spec.channel?.type, spec.channel?.propagation]) if (typeId) attributes(typeId, extras[typeId] || {});
		for (const node of spec.nodes || []) {
			if (node.app) attributes(node.app, node.appAttrs || {}, `节点 ${node.id} 的 ${node.app}`);
			if (node.mobility?.type) attributes(node.mobility.type, node.protocolAttributes?.[node.mobility.type] || {}, `节点 ${node.id} 的 ${node.mobility.type}`);
		}
		return issues;
	};

//#endregion
//#region src/features/experiment/lib/generateScratch.ts
	const num = (value) => Number(value) || 0;
	const quoted = (value) => JSON.stringify(value);
	/** Assemble registered interfaces uniformly; legacy presets are normalized before this boundary. */
	const generateAquaVisualCc = (input, layers = TYPEID_LAYERS, logName = "net.aqua-visual.json") => {
		const spec = normalizeLegacyTrafficSpec(input);
		const nodes = Array.isArray(spec?.nodes) ? spec.nodes : [];
		const issues = [
			...topologyIssues(nodes, 2),
			...protocolMetadataIssues(spec, layers),
			...experimentTimeIssues(spec, layers)
		];
		if (issues.length) throw new Error(issues.join("；"));
		const find = (layer, value, propagation = false) => {
			const item = layers.find((entry) => entry.id === layer)?.items.find((entry) => entry.typeId === value && (layer !== "channel" || entry.field === "propagationId" === propagation));
			if (!item) throw new Error(`${layer} 未注册协议：${value}，请先预编译`);
			return item;
		};
		const phy = find("phy", spec.stack.phy.type);
		const mac = find("mac", spec.stack.mac.type);
		const routing = find("routing", spec.stack.routing.type);
		const channel = find("channel", spec.channel.type);
		const propagation = find("channel", spec.channel.propagation, true);
		const extras = spec.protocolAttributes || {};
		const attrsFor = (item, attrs) => `{${Object.entries(nonBlankAttributes(attrs)).map(([key, value]) => {
			const attr = item.attributes?.find((entry) => entry.name === key);
			const text = attr ? attributeLiteral(attr, value) : String(value);
			return `{${quoted(key)}, ${quoted(text)}}`;
		}).join(", ")}}`;
		const factoryFor = (item, attrs) => `VisualFactory(${quoted(item.typeId)}, ${attrsFor(item, attrs)})`;
		const deviceAttributes = [
			phy,
			mac,
			routing
		].map((item, index) => `    const std::vector<VisualAttributes> node${[
			"Phy",
			"Mac",
			"Routing"
		][index]}Attributes = {
${nodes.map((node) => `        ${attrsFor(item, deviceProtocolConfigurations(spec, node)[index].attributes)}`).join(",\n")}
    };`).join("\n");
		const simulationTime = parseExperimentTime(spec.simStop, "仿真时长 simStop");
		const simStop = simulationTime.literal;
		const mobility = nodes.map((node, index) => {
			const item = node.mobility ? find("mobility", node.mobility.type) : null;
			const type = item?.typeId || "ns3::ConstantPositionMobilityModel";
			const attributes = item ? attrsFor(item, node.protocolAttributes?.[item.typeId] || {}) : "{}";
			return `    nodesCon.Get(${index})->AggregateObject(VisualCreateMobility(${quoted(type)}, ${attributes}, ${node.id}, Vector(${num(node.x)}, ${num(node.y)}, ${num(node.z)})));`;
		}).join("\n");
		const apps = nodes.map((node, index) => {
			if (!node.app) return "";
			const item = find("app", node.app);
			const socket = hasSocketInterface(item);
			return `    {
        auto factory = ${factoryFor(item, node.appAttrs || {})};
${socket ? `        AquaSimSocketAddress remote;
        remote.SetAllDevices();
        remote.SetDestinationAddress(AquaSimAddress(${node.appDestination}));
        remote.SetProtocol(0);
        factory.Set("Protocol", TypeIdValue(AquaVisualSocketFactory::GetTypeId()));
        factory.Set("Remote", AddressValue(remote));
` : ""}        nodesCon.Get(${index})->AddApplication(factory.Create<Application>());
    }`;
		}).join("\n");
		const metadata = JSON.stringify({ meta: {
			schema: "uan-vis-packet-log/v2",
			time_unit: "us",
			time_precision_us: .001,
			sim_end_us: Math.round(simulationTime.seconds * 1e6),
			distance_unit: "m",
			protocols: {
				phy: [phy.typeId],
				mac: [mac.typeId],
				routing: [routing.typeId],
				channel: [channel.typeId]
			}
		} }).slice(0, -2);
		const nodeMetadata = JSON.stringify(nodes.map((node) => ({
			node_id: node.id,
			name: node.name || `Node-${node.id}`,
			x: num(node.x),
			y: num(node.y),
			z: num(node.z),
			role: node.role || "node",
			...node.modelType === void 0 ? {} : { modelType: node.modelType },
			...node.mobility === void 0 ? {} : {
				mobility: { type: node.mobility.type },
				protocolAttributes: { [node.mobility.type]: node.protocolAttributes?.[node.mobility.type] || {} }
			}
		})));
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
    const std::vector<uint16_t> nodeAddresses = {${nodes.map((node) => node.id).join(", ")}};
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
${nodes.map((node, index) => `    devices.Get(${index})->SetAddress(AquaSimAddress(${node.id}));`).join("\n")}
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
`;
	};

//#endregion
//#region \0aquasim-engine
	globalThis.Aquasim = {
		preflight(spec) {
			if (!spec || typeof spec !== "object" || Array.isArray(spec) || !Array.isArray(spec.nodes)) throw new Error("缺少有效的实验配置与节点列表");
			const issues = topologyIssues(spec.nodes, 2);
			if (issues.length) throw new Error(issues.join("；"));
			parseExperimentTime(spec.simStop, "仿真时长 simStop");
			for (const layer of [
				"phy",
				"mac",
				"routing"
			]) if (!spec.stack || !spec.stack[layer] || typeof spec.stack[layer].type !== "string" || !spec.stack[layer].type) throw new Error("请选择 " + layer + " 协议");
			if (!spec.channel || typeof spec.channel.type !== "string" || !spec.channel.type || typeof spec.channel.propagation !== "string" || !spec.channel.propagation) throw new Error("请选择信道与传播模型");
			return true;
		},
		generate(spec, layers, logName) {
			return generateAquaVisualCc(spec, layers, logName);
		},
		probe: BUILTIN_PROTOCOL_CC + "\n#include \"ns3/aqua-sim-tg-module.h\"\n#include \"ns3/core-module.h\"\n#include \"ns3/network-module.h\"\n#include \"ns3/mobility-module.h\"\n#include <iomanip>\n#include <iostream>\n#include <set>\n#include <sstream>\nusing namespace ns3;\nstd::string Quote(const std::string& value) {\n    std::ostringstream out; out << '\"';\n    for (unsigned char c : value) {\n        if (c == '\"' || c == '\\\\') out << '\\\\' << c;\n        else if (c < 32) out << \"\\\\u\" << std::hex << std::setw(4) << std::setfill('0') << unsigned(c) << std::dec;\n        else out << c;\n    }\n    out << '\"'; return out.str();\n}\nint main() {\n    // Force the Aqua-Sim library to be linked; enumerate metadata without constructing devices.\n    AquaSimChannel::GetTypeId(); AquaSimPhy::GetTypeId(); AquaSimMac::GetTypeId();\n    MobilityModel::GetTypeId();\n    std::cout << \"AQUASIM_CATALOG_BEGIN\\n[\";\n    bool first = true;\n    for (uint32_t i = 0; i < TypeId::GetRegisteredN(); ++i) {\n        auto tid = TypeId::GetRegistered(i);\n        if (!tid.HasConstructor()) continue;\n        std::string layer;\n        if (tid.IsChildOf(AquaSimPhy::GetTypeId())) layer = \"phy\";\n        else if (tid.IsChildOf(AquaSimMac::GetTypeId())) layer = \"mac\";\n        else if (tid.IsChildOf(AquaSimRouting::GetTypeId())) layer = \"routing\";\n        else if (tid == AquaSimChannel::GetTypeId() || tid.IsChildOf(AquaSimChannel::GetTypeId())) layer = \"channel\";\n        else if (tid.IsChildOf(AquaSimPropagation::GetTypeId())) layer = \"propagation\";\n        else if (tid.IsChildOf(Application::GetTypeId())) layer = \"app\";\n        else if (tid.IsChildOf(MobilityModel::GetTypeId())) layer = \"mobility\";\n        else continue;\n        if (!first) std::cout << ',';\n        first = false;\n        std::cout << \"{\\\"layer\\\":\" << Quote(layer) << \",\\\"typeId\\\":\" << Quote(tid.GetName())\n                  << \",\\\"parentTypeId\\\":\" << Quote(tid.GetParent().GetName())\n                  << \",\\\"groupName\\\":\" << Quote(tid.GetGroupName()) << \",\\\"attributes\\\":[\";\n        bool firstAttr = true; std::set<std::string> seen;\n        for (auto parent = tid; parent != ObjectBase::GetTypeId(); parent = parent.GetParent()) {\n            for (uint32_t j = 0; j < parent.GetAttributeN(); ++j) {\n                auto attr = parent.GetAttribute(j);\n                if (!seen.insert(attr.name).second) continue;\n                if (!firstAttr) std::cout << ',';\n                firstAttr = false;\n                std::cout << \"{\\\"name\\\":\" << Quote(attr.name) << \",\\\"help\\\":\" << Quote(attr.help)\n                          << \",\\\"valueType\\\":\" << Quote(attr.checker->GetValueTypeName())\n                          << \",\\\"defaultValue\\\":\" << Quote(attr.initialValue->SerializeToString(attr.checker))\n                          << \",\\\"ownerTypeId\\\":\" << Quote(parent.GetName())\n                          << \",\\\"constructible\\\":\" << ((attr.flags & TypeId::ATTR_CONSTRUCT) ? \"true\" : \"false\")\n                          << \",\\\"readable\\\":\" << ((attr.flags & TypeId::ATTR_GET) ? \"true\" : \"false\")\n                          << \",\\\"writable\\\":\" << ((attr.flags & TypeId::ATTR_SET) ? \"true\" : \"false\");\n                if (attr.checker->HasUnderlyingTypeInformation()) {\n                    std::cout << \",\\\"underlyingType\\\":\" << Quote(attr.checker->GetUnderlyingTypeInformation());\n                }\n                if (auto pointer = dynamic_cast<const PointerChecker*>(PeekPointer(attr.checker))) {\n                    std::cout << \",\\\"pointeeTypeId\\\":\" << Quote(pointer->GetPointeeTypeId().GetName());\n                }\n                std::cout << '}';\n            }\n            if (parent.GetParent() == parent) break;\n        }\n        std::cout << \"]}\";\n    }\n    std::cout << \"]\\nAQUASIM_CATALOG_END\\n\";\n}\n",
		sources: BUILTIN_PROTOCOL_SOURCES,
		catalog(stdout) {
			const match = stdout.match(/AQUASIM_CATALOG_BEGIN\s*([\s\S]*?)\s*AQUASIM_CATALOG_END/);
			if (!match) throw new Error("未能读取 ns-3 注册协议，请查看编译输出");
			const rows = JSON.parse(match[1]);
			if (!Array.isArray(rows)) throw new Error("无效的协议目录");
			const layers = TYPEID_LAYERS.map((layer) => ({
				...layer,
				items: layer.id === "app" ? [{
					id: "none",
					typeId: "",
					label: "无独立应用",
					source: ""
				}] : []
			}));
			for (const row of rows) {
				const layer = layers.find((item) => item.id === (row.layer === "propagation" ? "channel" : row.layer));
				if (!layer || !/^ns3::[A-Za-z0-9_:]+$/.test(row.typeId)) continue;
				layer.items.push({
					id: row.typeId,
					typeId: row.typeId,
					label: PROTOCOL_LABELS[row.typeId] || row.typeId.replace("ns3::", ""),
					source: "",
					field: row.layer === "propagation" ? "propagationId" : layer.field,
					attributes: row.attributes,
					parentTypeId: row.parentTypeId,
					groupName: row.groupName
				});
			}
			if (!layers.find((layer) => layer.id === "mac")?.items.length) throw new Error("当前 ns-3 未注册可用的 Aqua-Sim MAC");
			return JSON.stringify(layers);
		}
	};

//#endregion
})();