# Requiem: Technical Differentiators

> **Last updated:** 2026-02-28  
> **Phase:** 7 — Market Maker Differentiation

---

## Executive Summary

Requiem is a deterministic AI execution platform that provides **cryptographically verified reproducibility**, **content-addressable artifact storage**, and **policy-as-code governance** — capabilities that most execution engines leave entirely to chance. Every agent run produces a signed proof bundle you can replay exactly months later, audited at every step by a formal policy gate. No other open-source AI orchestration platform combines all three in a single, formally specified system.

---

## 1. Deterministic Execution

### What it is
Requiem guarantees that running the same request twice always produces byte-identical output. This is achieved through a pipeline of:

- **BLAKE3 domain-separated hashing** — each content type hashed with a unique domain prefix preventing collision across domains
- **Canonical JSON serialization** — keys sorted, whitespace stripped, floating-point values normalized  
- **Environment sanitization** — `PATH`, timestamps, and process IDs stripped from execution context before hashing
- **200× repeat verification gate** — determinism gate runs every request 200 times in CI and fails if any digest diverges

### Why it matters
Non-deterministic AI execution is the root cause of "it worked yesterday" bugs, audit gaps, and failed compliance reviews. Requiem eliminates that entire class of failure.

### How it's verified
- CI: `scripts/verify_determinism.sh` runs the 200× gate on every push
- Unit tests: [`packages/ai/src/policy/__tests__/determinism.test.ts`](../packages/ai/src/policy/__tests__/determinism.test.ts) exercises the AI-layer hashing pipeline
- Contract: [`contracts/determinism.contract.json`](../contracts/determinism.contract.json) — machine-readable specification of all determinism invariants including `ai_layer`, `hash_chain`, and `proof_bundle` sections
- Formal spec: [`formal/Determinism.tla`](../formal/Determinism.tla) — TLA+ model checking all reachable states

### Where the code lives
- [`include/requiem/hash.hpp`](../include/requiem/hash.hpp) — BLAKE3 domain hash primitives
- [`include/requiem/provenance_bundle.hpp`](../include/requiem/provenance_bundle.hpp) — ProofBundle with Merkle roots
- [`docs/DETERMINISM.md`](DETERMINISM.md) — full invariant specification

---

## 2. Content-Addressable Storage

### What it is
Requiem's CAS v2 stores every artifact by its content hash rather than by name or path:

- **Dual-hash verification** — BLAKE3 (fast) + SHA-256 (interoperable) both stored and checked on read
- **Atomic writes** — write to temp path, verify digest, rename; partial writes are impossible to surface
- **zstd compression** — transparent compression with integrity check on decompress
- **Corruption detection** — every read re-verifies the stored digest; silent bit-rot surfaces immediately

### Why it matters
Traditional file storage silently accumulates corruption. CAS makes corruption impossible to miss and makes deduplication free — identical artifacts share a single on-disk entry regardless of how many jobs produced them.

### How it's verified
- Contract: [`contracts/determinism.contract.json`](../contracts/determinism.contract.json) `cas_v2` section
- Formal spec: [`formal/CAS.tla`](../formal/CAS.tla) — TLA+ spec covering concurrent writes, eviction, and corruption invariants
- CI: `scripts/verify_cas.sh`

### Where the code lives
- [`include/requiem/cas.hpp`](../include/requiem/cas.hpp) — full CAS API with dual-hash and atomic-write semantics
- [`docs/CAS.md`](CAS.md) — operational specification

---

## 3. Policy-as-Code Control Plane

### What it is
Every AI execution flows through a structured policy pipeline before any tool is invoked:

```
Request → Gate → Capabilities → Guardrails → Budget → Execution
```

