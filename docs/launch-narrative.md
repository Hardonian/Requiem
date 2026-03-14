# Launch Narrative: Why Requiem Exists

Requiem is a deterministic execution runtime for agent workflows.

It is designed for teams that need to answer these questions with evidence, not interpretation:

- What exactly executed?
- Why was a tool call allowed or denied?
- Can we replay the same run and get the same outcome?
- Can we prove an artifact was not mutated after execution?

## The Problem

Most agent orchestration stacks optimize for flexibility and speed of integration. They usually do **not** make deterministic replay, immutable artifacts, and cryptographic traceability first-class constraints.

That creates operational gaps:

- hard-to-reproduce failures
- policy decisions that are difficult to audit
- evidence spread across logs, DB rows, and ad-hoc telemetry
- weak guarantees that outputs map to specific inputs/policy/runtime state

## Why Deterministic Execution Matters

Deterministic execution reduces debugging and compliance ambiguity.

If the same canonical input and policy state can be replayed to the same outcome, operators can:

- isolate root cause faster
- separate model variance from infra drift
- perform stronger incident review
- validate changes against known baselines

Requiem treats deterministic execution as an architectural requirement, not a best-effort mode.

## Why Replayable Agent Workflows Matter

Replay provides a concrete mechanism to verify behavior under scrutiny.

For engineering teams, replay is useful for:

- regression triage
- pre/post change comparison
- reproducibility checks in CI
- customer support investigations

Requiem's replay surface is intended to let operators move from "we think" to "we can reproduce."

## Why Proofpacks Exist

A proofpack is an evidence bundle for an execution.

Instead of relying on plain logs, proofpacks can bind:

- canonicalized inputs
- policy/workflow digests
- ordered tool-call digests
- CAS references
- integrity material (for example Merkle-rooted and signed metadata where enabled)

The goal is not branding. The goal is to preserve verifiable execution evidence that can be independently checked.

## Why Existing AI Orchestration Is Often Insufficient

General orchestration systems are useful, but many treat these as optional:

- deterministic replay as a default operator workflow
- immutable CAS-backed artifact lineage
- policy evaluation evidence that is tied to execution receipts
- cryptographic integrity primitives surfaced to operators

Requiem's design focus is to make those capabilities operationally central.

## Practical Outcome

Within a short repo session, an engineer should be able to:

1. run the local demo
2. inspect run artifacts
3. generate/inspect proofpack material
4. replay and compare behavior

That launch experience is the baseline for technical credibility.
