# Durability Model

Durability in this repository is evaluated through verification and crash/recovery test paths.

## Intended behavior

- Persist execution artifacts so replay/inspection remains possible after process restarts.
- Surface failures explicitly when integrity or required state cannot be verified.

## Verification paths

```bash
pnpm test:durability
pnpm test:fault-injection
pnpm verify:demo
```

## Boundaries

- Exact durability guarantees depend on runtime storage backend and deployment configuration.
- Operators should validate backup/restore and retention behavior in their target environment.
