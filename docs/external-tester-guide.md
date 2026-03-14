# External Tester Guide

## What to test first

1. Install + build:

```bash
pnpm install --frozen-lockfile
pnpm build
```

2. Run baseline demo:

```bash
pnpm verify:demo
```

3. Run replay/determinism checks:

```bash
pnpm verify:replay
pnpm verify:determinism
```

## What is expected to be stable

- Build/test/lint/typecheck command paths.
- Demo artifact generation path (`demo_artifacts/*`).
- Determinism/replay verification scripts listed in README and quickstart.

## What may vary by environment

- Optional integrations and deploy-readiness checks.
- Web UI availability if local app dependencies are missing.

## How to report issues usefully

Include:

- OS + Node + pnpm version
- exact command that failed
- full error output
- whether issue reproduces on clean checkout
- generated artifacts/logs if available
