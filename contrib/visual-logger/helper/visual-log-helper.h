#pragma once
#include "ns3/net-device-container.h"
#include "ns3/nstime.h"
#include <cstdint>
#include <map>
#include <memory>
#include <optional>
#include <string>

namespace ns3 {
enum class VisualLogScope { NETWORK, NODE, ALL };

// Configure before Install. Events are attached once and files flush automatically
// during Simulator::Destroy(), before retained node state is released.
class VisualLogHelper {
public:
    VisualLogHelper() = default;
    void SetEnabled(bool enabled);
    void SetLogScope(VisualLogScope scope);
    void SetLocalNodeId(uint16_t address); // NODE/ALL: absent means one file per node
    void SetNodeModelType(uint16_t address, const std::string& modelType);
    void SetNodeName(uint16_t address, const std::string& name);
    void SetOutputDir(const std::string& directory);
    void SetRunId(const std::string& runId);
    void Install(const NetDeviceContainer& devices, Time stop);
    void InstallAll(Time stop);
    void Flush(); // optional, e.g. inspect the output immediately after Run()
    std::string GetRunDirectory() const;
private:
    struct State;
    std::shared_ptr<State> m_state;
    bool m_enabled = false, m_installed = false;
    VisualLogScope m_scope = VisualLogScope::NETWORK;
    std::optional<uint16_t> m_local;
    std::map<uint16_t, std::string> m_models, m_names;
    std::string m_directory = "replay-logs", m_runId;
    void RequireConfigurable() const;
};
} // namespace ns3
