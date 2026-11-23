// Include in ONE translation unit (normally the scratch main.cc).
// Requires ns-3 core/network/mobility; no Aqua-Sim dependency in this header.
#pragma once
#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/mobility-module.h"
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>
#include "detail/trace-core.h"

namespace ns3 {
class VisualLogger {
public:
    // ids are the SAME IDs used by all packet callbacks; not necessarily Node::GetId().
    VisualLogger(const NodeContainer& nodes, const std::vector<uint16_t>& ids,
                     Time stop, Time sampleInterval = MilliSeconds(100)) : m_stop(stop) {
        using namespace visual_logger_detail;
        static bool used = false;
        if (used) throw std::runtime_error("Use one VisualLogger per process");
        if (Simulator::Now() != Seconds(0) || stop <= Seconds(0) || sampleInterval <= Seconds(0))
            throw std::runtime_error("Initialize logger at time 0 with positive stop/sample interval");
        if (nodes.GetN() == 0 || nodes.GetN() != ids.size() || nodes.GetN() > 4000)
            throw std::runtime_error("Expected 1..4000 nodes with one explicit ID per node");
        for (uint32_t i = 0; i < nodes.GetN(); ++i) {
            if (!m_ids.insert(ids[i]).second) throw std::runtime_error("Duplicate node ID");
            auto model = nodes.Get(i)->GetObject<MobilityModel>();
            if (!model) throw std::runtime_error("Every logged node needs a MobilityModel");
            const Vector p = model->GetPosition();
            if (!VisualFinitePosition(p)) throw std::runtime_error("Invalid initial node coordinates");
            m_nodes.push_back({ids[i], p, "Node-" + std::to_string(ids[i]), ""});
        }
        used = true;
        m_sample = Seconds(std::max(sampleInterval.GetSeconds(), stop.GetSeconds() * nodes.GetN() / 20000.0));
        try { VisualStartMobilityTrace(nodes, ids, m_sample, stop); }
        catch (...) { Disconnect(); throw; }
    }
    VisualLogger(const VisualLogger&) = delete;
    VisualLogger& operator=(const VisualLogger&) = delete;
    ~VisualLogger() { Disconnect(); }

    void SetNodeDisplay(uint16_t id, const std::string& name, const std::string& modelType = "") {
        RequireNode(id);
        if (!modelType.empty() && modelType != "auv" && modelType != "rov" && modelType != "vessel"
            && modelType != "buoy" && modelType != "sensor") throw std::runtime_error("Invalid modelType");
        for (auto& node : m_nodes) if (node.id == id) { node.name = name; node.model = modelType; }
    }
    void SetPropagationSpeed(double metresPerSecond) {
        if (!std::isfinite(metresPerSecond) || metresPerSecond <= 0) throw std::runtime_error("Invalid propagation speed");
        m_speed = metresPerSecond;
    }
    void SetRunId(const std::string& runId) {
        if (m_finished || runId.empty()) throw std::runtime_error("Invalid logger run ID");
        m_runId = runId;
    }

    // Adapter API: call at the real transmission, before the channel copies the packet.
    // The PacketTag distinguishes retransmissions/forwarding even when Packet UID is reused.
    void Tx(uint32_t id, Ptr<Packet> packet, Time airtime) {
        RequireNode(id); visual_logger_detail::VisualTxTrace(id, airtime, packet);
    }
    void RxBegin(uint32_t id, Ptr<Packet> packet, Time airtime) {
        RequireNode(id);
        if (airtime.GetNanoSeconds() < 0) throw std::runtime_error("Invalid reception duration");
        visual_logger_detail::visualReceiveEvents = true;
        visual_logger_detail::VisualRxBeginTrace(id, packet, airtime);
    }
    // At physical completion, not application delivery. Without RxBegin the common
    // fallback derives reception start from completion minus transmitter airtime.
    void RxSuccess(uint32_t id, Ptr<Packet> packet) {
        RequireNode(id); visual_logger_detail::VisualRxTrace(id, packet, 0);
    }
    void RxCollision(uint32_t id, Ptr<Packet> packet, Ptr<Packet> interferer, const std::string& reason) {
        RequireNode(id); visual_logger_detail::VisualRxCollisionTrace(id, packet, interferer, reason);
    }
    void RxDrop(uint32_t id, Ptr<Packet> packet, const std::string& reason) {
        RequireNode(id); visual_logger_detail::VisualRxDropTrace(id, packet, reason);
    }
    void RxEnd(uint32_t id, Ptr<Packet> packet) {
        RequireNode(id); visual_logger_detail::VisualRxEndTrace(id, packet);
    }

