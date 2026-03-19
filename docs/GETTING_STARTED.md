# Getting Started

This is the canonical first-clone path for OSS contributors.

## Prerequisites

- Node.js >= 20.11.0
- pnpm >= 8.15.0 (`packageManager` is pinned to `pnpm@8.15.0`)
- CMake >= 3.20.0
- C++20-capable compiler (GCC 11+, Clang 14+, or MSVC 2022+)
- Outbound package access to `https://registry.npmjs.org/` for the initial `pnpm install`

If your machine is behind a proxy, mirror, or restricted egress policy, validate that
`pnpm install --frozen-lockfile` can reach the public npm registry before assuming
the repo is broken. A blocked install is an operator-environment issue until proven
otherwise.

## First-clone flow (full confidence gate)

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
node scripts/bootstrap-preflight.mjs
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run verify:all
```

`verify:all` is the canonical pre-change and pre-PR gate. It runs route verification, lint/typecheck, engine+web build, and smoke tests.

## First ReadyLayer operator path

Use this when you are validating the web app as a new operator rather than doing
engine-only work.

### 1) Install

```bash
node scripts/bootstrap-preflight.mjs
pnpm install --frozen-lockfile
```

`bootstrap-preflight` checks Node/pnpm/Corepack versions, verifies the lockfile and
env template exist, and probes the configured pnpm registry or mirror. If network
egress is restricted, fix the registry/proxy path first instead of retrying a
broken install blindly.

### 2) Configure local env

```bash
cp .env.example .env
cp ready-layer/.env.example ready-layer/.env.local
```

Then replace placeholders in `ready-layer/.env.local` before boot:

- always set `NEXT_PUBLIC_SUPABASE_URL`
- always set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- set `REQUIEM_AUTH_SECRET` for any strict authenticated run
- set `SUPABASE_SERVICE_ROLE_KEY` for production-like shared coordination
- set `REQUIEM_API_URL` only if you want readiness to include an external runtime probe

### 3) Start the app

```bash
pnpm run dev
```

### 4) Verify liveness vs full readiness honestly

```bash
curl -sS http://localhost:3000/api/health
curl -sS http://localhost:3000/api/readiness
```

- `/api/health` is a liveness check: it should return `200` when the process is serving.
- `/api/readiness` is a topology-aware readiness gate.
  - local-single-runtime can return `200` when auth env and local persistence are healthy;
  - production-like console-only deployments can return `200` without `REQUIEM_API_URL`
    when shared Supabase-backed coordination/persistence is healthy;
  - if `REQUIEM_API_URL` is configured, readiness returns `503` until that runtime probe succeeds.

### 5) Run the HTTP smoke flow

Reuse the same bearer secret for the smoke client:

```bash
export REQUIEM_AUTH_SECRET='<same value used by the app>'
AUTH_TOKEN="$REQUIEM_AUTH_SECRET" BASE_URL=http://localhost:3000 bash ready-layer/scripts/smoke-api.sh
```

The smoke script checks:

- public route liveness,
- protected-route auth enforcement, including invalid auth rejection,
- budget write + read-after-write,
- idempotent replay on a duplicate budget mutation,
- plan creation,
- plan execution plus duplicate-run replay protection,
- plan retrieval after execution.

## Faster local loop (when you do not need full gate)

```bash
pnpm run verify:routes
pnpm run test
```

Run full `verify:all` before submitting changes.

## Optional services and degraded states

- ReadyLayer local development (`pnpm run dev`) is optional for engine-only work.
- `doctor` warning about a missing engine binary is expected before first `build` or `test`.
- If `verify:all` fails during engine build, fix CMake/compiler prerequisites first; if it fails during web build, inspect `ready-layer` lint/typecheck errors.

## Canonical root commands

- `pnpm run dev` starts ReadyLayer local development.
- `pnpm run build` builds engine + web surfaces.
- `pnpm run test` runs the engine smoke tests (`test:smoke`).
- `pnpm run verify:all` is the strongest standard repo gate.
- `pnpm run doctor` reports missing blockers and engine build state.
