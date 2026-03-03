# BASELINE_AUDIT.md

Date: 2026-03-02  
Phase: 0 (discovery + baseline evidence, no-code baseline capture)

## Baseline Log Directories

- `docs/baseline-logs/requiem-20260302-213950`
- `docs/baseline-logs/requiem-verify-pass2-20260302-214518`
- `docs/baseline-logs/ready-layer-20260302-215218`

## Repo Inventory (Top-Level)

- Kernel/CLI: `src/`, `include/`, `tests/`, `CMakeLists.txt`
- Web: `ready-layer/`
- TS packages: `packages/cli`, `packages/ai`, `packages/ui`
- Scripts/verify: `scripts/`, `ready-layer/scripts/`
- Docs/specs: `docs/KERNEL_SPEC.md`, `docs/VERTICAL_SLICE.md`, `README.md`

## Baseline Command Matrix (Captured)

### Root (`docs/baseline-logs/requiem-20260302-213950/summary.tsv`)

| Command | Exit |
| --- | --- |
| `pnpm install` | 1 |
| `pnpm lint` | 1 |
| `pnpm typecheck` | 1 |
| `pnpm test` | 1 |
| `pnpm build` | 1 |
| `pnpm doctor` | 0 |

### Root Verify Sweep (`docs/baseline-logs/requiem-verify-pass2-20260302-214518/summary.tsv`)

- Multiple verify targets failed, including: `verify:cpp`, `verify:integrity`, `verify:policy`, `verify:replay`, `verify:web`, many `tsx`-backed checks.
- A small subset passed (`verify:boundaries`, `verify:lint`, `verify:schemas`, `verify:skills`, `verify:economics`).

### Web (`docs/baseline-logs/ready-layer-20260302-215218/summary.tsv`)

| Command | Exit |
| --- | --- |
| `pnpm install` | 1 |
| `pnpm lint` | 0 |
| `pnpm type-check` | 0 |
| `pnpm test` | 1 |
| `pnpm build` | 0 |
| `pnpm verify:all` | 1 |

## Key Baseline Error Snippets

### CMake cache mismatch (Windows/WSL drift)

From `docs/baseline-logs/requiem-20260302-213950/build.log`:

```text
CMake Error: The current CMakeCache.txt directory .../build is different than ... c:/Users/scott/GitHub/Requiem/build ...
CMake Error: The source "/mnt/c/.../CMakeLists.txt" does not match the source "C:/.../CMakeLists.txt" used to generate cache.
```

### `tsx` IPC socket failure on mounted temp path

From `docs/baseline-logs/requiem-verify-pass2-20260302-214518/verify_ai-safety.log` (and many other verify logs):

```text
Error: listen ENOTSUP: operation not supported on socket /mnt/c/Users/scott/AppData/Local/Temp/tsx-1000/....pipe
```

### Baseline web test gate failure

From `docs/baseline-logs/ready-layer-20260302-215218/test.log`:

```text
No test files found, exiting with code 1
```

## Baseline Conclusion

Baseline was not green. Dominant blockers were:

1. `tsx` runtime incompatibility on mounted temp sockets.
2. CMake cache/source path drift across environments.
3. Verify-script/CLI contract mismatch in web verify flows.
4. Missing runnable web tests in `ready-layer`.

All baseline artifacts above were retained for traceable before/after comparison.
