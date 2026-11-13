/** Attribute-configurable constant velocity using the public ns-3 mobility interface. */
export const LINEAR_MOBILITY_CC = String.raw`
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
`
