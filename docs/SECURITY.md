# Security Reality Check

This document is intentionally limited to what the current repository can honestly support.

## Current security posture

What is grounded in code and verification surfaces today:

- authenticated ReadyLayer routes use explicit auth helpers and structured error responses,
- strict auth mode fails closed when `REQUIEM_AUTH_SECRET` is required but missing,
- tenant context is expected to come from validated request context rather than request bodies,
- route verification checks protect against API routes bypassing tenant wrappers,
- secret and stack-leak checks exist in repo verification commands,
- some request guard behavior is explicit about being `memory-single-process`.

What this document does **not** claim:

- external security certification,
- complete multi-tenant SaaS isolation maturity,
- cluster-safe rate limiting/idempotency,
- comprehensive hosted-platform incident controls.

## Auth model

### ReadyLayer web app

- Browser auth depends on Supabase configuration.
- Middleware resolves the current user.
- For authenticated page/API requests, middleware forwards the Supabase user ID as both actor ID and tenant ID.

That means the current web security model is best understood as **user-scoped isolation**, not shared-org tenancy.

### Strict vs local-dev auth behavior

- In `production`, `staging`, and `test`, auth defaults to strict mode.
- Missing `REQUIEM_AUTH_SECRET` in strict mode is a configuration error and should fail closed.
- `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1` is only for local development when strict mode is not active.

## Security-sensitive operator warnings

Do not normalize these shortcuts:

- `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1` on any deployed environment,
- service-role keys in client/browser config,
- claims that stub/informational routes prove runtime security controls,
- claims that per-user tenant headers equal full multi-user tenant administration.

## Verification commands

Recommended baseline:

```bash
pnpm run verify:routes
pnpm run verify:tenant-isolation
pnpm run verify:nosecrets
pnpm run verify:no-stack-leaks
pnpm run verify:deploy-readiness
```

Use stronger engine/runtime checks as needed:

```bash
pnpm run verify:determinism
pnpm run verify:replay
```

## Disclosure and response

Use the root [SECURITY.md](../SECURITY.md) for vulnerability reporting.
