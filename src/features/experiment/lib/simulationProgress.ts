/** Shared execution bound, independent of protocol names or parameter semantics. */
export const SIMULATION_PROGRESS_CC = String.raw`
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
`
