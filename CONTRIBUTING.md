# Contributing to Requiem

This repository is **pnpm-first** and split across two primary surfaces:
- Requiem engine (C++20)
- ReadyLayer console/runtime APIs (TypeScript/Next.js)

## Prerequisites

- Node.js >= 20.11
- pnpm 8.15.x
- CMake >= 3.20
- C++20 compiler (GCC 11+, Clang 14+, or MSVC 2022+)

## Fast local path (no secrets)

```bash
pnpm install --frozen-lockfile
pnpm run verify:routes
pnpm --filter ready-layer test -- --run ready-layer/tests/auth-mode.test.ts ready-layer/tests/mcp-route-degraded.test.ts
```

Use this path for OSS contributions that do not require private infra.

## Full verification path

```bash
pnpm run doctor
pnpm run verify:ci
```

## Auth mode contract (ReadyLayer API)

- `REQUIEM_AUTH_MODE=strict` (or `NODE_ENV=production|staging|test`) requires `REQUIEM_AUTH_SECRET`.
- Local insecure auth requires explicit opt-in:
  - `REQUIEM_AUTH_MODE=local-dev`
  - `REQUIEM_ALLOW_INSECURE_DEV_AUTH=1`
- Protected routes must include `x-tenant-id`; `x-user-id` is not accepted as tenant context.

## Route truth contract

- `routes.manifest.json` is generated from filesystem API routes and exported methods.
- Regenerate with:

```bash
pnpm run verify:release-artifacts
```

- `pnpm run verify:routes` fails if manifest drift exists or if routes bypass `withTenantContext` without an approved exception.

## Pull Requests

- Keep diffs minimal and test-backed.
- Include commands you ran and results.
- Update docs when behavior contracts change.
