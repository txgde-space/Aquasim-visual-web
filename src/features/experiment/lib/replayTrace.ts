/** Protocol-independent PHY trace adapter; only observed successful receptions are recorded. */
export const REPLAY_TRACE_CC = String.raw`
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

struct VisualRx { uint32_t dst; int64_t startNs; };
struct VisualTx { uint32_t src; int64_t startNs; int64_t durationNs; std::vector<VisualRx> receivers; };
static std::vector<VisualTx> visualPackets;
static void VisualTxTrace(uint32_t id, Ptr<AquaSimPhy> phy, Ptr<Packet> packet, double noise) {
    auto copy = packet->Copy();
    AquaSimPacketStamp stamp; copy->RemoveHeader(stamp);
    auto durationNs = phy->calcTxTime(copy).GetNanoSeconds();
    AquaVisualTxTag tag;
    packet->RemovePacketTag(tag);
    tag.eventId = visualPackets.size();
    // Packet tags survive channel copies without adding on-air bytes. Replacing
    // a tag on retransmission leaves already-in-flight packet copies intact.
    packet->AddPacketTag(tag);
    visualPackets.push_back({id, Simulator::Now().GetNanoSeconds(), durationNs, {}});
}
static void VisualRxTrace(uint32_t id, Ptr<Packet> packet, double noise) {
    AquaVisualTxTag tag;
    if (!packet->PeekPacketTag(tag) || tag.eventId >= visualPackets.size()) return;
    auto& tx = visualPackets[static_cast<size_t>(tag.eventId)];
    if (tx.src == id) return;
    auto startNs = std::max(tx.startNs, Simulator::Now().GetNanoSeconds() - tx.durationNs);
    tx.receivers.push_back({id, startNs});
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
            output << "{\"dst\":" << rx.dst << ",\"rx_start_us\":" << rx.startNs / 1000.0
                   << ",\"rx_duration_us\":" << tx.durationNs / 1000.0 << ",\"status\":\"ok\"}";
        }
        output << "]}";
    }
    output << "]}";
    output.precision(previousPrecision);
}
`
