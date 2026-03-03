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

## Quickstart (5 commands)

```bash
# 1. Install dependencies
pnpm install

# 2. Build the runtime
pnpm run build

# 3. Execute with proof
pnpm reach run system.echo '{"message":"hello"}'

# 4. Verify determinism
pnpm reach verify <fingerprint-from-step-3>

# 5. Launch dashboard
pnpm reach ui
```

**Expected output:**
```
┌────────────────────────────────────────────────────────────┐
│ EXECUTION FINGERPRINT                                      │
├────────────────────────────────────────────────────────────┤
│  Hash:        a1b2c3d4e5f6...                              │
│  Short ID:    a1b2c3d4...                                  │
│  Verified:    2026-01-15T10:30:00.000Z                     │
│  Algorithm:   BLAKE3-v1 (domain-separated)                 │
│  CAS:         v2 (dual-hash: BLAKE3 + SHA-256)             │
│  Policy:      enforced (deny-by-default)                   │
├────────────────────────────────────────────────────────────┤
│  This fingerprint proves that the execution produced a     │
│  deterministic result that is replayable and               │
│  policy-compliant.                                         │
└────────────────────────────────────────────────────────────┘
```

**Verification:** Run `pnpm reach verify <hash>` — you should see `Verification passed`.

---

### How This Differs from GitHub Actions + OPA

Requiem is not a CI wrapper. The core primitive is the **Semantic State Machine** — a first-class computing primitive for AI execution governance:

| Capability | GHA + OPA | Requiem SSM |
|------------|-----------|-------------|
| **State Identity** | Time-based workflow run ID | Content-derived BLAKE3 fingerprint |
| **State Lineage** | Job dependencies (structural) | Semantic transitions (intent + drift taxonomy) |
| **Drift Detection** | Manual text diff | Automated taxonomy (model/prompt/policy/context/eval/runtime) |
| **Integrity Metric** | None | Computed from 6 verifiable signals (0-100) |
| **Model Migration** | Full re-test | Offline simulation + selective re-evaluation |
| **State Export** | Unstructured logs | Versioned semantic ledger bundle |

**Runnable Proof:**
```bash
# Create states with deterministic IDs
reach state genesis --descriptor descriptor.json

# Compare with drift taxonomy
reach state diff <idA> <idB>

# Simulate model migration impact
reach state simulate upgrade --from gpt-4 --to claude-3

# View in Cloud UI
open http://localhost:3000/app/semantic-ledger
```

See [docs/audits/DIFFERENTIATION_PROOF.md](docs/audits/DIFFERENTIATION_PROOF.md) for the complete runnable demo.

---

## Microfracture Suite — Proof Surfaces

The Microfracture Suite provides deterministic analysis, comparison, and verification tools for AI executions.

### 10-Minute Proof Flow

```bash
# 1. Run a tool
reach run system.echo "Hello, World!"
# → Returns run ID: run_abc123...

# 2. Run it again
reach run system.echo "Hello, World!"
# → Returns run ID: run_def456...

# 3. Diff the runs
reach diff run_abc123 run_def456 --format=table
# → Shows deterministic comparison

# 4. Create a shareable proof card
reach diff run_abc123 run_def456 --share
# → Prints share URL for /proof/diff/<token>

# 5. Verify lineage
reach lineage run_abc123 --depth=5
# → Shows parent/child relationships

# 6. Check tenant isolation
reach tenant-check --format=table
# → Verifies no cross-tenant data leakage
```

### CLI Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `reach diff <A> <B>` | Deterministic run comparison | `reach diff run1 run2 --card` |
| `reach lineage <id>` | Show run ancestry | `reach lineage run1 --depth=10` |
| `reach simulate <id>` | Test policy evaluation | `reach simulate run1 --policy=strict` |
| `reach drift --since=<id>` | Detect behavior changes | `reach drift --since=run1 --window=50` |
| `reach explain <id>` | Generate run explanation | `reach explain run1 --format=md` |
| `reach share <id>` | Create shareable proof link | `reach share run1 --ttl=48h` |
| `reach usage` | Show tenant usage summary | `reach usage --format=json` |
| `reach tenant-check` | Verify isolation boundaries | `reach tenant-check` |
| `reach chaos --quick` | Run verification checks | `reach chaos --quick` |

### Exit Codes

All commands follow standard exit codes:
- `0` — Success / Determinism verified
- `2` — User error (invalid arguments, missing run)
- `3` — Invariant failure (determinism mismatch, tenant violation)
- `4` — System error (database, network)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard (Next.js)                    │
│         Logs · Runs · Plans · Policies · FinOps          │
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
