# Product Hunt Launch Assets

## Tagline

Deterministic AI execution with replayable proofs.

## Short Description

Requiem is a deterministic runtime for agent workflows with policy gating, content-addressed artifacts, replay, and proof-oriented verification.

## Long Description

Requiem is built for teams that need reproducible AI execution under technical scrutiny.

Instead of treating agent runs as opaque logs, Requiem focuses on deterministic execution and verifiable evidence:

- canonicalized execution inputs
- policy evaluation gating
- content-addressed storage for artifacts
- replay and diff workflows for reproducibility checks
- proof-oriented receipts/proofpacks for integrity review

This launch is aimed at engineering teams that care about incident review, auditability, and operator trust—not prompt demos.

## Key Features

- Deterministic execution pathways
- Replay + replay diff workflows
- CAS-backed artifact integrity model
- Policy-as-code enforcement surfaces
- Proofpack/receipt verification surface
- CLI + web console operator workflows

## Demo Explanation

The launch demo shows a complete technical loop:

1. run environment + workflow checks,
2. execute and inspect artifacts,
3. view proof-oriented output,
4. replay and compare behavior,
5. verify integrity checks.

Core command shown:

```bash
pnpm verify:demo
```

## Launch Comment

Thanks for checking out Requiem.

If you are evaluating this as an engineer, start by running the demo and checking the generated artifacts yourself. We have intentionally documented limitations and guarantee boundaries so claims stay aligned with what can be verified in code and CLI workflows.
