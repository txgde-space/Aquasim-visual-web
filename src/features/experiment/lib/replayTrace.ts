/** Protocol-independent PHY trace adapter; only observed successful receptions are recorded. */
export const REPLAY_TRACE_CC = String.raw`
struct VisualRx { uint32_t dst; int64_t start; };
struct VisualTx { uint64_t uid; uint32_t src; int64_t start; int64_t duration; std::vector<VisualRx> receivers; };
static std::vector<VisualTx> visualPackets;
static void VisualTxTrace(uint32_t id, Ptr<AquaSimPhy> phy, Ptr<Packet> packet, double noise) {
    auto copy = packet->Copy();
    AquaSimPacketStamp stamp; copy->RemoveHeader(stamp);
    auto duration = std::max<int64_t>(1, phy->calcTxTime(copy).GetMicroSeconds());
    visualPackets.push_back({packet->GetUid(), id, Simulator::Now().GetMicroSeconds(), duration, {}});
}
static void VisualRxTrace(uint32_t id, Ptr<Packet> packet, double noise) {
    for (auto it = visualPackets.rbegin(); it != visualPackets.rend(); ++it) {
        if (it->uid != packet->GetUid() || it->src == id) continue;
        auto start = std::max(it->start, Simulator::Now().GetMicroSeconds() - it->duration);
        it->receivers.push_back({id, start}); break;
    }
}
static void WriteVisualPackets(std::ostream& output) {
    output << ",\"packets\":[";
    for (size_t i = 0; i < visualPackets.size(); ++i) {
        if (i) output << ',';
        const auto& tx = visualPackets[i];
        output << "{\"packet_id\":\"phy-" << i << "\",\"src\":" << tx.src
               << ",\"tx_start_us\":" << tx.start << ",\"tx_duration_us\":" << tx.duration << ",\"receivers\":[";
        for (size_t j = 0; j < tx.receivers.size(); ++j) {
            if (j) output << ',';
            const auto& rx = tx.receivers[j];
            output << "{\"dst\":" << rx.dst << ",\"rx_start_us\":" << rx.start
                   << ",\"rx_duration_us\":" << tx.duration << ",\"status\":\"ok\"}";
        }
        output << "]}";
    }
    output << "]}";
}
`
