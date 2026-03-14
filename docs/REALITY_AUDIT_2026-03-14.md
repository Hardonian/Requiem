# Requiem 150-Point Reality Audit (2026-03-14)

Scope: repository at `/workspace/Requiem` on current branch.
Method: code-and-command evidence only; no claims accepted without direct repository proof.

## Commands executed

- `pnpm -s run doctor` (pass, with warning that engine binary was not present before build)
- `node scripts/run-tsx.mjs scripts/verify-routes.ts` (pass, reported route/manifest mismatch warnings)
- `pnpm audit --prod --audit-level=high` (failed due npm audit endpoint 403)
- `python` route wrapper coverage check (58 API routes, 3 outside tenant wrapper)

---

## 1) Product Surface — **11/20**

**Strengths**
- Large public and app route surface exists (marketing pages + dashboard + API endpoints).
- Root and app-specific error boundaries are implemented.

**Weaknesses**
- Product messaging is polished, but multiple API handlers are synthetic/stub-style responses (e.g., generated run IDs and timestamps) rather than persisted product behavior.
- Route manifest tracks 16 API routes while filesystem has 58 API routes; discoverability and trust in the “source of truth” is weak.
- No route-level `loading.tsx` files were found under `ready-layer/src/app`, indicating limited explicit loading state UX.

**Risk level**: **Medium**

**Required improvements**
1. Replace synthetic API payloads with durable backing data or explicitly mark non-production endpoints.
2. Make route manifest generation automatic and complete.
3. Add route-level loading states for high-latency views.

---

## 2) Developer Experience — **14/20**

**Strengths**
- Root README has runnable quickstart and verification commands.
- `pnpm doctor` gives concrete environment diagnostics and passed in this environment.
- Script surface is extensive (`doctor`, `verify:*`, build/test tooling).

**Weaknesses**
- Guidance is inconsistent across docs (mixed npm/pnpm references, duplicated workflows, conflicting requirements language).
- Full verification path is heavy and not clearly split into “fast contributor path” vs “full release path”.
- Some scripts require external secrets/services in CI, increasing first-run friction.

**Risk level**: **Medium**

**Required improvements**
1. Consolidate one canonical contributor workflow.
2. Introduce `verify:fast` and document expected duration.
3. Add explicit “no-secrets local mode” with expected outputs.

---

## 3) Repository Hygiene — **10/20**

**Strengths**
- Strong policy/check script presence and CI gates.
- Clear directory segmentation across engine, packages, and web app.

**Weaknesses**
- Documentation sprawl with many overlapping audit/readiness reports (`MEGA`, `NUCLEAR`, `THEATRE`, multiple “industrialization” files) creates maintenance burden and weakens trust in canonical status.
- Contributor guide contains duplicated sections and conflicting statements (e.g., C++17 claim vs CMake C++20).
- Version drift risk in dependencies/config (e.g., different Next.js major versions in root vs `ready-layer`).

**Risk level**: **High**

**Required improvements**
1. Establish canonical docs and archive superseded reports.
2. Resolve conflicting standards in CONTRIBUTING and align with actual build system.
3. Enforce dependency/version single-source policy across workspace.

---

## 4) System Architecture — **15/20**

**Strengths**
- Architecture shows intentional layering: C++ deterministic engine, TS packages, Next.js control plane.
- Shared HTTP utilities (`withTenantContext`, problem+json) enforce consistent response and trace patterns.

**Weaknesses**
- A subset of API routes bypasses shared tenant wrapper and follows bespoke handling paths.
- Middleware currently maps tenant context directly to user identity headers; enterprise multi-tenant org model is not demonstrated in code.

**Risk level**: **Medium**

**Required improvements**
1. Require all API routes to pass through one hardened request context path.
2. Implement explicit org/tenant membership resolution (not user-id aliasing).
3. Add architectural conformance tests that fail on wrapper bypass.

---

## 5) Reliability & Failure Handling — **13/20**

**Strengths**
- Global/app error boundaries exist.
- Problem+json infrastructure returns structured errors and preserves trace/request IDs.
- `withTenantContext` includes bounded rate limiting, idempotency conflict behavior, and structured logging.

**Weaknesses**
- Several route warnings from route verification indicate potential missing hard-500 protections.
- In-memory rate-limit/cache/idempotency stores are process-local and not resilient in multi-instance deployments.
- No explicit circuit breaker/backpressure evidence for downstream dependency failures.

**Risk level**: **Medium**

**Required improvements**
1. Convert route warning checks into failing gates.
2. Move request-state controls (rate limit/idempotency) to shared durable store for production mode.
3. Add chaos/failure injection tests at web/API layer.

---

## 6) Security & Trust — **10/20**

**Strengths**
- Auth gate exists in middleware and in route utility.
- Problem+json avoids server stack leaks by default.

