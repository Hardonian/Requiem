# Incident Comms Templates: Requiem Support

## P0: Determinism / Invariant Failure

### Initial Statement (Internal Only)

> **Incident ID**: [INC-YYYYMMDD-####]
> **Priority**: P0 (Critical)
> **Summary**: A break in the determinism invariant has been detected in version [X.Y.Z].
> **Status**: Investigating. All executions under this version should be re-verified manually.
> **Assigned to**: @[Owner]

### Public Status Update (Suggested)

> we are investigating a report of a non-deterministic result digest in the Requiem runtime. Our team is currently performing a replay-audit of the affected builds. We recommend pinning to version [Previous Stable] until further notice.

## P1: Performance Regression

### Internal Update

> **Summary**: Performance has regressed by [X]% in the `Microfracture Suite` baseline.
> **Detected by**: `ci-ratchet.ts`
> **Impact**: Slower verification times but no impact on cryptographic correctness.

## Resolution Message

### Internal Only

> **Resolution**: Fixed in PR #[ID].
> **Verification**: `pnpm run verify:ci` passed with 0 drift on 200x repeat cycle.
> **Post-Mortem Required**: Yes. See [Link to PM Document].
