# Requiem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](#verification)
[![Node](https://img.shields.io/badge/node-20.x-green)](#quickstart)
[![Determinism](https://img.shields.io/badge/determinism-verified-blueviolet)](docs/DETERMINISM.md)

## Every AI decision. Provable. Replayable. Enforced.

Requiem is the **Provable AI Runtime** — the only execution layer where every AI decision produces a cryptographic proof, every outcome is replayable to the byte, and every policy violation is caught before it ships.

Not a prompt router. Not a workflow engine. Not a Git wrapper.

A runtime that proves what your AI actually did.

---

### Three Guarantees

| Guarantee | What it means | How it works |
|-----------|---------------|--------------|
| **Provable Execution** | Identical inputs produce identical `result_digest` values across runs, workers, and time. | BLAKE3 domain-separated hashing, canonical JSON serialization, environment sanitization. 200x repeat verification in CI. |
| **Enforced Governance** | Every tool invocation passes through a policy gate. No exceptions. No bypass. Deny-by-default. | Four-layer defense: RBAC capabilities, budget enforcement, content guardrails, audit logging. All enforced before execution. |
| **Replayable Outcomes** | Any execution can be replayed and verified against its original proof. Divergence is detected, not hidden. | Content-addressable storage with dual-hash verification (BLAKE3 + SHA-256), immutable replay logs, Merkle chain tamper evidence. |

---

## Quickstart (3 commands)

```bash
# 1. Clone and install
git clone https://github.com/Hardonian/Requiem.git && cd Requiem && pnpm install

# 2. Build the native engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j

# 3. Prove determinism — runs the same workload 3x and verifies all result_digests match
./build/requiem demo
```

Expected output:
```json
{"ok":true,"deterministic":true,"runs":3,"result_digest":"<hash>","latency_ms":[...]}
```

**Determinism is confirmed when `"deterministic":true` and all three runs share the same `result_digest`.**

### First Deterministic Execution (TypeScript Control Plane)

```bash
# Run a tool through the policy gate and get a verifiable execution envelope
pnpm exec reach run system.echo "Hello, Determinism!"
```

Output:
```
┌─────────────────────────────────────────────────────────────┐
│ EXECUTION COMPLETE                                          │
├─────────────────────────────────────────────────────────────┤
│ Tool:          system.echo@1.0.0                            │
│ Tenant:        cli-tenant                                   │
│ Duration:      12ms                                         │
│ Deterministic: YES                                          │
│ Policy:        ENFORCED                                     │
│ Fingerprint:   a1b2c3d4e5f6...                              │
│ Replay:        VERIFIED                                     │
└─────────────────────────────────────────────────────────────┘
```

### Verify an Execution

```bash
pnpm exec reach verify <execution-hash>
```

### Replay with Proof

```bash
./build/requiem exec replay \
  --request docs/examples/exec_request_smoke.json \
  --result build/result.json \
  --cas .requiem/cas/v2
```

### Inspect Policy Enforcement

```bash
# View every active constraint — nothing is implicit
./build/requiem policy explain

# View every version constant CI verifies
./build/requiem version
```

### Launch Dashboard

```bash
pnpm exec reach ui
```

> **Two CLIs:** `./build/requiem` (C++ native engine — determinism, CAS, replay, policy) and `pnpm exec reach` (TypeScript control plane — AI decisions, junctions, MCP). See **[CLI Reference](docs/cli.md)**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)                    │
│         Executions · Replay · Audit · Metrics            │
├─────────────────────────────────────────────────────────┤
│                  Control Plane (TypeScript)               │
│     Policy Gate · Tool Registry · MCP · Skills           │
├─────────────────────────────────────────────────────────┤
│                  Native Engine (C++)                      │
│   BLAKE3 Hashing · CAS v2 · Sandbox · Replay Verify     │
├─────────────────────────────────────────────────────────┤
│                  Formal Verification                     │
│        TLA+ Specs · Model Checker · Chaos Harness        │
└─────────────────────────────────────────────────────────┘
```

Every layer enforces the same invariants. Claims are verified in code, not implied in copy.

---

## Why Enterprises Switch

| Problem | Without Requiem | With Requiem |
|---------|-----------------|--------------|
| "Did the AI do the same thing twice?" | Hope so | Prove it — `result_digest` match |
| "Can we audit what happened?" | Grep through logs | Immutable Merkle chain with replay proof |
| "Is policy being enforced?" | Trust the wrapper | Deny-by-default gate — every invocation, no bypass |
| "Can we reproduce this in court?" | No | Replayable to the byte, with cryptographic evidence |

---

## Why Builders Prefer It

- **10-second proof**: Run a tool, get a hash, verify it. Determinism is visible, not promised.
- **No hidden steps**: `policy explain` shows every active constraint. Nothing is implicit.
- **Replay is not logging**: Replay re-executes and verifies. Divergence is detected, not ignored.
- **Policy is not middleware**: It's a gate. Deny-by-default. No tool executes without passing.

---

## Tiers

| | OSS | Pro | Enterprise |
|---|---|---|---|
| Deterministic execution | Yes | Yes | Yes |
| CAS with dual-hash verification | Yes | Yes | Yes |
| Policy gate (deny-by-default) | Yes | Yes | Yes |
| Replay verification | Yes | Yes | Yes |
| CLI + Dashboard | Yes | Yes | Yes |
| Execution credits / month | 1,000 | 50,000 | Unlimited |
| Replay storage | 1 GB | 50 GB | Unlimited |
| Policy events tracked | 10,000 | 500,000 | Unlimited |
| Multi-tenant isolation | — | Yes | Yes |
| SOC 2 compliance controls | — | — | Yes |
| Signed artifact chain | — | — | Yes |
| Cluster coordination | — | — | Yes |
| SLA-backed support | — | — | Yes |

---

## Verification

```bash
# Fast checks (lint, typecheck, boundaries) — run before every commit
pnpm run verify

# Full CI suite including determinism and integration tests
pnpm run verify:ci
```

> For architecture details, see [Architecture Overview](docs/ARCHITECTURE.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
