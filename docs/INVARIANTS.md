# Requiem System Invariants

These invariants are **hard constraints**. No PR may weaken or remove them without an explicit Architecture Decision Record (ADR).

Each invariant has corresponding CI enforcement mechanisms, runtime assertions, and/or compile-time type constraints.

Machine-readable manifest: [`guarantees/system-guarantees.json`](../guarantees/system-guarantees.json)

---

## INV-1: Digest Parity (Determinism)

> For any two executions of the same canonical request (request_id excluded), `result_digest` MUST be byte-for-byte identical regardless of:
>
> - Time of execution (wall clock)
> - Order of execution (sequential or concurrent)
> - Which worker/node runs the request
> - Number of prior executions
> - Platform (within supported OS matrix)

**Contract:** `contracts/determinism.contract.json`

**CI Gates:**

- `scripts/verify_determinism.sh` — 200x sequential + 3-worker concurrent
- `scripts/verify_provenance.sh` — Clock abstraction checks

**Runtime Assertion:** `assertFingerprintMatch(computed, stored, runId)`

**Type Constraint:** `Fingerprint` branded type (`packages/cli/src/lib/branded-types.ts`)

**Violation Triggers:**

- Using `Date.now()`, `time(NULL)`, `std::chrono::system_clock::now()` in core logic
- Using `rand()` or non-seeded PRNGs
- Reading environment variables not in allowlist
- File system operations that depend on inode ordering
- Hash algorithm change without version bump

**Enforcement:**

- Clock abstraction (`packages/cli/src/lib/clock.ts`)
- Deterministic seed generation for replays
- Config snapshot capture

---

## INV-2: CAS Immutability

> Once a CAS object is stored under a digest key, its content is immutable. A digest key MUST always return the same bytes or a `cas_integrity_failed` error. Silent mutation is a critical invariant violation.

**Contract:** `contracts/determinism.contract.json` §cas

**CI Gate:** `scripts/verify_cas.sh`

**Runtime Assertion:** `assertCASBlobExists(exists, digest)`

**Type Constraint:** `CASDigest` branded type

**Violation Triggers:**

- Overwriting an existing CAS entry with different content
- Compressing/recompressing with different parameters after initial write
- Changing `CAS_FORMAT_VERSION` without a migration path

**Enforcement:**

- Hash-on-read verification in `src/cas.cpp`
- Write-once enforcement at filesystem level

---

## INV-3: Structured Error Envelope

> All errors thrown across the codebase MUST use `RequiemError` or its subclasses. Raw `Error` throws are prohibited in production code.

**CI Gate:** `scripts/verify_boundaries.sh`

**Required Fields:**

- `code`: Stable `ErrorCode` enum value
- `message`: Human-readable, safe for UI display
- `severity`: `ErrorSeverity` level
- `timestamp`: ISO 8601 timestamp

**Prohibited:**

- `throw new Error("message")` in API routes
- `throw "string"` anywhere
- Including secrets in error messages
- Raw SQL or paths in user-facing messages

**Enforcement:**

- ESLint rules in `packages/cli/eslint.config.mjs`
- TypeScript strict mode
- Code review checklist

---

## INV-4: Server-Side Tenant Resolution

> Tenant derivation is ALWAYS server-side. Client input (headers, body, query params) is NEVER trusted for tenant identification.

**CI Gate:** `scripts/verify_tenant_isolation.sh`

**Type Constraint:** `TenantId` branded type

**Required Flow:**

1. Extract auth token from Authorization header
2. Validate token (JWT/API key)
3. Extract tenant_id from validated claims
4. Verify active membership
5. Return `TenantContext`

**Prohibited:**

- Reading tenant ID from request body
- Reading tenant ID from query parameters
- Trusting client-provided tenant headers
- Caching tenant context across requests

**Enforcement:**

- `DefaultTenantResolver` in `packages/cli/src/lib/tenant.ts`
- RLS policies in database
- Integration tests with cross-tenant access attempts

---

## INV-5: State Machine Validity

> All entities with lifecycle states MUST use explicit `StateMachine` definitions. Invalid state transitions MUST fail deterministically.

**CI Gate:** `tests/invariants/run-lifecycle.test.ts`

**Runtime Assertion:** `assertNoStateRegression(currentIndex, previousIndex, stateName)`

**Type Constraint:** `RunLifecycleState` union type, `ExecutionState`, `JunctionState`

**Required:**

- State definition with `allowedTransitions`
- Terminal state marking
- Transition validation before state change
- Audit trail for all transitions

