# Requiem

Provable AI runtime with a deterministic C++ kernel and a Next.js control console.

## Summary

Requiem is built around reproducible execution and verifiable artifacts:
- Deterministic C++ kernel (`./build/requiem`) for hashing, CAS, policies, plans, receipts, replay checks.
- Typed JSON error envelopes on CLI/API boundaries.
- Verification scripts for boundaries, integrity, policy, replay, and web contracts.
- Demo flow (`verify:demo`) that exercises doctor, plan hash/run, and log verification.

## Quickstart (5 Commands)

```bash
pnpm install
pnpm build
pnpm test
pnpm verify:integrity
pnpm verify:replay
```

## Demo (60-Second Path)

```bash
pnpm verify:demo
```

Expected demo artifacts:
- plan verification/hash output
- deterministic plan run receipt hash
- event log integrity verification (`log verify`)

## Verification Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:boundaries
pnpm verify:integrity
pnpm verify:policy
pnpm verify:replay
pnpm verify:web
pnpm doctor
pnpm doctor -- --json
```

## Kernel vs UI Boundary

- Kernel truth: C++ engine in `src/` + `include/`, compiled to `./build/requiem`.
- UI/API surface: `ready-layer/` (Next.js). It must never hard-500 and should return typed error envelopes.
- Contract checks: `verify:boundaries`, `verify:web`, and route/verify scripts in `ready-layer/scripts/`.

## Project Structure

```text
src/                  C++ kernel implementation
include/              C++ public headers
tests/                C++ unit/integration tests
ready-layer/          Next.js web console + API routes
packages/             TS workspaces (cli/ui/ai)
scripts/              verification and automation scripts
docs/                 specs, audits, and QA reports
private/              internal business/ops artifacts
```

## Notes

- Current CI/runtime warnings in this environment are primarily Node engine warnings (`project targets Node >=20.11`, current runtime observed during verification was Node 18.19).
- All commands listed above were executed and captured in `docs/FINAL_QA_SUMMARY.md`.

## UI Override (Stitch Integration)

The Stitch-aligned console routes are available by default in this branch.

To run locally and preview key pages in light/dark mode:

```bash
pnpm install
pnpm --filter ready-layer dev
```

Then open:

- `http://localhost:3000/registry`
- `http://localhost:3000/spend`
- `http://localhost:3000/drift`
- `http://localhost:3000/settings`

Use the **Theme** toggle in the left navigation to verify both light and dark rendering.