- **Gate** ([`packages/ai/src/policy/gate.ts`](../packages/ai/src/policy/gate.ts)) — first evaluation point; checks policy rules and returns structured `PolicyDecision`
- **Capabilities** ([`packages/ai/src/policy/capabilities.ts`](../packages/ai/src/policy/capabilities.ts)) — RBAC-based feature access control
- **Guardrails** ([`packages/ai/src/policy/guardrails.ts`](../packages/ai/src/policy/guardrails.ts)) — hardened content and behavior filters; wired directly into the gate
- **Budget checker** ([`packages/ai/src/policy/budgets.ts`](../packages/ai/src/policy/budgets.ts)) — token/cost limits with clock abstraction for testability
- **Rate limiter** — implemented (not a stub) in the budget module; per-tenant sliding window
- **MCP caps** — server-level tool invocation limits enforced via the budget system

### Why it matters
Most AI systems bolt on safety filters as an afterthought. Requiem's policy pipeline is the primary execution path — you cannot reach a tool without passing the gate.

### How it's verified
- Adversarial test suite: [`packages/ai/src/policy/__tests__/adversarial_policy.test.ts`](../packages/ai/src/policy/__tests__/adversarial_policy.test.ts) — 20+ adversarial cases including jailbreak attempts, budget exhaustion, and capability escalation
- Eval case runner: [`eval/policy_adversarial_cases.json`](../eval/policy_adversarial_cases.json)
- CI: `scripts/verify_policy.sh` and `scripts/verify_policy_contract.sh`
- Feature flags: [`packages/ai/src/flags/index.ts`](../packages/ai/src/flags/index.ts) — runtime feature gating with schema validation

### Where the code lives
- [`packages/ai/src/policy/`](../packages/ai/src/policy/) — all policy modules
- [`docs/POLICY.md`](POLICY.md) — full policy specification
- [`docs/INVARIANTS.md`](INVARIANTS.md) — policy invariants that CI enforces

---

## 4. Formal Verification

### What it is
Four TLA+ specifications provide machine-checkable proofs of Requiem's core protocol invariants:

| Spec | What it checks |
|------|---------------|
| [`formal/Determinism.tla`](../formal/Determinism.tla) | Hash-chain consistency, replay equivalence |
| [`formal/CAS.tla`](../formal/CAS.tla) | Concurrent write safety, eviction correctness, corruption detection |
| [`formal/Protocol.tla`](../formal/Protocol.tla) | Agent execution protocol, fence/barrier semantics |
| [`formal/Replay.tla`](../formal/Replay.tla) | Replay determinism, temporal ordering invariants |

Additionally:
- **Python model checker** ([`formal/model_checker.py`](../formal/model_checker.py)) — independent state-space exploration of policy and hash-chain properties
- **Chaos harness** ([`formal/chaos_harness.cpp`](../formal/chaos_harness.cpp)) — fault injection for network drops, disk corruption, and timing attacks
- **Policy linter** ([`formal/policy_linter.cpp`](../formal/policy_linter.cpp)) — static analysis of policy rules for completeness and consistency

### Why it matters
TDD finds bugs in code paths you thought to test. TLA+ finds bugs in design assumptions you didn't know to question — including concurrency races, liveness violations, and state-space explosions that unit tests can't reach.

### How it's verified
- Specs are checked in CI via `formal/verify_chaos.yml`
- [`formal/README.md`](../formal/README.md) — instructions for running TLC model checker locally

### Where the code lives
- [`formal/`](../formal/) — all TLA+ specs, model checker, and chaos harness

---

## 5. Multi-Scheduler Architecture

### What it is
Requiem ships two scheduler modes, selectable per execution:

**Repro mode** (`scheduler: repro`)
- FIFO queue — jobs execute in submission order
- Maximum worker isolation — one job per worker, no resource sharing
- Determinism-first: designed to guarantee byte-identical outputs across machines

**Turbo mode** (`scheduler: turbo`)
- Worker pool — jobs distributed across available threads
- Maximum throughput: designed for CI pipelines and batch evaluation
- Determinism not required; benchmarks run here

### Why it matters
A single scheduler forces a tradeoff between reproducibility and throughput. Requiem externalizes that tradeoff as an explicit configuration decision rather than burying it in implementation details.