**Prohibited:**

- Direct state assignment: `entity.state = "new"`
- String-based state comparisons
- Transitions from terminal states

**Enforcement:**

- `StateMachine` class in `packages/cli/src/lib/state-machine.ts`
- `RunLifecycleTracker` in `packages/cli/src/lib/run-lifecycle.ts`
- `transitionEntity()` helper for atomic updates
- SQL CHECK constraints (generated)

---

## INV-6: Audit Log Append-Only

> Audit log entries are never deleted, overwritten, or reordered. The log is strictly append-only.

**CI Gate:** `scripts/verify_enterprise_boundaries.sh`

**Code Invariant:** `ready-layer/src/app/api/audit/logs/route.ts` exports only `GET`

**Required:**

- INSERT-only for audit entries
- Immutable storage (WORM if possible)
- Tamper-evident hashing (optional)

**Prohibited:**

- DELETE on audit tables
- UPDATE on audit entries
- Reordering or compaction without retention policy

---

## INV-7: No Hard-500 Routes

> Every API route must handle errors and return a structured JSON error body. Unhandled promise rejections that propagate as HTTP 500 with no JSON body are a P0 invariant violation.

**CI Gate:** `scripts/verify_no_hard_500.sh`

**Required:**

- Try/catch around all async operations
- `NextResponse.json({ ok: false, error: ... }, { status })`
- `export const dynamic = 'force-dynamic'` on API routes

**Error Response Format:**

```json
{
  "ok": false,
  "error": {
    "code": "REQ_ERROR_CODE",
    "message": "Human readable message",
    "retryable": false
  }
}
```

---

## INV-8: Layer Boundary Enforcement

> Import rules between layers are strictly enforced. Violations fail CI.

**CI Gate:** `scripts/verify_boundaries.sh`

**Rules:**

| From | To | Allowed |
| --- | --- | --- |
| Core | Server | ❌ No |
| Core | UI | ❌ No |
| Server | Core | ✅ Yes |
| UI | Core | ✅ Yes |
| UI | Server | ❌ No |
| CLI | ready-layer | ❌ No |

**Enforcement:**

- ESLint `no-restricted-imports` rules
- Dependency graph analysis in CI

---

## INV-9: Clock Abstraction

> Core logic MUST use the `Clock` interface, not direct `Date` or time functions. This enables deterministic replay.

**CI Gate:** `scripts/verify_provenance.sh`

**Required:**

- `ClockUtil.now()` or injected `Clock` instance
- `SeededClock` for replay scenarios
- Config snapshot with clock seed

**Prohibited:**

- `Date.now()` in core logic
- `new Date()` in algorithms
- `setTimeout/setInterval` without clock abstraction

**Enforcement:**

- `Clock` interface in `packages/cli/src/lib/clock.ts`
- Global clock setter/getter
- Lint rules for Date usage

---

## INV-10: Secret Redaction

> Secrets MUST NOT appear in error messages, logs, or API responses.

**CI Gate:** `scripts/verify_secrets.sh`

**Sensitive Keys:**

- password, token, secret, key, auth, credential, api_key

**Required:**

- Automatic redaction in `RequiemError.sanitizeMeta()`
- `[REDACTED]` placeholder in logs
- Type-safe secret handling (no string interpolation)

---

## INV-11: Dependency Allowlist

> All runtime and build-time dependencies must be on the approved allowlist.

**CI Gate:** `scripts/verify_deps.sh`

**Allowlist:** `contracts/deps.allowlist.json`

**Process:**

1. New deps require PR review
2. Security audit for additions
3. Pin to exact version

---

## INV-12: Migration Gating

> Any change to CAS format, protocol framing, or DB schema must include:
>
> 1. Version bump
> 2. Forward-compatibility test
> 3. Entry in `docs/MIGRATION.md`

**CI Gate:** `scripts/verify_migrations.sh`

---

## INV-13: OSS ≠ Enterprise Isolation

> OSS engine source must have zero compile-time or link-time dependency on enterprise code paths.

**CI Gate:** `scripts/verify_oss_boundaries.sh`

**Prohibited in OSS:**

- `#include "enterprise/..."`
- Hardcoded URLs matching `ready-layer.com`
- Cloud-specific data structures

---

## INV-14: Policy Before Execution

> No provider call can happen without a policy snapshot hash and decision fingerprint. Policy is the single choke point for all execution.

**CI Gate:** `tests/invariants/run-lifecycle.test.ts`

