# Operator Runbook

This runbook is for the current repository state, not for an aspirational platform state.

## 1. Preflight

### Tooling

```bash
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run verify:deploy-readiness
```

### Required decisions

Before starting ReadyLayer, decide:

- Are you running **local only** or the supported **shared-Supabase request-bound topology**?
- Are you using **Supabase auth**?
- Are you wiring an external runtime/API through `REQUIEM_API_URL`?
- Are you relying on any route that is informational, degraded, or stub-backed?

## 2. Required configuration

Minimum for authenticated ReadyLayer:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REQUIEM_AUTH_SECRET`
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

Additional when database/Prisma workflows are used:

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`

Additional when runtime-backed pages must call an external API:

- `REQUIEM_API_URL`

Do **not** enable `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1` outside a local developer machine.

## 3. Canonical startup paths

### Local repo verification path

```bash
pnpm run route:inventory
pnpm run verify:all
```

### ReadyLayer local dev path

```bash
cp ready-layer/.env.example ready-layer/.env.local
pnpm run dev
```

Install note: first install requires outbound access to `https://registry.npmjs.org`.

### Single-instance deployment smoke baseline

```bash
pnpm run verify:deploy-readiness
pnpm run verify:release
```

## 4. Smoke tests after startup

### Route and contract baseline

```bash
curl -sS http://localhost:3000/api/health | jq .
curl -sS http://localhost:3000/api/readiness | jq .
pnpm run verify:routes
pnpm run verify:tenant-isolation
pnpm run verify:nosecrets
pnpm run verify:no-stack-leaks
```

Interpretation:

- `/api/health` is a liveness check and should return `200` when the process is serving requests.
- `/api/readiness` should return `200` for console-only deployments once auth and control-plane persistence are healthy.
- If `REQUIEM_API_URL` is configured, `/api/readiness` should return `503` until the external runtime health probe succeeds.

### Optional deeper verification

```bash
pnpm run verify:determinism
pnpm run verify:replay
```

## 5. How to read failures

### Misconfiguration indicators

- `auth_secret_required` — strict auth mode is active without `REQUIEM_AUTH_SECRET`.
- `shared_runtime_coordination_unconfigured` — production-like runtime is missing Supabase service-role backing for rate limiting/idempotency.
- `control_plane_store_unconfigured` — production-like runtime is missing shared durable control-plane backing.
- `idempotency_recovery_required` — a previous request may have mutated state before replay metadata finalized; reconcile outcome before retrying with a new key.
- `missing_auth` / `invalid_auth` — request/auth context is wrong.
- `missing_tenant_id` — request reached a protected route without tenant context.
- Explicit “backend unconfigured” or “REQUIEM_API_URL missing” copy — route needs external runtime wiring.
- Prisma validation/generation failures — DB env is missing or invalid.

### Likely code/runtime bugs

- Route contract failures with correct env present.
- Structured route verification failures in `verify:routes` or `verify-routes-runtime`.
- Determinism/replay failures after stable environment setup.

## 6. Fail-closed expectations

The current operator expectation should be:

- deployed authenticated routes fail closed when strict auth prerequisites are missing,
- route wrappers return machine-readable problem responses instead of HTML 500s,
- missing runtime wiring is disclosed explicitly rather than hidden behind fake health.

If the app instead appears healthy while key backing services are absent, treat that as a repo-truth bug.

## 7. Known caveats operators must remember

- Execution remains request-bound even when state is shared; there is no durable background continuation after process loss.
- Some ReadyLayer routes are informational or stub-backed.
- `/app/tenants` is not proof of full multi-user tenant administration.
- Tenancy remains single-user-single-tenant.

## 8. Release/go-live minimum

Before any serious demo or deployment, capture:

- git SHA,
- exact env mode used,
- outputs of `pnpm run verify:release`,
- any degraded states that remained intentional.

Also review:

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [release-checklist.md](./release-checklist.md)
