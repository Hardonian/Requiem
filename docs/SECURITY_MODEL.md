# Security Model

This document defines the explicit security posture for Requiem OSS + ReadyLayer.
It is intentionally implementation-aligned and references active enforcement surfaces.

## 1. Trust boundaries

## OSS engine boundary (`src/`, `include/requiem/`)
- Deterministic execution, hashing, CAS, replay, and policy primitives live in the engine.
- The engine is treated as the trust anchor for digest computation and replay proofs.
- Enterprise/UI code must not be imported into OSS surfaces (enforced by repository verification scripts).

## API/UI boundary (`ready-layer/`)
- Next.js API routes are orchestration boundaries, not trust anchors.
- API handlers must return structured JSON errors (no hard 500 HTML leaks).
- Tenant-aware handlers are expected to run under tenant context wrappers.

## CLI boundary (`packages/cli/`)
- CLI is an orchestration surface over contracts and runtime primitives.
- Fast paths (`help`, `version`) are intentionally lightweight and avoid heavy imports.

## 2. Authentication and authorization model

- Route classification (public/protected) is declared in `routes.manifest.json` via `auth_required`.
- Public probes are explicitly marked (for example `/api/health`, `/api/mcp/health`).
- Protected routes are expected to enforce tenant context and policy checks before execution.
- CLI and API both surface policy denial via structured error envelopes rather than implicit failures.

## 3. Tenant isolation rules

Hard requirements:
1. No cross-tenant data reads through tool or API orchestration.
2. No cross-tenant budget exhaustion side effects.
3. No implicit tenant context reuse across concurrent runs.

Current verification:
- `scripts/verify-tenant-isolation.ts` validates context isolation and denial behavior.
- Route verification checks tenant-context usage for non-probe API routes.

## 4. Secrets and sensitive data handling

- Secret scanning is part of verification (`verify:nosecrets`).
- Error surfaces must avoid stack or environment leakage (`verify:no-stack-leaks`).
- Structured logging should prefer digests/metadata over raw payloads when possible.

## 5. Webhook/inbound signature expectations

- Any inbound external callback or webhook endpoint must verify provenance before side effects.
- Signature verification failures must produce explicit machine-readable errors.
- Degraded verification (e.g., missing key material) must be explicit and non-silent.

## 6. Client/server assumptions

- Browser/client code is untrusted input.
- Server routes must validate request body and query parameters before execution.
- Deterministic contract claims are only valid when execution is routed through engine policy gates.

## 7. Security verification and drift prevention

Recommended baseline checks for every change set:

```bash
pnpm run verify:routes
pnpm run verify:tenant-isolation
pnpm run verify:nosecrets
pnpm run verify:no-stack-leaks
pnpm run verify:determinism
```

If any check degrades, release should be blocked until the failure mode is explicitly resolved or risk-accepted in release notes.