### How it's verified
- [`include/requiem/worker.hpp`](../include/requiem/worker.hpp) — `WorkerMode` enum and scheduler interface
- Determinism tests explicitly run in repro mode to validate isolation guarantees

### Where the code lives
- [`include/requiem/worker.hpp`](../include/requiem/worker.hpp) — scheduler modes and worker pool API

---

## 6. Benchmark Harness & Drift Detection

### What it is
Requiem ships a built-in `bench` CLI subcommand with:

- **200× determinism gate** — every benchmark run includes 200 determinism iterations; failure is a blocking CI error
- **Latency histograms** — p50/p95/p99 per operation type
- **Regression comparison** — baseline snapshots stored in `artifacts/`; drift above threshold fails CI
- **Structured output** — results emitted as JSON for downstream analysis

### Why it matters
Performance regression and determinism regression are usually discovered by users in production. Requiem's built-in harness catches both in CI before merge.

### How it's verified
- CI: `scripts/verify_drift.sh` and `scripts/verify_bench.sh`
- Spec: [`docs/BENCH.md`](BENCH.md)

### Where the code lives
- [`docs/BENCH.md`](BENCH.md) — full benchmark specification and CLI reference
- [`docs/examples/bench_spec.json`](examples/bench_spec.json) — example benchmark spec

---

## 7. Honest Security Posture

### What it is
Rather than listing aspirational security claims, Requiem ships a **theatre audit** that explicitly distinguishes between:
- **Implemented** — code exists, tests pass, CI enforces it
- **Partial/stub** — scaffolding present but not production-ready
- **Not implemented** — honest acknowledgment of gaps

This is codified in [`docs/THEATRE_AUDIT.md`](THEATRE_AUDIT.md) with a section-by-section status table.

Additionally, [`docs/SECURITY.md`](SECURITY.md) provides:
- Threat model summary (linking to full [`docs/THREAT_MODEL.md`](THREAT_MODEL.md))
- Vulnerability reporting process
- Implementation status cross-reference

### Why it matters
Security theatre — claiming features that aren't real — is worse than honest gaps because it gives users false confidence. Requiem's audit creates accountability and a clear roadmap.

### How it's verified
- The theatre audit itself is reviewed as part of the release readiness process (see [`docs/LAUNCH_GATE_CHECKLIST.md`](LAUNCH_GATE_CHECKLIST.md))
- [`docs/RELEASE_READINESS_REPORT.md`](RELEASE_READINESS_REPORT.md) tracks gap closure over time

### Where the code lives
- [`docs/THEATRE_AUDIT.md`](THEATRE_AUDIT.md) — full audit with implementation status table
- [`docs/SECURITY.md`](SECURITY.md) — security posture summary
- [`SECURITY.md`](../SECURITY.md) — root-level security policy and disclosure process

---

## Summary Table

| Differentiator | Status | Key Evidence |
|----------------|--------|-------------|
| Deterministic execution | ✅ Implemented | `contracts/determinism.contract.json`, `formal/Determinism.tla`, 200× CI gate |
| Content-addressable storage | ✅ Implemented | `include/requiem/cas.hpp`, `formal/CAS.tla`, `scripts/verify_cas.sh` |
| Policy-as-code control plane | ✅ Implemented | `packages/ai/src/policy/`, adversarial test suite |
| Formal TLA+ specifications | ✅ Implemented | 4 specs in `formal/`, Python model checker |
| Multi-scheduler modes | ✅ Implemented | `include/requiem/worker.hpp`, repro/turbo modes |
| Benchmark & drift detection | ✅ Implemented | `docs/BENCH.md`, `scripts/verify_drift.sh` |
| Honest security posture | ✅ Implemented | `docs/THEATRE_AUDIT.md`, implementation status table |

See [`contracts/competitive.matrix.json`](../contracts/competitive.matrix.json) for a machine-readable comparison against typical alternatives.
