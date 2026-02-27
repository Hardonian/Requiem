# AGENTS.md — Requiem Agent Operating Contract

> **Read this before making any change.** This document governs all automated
> and AI-assisted contributions to this repository.

## Who This Applies To

Every agent (human, AI, CI bot, or automated tool) that modifies files in this
repo is bound by these rules. "Agent" includes Claude, GitHub Actions runners,
Dependabot, and any scripted automation.

---

## Non-Negotiables

These rules are enforced by CI and **block merge** if violated:

| Rule | Enforced By |
|------|------------|
| No determinism changes without contract + test update | `scripts/verify_determinism.sh`, `scripts/verify_version_contracts.sh` |
| No hard-500 routes (unhandled errors in API routes) | `scripts/verify_routes.sh` |
| OSS (`src/`, `include/requiem/`) must not import enterprise headers | `scripts/verify_oss_boundaries.sh` |
| Next.js must not compute hashes or spawn processes directly | `scripts/verify_enterprise_boundaries.sh` |
| All dependency changes require allowlist update | `scripts/verify_deps.sh` |
| Any CAS/protocol version bump requires compatibility test | `scripts/verify_migrations.sh` |
| PR description must include scope tag and affected layer | `scripts/verify_pr_metadata.sh` |
| `prompts/system.lock.md` checksum must be in PR footer if prompts changed | `scripts/verify_prompt_lock.sh` |

---

## Scope Boundaries

See `SCOPE.md` for the definitive layer map. Summary:

- **Requiem OSS engine** (`src/`, `include/requiem/`, `tests/`) — C++20, no
  runtime dependencies beyond vendored BLAKE3 and optional zstd.
- **ReadyLayer Cloud** (`ready-layer/`) — Next.js 14, TypeScript, Vercel. Must
  delegate all hashing and execution to the engine via HTTP API.
- **CI / scripts** (`scripts/`, `.github/`) — bash scripts + GitHub Actions
  YAML. Changes here block all other merges until green.

Cross-layer changes (touching ≥2 of the above) require explicit annotation in
the PR title: `[cross-layer]`.

---

## Invariants (Quick Reference)

Full definitions in `INVARIANTS.md`. Summary:

1. **Digest parity**: same request → same `result_digest`, always.
2. **CAS immutability**: once a digest is stored, its content never changes.
3. **Audit append-only**: audit log entries are never deleted or mutated.
4. **No silent version drift**: version constants in `version.hpp` must match
   live binary output.
5. **OSS ≠ Enterprise**: OSS source has zero direct dependency on enterprise
   code paths.

---

## How to Make a Determinism-Affecting Change

1. Update `contracts/determinism.contract.json` — bump the relevant version.
2. Update `include/requiem/version.hpp` — bump the matching constant.
3. Run `scripts/generate_golden_corpus.sh` — commit new `*.expected_digest`.
4. Update `docs/CONTRACT.md` and/or `docs/MIGRATION.md`.
5. Add a regression test in `tests/requiem_tests.cpp`.
6. PR footer **must** include:
   ```
   Determinism-Contract: bumped <field> <old_version> -> <new_version>
   Prompt-Lock-SHA256: <sha256 of prompts/system.lock.md if prompts changed>
   ```

---

## Prompt Lock

The file `prompts/system.lock.md` defines the authoritative system prompt
parameters. Its SHA-256 is pinned per PR. If `prompts/system.lock.md` is
modified, the new SHA-256 must appear in the PR description footer:

```
Prompt-Lock-SHA256: <64-hex-char sha256>
```

CI will compute `sha256sum prompts/system.lock.md` and assert the footer value
matches. This prevents unreviewed prompt drift.

---

## Add-If-Missing / Improve-If-Existing Policy

- **Never remove** existing CI checks. Only add or strengthen.
- **Never downgrade** a blocking check to a warning. Only the reverse.
- **Never skip** hooks via `--no-verify` or equivalent.
- If a check is flaky, fix the check. Do not disable it.
