#include "ns3/aqua-sim-tg-module.h"
#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include <iomanip>
#include <iostream>
#include <set>
#include <sstream>
using namespace ns3;
std::string Quote(const std::string& value) {
    std::ostringstream out; out << '"';
    for (unsigned char c : value) {
        if (c == '"' || c == '\\') out << '\\' << c;
        else if (c < 32) out << "\\u" << std::hex << std::setw(4) << std::setfill('0') << unsigned(c) << std::dec;
        else out << c;
    }
    out << '"'; return out.str();
}
int main() {
    // Force the Aqua-Sim library to be linked; enumerate metadata without constructing devices.
    AquaSimChannel::GetTypeId(); AquaSimPhy::GetTypeId(); AquaSimMac::GetTypeId();
    std::cout << "AQUASIM_CATALOG_BEGIN\n[";
    bool first = true;
    for (uint32_t i = 0; i < TypeId::GetRegisteredN(); ++i) {
        auto tid = TypeId::GetRegistered(i);
        if (!tid.HasConstructor()) continue;
        std::string layer;
        if (tid.IsChildOf(AquaSimPhy::GetTypeId())) layer = "phy";
        else if (tid.IsChildOf(AquaSimMac::GetTypeId())) layer = "mac";
        else if (tid.IsChildOf(AquaSimRouting::GetTypeId())) layer = "routing";
        else if (tid == AquaSimChannel::GetTypeId() || tid.IsChildOf(AquaSimChannel::GetTypeId())) layer = "channel";
        else if (tid.IsChildOf(AquaSimPropagation::GetTypeId())) layer = "propagation";
        else if (tid.IsChildOf(Application::GetTypeId()) &&
                 (tid.GetName().find("ns3::AquaSim") == 0 || tid.GetName() == "ns3::OnOffNDApplication")) layer = "app";
        else continue;
        if (!first) std::cout << ','; first = false;
        std::cout << "{\"layer\":" << Quote(layer) << ",\"typeId\":" << Quote(tid.GetName()) << ",\"attributes\":[";
        bool firstAttr = true; std::set<std::string> seen;
        for (auto parent = tid; parent != ObjectBase::GetTypeId(); parent = parent.GetParent()) {
            for (uint32_t j = 0; j < parent.GetAttributeN(); ++j) {
                auto attr = parent.GetAttribute(j);
                if (!(attr.flags & TypeId::ATTR_CONSTRUCT) || !seen.insert(attr.name).second) continue;
                if (!firstAttr) std::cout << ','; firstAttr = false;
                std::cout << "{\"name\":" << Quote(attr.name) << ",\"help\":" << Quote(attr.help)
                          << ",\"valueType\":" << Quote(attr.checker->GetValueTypeName())
                          << ",\"defaultValue\":" << Quote(attr.initialValue->SerializeToString(attr.checker)) << '}';
            }
            if (parent.GetParent() == parent) break;
        }
        std::cout << "]}";
    }
    std::cout << "]\nAQUASIM_CATALOG_END\n";
}
