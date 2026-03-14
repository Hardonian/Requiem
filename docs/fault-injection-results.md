# Fault Injection Results

This document summarizes artifacts produced by real-process crash injection on disk-backed write paths.

## Commands

```bash
requiem test:durability
requiem test:fault-injection
requiem doctor
requiem evidence
```

## Artifacts

- `bench/crash-matrix-report.json`
- `bench/recovery-report.json`

## Recovery classes

Startup/restart recovery classifies each case as:

- `committed`
- `rolled_back`
- `repaired`
- `quarantined`
- `unrecoverable`

## Invariants checked after restart

- no committed reference points to missing CAS object
- no durable proofpack references missing artifacts
- replay of completed execution preserves final hash
- interrupted execution safely resumed or safely rolled back
- WAL truncation detected and handled
- duplicate execution prevented or explicitly classified

## CI vs manual truth runs

- CI/default: deterministic failpoint + SIGKILL cases.
- Manual/local extended truth: container stop/restart, backend restart during in-flight operations, VM abrupt stop/restart.

## Residual risk disclosure

Claims are limited to executed backend matrix and interruption modes in generated reports; unexecuted modes are explicit bounded residual risk.
