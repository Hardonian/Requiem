# Deployment Truth

This document describes what deployment shapes are honestly supported by the current repository.

## Short version

- The repo is strongest as a **local/CI-verifiable codebase**.
- A **single ReadyLayer instance** can be an honest deployment if you accept current single-process limits.
- A **shared multi-replica control plane** is not yet a proven deployment target.
- The current web tenancy model is **single authenticated user -> single tenant ID**.

## Product/deployment model

### What ReadyLayer is today

ReadyLayer is currently an operator console with mixed route maturity:

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
| Single ReadyLayer process with Supabase auth | Yes, with caveats | Honest if you accept process-local rate limiting, idempotency, and cache scope | Supabase auth; optional DB/API wiring |
| Single ReadyLayer process + external `REQUIEM_API_URL` | Yes, with caveats | Runtime-backed pages can work if API is reachable | Supabase auth + external API |
| Multiple ReadyLayer replicas behind one load balancer | No proven support | Request guards expose `memory-single-process` scope; local control-plane state is not shared | Would require shared backing for request guards and state |
| Serverless/edge ReadyLayer with ephemeral local state assumptions | Not supported | Local process/filesystem assumptions are not deployment-safe there | N/A |
| Shared org/team SaaS control plane | Not implemented | Current tenant derivation is per-user, not shared-org | N/A |

## Why horizontal replication is not yet honest

Current ReadyLayer request infrastructure uses in-memory `Map` instances for:

- token-bucket rate limiting,
- idempotency replay records,
- response caching.

Responses also expose `x-requiem-rate-limit-scope`, `x-requiem-idempotency-scope`, and `x-requiem-cache-scope` as `memory-single-process` to make that limitation explicit.

So a horizontally replicated deployment would have per-instance behavior unless the implementation changes first.

## Filesystem/local-state assumptions

Several repo surfaces assume local process or local filesystem ownership:

- CLI state under `~/.requiem` / local data paths,
- ReadyLayer local control-plane state on disk for some operational routes,
- route flows that disclose tenant-local paths rather than shared cluster state.

If your deployment model assumes stateless app instances plus durable shared backing, the repo is not there yet by default.

## What “production-plausible” means here

For this repository, “production-plausible” means only:

- the app can be deployed as a **single instance**,
- required auth/config is provided,
- routes that are degraded or stub-backed stay honestly described,
- operators do not claim multi-replica or multi-org guarantees that the code does not prove.

It does **not** mean:

- horizontally safe operation,
- enterprise SaaS tenancy maturity,
- globally shared control-plane state,
- complete runtime backing for every UI surface.

## Deployment checklist

1. Fill env from [ENVIRONMENT.md](./ENVIRONMENT.md).
2. Decide whether you are validating:
   - **liveness only** via `/api/health`, or
   - **full runtime readiness** via `/api/readiness`.

   `/api/readiness` is intentionally stricter: it stays not-ready until all of the following are true:
   - `REQUIEM_AUTH_SECRET` (or equivalent internal proof secret path) is operational,
   - control-plane persistence is writable,
   - `REQUIEM_API_URL` is configured and answers a health probe.

   That means a console-only deployment can be alive while `/api/readiness` still returns `503`.
3. Run:

   ```bash
   pnpm install --frozen-lockfile
   pnpm run verify:deploy-readiness
   pnpm run verify:all
   ```

4. Decide whether each required route is:
   - local-runtime-backed,
   - external-runtime-backed,
   - informational only,
   - stub/demo.
5. If deploying ReadyLayer, verify auth behavior with real Supabase envs.
6. If using `REQUIEM_API_URL`, verify reachable health/status endpoints and route-specific degraded states.
7. Run the HTTP smoke flow against the booted app:

   ```bash
   AUTH_TOKEN="$REQUIEM_AUTH_SECRET" BASE_URL=http://localhost:3000 bash ready-layer/scripts/smoke-api.sh
   ```

   This exercises:
   - public route liveness,
   - protected-route auth enforcement,
   - idempotent budget mutation replay,
   - read-after-write truth,
   - plan creation, execution, and retrieval.

8. Do not scale horizontally unless you have first removed the single-process request-guard assumptions.

## Unsupported deployment shortcuts

Do not do these:

- deploy with `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1`,
- market `/app/tenants` as proof of live shared-tenant management,
- treat informational/demo pages as runtime health evidence,
- claim replicated safety while request guards remain memory-single-process.
