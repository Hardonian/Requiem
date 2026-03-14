# AUDIT_RECOVERY_REPORT

## 1) BASELINE_GAP_MATRIX

| Issue | Severity | Category | Files | Proof | Fix |
| --- | --- | --- | --- | --- | --- |
| Auth allowed requests when `REQUIEM_AUTH_SECRET` was unset. | High | Security boundary softness | `ready-layer/src/lib/auth.ts` | code path returned `ok:true` with missing secret | strict/local auth mode contract + fail-closed default |
| MCP routes returned raw internal error messages to clients. | High | Error leakage | `ready-layer/src/app/api/mcp/**/route.ts` | degraded payload included `error: error.message` | remove client-visible internals; keep server logs |
| Route manifest drifted from filesystem reality. | High | Route truth drift | `routes.manifest.json`, `scripts/verify-routes.ts` | 58 API files vs 16 manifest entries | generated manifest from route files + failing drift gate |
| API conformance gate was partial and non-failing for most routes. | Medium | Route conformance inconsistency | `scripts/verify-routes.ts` | limited allowlist checks | global wrapper conformance with explicit exceptions |
| Contributor docs were contradictory (pnpm/npm, C++17/C++20, duplicate workflows). | Medium | Repo/documentation entropy | `CONTRIBUTING.md` | conflicting instructions in same file | canonicalized contribution workflow |

## 2) Security/auth fixes

- Added strict/local auth modes.
- Strict mode now fails closed when `REQUIEM_AUTH_SECRET` is missing.
- Insecure local auth requires explicit `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1` opt-in.
- Tenant context now requires `x-tenant-id` (no `x-user-id` fallback).

## 3) Error leakage fixes

- MCP degraded responses no longer include internal exception text.
- Internal error details remain logged with `trace_id`.

## 4) Route truth/inventory fixes

- Added `scripts/lib/route-manifest.ts` to generate manifest from filesystem and exported HTTP methods.
- `routes.manifest.json` regenerated to full route inventory.
- `scripts/verify-routes.ts` now fails on manifest drift.

## 5) Route conformance enforcement

- `verify-routes` now fails on routes bypassing `withTenantContext` except explicit exemptions:
  - `/api/status`
  - `/api/mcp/health`
  - `/api/mcp/tools`
  - `/api/mcp/tool/call`

## 6) Tenant model proof changes

- Added auth tests proving tenant header requirement and strict-mode behavior.

## 7) Synthetic/demo honesty

- No new synthetic production behavior introduced in this pass.
- MCP degraded behavior now explicitly labeled as unavailable and non-operational.

## 8) Docs/archive/canonicalization

- Added canonical docs set and governance rules.
- Added archive index for historical/non-canonical docs.

## 9) Contributor/tooling canonicalization

- Contributing guide now specifies pnpm-first workflow and C++20 requirement.
- Added explicit fast secretless path and full verification path.

## 10) Secretless OSS/operator trust improvements

- Added secretless command path in `GETTING_STARTED` and `CONTRIBUTING`.
- Added operator trace/runbook for triage with `x-trace-id` and `x-request-id`.

## 11) Reliability hardening

- Route drift and wrapper bypass now block verification.
- auth misconfiguration now machine-visible (`auth_secret_required`).

## 12) Verification results

See command logs in commit message and CI for:
- `pnpm run verify:routes`
- focused ready-layer tests for auth + mcp degradation

## 13) Re-score summary

- Before: 93/150 (audit)
- After (self-audit): 137/150
- Launch verdict: **B — READY WITH NON-BLOCKING FRICTION**

## 14) Remaining blockers to true A

- Middleware still maps tenant to user identity for Supabase user sessions; org membership model remains future work.
- Some route descriptions in generated manifest are generic and should be enriched from route metadata.
- Additional tenant isolation proofs at persistence layer should be expanded beyond existing foundry tests.

## TOP_10_SCORE_DELTA_CHANGES

1. Fail-closed strict auth mode.
2. Explicit insecure local auth toggle.
3. Removed `x-user-id` tenant fallback.
4. Removed MCP error-message leakage.
5. Added structured MCP failure logging with trace IDs.
6. Auto-generated full route manifest.
7. Made route-manifest drift a failing gate.
8. Made route wrapper bypass a failing gate.
9. Canonicalized contributor workflow and tooling language.
10. Added verified-claims matrix tied to executable checks.
