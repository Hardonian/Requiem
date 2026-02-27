# SCOPE.md — Layer Map and Contribution Boundaries

This document defines what belongs in each layer of the Requiem monorepo and
what is explicitly **out of scope** for automated agents and contributors
working in a single layer.

---

## Layer 1: Requiem OSS Engine

**Directories:** `src/`, `include/requiem/`, `tests/`, `third_party/`
**Language:** C++20
**Build:** CMake (`CMakeLists.txt`)
**External deps:** vendored BLAKE3, optional zstd (system or disabled)

### In Scope
- Execution runtime: sandbox, worker pool, scheduler
- Content-addressed storage (CAS): insert, get, gc
- Deterministic hashing: BLAKE3 canonicalization
- Protocol framing: NDJSON exec stream + replay stream
- Audit log: append-only provenance records
- CLI: `requiem exec`, `requiem cas`, `requiem replay`, `requiem version`, `requiem health`, `requiem doctor`
- C API (`include/requiem/c_api.h`): pure C, ABI-stable

### Out of Scope (in this layer)
- HTTP servers or web frameworks
- Database drivers
- Authentication / JWT handling
- Any `ready-layer/`-specific logic
- Telemetry that requires network calls (metrics are local only)

### Boundary Enforcement
- CI: `scripts/verify_oss_boundaries.sh`
- Invariant: INV-5

---

## Layer 2: ReadyLayer Cloud (Enterprise)

**Directories:** `ready-layer/`
**Language:** TypeScript / Next.js 14
**Runtime:** Vercel / Node.js
**Constraint:** NEVER copies engine logic; always proxies via `REQUIEM_API_URL`

### In Scope
- Dashboard pages: executions, CAS, replay, metrics, diagnostics, tenants
- API routes: `/api/health`, `/api/engine/*`, `/api/cas/*`, `/api/replay/*`, `/api/audit/*`
- Auth: tenant JWT validation (`src/lib/auth.ts`)
- Engine client: typed HTTP wrappers (`src/lib/engine-client.ts`)
- Type definitions: `src/types/engine.ts`

### Out of Scope (in this layer)
- Any BLAKE3 or hash computation
- Spawning child processes
- Implementing replay logic (consume replay API only)
- Modifying `src/` or `include/` C++ files

### Boundary Enforcement
- CI: `scripts/verify_enterprise_boundaries.sh`
- Invariant: INV-6

---

## Layer 3: CI / Governance

**Directories:** `scripts/`, `.github/`, `contracts/`, `testdata/`, `prompts/`

### In Scope
- Verify scripts (all `scripts/verify_*.sh`)
- GitHub Actions workflows (`.github/workflows/`)
- Determinism contract (`contracts/determinism.contract.json`)
- Dependency allowlist (`contracts/deps.allowlist.json`)
- Migration policy (`contracts/migration.policy.json`)
- Golden corpus (`testdata/golden/`)
- Prompt lock (`prompts/system.lock.md`)
- Route manifest (`routes.manifest.json`)

### Out of Scope (in this layer)
- Engine business logic
- UI components
- Database schema changes

### Boundary Enforcement
- Any CI change that disables or weakens an existing check requires two reviewers.

---

## Cross-Layer Changes

A PR touching files in ≥2 layers must:
1. Include `[cross-layer]` in the PR title.
2. Pass ALL CI checks (not just the affected layer's checks).
3. Have the determinism contract updated if INV-1 could be affected.

---

## What Agents Must NOT Do (Scope Creep Prevention)

| Action | Reason |
|--------|--------|
| Add new runtime HTTP calls from the engine | Violates OSS isolation |
| Add database drivers to `src/` | Out of scope for engine layer |
| Copy BLAKE3 hash logic into `ready-layer/` | Violates INV-6 |
| Disable or comment out CI checks | Non-negotiable |
| Add enterprise feature flags to OSS observability | Violates INV-5 |
| Remove `export const dynamic = 'force-dynamic'` from API routes | Violates INV-7 |
| Introduce a new dependency without updating `contracts/deps.allowlist.json` | Violates INV-8 |
| Change CAS shard depth without a version bump | Violates INV-2 + INV-4 |
