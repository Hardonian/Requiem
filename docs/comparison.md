# Comparison

This comparison is intentionally narrow and claim-bounded.

| Category | Typical focus | Requiem focus |
|---|---|---|
| Orchestration tools | scheduling, fan-out/fan-in, retries | deterministic execution + replay verification |
| Workflow engines | workflow state transitions | replay/proof surfaces tied to CLI verification |
| Agent frameworks | model/tool composition ergonomics | policy-gated execution with artifact/evidence outputs |
| Job systems | queueing + worker throughput | deterministic/reproducibility checks and run evidence |
| Debugging/repro tools | logs and traces | logs + replay + proof/evidence command path |

## Notes

- Requiem is not presented as a replacement for every scheduler/orchestrator.
- The differentiator is verification/replay/proof posture, not broad feature count.
- Validate fit with `docs/demo-walkthrough.md` and diligence commands.
