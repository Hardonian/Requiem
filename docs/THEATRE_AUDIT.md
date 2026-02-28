# Theatre Audit — No Theatre Pass (Phase 5)

> **Purpose**: This document is the canonical registry of security and capability features that
> are claimed, stubbed, or partially implemented in Requiem. Every item here represents something
> that *looks* real but is **not** fully enforced. The goal is honest accounting — not blame.
>
> Last updated: 2026-02-28 (Phase 5 hardening pass)

---

## How to Read This Document

| Column | Meaning |
|--------|---------|
| **Feature** | The capability or security control |
| **Status** | `stub` / `not-implemented` / `partial` / `implemented` |
| **Location** | Source file(s) |
| **What's Missing** | What would be required to make it real |
| **Risk if left as-is** | Severity if this remains a stub in production |

---

## Registry

### 1. Signed Result Bundles

| Field | Value |
|-------|-------|
| **Feature** | Cryptographic signatures on `ReplayBundle` / `ExecutionProvenance` |
| **Status** | ❌ stub |
| **Location** | [`include/requiem/provenance_bundle.hpp`](../include/requiem/provenance_bundle.hpp) — `ExecutionProvenance::signature` field |
| **Current behaviour** | `signature` is always `""`. The `enable_signed_replay_bundles` flag exists but the signing implementation does not. The `to_json()` output **must** emit `"signing_status": "stub"` to prevent callers from treating an empty field as a valid blank signature. |
| **What's needed** | Choose a signing scheme (Ed25519 recommended), generate/manage key material, implement `sign_bundle()` and `verify_bundle()`, wire into `BundleBuilder::build()`. |
| **Risk** | **High** — A consumer that checks `signature != ""` will believe bundles are unsigned (correct), but a consumer that assumes *any* bundle from this system is signed will be deceived. Audit chains relying on bundle integrity have no cryptographic guarantee. |

---

### 2. Seccomp-BPF Sandbox

| Field | Value |
|-------|-------|
| **Feature** | Seccomp-BPF syscall filtering for sandboxed process execution |
| **Status** | ❌ not-implemented |
| **Location** | [`include/requiem/sandbox.hpp`](../include/requiem/sandbox.hpp) — `SeccompAction`, `SeccompRule`, `install_seccomp_filter()`, `ProcessSpec::enforce_seccomp` |
| **Current behaviour** | Types and function declarations exist. `install_seccomp_filter()` is declared but not wired into `run_process()`. `ProcessResult::sandbox_seccomp` is always `false`. `theatre_audit` will include `"seccomp: not_implemented"`. |
| **What's needed** | Implement `install_seccomp_filter()` using `libseccomp` or raw `prctl`/`seccomp()` syscall. Wire into `run_process()` when `enforce_seccomp=true`. Add Linux-only compilation guard. |
| **Risk** | **High** — Sandboxed child processes can make arbitrary syscalls. Memory corruption in a tool could escalate to the host. Without seccomp, the "sandbox" label is aspirational on Linux. |

---

### 3. Windows Restricted Tokens / Process Mitigations

| Field | Value |
|-------|-------|
| **Feature** | `create_restricted_token()`, `apply_windows_mitigations()` |
| **Status** | ⚠️ partial — declarations exist, wiring TBD |
| **Location** | [`include/requiem/sandbox.hpp`](../include/requiem/sandbox.hpp) — `create_restricted_token()`, `apply_windows_mitigations()` |
| **Current behaviour** | Job Objects with kill-on-close are implemented. Restricted tokens and mitigation policies are declared but not confirmed to be wired. `sandbox_restricted_token` and `sandbox_process_mitigations` in `ProcessResult` track actual application. `theatre_audit` will include `"job_objects: partial"`. |
| **What's needed** | Implement and wire `create_restricted_token()` and `apply_windows_mitigations()` for Windows builds. Gate behind `#ifdef _WIN32`. |
| **Risk** | **Medium** — Windows sandboxing is weaker than documented. Tools run with full user privileges unless mitigations are applied. |

---

### 4. JWT Validation in MCP Transport

| Field | Value |
|-------|-------|
| **Feature** | JWT / session token validation for MCP route handler auth |
| **Status** | ❌ stub |
| **Location** | [`packages/ai/src/mcp/transport-next.ts`](../packages/ai/src/mcp/transport-next.ts) — `resolveContext()`, `AUTH_STATUS` constant |
| **Current behaviour** | In `REQUIEM_DEV_MODE=1`, a single-tenant stub bypasses all auth. In production (default), `resolveContext()` throws `NOT_CONFIGURED` for any non-dev request — effectively blocking all production use. There is **no JWT parsing or validation** at any path. `AUTH_STATUS === 'stub'`. A one-time `console.warn` fires on first request. |
| **What's needed** | Integrate with an auth provider (Auth0, Supabase, Clerk, etc.). Parse and verify JWT (signature, claims, expiry). Extract `tenant_id`, `user_id`, `role` from validated claims. Rotate signing keys. |
| **Risk** | **Critical** — No JWT validation means authentication does not exist for production builds. The `NOT_CONFIGURED` throw prevents silent auth bypass, but the system cannot serve authenticated production traffic at all. |

