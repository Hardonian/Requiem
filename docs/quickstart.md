# Quickstart

This is the canonical first-run path for external evaluators.

## Prerequisites

- Node.js `>=20.11`
- `pnpm` (repo is pinned to pnpm 8.x)
- C++ build toolchain compatible with CMake (for `pnpm build` / engine build)

## 1) Install and build

```bash
pnpm install --frozen-lockfile
pnpm build
```

## 2) Verify environment baseline

```bash
pnpm doctor
```

If doctor reports missing optional systems, continue with local demo flow (those checks are surfaced as degraded/non-blocking where applicable).

## 3) Run the launch demo path

```bash
pnpm verify:demo
```

Expected output artifacts:

- `demo_artifacts/demo-summary.json`
- `demo_artifacts/demo-receipt.json`

## 4) Run proof/replay checks

```bash
pnpm verify:determinism
pnpm verify:replay
pnpm evidence
```

## Optional: full quickstart script

For a shell-driven walkthrough:

```bash
bash scripts/quickstart.sh
```

Use `--real` for the longer full-stack pass:

```bash
bash scripts/quickstart.sh --real
```
