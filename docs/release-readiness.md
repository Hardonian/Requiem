# Release Readiness Canonical Snapshot

_Last updated: 2026-03-14_

## Toolchain + lock policy

- Package manager: `pnpm@8.15.0` (root `package.json#packageManager`).
- Lock policy: install with `pnpm install --frozen-lockfile` in CI and Vercel.
- Node policy: `.nvmrc` pins `20.11.0`; root and `ready-layer` both require `>=20.11.0`.

## Workspace + build graph

- Workspace packages are defined in `pnpm-workspace.yaml`:
  - `packages/*`
  - `ready-layer`
- Core release build commands:
  - Engine/C++: `pnpm build` (`scripts/cmake-build.sh`).
  - Web app: `pnpm --filter ready-layer build`.
  - CI parity/deploy checks: `pnpm verify:deploy-readiness`.

## CI / local / Vercel parity contract

The enforced parity contract is checked by `scripts/verify-deploy-readiness.mjs`:

1. Toolchain pins (`pnpm@8.15.0`, Node `20.11.0` policy).
2. Vercel config (`framework: nextjs`, frozen install, scoped build command).
3. Web env contract file (`ready-layer/.env.example`) exists and includes required keys.

Run locally:

```bash
pnpm verify:deploy-readiness
```

## Vercel assumptions

`vercel.json` is authoritative:

- `installCommand`: `pnpm install --frozen-lockfile`
- `buildCommand`: `pnpm --filter ready-layer build`
- framework: Next.js

## Environment contract

`ready-layer/.env.example` defines deployment inputs:

- Required:
  - `REQUIEM_API_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Optional / degraded-mode aware:
  - `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `REQUIEM_AUTH_SECRET`, `REDIS_URL`
  - diagnostics metadata (`VERCEL_GIT_COMMIT_SHA`, `BUILD_TIME`, `REQUIEM_PROMPT_VERSION`, `REQUIEM_CORE_VERSION`)

## Release operator entrypoints

- Process: `docs/release-process.md`
- Checklist: `docs/release-checklist.md`
- Existing deploy sanity notes: `docs/VERCEL_DEPLOY_SANITY.md`
