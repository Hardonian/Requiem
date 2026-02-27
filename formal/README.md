# Formal Verification — Requiem Platform

This directory contains formal specifications for critical Requiem invariants.

## Purpose

Mathematical verification of properties that cannot be expressed as unit tests:
- Protocol frame ordering and completeness
- CAS append-only journal invariants
- Replay equivalence across nodes/regions
- Deterministic hash rule consistency
- Cluster drift rejection

## Tool

Specifications are written in **TLA+** (Temporal Logic of Actions) and verified
with the **TLC model checker**.

For CI environments without the full TLA+ toolbox, a lightweight Python model
checker (`formal/model_checker.py`) performs bounded state exploration of the
same invariants.

## Files

| File | Specification | Key Invariants |
|------|---------------|----------------|
| `CAS.tla` | CAS append-only journal | No silent mutation, digest stability |
| `Protocol.tla` | NDJSON protocol frame ordering | Frame sequence, no partial writes |
| `Replay.tla` | Replay equivalence | Same input → same output across nodes |
| `Determinism.tla` | Deterministic hash rules | Hash function purity, no side effects |
| `model_checker.py` | Python bounded model checker | Runs in CI without TLA+ toolbox |

## Running

### With TLA+ Toolbox (full verification):
```
# Install TLA+ from https://github.com/tlaplus/tlaplus/releases
tlc formal/CAS.tla -config formal/CAS.cfg
tlc formal/Protocol.tla -config formal/Protocol.cfg
tlc formal/Replay.tla -config formal/Replay.cfg
tlc formal/Determinism.tla -config formal/Determinism.cfg
```

### Via CI (lightweight model checker):
```
./scripts/verify_formal.sh
```

## Invariants Verified

1. **CAS-INV-1**: No object is ever overwritten with different content for the same digest.
2. **CAS-INV-2**: Every written object is readable immediately after write (no partial writes accepted).
3. **PROTO-INV-1**: Every frame sequence starts with exactly one `start` frame.
4. **PROTO-INV-2**: A `result` or `error` frame terminates the sequence; no frames may follow.
5. **REPLAY-INV-1**: For identical request inputs, all nodes produce identical result_digests.
6. **REPLAY-INV-2**: Replay verification never modifies the stored CAS object.
7. **DET-INV-1**: The hash function is pure: same input bytes → same output bytes always.
8. **DET-INV-2**: No execution may read wall-clock time or randomness in deterministic mode.

## Change Protocol

When adding a new protocol surface or CAS format version:
1. Update the relevant `.tla` spec.
2. Re-run `verify:formal` and confirm it passes.
3. Note any invariants that must be relaxed and document the justification.
4. PR footer must include: `Formal-Spec: updated <file>.tla invariant <name>`
