# VBF source package

Imported from [spinachAn/aqua-sim-dev](https://github.com/spinachAn/aqua-sim-dev/tree/fa7a655f7fbf2c1c2e5a9f1329893d759f1d2f0f/src/aqua-sim-tg/model), revision `fa7a655f7fbf2c1c2e5a9f1329893d759f1d2f0f`, on 2026-10-27:

- `aqua-sim-routing-vbf.h`
- `aqua-sim-routing-vbf.cc`

Original University of Connecticut copyright, author and GPL v2 notices are retained in `src/features/experiment/lib/vectorBasedForwarding.ts`. The package compiles with the catalog probe and generated scratch, using the selected Aqua-Sim installation's public routing, PHY, packet and mobility interfaces. It does not modify that installation's source files. The protocol is registered as `ns3::AquaSimVBF`; the platform discovers it and its attributes through the same TypeId probe, factory validation and node override mechanism as every other protocol. It appears only after successful precompilation. The source viewer returns the compiled source package.

## Port changes

- Replace local includes with exported `ns3/` headers, combine the upstream declaration/implementation, and remove the unused Logger dependency.
- Supply the delay argument required by the current `AquaSimRouting::SendDown` interface.
- Restore the intended forwarding-pipe test `Projection(pkt) <= m_width`; upstream returned true unconditionally after the diagnostic condition.
- Use a private `AquaVisualVbfHeader` with initialized fields and signed millimeter coordinates. The upstream shared `VBHeader` encoded positions as unsigned values, which corrupts negative coordinates. This private header retains the byte count and does not change the legacy header used by other installed protocols. Each coordinate is limited by signed 32-bit millimeters; out-of-range values produce a configuration error. Its scalar fields use direct integer serialization.
- Keep the registered Width default of 2500 m, correct the inconsistent help text, and reject nonpositive widths in the model's own AttributeChecker. Forwarding delay calculation rejects a nonpositive/nonfinite PHY range and clamps floating point underflow below zero before taking a square root.
- Release packet-table entries on reset and evict by stored keys rather than scanning all previous packet numbers. Move packet diagnostics to ns-3 debug logging.

No frontend default, protocol whitelist, automatic layer pairing or automatic application installation was added. `TargetPos` is an explicit registered vector attribute, written as `x:y:z` in meters, for example `-500:100:0`. It is not inferred from the selected destination node; the sender's configured target position must match the intended routing vector. Select MAC, PHY, channel, propagation and applications independently.

## Validation

`node scripts/smoke-vbf.mjs` uses an existing dev service at `http://localhost:5173` (optional first argument overrides the URL) and its selected default ns-3 directory. Precompile first. It runs real simulations without changing the browser draft:

1. Three nodes at X = -1500, -1000 and -500 m, 600 m PHY range: source → relay → sink, including actual routing delivery.
2. Move the relay 200 m off the source–sink vector with Width = 100 m: PHY reception succeeds, routing does not forward.
3. Increase Width to 300 m: forwarding and sink delivery resume.
4. Width = 0 fails through the registered checker.

The usual typecheck, production build and regression checks also cover source access and the common platform flow. These cases verify the port's basic behavior; they are not a reproduction of the VBF paper's performance results.
