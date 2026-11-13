import { MAX_LOG_PACKETS } from '../../../shared/logSafety'

/** Public MobilityModel observations; sampling never changes the simulation trajectory. */
export const MOBILITY_TRACE_CC = String.raw`
#include <algorithm>
#include <limits>
#include <map>

struct VisualMovement {
    uint32_t nodeId;
    int64_t startNs, endNs;
    Vector from, to;
};
struct VisualMobilityTrack {
    Ptr<MobilityModel> model;
    int64_t timeNs;
    Vector position;
    size_t mergeIndex = std::numeric_limits<size_t>::max();
};
static std::vector<VisualMovement> visualMovements;
static std::map<uint32_t, VisualMobilityTrack> visualMobilityTracks;
static bool visualMobilityRecording = false;
static Time visualMobilitySampleInterval;
static Time visualMobilityStop;
static EventId visualMobilitySampleEvent;

static bool VisualFinitePosition(const Vector& point) {
    return std::isfinite(point.x) && std::isfinite(point.y) && std::isfinite(point.z);
}
static bool VisualSamePosition(const Vector& a, const Vector& b) {
    return a.x == b.x && a.y == b.y && a.z == b.z;
}
static bool VisualSameVelocity(const Vector& a, const Vector& b) {
    const auto equal = [](double x, double y) {
        return std::abs(x - y) <= 1e-9 * std::max({1.0, std::abs(x), std::abs(y)});
    };
    return equal(a.x, b.x) && equal(a.y, b.y) && equal(a.z, b.z);
}
static void VisualCaptureMobility(uint32_t id, bool courseChange) {
    if (!visualMobilityRecording) return;
    auto& track = visualMobilityTracks.at(id);
    const auto now = Simulator::Now().GetNanoSeconds();
    const Vector position = track.model->GetPosition();
    if (!VisualFinitePosition(position)) {
        throw std::runtime_error("Node " + std::to_string(id) + ": mobility produced non-finite coordinates");
    }
    if (!VisualSamePosition(track.position, position)) {
        bool merged = false;
        if (now > track.timeNs && track.mergeIndex < visualMovements.size()) {
            auto& previous = visualMovements[track.mergeIndex];
            if (previous.endNs == track.timeNs && previous.endNs > previous.startNs) {
                const Vector before = (previous.to - previous.from) * (1e9 / (previous.endNs - previous.startNs));
                const Vector after = (position - track.position) * (1e9 / (now - track.timeNs));
                if (VisualSameVelocity(before, after)) {
                    previous.endNs = now;
                    previous.to = position;
                    merged = true;
                }
            }
        }
        if (!merged) {
            if (visualMovements.size() >= ${MAX_LOG_PACKETS}) {
                throw std::runtime_error("Mobility trace exceeds ${MAX_LOG_PACKETS} movement segments; shorten the experiment or reduce course changes");
            }
            track.mergeIndex = visualMovements.size();
            visualMovements.push_back({id, track.timeNs, now, track.position, position});
        }
    } else if (now > track.timeNs) {
        // Do not interpolate through a stationary interval as though it moved.
        track.mergeIndex = std::numeric_limits<size_t>::max();
    }
    track.timeNs = now;
    track.position = position;
    // Preserve the exact public course-change boundary after this observation.
    if (courseChange) track.mergeIndex = std::numeric_limits<size_t>::max();
}
static void VisualMobilityCourseChanged(uint32_t id, Ptr<const MobilityModel>) {
    VisualCaptureMobility(id, true);
}
static void VisualSampleMobility() {
    if (!visualMobilityRecording) return;
    for (const auto& entry : visualMobilityTracks) VisualCaptureMobility(entry.first, false);
    if (visualMobilityStop - Simulator::Now() > visualMobilitySampleInterval) {
        visualMobilitySampleEvent = Simulator::Schedule(visualMobilitySampleInterval, &VisualSampleMobility);
    }
}
static void VisualStartMobilityTrace(const NodeContainer& nodes, const std::vector<uint16_t>& addresses,
                                     Time sampleInterval, Time stop) {
    visualMobilitySampleInterval = sampleInterval;
    visualMobilityStop = stop;
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        auto model = nodes.Get(i)->GetObject<MobilityModel>();
        const Vector position = model->GetPosition();
        if (!VisualFinitePosition(position)) throw std::runtime_error("Invalid initial mobility position");
        visualMobilityTracks.emplace(addresses[i], VisualMobilityTrack{model, Simulator::Now().GetNanoSeconds(), position});
        if (!VisualConnectTrace(model, "CourseChange", "ns3::MobilityModel::TracedCallback",
                MakeBoundCallback(&VisualMobilityCourseChanged, uint32_t(addresses[i])))) {
            throw std::runtime_error("MobilityModel CourseChange trace interface is unavailable");
        }
    }
    visualMobilityRecording = true;
    if (stop - Simulator::Now() > sampleInterval) {
        visualMobilitySampleEvent = Simulator::Schedule(sampleInterval, &VisualSampleMobility);
    }
}
static void VisualFinishMobilityTrace() {
    for (const auto& entry : visualMobilityTracks) VisualCaptureMobility(entry.first, false);
    visualMobilityRecording = false;
    visualMobilitySampleEvent.Cancel();
}
static void WriteVisualMovements(std::ostream& output) {
    const auto previousPrecision = output.precision(17);
    output << ",\"movements\":[";
    for (size_t i = 0; i < visualMovements.size(); ++i) {
        if (i) output << ',';
        const auto& movement = visualMovements[i];
        output << "{\"node_id\":" << movement.nodeId
            << ",\"start_us\":" << movement.startNs / 1000.0 << ",\"end_us\":" << movement.endNs / 1000.0
            << ",\"from_x\":" << movement.from.x << ",\"from_y\":" << movement.from.y << ",\"from_z\":" << movement.from.z
            << ",\"to_x\":" << movement.to.x << ",\"to_y\":" << movement.to.y << ",\"to_z\":" << movement.to.z << '}';
    }
    output << ']';
    output.precision(previousPrecision);
}
`
