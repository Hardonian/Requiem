# RUNBOOK — BIG4 Foundation

## Local setup

```bash
pnpm install
```

## Validate new BIG4 foundation only

```bash
pnpm verify:big4
```

This executes:
- canonical JSON stability checks
- audit append-only checks

## CI integration guidance

Add `pnpm verify:big4` to your CI job after dependency install and before full test/build gates.

## Operational model

- Feature flags are read from env (`BIG4_REPLAY`, `BIG4_REGISTRY`, `BIG4_SPEND`, `BIG4_DRIFT`) and can be overridden per tenant in memory (`packages/core/src/tenant-config.ts`).
- API entry points should wrap handlers with `withTenantContext` from `@requiem/http` to guarantee:
  - request context extraction
  - route+tenant rate limiting
  - safe Problem+JSON errors
  - policy hook execution before business logic.
