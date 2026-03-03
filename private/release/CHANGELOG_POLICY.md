# Changelog Policy: Requiem / Zeo

## Formatting Guidelines

- Every release must have a corresponding entry in `CHANGELOG.md` at the root.
- Use **Conventional Commits** (e.g., `feat:`, `fix:`, `perf:`, `ops:`, `docs:`) as the basis for changelog entries.
- Group entries by change type.

## Content Requirements

### Summary (Required for MINOR/MAJOR)

- A 1-2 sentence high-level overview of the release value.
- "Introduces the `Microfracture Suite` for automated drift taxonomy."

### Core Invariant Changes (Always Required)

- Clearly state if the `result_digest` or `BLAKE3` signature has changed.
- Use: `[INVARIANT: VERIFIED SUSTAINED]` or `[INVARIANT: BREAKING GH-####]`.

### Documentation Sync

- Confirm that `reach help` has been updated and verified by `docs-truth-gate.ts`.

## Prohibited Content

- Internal employee names.
- References to internal private URLs or unreleased projects.
- "Aspirational" feature mentions unless clearly marked as "Experimental / Flagged".
- "Fixed some stuff". Be technical: "Fixed non-deterministic BLAKE3 padding on x86_64."
