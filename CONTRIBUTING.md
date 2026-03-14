# Contributing to Requiem

Thanks for contributing. This project prioritizes deterministic behavior, clear boundaries, and auditable changes.

## Before you start

Read these first:

- [README.md](./README.md)
- [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- [docs/OSS_BOUNDARY.md](./docs/OSS_BOUNDARY.md)
- [GOVERNANCE.md](./GOVERNANCE.md)
- [docs/DOCS_GOVERNANCE.md](./docs/DOCS_GOVERNANCE.md)

## Development setup

```bash
pnpm install --frozen-lockfile
pnpm build
```

For C++ test workflows, ensure CMake and a C++20-capable toolchain are available.

## Code standards

- Keep diffs focused and minimal.
- Prefer deterministic, explicit behavior over implicit or hidden behavior.
- Reuse existing primitives and patterns before introducing new abstractions.
- Update docs and tests when behavior changes.

## Commit conventions

Use clear, scoped commit messages. Preferred style:

- `docs: ...`
- `fix: ...`
- `feat: ...`
- `chore: ...`

If a change spans multiple layers, call that out clearly in the commit body.

## Pull request guidelines

A good PR should include:

- What changed and why.
- Scope boundaries affected (engine, CLI, docs, ready-layer, scripts).
- Verification commands run and results.
- Follow-up work (if any).

Do not merge TODO-only or placeholder-only PRs.

## Issue reporting

Use GitHub issues for:

- Reproducible bugs.
- Feature requests with concrete use cases.
- Documentation gaps.

For security reports, use [SECURITY.md](./SECURITY.md) instead of public issues.

## Testing expectations

Run relevant checks before opening a PR. Typical baseline:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:determinism
```

If you cannot run a check locally, state the limitation explicitly in the PR.

## Documentation expectations

- Keep canonical docs concise and current.
- Archive outdated docs instead of silently deleting useful project history.
- Link new docs from existing canonical entry points.

See [docs/DOCS_GOVERNANCE.md](./docs/DOCS_GOVERNANCE.md).

## Public vs internal docs rules

- Public repo docs should contain durable developer/operator truth.
- Internal planning, scratch notes, and sensitive operational material belong outside committed public docs.
- Use ignored paths documented in `.gitignore` for non-public working material.

## License

By contributing, you agree your contributions are licensed under [Apache-2.0](./LICENSE).
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