---

### 5. Audit Log Persistence

| Field | Value |
|-------|-------|
| **Feature** | Durable, append-only, replicated audit log for tool invocations |
| **Status** | ❌ in-memory / local file only |
| **Location** | [`packages/ai/src/telemetry/audit.ts`](../packages/ai/src/telemetry/audit.ts) — `AUDIT_PERSISTENCE` constant, `fileAuditSink` |
| **Current behaviour** | Default sink writes NDJSON to `.data/ai-audit/<date>.ndjson` on local disk. No replication, no backup, no indexing, no tamper-evidence. `AUDIT_PERSISTENCE === 'memory'`. `setAuditSink()` can be used to swap in a DB-backed sink, but no production sink ships. |
| **What's needed** | Implement a production `AuditSink` backed by an append-only store (Postgres with WAL, S3 + object-lock, or a dedicated audit log service). Wire in tamper-evident chaining (BLAKE3 of previous record). Deploy as part of production infrastructure. |
| **Risk** | **High** — Tool-level audit records are not available after restart or across instances. Compliance requirements (SOC 2, GDPR, etc.) that require audit trails cannot be met with the current sink. |

---

### 6. Merkle Audit Chain

| Field | Value |
|-------|-------|
| **Feature** | Merkle-linked audit chain for tamper-evident audit records |
| **Status** | ❌ not-implemented |
| **Location** | [`flags/flags.registry.json`](../flags/flags.registry.json) — `merkle_audit_chain` flag |
| **Current behaviour** | Feature flag `merkle_audit_chain` exists in the registry. No code implements Merkle linking of audit records. |
| **What's needed** | Each audit record includes `prev_hash = BLAKE3(previous_record)`. Root hash is published or stored separately. Verification tool walks the chain and checks all links. |
| **Risk** | **Medium** — Without chaining, a compromised audit log cannot be distinguished from an intact one. The flag's existence could mislead auditors into believing the chain is active. |

---

### 7. Budget Enforcement Across Restarts

| Field | Value |
|-------|-------|
| **Feature** | Per-tenant budget enforcement that survives process restarts |
| **Status** | ⚠️ in-memory only |
| **Location** | [`packages/ai/src/policy/budgets.ts`](../packages/ai/src/policy/budgets.ts) |
| **Current behaviour** | Budget counters are held in-memory maps. A process restart resets all counters. Multi-instance deployments have independent counters per instance — over-spend is possible. |
| **What's needed** | Persist counters to a shared store (Redis, Postgres). Use atomic increment operations. Implement distributed rate limiting (token bucket in Redis, or a dedicated metering service). |
| **Risk** | **Medium** — Tenants can exceed budgets by restarting the service or using multiple instances. Cost overruns are possible in production. |

---

## Summary Table

| Feature | Status | Risk |
|---------|--------|------|
| Signed bundles | ❌ stub | High |
| Seccomp-BPF sandbox | ❌ not-implemented | High |
| Windows restricted tokens | ⚠️ partial | Medium |
| JWT validation (MCP transport) | ❌ stub | Critical |
| Audit log persistence | ❌ in-memory only | High |
| Merkle audit chain | ❌ not-implemented | Medium |
| Budget enforcement (cross-restart) | ⚠️ in-memory only | Medium |

---

## What Is Actually Implemented

The following controls are **genuinely implemented** and not theatre:

| Feature | Evidence |
|---------|---------|
| BLAKE3 hashing with domain separation | `include/requiem/hash.hpp`, vendored, domain-prefixed |
| Policy gate (guardrails) | `packages/ai/src/policy/gate.ts`, `guardrails.ts` — wired in Phase 1 |
| Token-bucket rate limiter | `packages/ai/src/policy/budgets.ts` — in-memory but enforced per-request |
| Path workspace confinement | `ProcessSpec` + sandbox implementation |
| Job Objects (Windows kill-on-close) | `ProcessResult::sandbox_job_object` — confirmed |
| rlimits (Linux/macOS) | `ProcessResult::sandbox_rlimits` — confirmed |
| Determinism proof (BLAKE3 result digest) | `ExecutionProvenance::result_digest` — computed and checked |
| Dev mode auth warning | `transport-next.ts` — loud `console.warn` on every dev-mode request |

---

*This document is maintained as part of the Phase 5 "No Theatre Pass". Update this file whenever a stub is promoted to a real implementation or a new stub is introduced.*
