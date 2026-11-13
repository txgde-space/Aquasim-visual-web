# Observed PHY reception events

New runs can record admitted reception attempts, native collision status changes, cache drops and successful reception/delivery. The frontend uses those records to animate propagation and the first actual collision time. It does not create receptions from node distance or infer drop causes from missing successes.

## Shared interface

The trace adapter discovers optional sources by their registered callback contracts, without protocol-name branches:

| Source | Callback contract | Observation |
| --- | --- | --- |
| RxBegin | ns3::AquaVisualRxBeginCallback | Packet and actual receiver airtime at cache admission |
| RxCollision | ns3::AquaVisualRxCollisionCallback | Packet, observed interferer if available, and native collision reason |
| RxDrop | ns3::AquaVisualRxDropCallback | Packet and the observed discard reason |
| RxEnd | ns3::AquaVisualRxEndCallback | Native cache/medium reception processing returned |

The PHY is queried first; its signal cache is the fallback source. Existing RxComplete/Rx traces still supply successful physical completion and MAC delivery. Per-transmission PacketTags associate attempts, collisions and results with the exact forwarding/retransmission event, rather than logical packet UID alone.

`AquaVisualSignalCacheRange` and `AquaVisualSignalCacheSINR` are observation-only subclasses of the installed native cache algorithms. They delegate each status update and packet submission exactly once. The normal assembly's existing fallback cache is now the observable Range subclass; an explicitly configured cache is never replaced. Both wrappers remain real registered ObjectFactory types and can be configured through the existing SignalCache attribute. PHYs with custom receive loops, such as the built-in ideal radio PHY, expose the same event contracts directly.

For cache collision records, the observer reads the native COLLISION flag and PHY SEND/RECV status, and detects the native cache's status transitions during a new packet's arrival. It records an interferer only when that arrival changed another packet to COLLISION. It does not implement a second collision algorithm or change propagation, SINR, BER, energy, packet duration, queues or MAC scheduling.

## Log additions and compatibility

The existing v2 schema remains unchanged; `meta.trace_scope=phy-events` indicates availability of receive-event observation. Sources without these optional interfaces retain the `phy-success` fallback. Explicit custom caches which do not expose events retain successful-reception-only coverage; mixed configurations only report events actually provided.

Receiver records keep their existing fields and may add:

- `collision_start_us`: first observed collision status change, not final drop time.
- `rx_drop_us`: actual cache/medium discard callback time.
- `with`: correlated interfering transmission IDs when actually observed.
- Existing `rx_processing_duration_us` / `rx_delivery_us`: successful reception processing and actual MAC delivery, kept separate from on-air reception.

Native cache collision drops use collision_rx_rx or collision_rx_tx when the source can identify that state, with generic collision/phy_rejected fallbacks. A cache completion without a success/outcome trace is labelled outcome_unreported; an unfinished reception at simulation stop is labelled reception_incomplete. These labels do not claim a collision or invent a BER/SINR cause.

Legacy parsing and with-based collision timing stay unchanged. Only phy-events logs use the valid explicit collision timestamp, so a later interferer cannot move the original collision onset forward. Old logs containing empty receiver arrays cannot recover the missing events; rerun the experiment to produce the new log.

## Verification

The current five-node experiment at 200 bps, 5 s TDMA slots and 1500 m range produces 38 transmissions and 38 observed Sink receptions. They carry native collision_rx_rx status and first-collision timestamps; completed drops also carry rx_drop_us. Sender times, durations and final routing delivery remain identical to the previous run (zero successful Sink deliveries). A faster-rate control still receives successfully, while incomplete simulations, half-duplex conflicts, native Cmn/SINR and radio tracing use the same shared interface.
