# INVARIANTS.md — Requiem System Invariants

These invariants are **hard constraints**. No PR may weaken or remove them.
Each has a corresponding CI enforcement mechanism.

---

## INV-1: Digest Parity (Determinism)

> For any two executions of the same canonical request (request_id excluded),
> `result_digest` MUST be byte-for-byte identical regardless of:
> - Time of execution (wall clock)
> - Order of execution (sequential or concurrent)
> - Which worker/node runs the request
> - Number of prior executions
> - Platform (within supported OS matrix)

**Contract:** `contracts/determinism.contract.json`
**CI gate:** `scripts/verify_determinism.sh` — 200x sequential + 3-worker concurrent

**Violation triggers:**
- Using `time(NULL)`, `std::chrono::system_clock::now()`, `rand()`, or any
  non-seeded PRNG in the execution hot path
- Reading environment variables not in `env_allowlist` or `required_env`
- File system operations that depend on inode ordering
- Hash algorithm change without version bump + migration

---

## INV-2: CAS Immutability

> Once a CAS object is stored under a digest key, its content is immutable.
> A digest key MUST always return the same bytes or a `cas_integrity_failed`
> error. Silent mutation is a critical invariant violation.

**Contract:** `contracts/determinism.contract.json` §cas
**CI gate:** `scripts/verify_cas.sh`

**Violation triggers:**
- Overwriting an existing CAS entry with different content
- Compressing/recompressing with different parameters after initial write
- Changing `CAS_FORMAT_VERSION` without a migration path

---

## INV-3: Audit Log Append-Only

> Audit log entries are never deleted, overwritten, or reordered. The log is
> strictly append-only. Any read of a past entry at index N must return the
> same value for the lifetime of the system.

**CI gate:** `scripts/verify_enterprise_boundaries.sh` (no DELETE on audit route)
**Code invariant:** `ready-layer/src/app/api/audit/logs/route.ts` exports only `GET`

---

## INV-4: No Silent Version Drift

> The numeric version constants in `include/requiem/version.hpp` must match the
> values emitted by the live binary's `requiem version` JSON output. Any
> discrepancy is a build-system bug, not a runtime tolerance.

**CI gate:** `scripts/verify_version_contracts.sh`

**Constants covered:**
| Constant | Current | Field in `version` output |
|---|---|---|
| `ENGINE_ABI_VERSION` | 2 | `engine_abi_version` |
| `HASH_ALGORITHM_VERSION` | 1 | `hash_algorithm_version` |
| `CAS_FORMAT_VERSION` | 2 | `cas_format_version` |
| `PROTOCOL_FRAMING_VERSION` | 1 | `protocol_framing_version` |
| `REPLAY_LOG_VERSION` | 1 | `replay_log_version` |
| `AUDIT_LOG_VERSION` | 1 | `audit_log_version` |

---

## INV-5: OSS ≠ Enterprise Isolation

> OSS engine source (`src/`, `include/requiem/`) must have **zero** compile-time
> or link-time dependency on enterprise code paths, enterprise endpoints, or
> cloud-specific data structures. The OSS build must succeed without any
> enterprise headers present.

**CI gate:** `scripts/verify_oss_boundaries.sh`

**Prohibited in OSS source:**
- `#include "enterprise/..."` or `#include "ready_layer/..."`
- Hardcoded URLs matching `ready-layer.com`, `readylayer.com`, `api.ready-layer`
- Any `REQUIEM_ENTERPRISE`-gated observability path (observability must be OSS-visible)

---

## INV-6: Next.js Must Not Implement Engine Logic

> The Next.js layer (`ready-layer/`) delegates **all** hashing and execution
> logic to the engine via the Node API boundary (`REQUIEM_API_URL`). The web
> layer is a presentation and proxy tier only.

**CI gate:** `scripts/verify_enterprise_boundaries.sh`

**Prohibited in `ready-layer/`:**
- Direct BLAKE3 computation (`blake3`, `createHash('sha256')` in hot paths)
- `child_process.spawn` / `child_process.exec` for engine commands
- Any duplicate execution logic

---

## INV-7: No Hard-500 Routes

> Every API route in `ready-layer/src/app/api/` must handle errors and return
> a structured JSON error body. Unhandled promise rejections that propagate as
> HTTP 500 with no JSON body are a P0 invariant violation.

**CI gate:** `scripts/verify_routes.sh`

**Enforcement:**
- All route handlers wrap async calls in `try/catch`
- All error responses use `NextResponse.json({ ok: false, error: ... }, { status: 4xx/5xx })`
- `export const dynamic = 'force-dynamic'` required on all API routes

---

## INV-8: Dependency Allowlist

> All runtime and build-time dependencies must be on the approved allowlist.
> Unapproved transitive additions block merge.

**CI gate:** `scripts/verify_deps.sh`
**Allowlists:** `contracts/deps.allowlist.json`

---

## INV-9: Migration Gating

> Any change to CAS format, protocol framing version, or DB schema must include:
> 1. A version bump (INV-4)
> 2. A forward-compatibility test
> 3. An entry in `docs/MIGRATION.md`

**CI gate:** `scripts/verify_migrations.sh`

---

## Invariant Change Process

To **strengthen** an invariant (tighten the constraint): PR + review.
To **weaken** an invariant (loosen the constraint): requires explicit ADR
(Architecture Decision Record) in `docs/decisions/` referencing the invariant
ID, sign-off from two reviewers, and a comment in this file explaining the
rationale.

**Invariants may never be silently removed.**
