# Architectural Invariants

These invariants are the platform-level guardrails that prevent long-term drift.
They complement `docs/INVARIANTS.md` with explicit cross-layer constraints.

## 1. Contracts are the source of behavioral truth

- Route behavior must remain consistent with `routes.manifest.json` and route verification scripts.
- CLI contract snapshots must be updated intentionally, not by accidental command drift.
- Version constants, compatibility matrix, and binary-reported versions must stay synchronized.

Enforcement surfaces:
- `scripts/verify-routes.ts`
- `scripts/verify-cli-contract.ts`
- `scripts/verify_version_contracts.sh`
- `scripts/verify_compat_matrix.sh`

## 2. Core runtime is isolated from presentation layers

- Engine determinism and CAS logic must not depend on UI framework concerns.
- OSS engine code must not import enterprise-only paths.
- UI/API layers orchestrate, they do not redefine engine truth.

Enforcement surfaces:
- `scripts/verify_oss_boundaries.sh`
- `scripts/verify-ui-boundaries.mjs`

## 3. CLI remains a thin orchestration layer

- CLI commands map to runtime capabilities and should avoid duplicate domain logic.
- Help/version pathways must remain low-latency and avoid heavy dependency loading.
- CLI error envelopes must stay consistent and machine-readable.

Enforcement surfaces:
- `packages/cli/src/cli.ts`
- `contracts/cli-surface.snapshot.json`
- `scripts/verify-no-console.ts`

## 4. Public routes remain explicitly public; protected routes remain protected

- Probe/health routes can be anonymous only when explicitly marked.
- Protected routes require explicit auth and tenant context boundaries.
- Route ownership and classification changes require manifest + verification updates.

Enforcement surfaces:
- `routes.manifest.json`
- `scripts/verify-routes.ts`
- `scripts/verify-tenant-body.ts`

## 5. Deterministic operations stay deterministic

- Same canonical input must continue producing same digest unless contract version is intentionally bumped.
- Determinism-affecting changes require contract/version/test updates.
- Replay divergence is treated as a regression signal.

Enforcement surfaces:
- `contracts/determinism.contract.json`
- `scripts/verify_determinism.sh`
- `scripts/verify_version_contracts.sh`

## 6. Security checks must not over-claim

- Verification failures are explicit and machine-visible.
- Degraded checks cannot silently pass.
- Claims in docs and release notes must be backed by runnable checks.

Enforcement surfaces:
- `scripts/verify_security.sh`
- `scripts/verify:nosecrets` (npm script)
- `scripts/verify:no-stack-leaks` (npm script)

## 7. OSS usability is preserved independent of enterprise features

- OSS workflows must remain runnable without enterprise-only infrastructure.
- Enterprise additions must not break default OSS developer loops.
- New hard dependencies require explicit allowlist and release-note handling.

Enforcement surfaces:
- `scripts/verify_deps.sh`
- `contracts/deps.allowlist.json`
- `scripts/doctor.sh`
