# Launch Asset Plan

Only real captures are allowed. No mocked UI/CLI output.

| Asset | Exact screen/state/command | Purpose | Caption | Used in | Status |
|---|---|---|---|---|---|
| README hero screenshot | Dashboard landing after successful local startup (`pnpm dev`) | First-contact credibility | "ReadyLayer dashboard with live deterministic execution context" | README, launch post | Not captured in this pass |
| Dashboard screenshot | Executions overview with at least one real run | Show operator surface | "Execution overview with replay/proof workflow entry points" | Product Hunt, docs | Not captured in this pass |
| Execution trace screenshot | Trace/inspection page for a real run | Show inspectability | "Execution trace with policy and artifact context" | diligence, comparison | Not captured in this pass |
| Proofpack/evidence screenshot | Evidence/proof artifact view after `pnpm evidence` | Show verification surface | "Evidence bundle generated from reproducible command path" | README/docs | Not captured in this pass |
| Replay viewer screenshot | Replay/diff output surface after `pnpm verify:replay` | Show determinism boundary | "Replay validation result from live run" | demo docs | Not captured in this pass |
| CLI demo GIF | Terminal recording of doctor → demo → replay flow | Fast demo asset | "5-step deterministic demo flow" | README, social | Not captured in this pass |
| Architecture diagram | Diagram sourced from docs architecture model (no fabricated claims) | System understanding | "Execution, policy, CAS, replay, proof relationships" | README, diligence | Existing docs diagrams; capture/export pending |
| Benchmark/evidence chart | Chart generated from real benchmark/evidence output | Quant evidence | "Measured output from benchmark command" | diligence, launch notes | Not captured in this pass |

## Capture rules

- Capture only from real commands and live UI states.
- Preserve command transcript used for each image/GIF.
- If a capture is blocked by environment, mark it explicitly as pending.
