# Red Team Findings — Enterprise Due Diligence

**Date**: 2026-03-01
**Scope**: Full repo (CLI + ReadyLayer + Engine + Storage + Policy + Signing + Arbitration + CI)
**Method**: Manual code review + static analysis + baseline verification runs

---

## Finding RT-001: Replay Tenant Isolation Bypass [SEVERITY: HIGH]

**Surface**: `packages/cli/src/commands/replay.ts` — `run`, `diff`, `export` subcommands

**Reproduction**:

1. Tenant A creates a decision via `decide evaluate`
2. Tenant B calls `replay run <decisionId>` or `replay export <decisionId>` without `--tenant`
3. The `findById(runId)` call has no tenantId filter — returns any tenant's data

**Root Cause**: Three `DecisionRepository.findById()` calls pass only `runId` without `tenantId`:

- Line 19: `const decision = DecisionRepository.findById(runId);`
- Line 122-123: `DecisionRepository.findById(run1)` and `findById(run2)`
- Line 216: `const decision = DecisionRepository.findById(runId);`

**Impact**: Cross-tenant data exfiltration. Any tenant with CLI access can read another tenant's decision records, traces, and usage data, including potentially sensitive decision inputs/outputs.

**Status**: **PATCHED** — All three calls now pass `tenantId`. Added `--tenant` CLI option with `DEFAULT_TENANT` fallback.

---

## Finding RT-002: Bugreport Environment Variable Leakage [SEVERITY: HIGH]

**Surface**: `packages/cli/src/commands/bugreport.ts` — `sanitizeEnvironment()`

**Reproduction**:

1. Set `DATABASE_URL=postgresql://user:secret_password@host/db` in environment
2. Run `requiem bugreport`
3. `DATABASE_URL` is **included with full value** because it doesn't match any `SECRET_PATTERNS` regex

**Root Cause**: The regex patterns match keys like `token`, `secret`, `key`, `auth` etc., but `DATABASE_URL`, `SUPABASE_URL`, `DIRECT_DATABASE_URL` — which commonly embed credentials in the URL — are not matched. The code falls through to `env[key] = value` for all unmatched keys.

**Impact**: Credentials embedded in URLs (standard PostgreSQL/Supabase pattern) leak into bug report output.

**Status**: **PATCHED** — Changed to allowlist-only approach. Only `SAFE_ENV_VARS` list gets values. All other env vars show `[PRESENT]` or `[REDACTED]`, never values.

---

## Finding RT-003: Lint and Typecheck Failures (Build Gate Broken) [SEVERITY: MEDIUM]

**Surface**: `ready-layer/` — lint + typecheck

**Reproduction**:

1. `pnpm run lint` → 4 errors
2. `pnpm run typecheck` → 1 error

**Findings**:

- `next.config.performance.ts:9` — unused `PERFORMANCE_BUDGETS` variable
- `next.config.performance.ts:36` — `require()` import forbidden by ESLint
- `next.config.performance.ts:30` — `placeholder` property not valid in `NextConfig.images`
- `StructuredData.tsx:11` — unused `ReactNode` import
- `sitemap.ts:43` — unused `dynamicRoutePatterns` variable

**Impact**: CI gate (`verify:full`) would fail. Broken build gate means PRs could merge without verification.

**Status**: **PATCHED** — All 5 issues fixed. Lint and typecheck now pass.

---

## Finding RT-004: Decision List Not Tenant-Scoped (Partial) [SEVERITY: LOW]

**Surface**: `packages/cli/src/db/decisions.ts` — `DecisionRepository.list()` method

**Observation**: The `list()` method has an optional `tenantId` parameter. When called without it (e.g., from some internal paths), it returns all decisions across tenants.

**Mitigation**: The `handleList()` in `decide.ts` always passes `tenantId` from the resolved tenant context. The risk is in direct repository usage without tenant scoping.

**Status**: **ACCEPTABLE RISK** — The `list()` function properly supports tenant filtering and all CLI entry points resolve tenant context before calling. Would recommend making `tenantId` required in a future iteration.

---

## Finding RT-005: In-Memory DB (No WAL/Transaction Safety) [SEVERITY: INFORMATIONAL]

**Surface**: `packages/cli/src/db/connection.ts`

**Observation**: The current DB implementation is a pure in-memory mock (`InMemoryDB`). This means:

- No write-ahead log (WAL)
- No transaction isolation
- No persistence
- No concurrent-write safety

**Mitigation**: This is by design for the current CLI mode (single-process, ephemeral execution). The `better-sqlite3` dependency is available for production use via the optimized wrapper at `db/optimized-wrapper.ts`.

**Status**: **ACCEPTABLE** — Design choice for development/demo mode. Production path uses real SQLite with proper WAL mode.

---

## Finding RT-006: Error Handler Doesn't Leak Stack Traces [SEVERITY: PASS]

**Surface**: `ready-layer/src/app/error.tsx`

**Verification**: The global error boundary:

- Only renders `error.digest` (a safe opaque identifier)
- Never renders `error.message` or `error.stack`
- Console.error logs only the digest

**Status**: **PASS** — No stack trace leakage to end users.

---

## Finding RT-007: SECURITY.md Present [SEVERITY: PASS]

**Surface**: Root `SECURITY.md`

**Verification**: File exists at repo root with reporting instructions.

**Status**: **PASS**

---

## Finding RT-008: CI Permissions and Secrets Handling [SEVERITY: LOW]

**Surface**: `.github/workflows/ci.yml`

**Observation**:

- Secrets are properly accessed via `${{ secrets.* }}` syntax
- No secrets are echoed in commands
- `actions/checkout@v4` used (pinned major version, not unpinned `@latest`)
- No `write` permissions explicitly granted (defaults to read)

**Minor concern**: `schedule` triggers run on the default branch with elevated permissions. This is standard but worth noting.

**Status**: **ACCEPTABLE** — Follows GitHub Actions security best practices.

---

## Finding RT-009: Policy File Not Enforcing Quotas [SEVERITY: LOW]

**Surface**: `policy/default.policy.json` — `tenant.default_quota`

**Observation**: All quota values are `null`, meaning no limits are enforced:

```json
"default_quota": {
  "compute_units_per_hour": null,
  "memory_units_per_hour": null,
  ...
}
```

**Mitigation**: This is by design for the default policy. Enterprise deployments would customize these values. The policy infrastructure exists and works.

**Status**: **ACCEPTABLE** — Quotas are configurable but not enabled by default. This is a reasonable default for development.

---

## Summary

| ID | Finding | Severity | Status |
| :--- | :--- | :--- | :--- |
| RT-001 | Replay tenant isolation bypass | HIGH | PATCHED |
| RT-002 | Bugreport env var leakage | HIGH | PATCHED |
| RT-003 | Lint/typecheck failures | MEDIUM | PATCHED |
| RT-004 | Decision list optional tenantId | LOW | Acceptable |
| RT-005 | In-memory DB design | INFO | By design |
| RT-006 | Error handler stack trace check | N/A | PASS |
| RT-007 | SECURITY.md present | N/A | PASS |
| RT-008 | CI permissions | LOW | Acceptable |
| RT-009 | Policy quotas null | LOW | Acceptable |
