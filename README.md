# Requiem

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
![Node >=20.11](https://img.shields.io/badge/node-%3E%3D20.11.0-339933)

Requiem is a monorepo for three related surfaces:

- a native C++ execution engine under `src/`, `include/requiem/`, and `tests/`,
- a TypeScript CLI under `packages/cli/`, and
- a Next.js operator console under `ready-layer/`.

The repository proves local build, route-contract, replay-oriented workflows, and a request-bound ReadyLayer deployment backed by shared Supabase state. It does **not** prove durable background workers or org/team SaaS tenancy.

## Current state

### What this repository is today

- **Engine:** local/native execution and deterministic test surfaces.
- **CLI:** local operator tooling backed by on-disk state under `~/.requiem` or repo-local `.requiem` paths, depending on command/config.
- **ReadyLayer web app:** an authenticated operator console with a mix of:
  - routes backed by local single-process control-plane state,
  - routes that require an external API endpoint via `REQUIEM_API_URL`, and
  - informational/demo surfaces that are explicit about degraded or stubbed behavior.

### Tenancy model

ReadyLayer currently derives tenant context from the authenticated Supabase user ID in middleware and forwards that same value as both `x-user-id` and `x-tenant-id` to server routes. In practice, the web app behaves as **single-tenant-per-authenticated-user**, not as a multi-user organization SaaS with shared workspaces, invitations, seats, or org switching.

If you need org/team tenancy, shared control-plane state across users, or delegated admin boundaries, treat that as future work rather than current repo truth.

### Supported deployment model

Supported today:

- local development on one machine,
- local verification/CI runs,
- one or more ReadyLayer instances connected to Supabase auth plus Supabase service-role backed shared coordination/state, and optionally an external Requiem API endpoint.

Not supported as a proven topology today:

- any deployment that expects durable background continuation after request/process loss,
- serverless/edge topologies that reinterpret request-bound execution as durable async orchestration,
- any deployment that markets the current ReadyLayer surface as a shared multi-user SaaS control plane.

### Control-plane and storage truth

- The CLI persists local operational state to SQLite/on-disk storage.
- Many ReadyLayer routes read or write tenant-scoped local control-plane state.
- In production-like deployments, ReadyLayer request rate limiting and idempotency replay are backed by shared Supabase state; local development still uses process-local fallbacks where safe.
- Some routes also depend on `REQUIEM_API_URL` to reach an external runtime/API service.
- `/app/tenants` currently returns a **stub** payload and should be read as a truth disclosure surface, not proof of live multi-tenant control-plane enforcement.

## Before you deploy

Do **not** deploy this repository as though it already provides:

- shared multi-user org tenancy,
- horizontally safe control-plane coordination,
- cross-replica idempotency/rate-limit guarantees, or
- production-ready backend telemetry for every ReadyLayer route.

Before any non-local deployment:

1. Read [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).
2. Fill environment variables from [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).
3. Decide whether your deployment is:
   - **console-only** (Supabase auth + UI, with degraded routes where backend wiring is absent), or
   - **console + external API** (requires a reachable `REQUIEM_API_URL`).
4. Reject any topology that depends on durable background work after request/process loss; current execution is request-bound even when control-plane state is shared.

## Repository layout

- `src/`, `include/requiem/`, `tests/` — native engine.
- `packages/cli/` — CLI and local operator workflows.
- `packages/ai/` — TypeScript policy/tooling layer used by the console and CLI workflows.
- `ready-layer/` — Next.js operator console and API routes.
- `scripts/` — build, verification, route inventory, and repo policy checks.
- `docs/` — canonical docs plus historical material.

## Install and verify

### Prerequisites

- Node.js `20.11.0` or newer
- pnpm `8.15.0`
- CMake and a C++20-capable compiler for native engine builds/tests

### Install

```bash
pnpm install --frozen-lockfile
```

### Core commands

```bash
pnpm run doctor
pnpm run route:inventory
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm run test
pnpm run verify:all
pnpm run verify:deploy-readiness
```

### What each command is for

- `pnpm run doctor` — local prerequisite and state inspection.
- `pnpm run route:inventory` — regenerate `routes.manifest.json` from the current route tree.
- `pnpm run lint` — ReadyLayer lint.
- `pnpm run typecheck` — ReadyLayer type-check.
- `pnpm run build` — native engine build plus web build.
- `pnpm run test` — engine smoke tests.
- `pnpm run verify:release` — canonical first-customer go-live gate: deploy-readiness, route truth, docs truth, lint, typecheck, build, smoke tests, and survivability checks.
- `pnpm run verify:all` — standard repo gate: doctor, route inventory, route checks, lint, typecheck, build, test.
- `pnpm run verify:deploy-readiness` — checks Node/pnpm/Vercel/env-contract parity.

### Useful focused checks

```bash
pnpm run verify:routes
pnpm run verify:tenant-isolation
pnpm run verify:nosecrets
pnpm run verify:no-stack-leaks
pnpm run verify:determinism
pnpm run verify:replay
pnpm rl --help
pnpm rl doctor
```

## Environment contract

Two env example files exist:

- root [`/.env.example`](./.env.example) — repo-level local/dev variables,
- [`ready-layer/.env.example`](./ready-layer/.env.example) — ReadyLayer deployment contract.

Authoritative documentation: [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).

High-level requirements:

- **ReadyLayer auth UI requires:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **ReadyLayer strict authenticated API mode requires:** `REQUIEM_AUTH_SECRET`
- **Production-like shared control-plane/idempotency/rate limiting require:** `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`
- **Routes that fetch external runtime data require:** `REQUIEM_API_URL`
- **Prisma/DB workflows require:** `DATABASE_URL` and, where your setup uses it, `DIRECT_DATABASE_URL`
- **Unsafe local-only auth fallback:** `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1` only outside strict auth mode; never use this for production deployment

## Supported topology matrix

| Topology | Status | Notes |
| --- | --- | --- |
| CLI on one machine | Supported | Uses local filesystem/SQLite state. |
| ReadyLayer dev server on one machine | Supported | Uses local filesystem state and process-local caches intentionally. |
| ReadyLayer deployment with Supabase-backed shared state | Supported | Request coordination/control-plane state are shared; execution still remains request-bound in the handling runtime. |
| Multiple ReadyLayer replicas sharing production traffic | Supported with bounded semantics | Safe only for request-bound flows backed by shared Supabase state; there is no durable background continuation after request/process loss. |
| Edge/serverless deployment claiming durable async continuation | Not supported | Request-bound execution must not be marketed as durable async orchestration. |
| Org/team multi-user SaaS control plane | Not implemented | Current tenant derivation is single-user-scoped. |

Full detail: [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). Release gate: `pnpm run verify:release`.

## Architecture truth

At a high level:

1. the native engine is the local trust anchor for engine-specific build/test flows,
2. the CLI orchestrates local workflows and persists local state,
3. ReadyLayer middleware authenticates through Supabase and maps each authenticated user to a tenant ID equal to that user ID,
4. ReadyLayer API routes use tenant wrappers that add structured error handling, route contracts, shared durable idempotency/rate limiting in production-like deployments, and explicit request-bound execution headers,
5. some console routes remain informational, degraded, or stubbed rather than live runtime proof.

Use these docs as the current truth spine:

- [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- [docs/OPERATOR_RUNBOOK.md](./docs/OPERATOR_RUNBOOK.md)
- [docs/SECURITY.md](./docs/SECURITY.md)
- [docs/limitations.md](./docs/limitations.md)
- [docs/reference/ROUTE_MATURITY.md](./docs/reference/ROUTE_MATURITY.md)

## Limitations

- The repository contains historical and aspirational material under `docs/`; not every document describes current deployable truth.
- Some ReadyLayer routes are intentionally informational or stub-backed.
- Current tenant isolation language in code is stronger than the current hosted-product reality; read it as route/request scoping, not as proof of org-SaaS maturity.
- Build and verification coverage is strongest for local/CI workflows, not for clustered production operations.

## Contribution and review

Start here:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [docs/README.md](./docs/README.md)
- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)

If you are evaluating the repo, prefer command results and source-linked docs over narrative claims.
