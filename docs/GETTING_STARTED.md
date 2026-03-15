# Getting Started

This is the canonical first-clone path for OSS contributors.

## Prerequisites

- Node.js >= 20.11.0
- pnpm >= 8.15.0 (`packageManager` is pinned to `pnpm@8.15.0`)
- CMake >= 3.20.0
- C++20-capable compiler (GCC 11+, Clang 14+, or MSVC 2022+)

## First-clone flow (full confidence gate)

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run verify:all
```

`verify:all` is the canonical pre-change and pre-PR gate. It runs route verification, lint/typecheck, engine+web build, and smoke tests.

## Faster local loop (when you do not need full gate)

```bash
pnpm run verify:routes
pnpm run test
```

Run full `verify:all` before submitting changes.

## Optional services and degraded states

- ReadyLayer local development (`pnpm run dev`) is optional for engine-only work.
- `doctor` warning about a missing engine binary is expected before first `build` or `test`.
- If `verify:all` fails during engine build, fix CMake/compiler prerequisites first; if it fails during web build, inspect `ready-layer` lint/typecheck errors.

## Canonical root commands

- `pnpm run dev` starts ReadyLayer local development.
- `pnpm run build` builds engine + web surfaces.
- `pnpm run test` runs the engine smoke tests (`test:smoke`).
- `pnpm run verify:all` is the strongest standard repo gate.
- `pnpm run doctor` reports missing blockers and engine build state.
