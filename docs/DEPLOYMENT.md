# Deployment Truth

This document describes what deployment shapes are honestly supported by the current repository.

## Short version

- The repo is strongest as a **local/CI-verifiable codebase**.
- The supported first-customer topology is **ReadyLayer request-bound execution backed by shared Supabase state**.
- One or more ReadyLayer instances can serve traffic honestly **only** for request-bound semantics; there is no durable background continuation after request/process loss.
- The current web tenancy model is **single authenticated user -> single tenant ID**.

## Product/deployment model

### What ReadyLayer is today

ReadyLayer is currently an operator console with mixed route maturity. Protected API routes can be authenticated either by a Supabase-backed browser session or by the configured `REQUIEM_AUTH_SECRET` bearer secret for operator/service clients.

ReadyLayer has mixed route maturity:

- some routes are local-runtime-backed,
- some need an external API at `REQUIEM_API_URL`,
- some are informational,
- some are stub/demo surfaces that explicitly avoid fabricated data.

Do not describe the current web app as a complete hosted SaaS control plane.

### Tenancy truth

Middleware derives tenant context from the current Supabase user and forwards the user's ID as both actor and tenant.

That means the current repo truth is:

- one authenticated user maps to one tenant scope,
- there is no proven org/team/workspace membership model,
- there is no proven invitation or seat-management model,
- there is no proven admin boundary for multi-user shared tenants.

## Supported topology matrix

| Topology | Supported? | Why / caveats | Required backing services |
| --- | --- | --- | --- |
| CLI on a developer machine | Yes | Local storage and local verification flows are first-class | None beyond local filesystem/toolchain |
| Engine build/test in CI | Yes | Native engine and route checks are codified in scripts/workflows | CI runner with Node/CMake/toolchain |
| ReadyLayer local dev server | Yes | Good fit for route verification and UI evaluation | Supabase public envs for auth flows |
| ReadyLayer process with shared Supabase-backed state | Yes | Canonical first-customer topology when request-bound execution is acceptable | Supabase auth envs + REQUIEM_AUTH_SECRET + SUPABASE_SERVICE_ROLE_KEY (+ optional external API) |
| ReadyLayer process + external `REQUIEM_API_URL` | Yes | Runtime-backed pages can work if API is reachable | Supabase auth + SUPABASE_SERVICE_ROLE_KEY + external API |
| Multiple ReadyLayer replicas behind one load balancer | Yes, with bounded semantics | Shared request coordination/control-plane state is supported, but execution is still request-bound and does not continue after process loss | Supabase auth + SUPABASE_SERVICE_ROLE_KEY |
| Serverless/edge ReadyLayer claiming durable async execution | Not supported | Request-bound execution must not be represented as durable background orchestration | N/A |
| Shared org/team SaaS control plane | Not implemented | Current tenant derivation is per-user, not shared-org | N/A |

## Why horizontal replication is not yet honest

In production-like deployments, ReadyLayer now requires shared Supabase-backed state for:

- token-bucket rate limiting,
- idempotency replay/recovery state,
- tenant-scoped control-plane persistence.

Responses expose `x-requiem-rate-limit-scope`, `x-requiem-idempotency-scope`, `x-requiem-cache-scope`, `x-requiem-execution-model`, and `x-requiem-supported-topology` so operators can observe the actual contract.

Horizontal replication is honest only because execution is explicitly request-bound. A crashed process does **not** continue work in the background; clients must retry or reconcile.

## Filesystem/local-state assumptions

Several repo surfaces still assume local process or local filesystem ownership outside the supported deployment shape:

- CLI state under `~/.requiem` / local data paths,
- ReadyLayer local development mode when durable env is absent,
- route flows that disclose tenant-local paths for local verification.

Production-like ReadyLayer deployments must use shared Supabase backing and must not reinterpret request-bound execution as durable async work.

## What “production-plausible” means here

For this repository, “production-plausible” means only:

- the app can be deployed as one or more instances backed by shared Supabase coordination/state,
- required auth/config is provided,
- routes that are degraded or stub-backed stay honestly described,
- operators do not claim durable background execution or multi-org guarantees that the code does not prove.

It does **not** mean:

- durable background execution after process/request loss,
- enterprise SaaS tenancy maturity,
- org/team shared tenancy,
- complete runtime backing for every UI surface.

## Deployment checklist

1. Fill env from [ENVIRONMENT.md](./ENVIRONMENT.md).
2. Decide whether you are validating:
   - **liveness only** via `/api/health`, or
   - **full runtime readiness** via `/api/readiness`.

   `/api/readiness` is intentionally topology-aware: it stays not-ready until all requirements for the declared topology are true.
   - local-single-runtime requires authenticated ReadyLayer envs plus local control-plane persistence,
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `REQUIEM_AUTH_SECRET` are operational,
   - shared control-plane persistence plus shared request coordination are available for production-like deployments,
   - `REQUIEM_API_URL` is configured and answers a health probe only when you declare an external-runtime topology.

   A local-single-runtime developer boot can be ready with filesystem persistence. A production-like console-only deployment can also be ready without `REQUIEM_API_URL`, but only if shared Supabase-backed coordination is healthy.
3. Run:

   ```bash
   pnpm install --frozen-lockfile
   pnpm run verify:deploy-readiness
   pnpm run verify:release
   ```

4. Decide whether each required route is:
   - local-runtime-backed,
   - external-runtime-backed,
   - informational only,
   - stub/demo.
4. If deploying ReadyLayer, verify auth behavior with real Supabase envs.
5. If using `REQUIEM_API_URL`, verify reachable health/status endpoints and route-specific degraded states.
6. Verify `/api/readiness` matches your topology:
   - local-single-runtime: may pass with filesystem persistence only outside production-like mode,
   - shared request-bound deployment: may pass without `REQUIEM_API_URL`, but must fail closed unless shared Supabase state is configured,
   - shared request-bound + external API: must fail until the configured `REQUIEM_API_URL` health probe succeeds.
7. Run `pnpm run verify:first-customer` for the canonical local boot/smoke proof and `pnpm run verify:release` for the consolidated release gate.

## Unsupported deployment shortcuts

Do not do these:

- deploy with `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1`,
- market `/app/tenants` as proof of live shared-tenant management,
- treat informational/demo pages as runtime health evidence,
- claim durable background continuation after a request/process dies.
