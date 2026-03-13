# Proof Engine

The Proof Engine is Requiem's trust layer. It converts system-level claims
into machine-verifiable invariants backed by automated tests.

## Architecture

```
requiem prove
  ├── hash-parity        Cross-language BLAKE3 parity (TS ↔ C++)
  ├── determinism         Replay harness: N executions → identical state hash
  ├── cas-integrity       CAS immutability, corruption detection, GC safety
  ├── policy              Policy evaluation determinism, deny-by-default
  ├── crash-recovery      Crash injection: CAS, WAL, proof gen, workflow steps
  └── stress              10k sequential, 1k concurrent, memory growth
```

## Commands

### `requiem prove`

Runs all proof verification suites and outputs results to `/proofpacks/latest/`.

```bash
rl prove                    # Run all suites
rl prove determinism        # Run specific suite
rl prove --json             # JSON output
```

### `requiem replay <execution_id>`

Deterministically reconstructs a prior execution from its proofpack.

```bash
rl replay run_abc123              # Basic replay
rl replay run_abc123 --step       # Step-by-step
rl replay run_abc123 --trace      # Full trace
rl replay run_abc123 --explain    # Annotated decisions
```

### `requiem verify <proofpack.json>`

Verifies a proofpack's cryptographic integrity.

```bash
rl verify proofpacks/latest/proofpack.json
rl verify proofpacks/latest/proofpack.json --verbose
```

## Verification Suites

| Suite | Claim | Invariant |
|-------|-------|-----------|
| hash-parity | CLAIM_HASH_CANONICAL | `blake3_hex_ts(x) == blake3_hex_cpp(x)` |
| determinism | CLAIM_DETERMINISM | `hash(output_state) == hash(replay_state)` |
| cas-integrity | CLAIM_CAS_IMMUTABILITY | `H("cas:", get(d)) == d` on every read |
| policy | CLAIM_POLICY_DETERMINISM | `hash(decision_1) == hash(decision_2)` |
| crash-recovery | CLAIM_CRASH_SURVIVABILITY | State intact after crash + restart |
| stress | Performance baselines | p50/p95/p99 latency, memory growth |

## Proof Artifacts

All proof artifacts are stored in `/proofpacks/`:

```
proofpacks/
├── latest/
│   └── prove-summary.json      # Latest proof run results
├── determinism/
│   ├── replay-test-proofpack.json
│   └── replay-test-metrics.json
└── <execution_id>/
    └── proofpack.json          # Per-execution proofpack
```

## Claim Enforcement

Every claim in `/docs/system-claims.md` must be backed by passing tests.
If a test fails, the claim must either be:

1. **Enforced** — Fix the code to satisfy the invariant
2. **Removed** — Delete the claim from documentation

No unverifiable system claims are allowed.
