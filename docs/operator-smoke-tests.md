# Operator Smoke Tests

Run these after deploy or before public demos.

## Core

```bash
pnpm doctor
pnpm verify:demo
pnpm verify:replay
pnpm verify:determinism
```

## Build/test baseline

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

## Deploy readiness

```bash
pnpm verify:deploy-readiness
```

## What to record

- commit SHA
- command outputs (success/failure)
- artifact paths generated
- degraded/optional warnings encountered
