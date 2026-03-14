# Requiem Repository State Report

_Last updated: 2026-03-14 (implementation pass)_

## 1) Workspace package graph

Workspace projects (`pnpm-workspace.yaml`):

- `@requiem/ai` (`packages/ai`)
- `@requiem/audit` (`packages/audit`)
- `@requiem/cli` (`packages/cli`)
- `@requiem/core` (`packages/core`)
- `@requiem/http` (`packages/http`)
- `@requiem/testdata` (`packages/testdata`)
- `@requiem/ui` (`packages/ui`)
- `ready-layer` (`ready-layer`)

High-level dependency flow:

- `ready-layer` depends on `@requiem/ai`.
- Root scripts orchestrate C++ kernel (`scripts/cmake-build.sh`) and web verification.
- CLI is published from `@requiem/cli` and exposes `requiem`, `reach`, `req`, `rl` bins.

## 2) CLI entrypoints

Primary entrypoints:

- `packages/cli/src/cli.ts` (`requiem`, `reach`, `req`)
- `packages/cli/src/rl-cli.ts` (`rl`)

Observed command handlers in `cli.ts` include:

- `init`, `run`, `replay`, `verify`, `doctor`, `demo`
- plus extensive operator / governance commands listed in `--help`.

Gap identified:

- `prove` does not appear as a first-class top-level command switch in `cli.ts` (requested command surface includes `requiem prove`).

## 3) Web routes and pages

API routes are implemented under `ready-layer/src/app/api/**/route.ts` and include health, policies, runs, replay, foundry, intelligence, and tenant-isolation surfaces.

Primary console pages exist under:

- `ready-layer/src/app/console/*`
- `ready-layer/src/app/app/*`
- `ready-layer/src/app/settings/page.tsx`
- `ready-layer/src/app/runs/*`

Routes for dashboard-like surfaces are present (`/app`, `/console`, executions/runs, policy/policies, settings). Proofpack exposure appears within replay/proof/diff and artifact-related API surfaces.

## 4) Build and verification scripts

Root scripts currently relevant for first-run developer experience:

- `pnpm install --frozen-lockfile`
- `pnpm lint` (ready-layer eslint)
- `pnpm typecheck` (ready-layer TS)
- `pnpm build` (C++ kernel)
- `pnpm test` (C++ smoke tests; expects `build/` present)
- `pnpm web:dev` (ready-layer dev server)
- `pnpm doctor` (root doctor script)

This pass adds:

- `pnpm dev` at repo root (alias to ready-layer dev)
- `scripts/verify-repo.mjs` + `pnpm verify:repo` for baseline repo readiness checks.

## 5) Environment requirements (observed)

- Node.js `>=20.11.0` (root + workspace packages)
- `pnpm@8.15.0`
- CMake + compiler toolchain for kernel build/tests
- Optional Prisma workflow in `ready-layer` (`pnpm --filter ready-layer prisma:generate`)
- Runtime env vars vary by integration (OpenAI/Supabase/Stripe/etc.); `pnpm doctor` should be used for local diagnostics.

## 6) Issues identified in this pass

- **Broken lint**: unused `ctx` arg in `ready-layer/src/app/api/failures/analytics/route.ts` (fixed).
- **Developer onboarding friction**: root lacked a `pnpm dev` script (fixed).
- **Missing repo-level verifier**: no consolidated `scripts/verify-repo.mjs` existed (added).

## 7) Potential cleanup candidates (not auto-removed in this pass)

- Root scripts surface is very large and partially overlapping (`verify:*`, `build:*`, `test:*` variants).
- Demo artifacts in `examples/demo/` use legacy naming (`plan.json`, `policy.json`) versus requested canonical names.
- Documentation is broad and partially fragmented across subfolders; canonical index files were added in this pass to reduce navigation drift.
