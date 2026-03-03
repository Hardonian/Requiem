# Versioning Policy: Requiem / Zeo

## Semantic Versioning (SemVer) 2.0.0

Requiem follows SemVer. All public APIs (CLI, UI, Library) are subject to these rules.

| Change Type | Version Bump | Examples |
| :--- | :--- | :--- |
| **Breaking** | MAJOR (`X.0.0`) | Removal of CLI command, Hashing algorithm change (BLAKE3 update), DB schema incompatible. |
| **New Feature** | MINOR (`0.X.0`) | New `reach` command added, New UI component in ReadyLayer, New audit mode. |
| **Bug Fix / Refactor** | PATCH (`0.0.X`) | Determinism fixes (non-breaking), Documentation, CI performance, Internal refactors. |

## Invariant Stability Rule

**Hashing Algorithm (BLAKE3-v1)**
- Changing the hashing protocol or domain separation constitutes a MAJOR breaking change.
- In-place performance optimizations that do NOT change the result digest are MINOR or PATCH.

## Native Engine (`librequiem`) Versioning
The C++ core is versioned independently but pinned in CLI `package.json`. A core upgrade that breaks `result_digest` compatibility is ALWAYS a MAJOR version bump for the CLI.

## Release Schedule
- **Candidate releases**: `vX.Y.Z-rc.N` for internal verification.
- **Stable releases**: General availability.
