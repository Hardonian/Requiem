# FAQ

## What is Requiem in one sentence?

A deterministic execution runtime with replay and evidence surfaces for workflow/agent-style operations.

## What should I run first?

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm verify:demo
```

## How do I verify deterministic behavior?

Run:

```bash
pnpm verify:determinism
pnpm verify:replay
```

## Where are limitations documented?

`docs/limitations.md`.

## Is this claiming complete production security by default?

No. Security outcomes depend on deployment controls and validated environment configuration.

## How do I evaluate quickly as an external engineer?

Use `docs/first-10-minutes.md` and `docs/external-tester-guide.md`.
