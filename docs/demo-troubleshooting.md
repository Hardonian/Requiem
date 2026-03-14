# Demo Troubleshooting

## `pnpm install --frozen-lockfile` fails

- Ensure Node version is `>=20.11`.
- Re-run with a clean working tree and lockfile.

## `pnpm build` fails

- Verify C++/CMake toolchain is installed.
- Run `pnpm build:cpp` to isolate engine-side failures.

## `pnpm doctor` reports degraded state

- Read the explicit warning. Continue only if it is marked optional/non-blocking.
- Capture output in launch notes; do not hide degraded status.

## `pnpm verify:demo` fails

- Re-run after `pnpm build`.
- Check script output from `scripts/demo-doctor.ts` and `scripts/demo-run.ts`.

## replay/determinism checks fail

- Run:

```bash
pnpm verify:determinism
pnpm verify:replay
```

- Treat mismatch/drift as launch-blocking unless clearly documented in `docs/known-issues.md`.
