# Semantic Honesty Review

## Root command contract (repo reality)

| Command | Previous behavior | Reasonable contributor expectation | Mismatch | Change made |
|---|---|---|---|---|
| `pnpm install` | Workspace install with pinned lockfile behavior if `--frozen-lockfile` is supplied. | Deterministic install and dependency resolution stability. | Low. | No command change; kept `--frozen-lockfile` as canonical in docs. |
| `pnpm run dev` | Starts `ready-layer` dev server. | Obvious local entry point to run app surface. | Low. | Kept behavior; documented as canonical dev entry point. |
| `pnpm run build` | Previously only `build:engine`. | Root build should represent meaningful OSS product surface. | High. | Updated to run `build:engine` and `build:web`. |
| `pnpm run test` | Runs engine smoke tests (`test:smoke`). | Full test gate or clearly-scoped smoke path. | Medium. | Kept behavior, documented explicitly as smoke gate; `verify:all` remains strongest gate. |
| `pnpm run verify:all` | Runs doctor, route inventory, route checks, lint, typecheck, build, test. | Strongest root confidence gate. | Low. | Kept behavior; now inherits truthful root `build`. |
| `pnpm run doctor` | Checked toolchain with outdated minimums and mixed messaging. | Explicit blocker diagnosis and actionable remediation. | Medium. | Updated minimum versions, actionable remediation, and engine-state messaging on Linux + Windows scripts. |

## Mismatches found

1. Root `build` name implied broader coverage than actual behavior (engine-only).
2. Doctor version gates were inconsistent with declared repo requirements (Node 18 accepted while docs required Node 20.11+).
3. Getting-started and contributing entry docs had duplicated/contradictory instructions.

## Changes made

- Root script truth fix: `build` now executes `build:engine` then `build:web`.
- Doctor script truth fix:
  - Node minimum aligned to `20.11.0`.
  - pnpm minimum aligned to `8.15.0` (`packageManager` pin).
  - Clang minimum aligned to `14.0.0`.
  - Actionable remediation text added for each blocking failure.
  - Engine missing artifact reported as non-blocking warning with exact remediation.
- Canonical docs rewritten for first-clone predictability and command semantics.

## Prerequisite clarity fixes

- Consolidated and aligned prerequisite versions in `README.md`, `docs/GETTING_STARTED.md`, and `GETTING_STARTED.md`.
- Removed contradictory onboarding duplication in `CONTRIBUTING.md` and `docs/GETTING_STARTED.md` by replacing with single canonical paths.

## Engine failure-path fixes

- `doctor` now states when engine binary is missing, whether it is blocking, and the exact remediation command:
  - `pnpm run build:engine`
- Failure text now distinguishes blocking prerequisite failures from non-blocking local build state.

## Removed/corrected ambiguous surface

- Corrected misleading root `build` semantics (engine-only -> engine + web).
- Corrected stale prerequisite claims and mixed onboarding instructions.
- Retained specialized scripts that are real and callable; no dead/no-op script additions introduced.

## First-clone assessment (post-fix)

A skeptical first-clone user now gets:

1. Deterministic install guidance (`--frozen-lockfile`).
2. Doctor checks that match declared versions and provide remediation.
3. `verify:all` as strongest gate, with root `build` now semantically truthful.
4. `dev` startup behavior that is predictable and documented.

## Remaining external limitations

- `verify-routes-runtime` can skip rate-limit 429 assertion depending on local runtime timing and load behavior; this is reported explicitly in command output and not masked.
