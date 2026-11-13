# AquaSim Phy Simple

`ns3::AquaSimPhySimple` is a teaching PHY derived from the selected simulator installation's `AquaSimPhyCmn`. Its source package is `src/features/experiment/lib/simpleUnderwaterPhy.ts`, compiled with the same catalog probe and scratch as other built-in models. It requires no changes to the external Aqua-Sim installation's source tree.

## Parameters and timing

- `DataRate`: on-air bit rate, registered default `10kbps`. Accepts ns-3 DataRate strings, for example `1kbps`, `9600bps`, `1Mbps`; zero is rejected.
- `RxProcessingDelay`: per-packet processing latency after successful reception and inherited collision/error checks, before passing the packet to MAC. Registered default `0s`; accepts time strings such as `10ms` or `0.1s`. Negative values are rejected by the registered checker.
- All inherited Cmn/PHY attributes remain available, including Frequency, transRange, RXThresh, transmit/receive/idle power and SignalCache.

Airtime is `8 × on-air bytes / DataRate` (minimum one ns). Transport, routing and MAC headers count; simulation-only AquaSimTrailer, PacketStamp and PacketTags do not. The original OFDM block/preamble overhead is intentionally replaced by this linear formula. Receiver airtime follows the sender's actual packet duration, even when nodes have different DataRate overrides. Every forwarding hop computes fresh airtime using its transmitter's own rate.

Processing delay is fixed latency per successful packet. Processing is pipelined, does not extend acoustic occupancy/collision windows, and does not add a separate CPU queue or CPU energy model. The inherited on-air transmit/receive/idle energy behavior remains in use. The selected propagation/channel continue to determine sound-speed delay, range/attenuation and noise. This PHY does not silently select or modify another layer, alter MAC slots or install applications.

## Trace interface

`AquaVisualPhyTimingTag` is a shared optional packet timing contract, separate from transmitted bytes. It records actual airtime and receiver processing metadata. The common trace adapter connects to an optional `RxComplete` trace when a PHY provides it, with the existing `Rx` trace as the fallback. `RxComplete` reports successful physical reception before processing; the ordinary `Rx` trace reports subsequent MAC delivery. Selection is based on the public trace interface, without PHY-name branches.

The original `rx_start_us` / `rx_duration_us` remain physical reception times. For PHYs providing processing metadata, the trace also records `rx_processing_duration_us` and, once delivery actually occurs, `rx_delivery_us`. A packet that finishes physical reception before simulation stop remains recorded even if its processing has not finished; it has no delivery timestamp yet. Existing models retain their previous logging fields and timing behavior. The common optional [reception event interface](../receive-events.md) additionally records admitted attempts and native cache collisions/drops, without changing this PHY's reception decisions.

## Platform use

Precompile, then select **AquaSim Phy Simple** in the PHY library. Edit shared settings in the left applied-protocol PHY section, or override an individual node in its card's PHY section. Export/import, checker validation, per-node precedence and scratch generation all use the common mechanisms. Other protocol selections remain explicit.

For example, select the existing Channel and Range Propagation, set `DataRate=1kbps`, `RxProcessingDelay=100ms`, and `transRange=1000`. An on-air frame of 125 bytes occupies 1 s; at 1500 m/s, 750 m propagation adds 0.5 s; MAC receives the successfully decoded packet another 0.1 s later. Application PacketSize is only the application payload, so actual frames also contain protocol headers.

## Validation

Run `node scripts/smoke-simple-phy.mjs [dev-url] [aqua-sim-home]` against an existing precompiled dev service (defaults to localhost:5173 and the server's default simulator). It performs real ns-3 simulations for linear rate/packet-size timing, inherited acoustic propagation, VBF multihop delivery, node rate/processing overrides, independent receive and delivery timestamps, simulation-stop boundaries, range cutoff, frequency mismatch, receive thresholds, overlapping receptions, half duplex, TDMA scheduling and invalid settings. It never starts another server or changes the browser draft.
