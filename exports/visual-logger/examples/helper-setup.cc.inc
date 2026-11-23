// visual-logger integration fragment, not a standalone simulation.
// Add at the top of your scratch .cc:
#include "ns3/visual-log-helper.h"

// In main(), register this option on your existing CommandLine before Parse().
std::string runId;
cmd.AddValue("runId", "Replay run ID (random when omitted)", runId);

// Insert inside main AFTER creating devices, addresses and mobility,
// and BEFORE the existing Simulator::Run(). simStop is in seconds.
ns3::VisualLogHelper log;
log.SetEnabled(true);
log.SetLogScope(ns3::VisualLogScope::NODE);
log.SetOutputDir("replay-logs");
if (!runId.empty()) log.SetRunId(runId);
// Use actual Aqua-Sim device addresses; omit these lines if not applicable.
// log.SetNodeModelType(1, "auv");
// log.SetNodeModelType(2, "buoy");
// log.SetLocalNodeId(2); // Optional: output only node 2's own observations.
log.InstallAll(ns3::Seconds(simStop));

// Keep your existing Stop / Run / Destroy calls unchanged.
// Simulator::Destroy() automatically saves the files.
