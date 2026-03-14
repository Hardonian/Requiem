# Technical Diligence

This document is for senior engineers evaluating whether repository claims are testable.

## Verification baseline

Run and archive outputs:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm verify:demo
pnpm verify:determinism
pnpm verify:replay
pnpm verify:deploy-readiness
```

## What to inspect

- **Execution artifacts:** `demo_artifacts/*`
- **Proof/evidence surfaces:** `pnpm evidence` output
- **Contracts and invariants:** `contracts/*`, `docs/CONTRACT.md`, `docs/INVARIANTS.md`
- **Boundary checks:** scripts under `scripts/verify_*`

## Questions to answer during diligence

1. Are deterministic claims reproducible on a clean machine?
2. Are replay mismatches explicit failures (not warnings)?
3. Are degraded states surfaced clearly in doctor/verification output?
4. Are security and multi-tenant constraints documented with boundaries?
5. Are limitations documented where guarantees are partial?

## Required evidence for external claims

Do not claim a property publicly unless you can point to one of:

- passing command output,
- committed test/verification logic,
- generated artifact proving the behavior.