    // Common Ptr<Packet>, double trace adapter. airtime callback accounts for the
    // actual packet/header layout of the installed PHY. Never guessed from bytes/rate.
    bool AttachPhy(uint32_t id, Ptr<Object> phy, Callback<Time, Ptr<Packet>> airtime,
                   Ptr<Object> cache = nullptr, bool receiveEvents = true) {
        using namespace visual_logger_detail;
        RequireNode(id);
        if (!phy || airtime.IsNull()) throw std::runtime_error("Missing PHY or airtime callback");
        if (!m_phys.insert(PeekPointer(phy)).second || !m_attachedIds.insert(id).second)
            throw std::runtime_error("Duplicate PHY/node attachment");
        const std::string contract = "ns3::AquaSimPhy::TracedCallback";
        if (!VisualConnectTrace(phy, "Tx", contract, MakeBoundCallback(&OnTx, this, id, airtime)))
            throw std::runtime_error("Tx trace missing/incompatible; adapt AttachPhy to this branch");
        if (!receiveEvents) return false; // TX context only; no observations of this node's receivers.
        const bool completion = VisualConnectTrace(phy, "RxComplete", contract,
            MakeBoundCallback(&VisualRxTrace, id));
        const auto receive = completion ? MakeBoundCallback(&VisualRxDeliveryTrace, id)
                                        : MakeBoundCallback(&VisualRxTrace, id);
        if (!VisualConnectTrace(phy, "Rx", contract, receive))
            throw std::runtime_error("Rx trace missing/incompatible; adapt AttachPhy to this branch");
        Ptr<Object> source = phy;
        const auto begin = MakeBoundCallback(&VisualRxBeginTrace, id);
        bool events = VisualConnectTrace(source, "RxBegin", "ns3::AquaVisualRxBeginCallback", begin);
        if (!events) {
            source = cache;
            events = VisualConnectTrace(source, "RxBegin", "ns3::AquaVisualRxBeginCallback", begin);
        }
        if (events) {
            visualReceiveEvents = true;
            VisualConnectTrace(source, "RxCollision", "ns3::AquaVisualRxCollisionCallback", MakeBoundCallback(&VisualRxCollisionTrace, id));
            VisualConnectTrace(source, "RxDrop", "ns3::AquaVisualRxDropCallback", MakeBoundCallback(&VisualRxDropTrace, id));
            VisualConnectTrace(source, "RxEnd", "ns3::AquaVisualRxEndCallback", MakeBoundCallback(&VisualRxEndTrace, id));
        }
        return events; // false = successful reception only, NOT proof of no collisions.
    }

