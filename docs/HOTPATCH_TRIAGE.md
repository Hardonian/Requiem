# Hot Patch Triage

## Baseline execution (current)

| Command | Result | Notes |
|---|---|---|
| `pnpm lint` | ✅ pass | ready-layer eslint clean |
| `pnpm typecheck` | ✅ pass | ready-layer `tsc --noEmit` clean |
| `pnpm test` | ✅ pass | now runs smoke lane (stress harness excluded by default) |
| `pnpm build` | ✅ pass | CMake build completed |
| `pnpm verify` | ✅ pass | lint + typecheck + boundaries clean |
| `pnpm verify:routes` | ✅ pass | includes route manifest + runtime + Problem+JSON + tenant-body checks |
| `pnpm verify:invariants` | ✅ pass | stable TS test runner and full TAP output |
| `pnpm verify:determinism-smoke` | ✅ pass | 2-run classes + concurrent check with zero drift |
| `pnpm verify:demo` | ⚠️ partial | doctor now passes reliably; demo execution can still fail when command execution is sandbox-limited |

## Resolved hot patches in this cycle

### Correctness
1. **Demo doctor CLI discovery path bug** (`scripts/demo-doctor.ts`): fixed local binary discovery for Linux/macOS/Windows build outputs and PATH fallback probing.
2. **Demo doctor recommendation bug** (`scripts/demo-doctor.ts`): fixed invalid `cliAvailable.ok` usage and switched to status-based checks.
3. **Demo run CLI discovery parity** (`scripts/demo-run.ts`): aligned runner with doctor resolution logic and explicit remediation.
4. **Route verifier tenant-context path mismatch** (`scripts/verify-routes.ts`): corrected required route IDs to canonical `/api/...` forms.

### Security / Safety
5. **Problem+JSON contract gate** (`scripts/verify-problem-json.ts`): added repo-wide static guard ensuring API routes either use `withTenantContext` or explicitly emit `application/problem+json` + trace IDs.
6. **Method-not-allowed hardening** (`ready-layer/src/app/api/routes-probe/route.ts`): added explicit `POST` handler returning structured Problem+JSON 405 instead of default framework response.
7. **Tenant source enforcement gate** (`scripts/verify-tenant-body.ts`): added static verification preventing tenant fields from request body usage in API route handlers.

### Determinism
8. **Determinism smoke gate wiring** (`package.json` + `scripts/verify_determinism.sh`): added `verify:determinism-smoke` (reduced run count) and included it in CI verify chain.
9. **Determinism evidence artifact** (`artifacts/reports/determinism_report.json`): confirmed zero drift across sequential and concurrent runs in smoke mode.

### Performance / UX
10. **Default feedback loop optimization** (`package.json`): split `pnpm test` into `test:smoke` and `test:stress`; default now excludes long `stress_harness`.
11. **Route runtime verifier robustness** (`scripts/verify-routes-runtime.ts`): improved server lifecycle teardown and added explicit Problem+JSON assertions for 404/405/429 when observed.
12. **Demo doctor degradation behavior** (`scripts/demo-doctor.ts`): engine check now skips cleanly when CLI unavailable instead of cascading failures.

## Remaining known risk
- `pnpm verify:demo` can still fail on `plan run` in constrained/sandboxed execution environments even after doctor succeeds; this is now isolated to runtime execution semantics rather than CLI discovery.