**Weaknesses**
- Auth fallback behavior allows acceptance when `REQUIEM_AUTH_SECRET` is unset (development convenience that must be explicitly locked out in production path).
- MCP route error responses include raw `error.message` in client output.
- Tenant model is weakly bound to request headers/user ID and does not demonstrate robust tenant boundary checks against data-layer authorization.

**Risk level**: **High**

**Required improvements**
1. Fail closed when auth secret/config is missing in non-local environments.
2. Remove raw internal error messages from external responses.
3. Add formal tenant-bound authorization tests proving no cross-tenant read/write paths.

---

## 7) Operational Readiness — **11/15**

**Strengths**
- CI is broad (multi-OS build/test, governance checks, additional nightly schedules).
- Determinism and artifact uploads exist in workflows.

**Weaknesses**
- CI for web stack depends on external secrets; OSS operator reproducibility without org secrets is limited.
- Route manifest drift and multiple check surfaces increase chance of contradictory operational signals.

**Risk level**: **Medium**

**Required improvements**
1. Add secretless CI mode for OSS fork validation.
2. Make release gating depend on synchronized route inventory.
3. Publish minimal operator runbook for triage using trace/request IDs.

---

## 8) Documentation Quality — **6/10**

**Strengths**
- Extensive docs coverage and many topical guides.

**Weaknesses**
- Canonical path is unclear due to high volume of overlapping reports.
- Internal contradictions in contribution/setup docs reduce trust.

**Risk level**: **Medium**

**Required improvements**
1. Define canonical “start here” and “release truth” docs.
2. Add docs-lint for contradictory version/tooling statements.

---

## 9) Adoption & OSS Appeal — **3/5**

**Strengths**
- Strong value proposition and clear deterministic/compliance narrative.
- Publicly understandable quickstart and demo commands.

**Weaknesses**
- Skeptical OSS maintainers will detect documentation inflation and partial mock behavior quickly.

**Risk level**: **Medium**

**Required improvements**
1. Reduce narrative volume; increase executable proof density.
2. Provide one “hard proof” dashboard of verified claims tied to tests/artifacts.

---

## 10) Cross-review synthesis (skeptical reviewer simulation)

### OSS Maintainer
- **Top strengths**: rich test/gate intent; clear deterministic mission.
- **Top risks**: repo hygiene/documentation sprawl; uncertain canonical source of truth.
- **Go/No-go**: **No-go** until canonicalization and drift controls are tightened.

### Senior Staff Engineer
- **Top strengths**: evident architecture effort and reusable primitives (`withTenantContext`, problem+json).
- **Top risks**: route conformance drift; stubs mixed with production-looking surfaces.
- **Go/No-go**: **Conditional** on architectural enforcement and non-mock runtime paths.

### Security Engineer
- **Top strengths**: structured error envelope and auth middleware presence.
- **Top risks**: permissive auth fallback, tenant-as-user simplification, error message leakage in MCP endpoints.
- **Go/No-go**: **No-go** for enterprise-facing launch until fail-closed auth and tenant proofs are in place.

### SRE / Reliability Engineer
- **Top strengths**: broad CI and deterministic verification culture.
- **Top risks**: in-memory request controls in distributed contexts, possible hard-500 coverage gaps.
- **Go/No-go**: **Conditional** for limited launch; **No-go** for high-SLA posture.

### Technical VC Diligence Reviewer
- **Top strengths**: coherent technical thesis (determinism + replay + evidence).
- **Top risks**: maturity signals diluted by doc proliferation and some non-production implementation patterns.
- **Go/No-go**: **Proceed with caution** only if launch blockers are remediated.

---

## 11) Final score

**FINAL_REQUIEM_SCORE: 93 / 150**

Band: **80–99 — Significant issues remain**

---

## 12) Required fixes (priority)

### 1. Launch blockers
1. Enforce fail-closed auth config in non-local modes.
2. Eliminate MCP internal error-message leakage.
3. Close route manifest drift (58 filesystem API routes vs 16 manifest entries).

### 2. Trust gaps
1. Replace/label synthetic API payloads.
2. Prove tenant isolation against persistence layer with executable tests.

### 3. Developer adoption friction
1. Consolidate docs to one canonical setup/contrib path.
2. Provide quick verification target with deterministic expected runtime.

### 4. Maintainability risk
1. Reduce report/doc duplication.
2. Add conformance checks so every API route uses shared wrapper/error semantics.

---

## 13) Launch verdict

**LAUNCH VERDICT: C — NOT YET READY**

Justification: the system shows substantial engineering work and strong intent, but launch-grade trust is undermined by security boundary softness (auth/tenant rigor), route inventory drift, and repository/documentation entropy. Current state is credible for continued private hardening, not for high-trust public launch claims.