    void Finalize() {
        using namespace visual_logger_detail;
        if (m_finished) return;
        VisualFinishMobilityTrace();
        Disconnect();
        m_end = std::min(m_stop, Simulator::Now());
        m_finished = true;
    }
    // Run() has returned, but nodes/mobility models must still be alive.
    void Write(const std::string& filename) {
        using namespace visual_logger_detail;
        Finalize();
        std::ostringstream out;
        WriteMetadata(out);
        WriteVisualMovements(out);
        WriteVisualPackets(out);
        Save(filename, out.str());
    }
    // Each file owns ONLY this node's TX and RX events, plus its own trajectory.
    // Known initial topology metadata lets a partial import place its peers.
    void WriteNode(const std::string& filename, uint16_t owner) {
        using namespace visual_logger_detail;
        if (!m_ids.count(owner)) throw std::runtime_error("Unknown node log owner");
        Finalize();
        if (m_runId.empty()) throw std::runtime_error("Node logs need a shared run ID");
        std::ostringstream out;
        WriteMetadata(out, owner);
        WriteVisualMovements(out, owner);
        out << ",\"events\":[";
        bool first = true;
        size_t events = 0;
        for (size_t i = 0; i < visualPackets.size(); ++i) {
            const auto& tx = visualPackets[i];
            const auto identity = [&] {
                if (++events > 30000) throw std::runtime_error("Node log exceeds 30000 events");
                if (!first) out << ',';
                first = false;
                out << "{\"event_id\":\"phy-" << i << "\",\"packet_id\":\"phy-" << i
                    << "\",\"src\":" << tx.src << ",\"tx_start_us\":" << tx.startNs / 1000.0
                    << ",\"tx_duration_us\":" << tx.durationNs / 1000.0;
            };
            if (tx.src == owner) { identity(); out << ",\"type\":\"tx_start\"}"; }
            for (const auto& rx : tx.receivers) {
                if (rx.dst != owner) continue;
                identity();
                out << ",\"type\":\"" << (rx.status == "ok" ? "rx_success" : "rx_drop") << "\",";
                std::ostringstream receiver;
                receiver << std::setprecision(17);
                WriteVisualReceiver(receiver, rx);
                out << receiver.str().substr(1); // same RX fields as the network writer
            }
        }
        out << "]}";
        Save(filename, out.str());
    }
private:
    void WriteMetadata(std::ostream& out, int64_t owner = -1) const {
        using namespace visual_logger_detail;
        out << std::setprecision(17)
            << "{\"meta\":{\"schema\":\"" << (owner < 0 ? "uan-vis-packet-log/v2" : "uan-vis-node-log/v2")
            << "\",\"time_unit\":\"us\","
            << "\"time_precision_us\":0.001,\"distance_unit\":\"m\",\"sim_end_us\":"
            << m_end.GetNanoSeconds() / 1000.0
            << ",\"mobility_sample_interval_us\":" << m_sample.GetNanoSeconds() / 1000.0
            << ",\"trace_scope\":\"" << (visualReceiveEvents ? "phy-events" : "phy-success") << '"';
        if (m_speed > 0) out << ",\"propagation_speed_mps\":" << m_speed;
        if (!m_runId.empty()) out << ",\"run_id\":" << VisualJsonString(m_runId);
        if (owner >= 0) out << ",\"log_scope\":\"node\",\"node_id\":" << owner;
        out << "},\"nodes\":[";
        for (size_t i = 0; i < m_nodes.size(); ++i) {
            if (i) out << ',';
            const auto& n = m_nodes[i];
            out << "{\"node_id\":" << n.id << ",\"name\":" << VisualJsonString(n.name)
                << ",\"x\":" << n.position.x << ",\"y\":" << n.position.y << ",\"z\":" << n.position.z;
            if (!n.model.empty()) out << ",\"modelType\":" << VisualJsonString(n.model);
            out << '}';
        }
        out << ']';
    }
    static void Save(const std::string& filename, const std::string& text) {
        if (text.size() + 1 > 24 * 1024 * 1024) throw std::runtime_error("Replay exceeds Web's 24 MiB import limit");
        std::ofstream file(filename, std::ios::binary);
        file << text << '\n';
        file.close();
        if (!file) throw std::runtime_error("Unable to write replay: " + filename);
    }
    struct NodeInfo { uint16_t id; Vector position; std::string name, model; };
    std::vector<NodeInfo> m_nodes;
    std::set<uint32_t> m_ids, m_attachedIds;
    std::set<const Object*> m_phys;
    Time m_stop, m_sample, m_end;
    std::string m_runId;
    double m_speed = 0;
    bool m_finished = false;
    void RequireNode(uint32_t id) const {
        if (m_finished || !m_ids.count(id)) throw std::runtime_error("Inactive logger or unregistered node ID");
    }
    static void OnTx(VisualLogger* self, uint32_t id, Callback<Time, Ptr<Packet>> airtime,
                     Ptr<Packet> packet, double) { self->Tx(id, packet, airtime(packet)); }
    static void Disconnect() {
        using namespace visual_logger_detail;
        visualMobilityRecording = false;
        visualMobilitySampleEvent.Cancel();
        for (const auto& c : connections) c.source->TraceDisconnectWithoutContext(c.name, c.callback);
        connections.clear();
    }
};
} // namespace ns3
