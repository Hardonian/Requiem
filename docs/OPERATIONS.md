# Operations

This file is intentionally narrow: it documents current operator reality, not an idealized SRE story.

## What operators can rely on today

- local and CI verification commands,
- structured route/problem responses for ReadyLayer API routes,
- explicit degraded-state copy when runtime wiring is missing,
- local/single-process request guard behavior,
- local storage and replay-oriented workflows through CLI and scripts.

## What operators should not infer

Do not infer from this repository alone that it already provides:

- shared cluster-safe request guards,
- complete hosted-control-plane observability,
- org/team tenancy administration,
- production incident automation beyond the documented scripts.

## Canonical operator docs

- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [OPERATOR_RUNBOOK.md](./OPERATOR_RUNBOOK.md)
- [SECURITY.md](./SECURITY.md)
- [limitations.md](./limitations.md)

## Canonical checks

```bash
pnpm run doctor
pnpm run verify:deploy-readiness
pnpm run verify:routes
pnpm run verify:all
```
