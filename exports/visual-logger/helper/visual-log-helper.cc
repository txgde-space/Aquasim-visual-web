#include "visual-log-helper.h"
#include "../adapters/aqua-sim-adapter.h"
#include <chrono>
#include <filesystem>

namespace ns3 {
struct VisualLogHelper::State {
    std::unique_ptr<VisualLogger> logger;
    Ptr<Object> nodeListOwner;
    std::vector<uint16_t> ids;
    VisualLogScope scope;
    std::optional<uint16_t> local;
    std::filesystem::path directory;
    bool flushed = false;
    void Flush() {
        if (flushed) return;
        logger->Finalize();
        if (scope != VisualLogScope::NODE) logger->Write((directory / "net.json").string());
        if (scope != VisualLogScope::NETWORK) {
            for (const auto id : ids) if (!local || *local == id)
                logger->WriteNode((directory / ("node." + std::to_string(id) + ".json")).string(), id);
        }
        flushed = true;
        logger.reset();
        nodeListOwner = nullptr;
    }
};
void VisualLogHelper::RequireConfigurable() const {
    if (m_installed) throw std::runtime_error("Configure logging before Install");
}
void VisualLogHelper::SetEnabled(bool enabled) { RequireConfigurable(); m_enabled = enabled; }
void VisualLogHelper::SetLogScope(VisualLogScope scope) { RequireConfigurable(); m_scope = scope; }
void VisualLogHelper::SetLocalNodeId(uint16_t address) { RequireConfigurable(); m_local = address; }
void VisualLogHelper::SetNodeModelType(uint16_t address, const std::string& type) {
    RequireConfigurable();
    if (type != "auv" && type != "rov" && type != "vessel" && type != "buoy" && type != "sensor")
        throw std::runtime_error("Invalid node modelType: " + type);
    m_models[address] = type;
}
void VisualLogHelper::SetNodeName(uint16_t address, const std::string& name) { RequireConfigurable(); m_names[address] = name; }
void VisualLogHelper::SetOutputDir(const std::string& directory) {
    RequireConfigurable();
    if (directory.empty()) throw std::runtime_error("Empty log output directory");
    m_directory = directory;
}
void VisualLogHelper::SetRunId(const std::string& runId) {
    RequireConfigurable();
    if (runId.empty() || runId.size() > 80 || runId.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_") != std::string::npos)
        throw std::runtime_error("Run ID must be 1..80 letters, digits, hyphens or underscores");
    m_runId = runId;
}
void VisualLogHelper::InstallAll(Time stop) {
    if (!m_enabled) { RequireConfigurable(); m_installed = true; return; }
    NetDeviceContainer devices;
    for (auto node = NodeList::Begin(); node != NodeList::End(); ++node)
        for (uint32_t i = 0; i < (*node)->GetNDevices(); ++i)
            if (DynamicCast<AquaSimNetDevice>((*node)->GetDevice(i))) devices.Add((*node)->GetDevice(i));
    Install(devices, stop);
}
void VisualLogHelper::Install(const NetDeviceContainer& devices, Time stop) {
    RequireConfigurable();
    m_installed = true;
    if (!m_enabled) return; // No directory, callbacks, PacketTags or sampling.
    auto state = std::make_shared<State>();
    state->scope = m_scope; state->local = m_local;
    state->ids = VisualLoggerNodeIds(devices);
    if (m_local && m_scope == VisualLogScope::NETWORK)
        throw std::runtime_error("Local node selection applies to NODE or BOTH output");
    const std::set<uint16_t> known(state->ids.begin(), state->ids.end());
    const auto requireId = [&](uint16_t id) {
        if (!known.count(id)) throw std::runtime_error("Unknown Aqua-Sim node address: " + std::to_string(id));
    };
    if (m_local) requireId(*m_local);
    for (const auto& item : m_models) requireId(item.first);
    for (const auto& item : m_names) requireId(item.first);
    // NodeList unregisters at Destroy. Retain its owner through our flush so
    // Node::Dispose cannot invalidate the final mobility positions beforehand.
    for (size_t i = 0; i < Config::GetRootNamespaceObjectN(); ++i) {
        auto object = Config::GetRootNamespaceObject(i);
        if (object->GetInstanceTypeId().GetName() == "ns3::NodeListPriv") state->nodeListOwner = object;
    }
    if (!state->nodeListOwner) throw std::runtime_error("Cannot retain ns-3 NodeList for automatic final logging");
    NodeContainer nodes;
    std::set<const Node*> registeredNodes;
    for (uint32_t i = 0; i < devices.GetN(); ++i) {
        auto node = devices.Get(i)->GetNode();
        if (!node || !registeredNodes.insert(PeekPointer(node)).second)
            throw std::runtime_error("Logging requires one Aqua-Sim device per node");
        nodes.Add(node);
    }
    const auto runId = m_runId.empty() ? "run-" + std::to_string(std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count()) : m_runId;
    state->directory = std::filesystem::path(m_directory) / runId;
    if (std::filesystem::exists(state->directory)) throw std::runtime_error("Log run directory already exists: " + state->directory.string());
    state->logger.reset(new VisualLogger(nodes, state->ids, stop));
    state->logger->SetRunId(runId);
    for (uint32_t i = 0; i < devices.GetN(); ++i) {
        const auto id = state->ids[i];
        state->logger->SetNodeDisplay(id, m_names.count(id) ? m_names.at(id) : "Node-" + std::to_string(id),
            m_models.count(id) ? m_models.at(id) : "auv");
        const auto device = DynamicCast<AquaSimNetDevice>(devices.Get(i));
        const auto phy = device->GetPhy();
        if (!phy) throw std::runtime_error("Missing Aqua-Sim PHY");
        const bool localReceiver = m_scope != VisualLogScope::NODE || !m_local || *m_local == id;
        const bool events = state->logger->AttachPhy(id, phy, MakeBoundCallback(&VisualLoggerAirtime, phy), phy->GetSignalCache(), localReceiver);
        if (localReceiver && !events) std::clog << "[visual-logger] node " << id << ": Tx/Rx only; collision/drop events unavailable\n";
    }
    if (!std::filesystem::create_directories(state->directory)) throw std::runtime_error("Cannot create log run directory");
    Simulator::ScheduleDestroy([state] { state->Flush(); });
    m_state = state;
}
void VisualLogHelper::Flush() { if (m_state) m_state->Flush(); }
std::string VisualLogHelper::GetRunDirectory() const { return m_state ? m_state->directory.string() : ""; }
} // namespace ns3