**Runtime Assertion:** `assertPolicyBeforeExecution(policyEnforced, runId)`

**Type Constraint:** `PolicySnapshotHash` branded type

**Enforcement:**

- `capturePolicySnapshotHash()` in `packages/cli/src/lib/policy-snapshot.ts`
- `RunLifecycleTracker` enforces POLICY_CHECKED before ARBITRATED

---

## INV-15: Arbitration Before Execution

> Arbitration decision must be stored before any provider call. The decision exists in the ledger before the side effect occurs.

**CI Gate:** `tests/invariants/run-lifecycle.test.ts`

**Runtime Assertion:** `assertArbitrationBeforeExecution(arbitrated, runId)`

**Type Constraint:** `ArbitrationDecision` discriminated union

**Enforcement:**

- `RunLifecycleTracker` enforces ARBITRATED before EXECUTED

---

## INV-16: Cost Before Commit

> Cost must be calculated and recorded before ledger commit. No free execution.

**Runtime Assertion:** `assertCostRecorded(costUnits, runId)`

**Enforcement:**

- `RunLifecycleTracker` enforces MANIFEST_BUILT → SIGNED → LEDGER_COMMITTED
- `recordExecutionCost()` in `packages/cli/src/lib/policy-snapshot.ts`

---

## INV-17: Ledger-Execution Parity

> Ledger entries correspond 1:1 with execution events. No orphan entries, no missing entries.

**Runtime Assertion:** `assertLedgerCount(actual, expected, runId)`

**Type Constraint:** `LedgerId` branded type

---

## INV-18: Run Lifecycle Monotonicity

> Run lifecycle state machine enforces sequential forward-only progression:
> INIT → POLICY_CHECKED → ARBITRATED → EXECUTED → MANIFEST_BUILT → SIGNED → LEDGER_COMMITTED → COMPLETE
>
> DIVERGENT is a terminal sink reachable from any non-terminal state.

**CI Gate:** `tests/invariants/run-lifecycle.test.ts`

**Runtime Assertion:** `RunLifecycleTracker.advance()` validates monotonicity

**Type Constraint:** `RunLifecycleState` union type

**Enforcement:**

- `RunLifecycleTracker` in `packages/cli/src/lib/run-lifecycle.ts`
- State machine prevents skip, regression, and terminal escape

---

## Invariant Change Process

### To Strengthen an Invariant

1. Create PR with justification
2. Code review
3. Merge

### To Weaken an Invariant

1. Write ADR in `docs/decisions/INV-XX-adr.md`
2. Two reviewer sign-offs
3. Update this file with rationale comment
4. Notify security team if applicable

**Invariants may never be silently removed.**

---

## Verification Matrix

| Invariant | Unit Test | Runtime Assert | CI Script | Formal | Branded Type |
| --- | --- | --- | --- | --- | --- |
| INV-1 (Determinism) | ✅ | ✅ | verify_determinism | ✅ | Fingerprint |
| INV-2 (CAS) | ✅ | ✅ | verify_cas | - | CASDigest |
| INV-3 (Errors) | ✅ | - | verify_boundaries | - | ErrorCode |
| INV-4 (Tenant) | ✅ | - | verify_tenant_isolation | - | TenantId |
| INV-5 (State) | ✅ | ✅ | invariant tests | ✅ | RunLifecycleState |
| INV-6 (Audit) | - | - | verify_enterprise | - | - |
| INV-7 (No 500) | - | - | verify_no_hard_500 | - | - |
| INV-8 (Boundaries) | - | - | verify_boundaries | - | - |
| INV-9 (Clock) | ✅ | - | verify_provenance | - | Clock |
| INV-10 (Secrets) | - | - | verify_secrets | - | - |
| INV-11 (Deps) | - | - | verify_deps | - | - |
| INV-12 (Migrations) | - | - | verify_migrations | - | - |
| INV-13 (OSS) | - | - | verify_oss_boundaries | - | - |
| INV-14 (Policy) | ✅ | ✅ | invariant tests | - | PolicySnapshotHash |
| INV-15 (Arbitration) | ✅ | ✅ | invariant tests | - | ArbitrationDecision |
| INV-16 (Cost) | ✅ | ✅ | invariant tests | - | - |
| INV-17 (Ledger) | ✅ | ✅ | invariant tests | - | LedgerId |
| INV-18 (Lifecycle) | ✅ | ✅ | invariant tests | - | RunLifecycleState |
