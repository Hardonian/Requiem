# Getting Started

This is the canonical first-clone path for OSS contributors.

## Prerequisites

- Node.js >= 20.11.0
- pnpm >= 8.15.0 (`packageManager` is pinned to `pnpm@8.15.0`)
- CMake >= 3.20.0
- C++20-capable compiler (GCC 11+, Clang 14+, or MSVC 2022+)

## First-clone flow

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run verify:all
pnpm run dev
```

## Canonical root commands

- `pnpm run dev` starts ReadyLayer local development.
- `pnpm run build` builds engine + web surfaces.
- `pnpm run test` runs engine smoke tests (`test:smoke`).
- `pnpm run verify:all` is the strongest standard repo gate.
- `pnpm run doctor` reports missing blockers and engine build state.

## Focused OSS iteration (when full gate is unnecessary)

```bash
pnpm run verify:routes
pnpm run test
```

Use full `verify:all` before submitting changes.
