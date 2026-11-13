/** Public trace-interface adapter; records observed reception attempts and outcomes, never inferred geometry. */
export const REPLAY_TRACE_CC = String.raw`
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
`
