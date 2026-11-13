/** Shared optional packet timing contract for PHY models and the trace adapter. */
export const PHY_PACKET_TIMING_CC = String.raw`
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
`
